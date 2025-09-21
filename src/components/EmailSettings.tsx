import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle, XCircle, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  isEmailConfigured: boolean;
}

const EmailSettings = ({ isOpen, onClose }: EmailSettingsProps) => {
  const { toast } = useToast();
  const [config, setConfig] = useState<EmailConfig>({
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    isEmailConfigured: false
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPassword, setTestPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadEmailConfig();
    }
  }, [isOpen]);

  const loadEmailConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user-settings/email-config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setConfig(result.data.emailConfig);
        }
      }
    } catch (error) {
      console.error('Failed to load email config:', error);
      toast({
        title: "Error",
        description: "Failed to load email configuration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user-settings/email-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          smtpHost: config.smtpHost,
          smtpPort: config.smtpPort
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setConfig(result.data.emailConfig);
        toast({
          title: "Settings Saved",
          description: "Email configuration has been updated successfully.",
        });
      } else {
        throw new Error(result.message || 'Failed to save settings');
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save email configuration.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testPassword) {
      toast({
        title: "Password Required",
        description: "Please enter your email password to test the configuration.",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user-settings/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          testPassword
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Test Successful",
          description: "Test email sent successfully! Check your inbox.",
        });
        setTestPassword('');
      } else {
        throw new Error(result.message || 'Test failed');
      }
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test email. Please check your settings and password.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading email settings...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Email Settings
          </DialogTitle>
          <DialogDescription>
            Configure your email settings to send invitations from your email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Email Configuration Status</CardTitle>
                <Badge variant={config.isEmailConfigured ? "default" : "secondary"}>
                  {config.isEmailConfigured ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Configured
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 mr-1" />
                      Not Configured
                    </>
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {config.isEmailConfigured 
                  ? "Your email is configured and ready to send invitations."
                  : "Please configure your email settings to send invitations from your email address."
                }
              </p>
            </CardContent>
          </Card>

          {/* Configuration Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">SMTP Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    value={config.smtpHost}
                    onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={config.smtpPort}
                    onChange={(e) => setConfig({ ...config, smtpPort: parseInt(e.target.value) || 587 })}
                    placeholder="587"
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Gmail Users:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Use smtp.gmail.com as SMTP host</li>
                  <li>• Use port 587</li>
                  <li>• Enable 2-factor authentication</li>
                  <li>• Generate an App Password for this application</li>
                  <li>• Use the App Password instead of your regular password</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Test Email */}
          {config.isEmailConfigured && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Email Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="testPassword">Email Password</Label>
                  <Input
                    id="testPassword"
                    type="password"
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                    placeholder="Your email password or app password"
                  />
                </div>
                <Button
                  onClick={handleTestEmail}
                  disabled={testing || !testPassword}
                  variant="outline"
                  className="w-full"
                >
                  {testing ? (
                    <>Testing...</>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4 mr-2" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailSettings;