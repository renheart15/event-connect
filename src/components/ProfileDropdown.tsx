import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings, LogOut } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
}

interface ProfileDropdownProps {
  className?: string;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ className = '' }) => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Routes that should not show the sidebar (public pages)
  const noSidebarRoutes = ['/', '/login', '/register', '/participant-dashboard'];
  const isPublicPage = noSidebarRoutes.includes(location.pathname);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  const handleProfile = () => {
    // Navigate to profile page (you may need to create this route)
    console.log("Navigate to profile");
  };

  const handleSettings = () => {
    // Navigate to settings page (you may need to create this route)
    console.log("Navigate to settings");
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
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleProfile} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
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
    </div>
  );
};

export default ProfileDropdown;