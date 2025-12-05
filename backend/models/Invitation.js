
const mongoose = require('mongoose');
const crypto = require('crypto');

const invitationSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required']
  },
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false  // Optional - will be linked when user creates account
  },
  participantEmail: {
    type: String,
    required: [true, 'Participant email is required'],
    lowercase: true
  },
  participantName: {
    type: String,
    required: [true, 'Participant name is required'],
    trim: true
  },
  invitationCode: {
    type: String,
    unique: true,
    required: true
  },
  qrCodeData: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired', 'pending_approval'],
    default: 'pending'
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    required: true
  }
});

// Generate unique invitation code before saving
invitationSchema.pre('save', function(next) {
  if (!this.invitationCode) {
    this.invitationCode = crypto.randomBytes(16).toString('hex').toUpperCase();
  }
  next();
});

// Compound index to ensure one invitation per participant per event
// Allow sparse index to permit null participant values
invitationSchema.index({ event: 1, participant: 1 }, { unique: true, sparse: true });

// Additional index to ensure one invitation per email per event
invitationSchema.index({ event: 1, participantEmail: 1 }, { unique: true });

module.exports = mongoose.model('Invitation', invitationSchema);
