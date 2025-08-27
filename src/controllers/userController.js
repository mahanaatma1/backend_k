const User = require('../models/User');
const { uploadToCloudinary } = require('../config/cloudinary');
const fs = require('fs');

// @desc    Edit user profile
// @route   PUT /api/user/profile
// @access  Private
const editProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      dateOfBirth,
      phoneNumber,
      gender,
      address,
      bio,
      socialLinks
    } = req.body;

    // Handle profile picture upload if provided
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

    // Validate and process phone number if provided
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

      // Check if phone number already exists for another user
      const existingPhoneUser = await User.findOne({ 
        phoneNumber: processedPhoneNumber,
        _id: { $ne: req.user._id }
      });
      
      if (existingPhoneUser) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered by another user'
        });
      }
    }

    // Prepare update object
    const updateData = {};
    
    // Add fields to update if they are provided
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (processedPhoneNumber !== undefined) updateData.phoneNumber = processedPhoneNumber;
    if (gender !== undefined) updateData.gender = gender;
    if (bio !== undefined) updateData.bio = bio;
    if (profilePictureUrl !== null) updateData.profilePicture = profilePictureUrl;

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

    // Update user profile
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userResponse = user.getPublicProfile();

    // Add phone details to response
    const phoneDetails = {
      fullNumber: user.phoneNumber,
      countryCode: user.getCountryCode(),
      numberWithoutCountryCode: user.getPhoneNumberWithoutCountryCode(),
      isValid: user.isValidPhoneNumber(),
      formattedNumber: user.getFormattedPhoneNumber()
    };

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: userResponse,
        phoneDetails
      }
    });

  } catch (error) {
    console.error('Edit profile error:', error);
    
    // Clean up local file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
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

// @desc    Get user profile by ID
// @route   GET /api/user/profile/:id
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User profile not available'
      });
    }

    const userResponse = user.getPublicProfile();

    res.status(200).json({
      success: true,
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/user/profile
// @access  Private
const deleteProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Deactivate user account
// @route   PUT /api/user/deactivate
// @access  Private
const deactivateProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  editProfile,
  getUserProfile,
  deleteProfile,
  deactivateProfile
};
