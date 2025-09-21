const express = require('express');
const { body, validationResult } = require('express-validator');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { auth, requireOrganizer } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/organizations
// @desc    Create a new organization
// @access  Private (Organizer only)
router.post('/', auth, requireOrganizer, [
  body('name').trim().notEmpty().withMessage('Organization name is required'),
  body('description').optional().trim(),
  body('organizationCode').trim().notEmpty().withMessage('Organization code is required').isLength({ min: 6, max: 10 }).withMessage('Organization code must be 6-10 characters')
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

    const { name, description, organizationCode } = req.body;
    const ownerId = req.user._id;


    // Check if organization code is already taken
    const codeExists = await Organization.findOne({ 
      organizationCode: organizationCode.toUpperCase() 
    });
    if (codeExists) {
      return res.status(400).json({
        success: false,
        message: 'Organization code is already taken'
      });
    }

    // Create organization
    const organization = new Organization({
      name,
      description,
      owner: ownerId,
      admins: [ownerId],
      organizationCode: organizationCode.toUpperCase()
    });

    // Add owner as first member
    organization.members.push({
      user: ownerId,
      role: 'admin',
      joinedAt: new Date()
    });

    await organization.save();

    // Update user with organization info
    await User.findByIdAndUpdate(ownerId, {
      organization: organization._id,
      organizationRole: 'owner',
      joinedOrganizationAt: new Date()
    });

    // Populate the response
    await organization.populate('owner', 'name email');

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: organization
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create organization',
      error: error.message
    });
  }
});

// @route   GET /api/organizations/my
// @desc    Get user's organization (first one found)
// @access  Private
router.get('/my', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find organization where user is owner, admin, or member
    const organization = await Organization.findOne({
      $or: [
        { owner: userId },
        { admins: userId },
        { 'members.user': userId }
      ]
    })
    .populate('owner', 'name email')
    .populate('members.user', 'name email role')
    .populate('admins', 'name email');

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'You are not part of any organization'
      });
    }

    res.json({
      success: true,
      data: organization
    });
  } catch (error) {
    console.error('Get my organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get organization',
      error: error.message
    });
  }
});

// @route   GET /api/organizations
// @desc    Get all organizations (for display purposes)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    // Find all active organizations with basic info
    const organizations = await Organization.find({ isActive: true })
      .populate('owner', 'name email')
      .select('name description organizationCode owner memberCount createdAt')
      .sort({ createdAt: -1 })
      .limit(50); // Limit to prevent too much data

    res.json({
      success: true,
      data: organizations
    });
  } catch (error) {
    console.error('Get all organizations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get organizations',
      error: error.message
    });
  }
});

// @route   GET /api/organizations/owned
// @desc    Get all organizations owned by the user
// @access  Private (Organizer only)
router.get('/owned', auth, requireOrganizer, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find all organizations where user is owner
    const organizations = await Organization.find({ owner: userId })
      .populate('owner', 'name email')
      .populate('members.user', 'name email role')
      .populate('admins', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: organizations
    });
  } catch (error) {
    console.error('Get owned organizations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get organizations',
      error: error.message
    });
  }
});

// @route   GET /api/organizations/code/:code
// @desc    Get organization by code (for joining)
// @access  Public
router.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const organization = await Organization.findOne({ 
      organizationCode: code.toUpperCase(),
      isActive: true
    })
    .populate('owner', 'name email')
    .select('-members -admins'); // Don't expose member list

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    res.json({
      success: true,
      data: {
        _id: organization._id,
        name: organization.name,
        description: organization.description,
        organizationCode: organization.organizationCode,
        owner: organization.owner,
        memberCount: organization.memberCount,
        settings: organization.settings
      }
    });
  } catch (error) {
    console.error('Get organization by code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get organization',
      error: error.message
    });
  }
});

