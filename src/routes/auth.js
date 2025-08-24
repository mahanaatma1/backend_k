const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  getMe,
  logout,
  updatePhoneNumber,
  updateProfilePicture
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { uploadMiddleware } = require('../middleware/upload');

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', uploadMiddleware, signup);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', login);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, getMe);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, logout);

// @route   PUT /api/auth/phone
// @desc    Update user phone number
// @access  Private
router.put('/phone', protect, updatePhoneNumber);

// @route   PUT /api/auth/profile-picture
// @desc    Update user profile picture
// @access  Private
router.put('/profile-picture', protect, uploadMiddleware, updateProfilePicture);

module.exports = router;
