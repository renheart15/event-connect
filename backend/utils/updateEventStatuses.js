const cron = require('node-cron');
const Event = require('../models/Event');

const updateEventStatuses = () => {
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    try {
      const events = await Event.find();
      let updatedCount = 0;

      for (const event of events) {
        const [startHour, startMin] = event.startTime.split(':').map(Number);
        const [endHour, endMin] = event.endTime.split(':').map(Number);

        const start = new Date(event.date);
        start.setHours(startHour, startMin, 0, 0); // Local Manila Time

        const end = new Date(event.date);
        end.setHours(endHour, endMin, 0, 0); // Local Manila Time

        console.log(`\n🕒 Checking event: ${event.title}`);
        console.log(`📅 Local now (PH): ${now.toISOString()}`);
        console.log(`🟢 Start:          ${start.toISOString()}`);
        console.log(`🔴 End:            ${end.toISOString()}`);
        console.log(`📌 Status in DB:   ${event.status}`);

        let newStatus = 'upcoming';
        if (!isNaN(start) && !isNaN(end)) {
          if (now >= end) newStatus = 'completed';
          else if (now >= start) newStatus = 'active';
        }

        if (event.status !== newStatus) {
          event.status = newStatus;
          await event.save();
          updatedCount++;
          console.log(`✅ Updated "${event.title}" to ${newStatus}`);
        }
      }

      console.log(`🔁 Status check done. Updated ${updatedCount} event(s).`);
    } catch (err) {
      console.error('🔥 Error updating event statuses:', err.message);
    }
  });

  console.log('🕒 Cron job for updating event statuses started');
};

module.exports = updateEventStatuses;
