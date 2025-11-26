import React, { useState, useEffect } from 'react';
import { useEvents, type Event } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

interface JoinRequest {
  _id: string;
  participant: {
    _id: string;
    name: string;
    email: string;
  };
  event: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
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

  // Join requests states
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

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
      fetchJoinRequests();
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

  const fetchJoinRequests = async () => {
    if (!selectedEventId) return;

    try {
      setJoinRequestsLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/events/${selectedEventId}/join-requests`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setJoinRequests(result.data.joinRequests || []);
      } else {
        console.error('Failed to load join requests:', result.message);
      }
    } catch (error) {
      console.error('Error fetching join requests:', error);
    } finally {
      setJoinRequestsLoading(false);
    }
  };

  const handleJoinRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      setProcessingRequest(requestId);
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/events/join-requests/${requestId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: action === 'approve' ? 'Request Approved' : 'Request Rejected',
          description: `Join request has been ${action}d successfully.`,
        });

        // Refresh join requests
        fetchJoinRequests();
      } else {
        toast({
          title: "Error",
          description: result.message || `Failed to ${action} request.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} request.`,
        variant: "destructive",
      });
    } finally {
      setProcessingRequest(null);
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
        body: JSON.stringify({})
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
          body: JSON.stringify({})
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
            <p className="text-gray-600 dark:text-gray-400 mt-1">Send invitations and manage participants</p>
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
                <Users className="w-4 h-4" />
                Participants
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
                      <Users className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Select an Event
                    </h3>
                    <p className="text-gray-600 text-center mb-6">
                      Choose an event from the Send Invitations tab to view its participants.
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
                              <Users className="w-5 h-5" />
                              Participants
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
                              setJoinRequests([]);
                              fetchInvitationHistory();
                              fetchJoinRequests();
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

                  {/* Two Column Layout: Invitation Records & Join Requests */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left Column: Invitation Records */}
                    <Card className="bg-white dark:bg-gray-800">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Mail className="w-5 h-5" />
                              Invitation Records ({filteredInvitations.length})
                            </CardTitle>
                            <CardDescription>
                              Participants invited via email
                            </CardDescription>
                          </div>
                          {selectedInvitations.length > 0 && (
                            <Button
                              size="sm"
                              onClick={resendSelectedInvitations}
                              disabled={resendingInvitations.length > 0}
                              className="h-7 px-3 text-[10px] flex items-center gap-1"
                            >
                              <RefreshCw className={`w-3 h-3 ${resendingInvitations.length > 0 ? 'animate-spin' : ''}`} />
                              {resendingInvitations.length > 0
                                ? `Resending... (${resendingInvitations.length})`
                                : `Resend Selected (${selectedInvitations.length})`
                              }
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Search and Filter */}
                        <div className="space-y-3 mb-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <Input
                              placeholder="Search by name or email..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
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

                        {/* Invitations Table */}
                        {historyLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <p className="ml-3 text-xs text-gray-600 dark:text-gray-400">Loading...</p>
                          </div>
                        ) : filteredInvitations.length === 0 ? (
                          <div className="text-center py-8">
                            <Mail className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {invitations.length === 0 ? "No invitations sent yet" : "No matches"}
                            </p>
                          </div>
                        ) : (
                          <div className="text-[10px]">
                            <Table>
                              <TableHeader>
                                <TableRow className="text-[9px]">
                                  <TableHead className="py-1.5 h-7 w-10">
                                    <Checkbox
                                      className="w-3.5 h-3.5"
                                      checked={selectedInvitations.length === filteredInvitations.length && filteredInvitations.length > 0}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedInvitations(filteredInvitations.map(inv => inv.id));
                                        } else {
                                          setSelectedInvitations([]);
                                        }
                                      }}
                                    />
                                  </TableHead>
                                  <TableHead className="py-1.5 h-7">Name</TableHead>
                                  <TableHead className="py-1.5 h-7">Email</TableHead>
                                  <TableHead className="py-1.5 h-7">Status</TableHead>
                                  <TableHead className="py-1.5 h-7">Last Sent</TableHead>
                                  <TableHead className="py-1.5 h-7 text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="text-[10px]">
                                {filteredInvitations.map((invitation) => (
                                  <TableRow key={invitation.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <TableCell className="py-1">
                                      <Checkbox className="w-3.5 h-3.5"
                                        checked={selectedInvitations.includes(invitation.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedInvitations([...selectedInvitations, invitation.id]);
                                          } else {
                                            setSelectedInvitations(selectedInvitations.filter(id => id !== invitation.id));
                                          }
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <div className="flex items-center gap-0.5">
                                        <span className="font-medium leading-tight">{invitation.participantName}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <span className="leading-tight">{invitation.participantEmail}</span>
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <Badge className={`text-[9px] px-1.5 py-0 h-4 ${getStatusBadgeVariant(invitation.status)}`}>
                                        {invitation.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <span className="text-[9px] leading-tight">{formatDateTime(invitation.lastSentAt)}</span>
                                    </TableCell>
                                    <TableCell className="py-1 text-right">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        title="Resend"
                                        onClick={() => resendInvitation(invitation)}
                                        disabled={resendingInvitations.includes(invitation.id)}
                                      >
                                        <RefreshCw className={`w-2.5 h-2.5 ${resendingInvitations.includes(invitation.id) ? 'animate-spin' : ''}`} />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Right Column: Join Requests */}
                    <Card className="bg-white dark:bg-gray-800">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          Join Requests ({joinRequests.filter(r => r.status === 'pending').length})
                        </CardTitle>
                        <CardDescription>
                          Participants requesting to join via QR code
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {joinRequestsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <p className="ml-3 text-xs text-gray-600 dark:text-gray-400">Loading...</p>
                          </div>
                        ) : joinRequests.filter(r => r.status === 'pending').length === 0 ? (
                          <div className="text-center py-8">
                            <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              No pending requests
                            </p>
                          </div>
                        ) : (
                          <div className="text-[10px]">
                            <Table>
                              <TableHeader>
                                <TableRow className="text-[9px]">
                                  <TableHead className="py-1.5 h-7">Name</TableHead>
                                  <TableHead className="py-1.5 h-7">Email</TableHead>
                                  <TableHead className="py-1.5 h-7">Requested</TableHead>
                                  <TableHead className="py-1.5 h-7 text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="text-[10px]">
                                {joinRequests.filter(r => r.status === 'pending').map((request) => (
                                  <TableRow key={request._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <TableCell className="py-1">
                                      <span className="font-medium leading-tight">{request.participant.name}</span>
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <span className="leading-tight">{request.participant.email}</span>
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <span className="text-[9px] leading-tight">{formatDateTime(request.requestedAt)}</span>
                                    </TableCell>
                                    <TableCell className="py-1 text-right">
                                      <div className="flex items-center justify-end gap-0.5">
                                        <Button
                                          size="sm"
                                          onClick={() => handleJoinRequest(request._id, 'approve')}
                                          disabled={processingRequest === request._id}
                                          className="h-6 px-2 text-[9px] bg-green-600 hover:bg-green-700"
                                        >
                                          {processingRequest === request._id ? (
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                          ) : (
                                            <>
                                              <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                                              Approve
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleJoinRequest(request._id, 'reject')}
                                          disabled={processingRequest === request._id}
                                          className="h-6 px-2 text-[9px] text-red-600 border-red-300 hover:bg-red-50"
                                        >
                                          <XCircle className="w-2.5 h-2.5 mr-0.5" />
                                          Reject
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
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