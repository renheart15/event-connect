import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  MapPin,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Mail,
  QrCode,
  Smartphone,
  Download
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: {
    address: string;
    coordinates?: [number, number];
  };
  organizer: {
    name: string;
    email: string;
  };
}

interface Invitation {
  _id: string;
  invitationCode: string;
  participantName: string;
  participantEmail: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  event: Event;
  expiresAt: string;
  hasAttended?: boolean;
}

const InvitationView = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [requiresSignup, setRequiresSignup] = useState(false);
  const [showMobileBanner, setShowMobileBanner] = useState(false);

  useEffect(() => {
    if (!code) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    // Check if on mobile browser (not native app)
    const isNativeApp = Capacitor.isNativePlatform();
    const isMobileBrowser = !isNativeApp && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    setShowMobileBanner(isMobileBrowser);

    fetchInvitation();
  }, [code]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.API_BASE}/invitations/code/${code}`);
      const data = await response.json();

      if (data.success) {
        setInvitation(data.data);
        setRequiresSignup(data.requiresSignup || false);
        
        // If participant needs to sign up, redirect to register page with pre-filled data
        if (data.requiresSignup) {
          const signupUrl = `/register?email=${encodeURIComponent(data.data.participantEmail)}&name=${encodeURIComponent(data.data.participantName)}&invitationCode=${encodeURIComponent(code)}&returnTo=${encodeURIComponent(`/invitation/${code}`)}`;
          navigate(signupUrl);
          return;
        }
        
        // Check if user is already logged in
        const token = localStorage.getItem('token');
        if (!token) {
          // User needs to log in, redirect to login with invitation tracking to participant dashboard
          navigate(`/login?returnTo=${encodeURIComponent('/participant-dashboard')}&fromInvitation=true`);
          return;
        }
        
        // User is logged in and came from invitation link, redirect to participant dashboard
        // where they can see and respond to their invitations
        navigate('/participant-dashboard');
        return;
      } else {
        setError(data.message || 'Invitation not found');
      }
    } catch (error) {
      console.error('Error fetching invitation:', error);
      setError('Failed to load invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const respondToInvitation = async (response: 'accepted' | 'declined') => {
    if (!invitation) return;

    setResponding(true);
    try {
      const token = localStorage.getItem('token');
      const apiResponse = await fetch(`${API_CONFIG.API_BASE}/invitations/${invitation._id}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ response })
      });

      const data = await apiResponse.json();

      if (data.success) {
        setInvitation({ ...invitation, status: response });
        toast({
          title: `Invitation ${response}`,
          description: `You have ${response} the invitation to ${invitation.event.title}.`,
        });
      } else {
        toast({
          title: "Error",
          description: data.message || `Failed to ${response} invitation.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
      toast({
        title: "Error",
        description: "Failed to respond to invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResponding(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isExpired = (expiresAt: string, status: string, hasAttended?: boolean) => {
    // Don't consider accepted invitations or invitations from participants who attended as expired
    if (status === 'accepted' || hasAttended) return false;
    return new Date() > new Date(expiresAt);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The invitation link you followed is invalid or has expired.'}</p>
          <Button onClick={() => navigate('/')} variant="outline">
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  const expired = isExpired(invitation.expiresAt, invitation.status, invitation.hasAttended);
  const canRespond = !expired && invitation.status === 'pending';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 mb-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Mail className="w-8 h-8 text-blue-600" />
            Event Invitation
          </h1>
          <p className="text-gray-600 mt-2">You've been invited to participate in an event</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="space-y-6">
          {/* Mobile App Info Banner - for mobile browsers only */}
          {showMobileBanner && (
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-8 h-8 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-bold text-blue-900 mb-1">Download the Event Connect Mobile App</h3>
                    <p className="text-sm text-blue-800 mb-3">
                      For the best experience with QR code scanning, location tracking, and real-time notifications, download our mobile app.
                    </p>
                    <a
                      href="https://github.com/renheart15/event-connect/releases/download/v1.0.1/event-connect.apk"
                      download="EventConnect.apk"
                      className="inline-block"
                    >
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download App
                      </Button>
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Badge */}
          <div className="flex justify-center">
            {invitation.status === 'accepted' && (
              <Badge className="bg-green-100 text-green-800 px-4 py-2 text-lg">
                <CheckCircle className="w-5 h-5 mr-2" />
                Invitation Accepted
              </Badge>
            )}
            {invitation.status === 'declined' && (
              <Badge variant="destructive" className="px-4 py-2 text-lg">
                <XCircle className="w-5 h-5 mr-2" />
                Invitation Declined
              </Badge>
            )}
            {invitation.status === 'pending' && !expired && (
              <Badge variant="outline" className="px-4 py-2 text-lg border-blue-500 text-blue-700">
                <Clock className="w-5 h-5 mr-2" />
                Awaiting Response
              </Badge>
            )}
            {expired && (
              <Badge variant="destructive" className="px-4 py-2 text-lg">
                <XCircle className="w-5 h-5 mr-2" />
                Invitation Expired
              </Badge>
            )}
          </div>

          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{invitation.event.title}</CardTitle>
              {invitation.event.description && (
                <p className="text-gray-600">{invitation.event.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center text-gray-700">
                    <Calendar className="w-5 h-5 mr-3 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{formatDate(invitation.event.date)}</div>
                      <div className="text-sm text-gray-500">
                        {formatTime(invitation.event.startTime)}
                        {invitation.event.endTime && ` - ${formatTime(invitation.event.endTime)}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center text-gray-700">
                    <MapPin className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span>{invitation.event.location.address}</span>
                  </div>

                  <div className="flex items-center text-gray-700">
                    <User className="w-5 h-5 mr-3 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{invitation.event.organizer.name}</div>
                      <div className="text-sm text-gray-500">{invitation.event.organizer.email}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="text-center p-6 bg-gray-50 rounded-lg">
                    <QrCode className="w-16 h-16 text-gray-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 mb-2">Invitation Code</p>
                    <p className="font-mono text-lg font-bold">{invitation.invitationCode}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Participant Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invitation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div><strong>Invited:</strong> {invitation.participantName}</div>
                <div><strong>Email:</strong> {invitation.participantEmail}</div>
                <div><strong>Expires:</strong> {new Date(invitation.expiresAt).toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {canRespond && (
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg text-blue-800">Respond to Invitation</CardTitle>
                <p className="text-gray-600">Please let us know if you can attend this event.</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    onClick={() => respondToInvitation('accepted')}
                    disabled={responding}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {responding ? 'Responding...' : 'Accept Invitation'}
                  </Button>
                  <Button
                    onClick={() => respondToInvitation('declined')}
                    disabled={responding}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 px-8 py-3"
                  >
                    <XCircle className="w-5 h-5 mr-2" />
                    {responding ? 'Responding...' : 'Decline Invitation'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Already Responded */}
          {invitation.status !== 'pending' && !expired && (
            <Card className="text-center">
              <CardContent className="pt-6">
                <p className="text-gray-600 mb-4">
                  You have already {invitation.status} this invitation.
                </p>
                {invitation.status === 'accepted' && (
                  <p className="text-green-600 font-medium">
                    We look forward to seeing you at the event!
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center pt-6">
            <Button variant="outline" onClick={() => navigate('/')}>
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitationView;