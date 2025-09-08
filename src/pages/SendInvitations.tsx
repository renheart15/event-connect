import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Send, Plus, X, Key, Upload, Download, FileSpreadsheet, ArrowLeft, Calendar, MapPin, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useRef } from 'react';
import { emailCredentialsService } from '@/services/emailCredentialsService';

interface Participant {
  id: string;
  name: string;
  email: string;
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
  totalParticipants: number;
  checkedIn: number;
}

const SendInvitations = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  const eventTitle = searchParams.get('eventTitle');
  
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: '', email: '' }
  ]);
  const [uploadedParticipants, setUploadedParticipants] = useState<Participant[]>([]);
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [emailPassword, setEmailPassword] = useState('');
  const [gmailEmail, setGmailEmail] = useState('');
  const [showGmailEmailField, setShowGmailEmailField] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

  useEffect(() => {
    if (!eventId) {
      navigate('/invitations');
      return;
    }
    
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
          }
        } catch (error) {
          console.error('Error loading stored password:', error);
        }
      }
    } catch (error) {
      console.error('Error checking stored credentials:', error);
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
      } else {
        toast({
          title: "Error",
          description: "Failed to load event details.",
          variant: "destructive",
        });
        navigate('/invitations');
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      toast({
        title: "Error",
        description: "Failed to load event details.",
        variant: "destructive",
      });
      navigate('/invitations');
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

  const handleEmailPasswordChange = (value: string) => {
    setEmailPassword(value);
  };

  // Handle remember password checkbox
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

  // Clear saved password
  const clearSavedPassword = async () => {
    try {
      await emailCredentialsService.deleteStoredPassword();
      setHasStoredCredentials(false);
      setEmailPassword('');
      setRememberPassword(false);
      toast({
        title: "Cleared",
        description: "Saved password has been cleared from the database.",
      });
    } catch (error) {
      console.error('Error clearing password:', error);
      toast({
        title: "Error",
        description: "Failed to clear password from database.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get participants from the active tab
    const currentParticipants = activeTab === 'manual' ? participants : uploadedParticipants;
    
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

    if (!emailPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Gmail app password to send invitations.",
        variant: "destructive",
      });
      return;
    }

    if (showGmailEmailField && !gmailEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Gmail email address.",
        variant: "destructive",
      });
      return;
    }

    if (showGmailEmailField && !gmailEmail.trim().endsWith('@gmail.com')) {
      toast({
        title: "Error",
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
        
        // Continue with sending invitations even if storing fails for other reasons
        toast({
          title: "Warning",
          description: "Failed to store password, but invitations will still be sent.",
        });
      }
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
              participantName: participant.name.trim(),
              emailPassword: emailPassword.trim()
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

      // Credentials are already stored in database if remember is checked
      
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

  if (!event) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading event details...</p>
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
                Send Invitations
              </h1>
              <p className="text-gray-600 mt-1">Send invitations with QR codes for "{event.title}"</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Event Details</span>
                {getStatusBadge(event.status)}
              </CardTitle>
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
                  <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>
                    {event.checkedIn}/{event.totalParticipants} participants
                  </span>
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

          {/* Invitation Form */}
          <Card>
            <CardHeader>
              <CardTitle>Invitation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Gmail App Password Input */}
                <Card className="p-4 bg-blue-50 dark:bg-blue-950/20">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        <Label htmlFor="emailPassword" className="text-sm font-medium">
                          Gmail App Password <span className="text-red-500">*</span>
                        </Label>
                        {hasStoredCredentials && (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            ✓ Stored in Database
                          </span>
                        )}
                      </div>
                      {hasStoredCredentials && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearSavedPassword}
                          className="text-xs h-auto py-1 px-2 text-red-500 hover:text-red-700"
                        >
                          Clear Stored
                        </Button>
                      )}
                    </div>
                    
                    {showGmailEmailField && (
                      <div className="space-y-2">
                        <Label htmlFor="gmailEmail" className="text-sm font-medium">
                          Gmail Email Address <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="gmailEmail"
                          type="email"
                          placeholder="your-email@gmail.com"
                          value={gmailEmail}
                          onChange={(e) => setGmailEmail(e.target.value)}
                          required={showGmailEmailField}
                          className="bg-white dark:bg-gray-800"
                        />
                        <p className="text-xs text-muted-foreground">
                          Your registered account email is not a Gmail address. Please provide your Gmail address to send invitations.
                        </p>
                      </div>
                    )}
                    
                    <Input
                      id="emailPassword"
                      type="password"
                      placeholder="Your Gmail app password"
                      value={emailPassword}
                      onChange={(e) => handleEmailPasswordChange(e.target.value)}
                      required
                      className="bg-white dark:bg-gray-800"
                    />
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rememberPassword"
                        checked={rememberPassword}
                        onCheckedChange={handleRememberPasswordChange}
                      />
                      <Label
                        htmlFor="rememberPassword"
                        className="text-xs text-muted-foreground cursor-pointer"
                      >
                        Remember password in secure database
                      </Label>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      Required to send emails from your Gmail account. Use a Gmail app password for security.
                      {rememberPassword && (
                        <span className="block text-amber-600 dark:text-amber-400 mt-1">
                          Password will be stored securely in the database with encryption.
                        </span>
                      )}
                    </p>
                  </div>
                </Card>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'manual' | 'upload')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Manual Entry
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      File Upload
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="manual" className="space-y-4">
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {participants.map((participant, index) => (
                        <Card key={participant.id} className="p-4">
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
                    <Card className="p-4 border-dashed border-2">
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
                            <Card key={participant.id} className="p-4">
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
                        Send {(activeTab === 'manual' ? participants : uploadedParticipants).filter(p => p.name.trim() && p.email.trim()).length} Invitation{(activeTab === 'manual' ? participants : uploadedParticipants).filter(p => p.name.trim() && p.email.trim()).length !== 1 ? 's' : ''}
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