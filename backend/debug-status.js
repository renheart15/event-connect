const { calculateEventStatus } = require('./utils/updateEventStatuses');

// Mock event data for testing
const currentTime = new Date();
const mockEvents = [
  {
    title: "Past Event (should be completed)",
    date: "2025-09-20",
    startTime: "10:00",
    endTime: "11:00"
  },
  {
    title: "Current Active Event",
    date: currentTime.toISOString().split('T')[0], // Today
    startTime: "01:00", // 1 hour ago
    endTime: "23:59"  // Until end of day
  },
  {
    title: "Future Event (should be upcoming)",
    date: currentTime.toISOString().split('T')[0], // Today
    startTime: "23:00", // Later today
    endTime: "23:59"
  }
];

console.log('🔍 [STATUS DEBUG] Current time:', currentTime.toISOString());
console.log('🔍 [STATUS DEBUG] Current local time:', currentTime.toLocaleString());
console.log('🔍 [STATUS DEBUG] Current UTC time:', currentTime.toUTCString());

mockEvents.forEach((event, index) => {
  console.log(`\n🔍 [STATUS DEBUG] Testing Event ${index + 1}: "${event.title}"`);
  console.log('Event details:', {
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime
  });

  const status = calculateEventStatus(event);
  console.log('Calculated status:', status);

  // Manual calculation for comparison
  const [startHour, startMin] = event.startTime.split(':').map(Number);
  const [endHour, endMin] = event.endTime.split(':').map(Number);

  const eventDate = new Date(event.date);
  const start = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), startHour, startMin, 0, 0);
  const end = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), endHour, endMin, 0, 0);

  console.log('Manual calculation:', {
    now: currentTime.toISOString(),
    start: start.toISOString(),
    end: end.toISOString(),
    nowVsStart: currentTime >= start ? 'now >= start' : 'now < start',
    nowVsEnd: currentTime >= end ? 'now >= end' : 'now < end'
  });

  let manualStatus = 'upcoming';
  if (currentTime >= end) manualStatus = 'completed';
  else if (currentTime >= start) manualStatus = 'active';

  console.log('Manual status result:', manualStatus);
  console.log('Status match:', status === manualStatus ? '✅ MATCH' : '❌ MISMATCH');
});