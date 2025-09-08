const Event = require('../models/Event');

const fixBrokenLocations = async () => {
  const events = await Event.find({ "location.coordinates.coordinates.0.$numberDouble": { $exists: true } });

  let fixed = 0;

  for (const event of events) {
    try {
      const coords = event.location.coordinates.coordinates;

      // Convert to raw numbers
      const lng = parseFloat(coords[0].$numberDouble || coords[0]);
      const lat = parseFloat(coords[1].$numberDouble || coords[1]);

      event.location.coordinates.coordinates = [lng, lat];
      await event.save();
      fixed++;
    } catch (err) {
      console.error(`❌ Failed to fix event ${event._id}`, err);
    }
  }

  console.log(`✅ Fixed ${fixed} broken event locations`);
};

module.exports = fixBrokenLocations;
