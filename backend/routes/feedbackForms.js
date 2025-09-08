const express = require('express');
const { body, validationResult } = require('express-validator');
const FeedbackForm = require('../models/FeedbackForm');
const FeedbackResponse = require('../models/FeedbackResponse');
const Event = require('../models/Event');
const { auth, requireOrganizer } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/feedback-forms
// @desc    Create a new feedback form
// @access  Private (Organizer only)
router.post('/', auth, requireOrganizer, [
  body('title').trim().notEmpty().withMessage('Form title is required'),
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('description').optional().trim(),
  body('questions').isArray({ min: 1 }).withMessage('At least one question is required'),
  body('questions.*.type').isIn(['text', 'textarea', 'rating', 'multiple-choice']).withMessage('Invalid question type'),
  body('questions.*.title').trim().notEmpty().withMessage('Question title is required'),
  body('questions.*.required').isBoolean().withMessage('Required field must be boolean')
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

    const { title, description, eventId, questions, allowAnonymous = false } = req.body;

    // Check if event exists and belongs to organizer
    const event = await Event.findOne({ _id: eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    // Check if feedback form already exists for this event
    const existingForm = await FeedbackForm.findOne({ event: eventId });
    if (existingForm) {
      return res.status(400).json({
        success: false,
        message: 'Feedback form already exists for this event. Use PUT to update it.'
      });
    }

    // Validate multiple-choice questions have options
    for (const question of questions) {
      if (question.type === 'multiple-choice' && (!question.options || question.options.length === 0)) {
        return res.status(400).json({
          success: false,
          message: `Multiple choice question "${question.title}" must have at least one option`
        });
      }
    }

    // Create feedback form
    const feedbackForm = await FeedbackForm.create({
      title,
      description,
      event: eventId,
      organizer: req.user._id,
      questions,
      allowAnonymous,
      isPublished: true // Auto-publish when created
    });

    await feedbackForm.populate(['event', 'organizer']);

    res.status(201).json({
      success: true,
      message: 'Feedback form created successfully',
      data: {
        feedbackForm
      }
    });
  } catch (error) {
    console.error('Feedback form creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Feedback form creation failed',
      error: error.message
    });
  }
});

// @route   GET /api/feedback-forms/event/:eventId/manage
// @desc    Get feedback form for event management (organizer only)
// @access  Private (Organizer only)
router.get('/event/:eventId/manage', auth, requireOrganizer, async (req, res) => {
  try {
    // Check if event belongs to organizer
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    const feedbackForm = await FeedbackForm.findOne({ 
      event: req.params.eventId,
      organizer: req.user._id
    }).populate('event', 'title date location organizer');

    if (!feedbackForm) {
      return res.json({
        success: true,
        message: 'No feedback form found for this event',
        data: {
          feedbackForm: null
        }
      });
    }

    res.json({
      success: true,
      data: {
        feedbackForm
      }
    });
  } catch (error) {
    console.error('Get feedback form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback form',
      error: error.message
    });
  }
});

// @route   GET /api/feedback-forms/event/:eventId
// @desc    Get feedback form for an event
// @access  Public (for participants to view)
router.get('/event/:eventId', async (req, res) => {
  try {
    const feedbackForm = await FeedbackForm.findOne({ 
      event: req.params.eventId,
      isActive: true,
      isPublished: true
    }).populate('event', 'title date location organizer');

    if (!feedbackForm) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found for this event'
      });
    }

    res.json({
      success: true,
      data: {
        feedbackForm
      }
    });
  } catch (error) {
    console.error('Get feedback form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback form',
      error: error.message
    });
  }
});

// @route   GET /api/feedback-forms/:id
// @desc    Get single feedback form
// @access  Private (Organizer only - own forms)
router.get('/:id', auth, requireOrganizer, async (req, res) => {
  try {
    const feedbackForm = await FeedbackForm.findOne({ 
      _id: req.params.id, 
      organizer: req.user._id 
    }).populate(['event', 'organizer']);

    if (!feedbackForm) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found or access denied'
      });
    }

    res.json({
      success: true,
      data: {
        feedbackForm
      }
    });
  } catch (error) {
    console.error('Get feedback form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback form',
      error: error.message
    });
  }
});

