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
        // NOTE: Start with placeholder coordinates (0,0) and default status
        // First location update will establish actual position without triggering alerts
        locationStatus = new ParticipantLocationStatus({
          event: eventId,
          participant: participantId,
          attendanceLog: attendanceLogId,
          currentLocation: {
            latitude: 0,
            longitude: 0, // Placeholder - indicates no real location yet
            timestamp: new Date()
          },
          isWithinGeofence: false, // Default - will be set on first real update
          status: 'outside' // Default - will be set on first real update
        });

        await locationStatus.save();
      } else {
        // Only reset timer if this is a NEW check-in session (different attendance log)
        // If same attendance log, participant just reopened the app - preserve timer data
        const isSameSession = locationStatus.attendanceLog?.toString() === attendanceLogId;

        if (!isSameSession) {
          // New check-in session - reset timer only, preserve location status
          console.log('🔄 [LOCATION-INIT] New check-in session detected, resetting timer');
          locationStatus.outsideTimer = {
            isActive: false,
            startTime: null,
            totalTimeOutside: 0,
            currentSessionStart: null
          };
          // Don't force location status - let the next location update determine this
          console.log('🔄 [LOCATION-INIT] Preserving location status - will be updated on next location update');
        } else {
          console.log('🔄 [LOCATION-INIT] Same session (app reopened), preserving timer data');
        }

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
  async updateParticipantLocation(eventId, participantId, latitude, longitude, accuracy = 0, batteryLevel = null) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // CRITICAL FIX: Don't process location updates for completed events
      if (event.status === 'completed') {
        console.log(`⏹️ [LOCATION UPDATE] Event "${event.title}" is completed, skipping location update`);
        return null; // Return null to indicate update was skipped
      }

      let locationStatus = await ParticipantLocationStatus.findOne({
        event: eventId,
        participant: participantId
      }).populate('participant', 'name email');

      if (!locationStatus) {
        throw new Error('Location status not found. Please initialize tracking first.');
      }

      // CRITICAL FIX: Skip location updates for inactive participants (marked absent)
      if (!locationStatus.isActive) {
        console.log(`⏹️ [LOCATION UPDATE] Skipping update for inactive participant: ${locationStatus.participant.name} (marked absent)`);
        return locationStatus;
      }

      // Log battery level if provided
      if (batteryLevel !== null && batteryLevel !== undefined) {
        console.log(`🔋 [BATTERY] Participant ${locationStatus.participant.name}: ${batteryLevel}%`);
        if (batteryLevel < 20) {
          console.warn(`⚠️ [LOW BATTERY] Participant ${locationStatus.participant.name} has low battery: ${batteryLevel}%`);
        }
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

      // CRITICAL FIX: Manually update lastLocationUpdate only when receiving new location data
      // This ensures stale detection works correctly (no longer updated by pre-save hook)
      locationStatus.lastLocationUpdate = new Date();

      // AUTO-CHECK-IN: If participant is registered but not checked in, auto-check them in when entering geofence
      const attendanceLog = await AttendanceLog.findById(locationStatus.attendanceLog);
      if (attendanceLog && attendanceLog.status === 'registered' && isWithinGeofence && event.status === 'active') {
        console.log(`🔄 [AUTO-CHECK-IN] Participant ${locationStatus.participant.name} entered geofence and event is active. Auto-checking in...`);

        // Update attendance log to checked-in
        attendanceLog.checkInTime = new Date();
        attendanceLog.checkInLocation = {
          latitude,
          longitude
        };
        attendanceLog.status = 'checked-in';
        await attendanceLog.save();

        console.log(`✅ [AUTO-CHECK-IN] Participant ${locationStatus.participant.name} automatically checked in`);
      }

      // CRITICAL FIX: Check if this is the first real location update (initial state)
      // If current location is at 0,0, this is the first update - don't trigger alerts
      const isFirstLocationUpdate = locationStatus.currentLocation.latitude === 0 && locationStatus.currentLocation.longitude === 0;

      if (isFirstLocationUpdate) {
        console.log(`📍 [FIRST-UPDATE] First location update for ${locationStatus.participant.name} - setting initial state, no alerts`);
        // Just update the location, don't trigger any geofence change handlers
      } else {
        // Handle geofence status change (only for subsequent updates)
        if (wasWithinGeofence && !isWithinGeofence) {
          // Participant left the geofence
          await this.handleParticipantLeftGeofence(locationStatus, event);
        } else if (!wasWithinGeofence && isWithinGeofence) {
          // Participant returned to the geofence
          await this.handleParticipantReturnedToGeofence(locationStatus, event);
        }
      }

      // Update status based on current state and timer
      await this.updateParticipantStatus(locationStatus, event);

      // CRITICAL FIX: Re-check if participant is still active before saving
      // Prevents race condition where cleanup runs during location update processing
      const freshStatus = await ParticipantLocationStatus.findById(locationStatus._id);
      if (!freshStatus || !freshStatus.isActive) {
        console.log(`⏹️ [RACE CONDITION] Participant deactivated during update, discarding changes`);
        return freshStatus || locationStatus;
      }

      // Only save if still active
      try {
        await locationStatus.save();

        // DEBUG: Log alerts after save to verify they persisted
        if (locationStatus.alertsSent.length > 0) {
          const latestAlert = locationStatus.alertsSent[locationStatus.alertsSent.length - 1];
          console.log(`✅ [SAVE] Saved location status. Latest alert: type="${latestAlert.type}", timestamp=${latestAlert.timestamp}`);
        }
      } catch (saveError) {
        console.error(`❌ [SAVE-ERROR] Failed to save location status:`, saveError);
        // Check if it's a validation error
        if (saveError.name === 'ValidationError') {
          console.error(`❌ [VALIDATION-ERROR] Validation errors:`, saveError.errors);
          // Log specific field errors
          if (saveError.errors.alertsSent) {
            console.error(`❌ [ALERT-VALIDATION] Alert validation failed:`, saveError.errors.alertsSent);
          }
        }
        throw saveError;
      }

      return locationStatus;
    } catch (error) {
      console.error('Error updating participant location:', error);
      throw error;
    }
  }

  // Handle participant leaving geofence
  async handleParticipantLeftGeofence(locationStatus, event) {
    console.log(`🚪 [LEFT-GEOFENCE] Participant ${locationStatus.participant.name} left geofence for event ${event.title}`);

    // Start outside timer with reason 'outside'
    locationStatus.startOutsideTimer();
    if (locationStatus.outsideTimer) {
      locationStatus.outsideTimer.reason = 'outside';
    }
    locationStatus.status = 'outside';

    // CRITICAL FIX: Add alert when participant leaves geofence
    console.log(`📢 [LEFT-GEOFENCE] Adding 'left_geofence' alert for ${locationStatus.participant.name}`);
    locationStatus.addAlert('left_geofence');
    console.log(`📢 [LEFT-GEOFENCE] Alert added. Total alerts: ${locationStatus.alertsSent.length}, Latest alert type: "${locationStatus.alertsSent[locationStatus.alertsSent.length - 1]?.type}"`);

    // Set up monitoring timer for this participant
    this.startMonitoringTimer(locationStatus._id, event.maxTimeOutside);
  }

  // Handle participant returning to geofence
  async handleParticipantReturnedToGeofence(locationStatus, event) {
    console.log(`Participant ${locationStatus.participant.name} returned to geofence for event ${event.title}`);

    // Pause outside timer (preserves accumulated time)
    locationStatus.pauseOutsideTimer();
    locationStatus.status = 'inside';
    if (locationStatus.outsideTimer) {
      locationStatus.outsideTimer.reason = null;
    }

    // Add return alert
    locationStatus.addAlert('returned');

    // Clear monitoring timer
    this.clearMonitoringTimer(locationStatus._id);
  }

  // Update participant status based on timer and limits
  async updateParticipantStatus(locationStatus, event) {
    // CRITICAL FIX: Skip status updates for inactive participants (marked absent)
    if (!locationStatus.isActive) {
      console.log(`⏹️ [STATUS CHECK SKIPPED] Participant ${locationStatus.participant?.name || locationStatus.participant} is inactive (marked absent)`);
      return;
    }

    // Check if data is stale (>3 minutes since last update) - Changed from 5 to 3
    const now = new Date();
    const minutesSinceUpdate = (now - new Date(locationStatus.lastLocationUpdate)) / (1000 * 60);
    const isStale = minutesSinceUpdate > 3;

    console.log(`🔍 [STATUS CHECK] Participant: ${locationStatus.participant?.name || locationStatus.participant}`);
    console.log(`📊 [STATUS CHECK] Minutes since update: ${Math.round(minutesSinceUpdate)}, Is stale: ${isStale}`);
    console.log(`📊 [STATUS CHECK] Event max time outside: ${event.maxTimeOutside} minutes`);

    // Calculate total time (outside + stale time)
    let totalTime = 0;

    // Check if participant was stale and is now back
    const wasStale = locationStatus.outsideTimer?.isActive && locationStatus.outsideTimer?.reason === 'stale';

    if (wasStale && !isStale) {
      // Participant returned from being stale - preserve accumulated time
      console.log(`✅ [RETURNED FROM STALE] Participant data is fresh again. Preserving accumulated time.`);

      // Pause the stale timer and preserve the total time
      locationStatus.pauseOutsideTimer();

      // If they're still outside the geofence, restart timer with reason 'outside'
      if (!locationStatus.isWithinGeofence) {
        console.log(`🔄 [TIMER RESTARTED] Participant still outside geofence. Restarting timer with reason 'outside'.`);
        locationStatus.startOutsideTimer();
        if (locationStatus.outsideTimer) {
          locationStatus.outsideTimer.reason = 'outside';
        }
        locationStatus.status = 'outside';

        // CRITICAL FIX: Restart monitoring timer (previously stopped when pauseOutsideTimer was called)
        this.startMonitoringTimer(locationStatus._id, event.maxTimeOutside);
      } else {
        console.log(`✅ [TIMER CLEARED] Participant inside geofence. Timer cleared.`);
        locationStatus.status = 'inside';

        // CRITICAL FIX: Explicitly stop timer when returning from stale while inside
        // Don't rely on pauseOutsideTimer() which may fail if currentSessionStart is null
        if (locationStatus.outsideTimer) {
          locationStatus.outsideTimer.isActive = false;
          locationStatus.outsideTimer.reason = null;
          locationStatus.outsideTimer.currentSessionStart = null;
        }

        // CRITICAL FIX: Clear monitoring timer when returning from stale and inside geofence
        this.clearMonitoringTimer(locationStatus._id);
        console.log(`✅ [MONITORING TIMER CLEARED] Stopped background monitoring timer`);
      }

      if (locationStatus.outsideTimer) {
        console.log(`⏱️ [TIMER PRESERVED] Total time preserved: ${locationStatus.outsideTimer.totalTimeOutside}s (${Math.floor(locationStatus.outsideTimer.totalTimeOutside / 60)} min)`);
      }
    }

    if (locationStatus.outsideTimer?.isActive) {
      totalTime = locationStatus.calculateTotalTimeOutside();
      console.log(`⏱️ [TIMER] Active outside timer: ${totalTime}s (${Math.floor(totalTime / 60)} min)`);
    } else if (isStale && locationStatus.outsideTimer) {
      // If stale, activate timer and count time AFTER the 3-minute stale threshold
      // This applies regardless of whether they're inside or outside
      console.log(`⚠️ [STALE DATA] Participant data is stale (${Math.round(minutesSinceUpdate)} min). Activating timer.`);

      // Calculate the time when data became stale (3 minutes after last update)
      const staleThresholdTime = new Date(new Date(locationStatus.lastLocationUpdate).getTime() + (3 * 60 * 1000));

      // Activate the timer starting from when data became stale (not from last update)
      locationStatus.outsideTimer.isActive = true;
      locationStatus.outsideTimer.reason = 'stale'; // Mark as stale timer
      locationStatus.outsideTimer.startTime = staleThresholdTime;
      locationStatus.outsideTimer.currentSessionStart = staleThresholdTime;

      // Start monitoring timer for stale participants (if not already running)
      this.startMonitoringTimer(locationStatus._id, event.maxTimeOutside);

      // CRITICAL FIX: Include previously accumulated time + new stale time
      const timeAfterStaleThreshold = minutesSinceUpdate - 3; // Minutes after stale threshold
      const newStaleTime = Math.floor(Math.max(0, timeAfterStaleThreshold) * 60); // Convert to seconds
      totalTime = locationStatus.outsideTimer.totalTimeOutside + newStaleTime; // Add to accumulated time

      console.log(`⏱️ [STALE TIMER] Previously accumulated: ${locationStatus.outsideTimer.totalTimeOutside}s (${Math.floor(locationStatus.outsideTimer.totalTimeOutside / 60)} min)`);
      console.log(`⏱️ [STALE TIMER] New stale time: ${newStaleTime}s (${Math.floor(newStaleTime / 60)} min)`);
      console.log(`⏱️ [STALE TIMER] Total time: ${totalTime}s (${Math.floor(totalTime / 60)} min)`);
      console.log(`⏱️ [STALE TIMER] Started monitoring timer to check every 1 second`);
    }

    // CRITICAL FIX: Safety check BEFORE calculating maxTimeOutsideSeconds
    // If maxTimeOutside is 0 or not set, use default of 15 minutes
    if (!event.maxTimeOutside || event.maxTimeOutside === 0) {
      console.log(`⚠️ [WARNING] Event maxTimeOutside not set or is 0, using default 15 minutes`);
      event.maxTimeOutside = 15;
    }

    const maxTimeOutsideSeconds = event.maxTimeOutside * 60; // Convert minutes to seconds

    console.log(`📊 [LIMIT CHECK] Total time: ${totalTime}s (${Math.floor(totalTime / 60)} min) / Max: ${maxTimeOutsideSeconds}s (${event.maxTimeOutside} min)`);
    console.log(`📊 [LIMIT CHECK] Will trigger absence: ${totalTime >= maxTimeOutsideSeconds}`);

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
        locationStatus.pauseOutsideTimer();

        // Clear monitoring timer
        this.clearMonitoringTimer(locationStatus._id);

        console.log(`✅ [TRACKING STOPPED] Participant removed from active tracking`);
      }
    }
    // COMMENTED OUT: Warning alerts at 80% of time limit
    // else if (totalTime >= maxTimeOutsideSeconds * 0.8) {
    //   locationStatus.status = 'warning';

    //   // Send warning alert if not already sent
    //   const hasWarningAlert = locationStatus.alertsSent.some(
    //     alert => alert.type === 'warning' && !alert.acknowledged
    //   );
    //   if (!hasWarningAlert) {
    //     locationStatus.addAlert('warning');
    //   }
    // }
    else if (!locationStatus.isWithinGeofence) {
      locationStatus.status = 'outside';
    } else if (!isStale) {
      // CRITICAL FIX: Only execute this block if participant is inside AND NOT STALE
      // If they're stale, the timer should remain active (already set above)
      locationStatus.status = 'inside';

      // If timer is active while inside and not stale, stop it completely
      if (locationStatus.outsideTimer?.isActive) {
        console.log(`⏹️ [TIMER STOPPED] Participant is inside and not stale. Stopping active timer.`);
        locationStatus.outsideTimer.isActive = false;
        locationStatus.outsideTimer.reason = null;
        locationStatus.outsideTimer.currentSessionStart = null;
        this.clearMonitoringTimer(locationStatus._id);
      } else if (locationStatus.outsideTimer) {
        // Timer already inactive, just clear reason
        locationStatus.outsideTimer.reason = null;
      }
    } else {
      // Participant is inside but stale - timer is already active (set above)
      // Just set the status, don't touch the timer
      locationStatus.status = 'inside';
      console.log(`⏱️ [STALE INSIDE] Participant inside but stale. Timer remains active.`);
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

      // Mark as absent regardless of current status (even if already checked-out)
      // This ensures participants who exceeded time limits are properly marked as absent
      const previousStatus = attendanceLog.status;
      attendanceLog.status = 'absent';

      // Set checkout time if not already set
      if (!attendanceLog.checkOutTime) {
        attendanceLog.checkOutTime = new Date();
      }

      const reason = isStale
        ? 'Automatically marked absent - location data became stale and exceeded time limit'
        : 'Automatically marked absent - exceeded maximum time outside premises';

      attendanceLog.notes = attendanceLog.notes
        ? `${attendanceLog.notes}\n\n${reason}`
        : reason;

      await attendanceLog.save();

      console.log(`✅ Marked attendance as absent for participant ${locationStatus.participant} (was: ${previousStatus}, now: absent) - ${reason}`);
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

        // CRITICAL FIX: Stop monitoring if participant is inactive (marked absent) or timer not active
        if (!locationStatus || !locationStatus.isActive || !locationStatus.outsideTimer?.isActive) {
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
        // Pause any active timer (preserves accumulated time)
        locationStatus.pauseOutsideTimer();
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
      .populate('attendanceLog', 'registrationName registrationEmail status checkOutTime') // Populate attendance log for registration data AND checkout status
      .sort({ 'participant.name': 1 });

      // Calculate real-time values and check for stale data
      const statusesWithRealtime = await Promise.all(locationStatuses.map(async status => {
        const statusObj = status.toObject();
        const now = new Date();
        const minutesSinceUpdate = (now - new Date(status.lastLocationUpdate)) / (1000 * 60);
        const isStale = minutesSinceUpdate > 3; // Changed from 5 to 3

        // CRITICAL FIX: Only check stale data and update status for ACTIVE participants
        // Skip this entire check for participants marked absent (isActive: false)
        if (status.isActive && (isStale || status.outsideTimer?.isActive)) {
          await this.updateParticipantStatus(status, status.event);
          await status.save();
          statusObj.outsideTimer = status.outsideTimer;
          statusObj.status = status.status;
        }

        // Calculate current time outside
        if (status.outsideTimer?.isActive) {
          statusObj.currentTimeOutside = status.calculateTotalTimeOutside();
        } else {
          statusObj.currentTimeOutside = status.outsideTimer?.totalTimeOutside || 0;
        }

        // PRIORITIZATION: Use registration data from attendance log if available, otherwise use user account data
        if (statusObj.attendanceLog) {
          // Priority 1: Registration response data from attendance log
          if (statusObj.attendanceLog.registrationName && statusObj.attendanceLog.registrationName.trim() !== '') {
            statusObj.participant.name = statusObj.attendanceLog.registrationName;
            console.log(`📝 [LOCATION-STATUS] Using registration name for participant ${statusObj.participant._id}: "${statusObj.participant.name}"`);
          }

          if (statusObj.attendanceLog.registrationEmail && statusObj.attendanceLog.registrationEmail.trim() !== '') {
            statusObj.participant.email = statusObj.attendanceLog.registrationEmail;
            console.log(`📝 [LOCATION-STATUS] Using registration email for participant ${statusObj.participant._id}: "${statusObj.participant.email}"`);
          }
        }
        // Priority 2: User account data (already populated by default)

        return statusObj;
      }));

      // CRITICAL FIX: Filter out checked-out and registered participants from location tracking display
      // Only show participants who are actually checked-in or absent
      const activeParticipants = statusesWithRealtime.filter(status => {
        // Exclude if attendance log shows checked-out status
        if (status.attendanceLog && status.attendanceLog.status === 'checked-out') {
          console.log(`🚫 [LOCATION-STATUS] Filtering out checked-out participant: ${status.participant.name}`);
          return false;
        }
        // CRITICAL FIX: Exclude registered participants (not yet checked in)
        if (status.attendanceLog && status.attendanceLog.status === 'registered') {
          console.log(`🚫 [LOCATION-STATUS] Filtering out registered participant: ${status.participant.name}`);
          return false;
        }
        return true;
      });

      return activeParticipants;
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

        if (isStale || status.outsideTimer?.isActive) {
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

  // Stop location tracking for all participants in an event (when event completes)
  async stopAllTrackingForEvent(eventId) {
    try {
      console.log(`🛑 [CLEANUP] Stopping all location tracking for event ${eventId}`);

      // Find all active location statuses for this event
      const locationStatuses = await ParticipantLocationStatus.find({
        event: eventId,
        isActive: true
      });

      console.log(`🛑 [CLEANUP] Found ${locationStatuses.length} active participant(s) to clean up`);

      let cleanedUp = 0;

      for (const locationStatus of locationStatuses) {
        try {
          // Pause any active timer (preserves accumulated time)
          locationStatus.pauseOutsideTimer();
          locationStatus.isActive = false;
          await locationStatus.save();

          // Clear monitoring timer
          this.clearMonitoringTimer(locationStatus._id);

          cleanedUp++;
        } catch (err) {
          console.error(`❌ [CLEANUP] Error cleaning up participant ${locationStatus.participant}:`, err.message);
        }
      }

      // Remove event from active tracking
      this.activeTracking.delete(eventId);

      console.log(`✅ [CLEANUP] Cleaned up ${cleanedUp} participant(s) for completed event`);

      return cleanedUp;
    } catch (error) {
      console.error('❌ [CLEANUP] Error stopping all tracking for event:', error);
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