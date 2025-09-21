import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'organizer' | 'participant';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!userData || !token) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to access this page.',
        variant: 'destructive',
      });
      navigate('/', { replace: true });
      return;
    }

    try {
      const user = JSON.parse(userData);
      
      if (requiredRole && user.role !== requiredRole) {
        toast({
          title: 'Access Denied',
          description: `This page is only accessible to ${requiredRole}s.`,
          variant: 'destructive',
        });
        navigate('/', { replace: true });
        return;
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      toast({
        title: 'Session Error',
        description: 'Your session is invalid. Please log in again.',
        variant: 'destructive',
      });
      navigate('/', { replace: true });
    }
  }, [navigate, requiredRole]);

  return <>{children}</>;
};

export default ProtectedRoute;