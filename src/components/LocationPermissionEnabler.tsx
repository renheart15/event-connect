import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Smartphone,
  Shield
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface LocationPermissionEnablerProps {
  onPermissionChange?: (status: 'granted' | 'denied' | 'prompt') => void;
  className?: string;
  showTitle?: boolean;
  compact?: boolean;
}

const LocationPermissionEnabler: React.FC<LocationPermissionEnablerProps> = ({
  onPermissionChange,
  className = '',
  showTitle = true,
  compact = false
}) => {
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');
  const [isRequesting, setIsRequesting] = useState(false);
  const [lastLocationTest, setLastLocationTest] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
  } | null>(null);

  // Check current permission status
  const checkPermissionStatus = async () => {
    try {
      setPermissionStatus('checking');
      
      if (Capacitor.isNativePlatform()) {
        const permissions = await Geolocation.checkPermissions();
        console.log('Current location permissions:', permissions);
        
        const status = permissions.location as 'granted' | 'denied' | 'prompt';
        setPermissionStatus(status);
        onPermissionChange?.(status);
        
        return status;
      } else {
        // For web, we can't check permissions directly
        // We'll assume it's available until we try to use it
        setPermissionStatus('prompt');
        onPermissionChange?.('prompt');
        return 'prompt';
      }
    } catch (error) {
      console.error('Error checking location permissions:', error);
      setPermissionStatus('denied');
      onPermissionChange?.('denied');
      return 'denied';
    }
  };

  // Request location permission
  const requestPermission = async () => {
    if (isRequesting) return;
    
    try {
      setIsRequesting(true);
      
      if (Capacitor.isNativePlatform()) {
        const result = await Geolocation.requestPermissions();
        console.log('Permission request result:', result);
        
        const status = result.location as 'granted' | 'denied' | 'prompt';
        setPermissionStatus(status);
        onPermissionChange?.(status);
        
        if (status === 'granted') {
          toast({
            title: "Location Permission Granted",
            description: "You can now use location-based features like event check-ins and tracking.",
          });
          
          // Test location immediately
          await testLocation();
        } else {
          toast({
            title: "Location Permission Denied",
            description: "Some features may not work properly. You can enable location in your device settings.",
            variant: "destructive",
          });
        }
        
        return status;
      } else {
        // For web, try to get location which will trigger permission request
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          
          setPermissionStatus('granted');
          onPermissionChange?.('granted');
          
          setLastLocationTest({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date()
          });
          
          toast({
            title: "Location Permission Granted",
            description: "Location services are now available.",
          });
          
          return 'granted';
        } catch (error) {
          setPermissionStatus('denied');
          onPermissionChange?.('denied');
          
          toast({
            title: "Location Permission Denied",
            description: "Please allow location access in your browser to use location features.",
            variant: "destructive",
          });
          
          return 'denied';
        }
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setPermissionStatus('denied');
      onPermissionChange?.('denied');
      
      toast({
        title: "Permission Request Failed",
        description: "Failed to request location permission. Please try again.",
        variant: "destructive",
      });
      
      return 'denied';
    } finally {
      setIsRequesting(false);
    }
  };

  // Test location functionality
  const testLocation = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        });
        
        setLastLocationTest({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date()
        });
        
        toast({
          title: "Location Test Successful",
          description: `Location found with ${Math.round(position.coords.accuracy)}m accuracy.`,
        });
      } else {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
          });
        });
        
        setLastLocationTest({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date()
        });
        
        toast({
          title: "Location Test Successful",
          description: `Location found with ${Math.round(position.coords.accuracy)}m accuracy.`,
        });
      }
    } catch (error: any) {
      console.error('Location test failed:', error);
      
      let errorMessage = "Failed to get location.";
      if (error.code === 1) {
        errorMessage = "Location access denied.";
      } else if (error.code === 2) {
        errorMessage = "Location unavailable.";
      } else if (error.code === 3) {
        errorMessage = "Location request timed out.";
      }
      
      toast({
        title: "Location Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Open device settings (mobile only)
  const openSettings = async () => {
    toast({
      title: "Open Device Settings",
      description: "Please go to your device Settings > Apps > Event Connect > Permissions > Location and enable it.",
    });
  };

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'granted': return 'bg-green-100 text-green-800 border-green-200';
      case 'denied': return 'bg-red-100 text-red-800 border-red-200';
      case 'prompt': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'checking': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'granted': return <CheckCircle className="w-4 h-4" />;
      case 'denied': return <XCircle className="w-4 h-4" />;
      case 'prompt': return <AlertTriangle className="w-4 h-4" />;
      case 'checking': return <RefreshCw className="w-4 h-4 animate-spin" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'granted': return 'Location Enabled';
      case 'denied': return 'Location Denied';
      case 'prompt': return 'Permission Needed';
      case 'checking': return 'Checking...';
      default: return 'Unknown Status';
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 border rounded-lg ${className}`}>
        <MapPin className="w-5 h-5 text-gray-600" />
        <div className="flex-1">
          <p className="font-medium text-sm">Location Services</p>
          <Badge variant="outline" className={getStatusColor(permissionStatus)}>
            {getStatusIcon(permissionStatus)}
            <span className="ml-1">{getStatusText(permissionStatus)}</span>
          </Badge>
        </div>
        {permissionStatus !== 'granted' && (
          <Button 
            size="sm" 
            onClick={requestPermission}
            disabled={isRequesting}
          >
            {isRequesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Enable'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Location Permission Manager
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-gray-600" />
            <div>
              <h3 className="font-semibold">Location Services</h3>
              <p className="text-sm text-gray-600">Required for event check-ins and tracking</p>
            </div>
          </div>
          <div className="text-right">
            <Badge className={getStatusColor(permissionStatus)}>
              {getStatusIcon(permissionStatus)}
              <span className="ml-2">{getStatusText(permissionStatus)}</span>
            </Badge>
            <div className="flex items-center gap-2 mt-2">
              <Switch 
                checked={permissionStatus === 'granted'} 
                onCheckedChange={(checked) => {
                  if (checked) {
                    requestPermission();
                  }
                }}
                disabled={isRequesting || permissionStatus === 'checking'}
              />
              <span className="text-xs text-gray-500">
                {permissionStatus === 'granted' ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Status-specific alerts */}
        {permissionStatus === 'denied' && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Location access is disabled.</strong><br />
              Event check-ins and location tracking won't work properly. 
              {Capacitor.isNativePlatform() && (
                <Button 
                  variant="link" 
                  className="p-0 h-auto font-normal text-red-700 underline"
                  onClick={openSettings}
                >
                  Enable in device settings
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {permissionStatus === 'prompt' && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Location permission needed.</strong><br />
              Click "Enable Location" to allow access for event features.
            </AlertDescription>
          </Alert>
        )}

        {permissionStatus === 'granted' && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Location is enabled!</strong><br />
              You can now check in to events and use location tracking features.
            </AlertDescription>
          </Alert>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {permissionStatus !== 'granted' && (
            <Button 
              onClick={requestPermission} 
              disabled={isRequesting}
              className="flex-1"
            >
              {isRequesting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Enable Location
                </>
              )}
            </Button>
          )}

          <Button 
            variant="outline" 
            onClick={checkPermissionStatus}
            size={permissionStatus !== 'granted' ? 'default' : 'default'}
            className={permissionStatus !== 'granted' ? '' : 'flex-1'}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Status
          </Button>

          {permissionStatus === 'granted' && (
            <Button 
              variant="outline" 
              onClick={testLocation}
              className="flex-1"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Test Location
            </Button>
          )}
        </div>

        {/* Last location test result */}
        {lastLocationTest && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Last Location Test</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <span className="font-medium">Coordinates:</span><br />
                {lastLocationTest.latitude.toFixed(6)}, {lastLocationTest.longitude.toFixed(6)}
              </div>
              <div>
                <span className="font-medium">Accuracy:</span><br />
                {Math.round(lastLocationTest.accuracy)}m
              </div>
              <div className="col-span-2">
                <span className="font-medium">Time:</span><br />
                {lastLocationTest.timestamp.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Platform info */}
        <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t">
          <Smartphone className="w-3 h-3" />
          {Capacitor.isNativePlatform() ? 'Native Mobile App' : 'Web Browser'}
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationPermissionEnabler;