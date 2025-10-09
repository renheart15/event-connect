const { fromZonedTime } = require('date-fns-tz');

// Exact data from the MongoDB document
const event = {
  date: new Date(1759968000000), // 2025-10-09T00:00:00.000Z
  endTime: "23:59",
  title: "Sample 1"
};

// Simulate the auto-checkout logic
const now = new Date('2025-10-09T14:16:20.422Z'); // When checkout happened

console.log('====== EXACT EVENT DATA TEST ======');
console.log('Event title:', event.title);
console.log('Event date (raw):', event.date);
console.log('Event date (ISO):', event.date.toISOString());
console.log('Event end time:', event.endTime);
console.log('Current time (when checkout happened):', now.toISOString());

// Parse event date (this is what the code does)
const eventDateStr = typeof event.date === 'string'
  ? event.date.split('T')[0]
  : event.date.toISOString().split('T')[0];

console.log('\nParsed event date string:', eventDateStr);

// Combine date and end time
const endDateTimeStr = `${eventDateStr}T${event.endTime}:00`;
console.log('End date time string:', endDateTimeStr);

// Convert Singapore time to UTC
const eventEndUTC = fromZonedTime(endDateTimeStr, 'Asia/Singapore');

console.log('\n====== TIMEZONE CONVERSION ======');
console.log('Event end UTC:', eventEndUTC.toISOString());
console.log('Event end timestamp:', eventEndUTC.getTime());

console.log('\n====== COMPARISON ======');
const hasEnded = now > eventEndUTC;
console.log('now > eventEndUTC:', hasEnded);
console.log('Time until event ends (minutes):', Math.floor((eventEndUTC - now) / 60000));

if (hasEnded) {
  console.log('\n❌ BUG: Event would be marked as ended and participants checked out');
} else {
  console.log('\n✅ CORRECT: Event is NOT ended, participants should NOT be checked out');
}
