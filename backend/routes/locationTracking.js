const express = require('express');
const router = express.Router();
const locationTrackingService = require('../services/locationTrackingService');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const AttendanceLog = require('../models/AttendanceLog');

console.log('🎯 [LOCATION-ROUTES] Location tracking routes module loaded successfully');

// Initialize location tracking for a participant (called when checking in)
router.post('/initialize', [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('participantId').isMongoId().withMessage('Valid participant ID is required'),
  body('attendanceLogId').isMongoId().withMessage('Valid attendance log ID is required')
], auth, async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { eventId, participantId, attendanceLogId } = req.body;

      console.log('🔍 [LOCATION-INIT] Request data:', {
        eventId,
        participantId,
        attendanceLogId,
        hasEventId: !!eventId,
        hasParticipantId: !!participantId,
        hasAttendanceLogId: !!attendanceLogId
      });

      // Verify attendance log exists and belongs to the participant
      const attendanceLog = await AttendanceLog.findOne({
        _id: attendanceLogId,
        event: eventId,
        participant: participantId
      });

      console.log('🔍 [LOCATION-INIT] Attendance log query result:', {
        found: !!attendanceLog,
        status: attendanceLog?.status,
        logId: attendanceLog?._id
      });

      if (!attendanceLog) {
        return res.status(404).json({
          success: false,
          message: 'Attendance log not found. Please check in to the event first.'
        });
      }

      // CRITICAL FIX: Allow location tracking for BOTH 'registered' and 'checked-in' participants
      // 'registered' participants need tracking to enable auto-check-in when entering geofence
      if (attendanceLog.status !== 'checked-in' && attendanceLog.status !== 'registered') {
        return res.status(400).json({
          success: false,
          message: `Cannot start location tracking. Current status: ${attendanceLog.status}. Please accept invitation or check in first.`
        });
      }

      const locationStatus = await locationTrackingService.initializeLocationTracking(
        eventId, 
        participantId, 
        attendanceLogId
      );

      res.json({
        success: true,
        data: locationStatus,
        message: 'Location tracking initialized successfully'
      });
    } catch (error) {
      console.error('Error initializing location tracking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initialize location tracking',
        error: error.message
      });
    }
  }
);

// Update participant location
router.post('/update-location', [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('participantId').isMongoId().withMessage('Valid participant ID is required'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  body('accuracy').optional().isFloat({ min: 0 }).withMessage('Accuracy must be a positive number'),
  body('batteryLevel').optional().isInt({ min: 0, max: 100 }).withMessage('Battery level must be between 0 and 100')
], auth, async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { eventId, participantId, latitude, longitude, accuracy = 0, batteryLevel } = req.body;

      const locationStatus = await locationTrackingService.updateParticipantLocation(
        eventId,
        participantId,
        latitude,
        longitude,
        accuracy,
        batteryLevel
      );

      // Also update the attendance log with battery data
      if (batteryLevel !== null && batteryLevel !== undefined) {
        try {
          await AttendanceLog.findByIdAndUpdate(
            locationStatus.attendanceLog,
            { batteryLevel: batteryLevel },
            { new: true }
          );
        } catch (err) {
          console.error('Error updating attendance log with battery:', err);
        }
      }

      res.json({
        success: true,
        data: locationStatus,
        message: 'Location updated successfully'
      });
    } catch (error) {
      console.error('Error updating location:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location',
        error: error.message
      });
    }
  }
);

