import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Plus, 
  Users, 
  FileText, 
  Settings, 
  User,
  QrCode,
  Monitor,
  LogOut,
  Calendar,
  Eye,
  MapPin,
  Mail,
  Building2
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

interface AppSidebarProps {
  user?: any;
}

const organizerItems = [
  {
    title: 'Dashboard',
    url: '/organizer-dashboard',
    icon: LayoutDashboard,
    color: 'from-blue-500 to-blue-600',
    description: 'Overview and analytics'
  },
  {
    title: 'Organization',
    url: '/organization',
    icon: Building2,
    color: 'from-cyan-500 to-cyan-600',
    description: 'Manage organization'
  },
  {
    title: 'Create Event',
    url: '/create-event',
    icon: Plus,
    color: 'from-green-500 to-green-600',
    description: 'Add new events'
  },
  {
    title: 'Invitations',
    url: '/invitations',
    icon: Mail,
    color: 'from-orange-500 to-orange-600',
    description: 'Manage invitations'
  },
];

const eventItems = [
  {
    title: 'All Events',
    url: '/all-events',
    icon: Calendar,
    color: 'from-purple-500 to-purple-600',
    description: 'View all events'
  },
  {
    title: 'Event Monitor',
    url: '/event-monitor',
    icon: Monitor,
    color: 'from-indigo-500 to-indigo-600',
    description: 'Real-time monitoring'
  },
];

const commonItems = [
  {
    title: 'Profile',
    url: '/profile',
    icon: User,
    color: 'from-blue-500 to-blue-600',
    description: 'View and edit profile'
  },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
    color: 'from-purple-500 to-purple-600',
    description: 'App preferences'
  },
];

export function AppSidebar({ user }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';

  const isActive = (path: string) => currentPath === path;

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <Link to="/organizer-dashboard" className="flex items-center gap-2">
          <QrCode className="w-8 h-8 text-primary" />
          <span className="text-xl font-bold text-foreground group-data-[collapsible=icon]:hidden">
            EventConnect
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="p-4">
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">Organizer</h3>
          {organizerItems.map((item) => (
            <Link
              key={item.title}
              to={item.url}
              className={`w-full flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-left ${
                isActive(item.url) 
                  ? `bg-${item.color.split('-')[1]}-50 dark:bg-${item.color.split('-')[1]}-900/20 border-l-4 border-${item.color.split('-')[1]}-500` 
                  : ''
              }`}
            >
              <div className={`w-10 h-10 bg-gradient-to-r ${item.color} rounded-lg flex items-center justify-center mr-3 flex-shrink-0`}>
                <item.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
        
        <div className="space-y-2 mt-6">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">Events</h3>
          {eventItems.map((item) => (
            <Link
              key={item.title}
              to={item.url}
              className={`w-full flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-left ${
                isActive(item.url) 
                  ? `bg-${item.color.split('-')[1]}-50 dark:bg-${item.color.split('-')[1]}-900/20 border-l-4 border-${item.color.split('-')[1]}-500` 
                  : ''
              }`}
            >
              <div className={`w-10 h-10 bg-gradient-to-r ${item.color} rounded-lg flex items-center justify-center mr-3 flex-shrink-0`}>
                <item.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
        
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">Account</h3>
          {commonItems.map((item) => (
            <Link
              key={item.title}
              to={item.url}
              className={`w-full flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-left ${
                isActive(item.url) 
                  ? `bg-${item.color.split('-')[1]}-50 dark:bg-${item.color.split('-')[1]}-900/20 border-l-4 border-${item.color.split('-')[1]}-500` 
                  : ''
              }`}
            >
              <div className={`w-10 h-10 bg-gradient-to-r ${item.color} rounded-lg flex items-center justify-center mr-3 flex-shrink-0`}>
                <item.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
              </div>
            </Link>
          ))}
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
          >
            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
              <LogOut className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Logout</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Sign out of your account</p>
            </div>
          </button>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-gray-200 dark:border-gray-700">
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {user.name || user.email}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Organizer</div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}