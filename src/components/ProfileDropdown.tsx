import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings, LogOut, Building2, Check } from 'lucide-react';
import Profile from './Profile';
import SettingsComponent from './Settings';
import { API_CONFIG } from '@/config';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  role?: string;
}

interface Organization {
  _id: string;
  name: string;
  description?: string;
  organizationCode: string;
  memberCount: number;
  createdAt: string;
}

interface ProfileDropdownProps {
  className?: string;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ className = '' }) => {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Routes that should not show the sidebar (public pages)
  const noSidebarRoutes = ['/', '/login', '/register', '/participant-dashboard'];
  const isPublicPage = noSidebarRoutes.includes(location.pathname);

  useEffect(() => {
    const loadUserData = () => {
      const userData = localStorage.getItem("user");
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);

          // Fetch organizations if user is an organizer
          if (parsedUser.role === 'organizer') {
            fetchOrganizations();
          }
        } catch (error) {
          console.error("Error parsing user data:", error);
        }
      }
    };

    // Load user data initially
    loadUserData();

    // Listen for localStorage changes (when profile is updated)
    const handleStorageChange = (e) => {
      if (e.key === 'user') {
        loadUserData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Custom event listener for same-tab localStorage changes
    const handleUserUpdate = () => {
      loadUserData();
    };

    window.addEventListener('userUpdated', handleUserUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, []);

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

        // Check if there's a selected organization in localStorage
        const savedOrgId = localStorage.getItem('selectedOrganizationId');
        const savedOrg = result.data.find((org: Organization) => org._id === savedOrgId);

        if (savedOrg) {
          setSelectedOrg(savedOrg);
        } else {
          // Default to first organization
          setSelectedOrg(result.data[0]);
          localStorage.setItem('selectedOrganizationId', result.data[0]._id);
        }
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const handleSelectOrganization = (org: Organization) => {
    setSelectedOrg(org);
    localStorage.setItem('selectedOrganizationId', org._id);
    toast({
      title: 'Organization Switched',
      description: `Now viewing: ${org.name}`,
    });
    // Reload page to refresh data for the selected organization
    window.location.reload();
  };

  const handleLogout = async () => {
    try {
      // Call logout API to destroy session
      const response = await fetch(`${API_CONFIG.API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Include cookies for session
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('Session destroyed successfully');
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local storage regardless of API call result
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      setUser(null);
      navigate("/login");
    }
  };

  const handleProfile = () => {
    setShowProfile(true);
  };

  const handleSettings = () => {
    setShowSettings(true);
  };

  // Don't render if no user is logged in
  if (!user) {
    return null;
  }


  // For embedded use in headers - no absolute positioning needed
  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
            <AvatarImage src={user.profilePicture} alt={user.name} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuItem onClick={handleProfile} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>

          {/* Organization Switcher - Only for organizers with organizations */}
          {user?.role === 'organizer' && organizations.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-gray-500">
                Switch Organization ({organizations.length})
              </DropdownMenuLabel>
              <div className="max-h-[300px] overflow-y-auto">
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org._id}
                    onClick={() => handleSelectOrganization(org)}
                    className={`flex items-start gap-3 p-3 cursor-pointer ${
                      selectedOrg?._id === org._id ? 'bg-blue-50 dark:bg-blue-950' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {selectedOrg?._id === org._id ? (
                        <Check className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Building2 className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {org.name}
                      </p>
                      {org.description && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {org.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {org.memberCount} {org.memberCount === 1 ? 'Member' : 'Members'}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {org.organizationCode}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem onClick={handleSettings} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Dialog */}
      <Profile isOpen={showProfile} onClose={() => setShowProfile(false)} />
      
      {/* Settings Dialog */}
      <SettingsComponent isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default ProfileDropdown;