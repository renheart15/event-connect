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
    if (!locationStatus.isWithinGeofence && locationStatus.outsideTimer.isActive) {
      const totalTimeOutside = locationStatus.calculateTotalTimeOutside();
      const maxTimeOutsideSeconds = event.maxTimeOutside * 60; // Convert minutes to seconds

      if (totalTimeOutside >= maxTimeOutsideSeconds) {
        locationStatus.status = 'exceeded_limit';
        
        // Send exceeded limit alert if not already sent
        const hasExceededAlert = locationStatus.alertsSent.some(
          alert => alert.type === 'exceeded_limit' && !alert.acknowledged
        );
        if (!hasExceededAlert) {
          locationStatus.addAlert('exceeded_limit');
        }
      } else if (totalTimeOutside >= maxTimeOutsideSeconds * 0.8) {
        locationStatus.status = 'warning';
        
        // Send warning alert if not already sent
        const hasWarningAlert = locationStatus.alertsSent.some(
          alert => alert.type === 'warning' && !alert.acknowledged
        );
        if (!hasWarningAlert) {
          locationStatus.addAlert('warning');
        }
      }
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
    }, 30000); // Check every 30 seconds

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
      const locationStatuses = await ParticipantLocationStatus.find({
        event: eventId,
        isActive: true
      })
      .populate('participant', 'name email')
      .populate('event', 'title maxTimeOutside')
      .sort({ 'participant.name': 1 });

      // Calculate real-time values for active timers
      const statusesWithRealtime = locationStatuses.map(status => {
        const statusObj = status.toObject();
        if (status.outsideTimer.isActive) {
          statusObj.currentTimeOutside = status.calculateTotalTimeOutside();
        } else {
          statusObj.currentTimeOutside = status.outsideTimer.totalTimeOutside;
        }
        return statusObj;
      });

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