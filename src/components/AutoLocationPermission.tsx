import { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { toast } from '@/hooks/use-toast';

interface AutoLocationPermissionProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

const AutoLocationPermission: React.FC<AutoLocationPermissionProps> = ({
  onPermissionGranted,
  onPermissionDenied,
}) => {
  const [hasRequested, setHasRequested] = useState(false);

  useEffect(() => {
    const requestLocationPermission = async () => {
      if (hasRequested) return;
      
      setHasRequested(true);
      
      try {
        if (Capacitor.isNativePlatform()) {
          // Check current permission status
          const permissions = await Geolocation.checkPermissions();
          
          if (permissions.location === 'granted') {
            onPermissionGranted?.();
            return;
          }
          
          if (permissions.location === 'denied') {
            toast({
              title: "Location Permission Required",
              description: "Please enable location access in your device settings for event features to work properly.",
              variant: "destructive",
            });
            onPermissionDenied?.();
            return;
          }
          
          // Request permission if not yet granted
          const result = await Geolocation.requestPermissions();
          
          if (result.location === 'granted') {
            toast({
              title: "Location Access Enabled",
              description: "You can now use location-based features like check-ins and tracking.",
            });
            onPermissionGranted?.();
          } else {
            toast({
              title: "Location Permission Required", 
              description: "Some features may not work without location access. You can enable it later in settings.",
              variant: "destructive",
            });
            onPermissionDenied?.();
          }
        } else {
          // For web, try to get location to trigger permission request
          navigator.geolocation.getCurrentPosition(
            (position) => {
              toast({
                title: "Location Access Enabled",
                description: "Location services are now available.",
              });
              onPermissionGranted?.();
            },
            (error) => {
              if (error.code === 1) {
                toast({
                  title: "Location Permission Required",
                  description: "Please allow location access in your browser for event features.",
                  variant: "destructive",
                });
              }
              onPermissionDenied?.();
            },
            { timeout: 5000 }
          );
        }
      } catch (error) {
        console.error('Auto location permission request failed:', error);
        onPermissionDenied?.();
      }
    };

    // Delay request to allow app to load
    const timer = setTimeout(requestLocationPermission, 2000);
    return () => clearTimeout(timer);
  }, [hasRequested, onPermissionGranted, onPermissionDenied]);

  return null; // This component doesn't render anything
};

export default AutoLocationPermission;