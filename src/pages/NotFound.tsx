import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
      "Search:", location.search,
      "Hash:", location.hash
    );
  }, [location]);

  const handleGoHome = () => {
    if (user?.role === 'organizer') {
      navigate('/organizer-dashboard');
    } else if (user?.role === 'participant') {
      navigate('/participant-dashboard');
    } else {
      navigate('/');
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Page Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-6 text-left">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Debug Info:
              </h3>
              <p className="text-xs text-red-700 dark:text-red-300 font-mono">
                Path: {location.pathname}
                {location.search && <><br />Query: {location.search}</>}
                {location.hash && <><br />Hash: {location.hash}</>}
              </p>
            </div>
          )}
        </div>
        
        <div className="space-y-3">
          <Button 
            onClick={handleGoHome} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {user?.role === 'organizer' ? 'Go to Organizer Dashboard' : 
             user?.role === 'participant' ? 'Go to Participant Dashboard' : 
             'Go to Home'}
          </Button>
          
          <Button 
            onClick={handleGoBack} 
            variant="outline" 
            className="w-full"
          >
            Go Back
          </Button>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => navigate('/login')} 
              variant="ghost" 
              size="sm" 
              className="flex-1"
            >
              Login
            </Button>
            <Button 
              onClick={() => navigate('/register')} 
              variant="ghost" 
              size="sm" 
              className="flex-1"
            >
              Register
            </Button>
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help? Contact support or try refreshing the page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
