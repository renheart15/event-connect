const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');
const Event = require('../models/Event');
const AttendanceLog = require('../models/AttendanceLog');

class LocationTrackingService {
  constructor() {
    this.activeTracking = new Map(); // eventId -> Set of participantIds
    this.timers = new Map(); // statusId -> timer reference
  }

  // Calculate distance between two points using Haversine formula
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Check if participant is within event geofence
  isWithinGeofence(participantLat, participantLon, eventCoords, geofenceRadius) {
    const distance = this.calculateDistance(
      participantLat,
      participantLon,
      eventCoords[1], // latitude
      eventCoords[0]  // longitude
    );
    return distance <= geofenceRadius;
  }

  // Initialize location tracking for a participant
  async initializeLocationTracking(eventId, participantId, attendanceLogId) {
    try {
      // Check if tracking already exists
      let locationStatus = await ParticipantLocationStatus.findOne({
        event: eventId,
        participant: participantId
      });

      if (!locationStatus) {
        // Get event details for geofence info
        const event = await Event.findById(eventId);
        if (!event) {
          throw new Error('Event not found');
        }

        // Create new location status
        locationStatus = new ParticipantLocationStatus({
          event: eventId,
          participant: participantId,
          attendanceLog: attendanceLogId,
          currentLocation: {
            latitude: 0,
            longitude: 0,
            timestamp: new Date()
          },
          isWithinGeofence: true,
          status: 'inside'
        });

        await locationStatus.save();
      } else {
        // Reset timer for existing location status (new check-in session)
        locationStatus.outsideTimer = {
          isActive: false,
          startTime: null,
          totalTimeOutside: 0,
          currentSessionStart: null
        };
        locationStatus.status = 'inside';
        locationStatus.isWithinGeofence = true;
        locationStatus.isActive = true;
        locationStatus.attendanceLog = attendanceLogId;
        await locationStatus.save();
      }

      // Add to active tracking
      if (!this.activeTracking.has(eventId)) {
        this.activeTracking.set(eventId, new Set());
      }
      this.activeTracking.get(eventId).add(participantId);

      return locationStatus;
    } catch (error) {
      console.error('Error initializing location tracking:', error);
      throw error;
    }
  }

  // Update participant location
  async updateParticipantLocation(eventId, participantId, latitude, longitude, accuracy = 0) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      let locationStatus = await ParticipantLocationStatus.findOne({
        event: eventId,
        participant: participantId
      }).populate('participant', 'name email');

      if (!locationStatus) {
        throw new Error('Location status not found. Please initialize tracking first.');
      }

      // Calculate distance from event center
      const distanceFromCenter = this.calculateDistance(
        latitude,
        longitude,
        event.location.coordinates.coordinates[1], // latitude
        event.location.coordinates.coordinates[0]  // longitude
      );

      // Check if within geofence
      const wasWithinGeofence = locationStatus.isWithinGeofence;
      const isWithinGeofence = this.isWithinGeofence(
        latitude,
        longitude,
        event.location.coordinates.coordinates,
        event.geofenceRadius
      );

      // Update location data
      locationStatus.currentLocation = {
        latitude,
        longitude,
        accuracy,
        timestamp: new Date()
      };
      locationStatus.distanceFromCenter = Math.round(distanceFromCenter);
      locationStatus.isWithinGeofence = isWithinGeofence;

      // Handle geofence status change
      if (wasWithinGeofence && !isWithinGeofence) {
        // Participant left the geofence
        await this.handleParticipantLeftGeofence(locationStatus, event);
      } else if (!wasWithinGeofence && isWithinGeofence) {
        // Participant returned to the geofence
        await this.handleParticipantReturnedToGeofence(locationStatus, event);
      }

      // Update status based on current state and timer
      await this.updateParticipantStatus(locationStatus, event);

