const express = require('express');
const { body, validationResult } = require('express-validator');
const Organization = require('../models/Organization');
const User = require('../models/User');
const UserOrganization = require('../models/UserOrganization');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/organization-membership/my-organizations
// @desc    Get all organizations user belongs to
// @access  Private
router.get('/my-organizations', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find all organizations where user is a member
    const memberships = await UserOrganization.find({ 
      user: userId,
      isActive: true
    })
    .populate({
      path: 'organization',
      populate: [
        {
          path: 'owner',
          select: 'name email'
        },
        {
          path: 'members.user',
          select: 'name email role'
        },
        {
          path: 'admins',
          select: 'name email'
        }
      ]
    })
    .sort({ lastAccessedAt: -1 });

    const organizations = memberships.map(membership => ({
      ...membership.organization.toObject(),
      userRole: membership.role,
      joinedAt: membership.joinedAt,
      lastAccessedAt: membership.lastAccessedAt
    }));

    res.json({
      success: true,
      data: organizations
    });
  } catch (error) {
    console.error('Get my organizations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get organizations',
      error: error.message
    });
  }
});

// @route   POST /api/organization-membership/set-active
// @desc    Set active organization for user session
// @access  Private
router.post('/set-active', auth, [
  body('organizationId').notEmpty().withMessage('Organization ID is required')
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

    const userId = req.user._id;
    const { organizationId } = req.body;

    // Verify user is a member of this organization
    const membership = await UserOrganization.findOne({
      user: userId,
      organization: organizationId,
      isActive: true
    }).populate('organization');

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'You are not a member of this organization'
      });
    }

    // Update last accessed time
    membership.lastAccessedAt = new Date();
    await membership.save();

    res.json({
      success: true,
      message: 'Active organization updated',
      data: {
        organization: membership.organization,
        userRole: membership.role
      }
    });
  } catch (error) {
    console.error('Set active organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set active organization',
      error: error.message
    });
  }
});

// @route   POST /api/organization-membership/join-multiple
// @desc    Join organization using code (supports multiple memberships)
// @access  Private
router.post('/join-multiple', auth, [
  body('organizationCode').trim().notEmpty().withMessage('Organization code is required')
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

    const { organizationCode } = req.body;
    const userId = req.user._id;

    // Find organization
    const organization = await Organization.findOne({ 
      organizationCode: organizationCode.toUpperCase(),
      isActive: true
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Invalid organization code'
      });
    }

    // Check if user is already a member
    const existingMembership = await UserOrganization.findOne({
      user: userId,
      organization: organization._id
    });

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this organization'
      });
    }

    // Create new membership
    const membership = new UserOrganization({
      user: userId,
      organization: organization._id,
      role: 'member'
    });

    await membership.save();

    // Also add to organization members array (maintain compatibility)
    if (!organization.members.some(member => member.user.toString() === userId.toString())) {
      organization.members.push({
        user: userId,
        role: 'member',
        joinedAt: new Date()
      });
      await organization.save();
    }

    res.json({
      success: true,
      message: `Successfully joined ${organization.name}`,
      data: {
        organization: {
          _id: organization._id,
          name: organization.name,
          organizationCode: organization.organizationCode
        },
        userRole: 'member'
      }
    });
  } catch (error) {
    console.error('Join organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join organization',
      error: error.message
    });
  }
});

module.exports = router;