
const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const Invitation = require('../models/Invitation');
const AttendanceLog = require('../models/AttendanceLog');
const { auth, requireOrganizer } = require('../middleware/auth');

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

    // Check if event is today (within 24 hours)
    const eventDate = new Date(invitation.event.date);
    const now = new Date();
    const timeDiff = Math.abs(now - eventDate);
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return res.status(400).json({
        success: false,
        message: 'Check-in is only allowed on the event day'
      });
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
      checkInLocation: location || null
    });

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

    const attendanceLogs = await AttendanceLog.find({ event: req.params.eventId })
      .populate('participant', 'name email')
      .populate('invitation', 'invitationCode')
      .sort({ checkInTime: -1 });

    console.log(`Found ${attendanceLogs.length} attendance logs for event ${req.params.eventId}`);
    if (attendanceLogs.length > 0) {
      console.log('First attendance log:', JSON.stringify(attendanceLogs[0], null, 2));
    }

    // Get summary statistics
    const stats = {
      totalCheckedIn: attendanceLogs.length,
      currentlyPresent: attendanceLogs.filter(log => log.status === 'checked-in').length,
      totalCheckedOut: attendanceLogs.filter(log => log.status === 'checked-out').length,
      averageDuration: attendanceLogs
        .filter(log => log.duration > 0)
        .reduce((sum, log) => sum + log.duration, 0) / 
        attendanceLogs.filter(log => log.duration > 0).length || 0
    };

    res.json({
      success: true,
      data: {
        attendanceLogs,
        stats
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
    const attendanceLogs = await AttendanceLog.find({ participant: req.user._id })
      .populate('event', 'title date location eventCode')
      .populate('invitation', 'invitationCode')
      .sort({ checkInTime: -1 });

    res.json({
      success: true,
      data: {
        attendanceLogs
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
      .populate('event', 'title date location eventCode')
      .populate('invitation', 'invitationCode')
      .sort({ checkInTime: -1 })
      .limit(50); // Limit to last 50 scans

    // Transform data to match frontend scan history format
    const scanHistory = attendanceLogs.map((log, index) => ({
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
    
    // Find all events that have ended (simplified approach)
    const allEvents = await Event.find({
      date: { $exists: true },
      endTime: { $exists: true }
    });

    // Filter events that have ended
    const endedEvents = allEvents.filter(event => {
      const eventDate = new Date(event.date);
      const [endHour, endMin] = event.endTime.split(':').map(Number);
      
      const eventEndTime = new Date(eventDate);
      eventEndTime.setHours(endHour, endMin, 0, 0);
      
      return now > eventEndTime;
    });

    console.log(`Found ${endedEvents.length} ended events`);

    let totalCheckedOut = 0;
    const results = [];

    for (const event of endedEvents) {
      try {
        // Find all participants still checked in for this event
        const activeAttendanceLogs = await AttendanceLog.find({
          event: event._id,
          status: 'checked-in',
          checkOutTime: { $exists: false }
        }).populate(['participant', 'event']);

        console.log(`Event ${event.title}: ${activeAttendanceLogs.length} participants still checked in`);

        let eventCheckedOut = 0;
        
        for (const log of activeAttendanceLogs) {
          // Auto checkout with current time
          log.checkOutTime = now;
          log.status = 'checked-out';
          log.notes = (log.notes || '') + ' [Auto-checkout: Event ended]';
          await log.save();
          
          eventCheckedOut++;
          totalCheckedOut++;
        }

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

module.exports = router;
