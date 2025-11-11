import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eventconnect.mobile',
  appName: 'Event Connect Mobile',
  webDir: 'dist',
  server: {
    // Use bundled files for instant loading
    // Backend API is accessed separately via axios
    androidScheme: 'https',
    hostname: 'event-connect.site'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      showSpinner: true,
      backgroundColor: '#4C1D95',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      iosSpinnerStyle: 'small',
      spinnerColor: '#FFFFFF'
    },
    Camera: {
      permissions: ['camera']
    },
    Geolocation: {
      permissions: ['location', 'coarseLocation']
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav"
    }
  },
  // App Links (Android) and Universal Links (iOS) configuration
  android: {
    allowMixedContent: true
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;