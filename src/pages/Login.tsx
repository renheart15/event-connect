import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { QrCode } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config';
import { Capacitor } from '@capacitor/core';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('participant');
  const [loading, setLoading] = useState(false);
  const [isNativeMobile, setIsNativeMobile] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pre-select role from URL parameter and detect platform
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    setIsNativeMobile(isNative);

    const roleFromUrl = searchParams.get('role');
    if (roleFromUrl === 'organizer' || roleFromUrl === 'participant') {
      setRole(roleFromUrl);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const loginUrl = `${API_CONFIG.API_BASE}/auth/login`;
      console.log('LOGIN DEBUG: Attempting login to:', loginUrl);
      console.log('LOGIN DEBUG: Email:', email);
      console.log('LOGIN DEBUG: API_CONFIG:', API_CONFIG);

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ email, password })
      });

      console.log('LOGIN DEBUG: Response status:', response.status);
      console.log('LOGIN DEBUG: Response ok:', response.ok);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      const { user, token } = data.data;

      if (user.role !== role) {
        toast({
          title: 'Role mismatch',
          description: `You are registered as ${user.role}, not ${role}.`,
          variant: 'destructive',
        });
        return;
      }

      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);

      toast({
        title: 'Login successful!',
        description: `Welcome back, ${user.name}!`,
      });

      // Check if we need to redirect to a specific page (e.g., invitation)
      const returnTo = searchParams.get('returnTo');
      const fromInvitation = searchParams.get('fromInvitation');
      
      if (returnTo && fromInvitation === 'true') {
        // User came from invitation link, redirect back to invitation
        navigate(decodeURIComponent(returnTo));
      } else {
        // Normal login, redirect based on role
        if (user.role === 'organizer') {
          navigate('/organizer-dashboard');
        } else {
          navigate('/participant-dashboard');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      toast({
        title: 'Login failed',
        description: err.message || 'Login failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="[&]:!bg-gradient-to-br [&]:!from-blue-50 [&]:!to-indigo-100 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" style={{colorScheme: 'light'}} data-theme="light">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <QrCode className="w-12 h-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to your EventConnect account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!isNativeMobile && (
              <div className="space-y-3">
                <Label>I am a:</Label>
                <RadioGroup value={role} onValueChange={setRole}>
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

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to={`/register?role=${role}`}
                className="text-blue-600 hover:underline"
              >
                Sign up
              </Link>
            </p>
            {!isNativeMobile && (
              <p className="text-xs text-gray-500">
                <Link to="/" className="text-blue-600 hover:underline">
                  ← Change role selection
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
