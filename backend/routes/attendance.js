
const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const Invitation = require('../models/Invitation');
const AttendanceLog = require('../models/AttendanceLog');
const RegistrationForm = require('../models/RegistrationForm');
const RegistrationResponse = require('../models/RegistrationResponse');
const { auth, requireOrganizer } = require('../middleware/auth');
const { updateSingleEventStatus } = require('../utils/updateEventStatuses');
const { fromZonedTime } = require('date-fns-tz');

const router = express.Router();

// @route   POST /api/attendance/checkin
// @desc    Check in using QR code
// @access  Public (but requires valid QR data)
router.post('/checkin', [
  body('qrData').notEmpty().withMessage('QR data is required'),
  body('location.latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('location.longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
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

    const { qrData, location } = req.body;

    // Parse QR data
    let qrInfo;
    try {
      qrInfo = JSON.parse(qrData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    const { invitationId, eventId, participantId, code } = qrInfo;

    // Validate invitation
    const invitation = await Invitation.findById(invitationId)
      .populate('event')
      .populate('participant');

    // Update event status if invitation found
    if (invitation && invitation.event) {
      await updateSingleEventStatus(invitation.event._id);
    }

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invitation'
      });
    }

    // Check if invitation matches QR data
    if (invitation.event._id.toString() !== eventId || 
        invitation.participant._id.toString() !== participantId ||
        invitation.invitationCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code data'
      });
    }

    // Check if invitation is accepted
    if (invitation.status !== 'accepted' && invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Invitation must be accepted to check in'
      });
    }

    // Check if invitation is expired
    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Invitation has expired'
      });
    }

    // Check if invitation is already used
    if (invitation.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'QR code has already been used'
      });
    }

    // Check if check-in is within allowed time window
    const event = invitation.event;
    const now = new Date();

    if (event.startTime && event.date) {
      // Parse event start time in Singapore timezone using date-fns-tz
      const eventDateStr = typeof event.date === 'string'
        ? event.date.split('T')[0]
        : event.date.toISOString().split('T')[0];
      const startDateTimeStr = `${eventDateStr}T${event.startTime}:00`;

      // Convert Singapore time to UTC
      const eventStartUTC = fromZonedTime(startDateTimeStr, 'Asia/Singapore');

      // Allow check-in from 2 hours before event start up to 24 hours after
      const twoHoursBefore = new Date(eventStartUTC.getTime() - (2 * 60 * 60 * 1000));
      const twentyFourHoursAfter = new Date(eventStartUTC.getTime() + (24 * 60 * 60 * 1000));

      if (now < twoHoursBefore || now > twentyFourHoursAfter) {
        return res.status(400).json({
          success: false,
          message: 'Check-in is only allowed from 2 hours before event start to 24 hours after event start'
        });
      }
    } else {
      // Fallback: If no startTime, use simple date check (allow same day)
      const eventDate = new Date(event.date);
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const daysDiff = Math.floor((nowDateOnly - eventDateOnly) / (1000 * 60 * 60 * 24));

      if (Math.abs(daysDiff) > 1) {
        return res.status(400).json({
          success: false,
          message: 'Check-in is only allowed on the event day'
        });
      }
    }

    // Check if already checked in
    const existingAttendance = await AttendanceLog.findOne({
      event: eventId,
      participant: participantId
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Participant has already checked in'
      });
    }

    // Create attendance log
    const attendanceLog = await AttendanceLog.create({
      event: eventId,
      participant: participantId,
      invitation: invitationId,
      checkInTime: new Date(),
      checkInLocation: location || null,
      status: 'checked-in'
    });

    // Reset location tracking timer for this participant/event
    const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');
    try {
      await ParticipantLocationStatus.findOneAndUpdate(
        { event: eventId, participant: participantId },
        {
          $set: {
            'outsideTimer.isActive': false,
            'outsideTimer.startTime': null,
            'outsideTimer.totalTimeOutside': 0,
            'outsideTimer.currentSessionStart': null,
            status: 'inside',
            isWithinGeofence: true
          }
        },
        { upsert: false }
      );
      console.log('✅ Reset location timer for participant on check-in');
    } catch (resetError) {
      console.error('⚠️ Failed to reset location timer:', resetError);
      // Don't fail the check-in if timer reset fails
    }

    // Mark invitation as used
    invitation.isUsed = true;
    invitation.usedAt = new Date();
    if (invitation.status === 'pending') {
      invitation.status = 'accepted';
      invitation.respondedAt = new Date();
    }
    await invitation.save();

    await attendanceLog.populate(['event', 'participant', 'invitation']);

    res.json({
      success: true,
      message: 'Check-in successful',
      data: {
        attendanceLog,
        participant: invitation.participant,
        event: invitation.event
      }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Check-in failed',
      error: error.message
    });
  }
});

