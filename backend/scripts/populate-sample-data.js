const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Import models
const User = require('../models/User');
const Event = require('../models/Event');
const Invitation = require('../models/Invitation');
const AttendanceLog = require('../models/AttendanceLog');

// Sample participant data - 30 participants with Gmail accounts
// Note: First participant uses existing organizer account format
const participants = [
  { name: "Renheart Alfanta", email: "ralfanta0112@gmail.com", phone: "+1234567001" },
  { name: "Barasan, Ervin", email: "ervin_barasan@gmail.com", phone: "+1234567002" },
  { name: "Borja, Glydell Mae", email: "glydellmae.borja@gmail.com", phone: "+1234567003" },
  { name: "Briones, Vince Froilan", email: "vfbriones@gmail.com", phone: "+1234567004" },
  { name: "Buhia, Kizy", email: "kizy.buhia25@gmail.com", phone: "+1234567005" },
  { name: "Butaslac, Mariniel", email: "mariniel.butaslac@gmail.com", phone: "+1234567006" },
  { name: "Calida, Kris Ian", email: "krisian_calida@gmail.com", phone: "+1234567007" },
  { name: "Collamar, Jerald", email: "jeraldcollamar@gmail.com", phone: "+1234567008" },
  { name: "Doños, John Wenn", email: "jw.donos@gmail.com", phone: "+1234567009" },
  { name: "Gapol, Khia Marie", email: "khiamarie.gapol@gmail.com", phone: "+1234567010" },
  { name: "Gaviola, Ira Grace", email: "iragrace_gaviola@gmail.com", phone: "+1234567011" },
  { name: "Juevesano, John Smith", email: "johnsmith.juevesano@gmail.com", phone: "+1234567012" },
  { name: "Lanterna, Kasandra Clavel", email: "kasandra.lanterna@gmail.com", phone: "+1234567013" },
  { name: "Lape, Christian Jake", email: "cjlape@gmail.com", phone: "+1234567014" },
  { name: "Laurente, Shaina", email: "shaina_laurente@gmail.com", phone: "+1234567015" },
  { name: "Lauro, Achie", email: "achie.lauro@gmail.com", phone: "+1234567016" },
  { name: "Librado, Ervin Bryan", email: "ervinbryan.librado@gmail.com", phone: "+1234567017" },
  { name: "Macapaz, Kyra", email: "kyra_macapaz@gmail.com", phone: "+1234567018" },
  { name: "Malacaste, John Clint", email: "jcmalacaste@gmail.com", phone: "+1234567019" },
  { name: "Manigos, Hazel Mae", email: "hazelmae.manigos@gmail.com", phone: "+1234567020" },
  { name: "Martinquilla, Rhea", email: "rhea.martinquilla@gmail.com", phone: "+1234567021" },
  { name: "Noel, Nash Nicole", email: "nashnoel@gmail.com", phone: "+1234567022" },
  { name: "Novela, Irish", email: "irish_novela@gmail.com", phone: "+1234567023" },
  { name: "Nuñez, Karl Vincent", email: "karlvincent.nunez@gmail.com", phone: "+1234567024" },
  { name: "Parilla, Nikko Aile", email: "nikkoaile.parilla@gmail.com", phone: "+1234567025" },
  { name: "Pono, Johnrey", email: "johnrey_pono@gmail.com", phone: "+1234567026" },
  { name: "Ricafort, Alexies Marie", email: "alexiesmarie.ricafort@gmail.com", phone: "+1234567027" },
  { name: "Rondina, Joyce Ann", email: "joyceann.rondina@gmail.com", phone: "+1234567028" },
  { name: "Sacil, John Paul", email: "jpsacil@gmail.com", phone: "+1234567029" },
  { name: "Tagalog, Mariz Stela", email: "marizstela.tagalog@gmail.com", phone: "+1234567030" }
];

// Sample event data - 1 completed event
const sampleEvents = [
  {
    title: "Annual Technology Conference 2025",
    description: "A comprehensive technology conference featuring the latest innovations in software development, AI, and cloud computing.",
    date: "2025-11-15",
    startTime: "09:00",
    endTime: "17:00",
    location: {
      address: "Cebu Technological University - Tuburan Campus, Antonio Y. de Pio Highway, Poblacion Ⅶ, Tuburan, Cebu, Central Visayas, 6043, Philippines",
      coordinates: {
        type: 'Point',
        coordinates: [123.820220, 10.718382] // [longitude, latitude]
      }
    },
    isPrivate: false,
    status: 'completed'
  }
];

