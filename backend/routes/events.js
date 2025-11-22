
const express = require('express');
const reverseGeocode = require('../utils/reverseGeocode');
const fixBrokenLocations = require('../utils/fixBrokenLocations');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const AttendanceLog = require('../models/AttendanceLog');
const Invitation = require('../models/Invitation');
const RegistrationForm = require('../models/RegistrationForm');
const { auth, requireOrganizer } = require('../middleware/auth');

// Temporary in-memory store for location and battery data
const participantLocationData = new Map(); // participantId -> { latitude, longitude, accuracy, batteryLevel, timestamp }
const { updateAllEventStatuses, updateSingleEventStatus, calculateEventStatus } = require('../utils/updateEventStatuses');

const router = express.Router();

// Use the centralized calculateEventStatus function instead of local computeStatus

// @route   POST /api/events
// @desc    Create a new event
// @access  Private (Organizer only)
router.post('/', auth, requireOrganizer, [
  body('title').trim().notEmpty().withMessage('Event title is required'),
  body('eventType').optional().isIn(['single-day', 'multi-day']).withMessage('Event type must be single-day or multi-day'),
  body('date').isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('startTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:mm format'),
  body('endTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:mm format'),
  body('location.address').trim().notEmpty().withMessage('Event location is required'),
  body('location.coordinates.type')
    .equals('Point')
    .withMessage('Coordinates type must be Point'),
  body('location.coordinates.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Coordinates must be an array of [longitude, latitude]'),
  body('location.coordinates.coordinates[0]')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be valid'),
  body('location.coordinates.coordinates[1]')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be valid'),
  body('geofenceRadius').optional().isInt({ min: 1 }).withMessage('Geofence radius must be a positive number'),
  body('description').optional().trim(),
  body('maxParticipants').optional().isInt({ min: 1 }).withMessage('Max participants must be at least 1')
], async (req, res) => {
  console.log('🟢 Received payload:', JSON.stringify(req.body, null, 2));

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('🔴 Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const coords = req.body.location.coordinates.coordinates.map(Number);

    // Create a temporary event object to calculate status
    const tempEvent = {
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      title: req.body.title || 'New Event'
    };
    const status = calculateEventStatus(tempEvent);

    const eventData = {
      title: req.body.title,
      eventType: req.body.eventType || 'single-day',
      date: req.body.date,
      endDate: req.body.endDate,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      location: {
        address: req.body.location.address,
        coordinates: {
          type: 'Point',
          coordinates: coords
        }
      },
      geofenceRadius: req.body.geofenceRadius,
      description: req.body.description,
      maxParticipants: req.body.maxParticipants,
      maxTimeOutside: req.body.maxTimeOutside,
      eventCode: req.body.eventCode,
      status,
      organizer: req.user._id
    };

    const event = await Event.create(eventData);
    await event.populate('organizer', 'name email');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { event }
    });
  } catch (error) {
    console.error('🔥 MongoDB error:', error);
    res.status(500).json({
      success: false,
      message: 'Event creation failed',
      error: error.message
    });
  }
});

// @route   GET /api/events
// @desc    Get all events (organizer gets their events, admin gets all)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    // Trigger immediate status update for all events before fetching
    await updateAllEventStatuses();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {};
    if (req.user.role === 'organizer') {
      query.organizer = req.user._id;
    }

    // Add status filter if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Add date filter if provided
    if (req.query.fromDate || req.query.toDate) {
      query.date = {};
      if (req.query.fromDate) {
        query.date.$gte = new Date(req.query.fromDate);
      }
      if (req.query.toDate) {
        query.date.$lte = new Date(req.query.toDate);
      }
    }

    const total = await Event.countDocuments(query);

    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    // Collect event IDs for batch queries
    const eventIds = events.map(e => e._id);

    // Batch fetch attendance statistics for all events (organizers only)
    let invitationStats = new Map();
    let attendanceStats = new Map();

    if (req.user.role === 'organizer' && eventIds.length > 0) {
      try {
        // Aggregate invitation counts
        const invitationCounts = await Invitation.aggregate([
          { $match: { event: { $in: eventIds } } },
          { $group: { _id: '$event', count: { $sum: 1 } } }
        ]);
        invitationCounts.forEach(stat => {
          invitationStats.set(stat._id.toString(), stat.count);
        });

        // Aggregate attendance counts and currently present counts in one query
        const attendanceCounts = await AttendanceLog.aggregate([
          { $match: { event: { $in: eventIds } } },
          {
            $group: {
              _id: '$event',
              totalAttendees: { $sum: 1 },
              currentlyPresent: {
                $sum: { $cond: [{ $eq: ['$status', 'checked-in'] }, 1, 0] }
              }
            }
          }
        ]);
        attendanceCounts.forEach(stat => {
          attendanceStats.set(stat._id.toString(), {
            totalAttendees: stat.totalAttendees,
            currentlyPresent: stat.currentlyPresent
          });
        });
      } catch (aggregateError) {
        console.error('Error batch fetching attendance stats:', aggregateError);
      }
    }

    // Process events with pre-fetched stats
    const eventsWithStats = [];
    console.log(`Processing ${events.length} events for user role: ${req.user.role}`);

    for (let event of events) {
      // Auto-update status only if statusMode is 'auto'
      if (event.statusMode === 'auto') {
        const expectedStatus = calculateEventStatus(event);
        console.log(`Event ${event.title}: current status = ${event.status}, computed status = ${expectedStatus}`);
        if (expectedStatus !== event.status) {
          event.status = expectedStatus;
          await event.save();
          console.log(`Updated event ${event.title} status to ${expectedStatus}`);
        }
      }

      // Attach pre-fetched statistics for organizers
      let eventData = event.toObject();
      if (req.user.role === 'organizer') {
        const eventIdStr = event._id.toString();
        const attendance = attendanceStats.get(eventIdStr) || { totalAttendees: 0, currentlyPresent: 0 };

        // Use total attendees (checked-in participants) as total, not just invited participants
        // This includes both invited participants and walk-ins (uninvited who scanned QR)
        eventData.totalParticipants = attendance.totalAttendees;
        eventData.checkedIn = attendance.totalAttendees;
        eventData.currentlyPresent = attendance.currentlyPresent;
      }

      eventsWithStats.push(eventData);
    }
    
    res.json({
      success: true,
      data: {
        events: eventsWithStats,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalEvents: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get events',
      error: error.message
    });
  }
});

// @route   GET /api/events/public
// @desc    Get all published events for public viewing
// @access  Public (no auth required)
router.get('/public', async (req, res) => {
  try {
    console.log('🔍 [PUBLIC EVENTS DEBUG] Starting public events fetch...');

    // Trigger immediate status update for all events before fetching
    await updateAllEventStatuses();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Only get published events (we'll filter by status after fetching)
    const query = {
      published: { $eq: true }, // Explicitly require published to be true, not null/undefined
      isActive: true
    };

    console.log('🔍 [PUBLIC EVENTS DEBUG] Query:', query);

    const total = await Event.countDocuments(query);
    console.log('🔍 [PUBLIC EVENTS DEBUG] Total published events:', total);

    const events = await Event.find(query)
      .populate('organizer', 'name email')
      .sort({ date: 1 }) // Sort by date ascending (nearest first)
      .skip(skip)
      .limit(limit);

    console.log('🔍 [PUBLIC EVENTS DEBUG] Found events:', events.length);

    // Batch fetch invitation counts for all events
    const eventIds = events.map(e => e._id);
    let invitationStats = new Map();

    if (eventIds.length > 0) {
      try {
        const invitationCounts = await Invitation.aggregate([
          { $match: { event: { $in: eventIds } } },
          { $group: { _id: '$event', count: { $sum: 1 } } }
        ]);
        invitationCounts.forEach(stat => {
          invitationStats.set(stat._id.toString(), stat.count);
        });
      } catch (aggregateError) {
        console.error('Error batch fetching invitation counts:', aggregateError);
      }
    }

    // Calculate attendance statistics for public display
    const eventsWithStats = [];

    for (let event of events) {
      console.log(`🔍 [PUBLIC EVENTS DEBUG] Processing event "${event.title}":`, {
        id: event._id,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        currentStatus: event.status,
        statusMode: event.statusMode,
        published: event.published
      });

      // Auto-update status only if statusMode is 'auto'
      if (event.statusMode === 'auto') {
        const expectedStatus = calculateEventStatus(event);
        console.log(`🔍 [PUBLIC EVENTS DEBUG] Expected status for "${event.title}": ${expectedStatus}`);

        if (expectedStatus !== event.status) {
          console.log(`🔍 [PUBLIC EVENTS DEBUG] Updating "${event.title}" from ${event.status} to ${expectedStatus}`);
          event.status = expectedStatus;
          await event.save();
        }
      }

      // Only include upcoming or active events (not completed)
      const currentStatus = event.statusMode === 'auto'
        ? calculateEventStatus(event)
        : event.status;

      console.log(`🔍 [PUBLIC EVENTS DEBUG] Final status for "${event.title}": ${currentStatus}`);

      if (currentStatus === 'completed') {
        console.log(`🔍 [PUBLIC EVENTS DEBUG] Skipping completed event "${event.title}"`);
        continue; // Skip completed events
      }

      let eventData = event.toObject();
      eventData.status = currentStatus; // Ensure status is set correctly

      // Use pre-fetched invitation count
      eventData.totalParticipants = invitationStats.get(event._id.toString()) || 0;

      console.log(`🔍 [PUBLIC EVENTS DEBUG] Adding event "${event.title}" to results with status: ${eventData.status}`);
      eventsWithStats.push(eventData);
    }

    console.log('🔍 [PUBLIC EVENTS DEBUG] Final events to return:', eventsWithStats.map(e => ({
      title: e.title,
      status: e.status,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime
    })));

    res.json({
      success: true,
      data: {
        events: eventsWithStats,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalEvents: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get public events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get public events',
      error: error.message
    });
  }
});

// @route   GET /api/events/:id
// @desc    Get single event
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    // Update this specific event's status first
    await updateSingleEventStatus(req.params.id);
    
    let event = await Event.findById(req.params.id).populate('organizer', 'name email');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user has access to this event
    if (req.user.role === 'organizer' && event.organizer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // For participants, only allow access to published events
    if (req.user.role === 'participant' && !event.published) {
      console.log('🔒 [PUBLISHED FILTER] Participant tried to access unpublished event:', event._id);
      console.log('🔒 [PUBLISHED FILTER] Event published status:', event.published);
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Get attendance statistics if user is organizer
    let attendanceStats = null;
    if (req.user.role === 'organizer') {
      const totalInvitations = await Invitation.countDocuments({ event: event._id });
      const totalAttendees = await AttendanceLog.countDocuments({ event: event._id });
      const currentlyPresent = await AttendanceLog.countDocuments({ 
        event: event._id, 
        status: 'checked-in' 
      });

      attendanceStats = {
        totalInvitations,
        totalAttendees,
        currentlyPresent,
        attendanceRate: totalInvitations > 0 ? ((totalAttendees / totalInvitations) * 100).toFixed(2) : 0
      };
    }

    if (event && typeof event.location === 'string') {
      event.location = {
        address: event.location,
        coordinates: {
          type: 'Point',
          coordinates: [0, 0]
        }
      };
    }

    res.json({
      success: true,
      data: {
        event: {
          ...event.toObject(),
          geofence: {
            center: event.location.coordinates.coordinates,
            radius: event.geofenceRadius
          }
        },
        attendanceStats
      }
    });

    const expectedStatus = calculateEventStatus(event);
    if (expectedStatus !== event.status) {
      event.status = expectedStatus;
      await event.save(); // Save the update
    }

  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get event',
      error: error.message
    });
  }
});

