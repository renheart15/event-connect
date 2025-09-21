const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  eventType: {
    type: String,
    enum: ['single-day', 'multi-day'],
    default: 'single-day'
  },
  date: {
    type: Date,
    required: [true, 'Event date is required']
  },
  endDate: {
    type: Date,
    validate: {
      validator: function(value) {
        // Only validate if this is a multi-day event
        if (this.eventType === 'multi-day') {
          return value && value >= this.date;
        }
        return true;
      },
      message: 'End date must be on or after start date'
    }
  },
  startTime: {
    type: String,
    validate: {
      validator: v => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v),
      message: props => `${props.value} is not a valid time format (HH:mm)`
    }
  },
  endTime: {
    type: String,
    validate: {
      validator: v => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v),
      message: props => `${props.value} is not a valid time format (HH:mm)`
    }
  },
  location: {
    address: {
      type: String,
      required: [true, 'Event address is required'],
      trim: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        required: [true, 'Coordinate type is required'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Coordinates are required'],
        validate: {
          validator: function (coords) {
            return coords.length === 2 &&
              typeof coords[0] === 'number' &&
              typeof coords[1] === 'number' &&
              coords[0] >= -180 && coords[0] <= 180 &&
              coords[1] >= -90 && coords[1] <= 90;
          },
          message: 'Coordinates must be [longitude, latitude] as numbers within valid ranges'
        }
      }
    }
  },
  geofenceRadius: {
    type: Number,
    default: 100,
    min: [1, 'Geofence radius must be at least 1 meter']
  },
  maxTimeOutside: {
    type: Number,
    default: 15,
    min: [1, 'Max time outside must be at least 1 minute']
  },
  eventCode: {
    type: String,
    required: [true, 'Event code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [4, 'Event code must be at least 4 characters'],
    maxlength: [10, 'Event code cannot exceed 10 characters']
  },
  maxParticipants: {
    type: Number,
    min: [1, 'Max participants must be at least 1']
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organizer is required']
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  statusMode: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'auto'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  published: {
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
eventSchema.pre('save', function (next) {
  this.updatedAt = Date.now();

  // Optional fix: convert malformed coordinate values
  if (
    this.location?.coordinates?.coordinates &&
    this.location.coordinates.coordinates.length === 2
  ) {
    this.location.coordinates.coordinates = this.location.coordinates.coordinates.map(val =>
      typeof val === 'object' && val?.$numberDouble
        ? parseFloat(val.$numberDouble)
        : parseFloat(val)
    );
  }

  next();
});

// Required for geospatial queries
eventSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Event', eventSchema);
