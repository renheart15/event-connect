const cron = require('node-cron');
const Event = require('../models/Event');
const locationTrackingService = require('../services/locationTrackingService');

// Function to check stale participants for all active events
const checkAllActiveEventsForStaleParticipants = async () => {
  try {
    // Find all active events
    const activeEvents = await Event.find({ status: 'active' });

    if (activeEvents.length === 0) {
      // No active events, nothing to check
      return;
    }

    console.log(`🔍 [STALE CHECK CRON] Checking ${activeEvents.length} active event(s) for stale participants`);

    let eventsChecked = 0;
    let participantsProcessed = 0;

    for (const event of activeEvents) {
      try {
        await locationTrackingService.checkStaleParticipantsForEvent(event._id);
        eventsChecked++;
      } catch (err) {
        console.error(`❌ [STALE CHECK CRON] Error checking event ${event.title}:`, err.message);
      }
    }

    if (eventsChecked > 0) {
      console.log(`✅ [STALE CHECK CRON] Completed check for ${eventsChecked} event(s)`);
    }
  } catch (err) {
    console.error('❌ [STALE CHECK CRON] Error in stale participant check:', err.message);
  }
};

// Start the cron job
const startStaleParticipantChecker = () => {
  // Run every 2 minutes (frequent enough to catch stale participants within 3-5 minutes)
  // Pattern: */2 * * * * = every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    await checkAllActiveEventsForStaleParticipants();
  });

  console.log('🕒 [STALE CHECK CRON] Background job started - checking for stale participants every 2 minutes');
};

module.exports = {
  startStaleParticipantChecker,
  checkAllActiveEventsForStaleParticipants
};
