import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Send,
  Key
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { emailCredentialsService } from '@/services/emailCredentialsService';

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
  const [emailPassword, setEmailPassword] = useState('');
  const [gmailEmail, setGmailEmail] = useState('');
  const [showGmailEmailField, setShowGmailEmailField] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);
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
    checkStoredCredentials();
  }, [eventId, navigate]);

  const checkStoredCredentials = async () => {
    try {
      setLoadingCredentials(true);
      const hasCredentials = await emailCredentialsService.hasStoredCredentials();
      setHasStoredCredentials(hasCredentials);
      
      if (hasCredentials) {
        setRememberPassword(true);
        // Auto-load the stored password
        try {
          const storedPassword = await emailCredentialsService.getStoredPassword();
          if (storedPassword) {
            setEmailPassword(storedPassword);
            console.log('Password loaded successfully from database');
          } else {
            console.log('No stored password found in database');
          }
        } catch (error) {
          console.error('Error loading stored password:', error);
          // Reset hasStoredCredentials if we can't load the password
          setHasStoredCredentials(false);
          setRememberPassword(false);
        }
      } else {
        // Ensure password field is cleared if no credentials
        setEmailPassword('');
        setRememberPassword(false);
      }
    } catch (error) {
      console.error('Error checking stored credentials:', error);
      setHasStoredCredentials(false);
      setRememberPassword(false);
      setEmailPassword('');
    } finally {
      setLoadingCredentials(false);
    }
  };

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

  const handleEmailPasswordChange = (value: string) => {
    setEmailPassword(value);
  };


  const handleRememberPasswordChange = async (checked: boolean) => {
    setRememberPassword(checked);
    
    if (!checked && hasStoredCredentials) {
      try {
        await emailCredentialsService.deleteStoredPassword();
        setHasStoredCredentials(false);
        toast({
          title: "Password Removed",
          description: "Stored password has been removed from the database.",
        });
      } catch (error) {
        console.error('Error removing password:', error);
        toast({
          title: "Error",
          description: "Failed to remove password from database.",
          variant: "destructive",
        });
      }
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

    if (!emailPassword.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter your Gmail app password to resend invitations.",
        variant: "destructive",
      });
      return;
    }

    if (showGmailEmailField && !gmailEmail.trim()) {
      toast({
        title: "Gmail Email Required",
        description: "Please enter your Gmail email address.",
        variant: "destructive",
      });
      return;
    }

    if (showGmailEmailField && !gmailEmail.trim().endsWith('@gmail.com')) {
      toast({
        title: "Invalid Gmail Address",
        description: "Please enter a valid Gmail address (must end with @gmail.com).",
        variant: "destructive",
      });
      return;
    }

    // Store password if remember is checked
    if (rememberPassword && emailPassword.trim()) {
      try {
        await emailCredentialsService.storePassword(emailPassword.trim(), gmailEmail.trim() || undefined);
        setHasStoredCredentials(true);
      } catch (error) {
        console.error('Error storing password:', error);
        
        // Check if the error requires a Gmail email address
        if (error.message.includes('Please provide a Gmail address')) {
          setShowGmailEmailField(true);
          toast({
            title: "Gmail Address Required",
            description: "Please provide your Gmail address to store the app password.",
            variant: "destructive",
          });
          return; // Stop execution to let user provide Gmail address
        }
        
        // Continue with resending invitations even if storing fails for other reasons
        toast({
          title: "Warning",
          description: "Failed to store password, but invitations will still be sent.",
        });
      }
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
              participantName: participant.name,
              emailPassword: emailPassword.trim()
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
                    <span className="w-4 h-4 mr-2 flex-shrink-0 font-mono text-xs bg-gray-200 rounded px-1 py-0.5">
                      CODE
                    </span>
                    <span className="font-mono font-medium">{event.eventCode}</span>
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

                  {/* Gmail App Password for Resend */}
                  <div className="border-t pt-4 space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Gmail App Password (required for resend)
                        {hasStoredCredentials && (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            ✓ Stored in Database
                          </span>
                        )}
                      </h4>
                      
                      {showGmailEmailField && (
                        <div className="space-y-2">
                          <Label htmlFor="resendGmailEmail">Gmail Email Address</Label>
                          <Input
                            id="resendGmailEmail"
                            type="email"
                            placeholder="your-email@gmail.com"
                            value={gmailEmail}
                            onChange={(e) => setGmailEmail(e.target.value)}
                            className="max-w-md"
                          />
                          <p className="text-xs text-muted-foreground">
                            Your registered account email is not a Gmail address. Please provide your Gmail address.
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label htmlFor="resendPassword">App Password</Label>
                        <Input
                          id="resendPassword"
                          type="password"
                          placeholder={loadingCredentials ? "Loading saved password..." : "Your Gmail app password"}
                          value={emailPassword}
                          onChange={(e) => handleEmailPasswordChange(e.target.value)}
                          className="max-w-md"
                          disabled={loadingCredentials}
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="rememberResendPassword"
                          checked={rememberPassword}
                          onCheckedChange={handleRememberPasswordChange}
                        />
                        <Label htmlFor="rememberResendPassword" className="text-xs text-muted-foreground">
                          Remember password in secure database
                        </Label>
                      </div>
                    </div>

                    <Button
                      onClick={handleResendInvitations}
                      disabled={selectedFailures.length === 0 || !emailPassword.trim() || isResending}
                      className="flex items-center gap-2"
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
              onClick={() => navigate(`/invitation-history?eventId=${eventId}&eventTitle=${encodeURIComponent(eventTitle || '')}`)}
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