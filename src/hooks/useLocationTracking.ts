import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_CONFIG } from '@/config';

interface LocationStatus {
  _id: string;
  event: {
    _id: string;
    title: string;
    maxTimeOutside: number; // in minutes
    geofenceRadius: number;
  };
  participant: {
    _id: string;
    name: string;
    email: string;
  };
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
  } | null;
  isWithinGeofence: boolean;
  distanceFromCenter: number;
  outsideTimer: {
    isActive: boolean;
    startTime?: string;
    totalTimeOutside: number;
    currentSessionStart?: string;
  };
  status: 'inside' | 'outside' | 'warning' | 'exceeded_limit' | 'absent';
  alertsSent: Array<{
    _id: string;
    type: 'warning' | 'exceeded_limit' | 'returned' | 'left_geofence';
    timestamp: string;
    acknowledged: boolean;
  }>;
  lastLocationUpdate: string;
  currentTimeOutside: number;
}

interface LocationSummary {
  totalParticipants: number;
  insideGeofence: number;
  outsideGeofence: number;
  warningStatus: number;
  exceededLimit: number;
  absent: number;
}

interface UseLocationTrackingReturn {
  locationStatuses: LocationStatus[];
  summary: LocationSummary | null;
  loading: boolean;
  error: string | null;
  refreshLocationData: () => Promise<void>;
  acknowledgeAlert: (statusId: string, alertId: string) => Promise<void>;
  lastFetchTime: Date | null;
}

export const useLocationTracking = (eventId: string): UseLocationTrackingReturn => {
  const [locationStatuses, setLocationStatuses] = useState<LocationStatus[]>([]);
  const [summary, setSummary] = useState<LocationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  const API_BASE = API_CONFIG.API_BASE;

  const fetchLocationData = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      const response = await axios.get(
        `${API_BASE}/location-tracking/event/${eventId}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000, // 10 second timeout
        }
      );

      if (response.data.success) {
        const participants = response.data.data.participants || [];
        setLocationStatuses(participants);

        // Recalculate summary to exclude absent participants from location counts
        const backendSummary = response.data.data.summary || null;
        if (backendSummary && participants.length > 0) {
          // Filter out absent participants for location counting
          const activeParticipants = participants.filter((p: LocationStatus) => p.status !== 'absent');

          const recalculatedSummary: LocationSummary = {
            totalParticipants: backendSummary.totalParticipants,
            insideGeofence: activeParticipants.filter((p: LocationStatus) => p.isWithinGeofence).length,
            outsideGeofence: activeParticipants.filter((p: LocationStatus) => !p.isWithinGeofence).length,
            warningStatus: activeParticipants.filter((p: LocationStatus) => p.status === 'warning').length,
            exceededLimit: activeParticipants.filter((p: LocationStatus) => p.status === 'exceeded_limit').length,
            absent: participants.filter((p: LocationStatus) => p.status === 'absent').length,
          };

          setSummary(recalculatedSummary);
        } else {
          setSummary(backendSummary);
        }

        setLastFetchTime(new Date()); // Track when we fetched the data
      } else {
        setError(response.data.message || 'Failed to fetch location data');
      }
    } catch (err: any) {
      console.error('Error fetching location data:', err);
      
      // Handle specific error cases
      if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        setError('Backend server is not running. Location tracking requires the backend API.');
      } else if (err.code === 'ECONNABORTED') {
        setError('Request timeout. Please check your connection.');
      } else {
        setError(err.response?.data?.message || 'Failed to fetch location data');
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const refreshLocationData = useCallback(async () => {
    setLoading(true);
    await fetchLocationData();
  }, [fetchLocationData]);

  const acknowledgeAlert = useCallback(async (statusId: string, alertId: string) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      await axios.post(
        `${API_BASE}/location-tracking/acknowledge-alert`,
        {
          statusId,
          alertId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Refresh data after acknowledging alert
      await fetchLocationData();
    } catch (err: any) {
      console.error('Error acknowledging alert:', err);
      throw new Error(err.response?.data?.message || 'Failed to acknowledge alert');
    }
  }, [fetchLocationData]);

  // Initial fetch and setup polling
  useEffect(() => {
    fetchLocationData();

    // Set up polling every 30 seconds
    const interval = setInterval(fetchLocationData, 30000);

    return () => clearInterval(interval);
  }, [fetchLocationData]);

  return {
    locationStatuses,
    summary,
    loading,
    error,
    refreshLocationData,
    acknowledgeAlert,
    lastFetchTime,
  };
};

// Hook for participant location updates (for participants to send their location)
export const useParticipantLocationUpdater = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = API_CONFIG.API_BASE;

  const startLocationTracking = useCallback(async (
    eventId: string,
    participantId: string,
    attendanceLogId: string
  ) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('No authentication token found');
      }

      const requestData = {
        eventId,
        participantId,
        attendanceLogId,
      };

      const endpoint = `${API_BASE}/location-tracking/initialize`;

      console.log('🚀 [LOCATION TRACKING] Initializing location tracking:', {
        endpoint,
        requestData,
        timestamp: new Date().toISOString()
      });

      const response = await axios.post(
        endpoint,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('✅ [LOCATION TRACKING] Initialize successful:', {
        response: response.data,
        timestamp: new Date().toISOString()
      });

      setIsTracking(true);
    } catch (err: any) {
      console.error('❌ [LOCATION TRACKING] Initialize failed:', {
        error: err.response?.data?.message || err.message,
        fullError: err,
        timestamp: new Date().toISOString()
      });
      setError(err.response?.data?.message || 'Failed to start location tracking');
      throw err;
    }
  }, []);

  const updateLocation = useCallback(async (
    eventId: string,
    participantId: string,
    latitude: number,
    longitude: number,
    accuracy?: number,
    batteryLevel?: number | null,
    retryCount: number = 0
  ) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [1000, 3000, 5000]; // Exponential backoff: 1s, 3s, 5s
    const REQUEST_TIMEOUT = 10000; // 10 seconds

    try {
      setError(null);

      // Check network connectivity
      if (!navigator.onLine) {
        console.warn('⚠️ [LOCATION UPDATE] No internet connection, will retry...');
        throw new Error('No internet connection');
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const payload: any = {
        eventId,
        participantId,
        latitude,
        longitude,
        accuracy,
      };

      if (batteryLevel !== null && batteryLevel !== undefined) {
        payload.batteryLevel = batteryLevel;
      }

      const endpoint = `${API_BASE}/location-tracking/update-location`;

      console.log('📍 [LOCATION UPDATE] Sending location update:', {
        endpoint,
        payload,
        timestamp: new Date().toISOString(),
        coords: {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 'N/A',
          battery: batteryLevel !== null ? `${batteryLevel}%` : 'N/A'
        },
        retryAttempt: retryCount
      });

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await axios.post(
        endpoint,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: REQUEST_TIMEOUT,
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      console.log('✅ [LOCATION UPDATE] Update successful:', {
        response: response.data,
        timestamp: new Date().toISOString(),
        retryAttempt: retryCount
      });

      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message;

      console.error('❌ [LOCATION UPDATE] Update failed:', {
        error: errorMessage,
        retryAttempt: retryCount,
        maxRetries: MAX_RETRIES,
        timestamp: new Date().toISOString()
      });

      // Retry logic for network/timeout errors
      const isRetryableError =
        err.code === 'ECONNABORTED' ||
        err.code === 'ERR_NETWORK' ||
        err.message?.includes('Network Error') ||
        err.message?.includes('timeout') ||
        err.message?.includes('connection') ||
        !navigator.onLine;

      if (isRetryableError && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount];
        console.warn(`⏳ [LOCATION UPDATE] Retrying in ${delay}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);

        await new Promise(resolve => setTimeout(resolve, delay));

        return updateLocation(
          eventId,
          participantId,
          latitude,
          longitude,
          accuracy,
          batteryLevel,
          retryCount + 1
        );
      }

      setError(errorMessage);
      throw err;
    }
  }, []);

  const stopLocationTracking = useCallback(async (
    eventId: string,
    participantId: string
  ) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      await axios.post(
        `${API_BASE}/location-tracking/stop`,
        {
          eventId,
          participantId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setIsTracking(false);
    } catch (err: any) {
      console.error('Error stopping location tracking:', err);
      setError(err.response?.data?.message || 'Failed to stop location tracking');
      throw err;
    }
  }, []);

  return {
    isTracking,
    error,
    startLocationTracking,
    updateLocation,
    stopLocationTracking,
  };
};