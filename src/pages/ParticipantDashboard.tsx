import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QrCode, Camera, Upload, Menu, Zap, Loader2, X, Flashlight, MapPin, AlertTriangle, CheckCircle, User, Settings, LogOut, RefreshCw, MessageSquare, Building2, Copy, UserPlus, Globe, Calendar, Clock, Edit, Save, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config';
import { useParticipantLocationUpdater } from '@/hooks/useLocationTracking';
import ParticipantNotifications from '@/components/ParticipantNotifications';
import FeedbackFormView from '@/components/FeedbackFormView';
import RegistrationFormModal from '@/components/RegistrationFormModal';
import ProgressIndicator from '@/components/ProgressIndicator';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import jsQR from 'jsqr';
import { fromZonedTime } from 'date-fns-tz';

const ParticipantDashboard = () => {
  const [eventCode, setEventCode] = useState('');
  const [myInvitations, setMyInvitations] = useState([]);
  const [myAttendance, setMyAttendance] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [scanHistory, setScanHistory] = useState([]);
  const [activeView, setActiveView] = useState(() => {
    // Persist active view in localStorage
    return localStorage.getItem('participantActiveView') || 'active';
  }); // 'upcoming', 'active', 'completed', 'public', 'profile', 'settings', 'organization'
  const [publicEvents, setPublicEvents] = useState([]);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' for front, 'environment' for back
  const [selectedFeedbackEvent, setSelectedFeedbackEvent] = useState<any>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackFormsStatus, setFeedbackFormsStatus] = useState<Record<string, { exists: boolean; isPublished: boolean }>>({});
  const [userOrganization, setUserOrganization] = useState<any>(null);
  const [loadingOrganization, setLoadingOrganization] = useState(false);
  const [leavingOrganization, setLeavingOrganization] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinOrgCode, setJoinOrgCode] = useState('');
  const [joiningOrganization, setJoiningOrganization] = useState(false);
  
  // Multi-organization support
  const [userOrganizations, setUserOrganizations] = useState<any[]>([]);

  // Registration form modal state
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [pendingEventCode, setPendingEventCode] = useState('');
  const [pendingEventTitle, setPendingEventTitle] = useState('');
  const [pendingEventId, setPendingEventId] = useState('');
  const [registrationFormData, setRegistrationFormData] = useState<any>(null);
  const [activeOrganization, setActiveOrganization] = useState<any>(null);
  
  // Event record modal state
  const [selectedEventRecord, setSelectedEventRecord] = useState<any>(null);
  const [showEventRecordModal, setShowEventRecordModal] = useState(false);
  
  // Clear completed events state
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearingEvents, setIsClearingEvents] = useState(false);
  
  // Individual event deletion state

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editableProfile, setEditableProfile] = useState({
    name: '',
    email: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Change password modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cameraTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      return {};
    }
  })();

  // Initialize userProfile state
  useEffect(() => {
    try {
      setUserProfile(user);
    } catch (error) {
      console.error('Error setting user profile:', error);
      setHasError(true);
    }
  }, []);

  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  // Helper function to format time difference in a readable way
  const formatTimeDifference = (milliseconds: number) => {
    const totalSeconds = Math.floor(Math.abs(milliseconds) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      if (minutes > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${hours}h`;
    } else if (minutes > 0) {
      if (seconds > 0 && minutes < 2) {
        return `${minutes}m ${seconds}s`;
      }
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  // Helper function to determine if participant was late or on time
  const getAttendanceStatus = (attendance: any) => {
    // Check if marked absent first
    if (attendance.status === 'absent') {
      return {
        status: 'absent',
        message: 'Marked Absent',
        color: 'text-red-600 dark:text-red-400'
      };
    }

    if (!attendance.event.date || !attendance.checkInTime) {
      return { status: 'unknown', message: 'Unknown', color: 'text-gray-500 dark:text-gray-400' };
    }

    const checkInTime = new Date(attendance.checkInTime);

    // If event has startTime, use it with proper timezone conversion
    let eventStartTime: Date;
    if (attendance.event.startTime) {
      const eventDateStr = typeof attendance.event.date === 'string'
        ? attendance.event.date.split('T')[0]
        : new Date(attendance.event.date).toISOString().split('T')[0];

      const startDateTimeStr = `${eventDateStr}T${attendance.event.startTime}:00`;
      eventStartTime = fromZonedTime(startDateTimeStr, 'Asia/Singapore');
    } else {
      eventStartTime = new Date(attendance.event.date);
    }
    
    // Allow 30 minutes before event start for early check-in
    const earlyCheckInTime = new Date(eventStartTime.getTime() - 30 * 60 * 1000);
    
    // Consider late if checked in more than 15 minutes after start time
    const lateThreshold = new Date(eventStartTime.getTime() + 15 * 60 * 1000);
    
    const timeDifference = checkInTime.getTime() - eventStartTime.getTime();
    
    if (checkInTime < earlyCheckInTime) {
      const timeEarly = formatTimeDifference(earlyCheckInTime.getTime() - checkInTime.getTime());
      return { 
        status: 'very-early', 
        message: `${timeEarly} too early`,
        color: 'text-blue-600 dark:text-blue-400'
      };
    } else if (checkInTime <= eventStartTime) {
      if (Math.abs(timeDifference) < 60000) { // Less than 1 minute
        return { 
          status: 'on-time', 
          message: 'On time',
          color: 'text-green-600 dark:text-green-400'
        };
      } else {
        const timeEarly = formatTimeDifference(-timeDifference);
        return { 
          status: 'on-time', 
          message: `${timeEarly} early`,
          color: 'text-green-600 dark:text-green-400'
        };
      }
    } else if (checkInTime <= lateThreshold) {
      const timeLate = formatTimeDifference(timeDifference);
      return { 
        status: 'slightly-late', 
        message: `${timeLate} late`,
        color: 'text-yellow-600 dark:text-yellow-400'
      };
    } else {
      const timeLate = formatTimeDifference(timeDifference);
      return { 
        status: 'late', 
        message: `${timeLate} late`,
        color: 'text-red-600 dark:text-red-400'
      };
    }
  };

  // Helper function to check attendance availability and get timing info
  const getAttendanceAvailability = (event: any) => {
    if (!event.date) {
      return {
        available: false,
        reason: 'Event date not available',
        opensAt: null
      };
    }

    const now = new Date();
    const eventDateStr = typeof event.date === 'string'
      ? event.date.split('T')[0]
      : new Date(event.date).toISOString().split('T')[0];

    // Convert Singapore time to UTC using date-fns-tz
    let eventStartTime: Date;
    if (event.startTime) {
      const startDateTimeStr = `${eventDateStr}T${event.startTime}:00`;
      eventStartTime = fromZonedTime(startDateTimeStr, 'Asia/Singapore');
    } else {
      eventStartTime = new Date(event.date);
    }

    // Attendance opens 1 hour before event start
    const attendanceOpenTime = new Date(eventStartTime.getTime() - 60 * 60 * 1000);

    // Check if event has already ended
    let eventEndTime: Date;
    if (event.endTime) {
      const endDateTimeStr = `${eventDateStr}T${event.endTime}:00`;
      eventEndTime = fromZonedTime(endDateTimeStr, 'Asia/Singapore');
    } else {
      // Default 3 hours if no end time
      eventEndTime = new Date(eventStartTime.getTime() + 3 * 60 * 60 * 1000);
    }

    if (now > eventEndTime) {
      return {
        available: false,
        reason: 'Event has ended',
        opensAt: null
      };
    }

    if (now < attendanceOpenTime) {
      const timeUntilOpen = attendanceOpenTime.getTime() - now.getTime();
      const timeUntilOpenFormatted = formatTimeDifference(timeUntilOpen);
      
      return {
        available: false,
        reason: `Attendance opens ${timeUntilOpenFormatted} before event start`,
        opensAt: attendanceOpenTime,
        opensAtFormatted: attendanceOpenTime.toLocaleString(),
        timeUntilOpen: timeUntilOpenFormatted
      };
    }

    return {
      available: true,
      reason: 'Attendance is open',
      opensAt: attendanceOpenTime
    };
  };

  // Helper function to calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Helper function to validate if user is within geofence
  const validateGeofence = (event: any, userLocation: any) => {
    if (!event.location?.coordinates?.coordinates || !userLocation) {
      return {
        valid: false,
        reason: 'Location data unavailable',
        distance: null
      };
    }

    const eventCoords = event.location.coordinates.coordinates;
    const eventLat = eventCoords[1]; // Latitude is second in GeoJSON format
    const eventLng = eventCoords[0]; // Longitude is first in GeoJSON format
    
    const userLat = userLocation.latitude;
    const userLng = userLocation.longitude;

    const distance = calculateDistance(userLat, userLng, eventLat, eventLng);
    const geofenceRadius = event.geofenceRadius || 100; // Default 100 meters if not set

    if (distance <= geofenceRadius) {
      return {
        valid: true,
        reason: 'Within geofence area',
        distance: Math.round(distance),
        allowedRadius: geofenceRadius
      };
    } else {
      const distanceOutside = Math.round(distance - geofenceRadius);
      return {
        valid: false,
        reason: `You are ${Math.round(distance)}m from the event location. You need to be within ${geofenceRadius}m to check in.`,
        distance: Math.round(distance),
        allowedRadius: geofenceRadius,
        distanceOutside
      };
    }
  };

  // Function to clear all completed events
  const handleClearCompletedEvents = async () => {
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please log in to clear events",
        variant: "destructive",
      });
      return;
    }

    setIsClearingEvents(true);
    setShowClearConfirmation(false);

    try {
      const response = await fetch(`${API_CONFIG.API_BASE}/attendance/my/completed`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        // Filter out completed events from local state
        const updatedAttendance = myAttendance.filter(attendance => 
          !attendance.checkOutTime || attendance.status !== 'checked-out'
        );
        setMyAttendance(updatedAttendance);

        toast({
          title: "Events Cleared",
          description: `Successfully cleared ${result.data?.clearedCount || 'all'} completed events`,
        });
      } else {
        throw new Error(result.message || 'Failed to clear completed events');
      }
    } catch (error: any) {
      toast({
        title: "Clear Failed",
        description: error.message || "Failed to clear completed events",
        variant: "destructive",
      });
    } finally {
      setIsClearingEvents(false);
    }
  };

  // Function to delete individual completed event
  const handleDeleteCompletedEvent = async () => {
    if (!eventToDelete || !token) {
      toast({
        title: "Error",
        description: "Unable to delete event",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingEvent(true);
    setShowDeleteConfirmation(false);

    try {
      const response = await fetch(`${API_CONFIG.API_BASE}/attendance/${eventToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        // Remove the deleted event from local state
        const updatedAttendance = myAttendance.filter(attendance => 
          attendance._id !== eventToDelete._id
        );
        setMyAttendance(updatedAttendance);

        toast({
          title: "Event Deleted",
          description: `Successfully removed "${eventToDelete.event.title}" from your records`,
        });
      } else {
        throw new Error(result.message || 'Failed to delete event');
      }
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setIsDeletingEvent(false);
      setEventToDelete(null);
    }
  };

  // Function to initiate individual event deletion
  const confirmDeleteEvent = (attendance: any) => {
    setEventToDelete(attendance);
    setShowDeleteConfirmation(true);
  };
  
  // Function to update active view and persist it
  const updateActiveView = (view: string) => {
    setActiveView(view);
    localStorage.setItem('participantActiveView', view);
  };
  
  // Location tracking hook
  const {
    isTracking,
    startLocationTracking,
    updateLocation,
    stopLocationTracking,
  } = useParticipantLocationUpdater();
  
  // Location tracking state
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
  const [locationHeartbeatInterval, setLocationHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastLocationUpdateTime, setLastLocationUpdateTime] = useState<Date | null>(null);
  const [currentLocationStatus, setCurrentLocationStatus] = useState<any>(null);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [scanningStatus, setScanningStatus] = useState('Ready to scan');
  const [isScanning, setIsScanning] = useState(false);

  const checkLocationPermissions = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Check current permission status
        const permissions = await Geolocation.checkPermissions();
        
        if (permissions.location === 'granted') {
          setLocationPermissionStatus('granted');
          return true;
        } else if (permissions.location === 'denied') {
          setLocationPermissionStatus('denied');
          return false;
        } else {
          // Request permissions
          const requestResult = await Geolocation.requestPermissions();
          
          if (requestResult.location === 'granted') {
            setLocationPermissionStatus('granted');
            return true;
          } else {
            setLocationPermissionStatus('denied');
            return false;
          }
        }
      } else {
        // For web, permissions are requested when getCurrentPosition is called
        setLocationPermissionStatus('granted');
        return true;
      }
    } catch (error) {
      setLocationPermissionStatus('denied');
      return false;
    }
  };

  // Safe location getter with permission handling
  const getCurrentLocationSafely = async (): Promise<{ latitude: number; longitude: number; } | null> => {
    try {
      // Check permissions first
      const hasPermission = await checkLocationPermissions();
      if (!hasPermission) {
        toast({
          title: "Location Permission Required",
          description: "Please enable location access in your device settings to check in to events.",
          variant: "destructive",
        });
        return null;
      }

      if (Capacitor.isNativePlatform()) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        });
        
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } else {
        // Web fallback
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve, 
            reject,
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 30000
            }
          );
        });

        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      }
    } catch (error: any) {
      
      let errorMessage = "Failed to get your location.";
      if (error.code === 1) {
        errorMessage = "Location access denied. Please enable location permissions.";
      } else if (error.code === 2) {
        errorMessage = "Location unavailable. Please check your GPS settings.";
      } else if (error.code === 3) {
        errorMessage = "Location request timed out. Please try again.";
      }

      toast({
        title: "Location Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    }
  };

  // Native mobile app initialization
  useEffect(() => {
    const initializeApp = async () => {
      if (Capacitor.isNativePlatform()) {
        // Set status bar style for native app
        await StatusBar.setStyle({ style: Style.Default });
        
        // Check location permissions on startup
        await checkLocationPermissions();
        
        // Hide splash screen after 2 seconds
        setTimeout(async () => {
          await SplashScreen.hide();
          setShowSplash(false);
        }, 2000);
      } else {
        // Web fallback
        setTimeout(() => {
          setShowSplash(false);
        }, 2000);
        
        // Online/offline detection for web
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      }
    };

    initializeApp();
  }, []);

  // Fetch participant's invitations and attendance
  useEffect(() => {
    const fetchParticipantData = async () => {
      if (!token) {
        toast({
          title: "Authentication required",
          description: "Please log in to view your events",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      try {
        setIsLoading(true);

        // Fetch all data in parallel
        const [invitationsResponse, attendanceResponse, scanHistoryResponse] = await Promise.all([
          fetch(`${API_CONFIG.API_BASE}/invitations/my`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }),
          fetch(`${API_CONFIG.API_BASE}/attendance/my`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }),
          fetch(`${API_CONFIG.API_BASE}/attendance/scan-history`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
        ]);

        if (invitationsResponse.ok) {
          const invitationsData = await invitationsResponse.json();
          setMyInvitations(invitationsData.data.invitations);
        }

        if (attendanceResponse.ok) {
          const attendanceData = await attendanceResponse.json();
          setMyAttendance(attendanceData.data.attendanceLogs);
        }

        if (scanHistoryResponse.ok) {
          const scanHistoryData = await scanHistoryResponse.json();
          setScanHistory(scanHistoryData.data.scanHistory);
        } else {
        }
      } catch (error) {
        console.error('Error in fetchParticipantData:', error);
        setHasError(true);
        toast({
          title: "Error",
          description: "Failed to load your events. Please try again.",
          variant: "destructive",
        });
        // Set empty arrays as fallback to prevent app crash
        setMyInvitations([]);
        setMyAttendance([]);
        setScanHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchParticipantData();
  }, [token]);

  // Fetch user's organizations information
  useEffect(() => {
    const fetchUserOrganizations = async () => {
      if (!token) return;
      
      try {
        setLoadingOrganization(true);
        // Fetch all organizations user belongs to
        const response = await fetch(`${API_CONFIG.API_BASE}/organization-membership/my-organizations`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          setUserOrganizations(result.data);
          // Set the most recently accessed organization as active, or first one
          const mostRecent = result.data.sort((a: any, b: any) => 
            new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
          )[0];
          setActiveOrganization(mostRecent);
          setUserOrganization(mostRecent); // Keep compatibility with existing code
        } else {
          // Fallback to legacy single organization endpoint
          const legacyResponse = await fetch(`${API_CONFIG.API_BASE}/organizations/my`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          const legacyResult = await legacyResponse.json();
          if (legacyResult.success) {
            setUserOrganizations([legacyResult.data]);
            setActiveOrganization(legacyResult.data);
            setUserOrganization(legacyResult.data);
          } else {
            setUserOrganizations([]);
            setActiveOrganization(null);
            setUserOrganization(null);
          }
        }
      } catch (error) {
        setUserOrganizations([]);
        setActiveOrganization(null);
        setUserOrganization(null);
      } finally {
        setLoadingOrganization(false);
      }
    };

    fetchUserOrganizations();
  }, [token]);


  // Force cleanup any active camera streams on component mount
  useEffect(() => {
    // Initial cleanup to ensure clean state on component mount
    const forceCleanupCamera = async () => {
      try {
        // Stop any existing streams
        stopQRScanner();

        // Also check for any active media streams and stop them
        if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          // Check if there are active camera devices
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');

          if (videoDevices.length === 0) {
            console.warn('No camera devices found on this device');
          }
        }
      } catch (error) {
        console.warn('Camera cleanup on mount failed:', error);
      }
    };

    forceCleanupCamera();
  }, []);

  // Cleanup camera and location tracking when component unmounts
  useEffect(() => {
    return () => {
      stopQRScanner();

      // Stop location tracking if active
      if (locationWatchId) {
        if (Capacitor.isNativePlatform()) {
          Geolocation.clearWatch({ id: locationWatchId as any }).catch(() => {});
        } else {
          navigator.geolocation.clearWatch(locationWatchId);
        }
      }
    };
  }, [locationWatchId]);

  // Monitor currently attending events and fetch location status
  useEffect(() => {
    const currentlyAttending = getCurrentlyAttending();
    if (currentlyAttending.length > 0 && !currentLocationStatus) {
      // Fetch location status for the first currently attending event
      const event = currentlyAttending[0];
      fetchLocationStatus(event.event._id || event.event);
    }
  }, [myAttendance]);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isCameraActive && videoRef.current) {
      // Stop current stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Restart camera with new facing mode
      startWebCamera();
    }
  }, [facingMode]);

  // Auto-checkout system - periodically check for ended events and auto-checkout participants
  useEffect(() => {
    const checkForEndedEvents = async () => {
      if (!token) return;

      try {
        const response = await fetch(`${API_CONFIG.API_BASE}/attendance/auto-checkout-ended-events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();
        
        if (result.success && result.data.totalParticipantsCheckedOut > 0) {
          
          // Show notification if current user was auto-checked out
          if (result.data.totalParticipantsCheckedOut > 0) {
            toast({
              title: "Auto Checkout",
              description: `${result.data.totalParticipantsCheckedOut} participant(s) were automatically checked out from ${result.data.totalEventsProcessed} ended event(s).`,
            });
          }

          // Refresh attendance data to reflect the changes
          const fetchData = async () => {
            if (!token) return;
            
            try {
              const [invitationsResponse, attendanceResponse] = await Promise.all([
                fetch(`${API_CONFIG.API_BASE}/invitations/my`, {
                  headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_CONFIG.API_BASE}/attendance/my`, {
                  headers: { Authorization: `Bearer ${token}` }
                })
              ]);
              
              if (invitationsResponse.ok) {
                const invitationsData = await invitationsResponse.json();
                setMyInvitations(invitationsData.data.invitations);
              }
              if (attendanceResponse.ok) {
                const attendanceData = await attendanceResponse.json();
                setMyAttendance(attendanceData.data.attendanceLogs);
              }
            } catch (error) {
            }
          };

          fetchData();
        }
      } catch (error) {
        // Silently log errors to avoid spamming user with network issues
      }
    };

    // Initial check
    checkForEndedEvents();
    
    // Set up interval to check every 5 minutes
    const intervalId = setInterval(checkForEndedEvents, 5 * 60 * 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [token, toast]);

  // Check feedback form status when attendance data changes
  useEffect(() => {
    const eventIds = [...new Set([
      ...myAttendance.map(a => a.event._id || a.event),
    ])].filter(Boolean);
    
    if (eventIds.length > 0) {
      checkFeedbackFormsStatus(eventIds);
    }
  }, [myAttendance]);

  // Automatic location monitoring for invited participants in active events
  useEffect(() => {
    const startAutomaticMonitoring = async () => {
      if (!user._id || !myInvitations.length) return;

      // Get current active events that the user is invited to
      const now = new Date();
      const activeInvitedEvents = myInvitations.filter(invitation => {
        const event = invitation.event;

        // Don't include completed events in monitoring
        if (event.status === 'completed') {
          return false;
        }

        const eventDateStr = typeof event.date === 'string'
          ? event.date.split('T')[0]
          : new Date(event.date).toISOString().split('T')[0];

        // Calculate event start and end times properly with timezone conversion
        let eventStartTime: Date, eventEndTime: Date;

        if (event.startTime && event.endTime) {
          // Use actual start and end times
          const startDateTimeStr = `${eventDateStr}T${event.startTime}:00`;
          eventStartTime = fromZonedTime(startDateTimeStr, 'Asia/Singapore');

          const endDateTimeStr = `${eventDateStr}T${event.endTime}:00`;
          eventEndTime = fromZonedTime(endDateTimeStr, 'Asia/Singapore');

          // Allow check-in 30 minutes before start time
          const checkInStartTime = new Date(eventStartTime.getTime() - 30 * 60 * 1000);

          return now >= checkInStartTime && (invitation.status === 'accepted' || invitation.status === 'pending');
        } else {
          // Fallback to old logic if times are not available
          const eventDate = new Date(event.date);
          const eventEndTime = new Date(eventDate.getTime() + (event.duration || 3600000));
          const eventStartTime = new Date(eventDate.getTime() - 30 * 60 * 1000);
          
          // Don't include completed events in monitoring
          if (event.status === 'completed') {
            return false;
          }
          
          return now >= eventStartTime && (invitation.status === 'accepted' || invitation.status === 'pending');
        }
      });


      if (activeInvitedEvents.length > 0 && !locationWatchId) {
        // Check location permissions
        const hasPermission = await checkLocationPermissions();
        if (!hasPermission) {
          toast({
            title: "Location Permission Required",
            description: "Enable location access to automatically check into events.",
            variant: "destructive",
          });
          return;
        }

        // Start location monitoring for automatic check-in
        
        if (Capacitor.isNativePlatform()) {
          const watchId = await Geolocation.watchPosition({
            enableHighAccuracy: true,
            timeout: 15000
          }, async (position) => {
            if (position && activeInvitedEvents.length > 0) {
              await checkAutoCheckIn({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitudeAccuracy: position.coords.altitudeAccuracy || null,
                altitude: position.coords.altitude || null,
                speed: position.coords.speed || null,
                heading: position.coords.heading || null,
                toJSON: function() { return this; }
              } as GeolocationCoordinates, activeInvitedEvents);
            }
          });
          setLocationWatchId(watchId as any);
        } else {
          if (navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
              async (position) => {
                await checkAutoCheckIn(position.coords, activeInvitedEvents);
              },
              (error) => {
              },
              {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000 // Cache location for 1 minute
              }
            );
            setLocationWatchId(watchId);
          }
        }

        toast({
          title: "Auto Check-in Active",
          description: `Monitoring location for ${activeInvitedEvents.length} active event(s).`,
        });
      }
    };

    startAutomaticMonitoring();
  }, [myInvitations, user._id, locationWatchId]);

  // Function to check if participant is within event geofence for auto check-in
  const checkAutoCheckIn = async (coords: GeolocationCoordinates, activeEvents: any[]) => {
    for (const invitation of activeEvents) {
      try {
        // Check if already checked in to this event
        const alreadyCheckedIn = myAttendance.some(
          attendance => attendance.event._id === invitation.event._id && attendance.status === 'checked-in'
        );
        
        if (alreadyCheckedIn) continue;

        // Calculate distance from event location
        const locationData = invitation.event.location;
        if (locationData?.coordinates?.coordinates && Array.isArray(locationData.coordinates.coordinates)) {
          const [eventLng, eventLat] = locationData.coordinates.coordinates;
          
          const distance = calculateDistance(
            coords.latitude,
            coords.longitude,
            eventLat,
            eventLng
          );

          const geofenceRadius = invitation.event.geofenceRadius || 100; // Default 100 meters
          
          
          if (distance <= geofenceRadius) {
            
            // Perform automatic check-in
            await performAutoCheckIn(invitation.event, coords);
          }
        } else {
        }
      } catch (error) {
      }
    }
  };

  // Function to perform automatic check-in
  const performAutoCheckIn = async (event: any, coords: GeolocationCoordinates) => {
    try {
      // Find the invitation for this event to get the proper QR data
      const invitation = myInvitations.find(inv => inv.event._id === event._id);
      
      if (!invitation) {
        return;
      }
      
      // Create QR data format expected by the API
      const qrData = JSON.stringify({
        invitationId: invitation._id,
        eventId: event._id,
        participantId: user._id,
        code: invitation.invitationCode
      });
      
      
      const response = await fetch(`${API_CONFIG.API_BASE}/attendance/checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          qrData: qrData,
          location: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Auto Check-in Successful! 🎉",
          description: `Automatically checked into ${event.title}`,
        });
        
        // Start location tracking for this event
        if (result.data.attendanceLog && result.data.attendanceLog._id) {
          await startLocationWatching(event._id, result.data.attendanceLog._id);
        }
        
        // Refresh attendance data
        const attendanceResponse = await fetch(`${API_CONFIG.API_BASE}/attendance/my`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (attendanceResponse.ok) {
          const attendanceData = await attendanceResponse.json();
          setMyAttendance(attendanceData.data.attendanceLogs);
        }
      } else {
      }
    } catch (error) {
    }
  };

  // Check for automatic check-out when events end
  useEffect(() => {
    const checkAutoCheckOut = async () => {
      if (!myAttendance.length) return;

      const now = new Date();
      const attendingEvents = myAttendance.filter(attendance => attendance.status === 'checked-in');

      for (const attendance of attendingEvents) {
        // Use endTime field with proper timezone conversion
        const event = attendance.event;
        if (!event.endTime) continue; // Skip if no end time specified

        const eventDateStr = typeof event.date === 'string'
          ? event.date.split('T')[0]
          : new Date(event.date).toISOString().split('T')[0];

        const endDateTimeStr = `${eventDateStr}T${event.endTime}:00`;

        // Convert Singapore time to UTC using date-fns-tz
        const eventEndUTC = fromZonedTime(endDateTimeStr, 'Asia/Singapore');

        // Check if event has ended
        if (now > eventEndUTC) {
          
          try {
            const response = await fetch(`${API_CONFIG.API_BASE}/attendance/${attendance._id}/checkout`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                autoCheckOut: true,
                notes: 'Auto-checkout: Event ended'
              })
            });

            const result = await response.json();
            
            if (result.success) {
              toast({
                title: "Auto Check-out Completed",
                description: `Automatically checked out of ${attendance.event.title}`,
              });

              // Stop location tracking for this event
              await stopLocationTracking(attendance.event._id, user._id);

              // Refresh attendance data
              const attendanceResponse = await fetch(`${API_CONFIG.API_BASE}/attendance/my`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (attendanceResponse.ok) {
                const attendanceData = await attendanceResponse.json();
                setMyAttendance(attendanceData.data.attendanceLogs);
              }
            }
          } catch (error) {
          }
        }
      }
    };

    // Check every minute for events that should auto check-out
    const autoCheckOutInterval = setInterval(checkAutoCheckOut, 60000);
    checkAutoCheckOut(); // Run immediately

    return () => clearInterval(autoCheckOutInterval);
  }, [myAttendance, token, user._id]);

  // Periodically refresh location status when tracking
  useEffect(() => {
    if (isTracking || currentLocationStatus) {
      const currentlyAttending = getCurrentlyAttending();
      if (currentlyAttending.length > 0) {
        const interval = setInterval(() => {
          const event = currentlyAttending[0];
          fetchLocationStatus(event.event._id || event.event);
        }, 15000); // Refresh every 15 seconds

        return () => clearInterval(interval);
      }
    }
  }, [isTracking, currentLocationStatus, myAttendance]);

  const startQRScanner = async () => {
    if (isCameraActive) {
      return;
    }
    
    setScanningStatus('Requesting camera access...');
    
    try {
      if (Capacitor.isNativePlatform()) {
        // Use native camera for QR scanning
        setScanningStatus('Opening camera...');
        try {
          const image = await CapacitorCamera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera,
            width: 800,
            height: 600,
            promptLabelCancel: 'Cancel',
            promptLabelPhoto: 'Capture QR Code',
            promptLabelPicture: 'Choose from Gallery'
          });

          setScanningStatus('Processing image...');
          if (image.dataUrl) {
            await processQRFromImage(image.dataUrl);
          } else {
            throw new Error('No image data received from camera');
          }
        } catch (cameraError: any) {
          if (cameraError.message !== 'User cancelled photos app') {
            throw cameraError;
          } else {
            setScanningStatus('Camera cancelled');
          }
        }
      } else {
        // Enhanced mobile web camera checks
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API not supported in this browser');
        }

        // Check for HTTPS on mobile devices
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile && location.protocol !== 'https:' && location.hostname !== 'localhost') {
          throw new Error('Camera requires HTTPS on mobile devices');
        }

        // Check permissions before attempting to access camera
        if ('permissions' in navigator) {
          try {
            const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
            if (permission.state === 'denied') {
              throw new Error('Camera permission denied. Please enable camera access in browser settings.');
            }
          } catch (permError) {
            console.warn('Could not check camera permissions:', permError);
          }
        }

        await startWebCamera();
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown camera error';
      setScanningStatus('Camera access failed - ' + errorMessage);

      // Provide more specific error messages for mobile users
      let userMessage = errorMessage;
      if (errorMessage.includes('HTTPS')) {
        userMessage = 'Camera access requires a secure connection (HTTPS) on mobile devices.';
      } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        userMessage = 'Please allow camera access in your browser settings and refresh the page.';
      } else if (errorMessage.includes('not supported')) {
        userMessage = 'Camera is not supported in this browser. Try using Chrome, Firefox, or Safari.';
      }

      toast({
        title: "Camera Error",
        description: userMessage,
        variant: "destructive",
      });
    }
  };

  const startWebCamera = async () => {
    console.log('startWebCamera called');
    try {
      // Check if we're on mobile for better constraints
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('Device type:', isMobile ? 'Mobile' : 'Desktop');

      let stream: MediaStream;

      // Mobile-optimized constraints
      const mobileConstraints = {
        video: {
          facingMode: facingMode,
          width: { min: 320, ideal: 640, max: 1920 },
          height: { min: 240, ideal: 480, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        }
      };

      // Desktop constraints optimized for laptop webcams
      const desktopConstraints = {
        video: {
          width: { min: 320, ideal: 640, max: 1920 },
          height: { min: 240, ideal: 480, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          // Don't force exact facing mode on desktop - most laptops only have front camera
          facingMode: isMobile ? { exact: facingMode } : facingMode
        }
      };

      try {
        // Try exact facing mode first (works better on mobile)
        const constraints = isMobile ? mobileConstraints : desktopConstraints;
        console.log('Requesting camera with constraints:', constraints);
        setScanningStatus('Requesting camera permissions...');

        // Add timeout to prevent hanging
        const cameraPromise = navigator.mediaDevices.getUserMedia(constraints);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Camera request timed out after 10 seconds')), 10000)
        );

        stream = await Promise.race([cameraPromise, timeoutPromise]) as MediaStream;
        console.log('Camera stream obtained:', stream);

        // Check if flash/torch is supported
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if ((capabilities as any).torch) {
          setFlashSupported(true);
        }
      } catch (error) {
        console.warn('Exact facing mode failed, trying fallback:', error);
        try {
          // Fallback: Try without exact facing mode
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facingMode, // Remove 'exact' constraint
              width: isMobile ? { min: 320, ideal: 480, max: 1280 } : { ideal: 640 },
              height: isMobile ? { min: 240, ideal: 640, max: 720 } : { ideal: 480 }
            }
          });
        } catch (fallbackError) {
          console.warn('Fallback with facing mode failed, trying any camera:', fallbackError);
          // Final fallback: Any available camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: isMobile ? {
              width: { min: 320, ideal: 480 },
              height: { min: 240, ideal: 640 }
            } : {
              width: { ideal: 640 },
              height: { ideal: 480 }
            }
          });
        }
      }
      
      // Store the stream and set camera active first
      streamRef.current = stream;
      setIsCameraActive(true);
      setScanningStatus('Camera starting...');
      console.log('Camera set to active, waiting for video element to mount');

      // Check flash support for any camera
      if (!flashSupported) {
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        if ((capabilities as any).torch) {
          setFlashSupported(true);
        }
      }

      // Use useEffect-like approach to wait for video element
      const setupVideo = () => {
        if (videoRef.current) {
          console.log('Video element found, assigning stream');
          const video = videoRef.current;
          video.srcObject = stream;
          console.log('Stream assigned to video element');

          // Wait for video metadata to load
          video.onloadedmetadata = () => {
            console.log('Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);

            video.play().then(() => {
              console.log('Video playing successfully');
              setScanningStatus('Position QR code within frame');
              setIsScanning(true);
              startScanningInterval();
            }).catch(playError => {
              console.error('Video play error:', playError);
              setScanningStatus('Camera playback failed - ' + playError.message);
            });
          };

          video.onloadstart = () => console.log('Video load started');
          video.oncanplay = () => {
            console.log('Video can play');
            setScanningStatus('Camera ready - Position QR code within frame');
          };
          video.onplay = () => {
            console.log('Video play event');
            setScanningStatus('Position QR code within frame');
            setIsScanning(true);
            startScanningInterval();
          };

          video.onerror = (videoError) => {
            console.error('Video element error:', videoError);
            setScanningStatus('Camera display error');
          };

          // Force immediate play attempt
          setTimeout(() => {
            if (video.readyState >= 3) {
              console.log('Video ready, attempting immediate play');
              video.play().catch(console.error);
            }
          }, 100);
        } else {
          console.log('Video element not ready yet, retrying in 100ms');
          setTimeout(setupVideo, 100);
        }
      };

      // Start trying to setup video
      setTimeout(setupVideo, 50);
    } catch (error) {
      console.error('Main camera constraints failed, trying basic constraints:', error);
      await retryWithBasicConstraints();
    }
  };

  const processQRFromImage = async (dataUrl: string) => {
    try {
      const img = document.createElement('img');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData) {
          const qrData = detectQRCodeFromImageData(imageData);
          
          if (qrData) {
            handleQRCodeDetected(qrData);
          } else {
            toast({
              title: "No QR Code Found",
              description: "Could not detect a QR code in the captured image",
              variant: "destructive",
            });
          }
        }
      };

      img.onerror = () => {
        toast({
          title: "Image Processing Error",
          description: "Failed to process the captured image",
          variant: "destructive",
        });
      };

      img.src = dataUrl;
    } catch (error) {
      toast({
        title: "Processing Error",
        description: "Failed to process the image for QR code detection",
        variant: "destructive",
      });
    }
  };

  const retryWithBasicConstraints = async () => {
    try {
      setScanningStatus('Trying basic camera settings...');

      // Try even more basic constraints for problematic mobile devices
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 15 }
        }
      });

      if (videoRef.current && stream) {
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;

        // Set camera active immediately for fallback too
        setScanningStatus('Basic camera starting...');
        setIsCameraActive(true);

        video.onloadedmetadata = () => {
          video.play().then(() => {
            setScanningStatus('Basic camera active - Position QR code within frame');
            startScanningInterval();
          }).catch(error => {
            setScanningStatus('Camera playback failed');
            console.error('Video play error:', error);
            // Keep camera active even if play fails
          });
        };

        video.oncanplay = () => {
          setScanningStatus('Basic camera ready - Position QR code within frame');
        };

        video.onerror = (videoError) => {
          setScanningStatus('Camera display error');
          console.error('Video error:', videoError);
        };

        // Force play attempt
        setTimeout(() => {
          if (video.readyState >= 3) {
            video.play().catch(console.error);
          }
        }, 100);
      }
    } catch (error: any) {
      setScanningStatus('Camera unavailable - Check permissions');
      console.error('Basic camera constraints failed:', error);

      // Provide mobile-specific guidance
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      let errorMessage = "Please allow camera access in your browser settings and refresh the page.";

      if (isMobile) {
        errorMessage = "Camera not available. Try: 1) Allow camera permission 2) Close other apps using camera 3) Try Chrome or Safari browser";
      }

      toast({
        title: "Camera Access Denied",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const toggleFlash = async () => {
    if (!streamRef.current || !flashSupported) {
      toast({
        title: "Flash not available",
        description: "Flash is not supported on this camera",
        variant: "destructive",
      });
      return;
    }

    try {
      const track = streamRef.current.getVideoTracks()[0];
      const newFlashState = !isFlashOn;
      
      await track.applyConstraints({
        advanced: [{ torch: newFlashState } as any]
      } as any);
      
      setIsFlashOn(newFlashState);
      
      // Haptic feedback
      await triggerHapticFeedback('light');
      
      toast({
        title: `Flash ${newFlashState ? 'On' : 'Off'}`,
        description: `Camera flash has been turned ${newFlashState ? 'on' : 'off'}`,
      });
    } catch (error) {
      toast({
        title: "Flash error",
        description: "Failed to toggle flash",
        variant: "destructive",
      });
    }
  };

  const stopQRScanner = () => {
    if (cameraTimeoutRef.current) {
      clearTimeout(cameraTimeoutRef.current);
      cameraTimeoutRef.current = null;
    }

    if (scanningIntervalRef.current) {
      clearInterval(scanningIntervalRef.current);
      scanningIntervalRef.current = null;
    }

    // Turn off flash before stopping camera
    if (isFlashOn && streamRef.current) {
      try {
        const track = streamRef.current.getVideoTracks()[0];
        track.applyConstraints({
          advanced: [{ torch: false } as any]
        } as any);
      } catch (error) {
      }
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsCameraActive(false);
    setIsFlashOn(false);
    setFlashSupported(false);
    setScanningStatus('Ready to scan');
  };

  const startScanningInterval = () => {
    if (scanningIntervalRef.current) {
      clearInterval(scanningIntervalRef.current);
    }
    
    scanningIntervalRef.current = setInterval(() => {
      scanQRCode();
    }, 500);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame to canvas
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data for QR detection
      const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);
      
      try {
        const qrData = detectQRCodeFromImageData(imageData);
        if (qrData) {
          setScanningStatus('QR Code detected!');
          handleQRCodeDetected(qrData);
        } else {
          // Update scanning status periodically to show it's working
          const statuses = [
            'Scanning for QR code...',
            'Position QR code in frame...',
            'Looking for QR code...',
            'Align QR code with camera...'
          ];
          const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
          setScanningStatus(randomStatus);
        }
      } catch (error) {
        setScanningStatus('Scanning error - retrying...');
      }
    }
  };

  const detectQRCodeFromImageData = (imageData: ImageData | undefined): string | null => {
    if (!imageData) return null;
    
    try {
      // Try different detection options for better accuracy
      const detectionOptions = [
        { inversionAttempts: 'dontInvert' as const },
        { inversionAttempts: 'onlyInvert' as const },
        { inversionAttempts: 'attemptBoth' as const },
        { inversionAttempts: 'attemptBoth' as const, canOverwriteImage: true }
      ];
      
      for (const options of detectionOptions) {
        try {
          const code = jsQR(imageData.data, imageData.width, imageData.height, options);
          if (code && code.data.trim().length > 0) {
            return code.data.trim();
          }
        } catch (optionError) {
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  };

  const handleQRCodeDetected = async (qrData: string) => {
    // Stop scanning once we detect a QR code
    stopQRScanner();
    setIsScanning(false);
    
    // Haptic feedback for successful detection
    await triggerHapticFeedback('medium');
    
    try {
      // Try to parse as event QR code
      let eventData = null;
      
      try {
        eventData = JSON.parse(qrData);
        if (eventData.invitationId && eventData.eventId) {
          
          // First, fetch event details to check timing
          try {
            const eventResponse = await fetch(`${API_CONFIG.API_BASE}/events/${eventData.eventId}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (!eventResponse.ok) {
              throw new Error('Failed to fetch event details');
            }

            const eventDetails = await eventResponse.json();
            const event = eventDetails.data.event;

            // Check if attendance is available
            const availability = getAttendanceAvailability(event);
            
            if (!availability.available) {
              if (availability.opensAt) {
                toast({
                  title: "Attendance Not Yet Open",
                  description: `Attendance opens at ${availability.opensAtFormatted}. Please try again in ${availability.timeUntilOpen}.`,
                  variant: "destructive",
                });
              } else {
                toast({
                  title: "Attendance Unavailable",
                  description: availability.reason,
                  variant: "destructive",
                });
              }
              return;
            }

            // Get location for event check-in
            try {
              const location = await getCurrentLocationSafely();
              if (!location) {
                throw new Error('Location access required for event check-in');
              }

              // Validate geofence
              const geofenceCheck = validateGeofence(event, location);
              if (!geofenceCheck.valid) {
                toast({
                  title: "Outside Event Location",
                  description: geofenceCheck.reason,
                  variant: "destructive",
                });
                return;
              }

              try {
                const response = await fetch(`${API_CONFIG.API_BASE}/attendance/checkin`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    qrData,
                    location
                  })
                });

                const result = await response.json();
                
                if (result.success) {
                  toast({
                    title: "Check-in Successful!",
                    description: `Welcome to ${result.data.event.title}`,
                  });
                  
                  // Start location tracking for this event
                  if (result.data.attendanceLog && result.data.attendanceLog._id) {
                    await startLocationWatching(result.data.event._id, result.data.attendanceLog._id);
                  }
                  
                  // Refresh scan history from database
                  await refreshScanHistory();
                } else {
                  throw new Error(result.message);
                }
              } catch (error) {
                toast({
                  title: "Check-in Failed",
                  description: error.message || "Failed to check in to event",
                  variant: "destructive",
                });
              }
            } catch (locationError) {
              toast({
                title: "Location Required",
                description: "Please enable location access for event check-in",
                variant: "destructive",
              });
            }
          } catch (eventFetchError) {
            toast({
              title: "Event Details Error",
              description: "Could not verify event timing. Please try again.",
              variant: "destructive",
            });
          }
        }
      } catch {
        // Not event JSON, treat as regular QR code
        
        // For non-event QR codes, we could add them to a separate local scan list
        // or consider tracking all scans in database with a 'type' field
        
        toast({
          title: "QR Code Scanned!",
          description: `Found: ${qrData.substring(0, 50)}${qrData.length > 50 ? '...' : ''}`,
        });
      }
    } catch (error) {
      toast({
        title: "Scan Error",
        description: "Failed to process QR code",
        variant: "destructive",
      });
    }
  };

  const handleQRUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const img = document.createElement('img');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        const qrData = detectQRCodeFromImageData(imageData);
        
        if (qrData) {
          handleQRCodeDetected(qrData);
        } else {
          toast({
            title: "No QR Code Found",
            description: "Could not detect a QR code in the image",
            variant: "destructive",
          });
        }
        setIsUploading(false);
      };

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsUploading(false);
      toast({
        title: "Upload Error",
        description: "Failed to process the image",
        variant: "destructive",
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleJoinEvent = async () => {
    console.log('🚀 [MANUAL JOIN] Starting handleJoinEvent (manual event code input)');
    console.log('🚀 [MANUAL JOIN] Event code:', eventCode);
    console.log('🚀 [MANUAL JOIN] Token exists:', !!token);

    if (!eventCode) {
      console.log('🚀 [MANUAL JOIN] No event code provided');
      toast({
        title: "Event code required",
        description: "Please enter a valid event code",
        variant: "destructive",
      });
      return;
    }

    console.log('🚀 [MANUAL JOIN] Setting isJoining to true');
    setIsJoining(true);

    try {
      // First, find the event by code
      console.log('🚀 [MANUAL JOIN] Fetching event by code...');
      console.log('🚀 [MANUAL JOIN] API call:', `${API_CONFIG.API_BASE}/events/code/${eventCode}`);

      const eventResponse = await fetch(`${API_CONFIG.API_BASE}/events/code/${eventCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🚀 [MANUAL JOIN] Event fetch response:', {
        status: eventResponse.status,
        ok: eventResponse.ok
      });

      if (!eventResponse.ok) {
        console.log('🚀 [MANUAL JOIN] Event not found with code:', eventCode);
        throw new Error('Event not found with that code');
      }

      const eventData = await eventResponse.json();
      console.log('🚀 [MANUAL JOIN] Event data received:', eventData);
      const event = eventData.data.event;
      console.log('🚀 [MANUAL JOIN] Event details:', {
        id: event._id,
        title: event.title,
        published: event.published,
        isActive: event.isActive
      });

      // Check if attendance is available
      const availability = getAttendanceAvailability(event);
      
      if (!availability.available) {
        if (availability.opensAt) {
          toast({
            title: "Attendance Not Yet Open",
            description: `Attendance for "${event.title}" opens at ${availability.opensAtFormatted}. Please try again in ${availability.timeUntilOpen}.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Attendance Unavailable",
            description: availability.reason,
            variant: "destructive",
          });
        }
        return;
      }

      // Get user location for check-in
      try {
        const location = await getCurrentLocationSafely();
        if (!location) {
          throw new Error('Location access required for event check-in');
        }

        // Validate geofence
        const geofenceCheck = validateGeofence(event, location);
        if (!geofenceCheck.valid) {
          toast({
            title: "Outside Event Location",
            description: geofenceCheck.reason,
            variant: "destructive",
          });
          return;
        }

          // Check if user has an invitation for this event (for invited events)
          const invitation = myInvitations.find(inv => inv.event._id === event._id);

          // Check if user has an attendance record for this event (for public events joined via code)
          const attendanceRecord = myAttendance.find(att => att.event._id === event._id);

          console.log('=== DEBUG CHECK-IN FLOW ===');
          console.log('Event ID:', event._id);
          console.log('Found invitation:', !!invitation);
          console.log('Found attendance record:', !!attendanceRecord);
          console.log('My invitations count:', myInvitations.length);
          console.log('My attendance count:', myAttendance.length);

          // Debug attendance records
          console.log('=== ATTENDANCE RECORDS DEBUG ===');
          myAttendance.forEach((att, index) => {
            console.log(`Attendance ${index + 1}:`, {
              id: att._id,
              eventId: att.event?._id,
              eventTitle: att.event?.title,
              status: att.status,
              checkInTime: att.checkInTime,
              checkOutTime: att.checkOutTime
            });
          });

          // Try different matching approaches
          const attendanceByEventId = myAttendance.find(att => att.event?._id === event._id);
          const attendanceByEventIdString = myAttendance.find(att => att.event?._id?.toString() === event._id?.toString());

          console.log('Attendance by event._id match:', !!attendanceByEventId);
          console.log('Attendance by event._id string match:', !!attendanceByEventIdString);

          // Use the most reliable match
          const finalAttendanceRecord = attendanceByEventId || attendanceByEventIdString;

          if (!invitation && !finalAttendanceRecord) {
            console.log('🚀 [MANUAL JOIN] No invitation or attendance record found for event');
            console.log('🚀 [MANUAL JOIN] Automatically joining event first. Event ID:', event._id);

            // Automatically join the event first
            try {
              console.log('🚀 [MANUAL JOIN] Making auto-join API call...');
              console.log('🚀 [MANUAL JOIN] Join request body:', { eventCode: eventCode.toUpperCase() });

              const joinResponse = await fetch(`${API_CONFIG.API_BASE}/attendance/join`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ eventCode: eventCode.toUpperCase() })
              });

              console.log('🚀 [MANUAL JOIN] Auto-join response:', {
                status: joinResponse.status,
                ok: joinResponse.ok
              });

              const joinResult = await joinResponse.json();
              console.log('🚀 [MANUAL JOIN] Auto-join result:', joinResult);

              if (!joinResult.success) {
                if (joinResult.requiresRegistration && joinResult.registrationForm) {
                  toast({
                    title: "Registration Required",
                    description: "This event requires a registration form to be completed first.",
                    variant: "destructive",
                  });
                  return;
                }
                throw new Error(joinResult.message || 'Failed to join event automatically');
              }

              toast({
                title: "Joined and Checking In",
                description: `Automatically joined "${event.title}" and checking you in...`,
              });

              // Continue with check-in after successful join
              console.log('🚀 [MANUAL JOIN] ✅ Successfully auto-joined, proceeding with direct check-in');

              // Now perform the direct check-in since we just joined
              console.log('🚀 [MANUAL JOIN] Making direct check-in API call...');
              console.log('🚀 [MANUAL JOIN] Check-in request:', {
                eventId: event._id,
                locationExists: !!location
              });

              const checkinResponse = await fetch(`${API_CONFIG.API_BASE}/attendance/checkin-direct`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  eventId: event._id,
                  location
                })
              });

              console.log('🚀 [MANUAL JOIN] Direct check-in response:', {
                status: checkinResponse.status,
                ok: checkinResponse.ok
              });

              const checkinData = await checkinResponse.json();
              console.log('🚀 [MANUAL JOIN] Direct check-in response body:', checkinData);

              if (checkinData.success) {
                console.log('🚀 [MANUAL JOIN] ✅ Check-in successful! Process complete.');
                toast({
                  title: "Success!",
                  description: `Joined and checked in to "${event.title}"!`,
                });

                // Refresh data
                console.log('🚀 [MANUAL JOIN] Reloading page to refresh data...');
                window.location.reload();
                return;
              } else {
                console.log('🚀 [MANUAL JOIN] ❌ Check-in failed:', checkinData.message);
                throw new Error(checkinData.message || 'Failed to check in after joining');
              }

            } catch (joinError) {
              console.error('🚀 [MANUAL JOIN] ❌ Auto-join or check-in failed:', joinError);
              toast({
                title: "Error",
                description: joinError.message || "Could not complete join and check-in process.",
                variant: "destructive",
              });
              return;
            }
          }

          // For public events with attendance records (no invitation needed) OR after auto-joining
          if (finalAttendanceRecord && !invitation) {
            console.log('Using attendance record for public event check-in');
            console.log('Attendance record details:', finalAttendanceRecord);
            // Check if already checked in
            if (finalAttendanceRecord.status === 'checked-in' || finalAttendanceRecord.checkInTime) {
              toast({
                title: "Already checked in",
                description: "You are already checked in to this event",
                variant: "destructive",
              });
              return;
            }

            // For public events, we don't need QR data - just mark as checked in
            const checkinResponse = await fetch(`${API_CONFIG.API_BASE}/attendance/checkin-direct`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                eventId: event._id,
                location
              })
            });

            const checkinData = await checkinResponse.json();
            console.log('Direct check-in response:', checkinData);

            if (checkinData.success) {
              toast({
                title: "Check-in successful!",
                description: `Welcome to ${event.title}`,
              });

              // Refresh data
              window.location.reload();
              return;
            } else {
              throw new Error(checkinData.message || 'Failed to check in');
            }
          }

          // Check if invitation has expired
          if (isInvitationExpired(invitation)) {
            toast({
              title: "Event Expired",
              description: "This event has already ended. Check-in is no longer available.",
              variant: "destructive",
            });
            return;
          }

          // Check in using QR data
          const qrData = JSON.stringify({
            invitationId: invitation._id,
            eventId: event._id,
            participantId: user._id,
            code: invitation.invitationCode
          });

          const checkinResponse = await fetch(`${API_CONFIG.API_BASE}/attendance/checkin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              qrData,
              location
            })
          });

          const checkinData = await checkinResponse.json();

          if (checkinData.success) {
            toast({
              title: "Check-in successful!",
              description: `Welcome to ${event.title}`,
            });
            
            // Start location tracking for this event
            if (checkinData.data.attendanceLog && checkinData.data.attendanceLog._id) {
              await startLocationWatching(event._id, checkinData.data.attendanceLog._id);
            }
            
            // Refresh scan history from database
            await refreshScanHistory();
            setEventCode('');
            
            // Refresh data
            window.location.reload();
          } else {
            throw new Error(checkinData.message);
          }
      } catch (locationError) {
        toast({
          title: "Location access required",
          description: "Please enable location access to join events",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to join event",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleCheckOut = async (attendanceId: string) => {
    try {
      // Get user location for check-out
      try {
        const location = await getCurrentLocationSafely();
        if (!location) {
          throw new Error('Location access required for event check-out');
        }

          const response = await fetch(`${API_CONFIG.API_BASE}/attendance/${attendanceId}/checkout`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              location
            })
          });

          const data = await response.json();

          if (data.success) {
            toast({
              title: "Checked out successfully!",
              description: "Thank you for attending the event",
            });
            
            // Stop location tracking for this event
            const attendanceRecord = myAttendance.find(att => att._id === attendanceId);
            if (attendanceRecord) {
              await stopLocationWatching(attendanceRecord.event._id || attendanceRecord.event);
            }
            
            // Refresh data
            window.location.reload();
          } else {
            throw new Error(data.message);
          }
      } catch (locationError) {
        toast({
          title: "Location access required",
          description: "Please enable location access to check out",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Check-out failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Helper functions to process data
  const getCurrentlyAttending = () => {

    const result = myAttendance.filter(attendance =>
      attendance.checkInTime &&
      !attendance.checkOutTime &&
      attendance.event?.status === 'active'
      // Include all statuses: 'checked-in', 'absent', etc.
      // This ensures participants marked absent still appear in "Currently Attending"
    );

    return result;
  };

  // Helper function to check if invitation is expired
  const isInvitationExpired = (invitation: any) => {
    // Don't consider accepted invitations or invitations from participants who attended as expired
    if (invitation.status === 'accepted' || invitation.hasAttended) return false;

    const now = new Date();
    const event = invitation.event;

    const eventDateStr = typeof event.date === 'string'
      ? event.date.split('T')[0]
      : new Date(event.date).toISOString().split('T')[0];

    let eventEndTime: Date;

    if (event.startTime && event.endTime) {
      // Use actual end time if available with proper timezone conversion
      const endDateTimeStr = `${eventDateStr}T${event.endTime}:00`;
      eventEndTime = fromZonedTime(endDateTimeStr, 'Asia/Singapore');
    } else {
      // Fallback to duration-based calculation
      const eventDate = new Date(event.date);
      eventEndTime = new Date(eventDate.getTime() + (event.duration || 3600000)); // Default 1 hour
    }

    return now > eventEndTime;
  };

  // Get events by category
  const getUpcomingEvents = () => {
    // Events you are invited to (regardless of status - pending, accepted, declined)
    // Separate expired and active invitations
    return myInvitations;
  };

  // Get expired invitations
  const getExpiredInvitations = () => {
    return myInvitations.filter(invitation => isInvitationExpired(invitation));
  };

  // Get active (non-expired) invitations
  const getActiveInvitations = () => {
    return myInvitations.filter(invitation => !isInvitationExpired(invitation));
  };

  // Get accepted invitations
  const getAcceptedInvitations = () => {
    return myInvitations.filter(invitation => invitation.status === 'accepted');
  };

  // Get declined invitations
  const getDeclinedInvitations = () => {
    return myInvitations.filter(invitation => invitation.status === 'declined');
  };

  const getActiveEvents = () => {
    // Events that are currently active AND you are attending (checked in but not checked out)
    // Includes participants with 'absent' status to show them in Currently Attending section
    return myAttendance.filter(attendance =>
      attendance.checkInTime &&
      !attendance.checkOutTime &&
      attendance.event?.status === 'active'
    );
  };

  const getCompletedEvents = () => {
    // Events you have completed (checked out)
    return myAttendance.filter(attendance => 
      attendance.checkOutTime
    );
  };

  const formatDuration = (checkIn: string, checkOut?: string) => {
    const startTime = new Date(checkIn);
    const endTime = checkOut ? new Date(checkOut) : new Date();
    const diffMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatEventDate = (event: any) => {
    if (event.endDate && event.endDate !== event.date) {
      // Multi-day event: show date range
      return `${new Date(event.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })} - ${new Date(event.endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })}`;
    } else {
      // Single-day event: show full date
      return new Date(event.date).toLocaleDateString();
    }
  };

  const formatEventTime = (event: any) => {
    if (event.startTime && event.endTime) {
      // Format startTime and endTime properly
      const formatTime = (timeString: string) => {
        if (!timeString) return '';
        return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      };

      return `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`;
    }

    // Fallback to just the date
    return new Date(event.date).toLocaleDateString();
  };

  // Fetch public events
  const fetchPublicEvents = async () => {
    try {
      const response = await fetch(`${API_CONFIG.API_BASE}/events/public`);
      const result = await response.json();
      
      if (result.success) {
        setPublicEvents(result.data.events || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch public events",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch public events",
        variant: "destructive",
      });
    }
  };

  // Handle joining public event
  const handleJoinPublicEvent = async (eventCode: string, eventTitle?: string, eventId?: string) => {
    console.log('🔥 [JOIN EVENT] Starting handleJoinPublicEvent');
    console.log('🔥 [JOIN EVENT] Parameters:', { eventCode, eventTitle, eventId });
    console.log('🔥 [JOIN EVENT] Token exists:', !!token);

    try {

      if (!token) {
        console.log('🔥 [JOIN EVENT] No token - authentication required');
        toast({
          title: "Authentication required",
          description: "Please log in to join events",
          variant: "destructive",
        });
        return;
      }

      console.log('🔥 [JOIN EVENT] Setting isJoining to true');
      setIsJoining(true);

      console.log('🔥 [JOIN EVENT] Making API call to /attendance/join');
      console.log('🔥 [JOIN EVENT] API Base URL:', API_CONFIG.API_BASE);
      console.log('🔥 [JOIN EVENT] Request body:', { eventCode });

      const response = await fetch(`${API_CONFIG.API_BASE}/attendance/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ eventCode })
      });

      console.log('🔥 [JOIN EVENT] Response status:', response.status);
      console.log('🔥 [JOIN EVENT] Response ok:', response.ok);

      const result = await response.json();
      console.log('🔥 [JOIN EVENT] Response body:', result);

      if (result.success) {
        console.log('=== JOIN BUTTON: Successfully joined event ===');
        console.log('Event ID:', eventId);
        console.log('Join result:', result);

        // Now automatically check in the user (same as QR scan functionality)
        try {
          console.log('🔥 [JOIN EVENT] Starting auto check-in process');

          // Get user location for check-in
          console.log('🔥 [JOIN EVENT] Getting user location...');
          const location = await getCurrentLocationSafely();
          console.log('🔥 [JOIN EVENT] Location obtained:', location);

          console.log('🔥 [JOIN EVENT] Making direct check-in API call');
          console.log('🔥 [JOIN EVENT] Check-in request:', {
            eventId,
            locationExists: !!location,
            apiUrl: `${API_CONFIG.API_BASE}/attendance/checkin-direct`
          });

          // Perform direct check-in
          const checkinResponse = await fetch(`${API_CONFIG.API_BASE}/attendance/checkin-direct`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              eventId: eventId,
              location
            })
          });

          console.log('🔥 [JOIN EVENT] Check-in response status:', checkinResponse.status);
          console.log('🔥 [JOIN EVENT] Check-in response ok:', checkinResponse.ok);

          const checkinData = await checkinResponse.json();
          console.log('🔥 [JOIN EVENT] Check-in response body:', checkinData);

          if (checkinData.success) {
            console.log('🔥 [JOIN EVENT] ✅ Check-in successful!');
            toast({
              title: "Joined and Checked In!",
              description: `Successfully joined and checked in to "${eventTitle || eventCode}"`,
            });
          } else {
            console.log('🔥 [JOIN EVENT] ❌ Check-in failed but join succeeded');
            console.log('🔥 [JOIN EVENT] Check-in failure reason:', checkinData.message);
            // Just joined successfully, but check-in failed
            toast({
              title: "Joined Successfully",
              description: `Joined "${eventTitle || eventCode}" but auto check-in failed. You can check in manually.`,
            });
          }
        } catch (checkinError) {
          console.error('🔥 [JOIN EVENT] ❌ Auto check-in exception:', checkinError);
          // Just joined successfully, but check-in failed
          toast({
            title: "Joined Successfully",
            description: `Joined "${eventTitle || eventCode}" but auto check-in failed. You can check in manually.`,
          });
        }

        // Refresh data by reloading the page or triggering a reload
        window.location.reload();

        // Stay on public events view to see the button change
        updateActiveView('public');
      } else if (result.requiresRegistration && result.registrationForm) {
        // Show registration form modal
        setPendingEventCode(eventCode);
        setPendingEventTitle(eventTitle || 'Event');
        setPendingEventId(eventId || '');
        setRegistrationFormData(result.registrationForm);
        setShowRegistrationForm(true);
      } else {
        console.log('🔥 [JOIN EVENT] ❌ Join failed:', result.message);
        if (result.requiresRegistration && result.registrationForm) {
          console.log('🔥 [JOIN EVENT] Registration required, showing form');
        }
        throw new Error(result.message || 'Failed to join event');
      }
    } catch (error: any) {
      console.error('🔥 [JOIN EVENT] ❌ Exception in handleJoinPublicEvent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to join event",
        variant: "destructive",
      });
    } finally {
      console.log('🔥 [JOIN EVENT] Setting isJoining to false (cleanup)');
      setIsJoining(false);
    }
  };

  // Handle successful registration form submission
  const handleRegistrationSuccess = async () => {
    setShowRegistrationForm(false);

    // Now try to join the event again
    try {
      setIsJoining(true);
      const response = await fetch(`${API_CONFIG.API_BASE}/attendance/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ eventCode: pendingEventCode })
      });

      const result = await response.json();

      if (result.success) {
        console.log('=== REGISTRATION SUCCESS: Successfully joined event ===');
        console.log('Event ID:', pendingEventId);
        console.log('Join result:', result);

        // Now automatically check in the user (same as QR scan functionality)
        try {
          // Get user location for check-in
          const location = await getCurrentLocationSafely();

          console.log('=== REGISTRATION SUCCESS: Attempting auto check-in ===');

          // Perform direct check-in
          const checkinResponse = await fetch(`${API_CONFIG.API_BASE}/attendance/checkin-direct`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              eventId: pendingEventId,
              location
            })
          });

          const checkinData = await checkinResponse.json();
          console.log('=== REGISTRATION SUCCESS: Check-in response ===', checkinData);

          if (checkinData.success) {
            toast({
              title: "Joined and Checked In!",
              description: `Successfully completed registration, joined and checked in to "${pendingEventTitle}"`,
            });
          } else {
            // Just joined successfully, but check-in failed
            toast({
              title: "Registration Complete",
              description: `Completed registration and joined "${pendingEventTitle}" but auto check-in failed. You can check in manually.`,
            });
          }
        } catch (checkinError) {
          console.error('Auto check-in after registration join failed:', checkinError);
          // Just joined successfully, but check-in failed
          toast({
            title: "Registration Complete",
            description: `Completed registration and joined "${pendingEventTitle}" but auto check-in failed. You can check in manually.`,
          });
        }

        // Clear pending data
        setPendingEventCode('');
        setPendingEventTitle('');
        setPendingEventId('');
        setRegistrationFormData(null);

        // Refresh data by reloading the page or triggering a reload
        window.location.reload();

        // Stay on public events view to see the button change
        updateActiveView('public');
      } else {
        throw new Error(result.message || 'Failed to join event after registration');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to join event after registration",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  // Handle leaving/canceling a public event
  const handleLeavePublicEvent = async (eventCode: string, eventTitle?: string) => {
    try {
      if (!token) {
        toast({
          title: "Authentication required",
          description: "Please log in to leave events",
          variant: "destructive",
        });
        return;
      }

      setIsJoining(true);
      const response = await fetch(`${API_CONFIG.API_BASE}/attendance/leave`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ eventCode })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Left Event",
          description: result.message || `Successfully left event: ${eventCode}`,
          variant: "default",
        });

        // Refresh data by reloading the page or triggering a reload
        window.location.reload();

        // Stay on public events view to see the button change
        updateActiveView('public');
      } else {
        throw new Error(result.message || 'Failed to leave event');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to leave event",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  // Check if participant is already joined to an event
  const isJoinedToEvent = (eventCode: string) => {
    return myAttendance.some((attendance: any) =>
      attendance.event?.eventCode === eventCode
    );
  };

  // Get attendance status for an event
  const getEventAttendanceStatus = (eventCode: string) => {
    const attendance = myAttendance.find((att: any) =>
      att.event?.eventCode === eventCode
    );

    if (!attendance) return null;

    // Check the actual status field first
    // If marked absent, return absent regardless of checkInTime/checkOutTime
    if (attendance.status === 'absent') {
      return {
        status: 'absent',
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        isCurrentlyAttending: true // Still considered attending but marked absent
      };
    }

    // Check if currently attending (checked in but not checked out)
    if (attendance.checkInTime && !attendance.checkOutTime) {
      return {
        status: attendance.status || 'checked-in',
        checkInTime: attendance.checkInTime,
        isCurrentlyAttending: true
      };
    }

    // Checked out (completed)
    if (attendance.checkOutTime && attendance.status === 'checked-out') {
      return {
        status: 'completed',
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        isCurrentlyAttending: false
      };
    }

    // Just joined but not checked in yet
    return {
      status: 'registered',
      isCurrentlyAttending: false
    };
  };

  // Handle profile editing
  const handleEditProfile = () => {
    const currentUser = userProfile || user;
    setEditableProfile({
      name: currentUser.name || '',
      email: currentUser.email || ''
    });
    setIsEditingProfile(true);
  };

  const handleCancelProfileEdit = () => {
    setIsEditingProfile(false);
    setEditableProfile({ name: '', email: '' });
  };

  const handleSaveProfile = async () => {
    if (!editableProfile.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    if (!editableProfile.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await fetch(`${API_CONFIG.API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editableProfile.name,
          email: editableProfile.email
        })
      });

      const result = await response.json();

      if (result.success) {
        // Update user state
        const updatedUser = { ...user, ...editableProfile };
        setUserProfile(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));

        setIsEditingProfile(false);
        toast({
          title: "Profile Updated",
          description: "Your profile has been successfully updated.",
        });

        // Trigger refresh
        window.dispatchEvent(new CustomEvent('userUpdated'));

        // Reload the page to ensure all components have the updated user data
        window.location.reload();
      } else {
        throw new Error(result.message || 'Failed to update profile');
      }
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleProfileInputChange = (field: string, value: string) => {
    setEditableProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Change password handlers
  const handleOpenChangePassword = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    });
    setShowChangePasswordModal(true);
  };

  const handleCloseChangePassword = () => {
    setShowChangePasswordModal(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    });
  };

  const handlePasswordInputChange = (field: string, value: string) => {
    setPasswordForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleChangePassword = async () => {
    // Validation
    if (!passwordForm.currentPassword) {
      toast({
        title: "Validation Error",
        description: "Current password is required",
        variant: "destructive",
      });
      return;
    }

    if (!passwordForm.newPassword) {
      toast({
        title: "Validation Error",
        description: "New password is required",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch(`${API_CONFIG.API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Password Changed",
          description: "Your password has been successfully updated.",
        });
        handleCloseChangePassword();
      } else {
        throw new Error(result.message || 'Failed to change password');
      }
    } catch (error: any) {
      toast({
        title: "Change Password Failed",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Format time helper (make it available globally in component)
  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Load public events when view changes to public
  useEffect(() => {
    if (activeView === 'public') {
      fetchPublicEvents();
    }
  }, [activeView]);

  // Render content based on active view
  const renderMainContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-700 dark:text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading events...</p>
          </div>
        </div>
      );
    }

    if (activeView === 'upcoming') {
      const upcomingEvents = getUpcomingEvents();
      const activeInvitations = getActiveInvitations();
      const expiredInvitations = getExpiredInvitations();
      const acceptedInvitations = getAcceptedInvitations();
      const declinedInvitations = getDeclinedInvitations();
      const pendingInvitations = myInvitations.filter(invitation => invitation.status === 'pending' && !isInvitationExpired(invitation));
      
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Invitations</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">{upcomingEvents.length} invitations</span>
          </div>
          
          {upcomingEvents.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12">
              <p className="text-lg mb-2">No invitations</p>
              <p className="text-sm">You'll see event invitations here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending Invitations */}
              {pendingInvitations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Pending Invitations ({pendingInvitations.length})</h3>
                  {pendingInvitations.map((invitation) => (
                    <div key={invitation._id} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                      <div className="flex flex-col">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{invitation.event.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{invitation.event.description}</p>
                        <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{formatEventDate(invitation.event)}</span>
                          <span className="mx-2">•</span>
                          <span>{formatEventTime(invitation.event)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                            Pending Response
                          </span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleInvitationResponse(invitation._id, 'accepted')}
                              className="text-green-600 hover:text-green-700 text-sm font-medium"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleInvitationResponse(invitation._id, 'declined')}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Accepted Invitations */}
              {acceptedInvitations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Accepted Invitations ({acceptedInvitations.length})
                    </h3>
                    <Button
                      onClick={handleDismissAllAcceptedInvitations}
                      variant="outline"
                      size="sm"
                      className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear All
                    </Button>
                  </div>
                  {acceptedInvitations.map((invitation) => (
                    <div key={invitation._id} className="bg-green-50 dark:bg-green-900/10 rounded-lg p-4 shadow-sm border border-green-200 dark:border-green-900/20">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{invitation.event.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{invitation.event.description}</p>
                          <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatEventDate(invitation.event)}</span>
                            <span className="mx-2">•</span>
                            <span>{formatEventTime(invitation.event)}</span>
                          </div>
                          <div className="flex items-center mt-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                              Accepted
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <Button
                            onClick={() => handleDismissExpiredInvitation(invitation._id)}
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                            title="Dismiss accepted invitation"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Declined Invitations */}
              {declinedInvitations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Declined Invitations ({declinedInvitations.length})
                    </h3>
                    <Button
                      onClick={handleDismissAllDeclinedInvitations}
                      variant="outline"
                      size="sm"
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear All
                    </Button>
                  </div>
                  {declinedInvitations.map((invitation) => (
                    <div key={invitation._id} className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 shadow-sm border border-red-200 dark:border-red-900/20">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{invitation.event.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{invitation.event.description}</p>
                          <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{formatEventDate(invitation.event)}</span>
                            <span className="mx-2">•</span>
                            <span>{formatEventTime(invitation.event)}</span>
                          </div>
                          <div className="flex items-center mt-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                              Declined
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <Button
                            onClick={() => handleDismissExpiredInvitation(invitation._id)}
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            title="Dismiss declined invitation"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Expired Invitations */}
              {expiredInvitations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Expired Invitations ({expiredInvitations.length})
                    </h3>
                    <Button
                      onClick={handleDismissAllExpiredInvitations}
                      variant="outline"
                      size="sm"
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear All
                    </Button>
                  </div>
                  {expiredInvitations.map((invitation) => (
                    <div key={invitation._id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 opacity-75">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-600 dark:text-gray-400">{invitation.event.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{invitation.event.description}</p>
                          <div className="flex items-center mt-2 text-xs text-gray-400 dark:text-gray-500">
                            <span>{formatEventDate(invitation.event)}</span>
                            <span className="mx-2">•</span>
                            <span>{formatEventTime(invitation.event)}</span>
                          </div>
                          
                          {/* Expired Status */}
                          <div className="flex items-center mt-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                              Expired
                            </span>
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-500">
                              Event has ended
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <Button
                            onClick={() => handleDismissExpiredInvitation(invitation._id)}
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            title="Dismiss expired invitation"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (activeView === 'active') {
      const activeEvents = getActiveEvents();
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Currently Attending</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">{activeEvents.length} events</span>
          </div>
          
          {activeEvents.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12">
              <p className="text-lg mb-2">No active events</p>
              <p className="text-sm">Check in to events to see them here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeEvents.map((attendance) => (
                <div key={attendance._id} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{attendance.event.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{attendance.event.description}</p>
                      
                      <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {attendance.status === 'absent' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                            • Marked Absent
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                            • Currently Attending
                          </span>
                        )}
                        <span className="ml-2">
                          Duration: {formatDuration(attendance.checkInTime)}
                        </span>
                      </div>
                      
                      <div className="flex items-center mt-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>Checked in: {new Date(attendance.checkInTime).toLocaleString()}</span>
                      </div>

                      {/* Absent Status Alert */}
                      {attendance.status === 'absent' && (
                        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-xs text-red-800 dark:text-red-300">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold">You have been marked absent</p>
                              <p className="mt-1">This may be due to exceeding the allowed time outside the event premises or location data becoming unavailable. Please contact the event organizer if you believe this is an error.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={() => handleOpenFeedbackForm(attendance.event._id, attendance.event.title)}
                          disabled={isFeedbackButtonDisabled(attendance.event._id)}
                          variant="outline"
                          size="sm"
                          className={`flex items-center gap-2 text-xs ${
                            isFeedbackButtonDisabled(attendance.event._id) 
                              ? 'opacity-50 cursor-not-allowed' 
                              : ''
                          }`}
                          title={getFeedbackButtonTooltip(attendance.event._id)}
                        >
                          <MessageSquare className="w-3 h-3" />
                          Feedback
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center space-y-2">
                      {attendance.status === 'absent' ? (
                        <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleOpenFeedbackForm(attendance.event._id, attendance.event.title)}
                          disabled={isFeedbackButtonDisabled(attendance.event._id)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                            isFeedbackButtonDisabled(attendance.event._id)
                              ? 'bg-gray-400 cursor-not-allowed opacity-50 text-gray-600'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                          title={getFeedbackButtonTooltip(attendance.event._id)}
                        >
                          <MessageSquare className="w-3 h-3" />
                          Feedback
                        </button>
                        <button 
                          onClick={() => handleCheckOut(attendance._id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                        >
                          Check Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeView === 'completed') {
      const completedEvents = getCompletedEvents();
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Completed Events</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">{completedEvents.length} events</span>
              {completedEvents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearConfirmation(true)}
                  disabled={isClearingEvents}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:border-red-600 dark:hover:border-red-500 dark:hover:bg-red-950/20"
                >
                  {isClearingEvents ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Clear All
                </Button>
              )}
            </div>
          </div>
          
          {completedEvents.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No completed events</p>
              <p className="text-sm">Events you check out from will appear here</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              
              {/* Table Rows */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {completedEvents.map((attendance) => (
                  <button
                    key={attendance._id}
                    className="grid grid-cols-2 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group w-full"
                    onClick={() => {
                      setSelectedEventRecord(attendance);
                      setShowEventRecordModal(true);
                    }}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                          {attendance.event.title}
                        </span>
                        {attendance.status === 'absent' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300 flex-shrink-0">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Absent
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {attendance.event.location?.address || attendance.event.location}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {new Date(attendance.event.date).toLocaleDateString()} • {formatDuration(attendance.checkInTime, attendance.checkOutTime)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDeleteEvent(attendance);
                        }}
                        className="p-1 rounded text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20 transition-colors"
                        title="Delete event record"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Clear Completed Events Confirmation Dialog */}
          {showClearConfirmation && (
            <Dialog open={showClearConfirmation} onOpenChange={setShowClearConfirmation}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                      <X className="w-5 h-5 text-white" />
                    </div>
                    Clear All Completed Events
                  </DialogTitle>
                  <DialogDescription>
                    Are you sure you want to clear all completed events? This action cannot be undone and will permanently remove all your completed event records.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowClearConfirmation(false)}
                    disabled={isClearingEvents}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleClearCompletedEvents}
                    disabled={isClearingEvents}
                    className="flex-1 flex items-center gap-2"
                  >
                    {isClearingEvents ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    {isClearingEvents ? 'Clearing...' : 'Clear All'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          {/* Individual Event Delete Confirmation Dialog */}
          {showDeleteConfirmation && eventToDelete && (
            <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                      <X className="w-5 h-5 text-white" />
                    </div>
                    Delete Event Record
                  </DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete the record for "{eventToDelete.event.title}"? This action cannot be undone and will permanently remove this event from your attendance history.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-4">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Event:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{eventToDelete.event.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Date:</span>
                      <span className="text-gray-900 dark:text-white">{new Date(eventToDelete.event.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                      <span className="text-gray-900 dark:text-white">{formatDuration(eventToDelete.checkInTime, eventToDelete.checkOutTime)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirmation(false);
                      setEventToDelete(null);
                    }}
                    disabled={isDeletingEvent}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteCompletedEvent}
                    disabled={isDeletingEvent}
                    className="flex-1 flex items-center gap-2"
                  >
                    {isDeletingEvent ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    {isDeletingEvent ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          {/* Event Record Details Modal */}
          {showEventRecordModal && selectedEventRecord && (
            <Dialog open={showEventRecordModal} onOpenChange={setShowEventRecordModal}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {selectedEventRecord.status === 'absent' ? (
                      <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    )}
                    {selectedEventRecord.event.title}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedEventRecord.status === 'absent'
                      ? 'You were marked absent at this event'
                      : 'Your attendance record for this completed event'
                    }
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Event Information */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Event Date</label>
                        <p className="text-gray-900 dark:text-white">
                          {new Date(selectedEventRecord.event.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
                        <p className="text-gray-900 dark:text-white">
                          {selectedEventRecord.event.location?.address || selectedEventRecord.event.location || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Organizer</label>
                        <p className="text-gray-900 dark:text-white">
                          {selectedEventRecord.event.organizer?.name || selectedEventRecord.event.organizer || 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Check-in Time</label>
                        <p className="text-gray-900 dark:text-white font-mono">
                          {new Date(selectedEventRecord.checkInTime).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Check-out Time</label>
                        <p className="text-gray-900 dark:text-white font-mono">
                          {selectedEventRecord.checkOutTime 
                            ? new Date(selectedEventRecord.checkOutTime).toLocaleString()
                            : 'Still checked in'
                          }
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Duration</label>
                        <p className="text-green-600 dark:text-green-400 font-semibold">
                          {formatDuration(selectedEventRecord.checkInTime, selectedEventRecord.checkOutTime)}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Attendance Status</label>
                        {(() => {
                          const attendanceStatus = getAttendanceStatus(selectedEventRecord);
                          return (
                            <p className={`font-semibold ${attendanceStatus.color}`}>
                              {attendanceStatus.message}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Event Description */}
                  {selectedEventRecord.event.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                      <p className="mt-1 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        {selectedEventRecord.event.description}
                      </p>
                    </div>
                  )}
                  
                  {/* Location Details */}
                  {selectedEventRecord.checkInLocation && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Check-in Location</label>
                      <div className="mt-1 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Coordinates: {selectedEventRecord.checkInLocation.latitude?.toFixed(6)}, {selectedEventRecord.checkInLocation.longitude?.toFixed(6)}
                        </p>
                        {selectedEventRecord.checkInLocation.accuracy && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Accuracy: ±{selectedEventRecord.checkInLocation.accuracy}m
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                        ✓ Completed
                      </span>
                      {selectedEventRecord.autoCheckOut && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                          Auto Check-out
                        </span>
                      )}
                    </div>
                    
                    {/* Action Button */}
                    <Button
                      onClick={() => handleOpenFeedbackForm(selectedEventRecord.event._id, selectedEventRecord.event.title)}
                      disabled={isFeedbackButtonDisabled(selectedEventRecord.event._id)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      title={getFeedbackButtonTooltip(selectedEventRecord.event._id)}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Feedback
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      );
    }

    if (activeView === 'public') {
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Browse Events</h2>
            <Button 
              onClick={fetchPublicEvents}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
          
          {publicEvents.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12">
              <Globe className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No public events found</p>
              <p className="text-sm">Check back later for new events to join</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {publicEvents.map((event) => (
                <div key={event._id} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{event.title}</h3>
                      {event.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.description}</p>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          <span>{formatEventDate(event)}</span>
                        </div>
                        {(event.startTime || event.endTime) && (
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            <span>
                              {event.startTime && formatTime(event.startTime)}
                              {event.startTime && event.endTime && ' - '}
                              {event.endTime && formatTime(event.endTime)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1" />
                          <span>{event.location?.address || 'Location TBA'}</span>
                        </div>
                        <div className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          <span>{event.organizer?.name || 'Event Organizer'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-900/20 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                            {event.eventCode}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            event.status === 'active'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {event.status === 'active' ? 'Active' : 'Upcoming'}
                          </span>
                          {(() => {
                            const attendanceStatus = getEventAttendanceStatus(event.eventCode);
                            if (!attendanceStatus) return null;

                            if (attendanceStatus.status === 'absent') {
                              return (
                                <span className="inline-flex items-center text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Marked Absent
                                </span>
                              );
                            } else if (attendanceStatus.status === 'checked-in') {
                              return (
                                <span className="inline-flex items-center text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Currently Attending
                                </span>
                              );
                            } else if (attendanceStatus.status === 'completed') {
                              return (
                                <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
                                  Completed
                                </span>
                              );
                            } else if (attendanceStatus.status === 'registered') {
                              return (
                                <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                  Registered
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        {(() => {
                          const attendanceStatus = getEventAttendanceStatus(event.eventCode);

                          if (isJoinedToEvent(event.eventCode)) {
                            // Don't show button if marked absent or completed
                            if (attendanceStatus?.status === 'absent' || attendanceStatus?.status === 'completed') {
                              return null;
                            }

                            // Normal cancel button for joined events (only for checked-in or registered)
                            return (
                              <Button
                                onClick={() => handleLeavePublicEvent(event.eventCode, event.title)}
                                size="sm"
                                variant="destructive"
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            );
                          } else {
                            // Join button for events not joined
                            return (
                              <Button
                                onClick={() => handleJoinPublicEvent(event.eventCode, event.title, event._id)}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <QrCode className="w-3 h-3 mr-1" />
                                Join
                              </Button>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeView === 'profile') {
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile</h2>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Profile Header */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{(userProfile || user).name || 'User'}</h3>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 mt-1">
                  {(userProfile || user).role || 'Participant'}
                </span>
              </div>
            </div>
            
            {/* Profile Details */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                {isEditingProfile ? (
                  <input
                    type="text"
                    value={editableProfile.name}
                    onChange={(e) => handleProfileInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your full name"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {(userProfile || user).name || 'Not provided'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                {isEditingProfile ? (
                  <input
                    type="email"
                    value={editableProfile.email}
                    onChange={(e) => handleProfileInputChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email address"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {(userProfile || user).email || 'Not provided'}
                    </span>
                  </div>
                )}
              </div>

              {(userProfile || user).lastLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Login</label>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {new Date((userProfile || user).lastLogin).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            {isEditingProfile ? (
              <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0 mt-6">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-base font-semibold transition-colors"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelProfileEdit}
                  disabled={isSavingProfile}
                  className="flex-1 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg text-base font-semibold transition-colors"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0 mt-6">
                <Button
                  onClick={handleEditProfile}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-base font-semibold transition-colors"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
                <Button
                  onClick={handleOpenChangePassword}
                  variant="outline"
                  className="flex-1 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg text-base font-semibold transition-colors"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeView === 'settings') {
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          </div>
          
          {/* Notifications */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Event Invitations</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Get notified when you receive event invitations</p>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only" defaultChecked />
                  <div className="w-10 h-6 bg-blue-600 rounded-full shadow-inner"></div>
                  <div className="absolute w-4 h-4 bg-white rounded-full shadow top-1 right-1"></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Check-in Reminders</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Remind me to check in to events</p>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only" defaultChecked />
                  <div className="w-10 h-6 bg-blue-600 rounded-full shadow-inner"></div>
                  <div className="absolute w-4 h-4 bg-white rounded-full shadow top-1 right-1"></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Privacy */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Privacy</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Location Tracking</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Allow location tracking during events</p>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only" defaultChecked />
                  <div className="w-10 h-6 bg-blue-600 rounded-full shadow-inner"></div>
                  <div className="absolute w-4 h-4 bg-white rounded-full shadow top-1 right-1"></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Share Attendance</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Allow organizers to see your attendance status</p>
                </div>
                <div className="relative">
                  <input type="checkbox" className="sr-only" defaultChecked />
                  <div className="w-10 h-6 bg-blue-600 rounded-full shadow-inner"></div>
                  <div className="absolute w-4 h-4 bg-white rounded-full shadow top-1 right-1"></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* App Preferences */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">App Preferences</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option>System Default</option>
                  <option>Light</option>
                  <option>Dark</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* App Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">About</h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>EventConnect v1.0.0</p>
              <p>© 2024 EventConnect. All rights reserved.</p>
            </div>
          </div>
        </div>
      );
    }

    if (activeView === 'organization') {
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Organization</h2>
            <Button
              onClick={() => setShowJoinForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              {userOrganization ? 'Join Another' : 'Join Organization'}
            </Button>
          </div>
          
          {/* Organization Tabs - Tabular Form (Only on Organization Page) */}
          {userOrganizations.length > 1 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Switch Organization</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">You are a member of multiple organizations. Click to switch between them.</p>
              </div>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full table-auto border-collapse border border-gray-300 dark:border-gray-600">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="border border-gray-300 dark:border-gray-600 px-2 sm:px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                        Organization
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-2 sm:px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white w-24 sm:w-auto">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {userOrganizations.map((org, index) => (
                      <tr 
                        key={org._id || `org-${index}`}
                        className={`${
                          activeOrganization?._id === org._id
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <td className="border border-gray-300 dark:border-gray-600 px-2 sm:px-4 py-3">
                          <div className="flex items-center">
                            <Building2 className="w-5 h-5 mr-3 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                            <div>
                              <div className="text-base font-medium text-gray-900 dark:text-white">{org.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{org.organizationCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-1 sm:px-4 py-3 text-center">
                          {activeOrganization?._id === org._id ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Current
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSwitchOrganization(org)}
                              disabled={loadingOrganization}
                              className="inline-flex items-center px-2 sm:px-3 py-1 border border-blue-300 dark:border-blue-600 text-xs font-medium rounded text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {loadingOrganization ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                'Switch'
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {loadingOrganization ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading organization...</p>
              </div>
            </div>
          ) : userOrganization ? (
            <div className="space-y-6">
              {/* Organization Info */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{userOrganization.name}</h3>
                    {userOrganization.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{userOrganization.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Code:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">
                        {userOrganization.organizationCode}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(userOrganization.organizationCode);
                          toast({ title: 'Copied!', description: 'Organization code copied to clipboard.' });
                        }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {userOrganization.memberCount}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Members</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">Member</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Your Role</div>
                  </div>
                </div>
                
                <div className="flex justify-center sm:justify-end">
                  <button
                    onClick={handleLeaveOrganization}
                    disabled={leavingOrganization}
                    className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {leavingOrganization ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Leaving...
                      </>
                    ) : (
                      'Leave Organization'
                    )}
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Members & Admins</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    All organization members and their roles
                  </p>
                </div>
                
                <div className="p-6 space-y-4">
                  {/* Owner */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 gap-3 sm:gap-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{userOrganization.owner.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{userOrganization.owner.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        Owner
                      </span>
                    </div>
                  </div>

                  {/* Admins (excluding owner) - Show members with admin role */}
                  {userOrganization.members?.filter((member: any) => 
                    member.role === 'admin' && 
                    member.user._id !== userOrganization.owner._id
                  ).map((member: any, index: number) => (
                    <div key={member.user._id || `admin-${index}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 gap-3 sm:gap-0">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-base font-medium text-gray-900 dark:text-white">{member.user?.name || 'Unknown User'}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{member.user?.email || 'No email'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          Admin
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Regular Members */}
                  {userOrganization.members?.filter((member: any) => {
                    const isNotOwner = member.user._id !== userOrganization.owner._id;
                    const isMemberRole = !member.role || member.role === 'member';
                    return isMemberRole && isNotOwner;
                  }).map((member: any, index: number) => (
                    <div key={member.user._id || `member-${index}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg gap-3 sm:gap-0">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-base font-medium text-gray-900 dark:text-white">{member.user?.name || 'Unknown User'}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{member.user?.email || 'No email'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                          Member
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y-6">
              {/* No Organization State */}
              <div className="text-center py-8">
                <Building2 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Organization</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  You're not part of any organization yet. Use the "Join Organization" button above to get started.
                </p>
              </div>

            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // Handle dismissing expired invitations
  const handleDismissExpiredInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`${API_CONFIG.API_BASE}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        // Remove from local state
        const updatedInvitations = myInvitations.filter(inv => inv._id !== invitationId);
        setMyInvitations(updatedInvitations);
        
        toast({
          title: "Invitation Dismissed",
          description: "Expired invitation has been removed from your list.",
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to dismiss invitation. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle dismissing all expired invitations
  const handleDismissAllExpiredInvitations = async () => {
    try {
      const expiredInvitations = getExpiredInvitations();
      
      if (expiredInvitations.length === 0) {
        toast({
          title: "No Expired Invitations",
          description: "There are no expired invitations to dismiss.",
        });
        return;
      }

      // Show confirmation dialog
      const confirmed = window.confirm(
        `Are you sure you want to dismiss all ${expiredInvitations.length} expired invitation(s)? This action cannot be undone.`
      );
      
      if (!confirmed) {
        return;
      }

      const response = await fetch(`${API_CONFIG.API_BASE}/invitations/my/expired`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        // Remove all expired invitations from local state
        const updatedInvitations = myInvitations.filter(inv => !isInvitationExpired(inv));
        setMyInvitations(updatedInvitations);
        
        toast({
          title: "All Expired Invitations Dismissed",
          description: `${result.deletedCount} expired invitation(s) have been removed from your list.`,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to dismiss expired invitations. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle dismissing all accepted invitations
  const handleDismissAllAcceptedInvitations = async () => {
    try {
      const acceptedInvitations = getAcceptedInvitations();
      
      if (acceptedInvitations.length === 0) {
        toast({
          title: "No Accepted Invitations",
          description: "There are no accepted invitations to dismiss.",
        });
        return;
      }

      // Show confirmation dialog
      const confirmed = window.confirm(
        `Are you sure you want to dismiss all ${acceptedInvitations.length} accepted invitation(s)? This action cannot be undone.`
      );
      
      if (!confirmed) {
        return;
      }

      const response = await fetch(`${API_CONFIG.API_BASE}/invitations/my/accepted`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        // Remove all accepted invitations from local state
        const updatedInvitations = myInvitations.filter(inv => inv.status !== 'accepted');
        setMyInvitations(updatedInvitations);
        
        toast({
          title: "All Accepted Invitations Dismissed",
          description: `${result.deletedCount} accepted invitation(s) have been removed from your list.`,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to dismiss accepted invitations. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle dismissing all declined invitations
  const handleDismissAllDeclinedInvitations = async () => {
    try {
      const declinedInvitations = getDeclinedInvitations();
      
      if (declinedInvitations.length === 0) {
        toast({
          title: "No Declined Invitations",
          description: "There are no declined invitations to dismiss.",
        });
        return;
      }

      // Show confirmation dialog
      const confirmed = window.confirm(
        `Are you sure you want to dismiss all ${declinedInvitations.length} declined invitation(s)? This action cannot be undone.`
      );
      
      if (!confirmed) {
        return;
      }

      const response = await fetch(`${API_CONFIG.API_BASE}/invitations/my/declined`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        // Remove all declined invitations from local state
        const updatedInvitations = myInvitations.filter(inv => inv.status !== 'declined');
        setMyInvitations(updatedInvitations);
        
        toast({
          title: "All Declined Invitations Dismissed",
          description: `${result.deletedCount} declined invitation(s) have been removed from your list.`,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to dismiss declined invitations. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Check feedback form status for multiple events
  const checkFeedbackFormsStatus = async (eventIds: string[]) => {
    if (!token || eventIds.length === 0) return;
    
    try {
      const statusChecks = await Promise.all(
        eventIds.map(async (eventId) => {
          try {
            const response = await fetch(`${API_CONFIG.API_BASE}/feedback-forms/event/${eventId}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              }
            });
            
            if (response.ok) {
              const result = await response.json();
              return {
                eventId,
                exists: true,
                isPublished: result.data.feedbackForm?.isPublished || false
              };
            } else {
              return {
                eventId,
                exists: false,
                isPublished: false
              };
            }
          } catch (error) {
            return {
              eventId,
              exists: false,
              isPublished: false
            };
          }
        })
      );

      const statusMap = statusChecks.reduce((acc, { eventId, exists, isPublished }) => {
        acc[eventId] = { exists, isPublished };
        return acc;
      }, {} as Record<string, { exists: boolean; isPublished: boolean }>);

      setFeedbackFormsStatus(prev => ({ ...prev, ...statusMap }));
    } catch (error) {
    }
  };

  // Handle opening feedback form
  const handleOpenFeedbackForm = (eventId: string, eventTitle: string) => {
    const formStatus = feedbackFormsStatus[eventId];
    
    if (!formStatus?.exists) {
      toast({
        title: "No Feedback Form",
        description: "No feedback form is available for this event yet.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formStatus?.isPublished) {
      toast({
        title: "Feedback Form Not Available",
        description: "The feedback form for this event is not published yet.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFeedbackEvent({ id: eventId, title: eventTitle });
    setShowFeedbackForm(true);
  };

  // Handle closing feedback form
  const handleCloseFeedbackForm = () => {
    setShowFeedbackForm(false);
    setSelectedFeedbackEvent(null);
  };

  // Handle feedback form submission
  const handleFeedbackSubmit = (_responses: Record<string, any>) => {
    toast({
      title: "Feedback Submitted",
      description: "Thank you for your feedback!",
    });
    handleCloseFeedbackForm();
  };

  // Check if feedback button should be disabled
  const isFeedbackButtonDisabled = (eventId: string) => {
    const formStatus = feedbackFormsStatus[eventId];
    return !formStatus?.exists || !formStatus?.isPublished;
  };

  // Get feedback button tooltip/title text
  const getFeedbackButtonTooltip = (eventId: string) => {
    const formStatus = feedbackFormsStatus[eventId];
    if (!formStatus?.exists) {
      return "No feedback form available";
    }
    if (!formStatus?.isPublished) {
      return "Feedback form not published yet";
    }
    return "Click to provide feedback";
  };

  // Handle invitation response
  const handleInvitationResponse = async (invitationId: string, response: 'accepted' | 'declined') => {
    try {
      // Find the invitation to check if it's expired
      const invitation = myInvitations.find(inv => inv._id === invitationId);
      
      if (invitation && isInvitationExpired(invitation)) {
        toast({
          title: "Invitation Expired",
          description: "This invitation has expired. The event has already ended.",
          variant: "destructive",
        });
        return;
      }

      const apiResponse = await fetch(`${API_CONFIG.API_BASE}/invitations/${invitationId}/respond`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ response })
      });

      const data = await apiResponse.json();

      if (data.success) {
        toast({
          title: `Invitation ${response}`,
          description: `You have ${response} the invitation successfully`,
        });
        
        // Refresh data
        window.location.reload();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Failed to respond to invitation",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Function to refresh scan history from database
  const refreshScanHistory = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_CONFIG.API_BASE}/attendance/scan-history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setScanHistory(data.data.scanHistory);
      }
    } catch (error) {
    }
  };

  // Helper function to force a location update (heartbeat)
  const forceLocationUpdate = async (eventId: string) => {
    try {
      if (Capacitor.isNativePlatform()) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000
        });

        const getBatteryLevel = async () => {
          try {
            if ('getBattery' in navigator) {
              const battery = await (navigator as any).getBattery();
              return Math.round(battery.level * 100);
            }
            return null;
          } catch (error) {
            return null;
          }
        };

        const batteryLevel = await getBatteryLevel();
        await updateLocation(
          eventId,
          user._id,
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy,
          batteryLevel
        );
        setLastLocationUpdateTime(new Date());
      } else {
        // For web platforms
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const getBatteryLevel = async () => {
                try {
                  if ('getBattery' in navigator) {
                    const battery = await (navigator as any).getBattery();
                    return Math.round(battery.level * 100);
                  }
                  return null;
                } catch (error) {
                  return null;
                }
              };

              const batteryLevel = await getBatteryLevel();
              await updateLocation(
                eventId,
                user._id,
                position.coords.latitude,
                position.coords.longitude,
                position.coords.accuracy,
                batteryLevel
              );
              setLastLocationUpdateTime(new Date());
            },
            () => {
              // Heartbeat failed - silently ignore
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        }
      }
    } catch (error) {
      // Force location update failed - silently ignore
    }
  };

  // Location tracking functions
  const startLocationWatching = async (eventId: string, attendanceLogId: string) => {
    try {
      // Check location permissions first
      const hasPermission = await checkLocationPermissions();

      if (!hasPermission) {
        toast({
          title: "Location Permission Required",
          description: "Location tracking requires permission to work properly.",
          variant: "destructive",
        });
        return;
      }

      // Initialize location tracking on server
      await startLocationTracking(eventId, user._id, attendanceLogId);

      // Get battery level helper function
      const getBatteryLevel = async () => {
        try {
          if ('getBattery' in navigator) {
            const battery = await (navigator as any).getBattery();
            return Math.round(battery.level * 100);
          }
          return null;
        } catch (error) {
          return null;
        }
      };

      // Get and send initial location immediately
      try {
        if (Capacitor.isNativePlatform()) {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000
          });
          const batteryLevel = await getBatteryLevel();
          await updateLocation(
            eventId,
            user._id,
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
            batteryLevel
          );
          setLastLocationUpdateTime(new Date());
        } else {
          // For web platforms
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const batteryLevel = await getBatteryLevel();
              await updateLocation(
                eventId,
                user._id,
                position.coords.latitude,
                position.coords.longitude,
                position.coords.accuracy,
                batteryLevel
              );
              setLastLocationUpdateTime(new Date());
            },
            (error) => {
              console.error('Initial location fetch failed:', error);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000
            }
          );
        }
      } catch (error) {
        console.error('Failed to get initial location:', error);
      }

      toast({
        title: "Location Tracking Started",
        description: "Your location is being tracked for this event.",
      });

      // Start watching location
      if (Capacitor.isNativePlatform()) {
        // For native platforms, use Capacitor Geolocation
        const watchId = await Geolocation.watchPosition({
          enableHighAccuracy: true,
          timeout: 10000
        }, (position) => {
          if (position) {
            // Get battery level if available
            const getBatteryLevel = async () => {
              try {
                if ('getBattery' in navigator) {
                  const battery = await (navigator as any).getBattery();
                  return Math.round(battery.level * 100);
                }
                return null;
              } catch (error) {
                return null;
              }
            };

            getBatteryLevel().then((batteryLevel) => {
              updateLocation(
                eventId,
                user._id,
                position.coords.latitude,
                position.coords.longitude,
                position.coords.accuracy,
                batteryLevel
              ).then(() => {
                setLastLocationUpdateTime(new Date());
              }).catch((error) => {
                console.error('Location update failed:', error);
              });
            });
          }
        });
        setLocationWatchId(watchId as any);
      } else {
        // For web platforms, use standard geolocation API
        if (navigator.geolocation) {
          const watchId = navigator.geolocation.watchPosition(
            (position) => {
              // Get battery level if available
              const getBatteryLevel = async () => {
                try {
                  if ('getBattery' in navigator) {
                    const battery = await (navigator as any).getBattery();
                    return Math.round(battery.level * 100);
                  }
                  return null;
                } catch (error) {
                  return null;
                }
              };

              getBatteryLevel().then((batteryLevel) => {
                updateLocation(
                  eventId,
                  user._id,
                  position.coords.latitude,
                  position.coords.longitude,
                  position.coords.accuracy,
                  batteryLevel
                ).then(() => {
                  setLastLocationUpdateTime(new Date());
                }).catch((error) => {
                  console.error('Web location update failed:', error);
                });
              });
            },
            (error) => {
              console.error('Geolocation error:', error);
              toast({
                title: "Location Error",
                description: "Unable to track location. Please check permissions.",
                variant: "destructive",
              });
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000
            }
          );
          setLocationWatchId(watchId);
        }
      }

      // Set up heartbeat to force location updates every 2 minutes
      // This ensures updates continue even if watchPosition stops sending updates
      const heartbeatInterval = setInterval(() => {
        const now = new Date();
        const timeSinceLastUpdate = lastLocationUpdateTime
          ? (now.getTime() - lastLocationUpdateTime.getTime()) / 1000 / 60
          : 999;

        // Force update if more than 2 minutes since last update
        if (timeSinceLastUpdate > 2) {
          forceLocationUpdate(eventId);
        }
      }, 120000); // Check every 2 minutes

      setLocationHeartbeatInterval(heartbeatInterval);

      toast({
        title: "Location Tracking Started",
        description: "Your location is now being tracked for this event.",
      });
    } catch (error: any) {
      toast({
        title: "Location Tracking Failed",
        description: `Failed to start location tracking: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const stopLocationWatching = async (eventId: string) => {
    try {
      // Stop location tracking on server
      await stopLocationTracking(eventId, user._id);

      // Stop watching location
      if (locationWatchId) {
        if (Capacitor.isNativePlatform()) {
          await Geolocation.clearWatch({ id: locationWatchId as any });
        } else {
          navigator.geolocation.clearWatch(locationWatchId);
        }
        setLocationWatchId(null);
      }

      // Clear heartbeat interval
      if (locationHeartbeatInterval) {
        clearInterval(locationHeartbeatInterval);
        setLocationHeartbeatInterval(null);
      }

      setCurrentLocationStatus(null);
      setLastLocationUpdateTime(null);

      toast({
        title: "Location Tracking Stopped",
        description: "Location tracking has been disabled for this event.",
      });
    } catch (error) {
      // Error stopping location tracking - silently ignore
    }
  };

  // Fetch current location status for active events
  const fetchLocationStatus = async (eventId: string) => {
    if (!token || !user._id) return;
    
    try {
      const response = await fetch(`${API_CONFIG.API_BASE}/events/location-tracking/participant/${user._id}/event/${eventId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentLocationStatus(data.data);
      }
    } catch (error) {
    }
  };


  // Native haptic feedback
  const triggerHapticFeedback = async (type: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Use native haptic feedback
        const impactStyles = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy
        };
        await Haptics.impact({ style: impactStyles[type] });
      } else {
        // Fallback to web vibration
        if (navigator.vibrate) {
          const patterns = {
            light: 10,
            medium: 50,
            heavy: 100
          };
          navigator.vibrate(patterns[type]);
        }
      }
    } catch (error) {
    }
  };

  // Leave organization function
  const handleLeaveOrganization = async () => {
    if (!userOrganization || !token) return;
    
    try {
      setLeavingOrganization(true);
      
      const response = await fetch(`${API_CONFIG.API_BASE}/organizations/leave`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setUserOrganization(null);
        toast({
          title: 'Left Organization',
          description: `You have successfully left ${userOrganization.name}.`
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to leave organization.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to leave organization. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLeavingOrganization(false);
    }
  };

  // Switch active organization
  const handleSwitchOrganization = async (organization: any) => {
    if (!token || organization._id === activeOrganization?._id) return;
    
    try {
      setLoadingOrganization(true);
      
      const response = await fetch(`${API_CONFIG.API_BASE}/organization-membership/set-active`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ organizationId: organization._id })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setActiveOrganization(organization);
        setUserOrganization(organization); // Keep compatibility
        
        // Refresh data for new organization without losing current view
        setTimeout(() => {
          // Store current view before reload
          const currentView = activeView;
          localStorage.setItem('participantActiveView', currentView);
          window.location.reload(); // Simple way to refresh all data
        }, 500);
        
        toast({
          title: 'Organization Switched',
          description: `Switched to ${organization.name}`
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to switch organization',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to switch organization',
        variant: 'destructive'
      });
    } finally {
      setLoadingOrganization(false);
    }
  };

  // Join organization function
  const handleJoinOrganization = async () => {
    if (!joinOrgCode.trim() || !token) return;
    
    try {
      setJoiningOrganization(true);
      
      const response = await fetch(`${API_CONFIG.API_BASE}/organization-membership/join-multiple`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ organizationCode: joinOrgCode.trim().toUpperCase() })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh organizations data
        const orgResponse = await fetch(`${API_CONFIG.API_BASE}/organization-membership/my-organizations`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        const orgResult = await orgResponse.json();
        if (orgResult.success) {
          setUserOrganizations(orgResult.data);
          // Set newly joined organization as active
          const newOrg = orgResult.data.find((org: any) => org._id === result.data.organization._id);
          if (newOrg) {
            setActiveOrganization(newOrg);
            setUserOrganization(newOrg);
          }
        }
        
        setShowJoinForm(false);
        setJoinOrgCode('');
        toast({
          title: 'Joined Organization',
          description: result.message || 'Successfully joined the organization!'
        });
      } else {
        toast({
          title: 'Failed to Join',
          description: result.message || 'Invalid organization code or you may already be in an organization.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to join organization. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setJoiningOrganization(false);
    }
  };

  // Enhanced button handlers with haptic feedback
  const handleJoinEventMobile = () => {
    triggerHapticFeedback('medium');
    handleJoinEvent();
  };

  const handleQRUploadMobile = () => {
    triggerHapticFeedback('light');
    handleQRUpload();
  };

  const startQRScannerMobile = () => {
    triggerHapticFeedback('medium');
    
    if (isCameraActive) {
      stopQRScanner();
    } else {
      setIsScanning(true);
      startQRScanner();
    }
  };

  // Splash Screen Component
  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex items-center justify-center z-50">
        <div className="text-center text-white">
          <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
            <QrCode className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Event Connect</h1>
          <p className="text-blue-100 text-lg mb-8">Scan & Join Events</p>
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 select-none touch-manipulation max-w-full overflow-x-hidden overflow-y-hidden relative">
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-1 text-xs z-40">
          <span>📡 Offline Mode - Some features may be limited</span>
        </div>
      )}
      
      {/* Top Header Bar */}
      <div className={`flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${!isOnline ? 'mt-6' : ''}`}>
        <button 
          onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
          className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center text-gray-700 dark:text-white active:bg-gray-200 dark:active:bg-gray-500 touch-manipulation relative"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        
        <button className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center text-gray-700 dark:text-white active:bg-gray-200 dark:active:bg-gray-500 touch-manipulation">
          <Zap className="w-5 h-5" />
        </button>
        
        <button 
          onClick={() => setFacingMode(facingMode === 'environment' ? 'user' : 'environment')}
          className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center text-gray-700 dark:text-white active:bg-gray-200 dark:active:bg-gray-500 touch-manipulation"
          title={`Switch to ${facingMode === 'environment' ? 'front' : 'back'} camera`}
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>


      {/* Navigation Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-80 portrait:w-72 bg-white dark:bg-gray-800 shadow-xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
        showHistoryDropdown ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Sidebar Header - Fixed */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Navigation</h2>
            <button 
              onClick={() => setShowHistoryDropdown(false)}
              className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white hover:bg-opacity-30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Header */}
          <div className="text-center">
            <Menu className="w-8 h-8 mx-auto mb-2 text-white" />
            <h3 className="text-lg font-semibold text-white">Events</h3>
          </div>
        </div>

        {/* Navigation Content - Scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="p-3 sm:p-4">
          <div className="space-y-2">
            {/* Upcoming Events */}
            <button 
              onClick={() => { updateActiveView('upcoming'); setShowHistoryDropdown(false); }}
              className={`w-full flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left ${
                activeView === 'upcoming' ? 'bg-orange-50 dark:bg-orange-900/20 border-l-3 border-orange-500' : ''
              }`}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-md flex items-center justify-center mr-2 flex-shrink-0">
                <QrCode className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Invitations</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Events you are invited to</p>
              </div>
            </button>
            
            {/* Active Events */}
            <button 
              onClick={() => { updateActiveView('active'); setShowHistoryDropdown(false); }}
              className={`w-full flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left ${
                activeView === 'active' ? 'bg-green-50 dark:bg-green-900/20 border-l-3 border-green-500' : ''
              }`}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-md flex items-center justify-center mr-2 flex-shrink-0">
                <QrCode className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Currently Attending</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Events you are attending</p>
              </div>
            </button>
            
            {/* Completed Events */}
            <button 
              onClick={() => { updateActiveView('completed'); setShowHistoryDropdown(false); }}
              className={`w-full flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left ${
                activeView === 'completed' ? 'bg-gray-50 dark:bg-gray-900/20 border-l-3 border-gray-500' : ''
              }`}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-gray-500 to-gray-600 rounded-md flex items-center justify-center mr-2 flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Completed Events</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Events you have completed</p>
              </div>
            </button>
            
            {/* Browse Public Events */}
            <button 
              onClick={() => { updateActiveView('public'); setShowHistoryDropdown(false); }}
              className={`w-full flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left ${
                activeView === 'public' ? 'bg-blue-50 dark:bg-blue-900/20 border-l-3 border-blue-500' : ''
              }`}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-md flex items-center justify-center mr-2 flex-shrink-0">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Browse Events</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Discover public events</p>
              </div>
            </button>
          </div>
          
          {/* Account Section */}
          <div className="space-y-1 mt-6">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">Account</h3>
            
            {/* Profile */}
            <button 
              onClick={() => { updateActiveView('profile'); setShowHistoryDropdown(false); }}
              className={`w-full flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left ${
                activeView === 'profile' ? 'bg-purple-50 dark:bg-purple-900/20 border-l-3 border-purple-500' : ''
              }`}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-md flex items-center justify-center mr-2 flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Profile</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Your account information</p>
              </div>
            </button>
            
            {/* Settings */}
            <button 
              onClick={() => { updateActiveView('settings'); setShowHistoryDropdown(false); }}
              className={`w-full flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left ${
                activeView === 'settings' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-3 border-indigo-500' : ''
              }`}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-md flex items-center justify-center mr-2 flex-shrink-0">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Settings</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">App preferences</p>
              </div>
            </button>
            
            {/* Organization */}
            <button 
              onClick={() => { updateActiveView('organization'); setShowHistoryDropdown(false); }}
              className={`w-full flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left ${
                activeView === 'organization' ? 'bg-cyan-50 dark:bg-cyan-900/20 border-l-3 border-cyan-500' : ''
              }`}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-md flex items-center justify-center mr-2 flex-shrink-0">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Organization</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Manage organization</p>
              </div>
            </button>
          </div>
          </div>
        </div>

        {/* Sidebar Footer - Fixed */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="space-y-3">
            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
            
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {`${scanHistory.length} scan${scanHistory.length !== 1 ? 's' : ''} recorded`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay to close sidebar when clicking outside */}
      {showHistoryDropdown && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300" 
          onClick={() => setShowHistoryDropdown(false)}
        ></div>
      )}

      {/* Event Code Input Section */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter event code"
            value={eventCode}
            onChange={(e) => setEventCode(e.target.value.toUpperCase())}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Button 
            onClick={handleJoinEventMobile} 
            disabled={isJoining || !eventCode}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-3 active:scale-95 transition-transform touch-manipulation"
          >
            {isJoining ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Join
              </>
            ) : (
              'Join'
            )}
          </Button>
        </div>
      </div>

      {/* Current Status */}
      {getCurrentlyAttending().length > 0 && (
        <div className="mx-4 mt-2 space-y-2">
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <h3 className="text-green-800 dark:text-green-200 font-semibold text-xs mb-1">Currently Attending</h3>
            {getCurrentlyAttending().map(attendance => (
              <div key={attendance._id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{attendance.event.title}</p>
                  {attendance.status === 'absent' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                      Absent
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Duration: {formatDuration(attendance.checkInTime)}
                </p>
                <div className="flex gap-1">
                  <Button
                    onClick={() => handleOpenFeedbackForm(attendance.event._id, attendance.event.title)}
                    disabled={isFeedbackButtonDisabled(attendance.event._id)}
                    variant="outline"
                    size="sm"
                    className={`text-blue-700 border-blue-300 hover:bg-blue-100 dark:text-blue-300 dark:border-blue-600 dark:hover:bg-blue-900/30 h-7 text-xs px-2 ${
                      isFeedbackButtonDisabled(attendance.event._id)
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                    title={getFeedbackButtonTooltip(attendance.event._id)}
                  >
                    <MessageSquare className="w-3 h-3" />
                  </Button>
                  <Button
                    onClick={() => startLocationWatching(attendance.event._id, attendance._id)}
                    variant="outline"
                    size="sm"
                    className={`text-orange-700 border-orange-300 hover:bg-orange-100 dark:text-orange-300 dark:border-orange-600 dark:hover:bg-orange-900/30 h-7 text-xs px-2 ${
                      isTracking ? 'bg-orange-100 dark:bg-orange-900/30' : ''
                    }`}
                    title="Start location tracking for this event"
                  >
                    <MapPin className="w-3 h-3" />
                    {isTracking ? 'Tracking' : 'Track Location'}
                  </Button>
                  <Button
                    onClick={() => handleCheckOut(attendance._id)}
                    variant="outline"
                    size="sm"
                    className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-300 dark:border-green-600 dark:hover:bg-green-900/30 h-7 text-xs"
                  >
                    Check Out
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Location Status */}
          {(isTracking || currentLocationStatus) && (
            <div className={`p-3 border rounded-lg ${
              currentLocationStatus?.status === 'inside' || currentLocationStatus?.isWithinGeofence 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                : currentLocationStatus?.status === 'warning'
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
                : currentLocationStatus?.status === 'exceeded_limit'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {currentLocationStatus?.isWithinGeofence ? (
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : currentLocationStatus?.status === 'exceeded_limit' ? (
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                ) : (
                  <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
                <h3 className={`font-semibold text-xs ${
                  currentLocationStatus?.isWithinGeofence 
                    ? 'text-green-800 dark:text-green-200'
                    : currentLocationStatus?.status === 'warning'
                    ? 'text-yellow-800 dark:text-yellow-200'
                    : currentLocationStatus?.status === 'exceeded_limit'
                    ? 'text-red-800 dark:text-red-200'
                    : 'text-blue-800 dark:text-blue-200'
                }`}>
                  Location Tracking
                </h3>
              </div>
              
              {currentLocationStatus ? (
                <div className="space-y-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Status: <span className={`font-medium ${
                      currentLocationStatus.isWithinGeofence 
                        ? 'text-green-600 dark:text-green-400'
                        : currentLocationStatus.status === 'warning'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {currentLocationStatus.isWithinGeofence ? 'Inside Event Area' : 
                       currentLocationStatus.status === 'warning' ? 'Outside Warning' :
                       currentLocationStatus.status === 'exceeded_limit' ? 'Time Exceeded' :
                       'Outside Event Area'}
                    </span>
                  </p>
                  
                  {currentLocationStatus.distanceFromCenter !== undefined && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Distance: <span className="font-medium">{Math.round(currentLocationStatus.distanceFromCenter)}m from center</span>
                    </p>
                  )}
                  
                  {currentLocationStatus.currentTimeOutside > 0 && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Time outside: <span className={`font-medium ${
                        currentLocationStatus.status === 'exceeded_limit' ? 'text-red-600 dark:text-red-400' : ''
                      }`}>
                        {Math.floor(currentLocationStatus.currentTimeOutside / 60)}m {currentLocationStatus.currentTimeOutside % 60}s
                      </span>
                    </p>
                  )}
                  
                  {currentLocationStatus.lastLocationUpdate && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Last update: {new Date(currentLocationStatus.lastLocationUpdate).toLocaleTimeString('en-US', { hour12: true })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Location tracking is active
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Participant Notifications */}
      <div className="mx-4 mb-2">
        <ParticipantNotifications 
          currentLocationStatus={currentLocationStatus}
          isTracking={isTracking}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-gray-100 dark:bg-gray-800 overflow-y-auto" style={{ height: 'calc(100vh - 240px)' }}>
        {isCameraActive ? (
          <div className="relative h-full">
            <video
              ref={videoRef}
              className="w-full h-full object-cover bg-black"
              playsInline
              muted
              autoPlay
              onLoadedData={() => console.log('Video loaded data')}
              onPlay={() => console.log('Video started playing')}
              onError={(e) => console.error('Video error:', e)}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* QR Scanner Frame - Made transparent to show video behind */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-60 h-60 portrait:w-56 portrait:h-56">
                {/* Corner brackets - brighter and more visible */}
                <div className="absolute top-0 left-0 w-12 h-12 border-l-4 border-t-4 border-blue-400 drop-shadow-lg"></div>
                <div className="absolute top-0 right-0 w-12 h-12 border-r-4 border-t-4 border-blue-400 drop-shadow-lg"></div>
                <div className="absolute bottom-0 left-0 w-12 h-12 border-l-4 border-b-4 border-blue-400 drop-shadow-lg"></div>
                <div className="absolute bottom-0 right-0 w-12 h-12 border-r-4 border-b-4 border-blue-400 drop-shadow-lg"></div>

                {/* Scanning line - more visible */}
                <div className="absolute inset-x-4 top-1/2 h-1 bg-blue-400 animate-pulse drop-shadow-lg"></div>
              </div>
            </div>

            {/* Status overlay */}
            <div className="absolute top-4 left-4 right-4">
              <div className="bg-black bg-opacity-50 rounded-lg p-2">
                <p className="text-white text-sm text-center">{scanningStatus}</p>
              </div>
            </div>
            
            {/* Flash and Zoom controls */}
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
              <div className="flex flex-col items-center space-y-3">
                {/* Flash toggle button */}
                {flashSupported && (
                  <button
                    onClick={toggleFlash}
                    className={`w-12 h-12 rounded-full flex items-center justify-center touch-manipulation active:scale-95 transition-all ${
                      isFlashOn 
                        ? 'bg-yellow-500 bg-opacity-90 text-white shadow-lg shadow-yellow-500/30' 
                        : 'bg-black bg-opacity-50 text-white hover:bg-opacity-70'
                    }`}
                  >
                    <Flashlight className={`w-6 h-6 ${isFlashOn ? 'animate-pulse' : ''}`} />
                  </button>
                )}
                
                {/* Zoom controls */}
                <div className="flex items-center space-x-3 bg-black bg-opacity-50 rounded-full px-4 py-2">
                  <button className="text-blue-600 text-xl font-medium w-6 h-6 flex items-center justify-center active:text-blue-500 touch-manipulation">-</button>
                  <div className="w-24 h-2 bg-gray-300 dark:bg-gray-600 rounded-full touch-manipulation">
                    <div className="w-1/2 h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                  </div>
                  <button className="text-blue-600 text-xl font-medium w-6 h-6 flex items-center justify-center active:text-blue-500 touch-manipulation">+</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          renderMainContent()
        )}
      </div>

      {/* Bottom Navigation - Centered */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 sm:px-4 py-3">
        <div className="flex items-center justify-center space-x-6 sm:space-x-8">
          <button 
            onClick={handleQRUploadMobile}
            disabled={isUploading}
            className="flex flex-col items-center touch-manipulation active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg active:from-blue-700 active:to-purple-700">
              {isUploading ? (
                <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 text-white animate-spin" />
              ) : (
                <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              )}
            </div>
            <span className="text-blue-600 dark:text-blue-400 text-xs mt-2 font-medium">Upload QR</span>
          </button>
          
          <button
            onClick={startQRScannerMobile}
            className={`flex flex-col items-center touch-manipulation active:scale-95 transition-transform`}
          >
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg ${
              isCameraActive
                ? 'bg-gradient-to-r from-red-600 to-red-700 active:from-red-700 active:to-red-800'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 active:from-blue-700 active:to-purple-700'
            }`}>
              {isCameraActive ? <X className="w-6 h-6 sm:w-7 sm:h-7 text-white" /> : <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-white" />}
            </div>
            <span className="text-blue-600 dark:text-blue-400 text-xs mt-2 font-medium">{isCameraActive ? 'Stop Cam' : 'Camera'}</span>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Feedback Form Dialog */}
      {selectedFeedbackEvent && (
        <FeedbackFormView
          eventId={selectedFeedbackEvent.id}
          isOpen={showFeedbackForm}
          onClose={handleCloseFeedbackForm}
          onSubmit={handleFeedbackSubmit}
        />
      )}

      {/* Join Organization Modal */}
      <Dialog open={showJoinForm} onOpenChange={setShowJoinForm}>
        <DialogContent className="mx-4 sm:mx-auto sm:max-w-md max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              {userOrganization ? 'Join Another Organization' : 'Join Organization'}
            </DialogTitle>
            <DialogDescription>
              Enter the organization code provided by your organizer or admin.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {userOrganization && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  ℹ️ You can join multiple organizations. Your role in each organization will depend on the organization's settings.
                </p>
              </div>
            )}
            
            <div>
              <label htmlFor="modalOrgCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Organization Code
              </label>
              <input
                id="modalOrgCode"
                type="text"
                placeholder="Enter 6-10 character code"
                value={joinOrgCode}
                onChange={(e) => setJoinOrgCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinOrganization()}
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              {!userOrganization && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Get the organization code from your organizer or admin
                </p>
              )}
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleJoinOrganization}
                disabled={!joinOrgCode.trim() || joiningOrganization}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {joiningOrganization ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Join Organization
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowJoinForm(false);
                  setJoinOrgCode('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={showChangePasswordModal} onOpenChange={setShowChangePasswordModal}>
        <DialogContent className="mx-4 sm:mx-auto sm:max-w-md max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  placeholder="Enter current password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  placeholder="Enter new password (minimum 6 characters)"
                  className="pr-10"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  placeholder="Confirm new password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseChangePassword}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isChangingPassword}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Registration Form Modal */}
      {showRegistrationForm && registrationFormData && (
        <RegistrationFormModal
          isOpen={showRegistrationForm}
          onClose={() => {
            setShowRegistrationForm(false);
            setPendingEventCode('');
            setPendingEventTitle('');
            setPendingEventId('');
            setRegistrationFormData(null);
          }}
          eventId={pendingEventId}
          eventTitle={pendingEventTitle}
          registrationForm={registrationFormData}
          onSubmitSuccess={handleRegistrationSuccess}
          token={token}
        />
      )}
    </div>
  );
};

export default ParticipantDashboard;