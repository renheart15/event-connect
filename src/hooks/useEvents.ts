import { useState, useEffect, useCallback, useRef } from 'react';
import { API_CONFIG } from '@/config';

interface Event {
  _id: string;
  id: string;
  title: string;
  description?: string;
  eventType?: 'single-day' | 'multi-day';
  date: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  location: {
    address?: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    };
  } | string;
  status: 'upcoming' | 'active' | 'completed';
  published: boolean;
  totalParticipants: number;
  checkedIn: number;
  currentlyPresent: number;
  geofence: {
    center: [number, number];
    radius: number;
  };
  geofenceRadius?: number;
  eventCode?: string;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
}

interface UseEventsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  cacheTime?: number;
}

interface EventsCache {
  data: Event[];
  timestamp: number;
  isLoading: boolean;
}

// Global cache for events
let eventsCache: EventsCache | null = null;
const activeRequests = new Map<string, Promise<any>>();
const cacheSubscribers = new Set<() => void>();

// Helper function to process raw event data
const processEventData = (rawEvent: any): Event => {
  const processed = {
    ...rawEvent,
    id: rawEvent._id,
    location: typeof rawEvent.location === 'string'
      ? rawEvent.location
      : rawEvent.location?.address || 'Unknown',
    totalParticipants: rawEvent.totalParticipants || 0,
    checkedIn: rawEvent.checkedIn || 0,
    currentlyPresent: rawEvent.currentlyPresent || 0,
    geofence: {
      center: rawEvent.location?.coordinates?.coordinates
        ? [rawEvent.location.coordinates.coordinates[1], rawEvent.location.coordinates.coordinates[0]]
        : [0, 0],
      radius: rawEvent.geofenceRadius || 100
    }
  };

  return processed;
};

// Deduplicated fetch function
const fetchEventsData = async (): Promise<Event[]> => {
  const cacheKey = 'events';

  // Check if there's already an active request
  if (activeRequests.has(cacheKey)) {
    return activeRequests.get(cacheKey);
  }

  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No authentication token found for events fetch');
    return [];
  }

  const requestPromise = fetch(`${API_CONFIG.API_BASE}/events`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then(async (response) => {
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Authentication failed, user may need to log in again');
          return [];
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (!result.success) {
        console.error('Events API error:', result.message);
        return [];
      }

      // Process and cache the data
      const processedEvents = result.data?.events?.map(processEventData) || [];

      // Update global cache
      eventsCache = {
        data: processedEvents,
        timestamp: Date.now(),
        isLoading: false
      };

      // Notify all subscribers
      cacheSubscribers.forEach(callback => callback());

      return processedEvents;
    })
    .catch((error) => {
      console.error('Error fetching events:', error);
      // Return empty array instead of throwing to prevent app crashes
      return [];
    })
    .finally(() => {
      activeRequests.delete(cacheKey);
    });

  activeRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

export const useEvents = (options: UseEventsOptions = {}) => {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    cacheTime = 5 * 60 * 1000 // 5 minutes
  } = options;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(0);

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Subscribe to cache updates
  useEffect(() => {
    const updateFromCache = () => {
      if (!mountedRef.current) return;

      if (eventsCache) {
        setEvents(eventsCache.data);
        setLoading(eventsCache.isLoading);
        setLastRefresh(eventsCache.timestamp);
      }
    };

    cacheSubscribers.add(updateFromCache);
    return () => {
      cacheSubscribers.delete(updateFromCache);
    };
  }, []);

  // Check if cache is still valid
  const isCacheValid = useCallback(() => {
    if (!eventsCache) return false;
    const age = Date.now() - eventsCache.timestamp;
    return age < cacheTime;
  }, [cacheTime]);

  // Fetch events function
  const fetchEvents = useCallback(async (force = false) => {
    try {
      // Check cache first (unless forced refresh)
      if (!force && isCacheValid() && eventsCache) {
        setEvents(eventsCache.data);
        setLoading(false);
        setError(null);
        setLastRefresh(eventsCache.timestamp);
        return eventsCache.data;
      }

      setLoading(true);
      setError(null);

      const fetchedEvents = await fetchEventsData();

      if (mountedRef.current) {
        setEvents(fetchedEvents);
        setLoading(false);
        setLastRefresh(Date.now());
      }

      return fetchedEvents;
    } catch (err: any) {
      console.error('Error fetching events:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to load events');
        setLoading(false);

        // If we have cached data, use it despite the error
        if (eventsCache && eventsCache.data.length > 0) {
          setEvents(eventsCache.data);
        }
      }
      return [];
    }
  }, [isCacheValid]);

  // Refresh events (force fetch)
  const refreshEvents = useCallback(() => {
    return fetchEvents(true);
  }, [fetchEvents]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchEvents();
      }, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchEvents]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Update single event in cache
  const updateEvent = useCallback((eventId: string, updates: Partial<Event>) => {
    if (eventsCache) {
      const updatedEvents = eventsCache.data.map(event =>
        event.id === eventId || event._id === eventId
          ? { ...event, ...updates }
          : event
      );

      eventsCache = {
        ...eventsCache,
        data: updatedEvents
      };

      setEvents(updatedEvents);
      cacheSubscribers.forEach(callback => callback());
    }
  }, []);

  // Add new event to cache
  const addEvent = useCallback((newEvent: Event) => {
    if (eventsCache) {
      const updatedEvents = [newEvent, ...eventsCache.data];

      eventsCache = {
        ...eventsCache,
        data: updatedEvents
      };

      setEvents(updatedEvents);
      cacheSubscribers.forEach(callback => callback());
    }
  }, []);

  // Remove event from cache
  const removeEvent = useCallback((eventId: string) => {
    if (eventsCache) {
      const updatedEvents = eventsCache.data.filter(
        event => event.id !== eventId && event._id !== eventId
      );

      eventsCache = {
        ...eventsCache,
        data: updatedEvents
      };

      setEvents(updatedEvents);
      cacheSubscribers.forEach(callback => callback());
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    eventsCache = null;
    activeRequests.clear();
  }, []);

  return {
    events,
    loading,
    error,
    lastRefresh,
    fetchEvents,
    refreshEvents,
    updateEvent,
    addEvent,
    removeEvent,
    clearCache,
    isCacheValid: isCacheValid()
  };
};

// Hook for getting a single event
export const useEvent = (eventId: string | null) => {
  const { events, loading, error, fetchEvents } = useEvents();
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (eventId && events.length > 0) {
      const foundEvent = events.find(e => e.id === eventId || e._id === eventId);
      setEvent(foundEvent || null);
    } else {
      setEvent(null);
    }
  }, [eventId, events]);

  return {
    event,
    loading,
    error,
    refetch: fetchEvents
  };
};

export type { Event, UseEventsOptions };