// @route   PUT /api/events/:id
// @desc    Update event
// @access  Private (Organizer only - own events)
router.put('/:id', auth, requireOrganizer, [
  body('title').optional().trim().notEmpty().withMessage('Event title cannot be empty'),
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('startTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:mm format'),
  body('endTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:mm format'),
  body('location').optional().isObject().withMessage('Location must be an object'),
  body('location.address')
    .if(body('location').exists())
    .isString().notEmpty().withMessage('Address is required if location is sent'),
  body('location.coordinates.type')
    .optional()
    .equals('Point')
    .withMessage('Coordinates type must be Point'),
  body('location.coordinates.coordinates')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('Coordinates must be an array of [longitude, latitude]'),
  body('location.coordinates.coordinates[0]')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be valid'),
  body('location.coordinates.coordinates[1]')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be valid'),
  body('geofenceRadius')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Geofence radius must be between 1 and 1000'),
  body('description').optional().trim(),
  body('maxParticipants').optional().isInt({ min: 1 }).withMessage('Max participants must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const event = await Event.findOne({ _id: req.params.id, organizer: req.user._id });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    // Validate and update geofence
    if (req.body.location?.coordinates?.coordinates?.length === 2) {
      const [lng, lat] = req.body.location.coordinates.coordinates;

      if (typeof lng === 'number' && typeof lat === 'number') {
        event.location.coordinates = {
          type: 'Point',
          coordinates: [lng, lat] // [lng, lat] order for MongoDB GeoJSON
        };

        // 🔄 Update address via reverse geocoding
        try {
          const address = await reverseGeocode(lat, lng);
          event.location.address = address;
        } catch (err) {
          console.warn('⚠️ Failed to reverse geocode:', err.message);
        }
      } else {
        return res.status(400).json({ success: false, message: "Invalid coordinates format" });
      }
    }



    // ✅ Update all other fields if present
    [
      'title', 'date', 'geofenceRadius', 'description',
      'maxParticipants', 'eventCode', 'maxTimeOutside',
      'startTime', 'endTime'
    ].forEach(field => {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    });

    await event.save();

    console.log(`📝 Event "${event.title}" updated. Triggering force status update...`);
    // Force status update after saving changes (especially for date/time changes)
    await updateSingleEventStatus(event._id, true, event);

    // Fetch the event again to ensure we have the latest status after forced update
    const updatedEvent = await Event.findById(event._id).populate('organizer', 'name email');

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: {
        event: updatedEvent
      }
    });
  } catch (error) {
    console.error('Event update error:', error);
    res.status(500).json({
      success: false,
      message: 'Event update failed',
      error: error.message
    });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete event
// @access  Private (Organizer only - own events)
router.delete('/:id', auth, requireOrganizer, async (req, res) => {
  console.log('🔴 DELETE route hit - Event ID:', req.params.id);
  console.log('🔴 User ID:', req.user?._id);
  console.log('🔴 User role:', req.user?.role);
  
  try {
    const event = await Event.findOne({ _id: req.params.id, organizer: req.user._id });
    console.log('🔴 Found event:', event ? 'YES' : 'NO');
    
    if (event) {
      console.log('🔴 Event organizer:', event.organizer);
      console.log('🔴 Matches user:', event.organizer.toString() === req.user._id.toString());
    }

    if (!event) {
      console.log('🔴 Event not found or access denied');
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    console.log('🔴 Starting deletion process...');
    
    // Delete related invitations and attendance logs
    const deletedInvitations = await Invitation.deleteMany({ event: req.params.id });
    console.log('🔴 Deleted invitations:', deletedInvitations.deletedCount);
    
    const deletedAttendance = await AttendanceLog.deleteMany({ event: req.params.id });
    console.log('🔴 Deleted attendance logs:', deletedAttendance.deletedCount);
    
    const deletedEvent = await Event.findByIdAndDelete(req.params.id);
    console.log('🔴 Deleted event:', deletedEvent ? 'YES' : 'NO');

    console.log('🔴 Event deletion successful');
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('🔥 Event deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Event deletion failed',
      error: error.message
    });
  }
});

// @route   PATCH /api/events/:id/publish
// @desc    Toggle publish status of an event
// @access  Private (Organizer only - own events)
router.patch('/:id/publish', auth, requireOrganizer, async (req, res) => {
  const { published } = req.body;

  if (typeof published !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'Published field must be a boolean value',
    });
  }

  console.log(`[Publish Update] Setting published: "${published}" for event ID: ${req.params.id}`);

  try {
    // If trying to publish (set to true), check if registration form exists
    if (published) {
      const registrationForm = await RegistrationForm.findOne({
        event: req.params.id,
        isActive: true
      });

      if (!registrationForm) {
        console.log(`[Publish Update] ❌ No registration form found for event ${req.params.id}, returning error message`);
        return res.status(400).json({
          success: false,
          message: 'You cannot make the event public without creating a registration form first.',
        });
      }

      console.log(`[Publish Update] Registration form found for event ${req.params.id}, proceeding with publish`);
    }

    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user._id },
      { published },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied',
      });
    }

    res.json({
      success: true,
      message: `Event ${published ? 'published' : 'unpublished'} successfully`,
      data: { event },
    });
  } catch (error) {
    console.error('[Publish Update Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event publish status',
      error: error.message,
    });
  }
});

// @route   PATCH /api/events/:id/status
// @desc    Update status field of an event (used by frontend if time-based status is out-of-sync)
// @access  Private (Organizer only - own events)
router.patch('/:id/status', auth, requireOrganizer, async (req, res) => {
  const { status } = req.body;

  const validStatuses = ['upcoming', 'active', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value',
    });
  }

  console.log(`[Status Update] Incoming status: "${status}" for event ID: ${req.params.id}`);

  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user._id },
      { status },
      {
        new: true,
        runValidators: true, // ensures Mongoose applies enum validation
      }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied',
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: { event },
    });
  } catch (error) {
    console.error('[Status Update Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event status',
      error: error.message,
    });
  }
});


// @route   GET /api/events/code/:eventCode
// @desc    Find event by event code
// @access  Private
router.get('/code/:eventCode', auth, async (req, res) => {
  try {
    // Trigger immediate status update for all events before searching
    await updateAllEventStatuses();
    
    // Build query based on user role
    let query = {
      eventCode: req.params.eventCode.toUpperCase(),
      isActive: true
    };

    // Allow both public and private events to be found by code
    // Authorization is handled later in the join/check-in process
    // If someone has the event code, the organizer intentionally shared it
    console.log('🔓 [EVENT BY CODE] User accessing event by code:', req.params.eventCode);
    console.log('🔓 [EVENT BY CODE] User role:', req.user.role);

    const event = await Event.findOne(query).populate('organizer', 'name email');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found with that code'
      });
    }

    // Auto-update status if needed
    const expectedStatus = calculateEventStatus(event);
    if (expectedStatus !== event.status && event.statusMode === 'auto') {
      event.status = expectedStatus;
      await event.save();
    }

    res.json({
      success: true,
      data: {
        event
      }
    });
  } catch (error) {
    console.error('Find event by code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find event',
      error: error.message
    });
  }
});

router.get('/dev/fix-locations', async (req, res) => {
  await fixBrokenLocations();
  res.json({ success: true, message: 'Broken locations fixed' });
});

// @route   POST /api/events/update-statuses
// @desc    Manually trigger status updates for all events
// @access  Private
router.post('/update-statuses', auth, async (req, res) => {
  try {
    const updatedCount = await updateAllEventStatuses();
    res.json({
      success: true,
      message: `Updated ${updatedCount} event(s)`,
      updatedCount
    });
  } catch (error) {
    console.error('Manual status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event statuses',
      error: error.message
    });
  }
});

// @route   GET /api/events/debug/published-status
// @desc    Debug route to check published status of events
// @access  Private
router.get('/debug/published-status', auth, async (req, res) => {
  try {
    const events = await Event.find({}, 'title eventCode published isActive');

    const publishedTrue = events.filter(e => e.published === true);
    const publishedFalse = events.filter(e => e.published === false);
    const publishedNull = events.filter(e => e.published === null);
    const publishedUndefined = events.filter(e => e.published === undefined);

    console.log('🔍 [PUBLISHED DEBUG] Events published status:');
    console.log('- Published = true:', publishedTrue.length);
    console.log('- Published = false:', publishedFalse.length);
    console.log('- Published = null:', publishedNull.length);
    console.log('- Published = undefined:', publishedUndefined.length);

    res.json({
      success: true,
      data: {
        total: events.length,
        publishedTrue: publishedTrue.length,
        publishedFalse: publishedFalse.length,
        publishedNull: publishedNull.length,
        publishedUndefined: publishedUndefined.length,
        events: events.map(e => ({
          title: e.title,
          eventCode: e.eventCode,
          published: e.published,
          publishedType: typeof e.published,
          isActive: e.isActive
        }))
      }
    });
  } catch (error) {
    console.error('Debug published status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check published status',
      error: error.message
    });
  }
});

// @route   POST /api/events/:id/update-status
// @desc    Manually trigger status update for a specific event
// @access  Private
router.post('/:id/update-status', auth, async (req, res) => {
  try {
    const newStatus = await updateSingleEventStatus(req.params.id);
    if (newStatus === null) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    res.json({
      success: true,
      message: `Event status updated`,
      status: newStatus
    });
  } catch (error) {
    console.error('Single event status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event status',
      error: error.message
    });
  }
});

// Temporary location tracking endpoints while debugging Railway deployment
// @route   POST /api/events/location-tracking/initialize
// @desc    Initialize location tracking for a participant (temporary endpoint)
// @access  Private
router.post('/location-tracking/initialize', auth, async (req, res) => {
  try {
    const { eventId, participantId, attendanceLogId } = req.body;

    // Validate required fields
    if (!eventId || !participantId || !attendanceLogId) {
      console.error('❌ [LOCATION] Initialize missing fields:', { eventId: !!eventId, participantId: !!participantId, attendanceLogId: !!attendanceLogId });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: eventId, participantId, attendanceLogId'
      });
    }

    console.log('✅ [LOCATION] Tracking initialized for participant:', participantId.substring(0, 8) + '...');

    res.json({
      success: true,
      message: 'Location tracking initialized successfully',
      data: {
        eventId,
        participantId,
        attendanceLogId,
        status: 'initialized'
      }
    });
  } catch (error) {
    console.error('❌ [LOCATION] Initialize error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize location tracking',
      error: error.message
    });
  }
});

// @route   POST /api/events/location-tracking/update-location
// @desc    Update participant location (temporary endpoint)
// @access  Private
router.post('/location-tracking/update-location', auth, async (req, res) => {
  try {
    const { eventId, participantId, latitude, longitude, accuracy, batteryLevel } = req.body;

    // Validate required fields
    if (!eventId || !participantId || latitude === undefined || longitude === undefined) {
      console.error('❌ [LOCATION] Missing required fields:', { eventId, participantId, hasLat: latitude !== undefined, hasLng: longitude !== undefined });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: eventId, participantId, latitude, longitude'
      });
    }

    // Validate coordinates are not (0, 0) which indicates no GPS signal
    if (latitude === 0 && longitude === 0) {
      console.warn('⚠️ [LOCATION] Received (0,0) coordinates - GPS not available for participant:', participantId);
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS coordinates. Please ensure location services are enabled.'
      });
    }

    console.log('📍 [LOCATION] Received update:', {
      participantId: participantId.substring(0, 8) + '...',
      lat: latitude.toFixed(4),
      lng: longitude.toFixed(4),
      accuracy: accuracy || 'N/A',
      battery: batteryLevel || 'N/A'
    });

    // Store the location and battery data temporarily (in real implementation, this would save to database)
    const locationData = {
      eventId,
      participantId,
      latitude,
      longitude,
      accuracy: accuracy || 0,
      batteryLevel: batteryLevel || null,
      timestamp: new Date().toISOString()
    };

    // Store in temporary in-memory cache
    participantLocationData.set(participantId, locationData);

    // Also update the attendance log with battery data for persistence
    try {
      const AttendanceLog = require('../models/AttendanceLog');
      await AttendanceLog.findOneAndUpdate(
        {
          event: eventId,
          participant: participantId,
          $or: [
            { status: 'checked-in' },
            { status: 'registered', checkInTime: { $exists: true } }
          ]
        },
        {
          batteryLevel: batteryLevel,
          lastLocationUpdate: new Date().toISOString()
        }
      );
      if (batteryLevel && batteryLevel < 20) {
        console.warn(`🪫 [LOCATION] Low battery (${batteryLevel}%) for participant ${participantId.substring(0, 8)}...`);
      }
    } catch (updateError) {
      console.error('❌ [LOCATION] Failed to update attendance log:', updateError);
    }

    res.json({
      success: true,
      message: 'Location updated successfully (temporary endpoint)',
      data: locationData
    });

    console.log(`📍 [TEMP-LOCATION] Location updated for participant ${participantId}: ${latitude}, ${longitude}, battery: ${batteryLevel || 'N/A'}%`);
  } catch (error) {
    console.error('❌ [TEMP-LOCATION] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location',
      error: error.message
    });
  }
});