// @route   POST /api/organizations/join
// @desc    Join organization using code
// @access  Private
router.post('/join', auth, [
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

    // Get user for checking membership
    const user = await User.findById(userId);

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
    if (organization.isMember(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this organization'
      });
    }

    // Add user to organization
    await organization.addMember(userId, 'member');

    // Update user with organization info
    await User.findByIdAndUpdate(userId, {
      organization: organization._id,
      organizationRole: 'member',
      joinedOrganizationAt: new Date()
    });

    res.json({
      success: true,
      message: `Successfully joined ${organization.name}`,
      data: {
        organization: {
          _id: organization._id,
          name: organization.name,
          organizationCode: organization.organizationCode
        }
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

// @route   PUT /api/organizations/my
// @desc    Update organization
// @access  Private (Owner/Admin only)
router.put('/my', auth, [
  body('name').optional().trim().notEmpty().withMessage('Organization name cannot be empty'),
  body('description').optional().trim()
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
    const { name, description } = req.body;

    // Find organization where user is owner or admin
    const organization = await Organization.findOne({
      $or: [
        { owner: userId },
        { admins: userId }
      ],
      isActive: true
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found or access denied'
      });
    }

    // Update fields
    if (name) organization.name = name;
    if (description !== undefined) organization.description = description;

    await organization.save();

    await organization.populate('owner', 'name email');

    res.json({
      success: true,
      message: 'Organization updated successfully',
      data: organization
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update organization',
      error: error.message
    });
  }
});

// @route   DELETE /api/organizations/leave
// @desc    Leave organization
// @access  Private
router.delete('/leave', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find user's organization
    const organization = await Organization.findOne({
      'members.user': userId
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'You are not a member of any organization'
      });
    }

    // Check if user is owner
    if (organization.owner.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Organization owner cannot leave. Please transfer ownership or delete the organization.'
      });
    }

    // Remove user from organization
    await organization.removeMember(userId);

    // Update user
    await User.findByIdAndUpdate(userId, {
      organization: null,
      organizationRole: null,
      joinedOrganizationAt: null
    });

    res.json({
      success: true,
      message: 'Successfully left organization'
    });
  } catch (error) {
    console.error('Leave organization error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave organization',
      error: error.message
    });
  }
});

// @route   POST /api/organizations/send-invitations
// @desc    Send invitations to selected organization members
// @access  Private (Owner/Admin only)
router.post('/send-invitations', auth, [
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
  body('memberIds').isArray({ min: 1 }).withMessage('At least one member ID is required')
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
    const { organizationId, memberIds } = req.body;

    // Find organization and verify user has permission
    const organization = await Organization.findOne({
      _id: organizationId,
      $or: [
        { owner: userId },
        { admins: userId }
      ],
      isActive: true
    })
    .populate('members.user', 'name email')
    .populate('owner', 'name email');

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found or access denied'
      });
    }

    // Verify all memberIds are valid members of the organization
    const validMemberIds = organization.members.map(member => member.user._id.toString());
    const invalidIds = memberIds.filter(id => !validMemberIds.includes(id.toString()));
    
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some member IDs are not valid members of this organization'
      });
    }

    // Get selected members
    const selectedMembers = organization.members.filter(member => 
      memberIds.includes(member.user._id.toString())
    );

    // In a real application, you would send actual emails here
    // For now, we'll just simulate sending invitations
    console.log(`Sending invitations from organization "${organization.name}" to:`, 
      selectedMembers.map(member => ({
        name: member.user.name,
        email: member.user.email
      }))
    );

    // Here you would integrate with an email service like SendGrid, Nodemailer, etc.
    // Example invitation email content:
    const invitationData = {
      organizationName: organization.name,
      senderName: req.user.name,
      recipients: selectedMembers.map(member => ({
        name: member.user.name,
        email: member.user.email,
        role: member.role
      }))
    };

    // Simulate successful sending (in production, handle email service responses)
    const successCount = selectedMembers.length;

    res.json({
      success: true,
      message: `Successfully sent invitations to ${successCount} member(s)`,
      data: {
        organizationName: organization.name,
        recipientCount: successCount,
        recipients: invitationData.recipients
      }
    });
  } catch (error) {
    console.error('Send invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invitations',
      error: error.message
    });
  }
});

module.exports = router;