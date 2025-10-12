import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { API_CONFIG } from '@/config';
import { useToast } from '@/hooks/use-toast';

interface Organization {
  _id: string;
  name: string;
  description?: string;
  organizationCode: string;
  memberCount: number;
  createdAt: string;
}

const OrganizationSwitcher = () => {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
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

  if (loading || organizations.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Building2 className="w-4 h-4" />
          <span className="font-medium truncate max-w-[150px]">
            {selectedOrg?.name || 'Select Organization'}
          </span>
          <ChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="font-semibold">
          Switch Organization ({organizations.length})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org._id}
              onClick={() => handleSelectOrganization(org)}
              className={`flex items-start gap-3 p-3 cursor-pointer ${
                selectedOrg?._id === org._id ? 'bg-blue-50 dark:bg-blue-950' : ''
              }`}
            >
              <div className="flex-shrink-0 mt-1">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default OrganizationSwitcher;
