import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
  Mail,
  User,
  Calendar,
  MapPin,
  Users,
  AlertTriangle,
  Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InvitationResult {
  email: string;
  name: string;
  status: 'success' | 'failed';
  error?: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: string;
  eventCode: string;
}

const InvitationSummary = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const eventId = searchParams.get('eventId');
  const eventTitle = searchParams.get('eventTitle');
  
  const [event, setEvent] = useState<Event | null>(null);
  const [invitationResults, setInvitationResults] = useState<InvitationResult[]>([]);
  const [isResending, setIsResending] = useState(false);
  const [selectedFailures, setSelectedFailures] = useState<string[]>([]);

  useEffect(() => {
    if (!eventId) {
      navigate('/invitations');
      return;
    }

    // Get results from navigation state or sessionStorage
    const results = JSON.parse(sessionStorage.getItem('invitationResults') || '[]');
    setInvitationResults(results);
    
    // Clear the session storage after loading
    sessionStorage.removeItem('invitationResults');

    fetchEventDetails();
  }, [eventId, navigate]);

  const fetchEventDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/events/${eventId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setEvent({
          ...result.data.event,
          id: result.data.event._id,
          location: result.data.event.location?.address || 'Unknown'
        });
      }
    } catch (error) {
      console.error('Error fetching event:', error);
    }
  };

  const handleSelectFailure = (email: string, checked: boolean) => {
    if (checked) {
      setSelectedFailures([...selectedFailures, email]);
    } else {
      setSelectedFailures(selectedFailures.filter(e => e !== email));
    }
  };

  const handleSelectAllFailures = () => {
    const failedEmails = invitationResults
      .filter(result => result.status === 'failed')
      .map(result => result.email);
    
    if (selectedFailures.length === failedEmails.length) {
      setSelectedFailures([]);
    } else {
      setSelectedFailures(failedEmails);
    }
  };

  const handleResendInvitations = async () => {
    if (selectedFailures.length === 0) {
      toast({
        title: "No Invitations Selected",
        description: "Please select failed invitations to resend.",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);

    try {
      const token = localStorage.getItem('token');
      const participantsToResend = invitationResults
        .filter(result => selectedFailures.includes(result.email));

      const newResults: InvitationResult[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (const participant of participantsToResend) {
        try {
          const response = await fetch('/api/invitations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              eventId,
              participantEmail: participant.email,
              participantName: participant.name
            })
          });

          const data = await response.json();

          if (data.success) {
            newResults.push({
              ...participant,
              status: 'success',
              error: undefined
            });
            successCount++;
          } else {
            newResults.push({
              ...participant,
              status: 'failed',
              error: data.message || 'Unknown error'
            });
            failedCount++;
          }
        } catch (error: any) {
          newResults.push({
            ...participant,
            status: 'failed',
            error: error.message || 'Network error'
          });
          failedCount++;
        }
      }

      // Update the results
      const updatedResults = invitationResults.map(result => {
        const newResult = newResults.find(nr => nr.email === result.email);
        return newResult || result;
      });

      setInvitationResults(updatedResults);
      setSelectedFailures([]);

      if (successCount > 0) {
        toast({
          title: "Invitations Resent",
          description: `Successfully resent ${successCount} invitation${successCount > 1 ? 's' : ''}${failedCount > 0 ? `. ${failedCount} still failed.` : '.'}`,
        });
      }

      if (failedCount > 0 && successCount === 0) {
        toast({
          title: "Resend Failed",
          description: `All ${failedCount} invitation${failedCount > 1 ? 's' : ''} failed to resend.`,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Resend error:', error);
      toast({
        title: "Error",
        description: "Failed to resend invitations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
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

  const successfulInvitations = invitationResults.filter(r => r.status === 'success');
  const failedInvitations = invitationResults.filter(r => r.status === 'failed');

  if (!event && invitationResults.length === 0) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-white border-b px-6 py-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/invitations')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Invitations
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Mail className="w-6 h-6" />
                Invitation Summary
              </h1>
              <p className="text-gray-600 mt-1">
                Results for "{eventTitle || 'Event'}" invitations
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Event Details */}
          {event && (
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                    <div>
                      <div>{formatDate(event.date)}</div>
                      <div>
                        {formatTime(event.startTime)}
                        {event.endTime && ` - ${formatTime(event.endTime)}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{event.location}</span>
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Badge variant="secondary" className="mr-2 font-mono text-xs">
                      {event.eventCode}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-3">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{invitationResults.length}</div>
                <div className="text-sm text-gray-600">Total Invitations</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-600">{successfulInvitations.length}</div>
                <div className="text-sm text-gray-600">Successful</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-3">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-red-600">{failedInvitations.length}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </CardContent>
            </Card>
          </div>

          {/* Failed Invitations - Resend Section */}
          {failedInvitations.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="bg-red-50 dark:bg-red-950/20">
                <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <AlertTriangle className="w-5 h-5" />
                  Failed Invitations ({failedInvitations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="selectAll"
                        checked={selectedFailures.length === failedInvitations.length}
                        onCheckedChange={handleSelectAllFailures}
                      />
                      <Label htmlFor="selectAll" className="text-sm font-medium">
                        Select all failed invitations
                      </Label>
                    </div>
                    <Badge variant="destructive">
                      {selectedFailures.length} selected
                    </Badge>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {failedInvitations.map((result) => (
                      <div key={result.email} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/10 rounded-lg">
                        <Checkbox
                          checked={selectedFailures.includes(result.email)}
                          onCheckedChange={(checked) => handleSelectFailure(result.email, !!checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="font-medium text-sm">{result.name}</span>
                            <span className="text-sm text-gray-600">({result.email})</span>
                          </div>
                          {result.error && (
                            <p className="text-xs text-red-600 mt-1 ml-6">
                              Error: {result.error}
                            </p>
                          )}
                        </div>
                        <Badge variant="destructive" className="flex-shrink-0">
                          Failed
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleResendInvitations}
                    disabled={selectedFailures.length === 0 || isResending}
                    className="flex items-center gap-2 mt-4"
                  >
                    {isResending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Resending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Resend {selectedFailures.length} Invitation{selectedFailures.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Successful Invitations */}
          {successfulInvitations.length > 0 && (
            <Card className="border-green-200">
              <CardHeader className="bg-green-50 dark:bg-green-950/20">
                <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <CheckCircle className="w-5 h-5" />
                  Successful Invitations ({successfulInvitations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {successfulInvitations.map((result) => (
                    <div key={result.email} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/10 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="font-medium text-sm">{result.name}</span>
                        <span className="text-sm text-gray-600">({result.email})</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Sent
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            <Button
              variant="outline"
              onClick={() => navigate('/invitations')}
            >
              Back to Invitations
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/invitations`)}
            >
              View All History
            </Button>
            <Button
              onClick={() => navigate(`/send-invitations?eventId=${eventId}&eventTitle=${encodeURIComponent(eventTitle || '')}`)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Send More Invitations
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitationSummary;