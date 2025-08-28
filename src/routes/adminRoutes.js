const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getDashboardStats,
  getAllProjects,
  getProject,
  addEditor,
  getAllEditors,
  assignProjectToEditor,
  reviewProject,
  updateEditorStatus,
  deleteEditor,
  uploadVoiceMessage
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Apply admin protection to all routes
router.use(protect);
router.use(adminOnly);

// Configure multer for voice message uploads
const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/voice-messages';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'admin-voice-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const voiceUpload = multer({
  storage: voiceStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for voice messages
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /webm|mp3|wav|m4a|ogg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('audio/');

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Validation rules
const addEditorValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number')
];

const assignProjectValidation = [
  body('projectId')
    .isMongoId()
    .withMessage('Invalid project ID'),
  body('editorId')
    .isMongoId()
    .withMessage('Invalid editor ID'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid due date format'),
  body('deadlineHours')
    .optional()
    .isInt({ min: 1, max: 720 })
    .withMessage('Deadline hours must be between 1 and 720 (30 days)')
];

const reviewProjectValidation = [
  body('projectId')
    .isMongoId()
    .withMessage('Invalid project ID'),
  body('action')
    .isIn(['approve', 'request_revision', 'reassign'])
    .withMessage('Action must be either approve, request_revision, or reassign'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

// Routes
router.get('/dashboard', getDashboardStats);
router.get('/projects', getAllProjects);
router.get('/projects/:id', getProject);
router.post('/add-editor', addEditorValidation, addEditor);
router.get('/editors', getAllEditors);
router.post('/assign-editor', assignProjectValidation, assignProjectToEditor);
router.post('/review-project', reviewProjectValidation, reviewProject);
router.put('/editors/:id/status', updateEditorStatus);
router.delete('/editors/:id', deleteEditor);
router.post('/projects/:id/voice-message', voiceUpload.single('voiceFile'), uploadVoiceMessage);

module.exports = router;
