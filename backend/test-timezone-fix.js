const { calculateEventStatus } = require('./utils/updateEventStatuses');

console.log('🧪 Testing Timezone Fix\n' + '='.repeat(50));

// Get current Singapore time
const now = new Date();
const nowSG = new Date(now.getTime() + (8 * 60 * 60 * 1000));
const currentHour = nowSG.getUTCHours();
const currentMin = nowSG.getUTCMinutes();

console.log(`Current time: ${nowSG.toISOString().replace('T', ' ').substring(0, 19)} SGT`);
console.log(`Current hour: ${currentHour}:${currentMin.toString().padStart(2, '0')} SGT\n`);

// Test cases
const testCases = [
  {
    name: 'Event happening RIGHT NOW',
    event: {
      title: 'Active Event',
      date: nowSG.toISOString().split('T')[0],
      startTime: `${(currentHour - 1).toString().padStart(2, '0')}:00`, // Started 1 hour ago
      endTime: `${(currentHour + 1).toString().padStart(2, '0')}:00`,   // Ends in 1 hour
    },
    expectedStatus: 'active'
  },
  {
    name: 'Event completed 1 hour ago',
    event: {
      title: 'Completed Event',
      date: nowSG.toISOString().split('T')[0],
      startTime: `${(currentHour - 2).toString().padStart(2, '0')}:00`,
      endTime: `${(currentHour - 1).toString().padStart(2, '0')}:00`,
    },
    expectedStatus: 'completed'
  },
  {
    name: 'Event starting in 1 hour',
    event: {
      title: 'Upcoming Event',
      date: nowSG.toISOString().split('T')[0],
      startTime: `${(currentHour + 1).toString().padStart(2, '0')}:00`,
      endTime: `${(currentHour + 2).toString().padStart(2, '0')}:00`,
    },
    expectedStatus: 'upcoming'
  },
  {
    name: 'Event at 10:00 AM SGT (fixed time test)',
    event: {
      title: 'Morning Event',
      date: '2025-10-09',
      startTime: '10:00',
      endTime: '11:00',
    },
    expectedStatus: 'auto' // Will depend on current time
  }
];

console.log('Running tests...\n');

testCases.forEach((test, index) => {
  console.log(`\nTest ${index + 1}: ${test.name}`);
  console.log(`Event: ${test.event.date} ${test.event.startTime}-${test.event.endTime}`);

  const result = calculateEventStatus(test.event, now);

  if (test.expectedStatus === 'auto') {
    console.log(`✅ Result: ${result} (computed)`);
  } else if (result === test.expectedStatus) {
    console.log(`✅ PASS: Status is "${result}" as expected`);
  } else {
    console.log(`❌ FAIL: Expected "${test.expectedStatus}" but got "${result}"`);
  }
});

console.log('\n' + '='.repeat(50));
console.log('✅ Timezone fix test complete!');