      await locationStatus.save();
      return locationStatus;
    } catch (error) {
      console.error('Error updating participant location:', error);
      throw error;
    }
  }

  // Handle participant leaving geofence
  async handleParticipantLeftGeofence(locationStatus, event) {
    console.log(`Participant ${locationStatus.participant.name} left geofence for event ${event.title}`);
    
    // Start outside timer
    locationStatus.startOutsideTimer();
    locationStatus.status = 'outside';

    // Set up monitoring timer for this participant
    this.startMonitoringTimer(locationStatus._id, event.maxTimeOutside);
  }

  // Handle participant returning to geofence
  async handleParticipantReturnedToGeofence(locationStatus, event) {
    console.log(`Participant ${locationStatus.participant.name} returned to geofence for event ${event.title}`);
    
    // Stop outside timer
    locationStatus.stopOutsideTimer();
    locationStatus.status = 'inside';

    // Add return alert
    locationStatus.addAlert('returned');

    // Clear monitoring timer
    this.clearMonitoringTimer(locationStatus._id);
  }

  // Update participant status based on timer and limits
  async updateParticipantStatus(locationStatus, event) {
    // Check if data is stale (>3 minutes since last update) - Changed from 5 to 3
    const now = new Date();
    const minutesSinceUpdate = (now - new Date(locationStatus.lastLocationUpdate)) / (1000 * 60);
    const isStale = minutesSinceUpdate > 3;

    console.log(`🔍 [STATUS CHECK] Participant: ${locationStatus.participant?.name || locationStatus.participant}`);
    console.log(`📊 [STATUS CHECK] Minutes since update: ${Math.round(minutesSinceUpdate)}, Is stale: ${isStale}`);
    console.log(`📊 [STATUS CHECK] Event max time outside: ${event.maxTimeOutside} minutes`);

    // Calculate total time (outside + stale time)
    let totalTime = 0;

    if (locationStatus.outsideTimer.isActive) {
      totalTime = locationStatus.calculateTotalTimeOutside();
      console.log(`⏱️ [TIMER] Active outside timer: ${totalTime}s (${Math.floor(totalTime / 60)} min)`);
    } else if (isStale) {
      // If stale, activate timer and count time AFTER the 3-minute stale threshold
      console.log(`⚠️ [STALE DATA] Participant data is stale (${Math.round(minutesSinceUpdate)} min). Activating timer.`);

      // Calculate the time when data became stale (3 minutes after last update)
      const staleThresholdTime = new Date(new Date(locationStatus.lastLocationUpdate).getTime() + (3 * 60 * 1000));

      // Activate the timer starting from when data became stale (not from last update)
      locationStatus.outsideTimer.isActive = true;
      locationStatus.outsideTimer.startTime = staleThresholdTime;
      locationStatus.outsideTimer.currentSessionStart = staleThresholdTime;

      // Start monitoring timer for stale participants (if not already running)
      this.startMonitoringTimer(locationStatus._id, event.maxTimeOutside);

      // Count time AFTER the 3-minute stale threshold (not the entire stale time)
      const timeAfterStaleThreshold = minutesSinceUpdate - 3; // Minutes after stale threshold
      totalTime = Math.floor(Math.max(0, timeAfterStaleThreshold) * 60); // Convert to seconds, ensure non-negative

      console.log(`⏱️ [STALE TIMER] Stale threshold reached 3 min ago. Countdown started: ${totalTime}s (${Math.floor(totalTime / 60)} min)`);
      console.log(`⏱️ [STALE TIMER] Started monitoring timer to check every 1 second`);
    }

    const maxTimeOutsideSeconds = event.maxTimeOutside * 60; // Convert minutes to seconds

    console.log(`📊 [LIMIT CHECK] Total time: ${totalTime}s (${Math.floor(totalTime / 60)} min) / Max: ${maxTimeOutsideSeconds}s (${event.maxTimeOutside} min)`);
    console.log(`📊 [LIMIT CHECK] Will trigger absence: ${totalTime >= maxTimeOutsideSeconds}`);

    // Safety check: If maxTimeOutside is 0 or not set, use default of 15 minutes
    if (!event.maxTimeOutside || event.maxTimeOutside === 0) {
      console.log(`⚠️ [WARNING] Event maxTimeOutside not set, using default 15 minutes`);
      event.maxTimeOutside = 15;
    }

    // Check if limit exceeded
    if (totalTime >= maxTimeOutsideSeconds) {
      console.log(`🚫 [ABSENCE TRIGGER] Time limit exceeded! Total: ${totalTime}s / Max: ${maxTimeOutsideSeconds}s`);

      locationStatus.status = 'absent';

      // Send exceeded limit alert if not already sent
      const hasExceededAlert = locationStatus.alertsSent.some(
        alert => alert.type === 'exceeded_limit' && !alert.acknowledged
      );
      if (!hasExceededAlert) {
        console.log(`📢 [ALERT] Sending exceeded limit alert and marking absent`);
        locationStatus.addAlert('exceeded_limit');

        // Mark attendance as absent and deactivate tracking
        await this.markAttendanceAsAbsent(locationStatus, isStale);

        // Deactivate location tracking for this participant
        locationStatus.isActive = false;
        locationStatus.stopOutsideTimer();

        // Clear monitoring timer
        this.clearMonitoringTimer(locationStatus._id);

        console.log(`✅ [TRACKING STOPPED] Participant removed from active tracking`);
      }
    } else if (totalTime >= maxTimeOutsideSeconds * 0.8) {
      locationStatus.status = 'warning';

      // Send warning alert if not already sent
      const hasWarningAlert = locationStatus.alertsSent.some(
        alert => alert.type === 'warning' && !alert.acknowledged
      );
      if (!hasWarningAlert) {
        locationStatus.addAlert('warning');
      }
    } else if (!locationStatus.isWithinGeofence) {
      locationStatus.status = 'outside';
    } else {
      locationStatus.status = 'inside';
    }
  }

  // Mark attendance as absent when limit exceeded
  async markAttendanceAsAbsent(locationStatus, isStale) {
    try {
      const AttendanceLog = require('../models/AttendanceLog');

      const attendanceLog = await AttendanceLog.findById(locationStatus.attendanceLog);
      if (!attendanceLog) {
        console.error('Attendance log not found:', locationStatus.attendanceLog);
        return;
      }

      // Only mark as absent if currently checked in
      if (attendanceLog.status === 'checked-in') {
        attendanceLog.status = 'absent';
        attendanceLog.checkOutTime = new Date();

        const reason = isStale
          ? 'Automatically marked absent - location data became stale and exceeded time limit'
          : 'Automatically marked absent - exceeded maximum time outside premises';

        attendanceLog.notes = attendanceLog.notes
          ? `${attendanceLog.notes}\n\n${reason}`
          : reason;

        await attendanceLog.save();

        console.log(`✅ Marked attendance as absent for participant ${locationStatus.participant} - ${reason}`);
      }
    } catch (error) {
      console.error('Error marking attendance as absent:', error);
    }
  }

  // Start monitoring timer for a participant
  startMonitoringTimer(statusId, maxTimeOutsideMinutes) {
    // Clear existing timer if any
    this.clearMonitoringTimer(statusId);

    // Set timer to check status periodically
    const timer = setInterval(async () => {
      try {
        const locationStatus = await ParticipantLocationStatus.findById(statusId)
          .populate('event')
          .populate('participant', 'name email');

        if (!locationStatus || !locationStatus.outsideTimer.isActive) {
          this.clearMonitoringTimer(statusId);
          return;
        }

        await this.updateParticipantStatus(locationStatus, locationStatus.event);
        await locationStatus.save();

      } catch (error) {
        console.error('Error in monitoring timer:', error);
      }
    }, 1000); // Check every 1 second for immediate response

    this.timers.set(statusId.toString(), timer);
  }

  // Clear monitoring timer
  clearMonitoringTimer(statusId) {
    const timer = this.timers.get(statusId.toString());
    if (timer) {
      clearInterval(timer);
      this.timers.delete(statusId.toString());
    }
  }

  // Stop location tracking for a participant
  async stopLocationTracking(eventId, participantId) {
    try {
      const locationStatus = await ParticipantLocationStatus.findOne({
        event: eventId,
        participant: participantId
      });

      if (locationStatus) {
        // Stop any active timer
        locationStatus.stopOutsideTimer();
        locationStatus.isActive = false;
        await locationStatus.save();

        // Clear monitoring timer
        this.clearMonitoringTimer(locationStatus._id);
      }

      // Remove from active tracking
      const eventTracking = this.activeTracking.get(eventId);
      if (eventTracking) {
        eventTracking.delete(participantId);
        if (eventTracking.size === 0) {
          this.activeTracking.delete(eventId);
        }
      }

      return locationStatus;
    } catch (error) {
      console.error('Error stopping location tracking:', error);
      throw error;
    }
  }

  // Get all participants location status for an event
  async getEventLocationStatus(eventId) {
    try {
      // Get ALL participants (including inactive/absent) for display
      const locationStatuses = await ParticipantLocationStatus.find({
        event: eventId
      })
      .populate('participant', 'name email')
      .populate('event', 'title maxTimeOutside')
      .sort({ 'participant.name': 1 });

      // Calculate real-time values and check for stale data
      const statusesWithRealtime = await Promise.all(locationStatuses.map(async status => {
        const statusObj = status.toObject();
        const now = new Date();
        const minutesSinceUpdate = (now - new Date(status.lastLocationUpdate)) / (1000 * 60);
        const isStale = minutesSinceUpdate > 3; // Changed from 5 to 3

        // Check if should be marked absent (this will activate timer if stale)
        if (isStale || status.outsideTimer.isActive) {
          await this.updateParticipantStatus(status, status.event);
          await status.save();
          statusObj.outsideTimer = status.outsideTimer;
          statusObj.status = status.status;
        }

        // Calculate current time outside
        if (status.outsideTimer.isActive) {
          statusObj.currentTimeOutside = status.calculateTotalTimeOutside();
        } else {
          statusObj.currentTimeOutside = status.outsideTimer.totalTimeOutside;
        }

        return statusObj;
      }));

      return statusesWithRealtime;
    } catch (error) {
      console.error('Error getting event location status:', error);
      throw error;
    }
  }

  // Acknowledge alert
  async acknowledgeAlert(statusId, alertId) {
    try {
      const locationStatus = await ParticipantLocationStatus.findById(statusId);
      if (!locationStatus) {
        throw new Error('Location status not found');
      }

      const alert = locationStatus.alertsSent.id(alertId);
      if (alert) {
        alert.acknowledged = true;
        await locationStatus.save();
      }

      return locationStatus;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  // Check for stale participants and mark absent if needed
  async checkStaleParticipantsForEvent(eventId) {
    try {
      console.log(`🔍 [STALE CHECK] Checking stale participants for event ${eventId}`);

      const locationStatuses = await ParticipantLocationStatus.find({
        event: eventId,
        isActive: true
      })
      .populate('participant', 'name email')
      .populate('event', 'title maxTimeOutside');

      if (locationStatuses.length === 0) {
        console.log('📭 [STALE CHECK] No active participants to check');
        return;
      }

      console.log(`📊 [STALE CHECK] Found ${locationStatuses.length} active participants`);

      for (const status of locationStatuses) {
        const now = new Date();
        const minutesSinceUpdate = (now - new Date(status.lastLocationUpdate)) / (1000 * 60);
        const isStale = minutesSinceUpdate > 3; // Changed from 5 to 3

        if (isStale || status.outsideTimer.isActive) {
          console.log(`⚠️ [STALE CHECK] Checking ${status.participant.name}: ${Math.round(minutesSinceUpdate)} min since last update`);
          await this.updateParticipantStatus(status, status.event);
          await status.save();
        }
      }

      console.log('✅ [STALE CHECK] Completed stale participant check');
    } catch (error) {
      console.error('❌ [STALE CHECK] Error checking stale participants:', error);
      throw error;
    }
  }

  // Cleanup inactive tracking
  cleanup() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.activeTracking.clear();
  }
}

module.exports = new LocationTrackingService();