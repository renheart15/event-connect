const cron = require('node-cron');
const Event = require('../models/Event');
const { fromZonedTime, toZonedTime, format } = require('date-fns-tz');
const { parseISO } = require('date-fns');

// Singapore timezone constant
const SINGAPORE_TZ = 'Asia/Singapore';

// Function to calculate expected status for an event
const calculateEventStatus = (event, currentTime = null) => {
  // Handle cases where startTime or endTime might be missing
  if (!event.startTime || !event.endTime || !event.date) {
    return 'upcoming';
  }

  try {
    // Use provided time or current time
    const now = currentTime || new Date();

    // Parse event date (format: YYYY-MM-DD or ISO string)
    const eventDateStr = typeof event.date === 'string'
      ? event.date.split('T')[0]
      : event.date.toISOString().split('T')[0];

    // Combine date and time strings in Singapore timezone
    const startDateTimeStr = `${eventDateStr}T${event.startTime}:00`;
    const endDateTimeStr = `${eventDateStr}T${event.endTime}:00`;

    // Convert Singapore time to UTC
    const startUTC = fromZonedTime(startDateTimeStr, SINGAPORE_TZ);
    const endUTC = fromZonedTime(endDateTimeStr, SINGAPORE_TZ);

    // Determine status based on current time vs event times
    if (now >= endUTC) {
      return 'completed';
    } else if (now >= startUTC) {
      return 'active';
    } else {
      return 'upcoming';
    }
  } catch (error) {
    console.error(`❌ Error calculating event status for "${event.title}":`, error);
    return 'upcoming';
  }
};

// Function to update a single event's status
const updateSingleEventStatus = async (eventId, forceUpdate = false, eventInstance = null) => {
  try {
    const event = eventInstance || await Event.findById(eventId);
    if (!event) return null;

    const expectedStatus = calculateEventStatus(event);

    // Update if status mode is auto OR if force update is requested (for event edits)
    if (event.status !== expectedStatus && (event.statusMode === 'auto' || forceUpdate)) {
      const oldStatus = event.status;
      event.status = expectedStatus;
      await event.save();
      console.log(`✅ Updated "${event.title}" from ${oldStatus} to ${expectedStatus}`);
      return expectedStatus;
    }
    return event.status;
  } catch (error) {
    console.error('Error updating single event status:', error);
    return null;
  }
};

// Function to update all event statuses (used by cron and manual triggers)
const updateAllEventStatuses = async () => {
  try {
    // Fetch all events with auto mode that might need status updates
    const events = await Event.find({
      statusMode: 'auto'
    });
    let updatedCount = 0;

    for (const event of events) {
      const expectedStatus = calculateEventStatus(event);

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
