const mongoose = require('mongoose');
const AttendanceLog = require('./models/AttendanceLog');
const Event = require('./models/Event');
const { calculateEventStatus } = require('./utils/updateEventStatuses');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/event-attendance', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function debugAttendance() {
  try {
    console.log('🔍 [ATTENDANCE DEBUG] Checking attendance records...');

    // Get all attendance records
    const attendanceRecords = await AttendanceLog.find({})
      .populate({
        path: 'event',
        select: 'title date location eventCode organizer description status startTime endTime'
      })
      .populate('participant', 'name email')
      .sort({ checkInTime: -1 });

    console.log(`🔍 [ATTENDANCE DEBUG] Found ${attendanceRecords.length} attendance records`);

    if (attendanceRecords.length === 0) {
      console.log('❌ No attendance records found. Participants need to join events first!');
      process.exit(0);
    }

    // Analyze each record
    attendanceRecords.forEach((record, index) => {
      console.log(`\n🔍 [ATTENDANCE DEBUG] Record ${index + 1}:`);
      console.log('Participant:', record.participant?.name || 'Unknown');
      console.log('Event:', record.event?.title || 'Unknown');
      console.log('Event details:', {
        date: record.event?.date,
        startTime: record.event?.startTime,
        endTime: record.event?.endTime,
        storedStatus: record.event?.status
      });

      // Calculate current status
      if (record.event) {
        const currentStatus = calculateEventStatus(record.event);
        console.log('Current calculated status:', currentStatus);
        console.log('Status match:', record.event.status === currentStatus ? '✅ MATCH' : '❌ MISMATCH');
      }

      console.log('Attendance details:', {
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
        status: record.status,
        isCurrentlyAttending: !record.checkOutTime && record.checkInTime
      });

      // Determine if this would show in "currently attending"
      const wouldShowInCurrentlyAttending =
        record.checkInTime &&
        !record.checkOutTime &&
        record.event?.status === 'active';

      console.log('Would show in "Currently Attending":', wouldShowInCurrentlyAttending ? '✅ YES' : '❌ NO');

      if (!wouldShowInCurrentlyAttending) {
        const reasons = [];
        if (!record.checkInTime) reasons.push('Not checked in');
        if (record.checkOutTime) reasons.push('Already checked out');
        if (record.event?.status !== 'active') reasons.push(`Event status is "${record.event?.status}" not "active"`);
        console.log('Reasons not showing:', reasons.join(', '));
      }
    });

    // Check for active events not yet joined
    console.log('\n🔍 [ATTENDANCE DEBUG] Checking for active events available to join...');
    const activeEvents = await Event.find({ published: true });

    console.log(`Found ${activeEvents.length} published events`);

    const currentlyActiveEvents = activeEvents.filter(event => {
      const status = calculateEventStatus(event);
      return status === 'active';
    });

    console.log(`🔍 [ATTENDANCE DEBUG] Currently active events: ${currentlyActiveEvents.length}`);

    currentlyActiveEvents.forEach(event => {
      console.log(`- "${event.title}" (${event.startTime} - ${event.endTime})`);
    });

    if (currentlyActiveEvents.length === 0) {
      console.log('❌ No active events available to join right now.');
      console.log('💡 Create an event with current times to test "currently attending".');
    }

  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    mongoose.connection.close();
  }
}

debugAttendance();