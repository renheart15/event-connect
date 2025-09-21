const { calculateEventStatus } = require('./utils/updateEventStatuses');

// Create an event that should be active RIGHT NOW
const currentTime = new Date();
const currentHour = currentTime.getHours();
const currentMinute = currentTime.getMinutes();

// Create an event that started 1 hour ago and ends 1 hour from now
const startHour = currentHour - 1;
const endHour = currentHour + 1;

const activeEvent = {
  title: "Test Active Event",
  date: currentTime.toISOString().split('T')[0], // Today
  startTime: `${startHour.toString().padStart(2, '0')}:00`,
  endTime: `${endHour.toString().padStart(2, '0')}:00`
};

console.log('🔍 [ACTIVE EVENT DEBUG] Current time:', currentTime.toISOString());
console.log('🔍 [ACTIVE EVENT DEBUG] Current local time:', currentTime.toLocaleString());
console.log('🔍 [ACTIVE EVENT DEBUG] Current local hour:minute:', `${currentHour}:${currentMinute.toString().padStart(2, '0')}`);

console.log('\n🔍 [ACTIVE EVENT DEBUG] Testing artificially active event:');
console.log('Event details:', {
  date: activeEvent.date,
  startTime: activeEvent.startTime,
  endTime: activeEvent.endTime
});

const status = calculateEventStatus(activeEvent);
console.log('Calculated status:', status);

// This should be "active" if our system is working correctly
if (status === 'active') {
  console.log('✅ SUCCESS: The system correctly identifies active events!');
  console.log('✅ The issue is simply that there are no events currently active in the database.');
} else {
  console.log('❌ PROBLEM: The system is not correctly identifying active events.');
  console.log('❌ There may be a timezone or calculation issue.');
}

// Test what the frontend would see
console.log('\n🔍 [FRONTEND DEBUG] What frontend would receive:');
const eventData = {
  ...activeEvent,
  status: status,
  published: true
};

console.log('Event data that would be sent to frontend:', eventData);

// Test filtering logic
console.log('\n🔍 [FILTERING DEBUG] Public events filtering:');
console.log('Would this event be included in public events?', status !== 'completed' ? 'YES' : 'NO');
console.log('Would this event show as active in the UI?', status === 'active' ? 'YES' : 'NO');