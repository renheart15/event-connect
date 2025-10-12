import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Users, 
  ArrowLeft, 
  Building2, 
  Copy, 
  CheckCircle, 
  Settings,
  UserPlus,
  Crown,
  Shield,
  User,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config';

interface Organization {
  _id: string;
  name: string;
  description?: string;
  organizationCode: string;
  owner: {
    _id: string;
    name: string;
    email: string;
  };
  members: Array<{
    user: {
      _id: string;
      name: string;
      email: string;
    };
    role: 'member' | 'admin';
    joinedAt: string;
  }>;
  memberCount: number;
  settings: {
    allowPublicJoin: boolean;
    requireApproval: boolean;
  };
  createdAt: string;
}

const OrganizationManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [myOrganization, setMyOrganization] = useState<Organization | null>(null);
  const [joinedOrganizations, setJoinedOrganizations] = useState<Organization[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [joiningOrganization, setJoiningOrganization] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState<Record<string, boolean>>({});
  const [joinOrgCode, setJoinOrgCode] = useState('');
  const [leavingOrganization, setLeavingOrganization] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    organizationCode: ''
  });

  useEffect(() => {
    // Load user from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === 'organizer') {
        fetchOrganizations();
        fetchMyOrganization(); // Also fetch joined organizations
      } else {
        fetchMyOrganization();
      }
    }
  }, [user]);

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
      if (result.success) {
        setOrganizations(result.data);
        if (result.data.length > 0) {
          setSelectedOrg(result.data[0]); // Select first organization by default
        } else {
          setShowCreateForm(true); // Show create form if no organizations
        }
      } else {
        // If no organizations found, show create form
        setShowCreateForm(true);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      setShowCreateForm(true); // Show create form on error
    } finally {
      setLoading(false);
    }
  };

  const fetchMyOrganization = async () => {
    try {
      if (user?.role === 'participant') {
        setLoading(true);
      }
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_CONFIG.API_BASE}/organizations/my`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        if (user?.role === 'organizer') {
          // For organizers, check if this is an organization they joined (not owned)
          const isOwned = result.data.owner._id === user._id;
          if (!isOwned) {
            // This is an organization they joined, add to joined list
            setJoinedOrganizations(prev => {
              const isAlreadyInJoined = prev.some(org => org._id === result.data._id);
              if (!isAlreadyInJoined) {
                return [result.data];
              }
              return prev;
            });
          }
        } else {
          // For participants
          setMyOrganization(result.data);
          setSelectedOrg(result.data);
        }
      } else {
        if (user?.role === 'participant') {
          // Participant has no organization
          setMyOrganization(null);
          setShowJoinForm(true);
        }
        // For organizers, clear joined organizations if none found
        if (user?.role === 'organizer') {
          setJoinedOrganizations([]);
        }
      }
    } catch (error) {
      console.error('Error fetching my organization:', error);
      if (user?.role === 'participant') {
        setShowJoinForm(true);
      }
    } finally {
      if (user?.role === 'participant') {
        setLoading(false);
      }
    }
  };


  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, organizationCode: code }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Organization name is required.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.organizationCode.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Organization code is required.',
        variant: 'destructive',
      });
      return;
    }
    
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const isUpdate = !!selectedOrg;
      
      const response = await fetch(
        `${API_CONFIG.API_BASE}/organizations${isUpdate ? '/my' : ''}`,
        {
          method: isUpdate ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        }
      );
      
      const result = await response.json();

      if (result.success) {
        if (isUpdate) {
          setSelectedOrg(result.data);
          // Update the organization in the list
          setOrganizations(prev => prev.map(org => 
            org._id === result.data._id ? result.data : org
          ));
        } else {
          // Add new organization to the list
          setOrganizations(prev => [...prev, result.data]);
          setSelectedOrg(result.data);
          setShowCreateForm(false);
          // Clear form
          setFormData({ name: '', description: '', organizationCode: '' });
        }
        
        toast({
          title: isUpdate ? 'Organization Updated' : 'Organization Created',
          description: `Your organization "${result.data.name}" has been ${isUpdate ? 'updated' : 'created'} successfully.`,
        });
        
        // Refresh the organizations list
        fetchOrganizations();
      } else {
        toast({
          title: 'Error',
          description: result.message || `Failed to ${isUpdate ? 'update' : 'create'} organization.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Organization submit error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save organization. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCodes(prev => ({ ...prev, [text]: true }));
      toast({
        title: 'Copied!',
        description: 'Organization code copied to clipboard.',
      });
      setTimeout(() => {
        setCopiedCodes(prev => ({ ...prev, [text]: false }));
      }, 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const getRoleIcon = (role: string, isOwner: boolean = false) => {
    if (isOwner) return <Crown className="w-4 h-4 text-yellow-600" />;
    if (role === 'admin') return <Shield className="w-4 h-4 text-blue-600" />;
    return <User className="w-4 h-4 text-gray-500" />;
  };

  const getRoleLabel = (role: string, isOwner: boolean = false) => {
    if (isOwner) return 'Owner';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const handleJoinOrganization = async () => {
    if (!joinOrgCode.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter an organization code.',
        variant: 'destructive',
      });
      return;
    }

    setJoiningOrganization(true);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_CONFIG.API_BASE}/organizations/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ organizationCode: joinOrgCode.trim() })
      });
      
      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Successfully Joined!',
          description: `You have joined ${result.data.organization.name}.`,
        });
        
        setJoinOrgCode('');
        setShowJoinForm(false);
        
        // Refresh organization data
        fetchMyOrganization();
        if (user?.role === 'organizer') {
          fetchOrganizations();
        }
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to join organization.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Join organization error:', error);
      toast({
        title: 'Error',
        description: 'Failed to join organization. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setJoiningOrganization(false);
    }
  };

  const handleLeaveOrganization = async () => {
    if (!myOrganization) return;

    setLeavingOrganization(true);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_CONFIG.API_BASE}/organizations/leave`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Left Organization',
          description: `You have left ${myOrganization.name}.`,
        });
        
        setMyOrganization(null);
        setSelectedOrg(null);
        setShowJoinForm(true);
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to leave organization.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Leave organization error:', error);
      toast({
        title: 'Error',
        description: 'Failed to leave organization. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLeavingOrganization(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading organization...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(user?.role === 'organizer' ? '/organizer-dashboard' : '/participant-dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <Building2 className="w-8 h-8 text-blue-600" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Organization Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {user?.role === 'organizer' 
                ? 'Create and manage your organizations'
                : 'View and manage your organization membership'
              }
            </p>
          </div>
          {user?.role === 'organizer' && (
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowCreateForm(true);
                  setSelectedOrg(null);
                  setFormData({ name: '', description: '', organizationCode: '' });
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Organization
              </Button>
              <Button
                onClick={() => setShowJoinForm(true)}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Join Organization
              </Button>
            </div>
          )}
          {user?.role === 'participant' && !myOrganization && (
            <Button
              onClick={() => setShowJoinForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Join Organization
            </Button>
          )}
        </div>

        <div className="space-y-8">

          {/* Joined Organizations - For Organizers */}
          {user?.role === 'organizer' && joinedOrganizations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Organizations You've Joined ({joinedOrganizations.length})
                </CardTitle>
                <CardDescription>
                  Organizations where you are a member or admin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Your Role</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {joinedOrganizations.map((org) => {
                        const userMember = org.members.find(member => member.user._id === user._id);
                        const isOwner = org.owner._id === user._id;
                        const userRole = isOwner ? 'owner' : userMember?.role || 'member';

                        return (
                          <TableRow key={org._id}>
                            <TableCell className="font-medium">
                              <div>
                                <div className="font-semibold">{org.name}</div>
                                {org.description && (
                                  <div className="text-sm text-gray-500 mt-1">
                                    {org.description}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">
                                  {org.organizationCode}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(org.organizationCode)}
                                  className="h-6 w-6 p-0"
                                >
                                  {copiedCodes[org.organizationCode] ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getRoleIcon(userRole, isOwner)}
                                <Badge
                                  variant={isOwner ? 'default' : userRole === 'admin' ? 'default' : 'secondary'}
                                  className={isOwner ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : userRole === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : ''}
                                >
                                  {getRoleLabel(userRole, isOwner)}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {org.memberCount} {org.memberCount === 1 ? 'Member' : 'Members'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrg(org);
                                  setShowCreateForm(false);
                                }}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Organization Form - For Organizers */}
          {user?.role === 'organizer' && (showCreateForm || (selectedOrg && !myOrganization)) && (
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Organization Details
              </CardTitle>
              <CardDescription>
                {selectedOrg 
                  ? 'Update your organization information'
                  : 'Create your organization with a unique join code'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter organization name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">Organization Code</Label>
                    <div className="flex gap-2">
                      <Input
                        id="code"
                        type="text"
                        placeholder="6-10 characters"
                        value={formData.organizationCode}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          organizationCode: e.target.value.toUpperCase()
                        }))}
                        maxLength={10}
                        required
                      />
                      <Button
                        type="button"
                        onClick={generateRandomCode}
                        variant="outline"
                        className="whitespace-nowrap"
                      >
                        Auto Generate
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Enter a unique 6-10 character code or click "Auto Generate"
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of your organization"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {selectedOrg ? 'Updating...' : 'Creating...'}
                    </div>
                  ) : (
                    selectedOrg ? 'Update Organization' : 'Create Organization'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          )}

          {/* Participant Leave Organization */}
          {user?.role === 'participant' && myOrganization && (
            <Card className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="text-red-900 dark:text-red-100 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Leave Organization
                </CardTitle>
                <CardDescription className="text-red-700 dark:text-red-300">
                  You can leave your current organization if needed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-1">
                      Currently a member of: <strong>{myOrganization.name}</strong>
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      This action cannot be undone. You'll need a new code to rejoin.
                    </p>
                  </div>
                  <Button
                    onClick={handleLeaveOrganization}
                    disabled={leavingOrganization}
                    variant="destructive"
                    size="sm"
                  >
                    {leavingOrganization ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Leaving...
                      </div>
                    ) : (
                      'Leave Organization'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Organization Info (shown after creation) */}
          {selectedOrg && (
            <>
              {/* Organization Code Card */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Join Code
                  </CardTitle>
                  <CardDescription className="text-blue-700 dark:text-blue-300">
                    Share this code with participants to let them join your organization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Organization Code</p>
                      <p className="text-2xl font-mono font-bold text-blue-800 dark:text-blue-200">
                        {selectedOrg.organizationCode}
                      </p>
                    </div>
                    <Button
                      onClick={() => copyToClipboard(selectedOrg.organizationCode)}
                      variant="outline"
                      className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-200"
                    >
                      {copiedCodes[selectedOrg.organizationCode] ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Members List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Members ({selectedOrg.memberCount})
                    </div>
                    <Badge variant="secondary">
                      {selectedOrg.memberCount} {selectedOrg.memberCount === 1 ? 'Member' : 'Members'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Manage your organization members and their roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Owner */}
                      <TableRow>
                        <TableCell className="font-medium flex items-center gap-2">
                          {getRoleIcon('owner', true)}
                          {selectedOrg.owner.name}
                        </TableCell>
                        <TableCell>{selectedOrg.owner.email}</TableCell>
                        <TableCell>
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Owner
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(selectedOrg.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>

                      {/* Members */}
                      {selectedOrg.members.map((member) => (
                        <TableRow key={member.user._id}>
                          <TableCell className="font-medium flex items-center gap-2">
                            {getRoleIcon(member.role)}
                            {member.user.name}
                          </TableCell>
                          <TableCell>{member.user.email}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={member.role === 'admin' ? 'default' : 'secondary'}
                              className={member.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : ''}
                            >
                              {getRoleLabel(member.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(member.joinedAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}

                      {selectedOrg.memberCount === 1 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                            No additional members yet. Share your organization code to invite participants!
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

            </>
          )}
        </div>
      </div>

      {/* Join Organization Modal */}
      <Dialog open={showJoinForm} onOpenChange={setShowJoinForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Join Organization
            </DialogTitle>
            <DialogDescription>
              {user?.role === 'organizer' 
                ? 'Enter an organization code to join as an admin or member'
                : myOrganization 
                  ? 'You can only be a member of one organization. Joining a new one will leave your current organization.'
                  : 'Enter an organization code to join'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {user?.role === 'participant' && myOrganization && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800 p-3">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  ⚠️ You are currently a member of <strong>{myOrganization.name}</strong>. 
                  Joining a new organization will automatically remove you from your current one.
                </p>
              </div>
            )}
            {user?.role === 'organizer' && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 p-3">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  ℹ️ As an organizer, you can join multiple organizations. 
                  Your role in each organization will depend on the organization's settings.
                </p>
              </div>
            )}
            
            <div>
              <Label htmlFor="modalOrgCode" className="text-sm font-medium">
                Organization Code
              </Label>
              <Input
                id="modalOrgCode"
                type="text"
                placeholder="Enter organization code"
                value={joinOrgCode}
                onChange={(e) => setJoinOrgCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinOrganization()}
                maxLength={10}
                disabled={joiningOrganization}
                className="mt-1"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleJoinOrganization}
                disabled={joiningOrganization || !joinOrgCode.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {joiningOrganization ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Joining...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Join
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowJoinForm(false);
                  setJoinOrgCode('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizationManagement;