import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEvent } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Send, Plus, X, Upload, Download, FileSpreadsheet, ArrowLeft, Calendar, MapPin, Users, Building2, Crown, Shield, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useRef } from 'react';
import { API_CONFIG } from '@/config';

interface Participant {
  id: string;
  name: string;
  email: string;
}


interface OrganizationMember {
  user: {
    _id: string;
    name: string;
    email: string;
  };
  role: 'member' | 'admin' | 'owner';
  joinedAt: string;
}

interface Organization {
  _id: string;
  name: string;
  description?: string;
  organizationCode: string;
  owner: {
    _id: string;
    name: string;
    email: string;
  };
  members: OrganizationMember[];
  memberCount: number;
}

const SendInvitations = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  
  // Use optimized event hook for single event fetching
  const { event, loading: eventLoading, error: eventError } = useEvent(eventId);
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: '', email: '' }
  ]);
  const [uploadedParticipants, setUploadedParticipants] = useState<Participant[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'manual' | 'upload' | 'organization'>('manual');
  const [selectableMembers, setSelectableMembers] = useState<OrganizationMember[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memoize current user ID to avoid re-parsing localStorage on every render
  const currentUserId = useMemo(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return user._id || user.id;
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
    return null;
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!eventId) {
      navigate('/invitations');
      return;
    }

    fetchOrganizations();
  }, [eventId, navigate]);

  // Handle event loading error
  useEffect(() => {
    if (eventError) {
      toast({
        title: "Error",
        description: "Failed to load event details. Please try again.",
        variant: "destructive",
      });
    }
  }, [eventError, toast]);

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_CONFIG.API_BASE}/organizations/owned`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      if (result.success && result.data.length > 0) {
        setOrganizations(result.data);
        setSelectedOrg(result.data[0]); // Select first organization by default
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const addParticipant = () => {
    const newParticipant: Participant = {
      id: Date.now().toString(),
      name: '',
      email: ''
    };
    setParticipants([...participants, newParticipant]);
  };

  const removeParticipant = (id: string) => {
    if (participants.length > 1) {
      setParticipants(participants.filter(p => p.id !== id));
    }
  };

  const updateParticipant = (id: string, field: 'name' | 'email', value: string) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const updateUploadedParticipant = (id: string, field: 'name' | 'email', value: string) => {
    setUploadedParticipants(uploadedParticipants.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const removeUploadedParticipant = (id: string) => {
    setUploadedParticipants(uploadedParticipants.filter(p => p.id !== id));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      parseCSVFile(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      parseExcelFile(file);
    } else {
      toast({
        title: "Invalid File Format",
        description: "Please upload a CSV or Excel (.xlsx, .xls) file.",
        variant: "destructive",
      });
    }
  };

  const parseCSVFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        processUploadedData(results.data as Record<string, string>[]);
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        toast({
          title: "Error Parsing CSV",
          description: "Failed to parse the CSV file. Please check the format.",
          variant: "destructive",
        });
      }
    });
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, string>[];
        processUploadedData(jsonData);
      } catch (error) {
        console.error('Excel parsing error:', error);
        toast({
          title: "Error Parsing Excel",
          description: "Failed to parse the Excel file. Please check the format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processUploadedData = (data: Record<string, string>[]) => {
    const processedParticipants: Participant[] = [];
    let hasErrors = false;
    let errorCount = 0;

    data.forEach((row, index) => {
      // Find name and email columns (case insensitive)
      const nameFields = ['name', 'Name', 'NAME', 'full name', 'Full Name', 'fullname', 'FullName'];
      const emailFields = ['email', 'Email', 'EMAIL', 'email address', 'Email Address', 'emailaddress', 'EmailAddress'];
      
      let name = '';
      let email = '';
      
      // Find name field
      for (const field of nameFields) {
        if (row[field] && row[field].trim()) {
          name = row[field].trim();
          break;
        }
      }
      
      // Find email field
      for (const field of emailFields) {
        if (row[field] && row[field].trim()) {
          email = row[field].trim();
          break;
        }
      }
      
      if (name && email) {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(email)) {
          processedParticipants.push({
            id: `uploaded_${Date.now()}_${index}`,
            name,
            email
          });
        } else {
          hasErrors = true;
          errorCount++;
        }
      } else {
        if (name || email) { // Only count as error if there's partial data
          hasErrors = true;
          errorCount++;
        }
      }
    });

    if (processedParticipants.length === 0) {
      toast({
        title: "No Valid Data Found",
        description: "Please ensure your file contains 'name' and 'email' columns with valid data.",
        variant: "destructive",
      });
      return;
    }

    setUploadedParticipants(processedParticipants);
    setActiveTab('upload');
    
    toast({
      title: "File Uploaded Successfully",
      description: `Found ${processedParticipants.length} valid participants${hasErrors ? `. ${errorCount} rows were skipped due to missing or invalid data.` : '.'}`,
    });

    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csvContent = "name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invitation_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Template Downloaded",
      description: "CSV template has been downloaded to your computer.",
    });
  };

  const getRoleIcon = (role: string, isOwner: boolean = false) => {
    if (isOwner) return <Crown className="w-4 h-4 text-yellow-600" />;
    if (role === 'admin') return <Shield className="w-4 h-4 text-blue-600" />;
    return <User className="w-4 h-4 text-gray-500" />;
  };

  const getRoleLabel = (role: string, isOwner: boolean = false) => {
    if (isOwner) return 'Owner';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const handleMemberSelection = (memberId: string, checked: boolean) => {
    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(memberId);
      } else {
        newSet.delete(memberId);
      }
      return newSet;
    });
  };

  // Update selectable members when organization changes
  useEffect(() => {
    if (selectedOrg && currentUserId) {
      // Include both owner and members, but exclude current user
      const allMembers: OrganizationMember[] = [
        // Add owner as a selectable member (if not current user)
        ...(selectedOrg.owner._id !== currentUserId ? [{
          user: selectedOrg.owner,
          role: 'owner' as const,
          joinedAt: new Date().toISOString()
        }] : []),
        // Add regular members (excluding current user)
        ...selectedOrg.members.filter(member => member.user._id !== currentUserId)
      ];
      setSelectableMembers(allMembers);
      // Clear previous selections when organization changes
      setSelectedMembers(new Set());
    } else {
      setSelectableMembers([]);
      setSelectedMembers(new Set());
    }
  }, [selectedOrg, currentUserId]);

  const handleSelectAllMembers = () => {
    const allMemberIds = selectableMembers.map(member => member.user._id);
    setSelectedMembers(new Set(allMemberIds));
  };

  const handleClearAllMembers = () => {
    setSelectedMembers(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get participants from the active tab
    let currentParticipants: Participant[] = [];
    
    if (activeTab === 'manual') {
      currentParticipants = participants;
    } else if (activeTab === 'upload') {
      currentParticipants = uploadedParticipants;
    } else if (activeTab === 'organization') {
      // Convert selected organization members to participants
      const selectedMembersList = selectableMembers.filter(member => 
        selectedMembers.has(member.user._id)
      );
      currentParticipants = selectedMembersList.map(member => ({
        id: member.user._id,
        name: member.user.name,
        email: member.user.email
      }));
    }
    
    // Validate all participants
    const validParticipants = currentParticipants.filter(p => p.name.trim() && p.email.trim());

    if (validParticipants.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one participant with name and email.",
        variant: "destructive",
      });
      return;
    }

    if (validParticipants.length !== currentParticipants.length) {
      toast({
        title: "Warning",
        description: "Some participants were skipped due to missing information.",
        variant: "destructive",
      });
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const successfulInvitations: string[] = [];
      const failedInvitations: string[] = [];

      // Send invitations sequentially to avoid overwhelming the server
      for (const participant of validParticipants) {
        try {
          const response = await fetch('/api/invitations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              eventId,
              participantEmail: participant.email.trim(),
              participantName: participant.name.trim()
            })
          });

          const data = await response.json();

          if (data.success) {
            successfulInvitations.push(participant.email);
          } else {
            failedInvitations.push(`${participant.email}: ${data.message || 'Unknown error'}`);
          }
        } catch (error: any) {
          const errorMsg = error.message || 'Network error';
          failedInvitations.push(`${participant.email}: ${errorMsg}`);
        }
      }

      // Prepare results for summary page
      const results = validParticipants.map(participant => {
        const isSuccess = successfulInvitations.includes(participant.email);
        const failure = failedInvitations.find(f => f.startsWith(participant.email + ':'));
        const error = failure ? failure.split(': ')[1] : undefined;
        
        return {
          email: participant.email,
          name: participant.name,
          status: isSuccess ? 'success' : 'failed' as const,
          error
        };
      });

      // Store results in session storage for the summary page
      sessionStorage.setItem('invitationResults', JSON.stringify(results));
      
      // Navigate to summary page
      const params = new URLSearchParams();
      params.set('eventId', eventId!);
      params.set('eventTitle', event?.title || '');
      navigate(`/invitation-summary?${params.toString()}`);
    } catch (error) {
      console.error('Invitation error:', error);
      toast({
        title: "Error",
        description: "Failed to send invitations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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

  const formatDate = (dateString: string, endDate?: string, eventType?: string) => {
    if (endDate && endDate !== dateString) {
      // Multi-day event: show date range
      return `${new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })} - ${new Date(endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })}`;
    } else {
      // Single-day event: show full date
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (eventLoading || !event) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading event details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 mb-6">
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Mail className="w-6 h-6" />
                Send Invitations
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Send invitations with QR codes for "{event.title}"</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Event Details */}
          <Card className="bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Event Details</span>
                {getStatusBadge(event.status)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                  <div>
                    <div>{formatDate(event.date, event.endDate, event.eventType)}</div>
                    <div>
                      {formatTime(event.startTime)}
                      {event.endTime && ` - ${formatTime(event.endTime)}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>
                    {typeof event.location === 'object'
                      ? event.location.address || 'Unknown'
                      : event.location || 'Unknown'}
                  </span>
                </div>

                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>
                    {event.checkedIn}/{event.totalParticipants} participants
                  </span>
                </div>

                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {event.eventCode}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invitation Form */}
          <Card className="bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle>Invitation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'manual' | 'upload' | 'organization')} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Manual Entry
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      File Upload
                    </TabsTrigger>
                    <TabsTrigger value="organization" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Organization
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="manual" className="space-y-4">
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {participants.map((participant, index) => (
                        <Card key={participant.id} className="p-4 bg-white dark:bg-gray-800">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">Participant {index + 1}</h4>
                            {participants.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeParticipant(participant.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor={`name-${participant.id}`}>Name</Label>
                              <Input
                                id={`name-${participant.id}`}
                                type="text"
                                placeholder="Full name"
                                value={participant.name}
                                onChange={(e) => updateParticipant(participant.id, 'name', e.target.value)}
                                required
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor={`email-${participant.id}`}>Email</Label>
                              <Input
                                id={`email-${participant.id}`}
                                type="email"
                                placeholder="Email address"
                                value={participant.email}
                                onChange={(e) => updateParticipant(participant.id, 'email', e.target.value)}
                                required
                              />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addParticipant}
                      className="w-full flex items-center gap-2"
                      disabled={isLoading}
                    >
                      <Plus className="w-4 h-4" />
                      Add Another Participant
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="upload" className="space-y-4">
                    <Card className="p-4 border-dashed border-2 bg-white dark:bg-gray-800">
                      <div className="text-center space-y-4">
                        <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                          <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        
                        <div className="space-y-2">
                          <h3 className="font-medium">Upload CSV or Excel File</h3>
                          <p className="text-sm text-muted-foreground">
                            Upload a file with 'name' and 'email' columns to automatically import participants
                          </p>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2"
                            disabled={isLoading}
                          >
                            <Upload className="w-4 h-4" />
                            Choose File
                          </Button>
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={downloadTemplate}
                            className="flex items-center gap-2 text-xs"
                          >
                            <Download className="w-3 h-3" />
                            Download Template
                          </Button>
                        </div>
                        
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Supported formats: CSV, Excel (.xlsx, .xls)</p>
                          <p>Required columns: 'name' and 'email' (case insensitive)</p>
                        </div>
                      </div>
                    </Card>
                    
                    {uploadedParticipants.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Uploaded Participants ({uploadedParticipants.length})</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setUploadedParticipants([])}
                            className="text-red-500 hover:text-red-700"
                          >
                            Clear All
                          </Button>
                        </div>
                        
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {uploadedParticipants.map((participant, index) => (
                            <Card key={participant.id} className="p-4 bg-white dark:bg-gray-800">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium">Participant {index + 1}</h4>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeUploadedParticipant(participant.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`uploaded-name-${participant.id}`}>Name</Label>
                                  <Input
                                    id={`uploaded-name-${participant.id}`}
                                    type="text"
                                    placeholder="Full name"
                                    value={participant.name}
                                    onChange={(e) => updateUploadedParticipant(participant.id, 'name', e.target.value)}
                                    required
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor={`uploaded-email-${participant.id}`}>Email</Label>
                                  <Input
                                    id={`uploaded-email-${participant.id}`}
                                    type="email"
                                    placeholder="Email address"
                                    value={participant.email}
                                    onChange={(e) => updateUploadedParticipant(participant.id, 'email', e.target.value)}
                                    required
                                  />
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="organization" className="space-y-4">
                    {organizations.length === 0 ? (
                      <Card className="p-4 border-dashed border-2 bg-white dark:bg-gray-800">
                        <div className="text-center space-y-4">
                          <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="font-medium">No Organizations Found</h3>
                            <p className="text-sm text-muted-foreground">
                              You need to create an organization first to invite members
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate('/organization')}
                            className="flex items-center gap-2"
                          >
                            <Building2 className="w-4 h-4" />
                            Manage Organizations
                          </Button>
                        </div>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {/* Organization Selection */}
                        {organizations.length > 1 && (
                          <Card className="p-4 bg-white dark:bg-gray-800">
                            <div className="space-y-3">
                              <Label className="text-sm font-medium">Select Organization</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {organizations.map((org) => (
                                  <div
                                    key={org._id}
                                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                      selectedOrg?._id === org._id
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                                    }`}
                                    onClick={() => {
                                      setSelectedOrg(org);
                                    }}
                                  >
                                    <h4 className="font-medium text-sm">{org.name}</h4>
                                    <p className="text-xs text-muted-foreground">
                                      {org.memberCount} member(s)
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        )}

                        {/* Member Selection */}
                        {selectedOrg && selectableMembers.length > 0 ? (
                          <Card className="p-4 bg-white dark:bg-gray-800">
                            <div className="space-y-4">
                              {/* Selection Controls */}
                              <div className="flex items-center justify-between pb-4 border-b">
                                <div>
                                  <h4 className="font-medium">Select Members from {selectedOrg.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Choose organization members to invite to this event
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSelectAllMembers}
                                  >
                                    Check All
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearAllMembers}
                                  >
                                    Clear All
                                  </Button>
                                </div>
                              </div>

                              <div className="text-sm text-muted-foreground mb-4">
                                {selectedMembers.size} of {selectableMembers.length} member(s) selected
                              </div>

                              {/* Member List Table */}
                              <div className="border rounded-lg max-h-96 overflow-y-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-12">
                                        <Checkbox
                                          checked={selectedMembers.size === selectableMembers.length && selectableMembers.length > 0}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              handleSelectAllMembers();
                                            } else {
                                              handleClearAllMembers();
                                            }
                                          }}
                                        />
                                      </TableHead>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Email</TableHead>
                                      <TableHead>Role</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {selectableMembers.length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                          No other members available to invite
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      selectableMembers.map((member) => (
                                        <TableRow
                                          key={member.user._id}
                                          className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                          <TableCell>
                                            <Checkbox
                                              checked={selectedMembers.has(member.user._id)}
                                              onCheckedChange={(checked) => {
                                                handleMemberSelection(member.user._id, checked === true);
                                              }}
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              {getRoleIcon(member.role, member.role === 'owner')}
                                              <span className="font-medium">{member.user.name}</span>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <span className="text-muted-foreground">{member.user.email}</span>
                                          </TableCell>
                                          <TableCell>
                                            <Badge 
                                              variant={member.role === 'owner' ? 'default' : member.role === 'admin' ? 'default' : 'secondary'}
                                              className={member.role === 'owner' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : member.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : ''}
                                            >
                                              {getRoleLabel(member.role, member.role === 'owner')}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </Card>
                        ) : selectedOrg ? (
                          <Card className="p-4 border-dashed border-2 bg-white dark:bg-gray-800">
                            <div className="text-center space-y-4">
                              <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                <Users className="w-6 h-6 text-gray-400" />
                              </div>
                              <div className="space-y-2">
                                <h3 className="font-medium">No Members Available</h3>
                                <p className="text-sm text-muted-foreground">
                                  "{selectedOrg.name}" doesn't have any members to invite yet
                                </p>
                              </div>
                            </div>
                          </Card>
                        ) : null}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                
                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/invitations')}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send {(() => {
                          let count = 0;
                          if (activeTab === 'manual') {
                            count = participants.filter(p => p.name.trim() && p.email.trim()).length;
                          } else if (activeTab === 'upload') {
                            count = uploadedParticipants.filter(p => p.name.trim() && p.email.trim()).length;
                          } else if (activeTab === 'organization') {
                            count = selectedMembers.size;
                          }
                          return count;
                        })()} Invitation{(() => {
                          let count = 0;
                          if (activeTab === 'manual') {
                            count = participants.filter(p => p.name.trim() && p.email.trim()).length;
                          } else if (activeTab === 'upload') {
                            count = uploadedParticipants.filter(p => p.name.trim() && p.email.trim()).length;
                          } else if (activeTab === 'organization') {
                            count = selectedMembers.size;
                          }
                          return count !== 1 ? 's' : '';
                        })()}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SendInvitations;