// Get location status for all participants in an event (for organizers)
router.get('/event/:eventId/status', 
  auth, 
  async (req, res) => {
    try {
      const { eventId } = req.params;

      // Verify user is organizer or has access to this event
      // This would typically check if the user is the event organizer
      // For now, assuming authentication middleware handles authorization

      const locationStatuses = await locationTrackingService.getEventLocationStatus(eventId);

      // Calculate summary statistics
      const summary = {
        totalParticipants: locationStatuses.length,
        insideGeofence: locationStatuses.filter(s => s.isWithinGeofence).length,
        outsideGeofence: locationStatuses.filter(s => !s.isWithinGeofence).length,
        warningStatus: locationStatuses.filter(s => s.status === 'warning').length,
        exceededLimit: locationStatuses.filter(s => s.status === 'exceeded_limit').length,
        absent: locationStatuses.filter(s => s.status === 'absent').length
      };

      res.json({
        success: true,
        data: {
          participants: locationStatuses,
          summary
        }
      });
    } catch (error) {
      console.error('Error getting event location status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get location status',
        error: error.message
      });
    }
  }
);

// Get location status for a specific participant
router.get('/participant/:participantId/event/:eventId/status',
  auth,
  async (req, res) => {
    try {
      const { participantId, eventId } = req.params;

      const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');
      const locationStatus = await ParticipantLocationStatus.findOne({
        event: eventId,
        participant: participantId,
        isActive: true
      })
      .populate('participant', 'name email')
      .populate('event', 'title maxTimeOutside geofenceRadius')
      .populate('attendanceLog', 'registrationName registrationEmail status checkOutTime'); // Populate attendance log for registration data AND checkout status

      if (!locationStatus) {
        return res.status(404).json({
          success: false,
          message: 'Location status not found'
        });
      }

      // CRITICAL FIX: Check if participant has checked out
      if (locationStatus.attendanceLog && locationStatus.attendanceLog.status === 'checked-out') {
        console.log(`🚫 [API-SINGLE] Participant has checked out, returning 404`);
        return res.status(404).json({
          success: false,
          message: 'Location tracking stopped - participant has checked out'
        });
      }

      // Calculate real-time values
      const statusObj = locationStatus.toObject();

      // ALWAYS calculate currentTimeOutside (whether timer is active or paused)
      if (locationStatus.outsideTimer.isActive) {
        statusObj.currentTimeOutside = locationStatus.calculateTotalTimeOutside();
        console.log(`⏱️ [API-SINGLE] Timer ACTIVE - currentTimeOutside: ${statusObj.currentTimeOutside}s (${Math.floor(statusObj.currentTimeOutside / 60)}m ${statusObj.currentTimeOutside % 60}s)`);
      } else {
        statusObj.currentTimeOutside = locationStatus.outsideTimer.totalTimeOutside || 0;
        console.log(`⏸️ [API-SINGLE] Timer PAUSED - currentTimeOutside: ${statusObj.currentTimeOutside}s (${Math.floor(statusObj.currentTimeOutside / 60)}m ${statusObj.currentTimeOutside % 60}s)`);
      }

      console.log(`📊 [API-SINGLE] Participant ${participantId}:`);
      console.log(`   - isWithinGeofence: ${statusObj.isWithinGeofence}`);
      console.log(`   - outsideTimer.isActive: ${statusObj.outsideTimer.isActive}`);
      console.log(`   - outsideTimer.reason: ${statusObj.outsideTimer.reason || 'N/A'}`);
      console.log(`   - currentTimeOutside: ${statusObj.currentTimeOutside}s`);
      console.log(`   - status: ${statusObj.status}`);

      // PRIORITIZATION: Use registration data from attendance log if available, otherwise use user account data
      if (statusObj.attendanceLog) {
        // Priority 1: Registration response data from attendance log
        if (statusObj.attendanceLog.registrationName && statusObj.attendanceLog.registrationName.trim() !== '') {
          statusObj.participant.name = statusObj.attendanceLog.registrationName;
          console.log(`📝 [LOCATION-STATUS-SINGLE] Using registration name for participant ${statusObj.participant._id}: "${statusObj.participant.name}"`);
        }

        if (statusObj.attendanceLog.registrationEmail && statusObj.attendanceLog.registrationEmail.trim() !== '') {
          statusObj.participant.email = statusObj.attendanceLog.registrationEmail;
          console.log(`📝 [LOCATION-STATUS-SINGLE] Using registration email for participant ${statusObj.participant._id}: "${statusObj.participant.email}"`);
        }
      }
      // Priority 2: User account data (already populated by default)

      // FINAL DEBUG: Log what we're about to send
      console.log(`📤 [API-SINGLE] SENDING RESPONSE with currentTimeOutside: ${statusObj.currentTimeOutside}s`);

      res.json({
        success: true,
        data: statusObj
      });
    } catch (error) {
      console.error('Error getting participant location status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get participant location status',
        error: error.message
      });
    }
  }
);

