// src/pages/Register.tsx

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config';

const Register = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'participant' | 'organizer'>('participant');
  const [organizationCode, setOrganizationCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Add safety checks for navigation
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Add error boundary state
  const [hasError, setHasError] = useState(false);
  const [isInvitationFlow, setIsInvitationFlow] = useState(false);

  // Pre-fill form data from URL parameters (for invitation flow)
  useEffect(() => {
    try {
      const roleFromUrl = searchParams.get('role');
      if (roleFromUrl === 'organizer' || roleFromUrl === 'participant') {
        setRole(roleFromUrl as 'participant' | 'organizer');
      }

      // Pre-fill email and name from invitation
      const emailFromUrl = searchParams.get('email');
      const nameFromUrl = searchParams.get('name');
      const invitationCode = searchParams.get('invitationCode');

      if (emailFromUrl) {
        setEmail(decodeURIComponent(emailFromUrl));
      }
      if (nameFromUrl) {
        // Split the name into first and last name
        const fullName = decodeURIComponent(nameFromUrl);
        const nameParts = fullName.split(' ');
        if (nameParts.length > 0) {
          setFirstName(nameParts[0]);
          if (nameParts.length > 1) {
            setLastName(nameParts.slice(1).join(' '));
          }
        }
      }

      // If coming from invitation, force participant role and set invitation flow
      if (invitationCode) {
        setRole('participant');
        setIsInvitationFlow(true);
      }
    } catch (error) {
      console.error('Error setting form data from URL:', error);
      setHasError(true);
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic client-side validation
    if (password !== confirmPassword) {
      return toast({
        title: "Passwords don't match",
        description: 'Please make sure both passwords are identical.',
        variant: 'destructive',
      });
    }

    // Combine first name and last name
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    if (!fullName) {
      return toast({
        title: "Name is required",
        description: 'Please enter your first and last name.',
        variant: 'destructive',
      });
    }

    setLoading(true);
    try {
      console.log('Attempting registration with:', { name: fullName, email, role });

      // POST to your backend using fetch
      const response = await fetch(`${API_CONFIG.API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fullName,
          email,
          password,
          role,
          organizationCode: organizationCode.trim() || undefined
        })
      });

      const data = await response.json();
      console.log('Registration response:', data);

      // Check if response has the expected structure
      if (!data || !data.success) {
        throw new Error(data?.message || 'Registration failed - invalid response');
      }

      const { user, token } = data.data;

      if (!user || !token) {
        throw new Error('Registration failed - missing user data or token');
      }

      // Save user + token for authenticated requests
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);

      const orgInfo = data.data.organization;
      const toastDescription = orgInfo 
        ? `Welcome, ${user.name}! You've joined ${orgInfo.name} as ${orgInfo.role === 'admin' ? 'an admin' : 'a member'}.`
        : `Welcome, ${user.name}!`;

      toast({
        title: 'Registration Successful',
        description: toastDescription,
      });

      // Check if we need to return to invitation
      const returnTo = searchParams.get('returnTo');
      const invitationCode = searchParams.get('invitationCode');

      if (invitationCode && returnTo) {
        // Mark the temporary account as no longer temporary
        try {
          await fetch(`${API_CONFIG.API_BASE}/auth/activate-account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ invitationCode })
          });
        } catch (error) {
          console.error('Error activating account:', error);
        }

        // Redirect back to the invitation page
        navigate(decodeURIComponent(returnTo));
      } else if (returnTo) {
        // Redirect to the requested page
        navigate(decodeURIComponent(returnTo));
      } else {
        // Normal registration flow - redirect based on role
        if (role === 'organizer') {
          navigate('/organizer-dashboard');
        } else {
          navigate('/participant-dashboard');
        }
      }
    } catch (err: any) {
      console.error('Register error:', err);
      
      let errorMessage = 'Registration failed. Please try again.';
      
      if (err.message) {
        errorMessage = err.message;
      }

      toast({
        title: 'Registration Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };


  // Error boundary fallback
  if (hasError) {
    return (
      <div className="[&]:!bg-gradient-to-br [&]:!from-blue-50 [&]:!to-indigo-100 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" style={{colorScheme: 'light'}} data-theme="light">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
              <p className="text-gray-600 mb-4">Please try refreshing the page or go back to the home screen.</p>
              <Link to="/">
                <Button>Go Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="[&]:!bg-gradient-to-br [&]:!from-blue-50 [&]:!to-indigo-100 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" style={{colorScheme: 'light'}} data-theme="light">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {isInvitationFlow ? 'Complete Your Registration' : 'Create Your Account'}
          </CardTitle>
          <CardDescription>
            {isInvitationFlow 
              ? 'Finish setting up your account to respond to the invitation' 
              : 'Sign up for EventConnect'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={isInvitationFlow}
                className={isInvitationFlow ? "bg-gray-100" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {!isInvitationFlow && (
              <div className="space-y-2">
                <Label>I am a:</Label>
                <RadioGroup value={role} onValueChange={(val) => setRole(val as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="participant" id="participant" />
                    <Label htmlFor="participant">Participant</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="organizer" id="organizer" />
                    <Label htmlFor="organizer">Event Organizer</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {!isInvitationFlow && (
              <div className="space-y-2">
                <Label htmlFor="organization-code">Organization Code (Optional)</Label>
                <Input
                  id="organization-code"
                  type="text"
                  placeholder="Enter organization code to join"
                  value={organizationCode}
                  onChange={(e) => setOrganizationCode(e.target.value.toUpperCase())}
                  maxLength={10}
                />
                <p className="text-xs text-gray-500">
                  {role === 'participant' 
                    ? 'If your organization provided you with a code, enter it here to join automatically.'
                    : 'Enter an organization code to join as an admin/organizer, or leave blank to create your own organizations later.'
                  }
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link 
                to={`/login?role=${role}`} 
                className="text-blue-600 hover:underline"
              >
                Sign in
              </Link>
            </p>
            <p className="text-xs text-gray-500">
              <Link to="/" className="text-blue-600 hover:underline">
                ← Change role selection
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