// @route   GET /api/events/:eventId/location-status
// @desc    Get location status for all participants in an event (temporary endpoint)
// @access  Private
router.get('/:eventId/location-status', auth, async (req, res) => {

  try {
    const { eventId } = req.params;

    // Get location data from temporary store and combine with attendance data
    const AttendanceLog = require('../models/AttendanceLog');
    const User = require('../models/User');
    const Event = require('../models/Event');

    // Get event details for center coordinates and geofence radius
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const eventCenter = {
      latitude: event.location.coordinates.coordinates[1], // latitude
      longitude: event.location.coordinates.coordinates[0], // longitude
    };
    const geofenceRadius = event.geofenceRadius || 100; // meters

    console.log(`📍 [TEMP-LOCATION] Event center: ${eventCenter.latitude}, ${eventCenter.longitude}, radius: ${geofenceRadius}m`);

    // Haversine formula to calculate distance between two points
    function calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371e3; // Earth's radius in meters
      const φ1 = lat1 * Math.PI/180; // φ, λ in radians
      const φ2 = lat2 * Math.PI/180;
      const Δφ = (lat2-lat1) * Math.PI/180;
      const Δλ = (lon2-lon1) * Math.PI/180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      const distance = R * c; // in meters
      return Math.round(distance);
    }

    // Fetch participants who are currently checked in to this event or have checked in recently
    const attendanceLogs = await AttendanceLog.find({
      event: eventId,
      $or: [
        { status: 'checked-in' },
        {
          status: 'registered',
          checkInTime: { $exists: true } // Has checked in at some point
        }
      ]
    }).populate('participant', 'name email');

    console.log(`📊 [TEMP-LOCATION] Found ${attendanceLogs.length} checked-in participants for event ${eventId}`);
    console.log('📊 [TEMP-LOCATION] In-memory location data count:', participantLocationData.size);
    console.log('📊 [TEMP-LOCATION] Stored participant IDs:', Array.from(participantLocationData.keys()));

    const mockLocationStatuses = attendanceLogs.map(log => {
      const participantId = log.participant._id.toString();
      const locationData = participantLocationData.get(participantId);

      console.log(`👤 [TEMP-LOCATION] Processing participant ${log.participant.name} (${participantId}):`, {
        hasLocationData: !!locationData,
        locationData: locationData ? {
          lat: locationData.latitude,
          lng: locationData.longitude,
          battery: locationData.batteryLevel,
          timestamp: locationData.timestamp
        } : null
      });

      // Check if location data is stale (older than 1 minute for testing)
      const hasLocationData = !!locationData;
      const now = new Date();
      const checkInTime = new Date(log.checkInTime);

      let isLocationDataStale = false;
      if (hasLocationData) {
        const locationTimestamp = new Date(locationData.timestamp);
        const timeSinceLastLocation = Math.floor((now - locationTimestamp) / 1000);
        isLocationDataStale = timeSinceLastLocation > 60; // 1 minute for more aggressive detection

        console.log(`📍 [TEMP-LOCATION] STALE CHECK for ${log.participant.name}:`);
        console.log(`📍 [TEMP-LOCATION] - Server time: ${now.toISOString()}`);
        console.log(`📍 [TEMP-LOCATION] - Location timestamp: ${locationTimestamp.toISOString()}`);
        console.log(`📍 [TEMP-LOCATION] - Seconds since location: ${timeSinceLastLocation}`);
        console.log(`📍 [TEMP-LOCATION] - Is stale (>60s): ${isLocationDataStale}`);
        console.log(`📍 [TEMP-LOCATION] - Has location data: ${hasLocationData}`);
      } else {
        console.log(`📍 [TEMP-LOCATION] No location data found for ${log.participant.name}`);
      }

      // Calculate time since check-in or since last location update
      const timeSinceCheckIn = Math.floor((now - checkInTime) / 1000);
      const timeSinceLastUpdate = hasLocationData ?
        Math.floor((now - new Date(locationData.timestamp)) / 1000) :
        timeSinceCheckIn;

      // Calculate actual distance from event center
      let distanceFromCenter = 999; // Default high distance for no location data
      let isWithinGeofence = false;

      if (hasLocationData && locationData.latitude && locationData.longitude) {
        distanceFromCenter = calculateDistance(
          eventCenter.latitude,
          eventCenter.longitude,
          locationData.latitude,
          locationData.longitude
        );
        isWithinGeofence = distanceFromCenter <= geofenceRadius;

        console.log(`📏 [TEMP-LOCATION] Distance calculation for ${log.participant.name}:`);
        console.log(`📏 [TEMP-LOCATION] - Participant: ${locationData.latitude}, ${locationData.longitude}`);
        console.log(`📏 [TEMP-LOCATION] - Event center: ${eventCenter.latitude}, ${eventCenter.longitude}`);
        console.log(`📏 [TEMP-LOCATION] - Distance: ${distanceFromCenter}m`);
        console.log(`📏 [TEMP-LOCATION] - Geofence radius: ${geofenceRadius}m`);
        console.log(`📏 [TEMP-LOCATION] - Comparison: ${distanceFromCenter} <= ${geofenceRadius} = ${distanceFromCenter <= geofenceRadius}`);
        console.log(`📏 [TEMP-LOCATION] - Within geofence: ${isWithinGeofence}`);
      }

      // Determine status based on location data availability, freshness, and geofence
      let participantStatus = 'inside';
      let timerActive = false;
      let timeOutside = 0;
      let outsideTimerStart = null;

      if (!hasLocationData || isLocationDataStale || !isWithinGeofence) {
        // Start timer if: no data, stale data, or outside geofence
        const timeToUse = isLocationDataStale ? timeSinceLastUpdate : timeSinceCheckIn;

        if (!hasLocationData || isLocationDataStale) {
          // No data or stale data
          participantStatus = timeToUse > 60 ? 'warning' : 'outside';
          timeOutside = timeToUse;
          outsideTimerStart = isLocationDataStale ? locationData.timestamp : log.checkInTime;
        } else {
          // Outside geofence with fresh data
          participantStatus = 'outside';
          timeOutside = 0; // Just left geofence
          outsideTimerStart = new Date().toISOString();
        }

        timerActive = true;
        isWithinGeofence = false;

        console.log(`⏰ [TEMP-LOCATION] TIMER ACTIVATED for ${log.participant.name}:`);
        console.log(`⏰ [TEMP-LOCATION] - Time to use: ${timeToUse}s`);
        console.log(`⏰ [TEMP-LOCATION] - Status: ${participantStatus}`);
        console.log(`⏰ [TEMP-LOCATION] - Timer active: ${timerActive}`);
        console.log(`⏰ [TEMP-LOCATION] - Distance: ${distanceFromCenter}m`);
        console.log(`⏰ [TEMP-LOCATION] - Within geofence: ${isWithinGeofence}`);
        console.log(`⏰ [TEMP-LOCATION] - Reason: ${!hasLocationData ? 'no location data' : isLocationDataStale ? 'stale location data' : 'outside geofence'}`);
      } else {
        console.log(`✅ [TEMP-LOCATION] Location data is fresh and within geofence for ${log.participant.name}`);
      }

      return {
        _id: log._id,
        event: eventId,
        participant: {
          _id: log.participant._id,
          name: log.participant.name,
          email: log.participant.email
        },
        currentLocation: hasLocationData ? {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          timestamp: locationData.timestamp
        } : null,
        isWithinGeofence: isWithinGeofence,
        distanceFromCenter: distanceFromCenter,
        outsideTimer: {
          isActive: timerActive,
          startTime: outsideTimerStart,
          totalTimeOutside: timeOutside,
          currentSessionStart: outsideTimerStart
        },
        status: participantStatus,
        alertsSent: [],
        lastLocationUpdate: locationData?.timestamp || log.checkInTime,
        currentTimeOutside: timeOutside,
        batteryLevel: locationData?.batteryLevel || null
      };
    });

    const summary = {
      totalParticipants: mockLocationStatuses.length,
      insideGeofence: mockLocationStatuses.filter(s => s.isWithinGeofence).length,
      outsideGeofence: mockLocationStatuses.filter(s => !s.isWithinGeofence).length,
      warningStatus: mockLocationStatuses.filter(s => s.status === 'warning').length,
      exceededLimit: mockLocationStatuses.filter(s => s.status === 'exceeded_limit').length
    };

    res.json({
      success: true,
      data: {
        participants: mockLocationStatuses,
        summary
      }
    });

    console.log(`✅ [TEMP-LOCATION] Location status returned for ${mockLocationStatuses.length} participants`);
    console.log('📊 [TEMP-LOCATION] Sample participant data:', mockLocationStatuses.length > 0 ? {
      participant: mockLocationStatuses[0].participant.name,
      location: mockLocationStatuses[0].currentLocation,
      battery: mockLocationStatuses[0].batteryLevel,
      hasLocationData: !!participantLocationData.get(mockLocationStatuses[0].participant._id.toString())
    } : 'No participants');
  } catch (error) {
    console.error('❌ [TEMP-LOCATION] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get location status',
      error: error.message
    });
  }
});

