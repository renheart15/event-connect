import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, Monitor, AlertTriangle, ExternalLink } from 'lucide-react';

interface MobileAccessGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
  showWarning?: boolean; // If true, shows warning instead of blocking
}

/**
 * MobileAccessGuard - Controls access to routes based on platform (mobile/web)
 *
 * Use this to restrict organizer features to web-only, while allowing
 * participant features on mobile app.
 */
const MobileAccessGuard: React.FC<MobileAccessGuardProps> = ({
  children,
  allowedRoles = ['participant'],
  redirectTo = '/participant-dashboard',
  showWarning = false
}) => {
  const navigate = useNavigate();
  const [shouldBlock, setShouldBlock] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Check if running on native mobile platform
    const isNativePlatform = Capacitor.isNativePlatform();

    // Get user role from localStorage
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserRole(user.role);

        // Block access if:
        // 1. Running on mobile (native platform)
        // 2. User role is not in allowed roles
        if (isNativePlatform && !allowedRoles.includes(user.role)) {
          setShouldBlock(true);
        }
      }
    } catch (error) {
      console.error('Error reading user data:', error);
    }
  }, [allowedRoles]);

  // If blocking access, show appropriate message
  if (shouldBlock) {
    if (showWarning) {
      // Show warning but still allow access
      return (
        <div className="space-y-4">
          <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <strong>Mobile App Notice:</strong> This feature is optimized for desktop/web browsers.
              Some functionality may be limited on mobile devices.
            </AlertDescription>
          </Alert>
          {children}
        </div>
      );
    }

    // Block access completely and show helpful message
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Monitor className="w-16 h-16 text-blue-600" />
                <Smartphone className="w-8 h-8 text-gray-400 absolute -bottom-2 -right-2" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl">
              Organizer Dashboard - Web Only
            </CardTitle>
            <CardDescription className="text-center">
              Organizer features are designed for desktop/web browsers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Mobile App Limitation:</strong> The mobile app is optimized for participants to check in,
                receive notifications, and track their event attendance.
              </AlertDescription>
            </Alert>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                To Access Organizer Features:
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-6 list-disc">
                <li>Open a web browser on your computer or tablet</li>
                <li>Navigate to the Event Connect website</li>
                <li>Log in with your organizer account</li>
                <li>Access full dashboard, event creation, and monitoring features</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => {
                  // Copy web URL to clipboard
                  const webUrl = window.location.origin;
                  navigator.clipboard.writeText(webUrl);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Copy Web URL
              </Button>

              <Button
                onClick={() => navigate(redirectTo)}
                variant="outline"
                className="w-full"
              >
                Go to Participant Dashboard
              </Button>

              <Button
                onClick={() => {
                  localStorage.removeItem('user');
                  localStorage.removeItem('token');
                  navigate('/login');
                }}
                variant="ghost"
                className="w-full"
              >
                Logout
              </Button>
            </div>

            <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-4 border-t">
              <p>Tip: Bookmark the web URL for easy access from your computer</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has access, render children
  return <>{children}</>;
};

export default MobileAccessGuard;
