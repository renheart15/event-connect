const mongoose = require('mongoose');

const registrationResponseSchema = new mongoose.Schema({
  registrationForm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegistrationForm',
    required: [true, 'Registration form is required']
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required']
  },
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Participant is required']
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
  isComplete: {
    type: Boolean,
    default: true
  }
});

// Compound index to ensure one response per participant per form
registrationResponseSchema.index({ registrationForm: 1, participant: 1 }, { unique: true });

// Index for faster queries
registrationResponseSchema.index({ event: 1, submittedAt: -1 });

module.exports = mongoose.model('RegistrationResponse', registrationResponseSchema);