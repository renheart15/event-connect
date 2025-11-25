
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ExcelJS from 'exceljs';

interface Participant {
  _id: string;
  participant: {
    _id: string;
    name: string;
    email: string;
  };
  checkInTime: string;
  checkOutTime?: string;
  status: 'checked-in' | 'checked-out' | 'absent' | 'registered';
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
  const [eventData, setEventData] = useState<any>(null);

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
        const event = attendanceResult.data.event || null;
        console.log('Fetched attendance logs:', attendanceLogs);
        console.log('Number of attendance logs:', attendanceLogs.length);
        console.log('Event data:', event);
        if (attendanceLogs.length > 0) {
          console.log('First attendance log structure:', JSON.stringify(attendanceLogs[0], null, 2));
        }
        setParticipants(attendanceLogs);
        setEventData(event);
        console.log('[EVENT-DATA] Event data set:', {
          title: event?.title,
          date: event?.date,
          startTime: event?.startTime,
          endTime: event?.endTime,
          status: event?.status
        });
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

  // Helper function to determine if check-in was late or on time
  const getCheckInStatus = (participant: Participant) => {
    console.log(`[STATUS-CHECK] Participant ${participant.participant?.name}: status=${participant.status}, checkInTime=${!!participant.checkInTime}, checkOutTime=${!!participant.checkOutTime}`);

    // CRITICAL FIX: Check for absent status first
    if (participant.status === 'absent') {
      console.log(`[STATUS-CHECK] ${participant.participant?.name}: Marked as Absent (status=absent)`);
      return 'Absent';
    }

    // CRITICAL FIX: For UPCOMING events, registered participants are NOT absent (they're waiting for event to start)
    if (eventData?.status === 'upcoming' && participant.status === 'registered' && !participant.checkInTime) {
      console.log(`[STATUS-CHECK] ${participant.participant?.name}: Marked as Registered (upcoming event, waiting to check in)`);
      return 'Registered';
    }

    // CRITICAL FIX: For active/completed events, if participant is registered but never checked in, they are absent
    if (participant.status === 'registered' && !participant.checkInTime) {
      console.log(`[STATUS-CHECK] ${participant.participant?.name}: Marked as Absent (registered, no check-in)`);
      return 'Absent';
    }

    // CRITICAL FIX: If no checkInTime exists (for any reason), mark as Absent
    if (!participant.checkInTime) {
      console.log(`[STATUS-CHECK] ${participant.participant?.name}: Marked as Absent (no checkInTime)`);
      return 'Absent';
    }

    // CRITICAL FIX: Check if participant left early (before event ended)
    // If they checked out before the event end time, consider them Absent
    if (participant.checkOutTime && eventData?.endTime && eventData?.date) {
      try {
        const eventDateStr = typeof eventData.date === 'string'
          ? eventData.date.split('T')[0]
          : new Date(eventData.date).toISOString().split('T')[0];
        const eventEndDateTime = new Date(`${eventDateStr}T${eventData.endTime}`);
        const checkOutDateTime = new Date(participant.checkOutTime);

        // If checked out before event ended, they left early = Absent
        if (checkOutDateTime < eventEndDateTime) {
          console.log(`[STATUS-CHECK] ${participant.participant?.name}: Marked as Absent (left early)`);
          return 'Absent';
        }
      } catch (error) {
        console.error('[STATUS-CHECK] Error checking left early status:', error);
      }
    }

    // If we can't get event start time, but they did check in, default to On Time
    if (!eventData || !eventData.date || !eventData.startTime) {
      return 'On Time';
    }

    try {
      // Combine event date and start time
      const eventStartDateTime = new Date(`${eventData.date}T${eventData.startTime}`);
      const checkInDateTime = new Date(participant.checkInTime);

      // If checked in after event start time, they're late
      if (checkInDateTime > eventStartDateTime) {
        return 'Late';
      } else {
        return 'On Time';
      }
    } catch (error) {
      console.error('Error calculating check-in status:', error);
      return 'On Time';
    }
  };

