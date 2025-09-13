import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar';
import { Button } from './ui/button';
import ProfileDropdown from './ProfileDropdown';
import NotificationDropdown from './NotificationDropdown';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const location = useLocation();

  // Routes that should not show the sidebar
  const noSidebarRoutes = ['/', '/login', '/register', '/participant-dashboard'];
  const showSidebar = !noSidebarRoutes.includes(location.pathname) && !location.pathname.startsWith('/join/');

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    // Load user from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  if (!showSidebar) {
    // Return children without sidebar for public pages
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="min-h-screen">
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b justify-between">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-2 ml-2">
              <h1 className="text-lg font-semibold">Event Connect</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="rounded-lg"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <NotificationDropdown />
            <ProfileDropdown />
          </div>
        </header>
        <main className="flex-1 min-h-[calc(100vh-4rem)] overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;