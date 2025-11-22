
import { useToast } from '@/hooks/use-toast';

// Convert 24-hour time format (HH:mm) to 12-hour format (hh:mm AM/PM)
const convertTo12Hour = (time24: string | undefined): string => {
  if (!time24) return 'Not specified';

  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12; // Convert 0 to 12

  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export interface EventReportData {
  eventTitle: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  totalParticipants: number;
  checkedIn: number;
  currentlyPresent: number;
  location: string;
  status: string;
}

export interface DetailedEventReportData {
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  eventStatus: string;
  participantName: string;
  participantEmail: string;
  checkInTime: string;
  checkOutTime?: string;
  duration?: number;
  attendanceStatus: string;
}

export const exportEventSummary = (events: EventReportData[]) => {
  const csvHeaders = ['Event Title', 'Location', 'Date', 'Start Time', 'End Time', 'Checked In', 'Absent', 'Status'];
  const csvData = events.map(event => {
    // Calculate absent count for all events
    // For active/ongoing events: absent = checkedIn - currentlyPresent
    // For completed events: backend already provides absent count in currentlyPresent field
    const absentCount = event.status === 'active'
      ? (event.checkedIn - event.currentlyPresent).toString()
      : event.currentlyPresent.toString();

    return [
      event.eventTitle,
      event.location,
      event.eventDate,
      convertTo12Hour(event.startTime),
      convertTo12Hour(event.endTime),
      event.checkedIn.toString(),
      absentCount,
      event.status
    ];
  });

  const csvContent = [csvHeaders, ...csvData]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `events_summary_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return true;
};

export const exportDetailedEventReport = (reportData: DetailedEventReportData[]) => {
  const csvHeaders = [
    'Event Title', 
    'Event Date', 
    'Event Location', 
    'Event Status',
    'Participant Name', 
    'Participant Email', 
    'Check-in Time', 
    'Check-out Time', 
    'Duration (minutes)', 
    'Attendance Status'
  ];
  
  const csvData = reportData.map(data => [
    data.eventTitle,
    data.eventDate,
    data.eventLocation,
    data.eventStatus,
    data.participantName,
    data.participantEmail,
    data.checkInTime ? new Date(data.checkInTime).toLocaleString() : '',
    data.checkOutTime ? new Date(data.checkOutTime).toLocaleString() : '',
    data.duration ? `${data.duration}` : '',
    data.attendanceStatus
  ]);

  const csvContent = [csvHeaders, ...csvData]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `detailed_events_report_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return true;
};
