const express = require('express');
const { body, validationResult } = require('express-validator');
const RegistrationResponse = require('../models/RegistrationResponse');
const RegistrationForm = require('../models/RegistrationForm');
const Event = require('../models/Event');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/registration-responses
// @desc    Submit registration form response
// @access  Private (Participant)
router.post('/', auth, [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('responses').isObject().withMessage('Responses must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ [REGISTRATION RESPONSE] Validation failed:', {
        errors: errors.array(),
        body: req.body
      });
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { eventId, responses } = req.body;
    const participantId = req.user._id;

    console.log('📝 [REGISTRATION RESPONSE] Received submission:', {
      eventId,
      participantId,
      responseKeys: Object.keys(responses)
    });

    // Check if event exists
    // We DON'T check published or isActive here because:
    // 1. Invited participants should be able to register even if event is not public
    // 2. If participant has the event code or invitation, they have permission
    const event = await Event.findById(eventId);

    console.log('🔍 [REGISTRATION RESPONSE] Event lookup result:', {
      eventId,
      found: !!event,
      eventTitle: event?.title,
      published: event?.published,
      isActive: event?.isActive
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if participant has access to this event
    // They have access if:
    // 1. Event is published (public event), OR
    // 2. They have an invitation (accepted, pending, or pending_approval)
    if (!event.published) {
      const Invitation = require('../models/Invitation');
      let invitation = await Invitation.findOne({
        event: eventId,
        participant: participantId
      });

      console.log('🔍 [REGISTRATION RESPONSE] Event not published, checking invitation:', {
        hasInvitation: !!invitation,
        invitationStatus: invitation?.status
      });

      if (!invitation) {
        // For private events scanned via QR: Create a "pending_approval" invitation
        // This allows participant to register but requires organizer approval
        console.log('🔒 [REGISTRATION RESPONSE] Private event - creating pending approval request');

        const crypto = require('crypto');
        invitation = await Invitation.create({
          event: eventId,
          participant: participantId,
          participantEmail: req.user.email,
          participantName: req.user.name,
          invitationCode: crypto.randomBytes(16).toString('hex').toUpperCase(),
          qrCodeData: `PENDING_APPROVAL_${eventId}_${participantId}`,
          status: 'pending_approval',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });

        console.log('✅ [REGISTRATION RESPONSE] Created pending approval invitation:', invitation._id);

        // Return a special response indicating approval is needed
        return res.status(202).json({
          success: true,
          message: 'Registration request submitted. Waiting for organizer approval.',
          requiresApproval: true,
          data: {
            invitation: {
              _id: invitation._id,
              status: 'pending_approval',
              event: eventId
            }
          }
        });
      }

      // Check if invitation is in pending_approval state
      if (invitation.status === 'pending_approval') {
        return res.status(202).json({
          success: true,
          message: 'Your registration request is pending organizer approval.',
          requiresApproval: true,
          data: {
            invitation: {
              _id: invitation._id,
              status: 'pending_approval',
              event: eventId
            }
          }
        });
      }

      // Allow registration if they have an accepted/pending invitation
      // Even pending invitations can register first, then decide to accept/decline
    }

    // Get the registration form for this event
    const registrationForm = await RegistrationForm.findOne({
      event: eventId,
      isActive: true
    });

    if (!registrationForm) {
      return res.status(404).json({
        success: false,
        message: 'Registration form not found for this event'
      });
    }

    // Validate required fields
    const requiredFields = registrationForm.fields.filter(field => field.required);
    const missingFields = [];

    for (const field of requiredFields) {
      if (!responses[field.id] || responses[field.id].toString().trim() === '') {
        missingFields.push(field.label);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if participant has already submitted a response
    const existingResponse = await RegistrationResponse.findOne({
      registrationForm: registrationForm._id,
      participant: participantId
    });

    if (existingResponse) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a registration for this event'
      });
    }

    // Create registration response
    const registrationResponse = await RegistrationResponse.create({
      registrationForm: registrationForm._id,
      event: eventId,
      participant: participantId,
      responses: responses,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    await registrationResponse.populate([
      'registrationForm',
      'event',
      'participant'
    ]);

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully',
      data: {
        registrationResponse
      }
    });
  } catch (error) {
    console.error('Registration response submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration submission failed',
      error: error.message
    });
  }
});

// @route   GET /api/registration-responses/my
// @desc    Get participant's own registration responses
// @access  Private (Participant)
router.get('/my', auth, async (req, res) => {
  try {
    const responses = await RegistrationResponse.find({
      participant: req.user._id
    })
    .populate('registrationForm', 'title')
    .populate({
      path: 'event',
      select: 'title date location published',
      match: { published: { $eq: true } } // Only populate published events (explicitly true, not null/undefined)
    })
    .sort({ submittedAt: -1 });

    // Filter out responses where event didn't populate (unpublished events)
    const filteredResponses = responses.filter(response => response.event !== null);

    res.json({
      success: true,
      data: {
        responses: filteredResponses
      }
    });
  } catch (error) {
    console.error('Get registration responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get registration responses',
      error: error.message
    });
  }
});

// @route   GET /api/registration-responses/event/:eventId
// @desc    Get all registration responses for an event (organizer only)
// @access  Private (Organizer only)
router.get('/event/:eventId', auth, async (req, res) => {
  try {
    // Check if event belongs to organizer
    const event = await Event.findOne({
      _id: req.params.eventId,
      organizer: req.user._id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await RegistrationResponse.countDocuments({
      event: req.params.eventId
    });

    const responses = await RegistrationResponse.find({
      event: req.params.eventId
    })
    .populate('participant', 'name email')
    .populate('registrationForm', 'title fields')
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(limit);

    res.json({
      success: true,
      data: {
        responses,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalResponses: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get event registration responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get registration responses',
      error: error.message
    });
  }
});

// @route   GET /api/registration-responses/check/:eventId
// @desc    Check if participant has submitted registration for event
// @access  Private (Participant)
router.get('/check/:eventId', auth, async (req, res) => {
  try {
    console.log('🔍 [REG-CHECK] Checking registration status for event:', req.params.eventId, 'participant:', req.user._id);

    const registrationForm = await RegistrationForm.findOne({
      event: req.params.eventId,
      isActive: true
    });

    if (!registrationForm) {
      console.log('ℹ️ [REG-CHECK] No active registration form found for event');
      return res.json({
        success: true,
        data: {
          hasSubmitted: false,
          requiresRegistration: false
        }
      });
    }

    console.log('✅ [REG-CHECK] Registration form found:', registrationForm._id);

    const existingResponse = await RegistrationResponse.findOne({
      registrationForm: registrationForm._id,
      participant: req.user._id
    });

    console.log('🔍 [REG-CHECK] Existing response found:', !!existingResponse);
    if (existingResponse) {
      console.log('📋 [REG-CHECK] Response details:', {
        _id: existingResponse._id,
        submittedAt: existingResponse.submittedAt
      });
    }

    const result = {
      success: true,
      data: {
        hasSubmitted: !!existingResponse,
        requiresRegistration: true,
        registrationForm: registrationForm
      }
    };

    console.log('📤 [REG-CHECK] Returning:', { hasSubmitted: !!existingResponse, requiresRegistration: true });

    res.json(result);
  } catch (error) {
    console.error('❌ [REG-CHECK] Check registration status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check registration status',
      error: error.message
    });
  }
});

module.exports = router;