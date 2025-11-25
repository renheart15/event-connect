
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

// Helper function to extract name/email from registration response using field definitions
const extractNameEmailFromRegistration = async (eventId, participantId) => {
  try {
    const registrationResponse = await RegistrationResponse.findOne({
      event: eventId,
      participant: participantId
    }).populate('registrationForm');

    if (!registrationResponse || !registrationResponse.responses || !registrationResponse.registrationForm) {
      console.log(`📝 [EXTRACT] No registration response found for participant ${participantId}`);
      return { name: null, email: null };
    }

    const fields = registrationResponse.registrationForm.fields || [];
    let nameValue = null;
    let emailValue = null;

    console.log(`📝 [EXTRACT] Found ${fields.length} fields in registration form`);

    // Convert Map to plain object for easier access
    const responsesObj = registrationResponse.responses instanceof Map
      ? Object.fromEntries(registrationResponse.responses)
      : registrationResponse.responses;

    console.log(`📝 [EXTRACT] Responses object keys:`, Object.keys(responsesObj));

    // Match fields by label or type to find name and email
    for (const field of fields) {
      const fieldId = field.id;
      const fieldLabel = (field.label || '').toLowerCase();
      const fieldType = field.type;

      // Try multiple ways to get the response value
      let responseValue = responsesObj[fieldId] ||
                         registrationResponse.responses.get?.(fieldId) ||
                         registrationResponse.responses[fieldId];

      console.log(`📝 [EXTRACT] Field "${field.label}" (id: ${fieldId}, type: ${fieldType}): value="${responseValue}"`);

      // Check if this field is a name field (by label or common patterns)
      if (!nameValue && responseValue) {
        const namePatterns = ['name', 'fullname', 'full name', 'participant', 'student'];
        if (namePatterns.some(pattern => fieldLabel.includes(pattern))) {
          nameValue = responseValue;
          console.log(`✅ [EXTRACT] Found name field: "${field.label}" = "${nameValue}"`);
        }
      }

      // Check if this field is an email field (by type or label)
      if (!emailValue && responseValue) {
        if (fieldType === 'email' || fieldLabel.includes('email') || fieldLabel.includes('e-mail')) {
          emailValue = responseValue;
          console.log(`✅ [EXTRACT] Found email field: "${field.label}" = "${emailValue}"`);
        }
      }

      // Break early if we found both
      if (nameValue && emailValue) break;
    }

    console.log(`📝 [EXTRACT] Final result: name="${nameValue}", email="${emailValue}"`);
    return { name: nameValue, email: emailValue };
  } catch (error) {
    console.error('⚠️ [EXTRACT] Failed to extract registration data:', error);
    return { name: null, email: null };
  }
};

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

    // CRITICAL: Check if event is active (per requirements)
    const event = invitation.event;
    if (event.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Cannot check in - event is ${event.status}. Event must be active.`
      });
    }

    // Check if check-in is within allowed time window
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

    // Check if already checked in (CRITICAL FIX: check actual status, not just existence)
    const existingAttendance = await AttendanceLog.findOne({
      event: eventId,
      participant: participantId
    });

    // Fetch registration data for this participant if it exists
    console.log(`📝 [CHECK-IN] Extracting registration data for participant ${participantId}`);
    const { name: registrationName, email: registrationEmail } = await extractNameEmailFromRegistration(eventId, participantId);

    // FALLBACK: If no registration response or no name/email in registration, use participant's user data
    let finalName = registrationName || invitation.participant.name;
    let finalEmail = registrationEmail || invitation.participant.email;

    if (!registrationName || !registrationEmail) {
      console.log(`📝 [CHECK-IN] Missing registration data, using user account data: name="${finalName}", email="${finalEmail}"`);
    } else {
      console.log(`📝 [CHECK-IN] Using registration data: name="${finalName}", email="${finalEmail}"`);
    }

    if (existingAttendance) {
      // If attendance record exists, check if they're ACTUALLY checked in
      if (existingAttendance.checkInTime || existingAttendance.status === 'checked-in') {
        return res.status(400).json({
          success: false,
          message: 'Participant has already checked in'
        });
      }

      // Attendance exists but not checked in yet (status: 'registered')
      // Update existing record instead of creating new one
      existingAttendance.checkInTime = new Date();
      existingAttendance.checkInLocation = location || null;
      existingAttendance.status = 'checked-in';
      existingAttendance.invitation = invitationId; // Update invitation reference

      // Store registration data (with fallback to user data)
      existingAttendance.registrationName = finalName;
      existingAttendance.registrationEmail = finalEmail;

      await existingAttendance.save();

      console.log('✅ Updated existing attendance record for check-in');

      // Use existing attendance record for the rest of the flow
      var attendanceLog = existingAttendance;
    } else {
      // Create new attendance log
      var attendanceLog = await AttendanceLog.create({
        event: eventId,
        participant: participantId,
        invitation: invitationId,
        checkInTime: new Date(),
        checkInLocation: location || null,
        status: 'checked-in',
        registrationName: finalName,
        registrationEmail: finalEmail
      });

      console.log('✅ Created new attendance record for check-in');
    }

    // Initialize or reset location tracking for this participant/event
    const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');
    try {
      const existingLocationStatus = await ParticipantLocationStatus.findOne({
        event: eventId,
        participant: participantId
      });

      if (existingLocationStatus) {
        // Reset existing location tracking (preserve current location status)
        // Only reset the timer, not the geofence status
        await ParticipantLocationStatus.findOneAndUpdate(
          { event: eventId, participant: participantId },
          {
            $set: {
              'outsideTimer.isActive': false,
              'outsideTimer.startTime': null,
              'outsideTimer.totalTimeOutside': 0,
              'outsideTimer.currentSessionStart': null,
              // Don't force isWithinGeofence or status - let location updates determine this
              attendanceLog: attendanceLog._id,
              isActive: true
            }
          },
          { upsert: false }
        );
        console.log('✅ Reset location timer for participant on check-in (preserved location status)');
      } else {
        // Initialize location tracking for new check-in
        const locationTrackingService = require('../services/locationTrackingService');
        await locationTrackingService.initializeLocationTracking(
          eventId,
          participantId,
          attendanceLog._id
        );
        console.log('✅ Initialized location tracking for participant on check-in');
      }
    } catch (resetError) {
      console.error('⚠️ Failed to initialize/reset location tracking:', resetError);
      // Don't fail the check-in if location tracking fails
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
    attendanceLog.status = 'checked-out'; // CRITICAL FIX: Set status to checked-out
    attendanceLog.notes = notes || attendanceLog.notes;
    await attendanceLog.save();

    // CRITICAL FIX: Stop location tracking when checking out
    const locationTrackingService = require('../services/locationTrackingService');
    try {
      await locationTrackingService.stopLocationTracking(
        attendanceLog.event,
        attendanceLog.participant
      );
      console.log(`✅ [CHECKOUT] Stopped location tracking for participant ${attendanceLog.participant}`);
    } catch (locationError) {
      console.error('⚠️ [CHECKOUT] Failed to stop location tracking:', locationError);
      // Don't fail the checkout if location tracking stop fails
    }

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

    // Helper function to extract name/email from registration response
    const extractRegistrationData = (response) => {
      if (!response || !response.responses || !response.registrationForm) {
        return { name: null, email: null };
      }

      const fields = response.registrationForm.fields || [];
      let nameValue = null;
      let emailValue = null;

      // Convert Map to plain object for easier access
      const responsesObj = response.responses instanceof Map
        ? Object.fromEntries(response.responses)
        : response.responses;

      // Match fields by label or type to find name and email
      for (const field of fields) {
        const fieldId = field.id;
        const fieldLabel = (field.label || '').toLowerCase();
        const fieldType = field.type;

        // Try multiple ways to get the response value
        const responseValue = responsesObj[fieldId] ||
                             response.responses.get?.(fieldId) ||
                             response.responses[fieldId];

        // Check if this field is a name field (by label or common patterns)
        if (!nameValue && responseValue) {
          const namePatterns = ['name', 'fullname', 'full name', 'participant', 'student'];
          if (namePatterns.some(pattern => fieldLabel.includes(pattern))) {
            nameValue = responseValue;
          }
        }

        // Check if this field is an email field (by type or label)
        if (!emailValue && responseValue) {
          if (fieldType === 'email' || fieldLabel.includes('email') || fieldLabel.includes('e-mail')) {
            emailValue = responseValue;
          }
        }

        // Break early if we found both
        if (nameValue && emailValue) break;
      }

      return { name: nameValue, email: emailValue };
    };

    // Enrich attendance logs with registration response data (name, email)
    const enrichedLogs = attendanceLogs.map(log => {
      const logObj = log.toObject();

      // PRIORITY 1: Use cached registration data from attendance log if available
      if (logObj.registrationName || logObj.registrationEmail) {
        if (logObj.registrationName && logObj.registrationName.trim() !== '') {
          logObj.participant.name = logObj.registrationName;
        }
        if (logObj.registrationEmail && logObj.registrationEmail.trim() !== '') {
          logObj.participant.email = logObj.registrationEmail;
        }
        console.log(`📝 [CACHED DATA] Participant ${log.participant._id}: Using cached registration name="${logObj.participant.name}", email="${logObj.participant.email}"`);
        return logObj;
      }

      // PRIORITY 2: If no cached data, lookup registration response
      const response = responseMap.get(log.participant._id.toString());

      if (response) {
        // Use the new extraction method that properly handles field IDs
        const { name, email } = extractRegistrationData(response);

        // Only override if registration data exists and is not empty
        if (name && name.trim() !== '') {
          logObj.participant.name = name;
        }
        if (email && email.trim() !== '') {
          logObj.participant.email = email;
        }

        console.log(`📝 [LOOKUP DATA] Participant ${log.participant._id}: Using registration name="${logObj.participant.name}", email="${logObj.participant.email}"`);
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

    // CRITICAL FIX: Filter out registered participants - they haven't actually checked in yet
    const checkedInLogs = enrichedLogs.filter(log => log.status !== 'registered');

    // Get summary statistics
    const stats = {
      totalCheckedIn: checkedInLogs.length,
      currentlyPresent: checkedInLogs.filter(log => log.status === 'checked-in').length,
      totalCheckedOut: totalLate, // Use totalLate instead of checked-out count
      totalAbsent: checkedInLogs.filter(log => log.status === 'absent').length,
      averageDuration: checkedInLogs
        .filter(log => log.duration > 0)
        .reduce((sum, log) => sum + log.duration, 0) /
        checkedInLogs.filter(log => log.duration > 0).length || 0
    };

    // Debug: Check what location data we're sending
    console.log('📍 [ATTENDANCE ENDPOINT] Sending event location:', {
      eventId: event._id,
      hasLocation: !!event.location,
      hasAddress: !!event.location?.address,
      address: event.location?.address,
      fullLocation: event.location
    });

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
          location: event.location,
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
        select: 'title date location eventCode organizer description status startTime endTime published maxTimeOutside geofenceRadius',
        // Allow all events that participant has joined/checked into, regardless of published status
        populate: {
          path: 'organizer',
          select: 'name email'
        }
      })
      .populate('invitation', 'invitationCode')
      .sort({ checkInTime: -1 });

    // Filter out attendance logs where event didn't populate (should rarely happen now)
    const filteredAttendanceLogs = attendanceLogs.filter(log => log.event !== null);

    console.log('🔍 [ATTENDANCE MY DEBUG] Total attendance records:', attendanceLogs.length);
    console.log('🔍 [ATTENDANCE MY DEBUG] Filtered (events that populated):', filteredAttendanceLogs.length);

    // Debug which events didn't populate (if any)
    const filteredOutLogs = attendanceLogs.filter(log => log.event === null);
    if (filteredOutLogs.length > 0) {
      console.log('⚠️ [EVENT NOT FOUND] Filtered out', filteredOutLogs.length, 'attendance records where event no longer exists');
      filteredOutLogs.forEach((log, index) => {
        console.log(`⚠️ [EVENT NOT FOUND] Attendance ${index + 1}:`, {
          attendanceId: log._id,
          eventId: log.event,
          reason: 'Event not found in database'
        });
      });
    }

    console.log('🔍 [ATTENDANCE MY DEBUG] Found', filteredAttendanceLogs.length, 'attendance records with valid events');

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
        select: 'title date location eventCode published maxTimeOutside geofenceRadius'
        // Allow all events that participant has scanned into, regardless of published status
      })
      .populate('invitation', 'invitationCode')
      .sort({ checkInTime: -1 })
      .limit(50); // Limit to last 50 scans

    // Filter out attendance logs where event didn't populate (should rarely happen)
    const filteredAttendanceLogs = attendanceLogs.filter(log => log.event !== null);

    // Transform data to match frontend scan history format
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
        // CRITICAL FIX: Get participants who were ACTUALLY marked absent during the event
        // (not just those with isActive=false, since stopAllTrackingForEvent sets that for everyone)
        // We identify truly absent participants by checking their attendance status
        const absentAttendanceLogs = await AttendanceLog.find({
          event: event._id,
          status: 'absent' // Participants who were already marked absent during the event
        }).select('_id');

        const absentAttendanceLogIds = absentAttendanceLogs.map(log => log._id);

        console.log(`[AUTO-CHECKOUT] Event "${event.title}": Found ${absentAttendanceLogIds.length} participants already marked absent, will preserve their data`);

        // Use updateMany to batch update all checked-in participants
        // EXCEPT those who should be marked absent
        const updateResult = await AttendanceLog.updateMany(
          {
            event: event._id,
            status: 'checked-in',
            checkOutTime: { $exists: false },
            _id: { $nin: absentAttendanceLogIds } // Exclude absent participants
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

        console.log(`[AUTO-CHECKOUT] Event "${event.title}": ${eventCheckedOut} participants auto-checked out, ${absentAttendanceLogIds.length} already absent (preserved their original checkOutTime)`);

        // CRITICAL FIX: No correction needed since we now properly identify absent participants
        // by their actual status='absent', not by isActive=false in ParticipantLocationStatus
        // Participants who are already marked absent will be excluded from auto-checkout above

        results.push({
          eventId: event._id,
          eventTitle: event.title,
          eventEndTime: event.endTime,
          participantsCheckedOut: eventCheckedOut,
          participantsMarkedAbsent: absentAttendanceLogIds.length
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

    // Find the event by event code (allow both public and private events)
    // If user has the event code, organizer intentionally shared it
    const event = await Event.findOne({
      eventCode: eventCode.toUpperCase(),
      isActive: true
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

    // Fetch registration data if it exists
    console.log(`📝 [JOIN-EVENT] Extracting registration data for participant ${userId}`);
    const { name: registrationName, email: registrationEmail } = await extractNameEmailFromRegistration(event._id, userId);

    // FALLBACK: If no registration response or no name/email in registration, use participant's user data
    const finalName = registrationName || req.user.name;
    const finalEmail = registrationEmail || req.user.email;

    if (!registrationName || !registrationEmail) {
      console.log(`📝 [JOIN-EVENT] Missing registration data, using user account data: name="${finalName}", email="${finalEmail}"`);
    } else {
      console.log(`📝 [JOIN-EVENT] Using registration data: name="${finalName}", email="${finalEmail}"`);
    }

    // Create attendance record directly (no invitation needed for public events)
    try {
      // CRITICAL FIX: Always set status to 'registered' when joining
      // Auto check-in will happen only when participant is inside geofence AND event is active
      const attendanceRecord = new AttendanceLog({
        event: event._id,
        participant: userId,
        status: 'registered', // Always start as registered, let auto check-in handle geofence verification
        registrationName: finalName,
        registrationEmail: finalEmail
        // checkInTime will be set by auto check-in when participant is inside geofence
        // invitation will be null/undefined (optional field)
      });

      await attendanceRecord.save();
      console.log('Attendance record created successfully:', attendanceRecord._id);
      console.log('Status set to "registered" - auto check-in will verify geofence before checking in');

      // CRITICAL: Initialize location tracking immediately when joining event
      // This allows tracking even when outside the geofence
      // Auto check-in will happen when participant enters geofence AND event is active
      const locationTrackingService = require('../services/locationTrackingService');
      try {
        await locationTrackingService.initializeLocationTracking(
          event._id,
          userId,
          attendanceRecord._id
        );
        console.log('✅ Initialized location tracking immediately after joining event');
      } catch (locationError) {
        console.error('⚠️ Failed to initialize location tracking:', locationError);
        // Don't fail the join if location tracking initialization fails
      }

      // Return success response
      res.json({
        success: true,
        message: 'Successfully joined the event. Location tracking started.',
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

// @route   DELETE /api/attendance/remove-participant
// @desc    Remove a participant from an event (organizer can remove, participant can rejoin)
// @access  Private (Organizer only)
// NOTE: This route must be defined BEFORE the /:id route to avoid route conflicts
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

// @route   DELETE /api/attendance/:id
// @desc    Hide individual attendance record from participant view
// @access  Private (Participant only)
// NOTE: This route must be defined AFTER specific routes to avoid catching them
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

    // CRITICAL: Check if event is active (per requirements)
    if (event.status !== 'active') {
      console.log('Event is not active:', event.status);
      return res.status(400).json({
        success: false,
        message: `Cannot check in - event is ${event.status}. Event must be active.`
      });
    }

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

    // Fetch registration data if it exists and not already stored
    if (!attendanceRecord.registrationName || !attendanceRecord.registrationEmail) {
      console.log(`📝 [DIRECT-CHECK-IN] Extracting registration data for participant ${userId}`);
      const { name: registrationName, email: registrationEmail } = await extractNameEmailFromRegistration(eventId, userId);

      // FALLBACK: If no registration response or no name/email in registration, use participant's user data
      const finalName = registrationName || req.user.name;
      const finalEmail = registrationEmail || req.user.email;

      if (!registrationName || !registrationEmail) {
        console.log(`📝 [DIRECT-CHECK-IN] Missing registration data, using user account data: name="${finalName}", email="${finalEmail}"`);
      } else {
        console.log(`📝 [DIRECT-CHECK-IN] Using registration data: name="${finalName}", email="${finalEmail}"`);
      }

      attendanceRecord.registrationName = finalName;
      attendanceRecord.registrationEmail = finalEmail;
    }

    // Update attendance record with check-in
    attendanceRecord.checkInTime = new Date();
    attendanceRecord.checkInLocation = location || null;
    attendanceRecord.status = 'checked-in';
    await attendanceRecord.save();

    console.log('Check-in successful, updated attendance record');

    // Initialize location tracking after check-in
    try {
      const locationTrackingService = require('../services/locationTrackingService');
      await locationTrackingService.initializeLocationTracking(
        eventId,
        userId,
        attendanceRecord._id
      );
      console.log('✅ Location tracking initialized for participant:', req.user.name);
    } catch (locationError) {
      console.error('⚠️ Failed to initialize location tracking:', locationError);
      // Don't fail the check-in if location tracking fails - it's not critical
    }

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