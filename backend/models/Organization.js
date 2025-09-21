const mongoose = require('mongoose');
const crypto = require('crypto');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    maxlength: [100, 'Organization name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  organizationCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    minlength: [6, 'Organization code must be at least 6 characters'],
    maxlength: [10, 'Organization code cannot be more than 10 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organization owner is required']
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['member', 'admin'],
      default: 'member'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    allowPublicJoin: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    }
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
organizationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate unique organization code before saving if not provided
organizationSchema.pre('save', function(next) {
  if (!this.organizationCode) {
    // Generate a random 8-character alphanumeric code
    this.organizationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  next();
});

// Ensure organization code is unique
organizationSchema.index({ organizationCode: 1 }, { unique: true });

// Index for efficient queries
organizationSchema.index({ owner: 1 });
organizationSchema.index({ 'members.user': 1 });
organizationSchema.index({ isActive: 1 });

// Virtual for member count
organizationSchema.virtual('memberCount').get(function() {
  return this.members ? this.members.length : 0;
});

// Method to add member
organizationSchema.methods.addMember = function(userId, role = 'member') {
  const existingMember = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  if (!existingMember) {
    this.members.push({
      user: userId,
      role: role,
      joinedAt: new Date()
    });
  }
  
  return this.save();
};

// Method to remove member
organizationSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(member => 
    member.user.toString() !== userId.toString()
  );
  
  return this.save();
};

// Method to check if user is member
organizationSchema.methods.isMember = function(userId) {
  return this.members.some(member => 
    member.user.toString() === userId.toString()
  );
};

// Method to check if user is admin
organizationSchema.methods.isAdmin = function(userId) {
  return this.admins.includes(userId) || this.owner.toString() === userId.toString();
};

module.exports = mongoose.model('Organization', organizationSchema);