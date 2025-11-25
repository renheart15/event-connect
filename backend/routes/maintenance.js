const express = require('express');
const router = express.Router();
const { auth, requireOrganizer } = require('../middleware/auth');
const ParticipantLocationStatus = require('../models/ParticipantLocationStatus');

// @route   POST /api/maintenance/cleanup-invalid-alerts
// @desc    One-time cleanup of invalid/unknown alert types
// @access  Private (Organizer only)
router.post('/cleanup-invalid-alerts', auth, requireOrganizer, async (req, res) => {
  try {
    console.log('🧹 [MAINTENANCE] Starting invalid alerts cleanup...');
    console.log('🧹 [MAINTENANCE] Requested by:', req.user.email);

    const VALID_ALERT_TYPES = ['warning', 'exceeded_limit', 'returned', 'left_geofence'];

    // Find all ParticipantLocationStatus documents with alerts
    const allStatuses = await ParticipantLocationStatus.find({
      'alertsSent.0': { $exists: true }
    }).populate('participant', 'name email').populate('event', 'title');

    let totalDocumentsChecked = 0;
    let totalDocumentsModified = 0;
    let totalInvalidAlertsRemoved = 0;
    const invalidTypesFound = new Map();

    for (const status of allStatuses) {
      totalDocumentsChecked++;
      const originalAlertCount = status.alertsSent.length;

      // Filter out invalid alerts (including null/undefined types)
      const validAlerts = status.alertsSent.filter(alert => {
        const isValid = alert.type && VALID_ALERT_TYPES.includes(alert.type);

        if (!isValid) {
          // Track this invalid type
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

    console.log('============================================');
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

    res.json({
      success: true,
      message: 'Invalid alerts cleanup completed',
      data: {
        documentsChecked: totalDocumentsChecked,
        documentsModified: totalDocumentsModified,
        invalidAlertsRemoved: totalInvalidAlertsRemoved,
        invalidTypes: Object.fromEntries(invalidTypesFound)
      }
    });

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Cleanup failed',
      error: error.message
    });
  }
});

module.exports = router;
