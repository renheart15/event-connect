const mongoose = require('mongoose');

const participantLocationStatusSchema = new mongoose.Schema({
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
  attendanceLog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceLog',
    required: [true, 'Attendance log is required']
  },
  currentLocation: {
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    },
    accuracy: {
      type: Number,
      default: 0
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  isWithinGeofence: {
    type: Boolean,
    required: [true, 'Geofence status is required'],
    default: true
  },
  distanceFromCenter: {
    type: Number,
    default: 0
  },
  outsideTimer: {
    isActive: {
      type: Boolean,
      default: false
    },
    reason: {
      type: String,
      enum: ['outside', 'stale', null],
      default: null
    },
    startTime: {
      type: Date
    },
    totalTimeOutside: {
      type: Number, // in seconds
      default: 0
    },
    currentSessionStart: {
      type: Date
    }
  },
  status: {
    type: String,
    enum: ['inside', 'outside', 'warning', 'exceeded_limit', 'absent'],
    default: 'inside'
  },
  alertsSent: [{
    type: {
      type: String,
      required: [true, 'Alert type is required'],
      enum: {
        values: ['warning', 'exceeded_limit', 'returned', 'left_geofence'],
        message: '{VALUE} is not a valid alert type'
      }
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    acknowledged: {
      type: Boolean,
      default: false
    }
  }],
  lastLocationUpdate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
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

// Update timestamp on save
participantLocationStatusSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // CRITICAL FIX: Don't update lastLocationUpdate here - only when actually receiving new location data
  // Updating on every save makes stale detection unreliable
  next();
});

// Calculate total time outside when timer is active
participantLocationStatusSchema.methods.calculateTotalTimeOutside = function() {
  if (this.outsideTimer.isActive && this.outsideTimer.currentSessionStart) {
    const currentSessionTime = Math.floor((Date.now() - this.outsideTimer.currentSessionStart) / 1000);
    return this.outsideTimer.totalTimeOutside + currentSessionTime;
  }
  return this.outsideTimer.totalTimeOutside;
};

// Start the outside timer
participantLocationStatusSchema.methods.startOutsideTimer = function() {
  if (!this.outsideTimer.isActive) {
    this.outsideTimer.isActive = true;
    this.outsideTimer.currentSessionStart = new Date();
    if (!this.outsideTimer.startTime) {
      this.outsideTimer.startTime = new Date();
    }
  }
};

// Pause the outside timer and add session time to total (preserves accumulated time)
participantLocationStatusSchema.methods.pauseOutsideTimer = function() {
  if (this.outsideTimer.isActive && this.outsideTimer.currentSessionStart) {
    const sessionTime = Math.floor((Date.now() - this.outsideTimer.currentSessionStart) / 1000);
    this.outsideTimer.totalTimeOutside += sessionTime;
    this.outsideTimer.isActive = false;
    this.outsideTimer.currentSessionStart = null;
  }
};

// Add alert
participantLocationStatusSchema.methods.addAlert = function(type) {
  this.alertsSent.push({
    type: type,
    timestamp: new Date(),
    acknowledged: false
  });
};

// Compound index to ensure one status per participant per event
participantLocationStatusSchema.index({ event: 1, participant: 1 }, { unique: true });

// Index for geospatial queries
participantLocationStatusSchema.index({ 'currentLocation.latitude': 1, 'currentLocation.longitude': 1 });

module.exports = mongoose.model('ParticipantLocationStatus', participantLocationStatusSchema);