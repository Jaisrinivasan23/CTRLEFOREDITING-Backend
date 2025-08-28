const Project = require('../models/Project');
const googleDriveService = require('../services/googleDriveService');
const emailService = require('../services/emailService');
const { validationResult, body } = require('express-validator');
const { clientUpload, voiceUpload } = require('../middleware/memoryUpload');
const path = require('path');

// Remove fs import and local storage dependencies

// No longer need local storage configuration - using memory upload only
// All files go directly to Google Drive from memory buffers

/**
 * @desc    Upload client media and create project
 * @route   POST /api/client/upload
 * @access  Public
 */
exports.uploadMedia = [
  // Memory-based multer middleware
  (req, res, next) => {
    clientUpload.array('media', 10)(req, res, (err) => {
      if (err) {
        console.log('❌ Memory upload error:', err.message);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
          error: err.code || 'UPLOAD_ERROR'
        });
      }
      next();
    });
  },
  // Validation after multer processes the files
  body('clientName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Client name must be between 2 and 100 characters'),
  body('clientPhone')
    .trim()
    .matches(/^[\+]?[\d\s\-\(\)\.]{10,15}$/)
    .withMessage('Please provide a valid phone number (10-15 digits)'),
  body('clientEmail')
    .optional({ checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email if provided'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Description must be between 1 and 1000 characters'),
  async (req, res) => {
    try {
      // Debug logging
      console.log('🔍 Upload request received:');
      console.log('Body:', req.body);
      console.log('Files:', req.files ? req.files.map(f => ({ 
        name: f.originalname, 
        size: f.size,
        mimetype: f.mimetype,
        fieldname: f.fieldname 
      })) : 'No files');
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        // No file cleanup needed - memory storage!
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
          receivedData: {
            body: req.body,
            fileCount: req.files ? req.files.length : 0
          }
        });
      }

      const { clientName, clientPhone, clientEmail, description } = req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No media files uploaded'
        });
      }

      try {
        // Generate publicId manually to ensure it's set
        const publicId = 'CE' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
        
        // Create project first to get ID
        const project = new Project({
          clientName,
          clientPhone,
          clientEmail: clientEmail || null,
          description,
          status: 'uploaded',
          uploadedFiles: [],
          driveFolderId: 'temp', // Will be updated after folder creation
          publicId: publicId
        });

        await project.save();

        // Create Google Drive folder structure
        const driveStructure = await googleDriveService.createClientProjectStructure(
          clientName, 
          project.publicId
        );

        // Update project with drive folder IDs
        project.driveFolderId = driveStructure.mainFolder.id;
        project.driveFolderUrl = driveStructure.mainFolder.webViewLink;
        project.clientUploadFolderId = driveStructure.clientUploadFolder.id;
        project.voiceMessagesFolderId = driveStructure.voiceMessagesFolder.id;
        project.editedVersionsFolderId = driveStructure.editedVersionsFolder.id;

        // Upload files to Google Drive from memory buffers
        const uploadPromises = req.files.map(async (file) => {
          try {
            const driveFile = await googleDriveService.uploadFileFromBuffer(
              file.buffer,
              file.originalname,
              driveStructure.clientUploadFolder.id,
              file.mimetype
            );

            // No file cleanup needed - memory storage!

            return {
              filename: file.originalname,
              originalName: file.originalname,
              size: file.size,
              mimeType: file.mimetype,
              driveFileId: driveFile.id
            };
          } catch (uploadError) {
            console.error('Individual file upload error:', uploadError);
            throw uploadError;
          }
        });

        const uploadedFiles = await Promise.all(uploadPromises);
        project.uploadedFiles = uploadedFiles;

        // Add initial timeline entry
        await project.addTimelineEntry(
          'Project created and media uploaded',
          null,
          `${uploadedFiles.length} file(s) uploaded directly to Google Drive`
        );

        res.status(201).json({
          success: true,
          message: 'Media uploaded successfully to Google Drive and project created',
          project: {
            id: project._id,
            publicId: project.publicId,
            clientName: project.clientName,
            description: project.description,
            status: project.status,
            uploadedFiles: uploadedFiles.length,
            driveFolder: driveStructure.mainFolder.webViewLink
          }
        });

      } catch (error) {
        // No file cleanup needed - memory storage!
        throw error;
      }

    } catch (error) {
      console.error('❌ Upload media error:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Error uploading media and creating project',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];

/**
 * @desc    Enhanced client onboarding with new/existing client support
 * @route   POST /api/client/upload-enhanced
 * @access  Public
 */
exports.uploadEnhanced = [
  // Configure memory upload for mixed file types (no local storage)
  (req, res, next) => {
    const { createMemoryUpload } = require('../middleware/memoryUpload');
    
    const enhancedUpload = createMemoryUpload({
      limits: {
        fileSize: 10 * 1024 * 1024 * 1024 // 10GB limit - essentially unlimited
      },
      fileFilter: (req, file, cb) => {
        console.log('🔍 Enhanced file upload attempt:', {
          originalName: file.originalname,
          mimetype: file.mimetype,
          fieldname: file.fieldname
        });
        
        // Accept all file types - no restrictions
        console.log('✅ All file types accepted:', file.originalname);
        return cb(null, true);
      }
    });

    // Handle both regular files and voice files
    enhancedUpload.fields([
      { name: 'files', maxCount: 50 },
      { name: 'voiceFiles', maxCount: 20 }
    ])(req, res, (err) => {
      if (err) {
        console.log('❌ Enhanced memory upload error:', err.message);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
          error: err.code || 'UPLOAD_ERROR'
        });
      }
      next();
    });
  },

  // Enhanced validation for new/existing client types
  body('clientType')
    .isIn(['new', 'existing'])
    .withMessage('Client type must be either "new" or "existing"'),
  
  // Conditional validation based on client type
  body('clientName')
    .if(body('clientType').equals('new'))
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Client name is required for new clients (2-100 characters)'),
  
  body('clientPhone')
    .trim()
    .matches(/^[\+]?[\d\s\-\(\)\.]{10,15}$/)
    .withMessage('Please provide a valid phone number (10-15 digits)'),
  
  body('clientEmail')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  // New client specific validations
  body('brandName')
    .if(body('clientType').equals('new'))
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Brand name is required for new clients'),
  
  body('videoType')
    .if(body('clientType').equals('new'))
    .isIn(['YouTube Video', 'Instagram Reel', 'Other'])
    .withMessage('Please select a valid video type'),
  
  body('uploadLinks')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1 })
    .withMessage('Upload links must not be empty if provided'),
  
  body('deadline')
    .isISO8601()
    .withMessage('Please provide a valid deadline date'),

  async (req, res) => {
    try {
      console.log('🔍 Enhanced upload request received:');
      console.log('Body:', req.body);
      console.log('Regular files:', req.files?.files ? req.files.files.map(f => ({ 
        name: f.originalname, 
        size: f.size,
        mimetype: f.mimetype 
      })) : 'No regular files');
      console.log('Voice files:', req.files?.voiceFiles ? req.files.voiceFiles.map(f => ({ 
        name: f.originalname, 
        size: f.size,
        mimetype: f.mimetype 
      })) : 'No voice files');
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Enhanced validation errors:', errors.array());
        
        // No file cleanup needed - memory storage!
        
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
          receivedData: {
            body: req.body,
            fileCount: req.files ? Object.values(req.files).flat().length : 0
          }
        });
      }

      // Custom validation: Check if either upload links or files are provided
      const hasUploadLinks = req.body.uploadLinks && req.body.uploadLinks.trim().length > 0;
      const hasFiles = req.files && (
        (req.files.files && req.files.files.length > 0) || 
        (req.files.voiceFiles && req.files.voiceFiles.length > 0)
      );

      if (!hasUploadLinks && !hasFiles) {
        console.log('❌ No upload links or files provided');
        
        // Clean up uploaded files
        if (req.files) {
          Object.values(req.files).flat().forEach(file => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        }

        return res.status(400).json({
          success: false,
          message: 'Please either provide upload links or upload media files',
          errors: [{
            field: 'media',
            message: 'Either upload links or uploaded files are required'
          }]
        });
      }

      const { 
        clientType, 
        clientName, 
        clientPhone, 
        clientEmail, 
        brandName,
        videoType,
        hasScript,
        uploadLinks,
        contentCount,
        logoFiles,
        referenceLinks,
        musicPreferences,
        specialInstructions,
        notes,
        deadline,
        description // For existing clients or general description
      } = req.body;

      try {
        // Generate publicId
        const publicId = 'CE' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
        
        // Create project with enhanced fields
        const projectData = {
          clientType,
          clientName: clientName || `Client-${clientPhone}`, // For existing clients, use phone if no name
          clientPhone,
          clientEmail,
          uploadLinks,
          deadline: new Date(deadline),
          notes,
          status: 'uploaded',
          uploadedFiles: [],
          driveFolderId: 'temp',
          publicId: publicId
        };

        // Add fields specific to client type
        if (clientType === 'new') {
          Object.assign(projectData, {
            brandName,
            videoType,
            hasScript,
            contentCount,
            logoFiles,
            referenceLinks,
            musicPreferences,
            description: description || `${videoType} for ${brandName}`
          });
        } else {
          Object.assign(projectData, {
            specialInstructions,
            description: description || specialInstructions || 'Existing client project'
          });
        }

        const project = new Project(projectData);
        await project.save();

        // Create Google Drive folder structure
        const driveStructure = await googleDriveService.createClientProjectStructure(
          project.clientName, 
          project.publicId
        );

        // Update project with drive folder IDs
        project.driveFolderId = driveStructure.mainFolder.id;
        project.driveFolderUrl = driveStructure.mainFolder.webViewLink;
        project.clientUploadFolderId = driveStructure.clientUploadFolder.id;
        project.voiceFilesFolderId = driveStructure.voiceFilesFolder.id;
        project.voiceMessagesFolderId = driveStructure.voiceMessagesFolder.id;
        project.editedVersionsFolderId = driveStructure.editedVersionsFolder.id;

        const uploadedFiles = [];

        // Upload regular files from memory
        if (req.files?.files) {
          const regularFilePromises = req.files.files.map(async (file) => {
            try {
              const driveFile = await googleDriveService.uploadFileFromBuffer(
                file.buffer,
                file.originalname,
                driveStructure.clientUploadFolder.id,
                file.mimetype
              );

              // No file cleanup needed - memory storage!

              return {
                filename: file.originalname,
                originalName: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
                driveFileId: driveFile.id,
                fileType: 'regular'
              };
            } catch (uploadError) {
              console.error('Regular file upload error:', uploadError);
              throw uploadError;
            }
          });

          const regularFiles = await Promise.all(regularFilePromises);
          uploadedFiles.push(...regularFiles);
        }

        // Upload voice files from memory
        if (req.files?.voiceFiles) {
          const voiceFilePromises = req.files.voiceFiles.map(async (file) => {
            try {
              const driveFile = await googleDriveService.uploadFileFromBuffer(
                file.buffer,
                file.originalname,
                driveStructure.voiceFilesFolder.id,
                file.mimetype
              );

              // No file cleanup needed - memory storage!

              return {
                filename: file.originalname,
                originalName: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
                driveFileId: driveFile.id,
                fileType: 'voice'
              };
            } catch (uploadError) {
              console.error('Voice file upload error:', uploadError);
              throw uploadError;
            }
          });

          const voiceFiles = await Promise.all(voiceFilePromises);
          uploadedFiles.push(...voiceFiles);
        }

        project.uploadedFiles = uploadedFiles;

        // Add initial timeline entry
        const timelineMessage = clientType === 'new' 
          ? `New client project created for ${brandName} - ${videoType}`
          : `Existing client project created`;
        
        await project.addTimelineEntry(
          timelineMessage,
          null,
          `${uploadedFiles.length} file(s) uploaded (${uploadedFiles.filter(f => f.fileType === 'regular').length} regular, ${uploadedFiles.filter(f => f.fileType === 'voice').length} voice)`
        );

        // Send notification email if email is provided
        if (clientEmail) {
          try {
            await emailService.sendProjectCreatedNotification(clientEmail, {
              clientName: project.clientName,
              publicId: project.publicId,
              projectType: clientType === 'new' ? `New ${videoType}` : 'Project Update'
            });
          } catch (emailError) {
            console.error('Email notification error:', emailError);
            // Don't fail the request for email errors
          }
        }

        res.status(201).json({
          success: true,
          message: 'Project created successfully with enhanced onboarding',
          project: {
            id: project._id,
            publicId: project.publicId,
            clientName: project.clientName,
            clientType: project.clientType,
            brandName: project.brandName,
            videoType: project.videoType,
            description: project.description,
            status: project.status,
            deadline: project.deadline,
            uploadedFiles: {
              total: uploadedFiles.length,
              regular: uploadedFiles.filter(f => f.fileType === 'regular').length,
              voice: uploadedFiles.filter(f => f.fileType === 'voice').length
            },
            driveFolder: driveStructure.mainFolder.webViewLink
          }
        });

      } catch (error) {
        // No file cleanup needed - memory storage!
        throw error;
      }

    } catch (error) {
      console.error('❌ Enhanced upload error:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Error creating project with enhanced onboarding',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];

/**
 * @desc    Get project status (public access)
 * @route   GET /api/client/status/:publicId
 * @access  Public
 */
exports.getProjectStatus = async (req, res) => {
  try {
    const { publicId } = req.params;

    const project = await Project.findOne({ publicId })
      .populate('assignedEditor', 'name')
      .select('-timeline -adminNotes');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get latest edited version if available
    const latestVersion = project.getLatestVersion();

    // Prepare response data
    const responseData = {
      id: project._id,
      publicId: project.publicId,
      clientName: project.clientName,
      description: project.description,
      status: project.status,
      progress: project.progress,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      assignedEditor: project.assignedEditor?.name || null,
      uploadedFilesCount: project.uploadedFiles.length
    };

    // Include latest version if project is completed or approved
    if (latestVersion && ['completed', 'approved', 'delivered'].includes(project.status)) {
      responseData.latestVersion = {
        version: latestVersion.version,
        filename: latestVersion.filename,
        uploadDate: latestVersion.uploadDate,
        driveFileUrl: latestVersion.driveFileUrl,
        status: latestVersion.status
      };
    }

    // Include client feedback if any
    if (project.clientFeedback.length > 0) {
      responseData.feedback = project.clientFeedback.map(feedback => ({
        message: feedback.message,
        timestamp: feedback.timestamp,
        status: feedback.status,
        version: feedback.version
      }));
    }

    res.status(200).json({
      success: true,
      project: responseData
    });

  } catch (error) {
    console.error('Get project status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project status'
    });
  }
};

/**
 * @desc    Get projects by client phone number
 * @route   GET /api/client/projects-by-phone/:phone
 * @access  Public
 */
exports.getProjectsByPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    const projects = await Project.find({ clientPhone: phone })
      .populate('assignedEditor', 'name')
      .select('-timeline -adminNotes -adminComments')
      .sort({ createdAt: -1 });

    if (!projects || projects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No projects found for this phone number'
      });
    }

    // Format projects for client view
    const formattedProjects = projects.map(project => {
      const latestVersion = project.getLatestVersion();
      
      // Map internal statuses to client-friendly statuses
      let clientStatus = project.status;
      if (project.status === 'uploaded' || project.status === 'assigned' || project.status === 'reassigned') {
        clientStatus = 'accepted';
      } else if (project.status === 'in_progress' || project.status === 'revision_in_progress') {
        clientStatus = 'in_progress';
      } else if (project.status === 'completed' || project.status === 'under_review') {
        clientStatus = 'completed';
      } else if (project.status === 'approved') {
        clientStatus = 'ready_for_download';
      } else if (project.status === 'client_reedit') {
        clientStatus = 'client_reedit';
      }

      const projectData = {
        id: project._id,
        publicId: project.publicId,
        clientName: project.clientName,
        description: project.description,
        status: clientStatus,
        progress: project.progress,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        assignedEditor: project.assignedEditor?.name || 'Not assigned yet',
        uploadedFilesCount: project.uploadedFiles.length
      };

      // Include download link and feedback option if project is ready
      if (latestVersion && project.status === 'approved') {
        projectData.downloadAvailable = true;
        projectData.latestVersion = {
          version: latestVersion.version,
          filename: latestVersion.filename,
          uploadDate: latestVersion.uploadDate
        };
      }

      // Include existing feedback
      if (project.clientFeedback.length > 0) {
        projectData.feedback = project.clientFeedback.map(feedback => ({
          message: feedback.message,
          timestamp: feedback.timestamp,
          status: feedback.status,
          rating: feedback.rating,
          satisfied: feedback.satisfied,
          reEditRequested: feedback.reEditRequested
        }));
      }

      return projectData;
    });

    res.status(200).json({
      success: true,
      projects: formattedProjects
    });

  } catch (error) {
    console.error('Get projects by phone error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching projects'
    });
  }
};

/**
 * @desc    Submit client feedback
 * @route   POST /api/client/feedback
 * @access  Public
 */
exports.submitFeedback = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { publicId, feedback, status, version, rating, satisfied, reEditRequested, reEditComments } = req.body;

    const project = await Project.findOne({ publicId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if project is in correct status for feedback
    if (!['approved', 'completed'].includes(project.status)) {
      return res.status(400).json({
        success: false,
        message: 'Project is not ready for feedback'
      });
    }

    // Add feedback to project
    const feedbackData = {
      message: feedback,
      status: status, // 'approved' or 'revision_requested'
      version: version || project.getLatestVersion()?.version || 1,
      rating: rating,
      satisfied: satisfied,
      reEditRequested: reEditRequested || false,
      reEditComments: reEditComments
    };

    project.clientFeedback.push(feedbackData);

    // Update project status based on feedback
    if (status === 'approved' && satisfied) {
      project.status = 'delivered';
      await project.addTimelineEntry(
        'Client approved the project',
        null,
        feedback
      );
    } else if (status === 'revision_requested' || !satisfied) {
      if (reEditRequested) {
        project.status = 'client_reedit';
        await project.addTimelineEntry(
          'Client requested re-edit',
          null,
          reEditComments || feedback
        );
      } else {
        project.status = 'revision_requested';
        await project.addTimelineEntry(
          'Client requested revisions',
          null,
          feedback
        );
      }

      // Send notification to admin
      try {
        await emailService.sendRevisionRequestNotification(project, feedback);
      } catch (emailError) {
        console.error('Failed to send revision notification:', emailError);
      }
    }

    await project.save();

    res.status(200).json({
      success: true,
      message: status === 'approved' 
        ? 'Thank you for your approval! Project completed.' 
        : 'Feedback submitted successfully. We will review and get back to you.',
      project: {
        publicId: project.publicId,
        status: project.status,
        feedback: project.clientFeedback[project.clientFeedback.length - 1]
      }
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback'
    });
  }
};

