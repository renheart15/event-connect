
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { QrCode, MapPin, Clock, Users } from 'lucide-react';

const Index = () => {
  const [userType, setUserType] = useState<'participant' | 'organizer' | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <QrCode className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">EventConnect</h1>
            </div>
            <div className="flex space-x-4">
              <Link to="/login">
                <Button variant="outline">Login</Button>
              </Link>
              <Link to="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-5xl font-extrabold text-gray-900 mb-6">
            Intelligent Attendance Tracking
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Ensure accurate, real-time attendance tracking throughout your events with GPS verification, 
            automated time tracking, and early leave detection.
          </p>
          
          <div className="mb-12">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle>Choose Your Role</CardTitle>
                <CardDescription>Select how you'll be using EventConnect</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Button
                    variant={userType === 'organizer' ? 'default' : 'outline'}
                    className={cn(
                      "w-full h-auto p-4 justify-start text-left",
                      userType === 'organizer' 
                        ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600" 
                        : "hover:bg-gray-50"
                    )}
                    onClick={() => setUserType('organizer')}
                  >
                    <div>
                      <div className="font-medium text-base">Event Organizer</div>
                      <div className={cn(
                        "text-sm mt-1", 
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
                        : "hover:bg-gray-50"
                    )}
                    onClick={() => setUserType('participant')}
                  >
                    <div>
                      <div className="font-medium text-base">Participant</div>
                      <div className={cn(
                        "text-sm mt-1", 
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
                      <Button className="w-full">Login</Button>
                    </Link>
                    <Link to={`/register?role=${userType}`} className="block">
                      <Button variant="outline" className="w-full">Create Account</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why EventConnect?
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center">
              <CardContent className="pt-6">
                <QrCode className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h4 className="text-xl font-semibold mb-2">QR Code Check-in</h4>
                <p className="text-gray-600">Quick and easy check-in process with unique event QR codes</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <MapPin className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h4 className="text-xl font-semibold mb-2">GPS Verification</h4>
                <p className="text-gray-600">Ensure attendees are physically present with geofencing technology</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <Clock className="w-12 h-12 text-orange-600 mx-auto mb-4" />
                <h4 className="text-xl font-semibold mb-2">Real-time Tracking</h4>
                <p className="text-gray-600">Monitor attendance duration and detect early departures</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                <h4 className="text-xl font-semibold mb-2">Live Dashboard</h4>
                <p className="text-gray-600">Real-time insights and notifications for event organizers</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