// @route   PUT /api/attendance/:id/checkout
// @desc    Check out participant
// @access  Private (Participant can check themselves out, Organizer can check out anyone)
router.put('/:id/checkout', auth, [
  body('location.latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('location.longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('notes').optional().trim()
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

    const { location, notes } = req.body;

    let attendanceLog = await AttendanceLog.findById(req.params.id);

    if (!attendanceLog) {
      return res.status(404).json({
        success: false,
        message: 'Attendance log not found'
      });
    }

    // Check permissions
    if (req.user.role === 'participant' && 
        attendanceLog.participant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'organizer') {
      const event = await Event.findById(attendanceLog.event);
      if (event.organizer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Check if already checked out
    if (attendanceLog.status === 'checked-out') {
      return res.status(400).json({
        success: false,
        message: 'Participant has already checked out'
      });
    }

    // Update attendance log
    attendanceLog.checkOutTime = new Date();
    attendanceLog.checkOutLocation = location || null;
    attendanceLog.notes = notes || attendanceLog.notes;
    await attendanceLog.save();

    await attendanceLog.populate(['event', 'participant', 'invitation']);

    res.json({
      success: true,
      message: 'Check-out successful',
      data: {
        attendanceLog
      }
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      message: 'Check-out failed',
      error: error.message
    });
  }
});

// @route   GET /api/attendance/event/:eventId
// @desc    Get attendance for an event
// @access  Private (Organizer only)
router.get('/event/:eventId', auth, requireOrganizer, async (req, res) => {
  try {
    // Check if event belongs to organizer
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    // Check for stale location data and mark participants absent if needed
    const locationTrackingService = require('../services/locationTrackingService');
    try {
      await locationTrackingService.checkStaleParticipantsForEvent(req.params.eventId);
    } catch (err) {
      console.error('Error checking stale participants:', err);
      // Continue even if stale check fails
    }

    const attendanceLogs = await AttendanceLog.find({ event: req.params.eventId })
      .populate('participant', 'name email')
      .populate('invitation', 'invitationCode')
      .sort({ checkInTime: -1 });

    console.log(`Found ${attendanceLogs.length} attendance logs for event ${req.params.eventId}`);

    // Fetch registration responses for all participants to get their submitted name/email
    const participantIds = attendanceLogs.map(log => log.participant._id);
    const registrationResponses = await RegistrationResponse.find({
      event: req.params.eventId,
      participant: { $in: participantIds }
    }).populate('registrationForm');

    // Create a map of participant ID to registration response
    const responseMap = new Map();
    registrationResponses.forEach(response => {
      responseMap.set(response.participant.toString(), response);
    });

    // Enrich attendance logs with registration response data (name, email)
    const enrichedLogs = attendanceLogs.map(log => {
      const logObj = log.toObject();
      const response = responseMap.get(log.participant._id.toString());

      if (response && response.responses) {
        // Extract name and email from registration responses
        // Common field names for name and email
        const nameField = ['name', 'fullName', 'full_name', 'participantName', 'Name', 'Full Name'].find(
          field => response.responses.has(field)
        );
        const emailField = ['email', 'Email', 'emailAddress', 'email_address', 'Email Address'].find(
          field => response.responses.has(field)
        );

        // Use registration response data if available, otherwise fall back to user data
        logObj.participant.name = response.responses.get(nameField) || logObj.participant.name;
        logObj.participant.email = response.responses.get(emailField) || logObj.participant.email;
      }

      return logObj;
    });

    if (enrichedLogs.length > 0) {
      console.log('First enriched attendance log:', JSON.stringify(enrichedLogs[0], null, 2));
    }

    // Battery data and lastLocationUpdate are now stored directly in attendance logs
    console.log('📊 [ATTENDANCE] Processing attendance logs with stored battery data');

    // Calculate late check-ins (more than 15 minutes after event start)
    let totalLate = 0;
    if (event.startTime && event.date) {
      try {
        // Parse event start time in Singapore timezone
        const eventDateStr = typeof event.date === 'string'
          ? event.date.split('T')[0]
          : event.date.toISOString().split('T')[0];
        const startDateTimeStr = `${eventDateStr}T${event.startTime}:00`;

        // Convert Singapore time to UTC
        const eventStartUTC = fromZonedTime(startDateTimeStr, 'Asia/Singapore');
        const lateThreshold = new Date(eventStartUTC.getTime() + (15 * 60 * 1000)); // 15 minutes after start

        // Count participants who checked in after the late threshold
        totalLate = enrichedLogs.filter(log => {
          if (!log.checkInTime) return false;
          return new Date(log.checkInTime) > lateThreshold;
        }).length;

        console.log(`📊 [LATE CHECK-IN] Event start: ${eventStartUTC.toISOString()}, Late threshold: ${lateThreshold.toISOString()}, Total late: ${totalLate}`);
      } catch (err) {
        console.error('Error calculating late check-ins:', err);
      }
    }

    // Get summary statistics
    const stats = {
      totalCheckedIn: enrichedLogs.length,
      currentlyPresent: enrichedLogs.filter(log => log.status === 'checked-in').length,
      totalCheckedOut: totalLate, // Use totalLate instead of checked-out count
      totalAbsent: enrichedLogs.filter(log => log.status === 'absent').length,
      averageDuration: enrichedLogs
        .filter(log => log.duration > 0)
        .reduce((sum, log) => sum + log.duration, 0) /
        enrichedLogs.filter(log => log.duration > 0).length || 0
    };

    res.json({
      success: true,
      data: {
        attendanceLogs: enrichedLogs,
        stats,
        event: {
          _id: event._id,
          title: event.title,
          description: event.description,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          venue: event.venue,
          status: event.status
        }
      }
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get attendance data',
      error: error.message
    });
  }
});

// @route   GET /api/attendance/my
// @desc    Get participant's attendance history
// @access  Private (Participant only)
router.get('/my', auth, async (req, res) => {
  try {
    console.log('🔍 [ATTENDANCE MY DEBUG] User requesting attendance:', req.user._id);

    // First update all event statuses to ensure we return current data
    const { updateAllEventStatuses } = require('../utils/updateEventStatuses');
    await updateAllEventStatuses();

    const attendanceLogs = await AttendanceLog.find({
      participant: req.user._id,
      hiddenFromParticipant: { $ne: true }
    })
      .populate({
        path: 'event',
        select: 'title date location eventCode organizer description status startTime endTime published',
        match: { published: { $eq: true } }, // Only populate published events (explicitly true, not null/undefined)
        populate: {
          path: 'organizer',
          select: 'name email'
        }
      })
      .populate('invitation', 'invitationCode')
      .sort({ checkInTime: -1 });

    // Filter out attendance logs where event didn't populate (unpublished events)
    const filteredAttendanceLogs = attendanceLogs.filter(log => log.event !== null);

    console.log('🔍 [ATTENDANCE MY DEBUG] Total attendance records:', attendanceLogs.length);
    console.log('🔍 [ATTENDANCE MY DEBUG] Filtered (published events only):', filteredAttendanceLogs.length);

    // Debug which events were filtered out
    const filteredOutLogs = attendanceLogs.filter(log => log.event === null);
    if (filteredOutLogs.length > 0) {
      console.log('🔒 [PUBLISHED FILTER] Filtered out', filteredOutLogs.length, 'attendance records for unpublished events');
      filteredOutLogs.forEach((log, index) => {
        console.log(`🔒 [PUBLISHED FILTER] Filtered attendance ${index + 1}:`, {
          attendanceId: log._id,
          eventId: log.event,
          reason: 'Event not published or null'
        });
      });
    }

    console.log('🔍 [ATTENDANCE MY DEBUG] Found', filteredAttendanceLogs.length, 'published attendance records');

    // Debug each record - focus on the new one
    filteredAttendanceLogs.forEach((log, index) => {
      if (index < 5) { // Only show first 5 records
        console.log(`🔍 [ATTENDANCE MY DEBUG] Record ${index + 1}:`, {
          eventTitle: log.event?.title,
          eventStatus: log.event?.status,
          eventPublished: log.event?.published,
          checkInTime: log.checkInTime ? 'HAS_CHECK_IN' : 'NO_CHECK_IN',
          checkOutTime: log.checkOutTime ? 'HAS_CHECK_OUT' : 'NO_CHECK_OUT',
          attendanceStatus: log.status,
          qualifiesForCurrentlyAttending: !!(log.checkInTime && !log.checkOutTime && log.event?.status === 'active')
        });
      }
    });

    // Filter for currently attending (only from published events)
    const currentlyAttending = filteredAttendanceLogs.filter(log =>
      log.checkInTime &&
      !log.checkOutTime &&
      log.event?.status === 'active'
    );

    console.log('🔍 [ATTENDANCE MY DEBUG] Currently attending count:', currentlyAttending.length);

    res.json({
      success: true,
      data: {
        attendanceLogs: filteredAttendanceLogs
      }
    });
  } catch (error) {
    console.error('Get my attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get attendance history',
      error: error.message
    });
  }
});

// @route   GET /api/attendance/scan-history
// @desc    Get participant's scan history for UI
// @access  Private (Participant only)
router.get('/scan-history', auth, async (req, res) => {
  try {
    const attendanceLogs = await AttendanceLog.find({ participant: req.user._id })
      .populate({
        path: 'event',
        select: 'title date location eventCode published',
        match: { published: { $eq: true } } // Only populate published events (explicitly true, not null/undefined)
      })
      .populate('invitation', 'invitationCode')
      .sort({ checkInTime: -1 })
      .limit(50); // Limit to last 50 scans

    // Filter out attendance logs where event didn't populate (unpublished events)
    const filteredAttendanceLogs = attendanceLogs.filter(log => log.event !== null);

    // Transform data to match frontend scan history format (only published events)
    const scanHistory = filteredAttendanceLogs.map((log, index) => ({
      id: log._id.toString(),
      eventTitle: log.event.title,
      eventCode: log.event.eventCode || log.invitation?.invitationCode || 'N/A',
      type: 'Event Check-in',
      time: new Date(log.checkInTime).toLocaleString('en-US', { 
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      status: log.checkOutTime ? 'completed' : 'success',
      checkInTime: log.checkInTime,
      checkOutTime: log.checkOutTime,
      duration: log.duration,
      location: log.checkInLocation
    }));

    res.json({
      success: true,
      data: {
        scanHistory,
        total: scanHistory.length
      }
    });
  } catch (error) {
    console.error('Get scan history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scan history',
      error: error.message
    });
  }
});

// @route   POST /api/attendance/auto-checkout-ended-events
// @desc    Automatically checkout participants from events that have ended
// @access  Private (Any authenticated user can trigger this)
router.post('/auto-checkout-ended-events', auth, async (req, res) => {
  try {
    const now = new Date();
    console.log('============================================');
    console.log('[AUTO-CHECKOUT] VERSION: 2.0 (with date-fns-tz fix)');
    console.log('[AUTO-CHECKOUT] Called at:', now.toISOString());
    console.log('[AUTO-CHECKOUT] Called by user:', req.user.email);
    console.log('============================================');

    // Find all events that have ended (simplified approach)
    const allEvents = await Event.find({
      date: { $exists: true },
      endTime: { $exists: true }
    });

    // Filter events that have ended using proper timezone conversion
    const endedEvents = allEvents.filter(event => {
      try {
        // Parse event date (format: YYYY-MM-DD or ISO string)
        const eventDateStr = typeof event.date === 'string'
          ? event.date.split('T')[0]
          : event.date.toISOString().split('T')[0];

        // Combine date and end time in Singapore timezone
        const endDateTimeStr = `${eventDateStr}T${event.endTime}:00`;

        // Convert Singapore time to UTC
        const eventEndUTC = fromZonedTime(endDateTimeStr, 'Asia/Singapore');

        const hasEnded = now > eventEndUTC;
        const minutesRemaining = Math.floor((eventEndUTC - now) / 60000);
        console.log(`[AUTO-CHECKOUT] Event "${event.title}":`, {
          endTime: event.endTime,
          endUTC: eventEndUTC.toISOString(),
          nowUTC: now.toISOString(),
          hasEnded: hasEnded,
          minutesRemaining: minutesRemaining
        });

        return hasEnded;
      } catch (error) {
        console.error(`Error parsing event end time for ${event.title}:`, error);
        return false; // Don't auto-checkout if we can't parse the time
      }
    });

    console.log(`[AUTO-CHECKOUT] Found ${endedEvents.length} ended events out of ${allEvents.length} total events`);
    if (endedEvents.length > 0) {
      console.log('[AUTO-CHECKOUT] Ended events:', endedEvents.map(e => e.title).join(', '));
    }

    let totalCheckedOut = 0;
    const results = [];

    // Batch update all attendances for ended events
    for (const event of endedEvents) {
      try {
        // Use updateMany to batch update all checked-in participants
        const updateResult = await AttendanceLog.updateMany(
          {
            event: event._id,
            status: 'checked-in',
            checkOutTime: { $exists: false }
          },
          {
            $set: {
              checkOutTime: now,
              status: 'checked-out'
            },
            $push: {
              notes: { $each: [' [Auto-checkout: Event ended]'] }
            }
          }
        );

        const eventCheckedOut = updateResult.modifiedCount;
        totalCheckedOut += eventCheckedOut;

        console.log(`Event ${event.title}: ${eventCheckedOut} participants auto-checked out`);

        results.push({
          eventId: event._id,
          eventTitle: event.title,
          eventEndTime: event.endTime,
          participantsCheckedOut: eventCheckedOut
        });

      } catch (eventError) {
        console.error(`Error processing event ${event.title}:`, eventError);
        results.push({
          eventId: event._id,
          eventTitle: event.title,
          error: eventError.message,
          participantsCheckedOut: 0
        });
      }
    }

    res.json({
      success: true,
      message: `Auto-checkout completed. ${totalCheckedOut} participants checked out from ${endedEvents.length} ended event(s).`,
      data: {
        totalEventsProcessed: endedEvents.length,
        totalParticipantsCheckedOut: totalCheckedOut,
        results
      }
    });

  } catch (error) {
    console.error('Auto-checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'Auto-checkout failed',
      error: error.message
    });
  }
});

// @route   POST /api/attendance/join
// @desc    Join an event by event code
// @access  Private
router.post('/join', auth, [
  body('eventCode').notEmpty().withMessage('Event code is required')
], async (req, res) => {
  try {
    console.log('=== JOIN EVENT REQUEST ===');
    console.log('User ID:', req.user?._id);
    console.log('User role:', req.user?.role);
    console.log('Request body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { eventCode } = req.body;
    const userId = req.user._id;

    console.log('Looking for event with code:', eventCode.toUpperCase());
    
    // Find the event by event code
    const event = await Event.findOne({ 
      eventCode: eventCode.toUpperCase(),
      isActive: true,
      published: true 
    });

    // Update event status if found
    if (event) {
      await updateSingleEventStatus(event._id);
    }

    console.log('Event found:', !!event);
    if (event) {
      console.log('Event details:', {
        id: event._id,
        title: event.title,
        published: event.published,
        isActive: event.isActive
      });
    }

    if (!event) {
      console.log('Event not found or not available');
      return res.status(404).json({
        success: false,
        message: 'Event not found or not available for joining'
      });
    }

    // Check if user already has an attendance record for this event
    const existingAttendance = await AttendanceLog.findOne({
      event: event._id,
      participant: userId
    });

    console.log('Existing attendance found:', !!existingAttendance);

    if (existingAttendance) {
      console.log('User already joined this event');
      return res.status(400).json({
        success: false,
        message: 'You have already joined this event'
      });
    }

    // Check if event has a registration form that needs to be filled
    const registrationForm = await RegistrationForm.findOne({
      event: event._id,
      isActive: true
    });

    if (registrationForm) {
      // Check if participant has already submitted registration
      const existingResponse = await RegistrationResponse.findOne({
        registrationForm: registrationForm._id,
        participant: userId
      });

      if (!existingResponse) {
        console.log('Registration form required but not submitted');
        return res.status(400).json({
          success: false,
          message: 'Registration form must be completed before joining this event',
          requiresRegistration: true,
          registrationForm: {
            _id: registrationForm._id,
            title: registrationForm.title,
            description: registrationForm.description,
            fields: registrationForm.fields
          }
        });
      }

      console.log('Registration form completed, proceeding with attendance record');
    }

    console.log('Creating direct attendance record...');
    console.log('User details:', {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name
    });

    // Create attendance record directly (no invitation needed for public events)
    try {
      const attendanceRecord = new AttendanceLog({
        event: event._id,
        participant: userId,
        status: event.status === 'active' ? 'checked-in' : 'registered', // Auto check-in for active events
        // For active events, automatically check them in so they appear in "Currently Attending"
        checkInTime: event.status === 'active' ? new Date() : undefined
        // invitation will be null/undefined (optional field)
      });

      await attendanceRecord.save();
      console.log('Attendance record created successfully:', attendanceRecord._id);
      console.log('Auto-checked in for active event:', event.status === 'active');

      // Return success response
      res.json({
        success: true,
        message: 'Successfully joined the event',
        data: {
          attendanceRecord: attendanceRecord,
          event: {
            _id: event._id,
            title: event.title,
            eventCode: event.eventCode,
            date: event.date,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location
          }
        }
      });

    } catch (attendanceError) {
      console.error('Error creating attendance record:', attendanceError);

      // Check if it's a duplicate key error (user already joined)
      if (attendanceError.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'You have already joined this event'
        });
      }

      throw attendanceError; // Re-throw other errors to be caught by outer catch
    }

  } catch (error) {
    console.error('Join event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join event',
      error: error.message
    });
  }
});

