const { fromZonedTime, toZonedTime, format } = require('date-fns-tz');

console.log('====== FULL TIMEZONE FLOW TEST ======\n');

// 1. EVENT CREATION (what's stored in DB)
console.log('1. EVENT STORED IN DATABASE:');
const eventInDB = {
  date: new Date('2025-10-09T00:00:00.000Z'), // MongoDB stores as UTC
  startTime: '21:00', // String - SGT
  endTime: '23:59'    // String - SGT
};
console.log('   date (UTC):', eventInDB.date.toISOString());
console.log('   startTime (SGT string):', eventInDB.startTime);
console.log('   endTime (SGT string):', eventInDB.endTime);

// 2. CHECK-IN (what's stored)
console.log('\n2. CHECK-IN RECORDED:');
const checkInTime = new Date(); // Server creates UTC timestamp
console.log('   checkInTime (UTC):', checkInTime.toISOString());
console.log('   checkInTime (SGT):', format(toZonedTime(checkInTime, 'Asia/Singapore'), 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: 'Asia/Singapore' }));

// 3. AUTO-CHECKOUT LOGIC (what we compare)
console.log('\n3. AUTO-CHECKOUT COMPARISON:');
const now = checkInTime; // Same moment

// Extract date part (what the code does)
const eventDateStr = eventInDB.date.toISOString().split('T')[0];
console.log('   eventDateStr:', eventDateStr);

// Combine with end time
const endDateTimeStr = `${eventDateStr}T${eventInDB.endTime}:00`;
console.log('   endDateTimeStr:', endDateTimeStr);

// Convert SGT to UTC
const eventEndUTC = fromZonedTime(endDateTimeStr, 'Asia/Singapore');
console.log('   eventEndUTC:', eventEndUTC.toISOString());

// Compare
const hasEnded = now > eventEndUTC;
const minutesRemaining = Math.floor((eventEndUTC - now) / 60000);

console.log('\n4. COMPARISON RESULT:');
console.log('   now (UTC):', now.toISOString());
console.log('   eventEndUTC:', eventEndUTC.toISOString());
console.log('   now > eventEndUTC:', hasEnded);
console.log('   minutesRemaining:', minutesRemaining);

if (hasEnded) {
  console.log('\n❌ BUG: Would auto-checkout immediately!');
} else {
  console.log('\n✅ CORRECT: Would NOT auto-checkout');
}

// 5. SIMULATE THE ACTUAL EVENT
console.log('\n\n====== SIMULATING YOUR ACTUAL EVENT ======');
const actualEventDate = new Date(1759968000000); // From your MongoDB
const actualEndTime = '23:59';
const actualCheckIn = new Date('2025-10-09T14:24:23.931Z'); // Your check-in time

const actualDateStr = actualEventDate.toISOString().split('T')[0];
const actualEndStr = `${actualDateStr}T${actualEndTime}:00`;
const actualEventEndUTC = fromZonedTime(actualEndStr, 'Asia/Singapore');

console.log('Event date from DB:', actualEventDate.toISOString());
console.log('Extracted date string:', actualDateStr);
console.log('End time string:', actualEndStr);
console.log('Event end UTC:', actualEventEndUTC.toISOString());
console.log('Check-in time UTC:', actualCheckIn.toISOString());
console.log('Has ended?:', actualCheckIn > actualEventEndUTC);
console.log('Minutes remaining:', Math.floor((actualEventEndUTC - actualCheckIn) / 60000));
