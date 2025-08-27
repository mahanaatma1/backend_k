const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Check admin credentials from environment variables
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('Admin credentials not configured in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Admin configuration error'
      });
    }

    // Verify admin credentials
    if (email !== adminEmail) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // For admin, we'll use a simple password comparison
    // In production, you might want to hash the admin password
    if (password !== adminPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Create admin user object for JWT
    const adminUser = {
      _id: 'admin',
      email: adminEmail,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User'
    };

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: adminUser._id,
        email: adminUser.email,
        role: adminUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        token,
        user: adminUser
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || 'all'; // all, active, inactive
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build filter object
    const filter = {};
    
    // Search filter
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status !== 'all') {
      filter.isActive = status === 'active';
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    // Format user data
    const formattedUsers = users.map(user => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      isActive: user.isActive,
      role: user.role,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      address: user.address,
      bio: user.bio,
      socialLinks: user.socialLinks
    }));

    res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get user by ID (Admin only)
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Update user (Admin only)
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      isActive,
      role,
      address,
      bio,
      socialLinks
    } = req.body;

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existingUser.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: id } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered by another user'
        });
      }
    }

    // Check if phone number is being changed and if it's already taken
    if (phoneNumber && phoneNumber !== existingUser.phoneNumber) {
      const phoneExists = await User.findOne({ phoneNumber, _id: { $ne: id } });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered by another user'
        });
      }
    }

    // Prepare update object
    const updateData = {};
    
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (gender !== undefined) updateData.gender = gender;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (role !== undefined) updateData.role = role;
    if (bio !== undefined) updateData.bio = bio;

    // Handle address object
    if (address) {
      if (address.street !== undefined) updateData['address.street'] = address.street;
      if (address.city !== undefined) updateData['address.city'] = address.city;
      if (address.state !== undefined) updateData['address.state'] = address.state;
      if (address.country !== undefined) updateData['address.country'] = address.country;
      if (address.zipCode !== undefined) updateData['address.zipCode'] = address.zipCode;
    }

    // Handle social links object
    if (socialLinks) {
      if (socialLinks.facebook !== undefined) updateData['socialLinks.facebook'] = socialLinks.facebook;
      if (socialLinks.twitter !== undefined) updateData['socialLinks.twitter'] = socialLinks.twitter;
      if (socialLinks.linkedin !== undefined) updateData['socialLinks.linkedin'] = socialLinks.linkedin;
      if (socialLinks.instagram !== undefined) updateData['socialLinks.instagram'] = socialLinks.instagram;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field value. Please check your input.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Delete user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Activate/Deactivate user (Admin only)
// @route   PUT /api/admin/users/:id/toggle-status
// @access  Private/Admin
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (id === req.user._id.toString() && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    // Update user status
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    ).select('-password');

    const statusText = isActive ? 'activated' : 'deactivated';

    res.status(200).json({
      success: true,
      message: `User ${statusText} successfully`,
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get dashboard statistics (Admin only)
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments();
    
    // Get active users count
    const activeUsers = await User.countDocuments({ isActive: true });
    
    // Get inactive users count
    const inactiveUsers = await User.countDocuments({ isActive: false });
    
    // Get users registered in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get users registered in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsersThisWeek = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Get users registered today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: today }
    });

    // Get gender distribution
    const genderStats = await User.aggregate([
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get users by role
    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent users (last 10)
    const recentUsers = await User.find()
      .select('firstName lastName email isActive createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          newUsersThisMonth,
          newUsersThisWeek,
          newUsersToday
        },
        genderDistribution: genderStats,
        roleDistribution: roleStats,
        recentUsers
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Bulk operations (Admin only)
// @route   POST /api/admin/users/bulk
// @access  Private/Admin
const bulkOperations = async (req, res) => {
  try {
    const { operation, userIds } = req.body;

    if (!operation || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Operation and user IDs are required'
      });
    }

    // Prevent admin from performing operations on themselves
    if (userIds.includes(req.user._id.toString())) {
      return res.status(400).json({
        success: false,
        message: 'Cannot perform bulk operations on your own account'
      });
    }

    let result;
    let message;

    switch (operation) {
      case 'activate':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { isActive: true }
        );
        message = `${result.modifiedCount} users activated successfully`;
        break;

      case 'deactivate':
        result = await User.updateMany(
          { _id: { $in: userIds } },
          { isActive: false }
        );
        message = `${result.modifiedCount} users deactivated successfully`;
        break;

      case 'delete':
        result = await User.deleteMany({ _id: { $in: userIds } });
        message = `${result.deletedCount} users deleted successfully`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid operation. Supported operations: activate, deactivate, delete'
        });
    }

    res.status(200).json({
      success: true,
      message,
      data: {
        affectedCount: operation === 'delete' ? result.deletedCount : result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Bulk operations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Export users data (Admin only)
// @route   GET /api/admin/users/export
// @access  Private/Admin
const exportUsers = async (req, res) => {
  try {
    const format = req.query.format || 'json'; // json, csv
    const status = req.query.status || 'all';

    // Build filter
    const filter = {};
    if (status !== 'all') {
      filter.isActive = status === 'active';
    }

    // Get users
    const users = await User.find(filter).select('-password');

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'ID,First Name,Last Name,Email,Phone,Gender,Status,Role,Created At\n';
      const csvData = users.map(user => 
        `${user._id},"${user.firstName}","${user.lastName}","${user.email}","${user.phoneNumber || ''}","${user.gender || ''}","${user.isActive ? 'Active' : 'Inactive'}","${user.role || 'user'}","${user.createdAt}"`
      ).join('\n');

      const csvContent = csvHeader + csvData;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
      res.send(csvContent);
    } else {
      // Return JSON format
      res.status(200).json({
        success: true,
        data: {
          users,
          exportInfo: {
            format: 'json',
            totalUsers: users.length,
            exportedAt: new Date().toISOString()
          }
        }
      });
    }

  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  adminLogin,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getDashboardStats,
  bulkOperations,
  exportUsers
};
