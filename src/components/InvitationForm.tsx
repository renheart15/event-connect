
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Send, Plus, X, Key, Upload, FileText, Download, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { emailCredentialsService } from '@/services/emailCredentialsService';

interface InvitationFormProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Participant {
  id: string;
  name: string;
  email: string;
}

const InvitationForm = ({ eventId, eventTitle, isOpen, onClose }: InvitationFormProps) => {
  const { toast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: '', email: '' }
  ]);
  const [uploadedParticipants, setUploadedParticipants] = useState<Participant[]>([]);
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [emailPassword, setEmailPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

  useEffect(() => {
    if (isOpen) {
      checkStoredCredentials();
    }
  }, [isOpen]);

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

    // Store password if remember is checked
    if (rememberPassword && emailPassword.trim()) {
      try {
        await emailCredentialsService.storePassword(emailPassword.trim());
        setHasStoredCredentials(true);
      } catch (error) {
        console.error('Error storing password:', error);
        // Continue with sending invitations even if storing fails
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

      // Show results
      if (successfulInvitations.length > 0) {
        // Credentials are already stored in database if remember is checked
        
        toast({
          title: "Invitations Sent",
          description: `Successfully sent ${successfulInvitations.length} invitation${successfulInvitations.length > 1 ? 's' : ''}`,
        });
      }

      if (failedInvitations.length > 0) {
        console.log('Failed invitations:', failedInvitations);
        
        // Group similar errors
        const errorSummary = failedInvitations.reduce((acc, failure) => {
          const email = failure.split(': ')[0];
          const error = failure.split(': ')[1] || 'Unknown error';
          
          if (!acc[error]) {
            acc[error] = [];
          }
          acc[error].push(email);
          return acc;
        }, {} as Record<string, string[]>);

        // Show the most critical error first
        const criticalErrors = Object.keys(errorSummary);
        const firstError = criticalErrors[0];
        
        // Determine error type and provide specific guidance
        let alertTitle = "Invitation Failed";
        let alertDescription = "";
        let showEmailSettings = false;
        
        if (firstError.includes('authentication') || firstError.includes('Invalid login') || firstError.includes('535')) {
          alertTitle = "Email Authentication Failed";
          alertDescription = "Your email password is incorrect or you need to use an app-specific password. For Gmail, enable 2FA and generate an app password.";
          showEmailSettings = true;
        } else if (firstError.includes('connection') || firstError.includes('ECONNECTION') || firstError.includes('ETIMEDOUT')) {
          alertTitle = "Connection Error";
          alertDescription = "Cannot connect to email server. Please check your internet connection and try again.";
        } else if (firstError.includes('SMTP') || firstError.includes('smtp')) {
          alertTitle = "Email Server Error";
          alertDescription = "SMTP server error. Please verify your email provider settings.";
          showEmailSettings = true;
        } else if (firstError.includes('rejected') || firstError.includes('550')) {
          alertTitle = "Email Rejected";
          alertDescription = "Email was rejected by the recipient's server. Please verify the email addresses are correct.";
        } else if (firstError.includes('spam') || firstError.includes('554')) {
          alertTitle = "Email Blocked";
          alertDescription = "Email was blocked by spam filter. Try again later or contact the recipients directly.";
        } else if (firstError.includes('past event')) {
          alertTitle = "Invalid Event Date";
          alertDescription = "Cannot send invitations for past events. Please check your event date.";
        } else {
          alertTitle = "Invitations Failed";
          alertDescription = `${failedInvitations.length} invitation${failedInvitations.length > 1 ? 's' : ''} failed to send: ${firstError}`;
        }

        toast({
          title: alertTitle,
          description: alertDescription,
          variant: "destructive",
        });
        
        // Show email settings suggestion for auth/config errors
        if (showEmailSettings) {
          // Clear stored password on authentication error
          if (firstError.includes('authentication') || firstError.includes('Invalid login') || firstError.includes('535')) {
            try {
              await emailCredentialsService.deleteStoredPassword();
              setHasStoredCredentials(false);
            } catch (error) {
              console.error('Error clearing password after auth error:', error);
            }
            setRememberPassword(false);
            setEmailPassword('');
          }
          
          setTimeout(() => {
            toast({
              title: "Email Setup Required",
              description: "Go to Settings > Email Configuration to set up your email properly.",
            });
          }, 2000);
        }
        
        // Show detailed breakdown if multiple different errors
        if (criticalErrors.length > 1) {
          setTimeout(() => {
            const breakdown = criticalErrors.map(error => 
              `• ${error}: ${errorSummary[error].length} recipient${errorSummary[error].length > 1 ? 's' : ''}`
            ).join('\n');
            
            toast({
              title: "Error Breakdown",
              description: breakdown,
              variant: "destructive",
            });
          }, 3000);
        }
      }

      // Reset form if all were successful
      if (failedInvitations.length === 0) {
        if (activeTab === 'manual') {
          setParticipants([{ id: '1', name: '', email: '' }]);
        } else {
          setUploadedParticipants([]);
        }
        // Only clear password if not remembering it
        if (!rememberPassword) {
          setEmailPassword('');
        }
        onClose();
      }
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Invitations
          </DialogTitle>
          <DialogDescription>
            Send invitations with QR codes for "{eventTitle}"
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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

          
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 flex items-center gap-2"
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
      </DialogContent>
    </Dialog>
  );
};

export default InvitationForm;
