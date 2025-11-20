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
import RegistrationFormModal from '@/components/RegistrationFormModal';

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

  // Registration form state
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [registrationFormData, setRegistrationFormData] = useState<any>(null);
  const [isRegistrationRequired, setIsRegistrationRequired] = useState(false); // Flag to prevent closing modal

  useEffect(() => {
    console.log('=== InvitationView MOUNTED ===');
    console.log('URL code parameter:', code);
    console.log('Current URL:', window.location.href);

    if (!code) {
      console.error('No code in URL!');
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    // Check if on mobile browser (not native app)
    const isNativeApp = Capacitor.isNativePlatform();
    const isMobileBrowser = !isNativeApp && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    setShowMobileBanner(isMobileBrowser);

    console.log('About to fetch invitation...');
    fetchInvitation();
  }, [code]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);

      // Get token if user is logged in
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('Fetching invitation with code:', code);
      const response = await fetch(`${API_CONFIG.API_BASE}/invitations/code/${code}`, {
        headers
      });
      console.log('Invitation response status:', response.status);
      const data = await response.json();
      console.log('Invitation data:', data);

      if (data.success) {
        console.log('Setting invitation data:', data.data);
        setInvitation(data.data);
        setRequiresSignup(data.requiresSignup || false);

        // If participant needs to sign up, redirect to register page with pre-filled data
        if (data.requiresSignup) {
          console.log('Requires signup, redirecting to register');
          const signupUrl = `/register?email=${encodeURIComponent(data.data.participantEmail)}&name=${encodeURIComponent(data.data.participantName)}&invitationCode=${encodeURIComponent(code)}&returnTo=${encodeURIComponent(`/invitation/${code}`)}`;
          navigate(signupUrl);
          return;
        }

        // Check if user is already logged in
        if (!token) {
          console.log('Not logged in, redirecting to login');
          // User needs to log in, redirect to login and return here after
          navigate(`/login?returnTo=${encodeURIComponent(`/invitation/${code}`)}`);
          return;
        }

        console.log('User is logged in, showing invitation');
        // User is logged in - show them the invitation details
        // (Component will render with invitation data)
      } else {
        console.error('Failed to fetch invitation:', data.message);
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
    if (!invitation) {
      console.log('❌ [INVITATION] No invitation object found');
      return;
    }

    console.log('🎯 [INVITATION] Responding to invitation:', response, 'for event:', invitation.event.id);
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
      console.log('📝 [INVITATION] Response from server:', data);

      if (data.success) {
        console.log('✅ [INVITATION] Successfully responded:', response);
        setInvitation({ ...invitation, status: response });

        // If accepted, check if event has a registration form
        if (response === 'accepted') {
          console.log('🔄 [INVITATION] Invitation accepted, checking for registration form...');
          await checkForRegistrationForm(invitation.event.id);
        } else {
          toast({
            title: `Invitation ${response}`,
            description: `You have ${response} the invitation to ${invitation.event.title}.`,
          });
        }
      } else {
        console.error('❌ [INVITATION] Failed to respond:', data.message);
        toast({
          title: "Error",
          description: data.message || `Failed to ${response} invitation.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ [INVITATION] Error responding to invitation:', error);
      toast({
        title: "Error",
        description: "Failed to respond to invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResponding(false);
    }
  };

  const checkForRegistrationForm = async (eventId: string) => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 [INVITATION] Checking for registration form for event:', eventId);

      // Check if event has a registration form
      const formResponse = await fetch(`${API_CONFIG.API_BASE}/registration-forms/event/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const formData = await formResponse.json();
      console.log('🔍 [INVITATION] Registration form response:', formData);

      if (formData.success && formData.data && formData.data.registrationForm) {
        console.log('✅ [INVITATION] Registration form found');
        // Check if user has already submitted a response
        const responseCheckResponse = await fetch(
          `${API_CONFIG.API_BASE}/registration-responses/check/${eventId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const responseCheck = await responseCheckResponse.json();
        console.log('🔍 [INVITATION] Response check result:', responseCheck);

        if (responseCheck.success && responseCheck.data && !responseCheck.data.hasSubmitted) {
          console.log('✅ [INVITATION] User has not submitted, showing form modal');
          console.log('📋 [INVITATION] Form data:', formData.data.registrationForm);
          // Show registration form modal - mark as required to prevent dismissal
          setRegistrationFormData(formData.data.registrationForm);
          setIsRegistrationRequired(true); // Form must be completed
          setShowRegistrationForm(true);
          console.log('🎬 [INVITATION] Modal state set - showRegistrationForm: true, isRequired: true');
        } else {
          console.log('ℹ️ [INVITATION] User already submitted form or form not required');
          toast({
            title: "Invitation accepted",
            description: `You have accepted the invitation to ${invitation?.event.title}.`,
          });
        }
      } else {
        console.log('ℹ️ [INVITATION] No registration form found for event');
        toast({
          title: "Invitation accepted",
          description: `You have accepted the invitation to ${invitation?.event.title}.`,
        });
      }
    } catch (error) {
      console.error('❌ [INVITATION] Error checking for registration form:', error);
      toast({
        title: "Invitation accepted",
        description: `You have accepted the invitation to ${invitation?.event.title}.`,
      });
    }
  };

  const handleRegistrationSuccess = () => {
    setShowRegistrationForm(false);
    setIsRegistrationRequired(false);
    toast({
      title: "Success",
      description: "Registration completed! You're all set for the event.",
    });
  };

  const handleRegistrationClose = () => {
    // Only allow closing if form is not required
    if (!isRegistrationRequired) {
      setShowRegistrationForm(false);
      setRegistrationFormData(null);
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

  const isExpired = (expiresAt: string, status: string, hasAttended?: boolean, event?: Event) => {
    // Don't consider accepted invitations or invitations from participants who attended as expired
    if (status === 'accepted' || hasAttended) return false;

    // If we have event data, check if the event has ended (date + endTime)
    if (event) {
      try {
        const eventEndDateTime = new Date(`${event.date}T${event.endTime}`);
        const now = new Date();
        // Invitation is expired only after the event ends
        return now > eventEndDateTime;
      } catch (error) {
        console.error('Error parsing event end time:', error);
        // Fallback to expiresAt
        return new Date() > new Date(expiresAt);
      }
    }

    // Fallback: use expiresAt if no event data
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
    console.log('Showing error screen. Error:', error, 'Invitation:', invitation);
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Debug banner */}
        <div className="bg-red-600 text-white px-4 py-2 text-xs">
          <strong>DEBUG:</strong> InvitationView ERROR Page | Code: {code} | URL: {window.location.pathname}
        </div>

        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center max-w-md mx-auto px-4">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Not Found</h1>
            <p className="text-gray-600 mb-6">{error || 'The invitation link you followed is invalid or has expired.'}</p>
            <div className="text-xs text-left bg-gray-100 p-4 rounded mb-4 overflow-auto max-h-40">
              <strong>Debug Info:</strong><br/>
              Error: {error || 'none'}<br/>
              Has Invitation: {invitation ? 'yes' : 'no'}<br/>
              Code: {code || 'none'}<br/>
              Loading: {loading ? 'yes' : 'no'}<br/>
              Current URL: {window.location.href}
            </div>
            <Button onClick={() => navigate('/')} variant="outline">
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const expired = isExpired(invitation.expiresAt, invitation.status, invitation.hasAttended, invitation.event);
  const canRespond = !expired && invitation.status === 'pending';

  console.log('Invitation expiry check:', {
    expiresAt: invitation.expiresAt,
    eventDate: invitation.event?.date,
    eventEndTime: invitation.event?.endTime,
    isExpired: expired,
    status: invitation.status
  });

  console.log('Rendering invitation view with data:', invitation);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Debug banner */}
      <div className="bg-purple-600 text-white px-4 py-2 text-xs">
        <strong>DEBUG:</strong> InvitationView Page | Code: {code} | URL: {window.location.pathname}
      </div>

      <div className="bg-white border-b px-6 py-4 mb-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Mail className="w-8 h-8 text-blue-600" />
            Event Invitation
          </h1>
          <p className="text-gray-600 mt-2">You've been invited to participate in an event</p>
          <div className="text-xs bg-green-50 p-2 rounded mt-2 border border-green-200">
            ✓ Invitation loaded successfully for: {invitation.participantName}
          </div>
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

      {/* Registration Form Modal */}
      {(() => {
        const shouldShow = showRegistrationForm && registrationFormData && invitation;
        console.log('🎭 [INVITATION] Modal render check:', {
          showRegistrationForm,
          hasRegistrationFormData: !!registrationFormData,
          hasInvitation: !!invitation,
          shouldShow,
          isRequired: isRegistrationRequired
        });
        return shouldShow ? (
          <RegistrationFormModal
            isOpen={showRegistrationForm}
            onClose={handleRegistrationClose}
            eventId={invitation.event.id}
            eventTitle={invitation.event.title}
            registrationForm={registrationFormData}
            onSubmitSuccess={handleRegistrationSuccess}
            token={localStorage.getItem('token') || ''}
            isRequired={isRegistrationRequired}
          />
        ) : null;
      })()}
    </div>
  );
};

export default InvitationView;