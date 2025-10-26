import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eventconnect.mobile',
  appName: 'Event Connect Mobile',
  webDir: 'dist',
  server: {
    // Load from live server instead of bundled files
    // This ensures the app always gets the latest updates
    url: 'https://event-connect-jin2.onrender.com',
    cleartext: true,
    androidScheme: 'https'
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
  }
};

export default config;