// Test frontend timezone validation logic
const { fromZonedTime, toZonedTime, format } = require('date-fns-tz');
const SINGAPORE_TZ = 'Asia/Singapore';

console.log('🧪 Testing Frontend Timezone Validation\n' + '='.repeat(60));

// Simulate the frontend validation logic
function testFrontendValidation(dateStr, startTime, endTime, description) {
  console.log(`\n📝 Test: ${description}`);
  console.log(`Input: ${dateStr} ${startTime} - ${endTime} (Singapore time)`);

  // Convert Singapore time to UTC using date-fns-tz
  const startDateTimeStr = `${dateStr}T${startTime}:00`;
  const selectedDateUTC = fromZonedTime(startDateTimeStr, SINGAPORE_TZ);
  const now = new Date();

  console.log(`  Start UTC: ${selectedDateUTC.toISOString()}`);
  console.log(`  Now UTC:   ${now.toISOString()}`);

  // Check if in past
  const isPast = selectedDateUTC < now;
  console.log(`  Past check: ${isPast ? '❌ BLOCKED' : '✅ ALLOWED'}`);

  // Validate end time is after start time
  if (endTime) {
    const endDateTimeStr = `${dateStr}T${endTime}:00`;
    const startUTC = fromZonedTime(startDateTimeStr, SINGAPORE_TZ);
    const endUTC = fromZonedTime(endDateTimeStr, SINGAPORE_TZ);

    console.log(`  End UTC:   ${endUTC.toISOString()}`);

    const validTimeRange = endUTC > startUTC;
    console.log(`  Time range: ${validTimeRange ? '✅ VALID' : '❌ INVALID'}`);

    return !isPast && validTimeRange;
  }

  return !isPast;
}

// Get current Singapore time for testing using date-fns-tz
const now = new Date();
const nowSG = toZonedTime(now, SINGAPORE_TZ);
const today = format(nowSG, 'yyyy-MM-dd', { timeZone: SINGAPORE_TZ });
const currentHourSG = nowSG.getHours();

console.log(`\n⏰ Current Singapore Time: ${format(nowSG, 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: SINGAPORE_TZ })}`);
console.log(`   Current Singapore Hour: ${currentHourSG}:00\n`);

// Test Cases
const tests = [
  // Basic validation
  {
    date: today,
    start: `${(currentHourSG + 1).toString().padStart(2, '0')}:00`,
    end: `${(currentHourSG + 2).toString().padStart(2, '0')}:00`,
    desc: 'Future event today (should pass)'
  },
  {
    date: today,
    start: `${(currentHourSG - 1).toString().padStart(2, '0')}:00`,
    end: `${currentHourSG.toString().padStart(2, '0')}:00`,
    desc: 'Past event today (should fail - past)'
  },
  // Edge case: Early morning hours (crosses midnight UTC)
  {
    date: '2025-10-10',
    start: '07:00', // 07:00 SGT = 23:00 UTC previous day
    end: '09:00',
    desc: 'Early morning event (07:00 SGT = 23:00 UTC previous day)'
  },
  {
    date: '2025-10-10',
    start: '01:00', // 01:00 SGT = 17:00 UTC previous day
    end: '03:00',
    desc: 'Very early morning event (01:00 SGT)'
  },
  // End time validation
  {
    date: '2025-10-15',
    start: '10:00',
    end: '10:00',
    desc: 'Same start and end time (should fail - invalid range)'
  },
  {
    date: '2025-10-15',
    start: '14:00',
    end: '12:00',
    desc: 'End before start (should fail - invalid range)'
  },
  // Edge case: Midnight
  {
    date: '2025-10-15',
    start: '23:00',
    end: '23:59',
    desc: 'Late night event (23:00-23:59 SGT)'
  },
  // Valid ranges
  {
    date: '2025-10-15',
    start: '09:00',
    end: '17:00',
    desc: 'Normal business hours (should pass)'
  }
];

let passCount = 0;
let failCount = 0;

tests.forEach((test, index) => {
  const result = testFrontendValidation(test.date, test.start, test.end, test.desc);

  // Expected results
  const shouldPass = !test.desc.includes('should fail');
  const testPassed = result === shouldPass;

  if (testPassed) {
    passCount++;
    console.log(`  ✅ Test behavior correct`);
  } else {
    failCount++;
    console.log(`  ⚠️  Unexpected result`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`📊 Results: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(60));

if (failCount === 0) {
  console.log('✅ All frontend validation tests passed!');
} else {
  console.log('❌ Some tests failed - review validation logic');
}