async function populateSampleData() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create participants
    console.log('\n👥 Creating participants...');
    const createdParticipants = [];
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    for (const participantData of participants) {
      // Check if participant already exists
      let participant = await User.findOne({ email: participantData.email });

      if (!participant) {
        participant = await User.create({
          name: participantData.name,
          email: participantData.email,
          phone: participantData.phone,
          password: hashedPassword,
          role: 'participant',
          isVerified: true
        });
        console.log(`   ✓ Created participant: ${participant.name}`);
      } else {
        console.log(`   → Participant already exists: ${participant.name}`);
      }

      createdParticipants.push(participant);
    }

    // Get or create organizer (using first participant as organizer for simplicity)
    console.log('\n📋 Setting up organizer...');
    let organizer = createdParticipants[0];

    // Update the first user to be an organizer if not already
    if (organizer.role !== 'organizer') {
      organizer = await User.findByIdAndUpdate(
        organizer._id,
        { role: 'organizer' },
        { new: true }
      );
      console.log(`   ✓ Updated ${organizer.name} to organizer role`);
    } else {
      console.log(`   ✓ Using ${organizer.name} as organizer`);
    }

    // Create event
    console.log('\n🎉 Creating event...');
    const eventData = sampleEvents[0];

    // Check if event already exists
    let event = await Event.findOne({
      title: eventData.title,
      organizer: organizer._id
    });

    if (!event) {
      // Generate unique event code
      const eventCode = crypto.randomBytes(4).toString('hex').toUpperCase();

      event = await Event.create({
        ...eventData,
        eventCode: eventCode,
        organizer: organizer._id,
        maxCapacity: 100,
        currentCapacity: participants.length
      });
      console.log(`   ✓ Created event: ${event.title} (Code: ${event.eventCode})`);
    } else {
      console.log(`   → Event already exists: ${event.title} (Code: ${event.eventCode})`);
    }

    // Add all 31 participants to this event
    console.log('\n📨 Creating invitations and attendance records...');
    const selectedParticipants = createdParticipants;

    for (const participant of selectedParticipants) {
      // Check if invitation already exists
      let invitation = await Invitation.findOne({
        event: event._id,
        participant: participant._id
      });

      if (!invitation) {
        // Generate invitation data
        const invitationCode = crypto.randomBytes(16).toString('hex').toUpperCase();
        const qrCodeData = JSON.stringify({
          eventId: event._id,
          participantId: participant._id,
          invitationCode: invitationCode
        });
        const expiresAt = new Date(event.date);
        expiresAt.setDate(expiresAt.getDate() + 7); // Expire 7 days after event

        // Create invitation
        invitation = await Invitation.create({
          event: event._id,
          participant: participant._id,
          participantEmail: participant.email,
          participantName: participant.name,
          invitationCode: invitationCode,
          qrCodeData: qrCodeData,
          status: 'accepted',
          expiresAt: expiresAt,
          respondedAt: new Date(event.date)
        });
      }

      // Check if attendance log already exists
      let attendanceLog = await AttendanceLog.findOne({
        event: event._id,
        participant: participant._id
      });

      if (!attendanceLog) {
        // Create attendance record with varied realistic scenarios
        const eventDate = new Date(eventData.date);
        const random = Math.random();

        if (random < 0.50) {
          // 50% - Attended on time and checked out properly
          const checkInTime = new Date(eventDate);
          checkInTime.setHours(9, Math.floor(Math.random() * 15), 0); // Check-in 9:00-9:15 (on time)

          const checkOutTime = new Date(eventDate);
          checkOutTime.setHours(17, Math.floor(Math.random() * 15), 0); // Check-out 17:00-17:15

          attendanceLog = await AttendanceLog.create({
            event: event._id,
            participant: participant._id,
            status: 'checked-out',
            checkInTime: checkInTime,
            checkOutTime: checkOutTime
          });
          console.log(`   ✓ Created attendance (on-time): ${participant.name}`);
        } else if (random < 0.70) {
          // 20% - Late arrivals (after 9:15)
          const checkInTime = new Date(eventDate);
          checkInTime.setHours(9, 15 + Math.floor(Math.random() * 45), 0); // Check-in 9:15-10:00 (late)

          const checkOutTime = new Date(eventDate);
          checkOutTime.setHours(17, Math.floor(Math.random() * 15), 0); // Check-out 17:00-17:15

          attendanceLog = await AttendanceLog.create({
            event: event._id,
            participant: participant._id,
            status: 'checked-out',
            checkInTime: checkInTime,
            checkOutTime: checkOutTime
          });
          console.log(`   ✓ Created attendance (late): ${participant.name}`);
        } else if (random < 0.90) {
          // 20% - Left early (before event end time)
          const checkInTime = new Date(eventDate);
          checkInTime.setHours(9, Math.floor(Math.random() * 30), 0); // Check-in 9:00-9:30

          const checkOutTime = new Date(eventDate);
          checkOutTime.setHours(15 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0); // Check-out 15:00-16:59 (left early)

          attendanceLog = await AttendanceLog.create({
            event: event._id,
            participant: participant._id,
            status: 'checked-out',
            checkInTime: checkInTime,
            checkOutTime: checkOutTime
          });
          console.log(`   ✓ Created attendance (left-early): ${participant.name}`);
        } else {
          // 10% - Marked as absent (never showed up)
          attendanceLog = await AttendanceLog.create({
            event: event._id,
            participant: participant._id,
            status: 'absent'
          });
          console.log(`   ✓ Created attendance (absent): ${participant.name}`);
        }
      } else {
        console.log(`   → Attendance already exists for: ${participant.name}`);
      }
    }

    console.log('\n✅ Sample data population complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Participants: ${createdParticipants.length}`);
    console.log(`   - Events: 1`);
    console.log(`   - Total attendance records: ${selectedParticipants.length}`);
    console.log(`\n🔐 Default password for all participants: Password123!`);

  } catch (error) {
    console.error('❌ Error populating sample data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
populateSampleData();
