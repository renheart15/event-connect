const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'email', 'phone', 'number', 'textarea', 'select', 'checkbox'],
    required: [true, 'Field type is required']
  },
  label: {
    type: String,
    required: [true, 'Field label is required'],
    trim: true,
    maxlength: [100, 'Field label cannot exceed 100 characters']
  },
  placeholder: {
    type: String,
    trim: true,
    maxlength: [200, 'Placeholder cannot exceed 200 characters']
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    type: String,
    trim: true
  }]
});

const registrationFormSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Form title is required'],
    trim: true,
    maxlength: [150, 'Title cannot exceed 150 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required'],
    unique: true // Only one registration form per event
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organizer is required']
  },
  fields: [fieldSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  isPublished: {
    type: Boolean,
    default: false
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

// Automatically update `updatedAt` before saving
registrationFormSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
registrationFormSchema.index({ event: 1, organizer: 1 });

module.exports = mongoose.model('RegistrationForm', registrationFormSchema);