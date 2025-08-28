const Project = require('../models/Project');
const googleDriveService = require('../services/googleDriveService');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/edited-videos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|wmv|flv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('video/');

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

/**
 * @desc    Get editor dashboard data
 * @route   GET /api/editor/dashboard
 * @access  Private (Editor only)
 */
exports.getDashboard = async (req, res) => {
  try {
    const editorId = req.user._id;
    console.log('🔍 Editor dashboard request for editorId:', editorId);

    // Get assigned projects
    const activeProjects = await Project.countDocuments({ 
      assignedEditor: editorId, 
      status: { $in: ['assigned', 'in_progress'] }
    });
    console.log('📊 Active projects count:', activeProjects);
    
    const inProgress = await Project.countDocuments({ 
      assignedEditor: editorId, 
      status: 'in_progress' 
    });
    
    const completedProjects = await Project.countDocuments({ 
      assignedEditor: editorId, 
      status: 'completed' 
    });
    
    // Get projects due soon (within 3 days)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const dueSoon = await Project.countDocuments({ 
      assignedEditor: editorId, 
      deadline: { $lte: threeDaysFromNow },
      status: { $in: ['assigned', 'in_progress'] }
    });

    // Get current projects (assigned or in progress)
    const currentProjects = await Project.find({ 
      assignedEditor: editorId,
      status: { $in: ['assigned', 'in_progress'] }
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('assignedEditor', 'name')
      .select('publicId clientName description status priority deadline createdAt updatedAt');

    console.log('📋 Current projects found:', currentProjects.length);
    console.log('📋 Current projects:', currentProjects.map(p => ({ 
      id: p._id, 
      clientName: p.clientName, 
      status: p.status,
      assignedEditor: p.assignedEditor 
    })));

    // Get recent activity (simulate activity feed)
    const recentActivity = await Project.find({ assignedEditor: editorId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('publicId clientName status updatedAt')
      .then(projects => projects.map(project => ({
        type: 'progress',
        message: `Project updated: ${project.clientName}`,
        time: project.updatedAt,
        projectId: project.publicId
      })));

    res.status(200).json({
      success: true,
      stats: {
        activeProjects,
        inProgress,
        completedProjects,
        dueSoon
      },
      currentProjects,
      recentActivity
    });
  } catch (error) {
    console.error('Editor dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data'
    });
  }
};

/**
 * @desc    Get assigned projects
 * @route   GET /api/editor/projects
 * @access  Private (Editor only)
 */
exports.getAssignedProjects = async (req, res) => {
  try {
    const editorId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = { assignedEditor: editorId };
    if (status) filter.status = status;

    // Get projects with pagination
    const projects = await Project.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

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
    console.error('Get assigned projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assigned projects'
    });
  }
};

/**
 * @desc    Get single project details for editor
 * @route   GET /api/editor/projects/:id
 * @access  Private (Editor only)
 */
exports.getProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const editorId = req.user._id;

    const project = await Project.findOne({
      _id: projectId,
      assignedEditor: editorId
    }).populate('timeline.user', 'name role');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or not assigned to you'
      });
    }

    // Filter project data to remove sensitive client information
    // Editors should only see brand details and requirements, not personal info
    const filteredProject = {
      _id: project._id,
      publicId: project.publicId,
      // Brand and project info (allowed)
      brandName: project.brandName,
      videoType: project.videoType,
      clientType: project.clientType,
      description: project.description,
      deadline: project.deadline,
      
      // New client fields (requirements only)
      hasScript: project.hasScript,
      contentCount: project.contentCount,
      logoFiles: project.logoFiles,
      referenceLinks: project.referenceLinks,
      musicPreferences: project.musicPreferences,
      
      // Existing client fields
      specialInstructions: project.specialInstructions,
      
      // Upload and notes
      uploadLinks: project.uploadLinks,
      notes: project.notes,
      
      // Project workflow fields
      status: project.status,
      priority: project.priority,
      progress: project.progress,
      assignedEditor: project.assignedEditor,
      assignedDate: project.assignedDate,
      
      // Editor deadline info
      editorDeadlineHours: project.editorDeadlineHours,
      editorDeadline: project.editorDeadline,
      isEditorDeadlineExceeded: project.isEditorDeadlineExceeded,
      
      // Adobe video link
      adobeVideoLink: project.adobeVideoLink,
      
      // Drive links
      driveLinks: project.driveLinks,
      
      // Admin and revision notes
      adminNotes: project.adminNotes,
      revisionNotes: project.revisionNotes,
      
      // Timeline and versions
      timeline: project.timeline,
      versions: project.versions,
      
      // Metadata
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      
      // EXCLUDED: Personal client information
      // clientName, clientEmail, clientPhone, companyName, socialMediaHandle
    };

    // Get Google Drive folder info
    let driveInfo = null;
    try {
      driveInfo = await googleDriveService.getFolderInfo(project.driveFolderId);
    } catch (error) {
      console.error('Error getting drive info:', error);
    }

    res.status(200).json({
      success: true,
      project: filteredProject,
      driveInfo
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
 * @desc    Update project status
 * @route   PUT /api/editor/projects/:id/status
 * @access  Private (Editor only)
 */
exports.updateProjectStatus = async (req, res) => {
  try {
    console.log('🔍 Update project status request:');
    console.log('Project ID:', req.params.id);
    console.log('Editor ID:', req.user._id);
    console.log('Body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const projectId = req.params.id;
    const editorId = req.user._id;
    const { status, progress, notes } = req.body;

    const project = await Project.findOne({
      _id: projectId,
      assignedEditor: editorId
    });

    console.log('📋 Project found:', project ? 'Yes' : 'No');
    if (project) {
      console.log('📋 Project details:', {
        id: project._id,
        clientName: project.clientName,
        currentStatus: project.status,
        assignedEditor: project.assignedEditor
      });
    }

    if (!project) {
      console.log('❌ Project not found or not assigned to editor');
      return res.status(404).json({
        success: false,
        message: 'Project not found or not assigned to you'
      });
    }

    // Validate status transitions
    const validStatuses = ['assigned', 'in_progress', 'completed', 'revision_in_progress'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Update project
    const oldStatus = project.status;
    project.status = status;
    
    if (progress !== undefined) {
      project.progress = Math.max(0, Math.min(100, progress));
    }

    // Add timeline entry
    await project.addTimelineEntry(
      `Status updated from ${oldStatus} to ${status}`,
      req.user._id,
      notes || `Progress: ${project.progress}%`
    );

    res.status(200).json({
      success: true,
      message: 'Project status updated successfully',
      project
    });
  } catch (error) {
    console.error('❌ Update project status error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error updating project status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Upload edited video version
 * @route   POST /api/editor/projects/:id/upload-version
 * @access  Private (Editor only)
 */
exports.uploadEditedVersion = [
  upload.single('video'),
  async (req, res) => {
    try {
      const projectId = req.params.id;
      const editorId = req.user._id;
      const { notes } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No video file uploaded'
        });
      }

      const project = await Project.findOne({
        _id: projectId,
        assignedEditor: editorId
      });

      if (!project) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Project not found or not assigned to you'
        });
      }

      try {
        // Determine version number
        const latestVersion = project.getLatestVersion();
        const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

        // Upload to Google Drive
        const driveUpload = await googleDriveService.uploadEditedVersion(
          req.file.path,
          req.file.originalname,
          project.driveFolderId,
          newVersionNumber
        );

        // Add version to project
        project.editedVersions.push({
          version: newVersionNumber,
          filename: req.file.originalname,
          driveFileId: driveUpload.uploadedFile.id,
          driveFileUrl: driveUpload.uploadedFile.webViewLink,
          notes: notes || '',
          status: 'pending'
        });

        // Update project status
        project.status = 'completed';
        project.progress = 100;

        // Add timeline entry
        await project.addTimelineEntry(
          `Uploaded edited version v${newVersionNumber}`,
          req.user._id,
          notes
        );

        // Clean up local file
        fs.unlinkSync(req.file.path);

        res.status(200).json({
          success: true,
          message: 'Edited version uploaded successfully',
          version: {
            number: newVersionNumber,
            filename: req.file.originalname,
            driveUrl: driveUpload.uploadedFile.webViewLink
          },
          project
        });

      } catch (driveError) {
        // Clean up local file on error
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        console.error('Drive upload error:', driveError);
        res.status(500).json({
          success: false,
          message: 'Error uploading to Google Drive'
        });
      }

    } catch (error) {
      // Clean up local file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error('Upload edited version error:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading edited version'
      });
    }
  }
];

/**
 * @desc    Get project files from Google Drive
 * @route   GET /api/editor/projects/:id/files
 * @access  Private (Editor only)
 */
