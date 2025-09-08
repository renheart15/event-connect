const mongoose = require('mongoose');

// Junction table for user-organization many-to-many relationship
const userOrganizationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure unique user-organization pairs
userOrganizationSchema.index({ user: 1, organization: 1 }, { unique: true });

module.exports = mongoose.model('UserOrganization', userOrganizationSchema);