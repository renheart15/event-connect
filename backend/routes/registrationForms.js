const express = require('express');
const { body, validationResult } = require('express-validator');
const RegistrationForm = require('../models/RegistrationForm');
const Event = require('../models/Event');
const { auth, requireOrganizer } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/registration-forms
// @desc    Create a new registration form
// @access  Private (Organizer only)
router.post('/', auth, requireOrganizer, [
  body('title').trim().notEmpty().withMessage('Form title is required'),
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('description').optional().trim(),
  body('fields').isArray({ min: 1 }).withMessage('At least one field is required'),
  body('fields.*.type').isIn(['text', 'email', 'phone', 'number', 'textarea', 'select', 'checkbox']).withMessage('Invalid field type'),
  body('fields.*.label').trim().notEmpty().withMessage('Field label is required'),
  body('fields.*.required').isBoolean().withMessage('Required field must be boolean')
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

    const { title, description, eventId, fields } = req.body;

    // Check if event exists and belongs to organizer
    const event = await Event.findOne({ _id: eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    // Check if registration form already exists for this event
    const existingForm = await RegistrationForm.findOne({ event: eventId });
    if (existingForm) {
      return res.status(400).json({
        success: false,
        message: 'Registration form already exists for this event. Use PUT to update it.'
      });
    }

    // Validate select fields have options
    for (const field of fields) {
      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        return res.status(400).json({
          success: false,
          message: `Select field "${field.label}" must have at least one option`
        });
      }
    }

    // Create registration form
    const registrationForm = await RegistrationForm.create({
      title,
      description,
      event: eventId,
      organizer: req.user._id,
      fields,
      isPublished: true // Auto-publish when created
    });

    await registrationForm.populate(['event', 'organizer']);

    res.status(201).json({
      success: true,
      message: 'Registration form created successfully',
      data: {
        registrationForm
      }
    });
  } catch (error) {
    console.error('Registration form creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration form creation failed',
      error: error.message
    });
  }
});

// @route   GET /api/registration-forms/event/:eventId
// @desc    Get registration form for an event
// @access  Public (for participants to view) / Private (for organizers to manage)
router.get('/event/:eventId', async (req, res) => {
  try {
    const registrationForm = await RegistrationForm.findOne({ 
      event: req.params.eventId, 
      isActive: true 
    }).populate('event', 'title date location organizer');

    if (!registrationForm) {
      return res.status(404).json({
        success: false,
        message: 'Registration form not found for this event'
      });
    }

    res.json({
      success: true,
      data: {
        registrationForm
      }
    });
  } catch (error) {
    console.error('Get registration form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get registration form',
      error: error.message
    });
  }
});

// @route   GET /api/registration-forms/:id
// @desc    Get single registration form
// @access  Private (Organizer only - own forms)
router.get('/:id', auth, requireOrganizer, async (req, res) => {
  try {
    const registrationForm = await RegistrationForm.findOne({ 
      _id: req.params.id, 
      organizer: req.user._id 
    }).populate(['event', 'organizer']);

    if (!registrationForm) {
      return res.status(404).json({
        success: false,
        message: 'Registration form not found or access denied'
      });
    }

    res.json({
      success: true,
      data: {
        registrationForm
      }
    });
  } catch (error) {
    console.error('Get registration form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get registration form',
      error: error.message
    });
  }
});

// @route   PUT /api/registration-forms/:id
// @desc    Update registration form
// @access  Private (Organizer only - own forms)
router.put('/:id', auth, requireOrganizer, [
  body('title').optional().trim().notEmpty().withMessage('Form title cannot be empty'),
  body('description').optional().trim(),
  body('fields').optional().isArray({ min: 1 }).withMessage('At least one field is required'),
  body('fields.*.type').optional().isIn(['text', 'email', 'phone', 'number', 'textarea', 'select', 'checkbox']).withMessage('Invalid field type'),
  body('fields.*.label').optional().trim().notEmpty().withMessage('Field label is required'),
  body('fields.*.required').optional().isBoolean().withMessage('Required field must be boolean')
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

    const registrationForm = await RegistrationForm.findOne({ 
      _id: req.params.id, 
      organizer: req.user._id 
    });

    if (!registrationForm) {
      return res.status(404).json({
        success: false,
        message: 'Registration form not found or access denied'
      });
    }

    const { title, description, fields, isPublished } = req.body;

    // Validate select fields have options if fields are being updated
    if (fields) {
      for (const field of fields) {
        if (field.type === 'select' && (!field.options || field.options.length === 0)) {
          return res.status(400).json({
            success: false,
            message: `Select field "${field.label}" must have at least one option`
          });
        }
      }
    }

    // Update fields
    if (title !== undefined) registrationForm.title = title;
    if (description !== undefined) registrationForm.description = description;
    if (fields !== undefined) registrationForm.fields = fields;
    if (isPublished !== undefined) registrationForm.isPublished = isPublished;

    await registrationForm.save();
    await registrationForm.populate(['event', 'organizer']);

    res.json({
      success: true,
      message: 'Registration form updated successfully',
      data: {
        registrationForm
      }
    });
  } catch (error) {
    console.error('Registration form update error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration form update failed',
      error: error.message
    });
  }
});

// @route   DELETE /api/registration-forms/:id
// @desc    Delete registration form
// @access  Private (Organizer only - own forms)
router.delete('/:id', auth, requireOrganizer, async (req, res) => {
  try {
    const registrationForm = await RegistrationForm.findOne({ 
      _id: req.params.id, 
      organizer: req.user._id 
    });

    if (!registrationForm) {
      return res.status(404).json({
        success: false,
        message: 'Registration form not found or access denied'
      });
    }

    await RegistrationForm.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Registration form deleted successfully'
    });
  } catch (error) {
    console.error('Registration form deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration form deletion failed',
      error: error.message
    });
  }
});

// @route   GET /api/registration-forms
// @desc    Get all registration forms for organizer
// @access  Private (Organizer only)
router.get('/', auth, requireOrganizer, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await RegistrationForm.countDocuments({ 
      organizer: req.user._id 
    });

    const registrationForms = await RegistrationForm.find({ 
      organizer: req.user._id 
    })
      .populate('event', 'title date location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: {
        registrationForms,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalForms: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get registration forms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get registration forms',
      error: error.message
    });
  }
});

module.exports = router;