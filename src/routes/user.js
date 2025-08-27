const express = require('express');
const router = express.Router();
const {
  editProfile,
  getUserProfile,
  deleteProfile,
  deactivateProfile
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { uploadMiddleware } = require('../middleware/upload');

// @route   PUT /api/user/profile
// @desc    Edit user profile
// @access  Private
router.put('/profile', protect, uploadMiddleware, editProfile);

// @route   GET /api/user/profile/:id
// @desc    Get user profile by ID
// @access  Private
router.get('/profile/:id', protect, getUserProfile);

// @route   DELETE /api/user/profile
// @desc    Delete user account
// @access  Private
router.delete('/profile', protect, deleteProfile);

// @route   PUT /api/user/deactivate
// @desc    Deactivate user account
// @access  Private
router.put('/deactivate', protect, deactivateProfile);

module.exports = router;
