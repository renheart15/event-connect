
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Participant {
  _id: string;
  participant: {
    _id: string;
    name: string;
    email: string;
  };
  checkInTime: string;
  checkOutTime?: string;
  status: 'checked-in' | 'checked-out' | 'absent';
  duration: number;
  invitation?: {
    _id: string;
    status: string;
  };
}

interface ParticipantReportsProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const ParticipantReports = ({ eventId, eventTitle, isOpen, onClose }: ParticipantReportsProps) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch participants data when component opens
  useEffect(() => {
    if (isOpen && eventId) {
      fetchParticipants();
    }
  }, [isOpen, eventId]);

  const fetchParticipants = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching attendance for eventId:', eventId);
      
      // Fetch both attendance logs and invitations
      const [attendanceResponse, invitationsResponse] = await Promise.all([
        fetch(`/api/attendance/event/${eventId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`/api/invitations/event/${eventId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      console.log('Attendance response status:', attendanceResponse.status);
      console.log('Invitations response status:', invitationsResponse.status);
      
      if (!attendanceResponse.ok) {
        const errorText = await attendanceResponse.text();
        console.error('Attendance error response:', errorText);
        throw new Error(`Failed to fetch attendance: ${attendanceResponse.status} - ${errorText}`);
      }

      const attendanceResult = await attendanceResponse.json();
      console.log('Attendance API Response:', attendanceResult);
      
      let invitationsResult = { success: false, data: { invitations: [] } };
      if (invitationsResponse.ok) {
        invitationsResult = await invitationsResponse.json();
        console.log('Invitations API Response:', invitationsResult);
      }
      
      if (attendanceResult.success) {
        const attendanceLogs = attendanceResult.data.attendanceLogs || [];
        console.log('Fetched attendance logs:', attendanceLogs);
        console.log('Number of attendance logs:', attendanceLogs.length);
        if (attendanceLogs.length > 0) {
          console.log('First attendance log structure:', JSON.stringify(attendanceLogs[0], null, 2));
        }
        setParticipants(attendanceLogs);
      } else {
        console.error('API returned unsuccessful response:', attendanceResult);
        throw new Error(attendanceResult.message || 'Failed to fetch participants');
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch participants');
      toast({
        title: "Error",
        description: "Failed to load participant data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredParticipants = participants.filter(participant => {
    if (!participant?.participant?.name || !participant?.participant?.email) {
      console.warn('Invalid participant data:', participant);
      return false;
    }
    return participant.participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           participant.participant.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleExportCSV = () => {
    const csvHeaders = ['Participant Name', 'Email', 'Status', 'Check-in Time', 'Check-out Time', 'Duration (minutes)', 'Participant ID', 'Event'];
    const csvData = participants
      .filter(p => p?.participant?.name && p?.participant?.email)
      .map(p => [
        p.participant.name,
        p.participant.email,
        p.status === 'checked-in' ? 'Currently Attending' :
        p.status === 'absent' ? 'Absent' :
        'Completed',
        new Date(p.checkInTime).toLocaleString(),
        p.checkOutTime ? new Date(p.checkOutTime).toLocaleString() : 'N/A',
        p.duration ? `${p.duration} minutes` : 'N/A',
        p.participant._id,
        eventTitle
      ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${eventTitle.replace(/\s+/g, '_')}_participant_report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Report Exported",
      description: "Participant report has been downloaded as CSV file.",
    });
  };

  const stats = {
    total: participants.length,
    checkedIn: participants.filter(p => p.status !== 'absent').length, // Only count non-absent participants
    currentlyPresent: participants.filter(p => p.status === 'checked-in').length,
    absent: participants.filter(p => p.status === 'absent').length
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Participant Reports - {eventTitle}
          </DialogTitle>
          <DialogDescription>
            View and export participant attendance data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : stats.total}
                  </p>
                  <p className="text-sm text-gray-600">Total Participants</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : stats.checkedIn}
                  </p>
                  <p className="text-sm text-gray-600">Checked In</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : stats.absent}
                  </p>
                  <p className="text-sm text-gray-600">Absent</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search participants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={fetchParticipants} 
                variant="outline" 
                className="flex items-center gap-2"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                onClick={handleExportCSV} 
                className="flex items-center gap-2"
                disabled={loading || participants.length === 0}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Participants Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading participant data...
                </div>
              ) : error ? (
                <div className="flex items-center justify-center p-8 text-red-600">
                  <p>Error: {error}</p>
                  <Button 
                    onClick={fetchParticipants} 
                    variant="outline" 
                    size="sm" 
                    className="ml-4"
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check-in Time</TableHead>
                      <TableHead>Check-out Time</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParticipants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center p-8 text-gray-500">
                          {participants.length === 0 ? (
                            <div>
                              <p className="mb-2">No attendance records found for this event.</p>
                              <p className="text-sm">Participants must check in to appear in reports.</p>
                            </div>
                          ) : (
                            `No participants found${searchTerm && ` matching "${searchTerm}"`}`
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredParticipants.map((participant) => (
                        <TableRow key={participant._id}>
                          <TableCell className="font-medium">
                            {participant?.participant?.name || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            {participant?.participant?.email || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              participant.status === 'checked-in' ? "default" :
                              participant.status === 'absent' ? "destructive" :
                              "secondary"
                            }>
                              {participant.status === 'checked-in' ? "Currently Attending" :
                               participant.status === 'absent' ? "Absent" :
                               "Completed"}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(participant.checkInTime).toLocaleString()}</TableCell>
                          <TableCell>
                            {participant.checkOutTime ? new Date(participant.checkOutTime).toLocaleString() : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {participant.duration ? `${participant.duration} min` : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ParticipantReports;
