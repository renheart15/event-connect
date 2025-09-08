const mongoose = require('mongoose');

const emailConfigSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  email: {
    type: String,
    required: [true, 'Gmail email is required'],
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
      },
      message: 'Email must be a valid Gmail address'
    }
  },
  hashedPassword: {
    type: String,
    required: [true, 'Hashed password is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
emailConfigSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Ensure only one active email config per user
emailConfigSchema.index({ user: 1, email: 1 }, { unique: true });

// Index for efficient queries
emailConfigSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('EmailConfig', emailConfigSchema);