// @route   DELETE /api/attendance/leave
// @desc    Leave/cancel an event by event code
// @access  Private
router.delete('/leave', auth, [
  body('eventCode').notEmpty().withMessage('Event code is required')
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

    const { eventCode } = req.body;
    const userId = req.user._id;

    console.log('=== LEAVE EVENT REQUEST ===');
    console.log('User ID:', userId);
    console.log('Event Code:', eventCode);

    // Find the event by event code
    const event = await Event.findOne({
      eventCode: eventCode.toUpperCase(),
      isActive: true,
      published: true
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or not available'
      });
    }

    // Find the user's attendance record for this event
    const attendanceRecord = await AttendanceLog.findOne({
      event: event._id,
      participant: userId
    });

    if (!attendanceRecord) {
      return res.status(404).json({
        success: false,
        message: 'You are not registered for this event'
      });
    }

    // Delete the attendance record (this removes them from the event)
    await AttendanceLog.findByIdAndDelete(attendanceRecord._id);

    console.log('Successfully removed participant from event');

    res.json({
      success: true,
      message: 'Successfully left the event',
      data: {
        eventCode: event.eventCode,
        eventTitle: event.title
      }
    });

  } catch (error) {
    console.error('Leave event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave event',
      error: error.message
    });
  }
});

