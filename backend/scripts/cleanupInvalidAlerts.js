// Script to cleanup invalid/unknown alert types from ParticipantLocationStatus documents
// This handles legacy alerts that were created before alert type validation was added

const mongoose = require('mongoose');
const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');
const User = require('../models/User'); // Required for populate to work
const Event = require('../models/Event'); // Required for populate to work

// Valid alert types based on current schema
const VALID_ALERT_TYPES = ['warning', 'exceeded_limit', 'returned', 'left_geofence'];

async function cleanupInvalidAlerts() {
  try {
    console.log('🧹 Starting cleanup of invalid alerts...');
    console.log(`Valid alert types: ${VALID_ALERT_TYPES.join(', ')}`);

    // Find all ParticipantLocationStatus documents with alerts
    const allStatuses = await ParticipantLocationStatus.find({
      'alertsSent.0': { $exists: true }
    }).populate('participant', 'name email').populate('event', 'title');

    let totalDocumentsChecked = 0;
    let totalDocumentsModified = 0;
    let totalInvalidAlertsRemoved = 0;
    const invalidTypesFound = new Map(); // Track which invalid types were found

    for (const status of allStatuses) {
      totalDocumentsChecked++;
      const originalAlertCount = status.alertsSent.length;

      // Filter out invalid alerts (including null/undefined types)
      const validAlerts = status.alertsSent.filter(alert => {
        const isValid = alert.type && VALID_ALERT_TYPES.includes(alert.type);

        if (!isValid) {
          // Track this invalid type (convert null/undefined to string for tracking)
          const typeKey = alert.type === null ? 'null' : alert.type === undefined ? 'undefined' : alert.type;
          const count = invalidTypesFound.get(typeKey) || 0;
          invalidTypesFound.set(typeKey, count + 1);

          console.log(`  ❌ Removing invalid alert: type="${alert.type}" (${typeof alert.type}), participant="${status.participant?.name || 'Unknown'}", event="${status.event?.title || 'Unknown'}", timestamp=${alert.timestamp}`);
        }

        return isValid;
      });

      // Update document if any alerts were removed
      if (validAlerts.length < originalAlertCount) {
        status.alertsSent = validAlerts;
        await status.save();

        totalDocumentsModified++;
        totalInvalidAlertsRemoved += (originalAlertCount - validAlerts.length);

        console.log(`  ✅ Updated ${status.participant?.name || 'Unknown'} - ${status.event?.title || 'Unknown'}: Removed ${originalAlertCount - validAlerts.length} invalid alert(s)`);
      }
    }

    console.log('\n============================================');
    console.log('📊 Cleanup Summary:');
    console.log(`  Documents checked: ${totalDocumentsChecked}`);
    console.log(`  Documents modified: ${totalDocumentsModified}`);
    console.log(`  Invalid alerts removed: ${totalInvalidAlertsRemoved}`);

    if (invalidTypesFound.size > 0) {
      console.log('\n  Invalid alert types found:');
      for (const [type, count] of invalidTypesFound.entries()) {
        console.log(`    - "${type}": ${count} occurrence(s)`);
      }
    }
    console.log('============================================');

    return {
      documentsChecked: totalDocumentsChecked,
      documentsModified: totalDocumentsModified,
      invalidAlertsRemoved: totalInvalidAlertsRemoved,
      invalidTypes: Object.fromEntries(invalidTypesFound)
    };

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// If run directly (not imported)
if (require.main === module) {
  require('dotenv').config();

  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
    .then(() => {
      console.log('✅ Connected to database');
      return cleanupInvalidAlerts();
    })
    .then((result) => {
      console.log('\n✅ Cleanup completed successfully!');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = cleanupInvalidAlerts;
