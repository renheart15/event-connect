
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    positive: boolean;
  };
  icon: React.ReactNode;
  iconColor: string;
}

const StatCard = ({ title, value, change, icon, iconColor }: StatCardProps) => {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-background to-muted/20 hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline space-x-2">
              <h3 className="text-2xl font-bold text-foreground">{value}</h3>
              {change && (
                <Badge 
                  variant={change.positive ? "default" : "secondary"}
                  className={`text-xs ${change.positive ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}`}
                >
                  {change.positive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {change.value}
                </Badge>
              )}
            </div>
          </div>
          <div className={`p-3 rounded-xl ${iconColor} bg-opacity-10`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface DashboardStatsProps {
  stats: {
    totalEvents: number;
    activeEvents: number;
    totalParticipants: number;
    currentlyPresent: number;
  };
}

const DashboardStats = ({ stats }: DashboardStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Events"
        value={stats.totalEvents}
        change={{ value: "+12%", positive: true }}
        icon={<div className="w-6 h-6 bg-blue-500 rounded-lg"></div>}
        iconColor="bg-blue-500"
      />
      <StatCard
        title="Active Events"
        value={stats.activeEvents}
        change={{ value: "+5%", positive: true }}
        icon={<div className="w-6 h-6 bg-green-500 rounded-lg"></div>}
        iconColor="bg-green-500"
      />
      <StatCard
        title="Total Participants"
        value={stats.totalParticipants}
        change={{ value: "+18%", positive: true }}
        icon={<div className="w-6 h-6 bg-purple-500 rounded-lg"></div>}
        iconColor="bg-purple-500"
      />
      <StatCard
        title="Currently Present"
        value={stats.currentlyPresent}
        change={{ value: "-2%", positive: false }}
        icon={<div className="w-6 h-6 bg-orange-500 rounded-lg"></div>}
        iconColor="bg-orange-500"
      />
    </div>
  );
};

export default DashboardStats;
