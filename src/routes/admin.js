const express = require('express');
const router = express.Router();
const {
  adminLogin,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getDashboardStats,
  bulkOperations,
  exportUsers
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Admin login (public route)
router.post('/login', adminLogin);

// All other routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// User management routes
router.get('/users', getAllUsers);
router.get('/users/export', exportUsers);
router.post('/users/bulk', bulkOperations);

router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/toggle-status', toggleUserStatus);

module.exports = router;
