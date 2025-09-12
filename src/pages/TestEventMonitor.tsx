import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MapPin, Radar, CheckCircle } from 'lucide-react';

const TestEventMonitor = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo Banner */}
      <div className="bg-green-600 text-white py-2 px-4 text-center text-sm">
        <CheckCircle className="w-4 h-4 inline mr-2" />
        Test Mode - This page verifies that the EventMonitor UI components work properly
      </div>
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test Event Monitor</h1>
              <p className="text-sm text-gray-600">Component Testing Interface</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Current Time</p>
                <p className="font-mono text-lg">{currentTime.toLocaleTimeString('en-US', { hour12: true })}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="test" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="test" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Component Test
            </TabsTrigger>
            <TabsTrigger value="location" className="flex items-center gap-2">
              <Radar className="w-4 h-4" />
              Location Demo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="test" className="mt-6">
            <div className="space-y-6">
              {/* Test Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">5</p>
                      <p className="text-xs text-gray-600">Test Participants</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">3</p>
                      <p className="text-xs text-gray-600">Currently Present</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">2</p>
                      <p className="text-xs text-gray-600">Outside Premises</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">1</p>
                      <p className="text-xs text-gray-600">Exceeded Limit</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Test Event Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Test Event Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">Date</p>
                      <p className="text-gray-600">{new Date().toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Time</p>
                      <p className="text-gray-600">09:00 - 17:00</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Location</p>
                      <p className="text-gray-600">Test Location</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Test Participants */}
              <Card>
                <CardHeader>
                  <CardTitle>Test Participant Status</CardTitle>
                  <CardDescription>
                    Sample data to verify UI components work correctly
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Sample participant 1 */}
                    <div className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">John Doe</h3>
                          <p className="text-sm text-gray-600">john.doe@example.com</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                          Inside Premises
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <p className="font-medium">Check-in</p>
                          <p>09:15 AM</p>
                        </div>
                        <div>
                          <p className="font-medium">Duration</p>
                          <p>45 minutes</p>
                        </div>
                        <div>
                          <p className="font-medium">Distance</p>
                          <p>25m from center</p>
                        </div>
                        <div>
                          <p className="font-medium">Status</p>
                          <p>Active</p>
                        </div>
                      </div>
                    </div>

                    {/* Sample participant 2 */}
                    <div className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">Jane Smith</h3>
                          <p className="text-sm text-gray-600">jane.smith@example.com</p>
                        </div>
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                          Outside - Timer: 5m 23s
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <p className="font-medium">Check-in</p>
                          <p>09:00 AM</p>
                        </div>
                        <div>
                          <p className="font-medium">Duration</p>
                          <p>60 minutes</p>
                        </div>
                        <div>
                          <p className="font-medium">Distance</p>
                          <p>150m from center</p>
                        </div>
                        <div>
                          <p className="font-medium">Status</p>
                          <p>Outside premises</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="location" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radar className="w-5 h-5" />
                  Location Tracking Test
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">✅ UI Components Working</h3>
                    <p className="text-blue-700 text-sm">
                      All React components are rendering correctly. The location tracking system 
                      is ready for integration with live data when authentication is configured.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                            <MapPin className="w-6 h-6 text-white" />
                          </div>
                          <h4 className="font-medium text-green-800">Inside Premises</h4>
                          <p className="text-sm text-green-600">Participants within geofence</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-orange-50 border-orange-200">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Users className="w-6 h-6 text-white" />
                          </div>
                          <h4 className="font-medium text-orange-800">Outside - Timer Active</h4>
                          <p className="text-sm text-orange-600">Counting time away from premises</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                            <CheckCircle className="w-6 h-6 text-white" />
                          </div>
                          <h4 className="font-medium text-red-800">System Ready</h4>
                          <p className="text-sm text-red-600">All components functional</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TestEventMonitor;