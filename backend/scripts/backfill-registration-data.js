/**
 * Migration Script: Backfill Registration Data in Attendance Logs
 *
 * This script finds all attendance logs that are missing registrationName/registrationEmail
 * and populates them from the corresponding registration responses.
 *
 * Usage: node backend/scripts/backfill-registration-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User'); // Need to load this for population
const AttendanceLog = require('../models/AttendanceLog');
const RegistrationResponse = require('../models/RegistrationResponse');
const RegistrationForm = require('../models/RegistrationForm'); // Need to load this for population

// MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in environment variables');
  process.exit(1);
}

// Helper function to extract name/email from registration response
const extractNameEmailFromResponse = (registrationResponse) => {
  try {
    if (!registrationResponse || !registrationResponse.responses || !registrationResponse.registrationForm) {
      return { name: null, email: null };
    }

    const fields = registrationResponse.registrationForm.fields || [];
    let nameValue = null;
    let emailValue = null;

    // Convert Map to plain object for easier access
    const responsesObj = registrationResponse.responses instanceof Map
      ? Object.fromEntries(registrationResponse.responses)
      : registrationResponse.responses;

    console.log(`  📋 Response keys:`, Object.keys(responsesObj));

    // Match fields by label or type to find name and email
    for (const field of fields) {
      const fieldId = field.id;
      const fieldLabel = (field.label || '').toLowerCase();
      const fieldType = field.type;

      // Try multiple ways to get the response value
      const responseValue = responsesObj[fieldId] ||
                           registrationResponse.responses.get?.(fieldId) ||
                           registrationResponse.responses[fieldId];

      console.log(`  📋 Field "${field.label}" (id: ${fieldId}, type: ${fieldType}): value="${responseValue}"`);

      // Check if this field is a name field
      if (!nameValue && responseValue) {
        const namePatterns = ['name', 'fullname', 'full name', 'participant', 'student'];
        if (namePatterns.some(pattern => fieldLabel.includes(pattern))) {
          nameValue = responseValue;
          console.log(`  ✅ Found name field: "${field.label}" = "${nameValue}"`);
        }
      }

      // Check if this field is an email field
      if (!emailValue && responseValue) {
        if (fieldType === 'email' || fieldLabel.includes('email') || fieldLabel.includes('e-mail')) {
          emailValue = responseValue;
          console.log(`  ✅ Found email field: "${field.label}" = "${emailValue}"`);
        }
      }

      // Break early if we found both
      if (nameValue && emailValue) break;
    }

    return { name: nameValue, email: emailValue };
  } catch (error) {
    console.error('  ⚠️ Error extracting data:', error.message);
    return { name: null, email: null };
  }
};

const backfillRegistrationData = async () => {
  try {
    console.log('🚀 Starting registration data backfill...\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all attendance logs that are missing registration data
    const attendanceLogsToUpdate = await AttendanceLog.find({
      $or: [
        { registrationName: { $in: [null, ''] } },
        { registrationEmail: { $in: [null, ''] } }
      ]
    }).populate('participant', 'name email');

    console.log(`📊 Found ${attendanceLogsToUpdate.length} attendance logs missing registration data\n`);

    if (attendanceLogsToUpdate.length === 0) {
      console.log('✅ No attendance logs need updating. All done!');
      process.exit(0);
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each attendance log
    for (const log of attendanceLogsToUpdate) {
      try {
        console.log(`\n📝 Processing attendance log ${log._id}:`);
        console.log(`  Event: ${log.event}`);
        console.log(`  Participant: ${log.participant?._id}`);
        console.log(`  Current name: "${log.registrationName || 'null'}"`);
        console.log(`  Current email: "${log.registrationEmail || 'null'}"`);

        // Find corresponding registration response
        const registrationResponse = await RegistrationResponse.findOne({
          event: log.event,
          participant: log.participant._id
        }).populate('registrationForm');

        if (!registrationResponse) {
          console.log(`  ⚠️ No registration response found - using user account data`);

          // Use participant's user account data as fallback
          if (!log.registrationName && log.participant?.name) {
            log.registrationName = log.participant.name;
          }
          if (!log.registrationEmail && log.participant?.email) {
            log.registrationEmail = log.participant.email;
          }

          await log.save();
          updatedCount++;
          console.log(`  ✅ Updated with user account data: name="${log.registrationName}", email="${log.registrationEmail}"`);
          continue;
        }

        console.log(`  📋 Found registration response`);

        // Extract name and email from registration response
        const { name, email } = extractNameEmailFromResponse(registrationResponse);

        let updated = false;

        // Update if we found data
        if (name && (!log.registrationName || log.registrationName.trim() === '')) {
          log.registrationName = name;
          updated = true;
        }

        if (email && (!log.registrationEmail || log.registrationEmail.trim() === '')) {
          log.registrationEmail = email;
          updated = true;
        }

        // Fallback to user account data if still missing
        if (!log.registrationName && log.participant?.name) {
          log.registrationName = log.participant.name;
          updated = true;
          console.log(`  📋 Using fallback name from user account: "${log.registrationName}"`);
        }

        if (!log.registrationEmail && log.participant?.email) {
          log.registrationEmail = log.participant.email;
          updated = true;
          console.log(`  📋 Using fallback email from user account: "${log.registrationEmail}"`);
        }

        if (updated) {
          await log.save();
          updatedCount++;
          console.log(`  ✅ Updated: name="${log.registrationName}", email="${log.registrationEmail}"`);
        } else {
          skippedCount++;
          console.log(`  ⏭️ Skipped: no new data found`);
        }

      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error processing log ${log._id}:`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total attendance logs processed: ${attendanceLogsToUpdate.length}`);
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`⏭️ Skipped (no data): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));
    console.log('\n✅ Backfill complete!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('\n📡 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the migration
backfillRegistrationData();
