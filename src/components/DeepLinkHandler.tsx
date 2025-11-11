import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Deep Link Handler Component
 *
 * Handles incoming deep links from:
 * - Custom URL scheme (eventconnect://)
 * - Universal Links/App Links (https://event-connect.site)
 *
 * Examples:
 * - eventconnect://invitation/ABC123
 * - https://event-connect.site/invitation/ABC123
 */
const DeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Dynamically import Capacitor modules only on native platforms
    const initializeDeepLinking = async () => {
      try {
        // Check if running on Capacitor
        const { Capacitor } = await import('@capacitor/core');

        // Only run on native platforms
        if (!Capacitor.isNativePlatform()) {
          return;
        }

        const { App: CapacitorApp } = await import('@capacitor/app');

        const handleDeepLink = (url: string) => {
          console.log('Deep link received:', url);

          try {
            // Parse the URL
            let path = '';

            if (url.startsWith('eventconnect://')) {
              // Custom URL scheme: eventconnect://invitation/ABC123
              path = url.replace('eventconnect:/', '');
            } else if (url.startsWith('https://')) {
              // Universal Link: https://event-connect.site/invitation/ABC123
              const urlObj = new URL(url);
              path = urlObj.pathname;
            }

            // Navigate to the path
            if (path && path.startsWith('/invitation/')) {
              console.log('Navigating to invitation:', path);
              navigate(path);
            } else if (path) {
              console.log('Navigating to path:', path);
              navigate(path);
            }
          } catch (error) {
            console.error('Error handling deep link:', error);
          }
        };

        // Handle app opened from deep link
        CapacitorApp.addListener('appUrlOpen', (event) => {
          handleDeepLink(event.url);
        });

        // Check if app was opened with a deep link (launch URL)
        CapacitorApp.getLaunchUrl().then((result) => {
          if (result && result.url) {
            console.log('App opened with launch URL:', result.url);
            handleDeepLink(result.url);
          }
        });

        // Cleanup
        return () => {
          CapacitorApp.removeAllListeners();
        };
      } catch (error) {
        // Capacitor not available (web build), silently ignore
        console.log('Deep linking not available on web platform');
      }
    };

    initializeDeepLinking();
  }, [navigate]);

  return null;
};

export default DeepLinkHandler;