// @route   DELETE /api/attendance/my/completed
// @desc    Hide all completed attendance records from participant view
// @access  Private (Participant only)
router.delete('/my/completed', auth, async (req, res) => {
  try {
    const result = await AttendanceLog.updateMany(
      { 
        participant: req.user._id,
        checkOutTime: { $exists: true },
        hiddenFromParticipant: { $ne: true }
      },
      { 
        hiddenFromParticipant: true 
      }
    );

    res.json({
      success: true,
      message: 'Completed events cleared from your view successfully',
      data: {
        clearedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Hide completed events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear completed events from view',
      error: error.message
    });
  }
});

// @route   DELETE /api/attendance/:id
// @desc    Hide individual attendance record from participant view
// @access  Private (Participant only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const attendanceLog = await AttendanceLog.findOne({ 
      _id: req.params.id,
      participant: req.user._id,
      checkOutTime: { $exists: true }, // Only allow hiding of completed events
      hiddenFromParticipant: { $ne: true } // Only if not already hidden
    });

    if (!attendanceLog) {
      return res.status(404).json({
        success: false,
        message: 'Completed attendance record not found or access denied'
      });
    }

    await AttendanceLog.findByIdAndUpdate(req.params.id, { 
      hiddenFromParticipant: true 
    });

    res.json({
      success: true,
      message: 'Attendance record removed from your view successfully'
    });
  } catch (error) {
    console.error('Hide attendance record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove attendance record from view',
      error: error.message
    });
  }
});

