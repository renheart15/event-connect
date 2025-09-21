import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Plus, 
  Users, 
  FileText, 
  QrCode,
  Monitor,
  Calendar,
  Eye,
  MapPin,
  Mail,
  Building2
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
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


export function AppSidebar({ user }: AppSidebarProps) {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';

  const isActive = (path: string) => currentPath === path;

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
        <div className="space-y-1">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">Organizer</h3>
          {organizerItems.map((item) => (
            <Link
              key={item.title}
              to={item.url}
              className={`w-full flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left ${
                isActive(item.url) 
                  ? `bg-${item.color.split('-')[1]}-50 dark:bg-${item.color.split('-')[1]}-900/20 border-l-3 border-${item.color.split('-')[1]}-500` 
                  : ''
              }`}
            >
              <div className={`w-8 h-8 bg-gradient-to-r ${item.color} rounded-md flex items-center justify-center mr-2 flex-shrink-0`}>
                <item.icon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
        
        <div className="space-y-1 mt-6">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">Events</h3>
          {eventItems.map((item) => (
            <Link
              key={item.title}
              to={item.url}
              className={`w-full flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors text-left ${
                isActive(item.url) 
                  ? `bg-${item.color.split('-')[1]}-50 dark:bg-${item.color.split('-')[1]}-900/20 border-l-3 border-${item.color.split('-')[1]}-500` 
                  : ''
              }`}
            >
              <div className={`w-8 h-8 bg-gradient-to-r ${item.color} rounded-md flex items-center justify-center mr-2 flex-shrink-0`}>
                <item.icon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
        
      </SidebarContent>

    </Sidebar>
  );
}