/**
 * @desc    Get download link for approved project
 * @route   GET /api/client/download/:publicId
 * @access  Public
 */
exports.getDownloadLink = async (req, res) => {
  try {
    const { publicId } = req.params;

    const project = await Project.findOne({ publicId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Only allow download if project is approved by admin
    if (project.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Project is not ready for download'
      });
    }

    const latestVersion = project.getLatestVersion();
    
    if (!latestVersion || !latestVersion.driveFileUrl) {
      return res.status(404).json({
        success: false,
        message: 'No edited version available for download'
      });
    }

    // Generate a secure download URL (using Google Drive direct download)
    const fileId = latestVersion.driveFileId;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    res.status(200).json({
      success: true,
      download: {
        url: downloadUrl,
        filename: latestVersion.filename,
        version: latestVersion.version,
        uploadDate: latestVersion.uploadDate
      }
    });

  } catch (error) {
    console.error('Get download link error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating download link'
    });
  }
};

/**
 * @desc    Download latest edited version
 * @route   GET /api/client/download/:publicId
 * @access  Public
 */
exports.downloadLatestVersion = async (req, res) => {
  try {
    const { publicId } = req.params;

    const project = await Project.findOne({ publicId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Check if project has completed versions
    if (!['approved', 'completed', 'delivered'].includes(project.status)) {
      return res.status(400).json({
        success: false,
        message: 'No completed version available for download'
      });
    }

    const latestVersion = project.getLatestVersion();

    if (!latestVersion) {
      return res.status(404).json({
        success: false,
        message: 'No edited version found'
      });
    }

    try {
      // Get download URL from Google Drive
      const downloadInfo = await googleDriveService.getFileDownloadUrl(latestVersion.driveFileId);

      res.status(200).json({
        success: true,
        download: {
          filename: latestVersion.filename,
          version: latestVersion.version,
          downloadUrl: downloadInfo.downloadUrl,
          viewUrl: downloadInfo.viewUrl
        }
      });

    } catch (driveError) {
      console.error('Error getting download URL:', driveError);
      res.status(500).json({
        success: false,
        message: 'Error generating download link'
      });
    }

  } catch (error) {
    console.error('Download latest version error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing download request'
    });
  }
};

/**
 * @desc    Get project timeline (public access)
 * @route   GET /api/client/timeline/:publicId
 * @access  Public
 */
exports.getProjectTimeline = async (req, res) => {
  try {
    const { publicId } = req.params;

    const project = await Project.findOne({ publicId })
      .populate('timeline.user', 'name role')
      .select('publicId clientName timeline status createdAt');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Filter timeline to only show client-relevant events
    const clientTimeline = project.timeline.filter(entry => {
      const clientRelevantActions = [
        'Project created and media uploaded',
        'Project assigned to editor',
        'Status updated',
        'Uploaded edited version',
        'Project approved and sent to client',
        'Client approved the project',
        'Client requested revisions'
      ];
      
      return clientRelevantActions.some(action => 
        entry.action.includes(action) || 
        entry.action.includes('Status changed')
      );
    }).map(entry => ({
      action: entry.action,
      timestamp: entry.timestamp,
      notes: entry.notes,
      user: entry.user ? {
        name: entry.user.name,
        role: entry.user.role
      } : null
    }));

    res.status(200).json({
      success: true,
      timeline: clientTimeline,
      project: {
        publicId: project.publicId,
        clientName: project.clientName,
        status: project.status,
        createdAt: project.createdAt
      }
    });

  } catch (error) {
    console.error('Get project timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project timeline'
    });
  }
};

/**
 * @desc    Upload voice message for comments
 * @route   POST /api/client/projects/:id/voice-message
 * @access  Public (Client via phone lookup)
 */
exports.uploadVoiceMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { commentType, messageText } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Voice file is required'
      });
    }

    // Find project by publicId
    const project = await Project.findOne({ publicId: id });
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Upload voice message to Google Drive from memory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `voice-message-${timestamp}.webm`;
    
    const driveFile = await googleDriveService.uploadVoiceMessageFromBuffer(
      req.file.buffer,
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

    // Add to appropriate comment section
    if (commentType === 'feedback') {
      project.clientFeedback.push({
        message: messageText || '',
        voiceMessage: voiceMessage,
        timestamp: new Date(),
        status: 'revision_requested',
        version: project.versions?.length || 1
      });
    }

    // Add to timeline
    project.timeline.push({
      action: 'Voice message added',
      timestamp: new Date(),
      notes: `Client added voice message${messageText ? ': ' + messageText : ''}`
    });

    await project.save();

    // No file cleanup needed - memory storage!

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
    console.error('Upload voice message error:', error);
    
    // No file cleanup needed - memory storage!

    res.status(500).json({
      success: false,
      message: 'Error uploading voice message'
    });
  }
};