// @route   POST /api/feedback-forms/:id/responses
// @desc    Submit feedback response
// @access  Public/Private (depends on form settings)
router.post('/:id/responses', [
  body('responses').isObject().withMessage('Responses must be an object'),
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

    const { responses, isAnonymous = false } = req.body;

    const feedbackForm = await FeedbackForm.findById(req.params.id).populate('event');
    if (!feedbackForm || !feedbackForm.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found or not published'
      });
    }

    // Check if anonymous responses are allowed
    if (isAnonymous && !feedbackForm.allowAnonymous) {
      return res.status(400).json({
        success: false,
        message: 'Anonymous responses are not allowed for this form'
      });
    }

    let participantId = null;
    
    // If not anonymous, get user from token (optional for feedback)
    if (!isAnonymous && req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const User = require('../models/User');
        const user = await User.findById(decoded.id);
        if (user) {
          participantId = user._id;
        }
      } catch (error) {
        // Token invalid or expired, but we allow anonymous responses
      }
    }

    // Validate required questions
    const missingRequired = [];
    for (const question of feedbackForm.questions) {
      if (question.required && !responses[question.id]) {
        missingRequired.push(question.title);
      }
    }

    if (missingRequired.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required responses: ${missingRequired.join(', ')}`
      });
    }

    // Check for duplicate response (if not anonymous)
    if (participantId) {
      const existingResponse = await FeedbackResponse.findOne({
        feedbackForm: req.params.id,
        participant: participantId
      });

      if (existingResponse) {
        return res.status(400).json({
          success: false,
          message: 'You have already submitted feedback for this event'
        });
      }
    }

    // Calculate average rating if there are rating questions
    let averageRating = null;
    const ratingQuestions = feedbackForm.questions.filter(q => q.type === 'rating');
    if (ratingQuestions.length > 0) {
      const ratings = ratingQuestions.map(q => responses[q.id]).filter(r => r);
      if (ratings.length > 0) {
        averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
      }
    }

    // Create feedback response
    const feedbackResponse = await FeedbackResponse.create({
      feedbackForm: req.params.id,
      event: feedbackForm.event._id,
      participant: participantId,
      isAnonymous,
      responses,
      rating: averageRating,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        feedbackResponse: {
          id: feedbackResponse._id,
          submittedAt: feedbackResponse.submittedAt
        }
      }
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
});

// @route   GET /api/feedback-forms/:id/responses
// @desc    Get feedback responses for a form
// @access  Private (Organizer only)
router.get('/:id/responses', auth, requireOrganizer, async (req, res) => {
  try {
    // Check if feedback form belongs to organizer
    const feedbackForm = await FeedbackForm.findOne({ 
      _id: req.params.id, 
      organizer: req.user._id 
    });
    
    if (!feedbackForm) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found or access denied'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await FeedbackResponse.countDocuments({ 
      feedbackForm: req.params.id 
    });

    const responses = await FeedbackResponse.find({ 
      feedbackForm: req.params.id 
    })
      .populate('participant', 'name email')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);

    // Calculate statistics
    const stats = {
      totalResponses: total,
      averageRating: 0,
      responsesByRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      anonymousResponses: responses.filter(r => r.isAnonymous).length
    };

    const ratingsWithValues = responses.filter(r => r.rating !== null && r.rating !== undefined);
    if (ratingsWithValues.length > 0) {
      stats.averageRating = ratingsWithValues.reduce((sum, r) => sum + r.rating, 0) / ratingsWithValues.length;
      
      ratingsWithValues.forEach(r => {
        const roundedRating = Math.round(r.rating);
        if (roundedRating >= 1 && roundedRating <= 5) {
          stats.responsesByRating[roundedRating]++;
        }
      });
    }

    res.json({
      success: true,
      data: {
        responses,
        stats,
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
    console.error('Get feedback responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback responses',
      error: error.message
    });
  }
});

// @route   PUT /api/feedback-forms/:id
// @desc    Update feedback form
// @access  Private (Organizer only - own forms)
router.put('/:id', auth, requireOrganizer, [
  body('title').optional().trim().notEmpty().withMessage('Form title cannot be empty'),
  body('description').optional().trim(),
  body('questions').optional().isArray({ min: 1 }).withMessage('At least one question is required'),
  body('questions.*.type').optional().isIn(['text', 'textarea', 'rating', 'multiple-choice']).withMessage('Invalid question type'),
  body('questions.*.title').optional().trim().notEmpty().withMessage('Question title is required'),
  body('questions.*.required').optional().isBoolean().withMessage('Required field must be boolean'),
  body('isPublished').optional().isBoolean().withMessage('Published field must be boolean'),
  body('allowAnonymous').optional().isBoolean().withMessage('Allow anonymous field must be boolean')
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

    const feedbackForm = await FeedbackForm.findOne({ 
      _id: req.params.id, 
      organizer: req.user._id 
    });

    if (!feedbackForm) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found or access denied'
      });
    }

    // Validate multiple-choice questions have options if questions are being updated
    if (req.body.questions) {
      for (const question of req.body.questions) {
        if (question.type === 'multiple-choice' && (!question.options || question.options.length === 0)) {
          return res.status(400).json({
            success: false,
            message: `Multiple choice question "${question.title}" must have at least one option`
          });
        }
      }
    }

    // Update the feedback form
    const updateData = {};
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.questions !== undefined) updateData.questions = req.body.questions;
    if (req.body.isPublished !== undefined) updateData.isPublished = req.body.isPublished;
    if (req.body.allowAnonymous !== undefined) updateData.allowAnonymous = req.body.allowAnonymous;

    const updatedForm = await FeedbackForm.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate(['event', 'organizer']);

    res.json({
      success: true,
      message: 'Feedback form updated successfully',
      data: {
        feedbackForm: updatedForm
      }
    });
  } catch (error) {
    console.error('Feedback form update error:', error);
    res.status(500).json({
      success: false,
      message: 'Feedback form update failed',
      error: error.message
    });
  }
});

// @route   DELETE /api/feedback-forms/:id
// @desc    Delete feedback form
// @access  Private (Organizer only - own forms)
router.delete('/:id', auth, requireOrganizer, async (req, res) => {
  try {
    const feedbackForm = await FeedbackForm.findOne({ 
      _id: req.params.id, 
      organizer: req.user._id 
    });

    if (!feedbackForm) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found or access denied'
      });
    }

    // Delete related responses
    await FeedbackResponse.deleteMany({ feedbackForm: req.params.id });
    await FeedbackForm.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Feedback form deleted successfully'
    });
  } catch (error) {
    console.error('Feedback form deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Feedback form deletion failed',
      error: error.message
    });
  }
});

module.exports = router;