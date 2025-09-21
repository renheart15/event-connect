import React, { useState, useEffect } from 'react';
import { useEvents, type Event } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Mail, 
  Calendar, 
  MapPin, 
  Users, 
  Send, 
  Plus, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Search,
  History,
  Clock,
  QrCode
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import { emailCredentialsService } from '@/services/emailCredentialsService';


interface InvitationRecord {
  id: string;
  participantName: string;
  participantEmail: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt?: string;
  lastSentAt?: string;
  attemptCount: number;
  errorMessage?: string;
  qrCode?: string;
  invitationId?: string;
}

const Invitations = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Use optimized events hook - only show active and upcoming events for invitations
  const {
    events: allEvents,
    loading,
    error: eventsError,
    refreshEvents
  } = useEvents();

  // Filter to show only active and upcoming events for invitations
  const events = allEvents.filter(e => e.status === 'active' || e.status === 'upcoming');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  
  // History tab states
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [filteredInvitations, setFilteredInvitations] = useState<InvitationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvitations, setSelectedInvitations] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('send');
  const [resendingInvitations, setResendingInvitations] = useState<string[]>([]);
  const [emailPassword, setEmailPassword] = useState('');
  const [gmailEmail, setGmailEmail] = useState('');
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

  // Check for stored credentials on component mount
  const checkStoredCredentials = async () => {
    try {
      setLoadingCredentials(true);
      const hasCredentials = await emailCredentialsService.hasStoredCredentials();
      setHasStoredCredentials(hasCredentials);
      
      if (hasCredentials) {
        const primaryCredential = await emailCredentialsService.getPrimaryCredential();
        if (primaryCredential) {
          setGmailEmail(primaryCredential.email);
        }
      }
    } catch (error) {
      console.error('Error checking stored credentials:', error);
    } finally {
      setLoadingCredentials(false);
    }
  };

  // Handle events error
  useEffect(() => {
    if (eventsError) {
      toast({
        title: "Error",
        description: "Failed to load events. Please try again.",
        variant: "destructive",
      });
    }
  }, [eventsError, toast]);

  useEffect(() => {
    checkStoredCredentials();
  }, []);

  // Filter invitations based on search and status
  useEffect(() => {
    let filtered = invitations;

    if (searchQuery.trim()) {
      filtered = filtered.filter(inv => 
        inv.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.participantEmail.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    setFilteredInvitations(filtered);
  }, [invitations, searchQuery, statusFilter]);

  // Fetch invitation history when tab changes to history or when event is selected
  useEffect(() => {
    if (activeTab === 'history' && selectedEventId) {
      fetchInvitationHistory();
    }
  }, [activeTab, selectedEventId]);


  const selectedEvent = events.find(e => e.id === selectedEventId);

  const fetchInvitationHistory = async () => {
    if (!selectedEventId) return;

    try {
      setHistoryLoading(true);
      const token = localStorage.getItem('token');
      
      // Use the existing API endpoint from your backend
      const response = await fetch(`/api/invitations/event/${selectedEventId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        const transformedInvitations: InvitationRecord[] = result.data.invitations.map((inv: any) => ({
          id: inv._id || inv.id,
          participantName: inv.participantName || inv.participant?.name || 'Unknown',
          participantEmail: inv.participantEmail || inv.participant?.email,
          status: inv.status === 'pending' ? 'sent' : inv.status, // Convert backend status to frontend status
          sentAt: inv.sentAt,
          lastSentAt: inv.respondedAt || inv.sentAt,
          attemptCount: 1, // Default since not tracked in current model
          errorMessage: inv.status === 'expired' ? 'Invitation expired' : null,
          qrCode: inv.qrCodeData,
          invitationId: inv._id
        }));

        setInvitations(transformedInvitations);
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to load invitation history.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching invitation history:', error);
      toast({
        title: "Error",
        description: "Failed to load invitation history.",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  };


  const handleSendInvitations = () => {
    if (!selectedEventId) {
      toast({
        title: "No Event Selected",
        description: "Please select an event to send invitations for.",
        variant: "destructive",
      });
      return;
    }
    
    navigate(`/send-invitations?eventId=${selectedEventId}&eventTitle=${encodeURIComponent(selectedEvent?.title || '')}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Upcoming</Badge>;
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const resendInvitation = async (invitation: InvitationRecord) => {
    if (!emailPassword) {
      toast({
        title: "Email Password Required",
        description: "Please enter your email password to resend invitations.",
        variant: "destructive",
      });
      return;
    }

    if (!invitation.invitationId) {
      toast({
        title: "Resend Failed",
        description: "Invalid invitation record. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    setResendingInvitations(prev => [...prev, invitation.id]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/invitations/${invitation.invitationId}/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          emailPassword: emailPassword
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Invitation Resent",
          description: `Invitation successfully resent to ${invitation.participantName}`,
        });
        
        // Refresh the invitation history
        fetchInvitationHistory();
      } else {
        toast({
          title: "Resend Failed",
          description: result.message || "Failed to resend invitation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Resend error:', error);
      toast({
        title: "Resend Failed",
        description: "Network error while resending invitation",
        variant: "destructive",
      });
    } finally {
      setResendingInvitations(prev => prev.filter(id => id !== invitation.id));
    }
  };

  const resendSelectedInvitations = async () => {
    if (!emailPassword) {
      toast({
        title: "Email Password Required",
        description: "Please enter your email password to resend invitations.",
        variant: "destructive",
      });
      return;
    }

    if (selectedInvitations.length === 0) {
      toast({
        title: "No Invitations Selected",
        description: "Please select invitations to resend.",
        variant: "destructive",
      });
      return;
    }

    const selectedItems = invitations.filter(inv => selectedInvitations.includes(inv.id));
    setResendingInvitations(selectedInvitations);

    let successCount = 0;
    let failureCount = 0;

    for (const invitation of selectedItems) {
      try {
        if (!invitation.invitationId) {
          console.error('Missing invitationId for:', invitation);
          failureCount++;
          continue;
        }

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/invitations/${invitation.invitationId}/resend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            emailPassword: emailPassword
          })
        });

        const result = await response.json();
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        failureCount++;
      }
    }

    setResendingInvitations([]);
    setSelectedInvitations([]);

    if (successCount > 0) {
      toast({
        title: "Bulk Resend Complete",
        description: `${successCount} invitations resent successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      });
      fetchInvitationHistory();
    } else {
      toast({
        title: "Bulk Resend Failed",
        description: "All invitation resends failed",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invitations</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Send invitations and manage invitation history</p>
          </div>
          <Link to="/create-event">
            <Button variant="outline" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create New Event
            </Button>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-6 py-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="send" className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send Invitations
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Invitation History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="send" className="space-y-6 mt-6">
          {events.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-300 bg-white dark:bg-gray-800">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Active Events Available
                </h3>
                <p className="text-gray-600 text-center mb-6">
                  You don't have any active or upcoming events to send invitations for. Check the browser console for debugging information.
                </p>
                <Link to="/create-event">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Event
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Event Selection */}
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Select Event
                  </CardTitle>
                  <CardDescription>
                    Choose an event to send invitations for
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an event..." />
                      </SelectTrigger>
                      <SelectContent>
                        {events.map((event) => (
                          <SelectItem 
                            key={event.id} 
                            value={event.id}
                            className="cursor-pointer hover:bg-accent focus:bg-accent"
                            disabled={false}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium text-foreground">{event.title}</span>
                              <div className="flex items-center gap-2 ml-4">
                                {getStatusBadge(event.status)}
                                <span className="text-sm text-muted-foreground">
                                  {formatDate(event.date)}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedEvent && (
                      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-gray-900">{selectedEvent.title}</h4>
                            {getStatusBadge(selectedEvent.status)}
                          </div>
                          
                          {selectedEvent.description && (
                            <p className="text-gray-600 text-sm">{selectedEvent.description}</p>
                          )}

                          {/* Fixed grid layout with proper spacing */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div className="flex items-start text-sm text-gray-600">
                                <Calendar className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">{formatDate(selectedEvent.date)}</div>
                                  <div className="text-gray-500">
                                    {formatTime(selectedEvent.startTime)}
                                    {selectedEvent.endTime && ` - ${formatTime(selectedEvent.endTime)}`}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-start text-sm text-gray-600">
                                <MapPin className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                                <span className="min-w-0 flex-1 break-words">
                                  {typeof selectedEvent.location === 'object'
                                    ? selectedEvent.location.address || 'Unknown'
                                    : selectedEvent.location || 'Unknown'}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-start text-sm text-gray-600">
                                <Users className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium">
                                    {selectedEvent.checkedIn}/{selectedEvent.totalParticipants} participants
                                  </div>
                                  {selectedEvent.currentlyPresent > 0 && (
                                    <div className="text-gray-500">
                                      {selectedEvent.currentlyPresent} currently present
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Fixed event code display */}
                              <div className="flex items-center text-sm text-gray-600">
                                <div className="w-4 h-4 mr-2 flex-shrink-0 flex items-center justify-center">
                                  <span className="text-[10px] font-mono font-bold bg-gray-200 dark:bg-gray-700 rounded px-1 py-0.5">
                                    #
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-500">Event Code:</span>
                                    <span className="font-mono font-bold text-gray-900 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-base">
                                      {selectedEvent.eventCode}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSendInvitations}
                        disabled={!selectedEventId}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="w-4 h-4" />
                        Send Invitations
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Events Quick Access */}
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle>Quick Access</CardTitle>
                  <CardDescription>
                    Recently created events you can send invitations for
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {events.slice(0, 6).map((event) => (
                      <div
                        key={event.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedEventId === event.id 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                        onClick={() => {
                          setSelectedEventId(event.id);
                          // Auto-navigate to send invitations for quick access
                          const params = new URLSearchParams();
                          params.set('eventId', event.id);
                          params.set('eventTitle', event.title);
                          navigate(`/send-invitations?${params.toString()}`);
                        }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="font-medium text-sm truncate">{event.title}</h5>
                            {getStatusBadge(event.status)}
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {new Date(event.date).toLocaleDateString()}
                            </div>
                            <div className="flex items-center">
                              <Users className="w-3 h-3 mr-1" />
                              {event.totalParticipants} participants
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
            </TabsContent>

            <TabsContent value="history" className="space-y-6 mt-6">
              {!selectedEventId ? (
                <Card className="bg-white dark:bg-gray-800">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <History className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Select an Event
                    </h3>
                    <p className="text-gray-600 text-center mb-6">
                      Choose an event from the Send Invitations tab to view its invitation history.
                    </p>
                    <Button onClick={() => setActiveTab('send')} variant="outline">
                      <Send className="w-4 h-4 mr-2" />
                      Go to Send Invitations
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Event Header */}
                  {selectedEvent && (
                    <Card className="bg-white dark:bg-gray-800">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <History className="w-5 h-5" />
                              Invitation History
                            </CardTitle>
                            <div className="mt-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-600">{selectedEvent.title}</span>
                                {getStatusBadge(selectedEvent.status)}
                              </div>
                              <CardDescription className="text-sm text-gray-500 mt-1">
                                {formatDate(selectedEvent.date)} • {
                                  typeof selectedEvent.location === 'object'
                                    ? selectedEvent.location.address || 'Unknown'
                                    : selectedEvent.location || 'Unknown'
                                }
                              </CardDescription>
                            </div>
                          </div>
                          <Button
                            onClick={() => {
                              setInvitations([]);
                              fetchInvitationHistory();
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  )}

                  {/* Search, Filter, and Email Settings */}
                  <Card className="bg-white dark:bg-gray-800">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <Label htmlFor="search">Search Invitations</Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <Input
                              id="search"
                              placeholder="Search by name or email..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="sm:w-48">
                          <Label htmlFor="status-filter">Status Filter</Label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                              <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Statuses</SelectItem>
                              <SelectItem value="sent">Sent Successfully</SelectItem>
                              <SelectItem value="failed">Failed</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Email Password for Resending */}
                      <div className="border-t pt-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                          <div className="flex-1">
                            <Label htmlFor="email-password">Email Password (for resending)</Label>
                            <Input
                              id="email-password"
                              type="password"
                              placeholder="Enter your email password..."
                              value={emailPassword}
                              onChange={(e) => setEmailPassword(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Required for resending invitations. Use app-specific password for Gmail.
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (gmailEmail) {
                                try {
                                  await emailCredentialsService.deleteCredentials(gmailEmail);
                                  setHasStoredCredentials(false);
                                  setGmailEmail('');
                                  setEmailPassword('');
                                  toast({
                                    title: "Cleared",
                                    description: "Saved credentials have been cleared from the database.",
                                  });
                                } catch (error) {
                                  console.error('Error clearing credentials:', error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to clear credentials from database.",
                                    variant: "destructive",
                                  });
                                }
                              } else {
                                setEmailPassword('');
                              }
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Invitations List */}
                  <Card className="bg-white dark:bg-gray-800">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>
                          Invitation Records ({filteredInvitations.length})
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {selectedInvitations.length > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={resendSelectedInvitations}
                              disabled={resendingInvitations.length > 0}
                            >
                              <RefreshCw className={`w-4 h-4 mr-2 ${resendingInvitations.length > 0 ? 'animate-spin' : ''}`} />
                              {resendingInvitations.length > 0 
                                ? `Resending... (${resendingInvitations.length})` 
                                : `Resend Selected (${selectedInvitations.length})`
                              }
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {historyLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <p className="ml-4 text-gray-600">Loading invitation history...</p>
                        </div>
                      ) : filteredInvitations.length === 0 ? (
                        <div className="text-center py-12">
                          <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h4 className="text-lg font-medium text-gray-900 mb-2">No Invitations Found</h4>
                          <p className="text-gray-600 mb-6">
                            {invitations.length === 0 
                              ? "No invitations have been sent for this event yet."
                              : "No invitations match your search criteria."
                            }
                          </p>
                          <div className="flex gap-3">
                            <Button onClick={() => fetchInvitationHistory()} variant="outline">
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Refresh
                            </Button>
                            <Button onClick={() => setActiveTab('send')}>
                              <Send className="w-4 h-4 mr-2" />
                              Send Invitations
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredInvitations.map((invitation) => (
                            <div
                              key={invitation.id}
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={selectedInvitations.includes(invitation.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedInvitations([...selectedInvitations, invitation.id]);
                                    } else {
                                      setSelectedInvitations(selectedInvitations.filter(id => id !== invitation.id));
                                    }
                                  }}
                                />
                                {getStatusIcon(invitation.status)}
                                <div>
                                  <div className="font-medium">{invitation.participantName}</div>
                                  <div className="text-sm text-gray-600">{invitation.participantEmail}</div>
                                  {invitation.errorMessage && (
                                    <div className="text-sm text-red-600 mt-1">
                                      Error: {invitation.errorMessage}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeVariant(invitation.status)}`}>
                                    {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Last sent: {formatDateTime(invitation.lastSentAt)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Attempts: {invitation.attemptCount}
                                  </div>
                                </div>
                                
                                <div className="flex gap-1">
                                  {invitation.qrCode && (
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button size="sm" variant="ghost" title="View QR Code">
                                          <QrCode className="w-4 h-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                          <DialogTitle>QR Code for {invitation.participantName}</DialogTitle>
                                          <DialogDescription>
                                            Scan this QR code to check in at the event
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="flex flex-col items-center space-y-4">
                                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                                            <img 
                                              src={invitation.qrCode} 
                                              alt="QR Code" 
                                              className="w-64 h-64"
                                            />
                                          </div>
                                          <div className="text-center text-sm text-gray-600">
                                            <p><strong>Event:</strong> {selectedEvent?.title}</p>
                                            <p><strong>Participant:</strong> {invitation.participantName}</p>
                                            <p><strong>Email:</strong> {invitation.participantEmail}</p>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  )}
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    title="Resend Invitation"
                                    onClick={() => resendInvitation(invitation)}
                                    disabled={resendingInvitations.includes(invitation.id)}
                                  >
                                    <RefreshCw className={`w-4 h-4 ${resendingInvitations.includes(invitation.id) ? 'animate-spin' : ''}`} />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Invitations;