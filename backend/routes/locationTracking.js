const express = require('express');
const router = express.Router();
const locationTrackingService = require('../services/locationTrackingService');
const { auth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const AttendanceLog = require('../models/AttendanceLog');

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

      // Verify attendance log exists and belongs to the participant
      const attendanceLog = await AttendanceLog.findOne({
        _id: attendanceLogId,
        event: eventId,
        participant: participantId,
        status: 'checked-in'
      });

      if (!attendanceLog) {
        return res.status(404).json({
          success: false,
          message: 'Valid attendance log not found'
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
  body('accuracy').optional().isFloat({ min: 0 }).withMessage('Accuracy must be a positive number')
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

      const { eventId, participantId, latitude, longitude, accuracy = 0 } = req.body;

      const locationStatus = await locationTrackingService.updateParticipantLocation(
        eventId,
        participantId,
        latitude,
        longitude,
        accuracy
      );

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
        exceededLimit: locationStatuses.filter(s => s.status === 'exceeded_limit').length
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
      .populate('event', 'title maxTimeOutside geofenceRadius');

      if (!locationStatus) {
        return res.status(404).json({
          success: false,
          message: 'Location status not found'
        });
      }

      // Calculate real-time values
      const statusObj = locationStatus.toObject();
      if (locationStatus.outsideTimer.isActive) {
        statusObj.currentTimeOutside = locationStatus.calculateTotalTimeOutside();
      } else {
        statusObj.currentTimeOutside = locationStatus.outsideTimer.totalTimeOutside;
      }

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
        isActive: true,
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

module.exports = router;