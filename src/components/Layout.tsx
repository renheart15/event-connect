import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar';

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
        <header className="flex h-16 shrink-0 items-center gap-2 px-4 border-b">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 ml-14">
            <h1 className="text-lg font-semibold">Event Connect</h1>
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