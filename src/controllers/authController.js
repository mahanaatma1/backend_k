const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { uploadToCloudinary } = require('../config/cloudinary');
const fs = require('fs');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      dateOfBirth,
      phoneNumber,
      gender,
      address,
      bio
    } = req.body;

    // Handle profile picture upload
    let profilePictureUrl = null;
    if (req.file) {
      try {
        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(req.file.path, {
          folder: 'profile-pictures',
          transformation: [
            { width: 400, height: 400, crop: 'fill' },
            { quality: 'auto' }
          ]
        });

        if (uploadResult.success) {
          profilePictureUrl = uploadResult.url;
        } else {
          console.error('Cloudinary upload failed:', uploadResult.error);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload profile picture'
          });
        }

        // Delete local file after successful upload
        fs.unlinkSync(req.file.path);
      } catch (uploadError) {
        console.error('Profile picture upload error:', uploadError);
        
        // Clean up local file if it exists
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
          success: false,
          message: 'Failed to upload profile picture'
        });
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Validate and process phone number
    let processedPhoneNumber = phoneNumber;
    if (phoneNumber) {
      // Remove any spaces or special characters except + and digits
      processedPhoneNumber = phoneNumber.replace(/[^\d+]/g, '');
      
      // Ensure it starts with +
      if (!processedPhoneNumber.startsWith('+')) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must start with country code (e.g., +91 for India)'
        });
      }

      // Validate phone number format
      if (!/^\+[1-9]\d{1,14}$/.test(processedPhoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format. Please include country code (e.g., +911234567890)'
        });
      }

      // Check if phone number already exists
      const existingPhoneUser = await User.findOne({ phoneNumber: processedPhoneNumber });
      if (existingPhoneUser) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered'
        });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      dateOfBirth,
      phoneNumber: processedPhoneNumber,
      gender,
      address,
      bio,
      profilePicture: profilePictureUrl
    });

    // Save user to database
    const savedUser = await user.save();

    // Generate JWT token
    const token = generateToken(savedUser._id);

    // Return user data (without password) and token
    const userResponse = savedUser.getPublicProfile();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    
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
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Return user data (without password) and token
    const userResponse = user.getPublicProfile();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    // req.user is already the user object from middleware
    const user = req.user;
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userResponse = user.getPublicProfile();

    // Add phone number details to response
    const phoneDetails = {
      fullNumber: user.phoneNumber,
      countryCode: user.getCountryCode(),
      numberWithoutCountryCode: user.getPhoneNumberWithoutCountryCode(),
      isValid: user.isValidPhoneNumber(),
      formattedNumber: user.getFormattedPhoneNumber()
    };

    res.status(200).json({
      success: true,
      data: {
        user: userResponse,
        phoneDetails
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // In a real application, you might want to blacklist the token
    // For now, we'll just return a success message
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Update user phone number
// @route   PUT /api/auth/phone
// @access  Private
const updatePhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Validate and process phone number
    let processedPhoneNumber = phoneNumber.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!processedPhoneNumber.startsWith('+')) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must start with country code (e.g., +91 for India)'
      });
    }

    // Validate phone number format
    if (!/^\+[1-9]\d{1,14}$/.test(processedPhoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Please include country code (e.g., +911234567890)'
      });
    }

    // Check if phone number already exists for another user
    const existingPhoneUser = await User.findOne({ 
      phoneNumber: processedPhoneNumber,
      _id: { $ne: req.user.userId }
    });
    
    if (existingPhoneUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered by another user'
      });
    }

    // Update user's phone number
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { phoneNumber: processedPhoneNumber },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get phone details
    const phoneDetails = {
      fullNumber: user.phoneNumber,
      countryCode: user.getCountryCode(),
      numberWithoutCountryCode: user.getPhoneNumberWithoutCountryCode(),
      isValid: user.isValidPhoneNumber(),
      formattedNumber: user.getFormattedPhoneNumber()
    };

    res.status(200).json({
      success: true,
      message: 'Phone number updated successfully',
      data: {
        phoneDetails
      }
    });

  } catch (error) {
    console.error('Update phone number error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Update user profile picture
// @route   PUT /api/auth/profile-picture
// @access  Private
const updateProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture is required'
      });
    }

    let profilePictureUrl = null;
    try {
      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(req.file.path, {
        folder: 'profile-pictures',
        transformation: [
          { width: 400, height: 400, crop: 'fill' },
          { quality: 'auto' }
        ]
      });

      if (uploadResult.success) {
        profilePictureUrl = uploadResult.url;
      } else {
        console.error('Cloudinary upload failed:', uploadResult.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload profile picture'
        });
      }

      // Delete local file after successful upload
      fs.unlinkSync(req.file.path);
    } catch (uploadError) {
      console.error('Profile picture upload error:', uploadError);
      
      // Clean up local file if it exists
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to upload profile picture'
      });
    }

    // Update user's profile picture
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { profilePicture: profilePictureUrl },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userResponse = user.getPublicProfile();

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Update profile picture error:', error);
    
    // Clean up local file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  signup,
  login,
  getMe,
  logout,
  updatePhoneNumber,
  updateProfilePicture
};
