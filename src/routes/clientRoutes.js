const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  uploadMedia,
  uploadEnhanced,
  getProjectStatus,
  getProjectsByPhone,
  submitFeedback,
  getDownloadLink,
  downloadLatestVersion,
  getProjectTimeline,
  uploadVoiceMessage
} = require('../controllers/clientController');

const router = express.Router();

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
    cb(null, 'voice-' + uniqueSuffix + path.extname(file.originalname));
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
const uploadValidation = [
  body('clientName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Client name must be between 2 and 100 characters'),
  body('clientPhone')
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number'),
  body('clientEmail')
    .optional({ checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email if provided'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters')
];

const feedbackValidation = [
  body('publicId')
    .notEmpty()
    .withMessage('Project ID is required'),
  body('feedback')
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Feedback must be between 5 and 1000 characters'),
  body('status')
    .isIn(['approved', 'revision_requested'])
    .withMessage('Status must be either approved or revision_requested'),
  body('version')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Version must be a positive integer'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('satisfied')
    .optional()
    .isBoolean()
    .withMessage('Satisfied must be true or false'),
  body('reEditRequested')
    .optional()
    .isBoolean()
    .withMessage('Re-edit requested must be true or false'),
  body('reEditComments')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Re-edit comments cannot exceed 1000 characters')
];

// Routes
router.post('/upload', uploadMedia);
router.post('/upload-enhanced', uploadEnhanced);
router.get('/status/:publicId', getProjectStatus);
router.get('/projects-by-phone/:phone', getProjectsByPhone);
router.post('/feedback', feedbackValidation, submitFeedback);
router.get('/download-link/:publicId', getDownloadLink);
router.get('/download/:publicId', downloadLatestVersion);
router.get('/timeline/:publicId', getProjectTimeline);
router.post('/projects/:id/voice-message', voiceUpload.single('voiceFile'), uploadVoiceMessage);

module.exports = router;
