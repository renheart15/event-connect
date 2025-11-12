/**
 * Mobile App Detection Utility
 *
 * Detects if the user is using the native mobile app and stores this information
 * to track mobile app usage across the application.
 */

const MOBILE_APP_KEY = 'isMobileApp';
const MOBILE_APP_TIMESTAMP_KEY = 'mobileAppDetectedAt';

/**
 * Check if the app is running as a native mobile application
 * @returns boolean indicating if running on native platform
 */
export const isMobileApp = async (): Promise<boolean> => {
  try {
    // Dynamically import Capacitor to avoid issues on web
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch (error) {
    // Capacitor not available, running on web
    return false;
  }
};

/**
 * Initialize mobile app detection and store the result
 * Should be called on app initialization
 */
export const initializeMobileAppDetection = async (): Promise<void> => {
  try {
    const isNative = await isMobileApp();

    if (isNative) {
      // Store that user has mobile app
      localStorage.setItem(MOBILE_APP_KEY, 'true');
      localStorage.setItem(MOBILE_APP_TIMESTAMP_KEY, new Date().toISOString());
      console.log('Mobile app detected and stored');
    }
  } catch (error) {
    console.error('Error detecting mobile app:', error);
  }
};

/**
 * Check if the user has ever used the mobile app
 * @returns boolean indicating if user has mobile app
 */
export const hasMobileApp = (): boolean => {
  return localStorage.getItem(MOBILE_APP_KEY) === 'true';
};

/**
 * Get the timestamp when mobile app was first detected
 * @returns ISO string timestamp or null
 */
export const getMobileAppDetectionTimestamp = (): string | null => {
  return localStorage.getItem(MOBILE_APP_TIMESTAMP_KEY);
};

/**
 * Clear mobile app detection data
 * Useful for testing or if user uninstalls the app
 */
export const clearMobileAppDetection = (): void => {
  localStorage.removeItem(MOBILE_APP_KEY);
  localStorage.removeItem(MOBILE_APP_TIMESTAMP_KEY);
};
