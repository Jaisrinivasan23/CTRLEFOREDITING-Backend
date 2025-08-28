const User = require('../models/User');
const Project = require('../models/Project');
const googleDriveService = require('../services/googleDriveService');
const emailService = require('../services/emailService');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const fs = require('fs');

/**
 * @desc    Get admin dashboard stats
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin only)
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments();
    const activeProjects = await Project.countDocuments({ 
      status: { $in: ['assigned', 'in_progress', 'under_review'] }
    });
    const completedProjects = await Project.countDocuments({ status: 'completed' });
    const pendingReview = await Project.countDocuments({ status: 'under_review' });
    const revisionRequested = await Project.countDocuments({ status: 'revision_requested' });
    const totalEditors = await User.countDocuments({ role: 'editor', isActive: true });

    // Recent activities
    const recentProjects = await Project.find()
      .populate('assignedEditor', 'name email')
      .sort({ updatedAt: -1 })
      .limit(10);

    // Status distribution
    const statusStats = await Project.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalProjects,
        activeProjects,
        completedProjects,
        pendingReview,
        revisionRequested,
        totalEditors
      },
      recentProjects,
      statusStats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics'
    });
  }
};

/**
 * @desc    Get all projects with filters
 * @route   GET /api/admin/projects
 * @access  Private (Admin only)
 */
exports.getAllProjects = async (req, res) => {
  try {
    const {
      status,
      clientName,
      editorName,
      priority,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) filter.status = status;
    if (clientName) filter.clientName = { $regex: clientName, $options: 'i' };
    if (priority) filter.priority = priority;

    // Build query
    let query = Project.find(filter);

    // Add editor filter if provided
    if (editorName) {
      const editors = await User.find({
        name: { $regex: editorName, $options: 'i' },
        role: 'editor'
      });
      const editorIds = editors.map(e => e._id);
      filter.assignedEditor = { $in: editorIds };
      query = Project.find(filter);
    }

    // Populate and sort
    query = query.populate('assignedEditor', 'name email phone');
    
    // Sort
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    query = query.sort(sortObj);

    // Execute query with pagination
    const projects = await query
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count
    const total = await Project.countDocuments(filter);

    res.status(200).json({
      success: true,
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching projects'
    });
  }
};

/**
 * @desc    Get single project details
 * @route   GET /api/admin/projects/:id
 * @access  Private (Admin only)
 */
exports.getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedEditor', 'name email phone')
      .populate('timeline.user', 'name role');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project details'
    });
  }
};

/**
 * @desc    Add new editor
 * @route   POST /api/admin/add-editor
 * @access  Private (Admin only)
 */
exports.addEditor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, phone, specialties, hourlyRate, maxProjects } = req.body;

    // Check if editor already exists
    const existingEditor = await User.findOne({ email });
    if (existingEditor) {
      return res.status(400).json({
        success: false,
        message: 'Editor with this email already exists'
      });
    }

    // Generate temporary password
    const temporaryPassword = Math.random().toString(36).slice(-8) + '@' + Math.random().toString(36).slice(-2).toUpperCase();

    // Create editor
    const editor = await User.create({
      name,
      email,
      phone,
      password: temporaryPassword,
      role: 'editor',
      specialties: specialties || [],
      hourlyRate: hourlyRate || 0,
      maxProjects: maxProjects || 5
    });

    // Send credentials via email
    try {
      await emailService.sendEditorCredentials({
        name,
        email
      }, temporaryPassword);
    } catch (emailError) {
      console.error('Failed to send editor credentials email:', emailError);
      // Continue even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Editor added successfully and credentials sent via email',
      editor: {
        id: editor._id,
        name: editor.name,
        email: editor.email,
        phone: editor.phone,
        role: editor.role,
        isActive: editor.isActive
      }
    });
  } catch (error) {
    console.error('Add editor error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding editor'
    });
  }
};

/**
 * @desc    Get all editors
 * @route   GET /api/admin/editors
 * @access  Private (Admin only)
 */
exports.getAllEditors = async (req, res) => {
  try {
    const { isActive, search } = req.query;
    
    const filter = { role: 'editor' };
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const editors = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    // Get project counts for each editor
    const editorsWithStats = await Promise.all(
      editors.map(async (editor) => {
        const assignedProjects = await Project.countDocuments({ assignedEditor: editor._id });
        const completedProjects = await Project.countDocuments({ 
          assignedEditor: editor._id, 
          status: 'completed' 
        });
        const currentProjects = await Project.countDocuments({ 
          assignedEditor: editor._id, 
          status: { $in: ['assigned', 'in_progress', 'under_review'] }
        });
        
        return {
          ...editor.toObject(),
          currentProjects,
          stats: {
            assignedProjects,
            completedProjects
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      editors: editorsWithStats
    });
  } catch (error) {
    console.error('Get all editors error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching editors'
    });
  }
};

/**
 * @desc    Assign project to editor
 * @route   POST /api/admin/assign-editor
 * @access  Private (Admin only)
 */
exports.assignProjectToEditor = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { projectId, editorId, notes, dueDate, comments, isReassignment, deadlineHours } = req.body;

    // Check if project exists
    const project = await Project.findById(projectId).populate('assignedEditor', 'name email');
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if editor exists
    const editor = await User.findById(editorId);
    if (!editor || editor.role !== 'editor') {
      return res.status(404).json({
        success: false,
        message: 'Editor not found'
      });
    }

    const previousEditor = project.assignedEditor;
    const isActualReassignment = isReassignment && previousEditor && previousEditor._id.toString() !== editorId;

    // Grant editor access to Google Drive folder
    try {
      await googleDriveService.grantEditorAccess(project.driveFolderId, editor.email);
    } catch (driveError) {
      console.error('Failed to grant Drive access:', driveError);
      // Continue even if Drive access fails
    }

    // Update project
    project.assignedEditor = editorId;
    project.assignedDate = new Date();
    project.status = isActualReassignment ? 'reassigned' : 'assigned';
    if (dueDate) project.dueDate = new Date(dueDate);
    if (notes) project.adminNotes = notes;
    
    // Set editor deadline
    const hours = deadlineHours || 24; // Default 24 hours if not specified
    project.editorDeadlineHours = hours;
    project.editorDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);
    project.isEditorDeadlineExceeded = false;
    
    // Add reassignment comments to project history
    if (comments) {
      if (!project.adminComments) project.adminComments = [];
      project.adminComments.push({
        comment: comments,
        date: new Date(),
        type: isActualReassignment ? 'reassignment' : 'assignment'
      });
    }

    await project.save();
    console.log('✅ Project assigned successfully:', {
      projectId: project._id,
      editorId: editorId,
      status: project.status,
      assignedEditor: project.assignedEditor
    });

    await project.addTimelineEntry(
      isActualReassignment 
        ? `Project reassigned to ${editor.name}${previousEditor ? ` (from ${previousEditor.name})` : ''}`
        : `Project assigned to ${editor.name}`,
      req.user._id,
      comments || notes
    );

    // Send notification email to editor
    try {
      await emailService.sendProjectAssignmentNotification(editor, project);
    } catch (emailError) {
      console.error('Failed to send assignment email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Project assigned successfully',
      project
    });
  } catch (error) {
    console.error('Assign project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning project'
    });
  }
};

/**
 * @desc    Review project (approve or request re-edit)
 * @route   POST /api/admin/review-project
 * @access  Private (Admin only)
 */
exports.reviewProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { projectId, action, notes } = req.body;

    const project = await Project.findById(projectId)
      .populate('assignedEditor', 'name email');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Only allow review if project is completed
    if (project.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Project is not ready for review'
      });
    }

    if (action === 'approve') {
      project.status = 'approved';
      
      // Add admin approval comment
      if (!project.adminComments) project.adminComments = [];
      project.adminComments.push({
        comment: notes || 'Project approved by admin',
        date: new Date(),
        type: 'review'
      });
      
      await project.addTimelineEntry(
        'Project approved by admin - Ready for client download',
        req.user._id,
        notes
      );

      // Send completion notification to client
      try {
        await emailService.sendProjectCompletionNotification(project);
      } catch (emailError) {
        console.error('Failed to send completion email:', emailError);
      }

    } else if (action === 'request_revision') {
      project.status = 'revision_requested';
      
      // Add revision request to admin comments
      if (!project.adminComments) project.adminComments = [];
      project.adminComments.push({
        comment: notes,
        date: new Date(),
        type: 'review'
      });
      
      await project.addTimelineEntry(
        'Admin requested revisions from editor',
        req.user._id,
        notes
      );

      // Notify editor about revision request
      try {
        await emailService.sendNotification(
          project.assignedEditor.email,
          'Revision Requested',
          `Project "${project.title}" requires revisions: ${notes}`
        );
      } catch (emailError) {
        console.error('Failed to send revision email:', emailError);
      }

    } else if (action === 'reassign') {
      // Handle reassignment through review (keeping status as completed for now)
      if (!project.adminComments) project.adminComments = [];
      project.adminComments.push({
        comment: notes || 'Project marked for reassignment during review',
        date: new Date(),
        type: 'review'
      });
      
      await project.addTimelineEntry(
        'Admin marked project for reassignment during review',
        req.user._id,
        notes
      );
    }

    await project.save();

    res.json({
      success: true,
      message: `Project ${action === 'approve' ? 'approved' : action === 'request_revision' ? 'revision requested' : 'marked for reassignment'}`,
      project: await Project.findById(projectId)
        .populate('assignedEditor', 'name email specialties')
        .populate('client', 'name email')
    });
  } catch (error) {
    console.error('Review project error:', error);
    res.status(500).json({
      success: false,
      message: 'Error reviewing project'
    });
  }
};

/**
 * @desc    Update editor status (activate/deactivate)
 * @route   PUT /api/admin/editors/:id/status
 * @access  Private (Admin only)
 */
exports.updateEditorStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const editorId = req.params.id;

    const editor = await User.findById(editorId);
    if (!editor || editor.role !== 'editor') {
      return res.status(404).json({
        success: false,
        message: 'Editor not found'
      });
    }

    editor.isActive = isActive;
    await editor.save();

    res.status(200).json({
      success: true,
      message: `Editor ${isActive ? 'activated' : 'deactivated'} successfully`,
      editor: {
        id: editor._id,
        name: editor.name,
        email: editor.email,
        isActive: editor.isActive
      }
    });
  } catch (error) {
    console.error('Update editor status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating editor status'
    });
  }
};

/**
 * @desc    Delete editor
 * @route   DELETE /api/admin/editors/:id
 * @access  Private (Admin only)
 */
exports.deleteEditor = async (req, res) => {
  try {
    const editorId = req.params.id;

    const editor = await User.findById(editorId);
    if (!editor || editor.role !== 'editor') {
      return res.status(404).json({
        success: false,
        message: 'Editor not found'
      });
    }

    // Check if editor has assigned projects
    const assignedProjects = await Project.countDocuments({ 
      assignedEditor: editorId,
      status: { $in: ['assigned', 'in_progress'] }
    });

    if (assignedProjects > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete editor with active project assignments'
      });
    }

    await User.findByIdAndDelete(editorId);

    res.status(200).json({
      success: true,
      message: 'Editor deleted successfully'
    });
  } catch (error) {
    console.error('Delete editor error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting editor'
    });
  }
};

/**
 * @desc    Upload voice message for admin comments
 * @route   POST /api/admin/projects/:id/voice-message
 * @access  Private (Admin only)
 */
exports.uploadVoiceMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { commentType, messageText } = req.body;
    const adminId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Voice file is required'
      });
    }

    // Find project
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Upload voice message to Google Drive
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `admin-voice-${timestamp}.webm`;
    
    const driveFile = await googleDriveService.uploadVoiceMessage(
      req.file.path,
      fileName,
      project.voiceMessagesFolderId
    );

    // Create voice message object
    const voiceMessage = {
      driveFileId: driveFile.id,
      driveFileUrl: driveFile.downloadLink,
      filename: fileName,
      duration: parseInt(req.body.duration) || 0
    };

    // Add to admin comments
    project.adminComments.push({
      comment: messageText || '',
      voiceMessage: voiceMessage,
      date: new Date(),
      type: commentType || 'general'
    });

    // Add to timeline
    project.timeline.push({
      action: 'Admin voice message added',
      user: adminId,
      timestamp: new Date(),
      notes: `Admin added voice message${messageText ? ': ' + messageText : ''}`
    });

    await project.save();

    // Clean up local file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(200).json({
      success: true,
      message: 'Voice message uploaded successfully',
      voiceMessage: {
        url: driveFile.downloadLink,
        filename: fileName,
        duration: voiceMessage.duration
      }
    });

  } catch (error) {
    console.error('Upload admin voice message error:', error);
    
    // Clean up local file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Error uploading voice message'
    });
  }
};
