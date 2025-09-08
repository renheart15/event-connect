const mongoose = require('mongoose');

const feedbackResponseSchema = new mongoose.Schema({
  feedbackForm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedbackForm',
    required: [true, 'Feedback form is required']
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required']
  },
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.isAnonymous;
    }
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  responses: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: [true, 'Responses are required']
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  }
});

// Compound index to ensure one response per participant per form (unless anonymous)
feedbackResponseSchema.index(
  { feedbackForm: 1, participant: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { isAnonymous: { $ne: true } }
  }
);

// Index for faster queries
feedbackResponseSchema.index({ event: 1, submittedAt: -1 });

module.exports = mongoose.model('FeedbackResponse', feedbackResponseSchema);