// @route   POST /api/events/location-tracking/acknowledge-alert
// @desc    Acknowledge an alert (temporary endpoint)
// @access  Private
router.post('/location-tracking/acknowledge-alert', auth, async (req, res) => {
  console.log('🔔 [TEMP-LOCATION] Acknowledge alert endpoint hit:', req.body);

  try {
    const { statusId, alertId } = req.body;

    // Validate required fields
    if (!statusId || !alertId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: statusId, alertId'
      });
    }

    // For now, just return success to test the endpoint
    res.json({
      success: true,
      message: 'Alert acknowledged successfully (temporary endpoint)',
      data: {
        statusId,
        alertId,
        acknowledgedAt: new Date().toISOString()
      }
    });

    console.log(`✅ [TEMP-LOCATION] Alert ${alertId} acknowledged for status ${statusId}`);
  } catch (error) {
    console.error('❌ [TEMP-LOCATION] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error.message
    });
  }
});

// @route   GET /api/events/location-tracking/participant/:participantId/event/:eventId/status
// @desc    Get location status for a specific participant (temporary endpoint)
// @access  Private
router.get('/location-tracking/participant/:participantId/event/:eventId/status', auth, async (req, res) => {
  console.log('👤 [TEMP-LOCATION] Participant status endpoint hit:', req.params);

  try {
    const { participantId, eventId } = req.params;

    // Get location data from temporary store
    const locationData = participantLocationData.get(participantId);

    if (!locationData || locationData.eventId !== eventId) {
      return res.status(404).json({
        success: false,
        message: 'Location status not found for this participant in this event'
      });
    }

    // Return participant's current location status
    const participantStatus = {
      _id: `status_${participantId}_${eventId}`,
      event: eventId,
      participant: participantId,
      currentLocation: {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracy: locationData.accuracy,
        timestamp: locationData.timestamp
      },
      isWithinGeofence: true, // Mock value for now
      distanceFromCenter: 15, // Mock value for now
      outsideTimer: {
        isActive: false,
        totalTimeOutside: 0
      },
      status: 'inside',
      alertsSent: [],
      lastLocationUpdate: locationData.timestamp,
      currentTimeOutside: 0,
      batteryLevel: locationData.batteryLevel
    };

    res.json({
      success: true,
      data: participantStatus
    });

    console.log(`✅ [TEMP-LOCATION] Participant status returned for ${participantId}`);
  } catch (error) {
    console.error('❌ [TEMP-LOCATION] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get participant status',
      error: error.message
    });
  }
});

