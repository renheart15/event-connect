import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eventconnect.mobile',
  appName: 'Event Connect Mobile',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      showSpinner: true,
      backgroundColor: '#3B82F6'
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