// Get timer data for participant (for popup modal)
router.get('/participant/:participantId/timer',
  auth,
  async (req, res) => {
    try {
      const { participantId } = req.params;

      const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');
      const locationStatus = await ParticipantLocationStatus.findOne({
        participant: participantId,
        isActive: true
      })
      .populate('event', 'title maxTimeOutside')
      .sort({ createdAt: -1 }); // Get most recent active status

      // If no active location status or timer not active, return null
      if (!locationStatus || !locationStatus.outsideTimer.isActive) {
        return res.json({
          success: true,
          data: null
        });
      }

      // Check if data is stale
      const now = new Date();
      const minutesSinceUpdate = (now - new Date(locationStatus.lastLocationUpdate)) / (1000 * 60);
      const isStale = minutesSinceUpdate > 3;

      // Calculate current time outside
      const currentTimeOutside = locationStatus.calculateTotalTimeOutside();

      // Build timer data
      // IMPORTANT: Use the timer reason to determine what to show
      const timerData = {
        eventId: locationStatus.event._id,
        eventTitle: locationStatus.event.title,
        maxTimeOutside: locationStatus.event.maxTimeOutside,
        currentTimeOutside: currentTimeOutside,
        status: locationStatus.status,
        isStale: locationStatus.outsideTimer.reason === 'stale', // Use the reason field
        timerActive: locationStatus.outsideTimer.isActive,
        timerReason: locationStatus.outsideTimer.reason, // Pass the reason to frontend
        startTime: locationStatus.outsideTimer.startTime
      };

      res.json({
        success: true,
        data: timerData
      });
    } catch (error) {
      console.error('Error getting participant timer data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get timer data',
        error: error.message
      });
    }
  }
);

// Stop location tracking (called when checking out)
router.post('/stop', [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('participantId').isMongoId().withMessage('Valid participant ID is required')
], auth, async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { eventId, participantId } = req.body;

      const locationStatus = await locationTrackingService.stopLocationTracking(eventId, participantId);

      res.json({
        success: true,
        data: locationStatus,
        message: 'Location tracking stopped successfully'
      });
    } catch (error) {
      console.error('Error stopping location tracking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to stop location tracking',
        error: error.message
      });
    }
  }
);

// Acknowledge an alert
router.post('/acknowledge-alert', [
  body('statusId').isMongoId().withMessage('Valid status ID is required'),
  body('alertId').isMongoId().withMessage('Valid alert ID is required')
], auth, async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { statusId, alertId } = req.body;

      const locationStatus = await locationTrackingService.acknowledgeAlert(statusId, alertId);

      res.json({
        success: true,
        data: locationStatus,
        message: 'Alert acknowledged successfully'
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to acknowledge alert',
        error: error.message
      });
    }
  }
);

// Get alerts for an event (for organizers)
router.get('/event/:eventId/alerts',
  auth,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { acknowledged } = req.query;

      const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');

      let matchCondition = {
        event: eventId,
        'alertsSent.0': { $exists: true }
      };

      // Filter by acknowledged status if specified
      if (acknowledged !== undefined) {
        matchCondition['alertsSent.acknowledged'] = acknowledged === 'true';
      }

      const locationStatuses = await ParticipantLocationStatus.find(matchCondition)
        .populate('participant', 'name email')
        .populate('event', 'title')
        .sort({ 'alertsSent.timestamp': -1 });

      // Extract and flatten alerts
      const alerts = [];
      locationStatuses.forEach(status => {
        status.alertsSent.forEach(alert => {
          if (acknowledged === undefined || alert.acknowledged.toString() === acknowledged) {
            alerts.push({
              alertId: alert._id,
              statusId: status._id,
              participantName: status.participant.name,
              participantEmail: status.participant.email,
              eventTitle: status.event.title,
              type: alert.type,
              timestamp: alert.timestamp,
              acknowledged: alert.acknowledged,
              currentStatus: status.status,
              isWithinGeofence: status.isWithinGeofence,
              currentTimeOutside: status.outsideTimer.isActive
                ? status.calculateTotalTimeOutside()
                : status.outsideTimer.totalTimeOutside
            });
          }
        });
      });

      // Sort by timestamp (newest first)
      alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      console.error('Error getting alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get alerts',
        error: error.message
      });
    }
  }
);

// DEBUG ENDPOINT: Get comprehensive location debugging data for an event
router.get('/debug/event/:eventId',
  auth,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const Event = require('../models/Event');
      const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');

      // Get event details
      const event = await Event.findById(eventId).populate('organizer', 'name email');

      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      // Get all location statuses (both active and inactive)
      const allLocationStatuses = await ParticipantLocationStatus.find({
        event: eventId
      })
      .populate('participant', 'name email phone')
      .populate('attendanceLog', 'checkInTime checkOutTime status registrationName registrationEmail')
      .sort({ 'participant.name': 1 });

      // Get active tracking info from service
      const activeTracking = locationTrackingService.activeTracking.get(eventId);
      const activeTimers = [];

      allLocationStatuses.forEach(status => {
        const timerId = status._id.toString();
        if (locationTrackingService.timers.has(timerId)) {
          activeTimers.push({
            statusId: timerId,
            participantId: status.participant._id,
            participantName: status.participant.name
          });
        }
      });

      // Build detailed participant data
      const participants = allLocationStatuses.map(status => {
        const currentTimeOutside = status.outsideTimer.isActive
          ? status.calculateTotalTimeOutside()
          : status.outsideTimer.totalTimeOutside;

        const maxTimeOutsideSeconds = event.maxTimeOutside * 60;
        const timeRemaining = Math.max(0, maxTimeOutsideSeconds - currentTimeOutside);
        const percentTimeUsed = maxTimeOutsideSeconds > 0
          ? ((currentTimeOutside / maxTimeOutsideSeconds) * 100).toFixed(1)
          : 0;

        // PRIORITIZATION: Use registration data from attendance log if available
        let displayName = status.participant.name;
        let displayEmail = status.participant.email;

        if (status.attendanceLog) {
          // Priority 1: Registration response data from attendance log
          if (status.attendanceLog.registrationName && status.attendanceLog.registrationName.trim() !== '') {
            displayName = status.attendanceLog.registrationName;
          }
          if (status.attendanceLog.registrationEmail && status.attendanceLog.registrationEmail.trim() !== '') {
            displayEmail = status.attendanceLog.registrationEmail;
          }
        }
        // Priority 2: User account data (already set as default)

        return {
          participantId: status.participant._id,
          participantName: displayName,
          participantEmail: displayEmail,
          participantPhone: status.participant.phone,

          // Location data
          currentLocation: {
            latitude: status.currentLocation.latitude,
            longitude: status.currentLocation.longitude,
            accuracy: status.currentLocation.accuracy,
            timestamp: status.currentLocation.timestamp,
            ageSeconds: Math.floor((Date.now() - new Date(status.currentLocation.timestamp)) / 1000)
          },

          // Distance and geofence info
          distanceFromCenter: status.distanceFromCenter,
          isWithinGeofence: status.isWithinGeofence,
          geofenceRadius: event.geofenceRadius,

          // Status info
          status: status.status,
          isActive: status.isActive,

          // Timer info
          outsideTimer: {
            isActive: status.outsideTimer.isActive,
            startTime: status.outsideTimer.startTime,
            currentSessionStart: status.outsideTimer.currentSessionStart,
            totalTimeOutsideSeconds: status.outsideTimer.totalTimeOutside,
            currentTimeOutsideSeconds: currentTimeOutside,
            currentTimeOutsideFormatted: formatSeconds(currentTimeOutside),
            timeRemainingSeconds: timeRemaining,
            timeRemainingFormatted: formatSeconds(timeRemaining),
            percentTimeUsed: percentTimeUsed,
            maxAllowedSeconds: maxTimeOutsideSeconds,
            maxAllowedFormatted: formatSeconds(maxTimeOutsideSeconds)
          },

          // Alerts
          alerts: status.alertsSent.map(alert => ({
            id: alert._id,
            type: alert.type,
            timestamp: alert.timestamp,
            acknowledged: alert.acknowledged,
            ageSeconds: Math.floor((Date.now() - new Date(alert.timestamp)) / 1000)
          })),

          // Attendance info
          attendanceLog: status.attendanceLog ? {
            id: status.attendanceLog._id,
            checkInTime: status.attendanceLog.checkInTime,
            checkOutTime: status.attendanceLog.checkOutTime,
            status: status.attendanceLog.status
          } : null,

          // Has monitoring timer active
          hasActiveMonitoringTimer: locationTrackingService.timers.has(status._id.toString()),

          // Metadata
          createdAt: status.createdAt,
          updatedAt: status.updatedAt,
          lastLocationUpdate: status.lastLocationUpdate,
          lastUpdateAgeSeconds: Math.floor((Date.now() - new Date(status.lastLocationUpdate)) / 1000)
        };
      });

      // Build summary statistics
      const summary = {
        totalParticipants: participants.length,
        activeParticipants: participants.filter(p => p.isActive).length,
        inactiveParticipants: participants.filter(p => !p.isActive).length,
        insideGeofence: participants.filter(p => p.isWithinGeofence).length,
        outsideGeofence: participants.filter(p => !p.isWithinGeofence).length,
        statusBreakdown: {
          inside: participants.filter(p => p.status === 'inside').length,
          outside: participants.filter(p => p.status === 'outside').length,
          warning: participants.filter(p => p.status === 'warning').length,
          exceeded_limit: participants.filter(p => p.status === 'exceeded_limit').length
        },
        activeTimersCount: activeTimers.length,
        participantsWithAlerts: participants.filter(p => p.alerts.length > 0).length,
        totalAlerts: participants.reduce((sum, p) => sum + p.alerts.length, 0),
        unacknowledgedAlerts: participants.reduce((sum, p) =>
          sum + p.alerts.filter(a => !a.acknowledged).length, 0
        )
      };

      // Event configuration
      const eventConfig = {
        eventId: event._id,
        eventTitle: event.title,
        eventStatus: event.status,
        organizer: event.organizer ? {
          id: event.organizer._id,
          name: event.organizer.name,
          email: event.organizer.email
        } : null,
        location: {
          name: event.location.name,
          coordinates: {
            longitude: event.location.coordinates.coordinates[0],
            latitude: event.location.coordinates.coordinates[1]
          }
        },
        geofenceRadius: event.geofenceRadius,
        maxTimeOutside: event.maxTimeOutside,
        maxTimeOutsideFormatted: formatSeconds(event.maxTimeOutside * 60),
        startDate: event.startDate,
        endDate: event.endDate
      };

      // Service state
      const serviceState = {
        activeEventsInMemory: Array.from(locationTrackingService.activeTracking.keys()),
        activeParticipantsByEvent: activeTracking ? Array.from(activeTracking) : [],
        totalActiveTimers: activeTimers.length,
        activeTimers: activeTimers
      };

      // Response
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          event: eventConfig,
          summary,
          participants,
          serviceState
        }
      });
    } catch (error) {
      console.error('Error in debug endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve debug data',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Helper function to format seconds into human-readable time
function formatSeconds(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

module.exports = router;