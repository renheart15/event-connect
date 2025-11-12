import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { QrCode, MapPin, Clock, Users, Download, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const Index = () => {
  const [userType, setUserType] = useState<'participant' | 'organizer' | null>(null);
  const [isNativeMobile, setIsNativeMobile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if running as native mobile app
    const isNative = Capacitor.isNativePlatform();
    setIsNativeMobile(isNative);

    // If mobile app, redirect directly to participant login
    if (isNative) {
      navigate('/login?role=participant');
    }
  }, [navigate]);

  // For participants on web browser, show download page directly
  if (!isNativeMobile && userType === 'participant') {
    return (
      <div className="[&]:!bg-gradient-to-br [&]:!from-blue-50 [&]:!to-indigo-100 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100" style={{colorScheme: 'light'}} data-theme="light">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-2">
                <QrCode className="w-8 h-8 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">EventConnect</h1>
              </div>
              <Button variant="outline" className="bg-white text-gray-900 border-gray-300 hover:bg-gray-50" onClick={() => setUserType(null)}>
                Back
              </Button>
            </div>
          </div>
        </header>

        {/* Download Section */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Smartphone className="w-24 h-24 text-blue-600 mx-auto mb-6" />
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Download EventConnect
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">
              EventConnect for participants is available as a mobile app. Download the app to join events, check in with QR codes, and track your attendance.
            </p>

            <Card className="max-w-md mx-auto bg-white border-gray-200">
              <CardContent className="pt-6 space-y-4">
                <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                  <Download className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Android App</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Download and install the EventConnect app on your Android device
                  </p>
                  <a
                    href="https://github.com/renheart15/event-connect/releases/download/v1.0.1/event-connect.apk"
                    download="EventConnect.apk"
                    className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-base font-medium transition-colors w-full"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download for Android
                  </a>
                  <p className="text-xs text-gray-500 mt-3">
                    You may need to enable "Install from Unknown Sources" in your device settings
                  </p>
                </div>

                <div className="text-sm text-gray-600 space-y-2 text-left">
                  <p className="font-semibold text-gray-900">After downloading:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Open the downloaded APK file</li>
                    <li>Allow installation from unknown sources if prompted</li>
                    <li>Install the app</li>
                    <li>Open EventConnect and log in</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            <div className="mt-8">
              <p className="text-sm text-gray-600 mb-4">
                Are you an event organizer?
              </p>
              <Button
                variant="outline"
                className="bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                onClick={() => setUserType('organizer')}
              >
                Switch to Organizer
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="[&]:!bg-gradient-to-br [&]:!from-blue-50 [&]:!to-indigo-100 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100" style={{colorScheme: 'light'}} data-theme="light">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <QrCode className="w-8 h-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">EventConnect</h1>
            </div>
            <div className="flex space-x-4">
              <Link to="/login">
                <Button variant="outline" className="bg-white text-gray-900 border-gray-300 hover:bg-gray-50">Login</Button>
              </Link>
              <Link to="/register">
                <Button className="bg-blue-600 text-white hover:bg-blue-700">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
            Intelligent Attendance Tracking
          </h2>
          <p className="text-base text-gray-600 mb-6 max-w-3xl mx-auto">
            Ensure accurate, real-time attendance tracking throughout your events with GPS verification, 
            automated time tracking, and early leave detection.
          </p>
          
          <div className="mb-8">
            <Card className="max-w-md mx-auto bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900">Choose Your Role</CardTitle>
                <CardDescription className="text-sm text-gray-600">Select how you'll be using EventConnect</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Button
                    variant={userType === 'organizer' ? 'default' : 'outline'}
                    className={cn(
                      "w-full h-auto p-4 justify-start text-left",
                      userType === 'organizer'
                        ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                        : "hover:bg-gray-50 bg-white border-gray-300 text-gray-900"
                    )}
                    onClick={() => setUserType('organizer')}
                  >
                    <div>
                      <div className={cn(
                        "font-medium text-sm",
                        userType === 'organizer' ? "text-white" : "text-gray-900"
                      )}>Event Organizer</div>
                      <div className={cn(
                        "text-xs mt-1",
                        userType === 'organizer' ? "text-blue-100" : "text-gray-500"
                      )}>
                        Create and manage events, track attendance
                      </div>
                    </div>
                  </Button>
                  
                  <Button
                    variant={userType === 'participant' ? 'default' : 'outline'}
                    className={cn(
                      "w-full h-auto p-4 justify-start text-left",
                      userType === 'participant'
                        ? "bg-gray-900 hover:bg-gray-800 text-white"
                        : "hover:bg-gray-50 bg-white border-gray-300 text-gray-900"
                    )}
                    onClick={() => setUserType('participant')}
                  >
                    <div>
                      <div className={cn(
                        "font-medium text-sm",
                        userType === 'participant' ? "text-white" : "text-gray-900"
                      )}>Participant</div>
                      <div className={cn(
                        "text-xs mt-1",
                        userType === 'participant' ? "text-gray-100" : "text-gray-500"
                      )}>
                        Join events, check in/out, view history
                      </div>
                    </div>
                  </Button>
                </div>

                {userType && (
                  <div className="space-y-3 pt-4 border-t animate-in fade-in-50 duration-300">
                    <Link to={`/login?role=${userType}`} className="block">
                      <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">Login</Button>
                    </Link>
                    <Link to={`/register?role=${userType}`} className="block">
                      <Button variant="outline" className="w-full bg-white text-gray-900 border-gray-300 hover:bg-gray-50">Create Account</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Why EventConnect?
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center bg-white border-gray-200">
              <CardContent className="pt-6">
                <QrCode className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h4 className="text-lg font-semibold mb-2 text-gray-900">QR Code Check-in</h4>
                <p className="text-sm text-gray-600">Quick and easy check-in process with unique event QR codes</p>
              </CardContent>
            </Card>
            
            <Card className="text-center bg-white border-gray-200">
              <CardContent className="pt-6">
                <MapPin className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h4 className="text-lg font-semibold mb-2 text-gray-900">GPS Verification</h4>
                <p className="text-sm text-gray-600">Ensure attendees are physically present with geofencing technology</p>
              </CardContent>
            </Card>
            
            <Card className="text-center bg-white border-gray-200">
              <CardContent className="pt-6">
                <Clock className="w-12 h-12 text-orange-600 mx-auto mb-4" />
                <h4 className="text-lg font-semibold mb-2 text-gray-900">Real-time Tracking</h4>
                <p className="text-sm text-gray-600">Monitor attendance duration and detect early departures</p>
              </CardContent>
            </Card>
            
            <Card className="text-center bg-white border-gray-200">
              <CardContent className="pt-6">
                <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                <h4 className="text-lg font-semibold mb-2 text-gray-900">Live Dashboard</h4>
                <p className="text-sm text-gray-600">Real-time insights and notifications for event organizers</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;