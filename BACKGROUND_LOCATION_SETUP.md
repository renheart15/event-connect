# Background Location Tracking Setup Guide

## Problem
Currently, the Event Connect mobile app only tracks location when the app is in the foreground (active/visible). When users switch to another app or the screen turns off, location tracking stops, making the geofence monitoring unreliable.

## Solution
Implement background location tracking using a dedicated Capacitor plugin that keeps location updates running even when the app is in the background.

## Current Status
✅ **Android Permissions Added** - Background location permissions have been added to AndroidManifest.xml
⏳ **Plugin Installation Required** - Background geolocation plugin needs to be installed
⏳ **Code Updates Required** - Location tracking code needs to be updated

---

## Installation Steps

### Step 1: Install Background Geolocation Plugin

We recommend using the community plugin (free and open source):

```bash
npm install @capacitor-community/background-geolocation
npx cap sync
```

**Alternative:** Commercial plugin with more features (paid):
```bash
npm install @transistorsoft/capacitor-background-geolocation
npm install @transistorsoft/capacitor-background-fetch
npx cap sync
```

### Step 2: iOS Configuration (if deploying to iOS)

Add background modes to `ios/App/App/Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>fetch</string>
</array>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Event Connect needs your location to track attendance at events, even when the app is in the background.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Event Connect needs your location to track attendance at events.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>Event Connect needs your location to track attendance at events, even when the app is in the background.</string>
```

### Step 3: Update Capacitor Config

Update `capacitor.config.ts` to add background geolocation configuration:

```typescript
const config: CapacitorConfig = {
  // ... existing config ...
  plugins: {
    // ... existing plugins ...
    BackgroundGeolocation: {
      // Community plugin config
      desiredAccuracy: 'HIGH',
      stationaryRadius: 25,
      distanceFilter: 50,
      notificationTitle: 'Event Location Tracking',
      notificationText: 'Tracking your location for event attendance',
      debug: false, // Set to true during development
      stopOnTerminate: false, // Keep tracking even if app is killed
      startOnBoot: true // Start tracking after device reboot
    }
  }
};
```

---

## Code Changes Required

### Update `src/pages/ParticipantDashboard.tsx`

Replace the current `watchPosition` implementation with background geolocation:

#### 1. Import the Plugin

```typescript
import BackgroundGeolocation from '@capacitor-community/background-geolocation';
```

#### 2. Request Background Location Permission

Add a function to request background location permission:

```typescript
const requestBackgroundLocationPermission = async () => {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    // First request foreground permission
    const foregroundPermission = await Geolocation.requestPermissions();

    if (foregroundPermission.location !== 'granted') {
      toast({
        title: "Location Permission Required",
        description: "Please enable location access to track attendance.",
        variant: "destructive",
      });
      return false;
    }

    // Then request background permission (Android 10+)
    if (Capacitor.getPlatform() === 'android') {
      // Show explanation dialog first
      toast({
        title: "Background Location Needed",
        description: "To track your location even when the app is in the background, we need additional permission. Please select 'Allow all the time' in the next dialog.",
        duration: 8000,
      });

      // Request background location permission
      // Note: On Android 10+, this requires a separate permission request
      const backgroundPermission = await Geolocation.requestPermissions();

      return backgroundPermission.location === 'granted';
    }

    return true;
  } catch (error) {
    console.error('Error requesting background location permission:', error);
    return false;
  }
};
```

#### 3. Update `startLocationWatching` Function

Replace the existing implementation with background geolocation:

```typescript
const startLocationWatching = async (eventId: string) => {
  try {
    // Initialize location tracking on server
    await startLocationTracking(eventId, user._id, attendanceLogId);

    // Request background location permission
    const hasBackgroundPermission = await requestBackgroundLocationPermission();

    if (!hasBackgroundPermission) {
      toast({
        title: "Permission Denied",
        description: "Background location permission is required for event attendance tracking.",
        variant: "destructive",
      });
      return;
    }

    // Helper function to get battery level
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

    // Configure and start background geolocation
    await BackgroundGeolocation.addWatcher(
      {
        // Request location updates
        backgroundMessage: "Event Connect is tracking your location for event attendance.",
        backgroundTitle: "Location Tracking Active",
        requestPermissions: true,
        stale: false,
        distanceFilter: 50, // Update every 50 meters
      },
      async function callback(location, error) {
        if (error) {
          if (error.code === "NOT_AUTHORIZED") {
            toast({
              title: "Location Permission Denied",
              description: "Please enable location access in your device settings.",
              variant: "destructive",
            });
          }
          return console.error('Background location error:', error);
        }

        if (location) {
          try {
            const batteryLevel = await getBatteryLevel();

            console.log('📍 [BACKGROUND] Location update:', {
              lat: location.latitude,
              lng: location.longitude,
              accuracy: location.accuracy,
              battery: batteryLevel,
              timestamp: new Date().toISOString()
            });

            // Send location update to server
            await updateLocation(
              eventId,
              user._id,
              location.latitude,
              location.longitude,
              location.accuracy,
              batteryLevel
            );

            setLastLocationUpdateTime(new Date());
          } catch (error) {
            console.error('Failed to send background location update:', error);
          }
        }
      }
    );

    toast({
      title: "Background Tracking Started",
      description: "Location will be tracked even when the app is in the background.",
    });

    setLocationWatchId('background-watcher'); // Use string identifier
    setLocationHeartbeatInterval(null); // No need for heartbeat with background tracking

  } catch (error) {
    console.error('Error starting background location tracking:', error);
    toast({
      title: "Tracking Failed",
      description: "Unable to start background location tracking.",
      variant: "destructive",
    });
  }
};
```

#### 4. Update `stopLocationWatching` Function

```typescript
const stopLocationWatching = async (eventId: string) => {
  try {
    // Stop location tracking on server
    await stopLocationTracking(eventId, user._id);

    // Remove all background geolocation watchers
    await BackgroundGeolocation.removeWatcher({
      id: 'background-watcher'
    });

    setLocationWatchId(null);

    toast({
      title: "Tracking Stopped",
      description: "Background location tracking has been disabled.",
    });
  } catch (error) {
    console.error('Error stopping background location tracking:', error);
  }
};
```

---

## Testing Guide

### Test Scenarios

1. **Foreground Tracking**
   - Open app and start location tracking
   - Verify location updates are being sent
   - Check that updates appear in the event monitor

2. **Background Tracking**
   - Start location tracking
   - Press home button to background the app
   - Wait 2-3 minutes
   - Check event monitor to verify updates continued
   - Check console logs when you return to app

3. **Screen Off Tracking**
   - Start location tracking
   - Turn off screen and wait 5 minutes
   - Turn on screen and return to app
   - Verify updates continued during screen-off period

4. **App Killed Tracking** (Most Important!)
   - Start location tracking
   - Force-close/kill the app
   - Wait 5-10 minutes
   - Reopen app
   - Check if location updates continued (this depends on OS and plugin)

5. **Movement Test**
   - Start tracking while inside geofence
   - Walk outside the geofence boundary
   - Verify "Left premises" alert appears
   - Walk back inside
   - Verify "Returned to premises" alert appears

### Expected Behavior

✅ Location updates every ~50 meters or ~2 minutes (whichever comes first)
✅ Updates continue when app is in background
✅ Updates continue when screen is off
✅ Persistent notification shows "Location Tracking Active" (Android)
✅ Battery drain is reasonable (~2-5% per hour depending on movement)

### Troubleshooting

**Updates stop when app is backgrounded:**
- Check that background location permission is granted (Android: "Allow all the time")
- Verify background modes are enabled in iOS Info.plist
- Check that battery optimization is disabled for the app

**High battery drain:**
- Increase `distanceFilter` from 50m to 100m or 200m
- Reduce `desiredAccuracy` from HIGH to MEDIUM
- Consider using `stationaryRadius` to pause tracking when stationary

**Permission denied errors:**
- Make sure AndroidManifest.xml has ACCESS_BACKGROUND_LOCATION permission
- On iOS, ensure Info.plist has the required usage descriptions
- On Android 10+, background permission requires a separate request

---

## Important Notes

### Android Considerations

- **Android 10+ (API 29+)**: Requires separate background location permission
- **Android 11+ (API 30+)**: User must manually select "Allow all the time" in settings
- **Android 12+ (API 31+)**: Requires `FOREGROUND_SERVICE_LOCATION` permission
- **Battery Optimization**: Users may need to disable battery optimization for the app

### iOS Considerations

- **Always Authorization**: Required for background location
- **Background Modes**: Must be enabled in Xcode project
- **App Store Review**: Apple requires clear explanation of why background location is needed

### Battery Impact

Background location tracking does consume battery. To minimize impact:

1. Use appropriate `distanceFilter` (50-100m is good for geofencing)
2. Use `stationaryRadius` to pause tracking when user isn't moving
3. Set reasonable accuracy (`MEDIUM` instead of `HIGH` if possible)
4. Consider stopping tracking when event ends

### Privacy & Compliance

- ⚠️ **User Consent**: Always get explicit user consent before enabling background tracking
- 📝 **Privacy Policy**: Update your privacy policy to disclose background location tracking
- 🔒 **Data Security**: Ensure location data is transmitted securely (HTTPS)
- 🗑️ **Data Retention**: Delete location data when no longer needed

---

## Current Status Summary

### ✅ Completed
- Android manifest permissions added
- Documentation created
- Permission request flow designed

### ⏳ TODO
1. Install @capacitor-community/background-geolocation plugin
2. Update ParticipantDashboard.tsx with new implementation
3. Test on physical Android device (background tracking doesn't work in emulators)
4. Configure iOS background modes (if deploying to iOS)
5. Test all scenarios listed above
6. Update privacy policy
7. Add user consent dialog before enabling background tracking

---

## Commit This Change

```bash
git add android/app/src/main/AndroidManifest.xml BACKGROUND_LOCATION_SETUP.md
git commit -m "Add background location permissions and setup documentation

- Added ACCESS_BACKGROUND_LOCATION permission for Android 10+
- Added FOREGROUND_SERVICE permissions for background tracking
- Added WAKE_LOCK to keep location updates running
- Created comprehensive setup guide for background geolocation

Next steps:
- Install @capacitor-community/background-geolocation
- Update ParticipantDashboard.tsx implementation
- Test on physical device

🤖 Generated with Claude Code"
```

---

## Additional Resources

- [@capacitor-community/background-geolocation](https://github.com/capacitor-community/background-geolocation)
- [Capacitor Geolocation Docs](https://capacitorjs.com/docs/apis/geolocation)
- [Android Background Location Best Practices](https://developer.android.com/training/location/background)
- [iOS Background Location Guidelines](https://developer.apple.com/documentation/corelocation/requesting_authorization_for_location_services)