  // Format date/time as: MM/DD/YYYY, HH:MM:SS AM/PM (reusable function)
  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'N/A';
    }
  };

  // Format duration between check-in and check-out times
  const formatDuration = (checkIn: string, checkOut?: string) => {
    if (!checkIn) return 'N/A';
    const startTime = new Date(checkIn);
    const endTime = checkOut ? new Date(checkOut) : new Date();
    const diffMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const filteredParticipants = participants.filter(participant => {
    if (!participant?.participant?.name || !participant?.participant?.email) {
      console.warn('Invalid participant data:', participant);
      return false;
    }
    return participant.participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           participant.participant.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleExportCSV = async () => {
    // Format time only (HH:MM:SS AM/PM)
    const formatTimeOnly = (dateString: string) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      } catch (error) {
        return 'N/A';
      }
    };

    // Get event date from the first participant or eventData
    const eventDate = eventData?.date ? new Date(eventData.date).toLocaleDateString('en-US') :
                      participants[0]?.checkInTime ? new Date(participants[0].checkInTime).toLocaleDateString('en-US') :
                      new Date().toLocaleDateString('en-US');

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Participant Report');

    // Set column widths
    worksheet.columns = [
      { width: 20 }, // Participant Name
      { width: 30 }, // Email
      { width: 20 }, // Check-in Time
      { width: 20 }, // Check-out Time
      { width: 15 }, // Duration
      { width: 15 }  // Status
    ];

    // Row 1: Event title (merged A1:F1)
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = eventTitle;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2: Date
    const dateCell = worksheet.getCell('A2');
    dateCell.value = `Date: ${eventDate}`;

    // Row 3: Empty row

    // Row 4: Headers
    const headerRow = worksheet.getRow(4);
    headerRow.values = ['Participant Name', 'Email', 'Check-in Time', 'Check-out Time', 'Duration', 'Status'];
    headerRow.font = { bold: true };

    // Row 5+: Data
    participants
      .filter(p => p?.participant?.name && p?.participant?.email)
      .forEach((p, index) => {
        const row = worksheet.getRow(5 + index);
        row.values = [
          p.participant.name,
          p.participant.email,
          formatTimeOnly(p.checkInTime),
          p.checkOutTime ? formatTimeOnly(p.checkOutTime) : 'N/A',
          formatDuration(p.checkInTime, p.checkOutTime),
          getCheckInStatus(p)
        ];
      });

    // Generate Excel file and trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${eventTitle.replace(/\s+/g, '_')}_participant_report.xlsx`;
    link.click();

    toast({
      title: "Report Exported",
      description: "Participant report has been downloaded as Excel file.",
    });
  };

  // Helper function to check if participant left early
  const leftEarly = (participant: Participant): boolean => {
    if (!participant.checkOutTime || !eventData?.endTime || !eventData?.date) {
      console.log(`[LEFT-EARLY] Participant ${participant.participant?.name}: Missing data - checkOutTime: ${!!participant.checkOutTime}, endTime: ${!!eventData?.endTime}, date: ${!!eventData?.date}`);
      return false;
    }
    try {
      // Handle date properly - it might be ISO string or date object
      const eventDateStr = typeof eventData.date === 'string'
        ? eventData.date.split('T')[0]
        : new Date(eventData.date).toISOString().split('T')[0];
      const eventEndDateTime = new Date(`${eventDateStr}T${eventData.endTime}`);
      const checkOutDateTime = new Date(participant.checkOutTime);

      const leftEarlyResult = checkOutDateTime < eventEndDateTime;
      console.log(`[LEFT-EARLY] Participant ${participant.participant?.name}: checkOut=${checkOutDateTime.toISOString()}, eventEnd=${eventEndDateTime.toISOString()}, leftEarly=${leftEarlyResult}`);

      return leftEarlyResult;
    } catch (error) {
      console.error('[LEFT-EARLY] Error checking left early status:', error);
      return false;
    }
  };

  const stats = {
    total: participants.length,
    // CRITICAL FIX: Only count participants who ACTUALLY checked in AND stayed until end
    // Exclude: registered, absent, and those who left early
    checkedIn: participants.filter(p => {
      console.log(`[STATS-CHECKED-IN] Checking ${p.participant?.name}: status=${p.status}`);
      // Must have checked in
      if (p.status !== 'checked-in' && p.status !== 'checked-out') {
        console.log(`[STATS-CHECKED-IN] ${p.participant?.name}: EXCLUDED (status=${p.status})`);
        return false;
      }
      // Must not have left early
      if (leftEarly(p)) {
        console.log(`[STATS-CHECKED-IN] ${p.participant?.name}: EXCLUDED (left early)`);
        return false;
      }
      console.log(`[STATS-CHECKED-IN] ${p.participant?.name}: INCLUDED`);
      return true;
    }).length,
    currentlyPresent: participants.filter(p => p.status === 'checked-in').length,
    // Count: 'absent' status, 'registered' without check-in, AND left early
    // CRITICAL FIX: For UPCOMING events, registered participants are NOT absent
    absent: participants.filter(p => {
      // For upcoming events, registered participants without check-in are NOT absent
      if (eventData?.status === 'upcoming' && p.status === 'registered' && !p.checkInTime) {
        console.log(`[STATS-ABSENT] ${p.participant?.name}: NOT counted as absent (upcoming event, registered)`);
        return false; // Don't count as absent
      }

      // For active/completed events, count as absent if:
      // - status is 'absent'
      // - registered without check-in (no-show)
      // - left early
      const isAbsent = p.status === 'absent' ||
        (p.status === 'registered' && !p.checkInTime) ||
        leftEarly(p);
      if (isAbsent) {
        console.log(`[STATS-ABSENT] ${p.participant?.name}: Counted as absent (status=${p.status}, checkInTime=${!!p.checkInTime}, leftEarly=${leftEarly(p)})`);
      }
      return isAbsent;
    }).length
  };

  console.log('[STATS] Final stats:', stats);

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
                Export Excel
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
                      <TableHead>Check-in Time</TableHead>
                      <TableHead>Check-out Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
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
                            {formatDateTime(participant.checkInTime)}
                          </TableCell>
                          <TableCell>
                            {participant.checkOutTime ? formatDateTime(participant.checkOutTime) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {formatDuration(participant.checkInTime, participant.checkOutTime)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              participant.status === 'absent' ? "destructive" :
                              participant.status === 'checked-in' ? "default" :
                              "secondary"
                            }>
                              {getCheckInStatus(participant)}
                            </Badge>
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
