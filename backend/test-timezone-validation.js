// Test timezone validation fixes
const { fromZonedTime, toZonedTime, format } = require('date-fns-tz');
const SINGAPORE_TZ = 'Asia/Singapore';

console.log('🧪 Testing Timezone Validation Fixes\n' + '='.repeat(60));

// Test 1: Frontend date validation logic (simulated)
console.log('\n📱 Test 1: Frontend Date Validation (Singapore Timezone)');
console.log('-'.repeat(60));

function testFrontendValidation(dateStr, timeStr, description) {
  // Convert Singapore time to UTC using date-fns-tz
  const dateTimeStr = `${dateStr}T${timeStr}:00`;
  const selectedDateUTC = fromZonedTime(dateTimeStr, SINGAPORE_TZ);
  const now = new Date();

  const isPast = selectedDateUTC < now;
  const minutesUntilEvent = Math.floor((selectedDateUTC - now) / 60000);

  console.log(`\nTest: ${description}`);
  console.log(`  Input: ${dateStr} ${timeStr} SGT`);
  console.log(`  UTC:   ${selectedDateUTC.toISOString()}`);
  console.log(`  Now:   ${now.toISOString()}`);
  console.log(`  Result: ${isPast ? '❌ BLOCKED (past)' : '✅ ALLOWED (future)'}`);
  if (!isPast) {
    console.log(`  Time until event: ${minutesUntilEvent} minutes`);
  }

  return !isPast;
}

// Get current Singapore time using date-fns-tz
const now = new Date();
const nowSG = toZonedTime(now, SINGAPORE_TZ);
const currentHourSG = nowSG.getHours();
const currentMinSG = nowSG.getMinutes();

// Test cases
const todaySG = format(nowSG, 'yyyy-MM-dd', { timeZone: SINGAPORE_TZ });
testFrontendValidation(
  todaySG,
  `${(currentHourSG + 1).toString().padStart(2, '0')}:00`,
  'Event in 1 hour (should be allowed)'
);

testFrontendValidation(
  todaySG,
  `${Math.max(0, currentHourSG - 1).toString().padStart(2, '0')}:00`,
  'Event 1 hour ago (should be blocked)'
);

// Test 2: Backend check-in window validation
console.log('\n\n🔐 Test 2: Backend Check-in Window Validation');
console.log('-'.repeat(60));

function testCheckinWindow(eventDate, eventStartTime, description) {
  const now = new Date();

  // Convert Singapore time to UTC using date-fns-tz
  const startDateTimeStr = `${eventDate}T${eventStartTime}:00`;
  const eventStartUTC = fromZonedTime(startDateTimeStr, SINGAPORE_TZ);

  // Check-in window: 2 hours before to 24 hours after
  const twoHoursBefore = new Date(eventStartUTC.getTime() - (2 * 60 * 60 * 1000));
  const twentyFourHoursAfter = new Date(eventStartUTC.getTime() + (24 * 60 * 60 * 1000));

  const isWithinWindow = now >= twoHoursBefore && now <= twentyFourHoursAfter;
  const minutesToWindow = Math.floor((twoHoursBefore - now) / 60000);
  const minutesFromStart = Math.floor((now - eventStartUTC) / 60000);

  console.log(`\nTest: ${description}`);
  console.log(`  Event: ${eventDate} ${eventStartTime} SGT`);
  console.log(`  Event Start UTC: ${eventStartUTC.toISOString()}`);
  console.log(`  Check-in window: 2hrs before to 24hrs after`);
  console.log(`  Window opens:  ${twoHoursBefore.toISOString()}`);
  console.log(`  Window closes: ${twentyFourHoursAfter.toISOString()}`);
  console.log(`  Current time:  ${now.toISOString()}`);
  console.log(`  Result: ${isWithinWindow ? '✅ CHECK-IN ALLOWED' : '❌ CHECK-IN BLOCKED'}`);

  if (!isWithinWindow) {
    if (now < twoHoursBefore) {
      console.log(`  Reason: Too early (${minutesToWindow} minutes until window opens)`);
    } else {
      console.log(`  Reason: Too late (${-minutesToWindow} minutes after window closed)`);
    }
  } else {
    console.log(`  Time from event start: ${minutesFromStart} minutes`);
  }

  return isWithinWindow;
}

// Test check-in windows
testCheckinWindow(
  todaySG,
  `${(currentHourSG + 1).toString().padStart(2, '0')}:00`,
  'Event starting in 1 hour (should allow check-in)'
);

testCheckinWindow(
  todaySG,
  `${Math.max(0, currentHourSG - 1).toString().padStart(2, '0')}:00`,
  'Event started 1 hour ago (should allow check-in)'
);

testCheckinWindow(
  todaySG,
  `${Math.min(23, currentHourSG + 3).toString().padStart(2, '0')}:00`,
  'Event starting in 3 hours (should block - too early)'
);

// Test 3: End time validation
console.log('\n\n⏰ Test 3: End Time Validation');
console.log('-'.repeat(60));

function testEndTimeValidation(startTime, endTime, description) {
  const dateStr = todaySG;

  // Convert Singapore times to UTC using date-fns-tz
  const startDateTimeStr = `${dateStr}T${startTime}:00`;
  const endDateTimeStr = `${dateStr}T${endTime}:00`;

  const startUTC = fromZonedTime(startDateTimeStr, SINGAPORE_TZ);
  const endUTC = fromZonedTime(endDateTimeStr, SINGAPORE_TZ);

  const isValid = endUTC > startUTC;
  const durationMinutes = Math.floor((endUTC - startUTC) / 60000);

  console.log(`\nTest: ${description}`);
  console.log(`  Start: ${startTime} SGT → ${startUTC.toISOString()}`);
  console.log(`  End:   ${endTime} SGT → ${endUTC.toISOString()}`);
  console.log(`  Result: ${isValid ? '✅ VALID' : '❌ INVALID (end before start)'}`);
  if (isValid) {
    console.log(`  Duration: ${durationMinutes} minutes`);
  }

  return isValid;
}

testEndTimeValidation('10:00', '12:00', 'Valid 2-hour event');
testEndTimeValidation('14:00', '14:00', 'Invalid: same start and end time');
testEndTimeValidation('15:00', '14:00', 'Invalid: end before start');

console.log('\n' + '='.repeat(60));
console.log('✅ All timezone validation tests complete!');
console.log('='.repeat(60));
