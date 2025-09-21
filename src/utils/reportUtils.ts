
import { useToast } from '@/hooks/use-toast';

export interface EventReportData {
  eventTitle: string;
  eventDate: string;
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
  const csvHeaders = ['Event Title', 'Date', 'Total Participants', 'Checked In', 'Currently Present', 'Location', 'Status'];
  const csvData = events.map(event => [
    event.eventTitle,
    event.eventDate,
    event.totalParticipants.toString(),
    event.checkedIn.toString(),
    event.currentlyPresent.toString(),
    event.location,
    event.status
  ]);

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
