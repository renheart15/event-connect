const cron = require('node-cron');
const Event = require('../models/Event');

// Function to calculate expected status for an event
const calculateEventStatus = (event, nowSG = null) => {
  // Handle cases where startTime or endTime might be missing
  if (!event.startTime || !event.endTime || !event.date) {
    return 'upcoming';
  }

  try {
    // Get current time in Singapore timezone if not provided
    if (!nowSG) {
      const now = new Date();
      // Convert UTC to Singapore timezone (UTC+8)
      nowSG = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    }

    const [startHour, startMin] = event.startTime.split(':').map(Number);
    const [endHour, endMin] = event.endTime.split(':').map(Number);

    // Create dates in Singapore timezone using the same date as the event
    const eventDate = new Date(event.date);

    // Create start and end times in Singapore timezone using UTC+8 offset
    const startSG = new Date(eventDate.getTime() + (startHour * 60 * 60 * 1000) + (startMin * 60 * 1000));
    const endSG = new Date(eventDate.getTime() + (endHour * 60 * 60 * 1000) + (endMin * 60 * 1000));

    console.log(`📅 Status calculation for "${event.title}":`, {
      nowSG: nowSG.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour12: false }),
      nowSG_ISO: nowSG.toISOString(),
      nowSG_timestamp: nowSG.getTime(),
      eventDate: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      calculatedStart: startSG.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour12: false }),
      calculatedStart_ISO: startSG.toISOString(),
      calculatedStart_timestamp: startSG.getTime(),
      calculatedEnd: endSG.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour12: false }),
      calculatedEnd_ISO: endSG.toISOString(),
      calculatedEnd_timestamp: endSG.getTime(),
      nowVsStart: nowSG >= startSG ? 'now >= start' : 'now < start',
      nowVsStart_diff: nowSG.getTime() - startSG.getTime(),
      nowVsEnd: nowSG >= endSG ? 'now >= end' : 'now < end',
      nowVsEnd_diff: nowSG.getTime() - endSG.getTime()
    });

    console.log(`🔍 Debug calculations for "${event.title}":`, {
      eventDateParsed: new Date(event.date),
      eventDateTimestamp: new Date(event.date).getTime(),
      startHour, startMin, endHour, endMin,
      startSG_check: `${eventDate.getTime()} + ${startHour * 60 * 60 * 1000} + ${startMin * 60 * 1000} = ${startSG.getTime()}`,
      endSG_check: `${eventDate.getTime()} + ${endHour * 60 * 60 * 1000} + ${endMin * 60 * 1000} = ${endSG.getTime()}`
    });

    if (!isNaN(startSG) && !isNaN(endSG)) {
      if (nowSG >= endSG) {
        console.log(`🎯 Final status for "${event.title}": COMPLETED (nowSG >= endSG)`);
        return 'completed';
      } else if (nowSG >= startSG) {
        console.log(`🎯 Final status for "${event.title}": ACTIVE (nowSG >= startSG)`);
        return 'active';
      } else {
        console.log(`🎯 Final status for "${event.title}": UPCOMING (nowSG < startSG)`);
        return 'upcoming';
      }
    } else {
      console.log(`❌ Invalid dates for "${event.title}": startSG=${startSG}, endSG=${endSG}`);
    }
  } catch (error) {
    console.error('Error calculating event status:', error);
  }
  console.log(`🎯 Final status for "${event.title}": UPCOMING (fallback)`);
  return 'upcoming';
};

// Function to update a single event's status
const updateSingleEventStatus = async (eventId, forceUpdate = false, eventInstance = null) => {
  try {
    const event = eventInstance || await Event.findById(eventId);
    if (!event) return null;

    // Get current time in Singapore timezone (UTC+8)
    const now = new Date();
    const nowSG = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const expectedStatus = calculateEventStatus(event, nowSG);

    console.log(`🔍 Status check for "${event.title}": current="${event.status}" expected="${expectedStatus}" statusMode="${event.statusMode}" forceUpdate=${forceUpdate}`);

    // Update if status mode is auto OR if force update is requested (for event edits)
    if (event.status !== expectedStatus && (event.statusMode === 'auto' || forceUpdate)) {
      const oldStatus = event.status;
      event.status = expectedStatus;
      await event.save();
      console.log(`✅ Updated "${event.title}" from ${oldStatus} to ${expectedStatus}${forceUpdate ? ' (forced)' : ''}`);
      return expectedStatus;
    }
    console.log(`⏹️ No update needed for "${event.title}" - status already correct or update conditions not met`);
    return event.status;
  } catch (error) {
    console.error('Error updating single event status:', error);
    return null;
  }
};

// Function to update all event statuses (used by cron and manual triggers)
const updateAllEventStatuses = async () => {
  // Get current time in Singapore timezone (UTC+8)
  const now = new Date();
  const nowSG = new Date(now.getTime() + (8 * 60 * 60 * 1000));

  try {
    // Fetch all events with auto mode that might need status updates
    const events = await Event.find({
      statusMode: 'auto'
    });
    let updatedCount = 0;

    for (const event of events) {
      const expectedStatus = calculateEventStatus(event, nowSG);

      if (event.status !== expectedStatus) {
        event.status = expectedStatus;
        await event.save();
        updatedCount++;
        console.log(`✅ Updated "${event.title}" to ${expectedStatus}`);
      }
    }

    if (updatedCount > 0) {
      console.log(`🔁 Status check done. Updated ${updatedCount} event(s).`);
    }
    return updatedCount;
  } catch (err) {
    console.error('🔥 Error updating event statuses:', err.message);
    return 0;
  }
};

const updateEventStatuses = () => {
  cron.schedule('*/10 * * * * *', updateAllEventStatuses); // Run every 10 seconds for good responsiveness

  console.log('🕒 Cron job for updating event statuses started (every 10 seconds)');
};

module.exports = {
  updateEventStatuses,
  updateAllEventStatuses,
  updateSingleEventStatus,
  calculateEventStatus
};
