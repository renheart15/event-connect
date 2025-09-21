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
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { eventId, responses } = req.body;
    const participantId = req.user._id;

    // Check if event exists and is published
    const event = await Event.findOne({
      _id: eventId,
      published: true,
      isActive: true
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or not available for registration'
      });
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
    const registrationForm = await RegistrationForm.findOne({
      event: req.params.eventId,
      isActive: true
    });

    if (!registrationForm) {
      return res.json({
        success: true,
        data: {
          hasSubmitted: false,
          requiresRegistration: false
        }
      });
    }

    const existingResponse = await RegistrationResponse.findOne({
      registrationForm: registrationForm._id,
      participant: req.user._id
    });

    res.json({
      success: true,
      data: {
        hasSubmitted: !!existingResponse,
        requiresRegistration: true,
        registrationForm: registrationForm
      }
    });
  } catch (error) {
    console.error('Check registration status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check registration status',
      error: error.message
    });
  }
});

module.exports = router;