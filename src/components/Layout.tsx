import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar';
import ProfileDropdown from './ProfileDropdown';
import { Bell } from 'lucide-react';
import { Button } from './ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const location = useLocation();
  
  // Routes that should not show the sidebar
  const noSidebarRoutes = ['/', '/login', '/register', '/participant-dashboard'];
  const showSidebar = !noSidebarRoutes.includes(location.pathname);

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
            <Button variant="ghost" size="sm" className="relative p-2" title="Notifications">
              <Bell className="h-5 w-5" />
              {/* Optional notification badge */}
              {/* <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span> */}
            </Button>
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