import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, Monitor, AlertTriangle, Download } from 'lucide-react';

interface WebAccessGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
  showWarning?: boolean; // If true, shows warning instead of blocking
}

/**
 * WebAccessGuard - Controls access to routes based on platform (web/mobile)
 *
 * Use this to restrict participant features to mobile-only, while allowing
 * organizer features on web.
 */
const WebAccessGuard: React.FC<WebAccessGuardProps> = ({
  children,
  allowedRoles = ['organizer'],
  redirectTo = '/organizer-dashboard',
  showWarning = false
}) => {
  const navigate = useNavigate();
  const [shouldBlock, setShouldBlock] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Check if running on web (not native platform)
    const isWebPlatform = !Capacitor.isNativePlatform();

    // Get user role from localStorage
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserRole(user.role);

        // Block access if:
        // 1. Running on web (not native platform)
        // 2. User role is not in allowed roles
        if (isWebPlatform && !allowedRoles.includes(user.role)) {
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
              <strong>Web Browser Notice:</strong> This feature is optimized for the mobile app.
              Some functionality may be limited in web browsers.
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
                <Smartphone className="w-16 h-16 text-purple-600" />
                <Monitor className="w-8 h-8 text-gray-400 absolute -bottom-2 -right-2" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl">
              Participant Dashboard - Mobile Only
            </CardTitle>
            <CardDescription className="text-center">
              Participant features are designed for the mobile app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Web Browser Limitation:</strong> The participant dashboard is optimized for mobile devices
                with features like QR scanning, location tracking, and push notifications.
              </AlertDescription>
            </Alert>

            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                To Access Participant Features:
              </h3>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-6 list-disc">
                <li>Download the Event Connect mobile app on your phone</li>
                <li>Log in with your participant account</li>
                <li>Scan QR codes, check in to events, and receive notifications</li>
                <li>Track your location and attendance in real-time</li>
              </ul>
            </div>

            <div className="space-y-2">
              <a
                href="https://github.com/renheart15/event-connect/releases/download/v1.0.1/event-connect.apk"
                download="EventConnect.apk"
                className="block"
              >
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Mobile App
                </Button>
              </a>

              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full"
              >
                Back to Home
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
              <p>Tip: Use the mobile app for the best participant experience</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has access, render children
  return <>{children}</>;
};

export default WebAccessGuard;
