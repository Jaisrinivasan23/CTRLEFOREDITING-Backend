const express = require('express');
const { body } = require('express-validator');
const {
  login,
  getMe,
  updatePassword,
  updateProfile,
  logout,
  verifyToken
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const updatePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const updateProfileValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('phone')
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number')
];

// Routes
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, updatePasswordValidation, updatePassword);
router.put('/updateprofile', protect, updateProfileValidation, updateProfile);
router.post('/logout', protect, logout);
router.get('/verify', protect, verifyToken);

module.exports = router;
