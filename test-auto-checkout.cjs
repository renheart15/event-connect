const { fromZonedTime } = require('date-fns-tz');

// Test event data
const eventDateStr = '2025-10-09';
const endTime = '23:59';

// Build end time string
const endDateTimeStr = `${eventDateStr}T${endTime}:00`;

// Convert to UTC
const eventEndUTC = fromZonedTime(endDateTimeStr, 'Asia/Singapore');

console.log('====== AUTO-CHECKOUT TIMEZONE TEST ======');
console.log('Event date:', eventDateStr);
console.log('Event end time (SGT):', endTime);
console.log('End time string:', endDateTimeStr);
console.log('Event end UTC:', eventEndUTC.toISOString());
console.log('Event end UTC timestamp:', eventEndUTC.getTime());

// Test with the actual checkout time from the log
const checkoutTime = new Date('2025-10-09T14:16:20.422Z');
console.log('\nCheckout time UTC:', checkoutTime.toISOString());
console.log('Checkout timestamp:', checkoutTime.getTime());

console.log('\nComparison:');
console.log('Has event ended? (checkout > end):', checkoutTime > eventEndUTC);
console.log('Time difference (minutes):', Math.floor((eventEndUTC - checkoutTime) / 60000));

// Also test the original broken logic
const eventDate = new Date('2025-10-09T00:00:00.000Z');
const [endHour, endMin] = endTime.split(':').map(Number);
const eventEndTime = new Date(eventDate);
eventEndTime.setHours(endHour, endMin, 0, 0);

console.log('\n====== OLD BROKEN LOGIC ======');
console.log('Event end (broken logic):', eventEndTime.toISOString());
console.log('Has ended (broken logic)?:', checkoutTime > eventEndTime);