exports.getProjectFiles = async (req, res) => {
  try {
    const projectId = req.params.id;
    const editorId = req.user._id;

    const project = await Project.findOne({
      _id: projectId,
      assignedEditor: editorId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or not assigned to you'
      });
    }

    try {
      // Get files from client upload folder
      const clientFiles = project.clientUploadFolderId 
        ? await googleDriveService.listFilesInFolder(project.clientUploadFolderId)
        : [];

      // Get edited versions
      const editedVersions = project.editedVersions.map(version => ({
        ...version.toObject(),
        downloadUrl: version.driveFileUrl
      }));

      res.status(200).json({
        success: true,
        clientFiles,
        editedVersions,
        driveFolder: {
          id: project.driveFolderId,
          url: project.driveFolderUrl
        }
      });

    } catch (driveError) {
      console.error('Error fetching drive files:', driveError);
      res.status(500).json({
        success: false,
        message: 'Error fetching project files from Google Drive'
      });
    }

  } catch (error) {
    console.error('Get project files error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project files'
    });
  }
};

/**
 * @desc    Get Google Drive access link
 * @route   GET /api/editor/projects/:id/drive-access
 * @access  Private (Editor only)
 */
exports.getDriveAccess = async (req, res) => {
  try {
    const projectId = req.params.id;
    const editorId = req.user._id;

    const project = await Project.findOne({
      _id: projectId,
      assignedEditor: editorId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or not assigned to you'
      });
    }

    res.status(200).json({
      success: true,
      driveAccess: {
        folderId: project.driveFolderId,
        folderUrl: project.driveFolderUrl,
        clientUploadFolderId: project.clientUploadFolderId,
        editedVersionsFolderId: project.editedVersionsFolderId
      }
    });

  } catch (error) {
    console.error('Get drive access error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting drive access information'
    });
  }
};

/**
 * @desc    Add Adobe video link
 * @route   POST /api/editor/projects/:id/adobe-link
 * @access  Private (Editor only)
 */
exports.addAdobeLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { url, notes } = req.body;
    const editorId = req.user._id;

    // Validate URL
    if (!url || !url.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Adobe video URL is required'
      });
    }

    // Find project
    const project = await Project.findOne({
      _id: id,
      assignedEditor: editorId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or not assigned to you'
      });
    }

    // Update Adobe link
    project.adobeVideoLink = {
      url: url.trim(),
      addedDate: new Date(),
      addedBy: editorId,
      notes: notes || ''
    };

    // Add to timeline
    project.timeline.push({
      action: 'Adobe video link added',
      user: editorId,
      timestamp: new Date(),
      notes: `Editor added Adobe video link${notes ? ': ' + notes : ''}`
    });

    await project.save();

    res.status(200).json({
      success: true,
      message: 'Adobe video link added successfully',
      adobeLink: {
        url: project.adobeVideoLink.url,
        addedDate: project.adobeVideoLink.addedDate,
        notes: project.adobeVideoLink.notes
      }
    });

  } catch (error) {
    console.error('Add Adobe link error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding Adobe video link'
    });
  }
};

/**
 * @desc    Update Adobe video link
 * @route   PUT /api/editor/projects/:id/adobe-link
 * @access  Private (Editor only)
 */
exports.updateAdobeLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { url, notes } = req.body;
    const editorId = req.user._id;

    // Validate URL
    if (!url || !url.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Adobe video URL is required'
      });
    }

    // Find project
    const project = await Project.findOne({
      _id: id,
      assignedEditor: editorId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or not assigned to you'
      });
    }

    // Update Adobe link
    if (project.adobeVideoLink) {
      project.adobeVideoLink.url = url.trim();
      project.adobeVideoLink.notes = notes || '';
      project.adobeVideoLink.addedDate = new Date(); // Update timestamp
    } else {
      project.adobeVideoLink = {
        url: url.trim(),
        addedDate: new Date(),
        addedBy: editorId,
        notes: notes || ''
      };
    }

    // Add to timeline
    project.timeline.push({
      action: 'Adobe video link updated',
      user: editorId,
      timestamp: new Date(),
      notes: `Editor updated Adobe video link${notes ? ': ' + notes : ''}`
    });

    await project.save();

    res.status(200).json({
      success: true,
      message: 'Adobe video link updated successfully',
      adobeLink: {
        url: project.adobeVideoLink.url,
        addedDate: project.adobeVideoLink.addedDate,
        notes: project.adobeVideoLink.notes
      }
    });

  } catch (error) {
    console.error('Update Adobe link error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating Adobe video link'
    });
  }
};