// @route   DELETE /api/attendance/remove-participant
// @desc    Remove a participant from an event (organizer can remove, participant can rejoin)
// @access  Private (Organizer only)
router.delete('/remove-participant', auth, requireOrganizer, [
  body('eventId').notEmpty().withMessage('Event ID is required'),
  body('participantId').notEmpty().withMessage('Participant ID is required')
], async (req, res) => {
  try {
    console.log('=== REMOVE PARTICIPANT REQUEST ===');
    console.log('Organizer ID:', req.user?._id);
    console.log('Request body:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { eventId, participantId } = req.body;

    // Verify event belongs to organizer
    const event = await Event.findOne({
      _id: eventId,
      organizer: req.user._id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    // Find and delete the attendance record
    const attendanceRecord = await AttendanceLog.findOne({
      event: eventId,
      participant: participantId
    });

    if (!attendanceRecord) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found in this event'
      });
    }

    // Delete the attendance record (participant can rejoin later)
    await AttendanceLog.findByIdAndDelete(attendanceRecord._id);

    // Also clean up location tracking status for this participant
    const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');
    try {
      await ParticipantLocationStatus.findOneAndDelete({
        event: eventId,
        participant: participantId
      });
      console.log('✅ Cleaned up location tracking status');
    } catch (cleanupError) {
      console.error('⚠️ Failed to cleanup location tracking:', cleanupError);
      // Don't fail the operation if cleanup fails
    }

    console.log('Successfully removed participant from event');

    res.json({
      success: true,
      message: 'Participant removed from event successfully',
      data: {
        eventId: event._id,
        participantId: participantId
      }
    });

  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove participant',
      error: error.message
    });
  }
});

