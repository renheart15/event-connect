import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_CONFIG } from '@/config';

interface LocationStatus {
  _id: string;
  event: string;
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
  };
  isWithinGeofence: boolean;
  distanceFromCenter: number;
  outsideTimer: {
    isActive: boolean;
    startTime?: string;
    totalTimeOutside: number;
    currentSessionStart?: string;
  };
  status: 'inside' | 'outside' | 'warning' | 'exceeded_limit';
  alertsSent: Array<{
    _id: string;
    type: 'warning' | 'exceeded_limit' | 'returned';
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
}

interface UseLocationTrackingReturn {
  locationStatuses: LocationStatus[];
  summary: LocationSummary | null;
  loading: boolean;
  error: string | null;
  refreshLocationData: () => Promise<void>;
  acknowledgeAlert: (statusId: string, alertId: string) => Promise<void>;
}

export const useLocationTracking = (eventId: string): UseLocationTrackingReturn => {
  const [locationStatuses, setLocationStatuses] = useState<LocationStatus[]>([]);
  const [summary, setSummary] = useState<LocationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setLocationStatuses(response.data.data.participants || []);
        setSummary(response.data.data.summary || null);
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

      await axios.post(
        `${API_BASE}/location-tracking/initialize`,
        {
          eventId,
          participantId,
          attendanceLogId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setIsTracking(true);
    } catch (err: any) {
      console.error('Error starting location tracking:', err);
      setError(err.response?.data?.message || 'Failed to start location tracking');
      throw err;
    }
  }, []);

  const updateLocation = useCallback(async (
    eventId: string,
    participantId: string,
    latitude: number,
    longitude: number,
    accuracy?: number
  ) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await axios.post(
        `${API_BASE}/location-tracking/update-location`,
        {
          eventId,
          participantId,
          latitude,
          longitude,
          accuracy,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (err: any) {
      console.error('Error updating location:', err);
      setError(err.response?.data?.message || 'Failed to update location');
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