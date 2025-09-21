
const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['organizer', 'participant']).withMessage('Role must be organizer or participant'),
  body('organizationCode').optional().trim().custom(value => {
    if (value && value.length > 0) {
      if (value.length < 6 || value.length > 10) {
        throw new Error('Organization code must be 6-10 characters');
      }
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, password, role, organizationCode } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    let organization = null;
    
    // Handle organization code if provided (for both participants and organizers)
    if (organizationCode) {
      organization = await Organization.findOne({ 
        organizationCode: organizationCode.toUpperCase(),
        isActive: true
      });
      
      if (!organization) {
        return res.status(400).json({
          success: false,
          message: 'Invalid organization code'
        });
      }
    }

    // Create user - only set organization fields if joining an organization
    const userData = {
      name,
      email,
      password,
      role
    };

    // Only add organization fields if user is joining an organization
    if (organization) {
      userData.organization = organization._id;
      // Assign role based on user type: organizers become admins, participants become members
      userData.organizationRole = role === 'organizer' ? 'admin' : 'member';
      userData.joinedOrganizationAt = new Date();
    }

    const user = await User.create(userData);

    // Add user to organization if joining one
    if (organization) {
      const orgRole = role === 'organizer' ? 'admin' : 'member';
      await organization.addMember(user._id, orgRole);
      
      // If user is an organizer, also add them to the admins array
      if (role === 'organizer') {
        organization.admins.push(user._id);
        await organization.save();
      }
    }

    // Generate token
    const token = generateToken(user._id);

    const successMessage = organization 
      ? `User registered successfully and joined ${organization.name} as ${role === 'organizer' ? 'an admin' : 'a member'}`
      : 'User registered successfully';

    res.status(201).json({
      success: true,
      message: successMessage,
      data: {
        user,
        token,
        organization: organization ? {
          _id: organization._id,
          name: organization.name,
          organizationCode: organization.organizationCode,
          role: role === 'organizer' ? 'admin' : 'member'
        } : null
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// @route   GET /api/auth/test
// @desc    Test endpoint for mobile connectivity
// @access  Public
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth API is working correctly',
    timestamp: new Date().toISOString()
  });
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user and include password, populate organization
    const user = await User.findOne({ email, isActive: true })
      .select('+password')
      .populate('organization', 'name organizationCode');
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create session
    req.session.userId = user._id;
    req.session.userRole = user.role;

    // Generate token for backward compatibility
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          bio: user.bio,
          phone: user.phone,
          profilePicture: user.profilePicture,
          organization: user.organization,
          lastLogin: user.lastLogin
        },
        token,
        sessionId: req.sessionID
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio cannot be more than 500 characters'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone number cannot be more than 20 characters'),
  body('profilePicture').optional().isString().withMessage('Profile picture must be a valid string'),
  body('organization').optional().isString().withMessage('Organization must be a valid string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, bio, phone, profilePicture, organization } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (email) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
      }
      updateData.email = email;
    }
    if (bio !== undefined) updateData.bio = bio;
    if (phone !== undefined) updateData.phone = phone;
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
    if (organization !== undefined) updateData.organization = organization;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).populate('organization', 'name organizationCode');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Profile update failed',
      error: error.message
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user and destroy session
// @access  Private
router.post('/logout', auth, async (req, res) => {
  try {
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({
          success: false,
          message: 'Failed to logout properly'
        });
      }

      // Clear the session cookie
      res.clearCookie('connect.sid');
      
      res.json({
        success: true,
        message: 'Logout successful'
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
});

// @route   POST /api/auth/activate-account
// @desc    Activate temporary account after signup
// @access  Private
router.post('/activate-account', auth, async (req, res) => {
  try {
    const { invitationCode } = req.body;
    const userId = req.user.id;

    // Update user to mark as no longer temporary
    await User.findByIdAndUpdate(userId, {
      isTemporaryAccount: false,
      lastLogin: new Date()
    });

    res.json({
      success: true,
      message: 'Account activated successfully'
    });
  } catch (error) {
    console.error('Activate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate account',
      error: error.message
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Find user with password field
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
});

module.exports = router;
