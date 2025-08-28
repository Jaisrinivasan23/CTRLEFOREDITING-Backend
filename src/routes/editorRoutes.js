const express = require('express');
const { body } = require('express-validator');
const {
  getDashboard,
  getAssignedProjects,
  getProject,
  updateProjectStatus,
  uploadEditedVersion,
  getProjectFiles,
  getDriveAccess,
  addAdobeLink,
  updateAdobeLink
} = require('../controllers/editorController');
const { protect, editorOnly } = require('../middleware/auth');

const router = express.Router();

// Apply editor protection to all routes
router.use(protect);
router.use(editorOnly);

// Validation rules
const updateStatusValidation = [
  body('status')
    .isIn(['assigned', 'in_progress', 'completed', 'revision_in_progress'])
    .withMessage('Invalid status'),
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

const adobeLinkValidation = [
  body('url')
    .isURL()
    .withMessage('Please provide a valid URL'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

// Routes
router.get('/dashboard', getDashboard);
router.get('/projects', getAssignedProjects);
router.get('/projects/:id', getProject);
router.put('/projects/:id/status', updateStatusValidation, updateProjectStatus);
router.post('/projects/:id/upload-version', uploadEditedVersion);
router.get('/projects/:id/files', getProjectFiles);
router.get('/projects/:id/drive-access', getDriveAccess);
router.post('/projects/:id/adobe-link', adobeLinkValidation, addAdobeLink);
router.put('/projects/:id/adobe-link', adobeLinkValidation, updateAdobeLink);

module.exports = router;