// @route   GET /api/events/geocode/search
// @desc    Forward geocode search (address to coordinates)
// @access  Public
router.get('/geocode/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const axios = require('axios');
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'EventConnect/1.0'
      },
      timeout: 10000 // 10 second timeout
    });

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search location',
      error: error.message
    });
  }
});

// @route   POST /api/events/reset-timers/:eventId
// @desc    Reset all location timers for an event (admin/organizer only)
// @access  Private (Organizer only)
router.post('/reset-timers/:eventId', auth, requireOrganizer, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify event belongs to organizer
    const event = await Event.findOne({ _id: eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');

    // Reset all timers for this event
    const result = await ParticipantLocationStatus.updateMany(
      { event: eventId },
      {
        $set: {
          'outsideTimer.isActive': false,
          'outsideTimer.startTime': null,
          'outsideTimer.totalTimeOutside': 0,
          'outsideTimer.currentSessionStart': null,
          status: 'inside',
          isWithinGeofence: true
        }
      }
    );

    console.log(`✅ Reset ${result.modifiedCount} location timers for event ${eventId}`);

    res.json({
      success: true,
      message: `Successfully reset ${result.modifiedCount} location timer(s)`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Reset timers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset timers',
      error: error.message
    });
  }
});

module.exports = router;
module.exports.participantLocationData = participantLocationData;

