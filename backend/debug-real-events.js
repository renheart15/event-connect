const { calculateEventStatus } = require('./utils/updateEventStatuses');

// Real events from the database logs
const realEvents = [
  {
    title: "Event 4",
    date: "2025-09-21",  // Today
    startTime: "10:07",  // 10:07 AM local time
    endTime: "11:02"     // 11:02 AM local time
  }
];

const currentTime = new Date();
console.log('🔍 [REAL EVENTS DEBUG] Current time:', currentTime.toISOString());
console.log('🔍 [REAL EVENTS DEBUG] Current local time:', currentTime.toLocaleString());

// Get current hour and minute to compare
const currentHour = currentTime.getHours();
const currentMinute = currentTime.getMinutes();
console.log('🔍 [REAL EVENTS DEBUG] Current local hour:minute:', `${currentHour}:${currentMinute.toString().padStart(2, '0')}`);

realEvents.forEach((event, index) => {
  console.log(`\n🔍 [REAL EVENTS DEBUG] Testing "${event.title}"`);
  console.log('Event details:', {
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime
  });

  const status = calculateEventStatus(event);
  console.log('Calculated status:', status);

  // Parse event times
  const [startHour, startMin] = event.startTime.split(':').map(Number);
  const [endHour, endMin] = event.endTime.split(':').map(Number);

  console.log('Event times in local timezone:', {
    startHour,
    startMin,
    endHour,
    endMin
  });

  // Determine what status this event SHOULD have right now
  const eventTime = `${startHour}:${startMin.toString().padStart(2, '0')}`;
  const eventEndTime = `${endHour}:${endMin.toString().padStart(2, '0')}`;
  const currentTimeStr = `${currentHour}:${currentMinute.toString().padStart(2, '0')}`;

  console.log('Time comparison:', {
    eventStart: eventTime,
    eventEnd: eventEndTime,
    currentTime: currentTimeStr,
    isAfterStart: currentHour > startHour || (currentHour === startHour && currentMinute >= startMin),
    isBeforeEnd: currentHour < endHour || (currentHour === endHour && currentMinute <= endMin)
  });

  let expectedStatus = 'upcoming';
  const isAfterStart = currentHour > startHour || (currentHour === startHour && currentMinute >= startMin);
  const isBeforeEnd = currentHour < endHour || (currentHour === endHour && currentMinute <= endMin);

  if (isAfterStart && isBeforeEnd) {
    expectedStatus = 'active';
  } else if (isAfterStart && !isBeforeEnd) {
    expectedStatus = 'completed';
  }

  console.log('Expected status based on local time:', expectedStatus);
  console.log('Status match:', status === expectedStatus ? '✅ MATCH' : '❌ MISMATCH');

  if (status !== expectedStatus) {
    console.log('🚨 TIMEZONE ISSUE DETECTED! The calculateEventStatus function might be using UTC time incorrectly.');
  }
});