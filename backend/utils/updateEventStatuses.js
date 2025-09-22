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
      nowSG = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
    }

    const [startHour, startMin] = event.startTime.split(':').map(Number);
    const [endHour, endMin] = event.endTime.split(':').map(Number);

    // Create dates in Singapore timezone
    const eventDate = new Date(event.date);

    // Create start and end times in Singapore timezone
    const startSG = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), startHour, startMin, 0, 0);
    const endSG = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), endHour, endMin, 0, 0);

    console.log(`📅 Status calculation for "${event.title}":`, {
      nowSG: nowSG.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour12: false }),
      eventDate: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      calculatedStart: startSG.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour12: false }),
      calculatedEnd: endSG.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour12: false }),
      nowVsStart: nowSG >= startSG ? 'now >= start' : 'now < start',
      nowVsEnd: nowSG >= endSG ? 'now >= end' : 'now < end'
    });

    if (!isNaN(startSG) && !isNaN(endSG)) {
      if (nowSG >= endSG) return 'completed';
      else if (nowSG >= startSG) return 'active';
    }
  } catch (error) {
    console.error('Error calculating event status:', error);
  }
  return 'upcoming';
};

// Function to update a single event's status
const updateSingleEventStatus = async (eventId, forceUpdate = false, eventInstance = null) => {
  try {
    const event = eventInstance || await Event.findById(eventId);
    if (!event) return null;

    // Get current time in Singapore timezone
    const now = new Date();
    const nowSG = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
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
  // Get current time in Singapore timezone
  const now = new Date();
  const nowSG = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));

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