// @route   POST /api/attendance/checkin-direct
// @desc    Direct check-in for public events (no QR code needed)
// @access  Private
router.post('/checkin-direct', auth, [
  body('eventId').notEmpty().withMessage('Event ID is required'),
  body('location.latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('location.longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
], async (req, res) => {
  try {
    console.log('=== DIRECT CHECK-IN REQUEST ===');
    console.log('User ID:', req.user?._id);
    console.log('Request body:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { eventId, location } = req.body;
    const userId = req.user._id;

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      console.log('Event not found:', eventId);
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    console.log('Event found:', event.title);

    // Check if user has an attendance record for this event
    let attendanceRecord = await AttendanceLog.findOne({
      event: eventId,
      participant: userId
    });

    if (!attendanceRecord) {
      console.log('No attendance record found for user');
      return res.status(404).json({
        success: false,
        message: 'You need to join this event first before checking in'
      });
    }

    console.log('Attendance record found:', attendanceRecord._id);
    console.log('Current status:', attendanceRecord.status);

    // Check if already checked in
    if (attendanceRecord.checkInTime) {
      console.log('User already checked in');
      return res.status(400).json({
        success: false,
        message: 'You are already checked in to this event'
      });
    }

    // Update attendance record with check-in
    attendanceRecord.checkInTime = new Date();
    attendanceRecord.checkInLocation = location || null;
    attendanceRecord.status = 'checked-in';
    await attendanceRecord.save();

    console.log('Check-in successful, updated attendance record');

    await attendanceRecord.populate(['event', 'participant']);

    res.json({
      success: true,
      message: 'Check-in successful',
      data: {
        attendanceLog: attendanceRecord,
        participant: attendanceRecord.participant,
        event: attendanceRecord.event
      }
    });
  } catch (error) {
    console.error('Direct check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Check-in failed',
      error: error.message
    });
  }
});

module.exports = router;