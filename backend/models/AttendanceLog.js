
const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
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
  invitation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invitation',
    required: false // Optional for public events without invitations
  },
  checkInTime: {
    type: Date,
    required: false // Optional - set when actually checking in
  },
  checkOutTime: {
    type: Date
  },
  checkInLocation: {
    latitude: Number,
    longitude: Number
  },
  checkOutLocation: {
    latitude: Number,
    longitude: Number
  },
  status: {
    type: String,
    enum: ['registered', 'checked-in', 'checked-out'],
    default: 'registered'
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [200, 'Notes cannot be more than 200 characters']
  },
  hiddenFromParticipant: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate duration when checking out
attendanceLogSchema.pre('save', function(next) {
  if (this.checkOutTime && this.checkInTime) {
    this.duration = Math.round((this.checkOutTime - this.checkInTime) / (1000 * 60));
    this.status = 'checked-out';
  }
  next();
});

// Compound index to ensure one attendance log per participant per event
attendanceLogSchema.index({ event: 1, participant: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
