
const express = require('express');
const { body, validationResult } = require('express-validator');
const { Resend } = require('resend');
const Event = require('../models/Event');
const User = require('../models/User');
const Invitation = require('../models/Invitation');
const AttendanceLog = require('../models/AttendanceLog');
const { auth, requireOrganizer } = require('../middleware/auth');
const { updateSingleEventStatus } = require('../utils/updateEventStatuses');

const router = express.Router();

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const EMAIL_FROM = process.env.EMAIL_FROM || 'Event Connect <noreply@event-connect.site>';

// @route   POST /api/invitations
// @desc    Send invitation to participant
// @access  Private (Organizer only)
router.post('/', auth, requireOrganizer, [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('participantEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('participantName').trim().notEmpty().withMessage('Participant name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    let { eventId, participantEmail, participantName } = req.body;

    // Check if event exists and belongs to organizer
    const event = await Event.findOne({ _id: eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    // Load organizer information
    const organizer = await User.findById(req.user._id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: 'Organizer not found'
      });
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Email service not configured. Please contact administrator.'
      });
    }

    // Check if event is in the future (compare dates only, ignoring time)
    const eventDate = new Date(event.date);
    const today = new Date();
    
    // Set both to start of day for fair comparison
    eventDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (eventDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send invitations for past events'
      });
    }

    // Find or create participant user
    let participant = await User.findOne({ email: participantEmail });
    if (!participant) {
      // Create a temporary participant profile
      participant = await User.create({
        name: participantName,
        email: participantEmail,
        password: 'temp123456', // Temporary password, user should reset
        role: 'participant',
        isTemporaryAccount: true
      });
    }

    // Check if invitation already exists (allow resending)
    const existingInvitation = await Invitation.findOne({
      event: eventId,
      participant: participant._id
    });

    let invitation;
    
    if (existingInvitation) {
      // Check if invitation has already been accepted
      if (existingInvitation.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: `Invitation has already been accepted by ${participantName}. Cannot resend accepted invitations.`,
          invitationStatus: 'accepted'
        });
      }
      
      // Check if invitation has been declined (optional - you may want to allow resending to declined participants)
      if (existingInvitation.status === 'declined') {
        return res.status(400).json({
          success: false,
          message: `Invitation was declined by ${participantName}. Please confirm before resending.`,
          invitationStatus: 'declined'
        });
      }
      
      // Update the existing invitation for pending or expired invitations
      invitation = existingInvitation;
      invitation.sentAt = new Date();

      // Calculate proper expiration time based on when event actually ends (Singapore timezone)
      const eventDate = new Date(event.date);
      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Combine date and end time, interpret as Singapore time
      const eventEndTime = new Date(`${dateStr}T${event.endTime}:00`);
      // Invitation expires immediately after event ends
      invitation.expiresAt = eventEndTime;

      // Reset status to pending if it was expired
      if (invitation.status === 'expired') {
        invitation.status = 'pending';
      }
    } else {
      // Calculate proper expiration time based on when event actually ends (Singapore timezone)
      const eventDate = new Date(event.date);
      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Combine date and end time, interpret as Singapore time
      const eventEndTime = new Date(`${dateStr}T${event.endTime}:00`);

      // Create new invitation - expires immediately after event ends
      invitation = new Invitation({
        event: eventId,
        participant: participant._id,
        participantEmail,
        participantName,
        expiresAt: eventEndTime // Expires when event ends
      });
    }

    // Generate invitation code if not exists (pre-save hook will create it)
    if (!invitation.invitationCode) {
      invitation.invitationCode = require('crypto').randomBytes(16).toString('hex').toUpperCase();
    }
    
    // Generate QR code data if not exists (required field)
    if (!invitation.qrCodeData) {
      invitation.qrCodeData = invitation.invitationCode; // Use invitation code as QR data
    }
    
    // Save the invitation
    await invitation.save();

    // Prepare email
    const isResend = !!existingInvitation;
    const emailTitle = isResend ? `Reminder: You're invited to ${event.title}` : `You're invited to ${event.title}`;
    const emailIntro = isResend 
      ? `This is a reminder that you have been invited to attend <strong>${event.title}</strong>` 
      : `You have been invited to attend <strong>${event.title}</strong>`;
    
    // Create invitation page link
    // Use the configured frontend URL for email links
    const frontendUrl = process.env.FRONTEND_URL || 'https://event-connect.site';
    const invitationLink = `${frontendUrl}/invitation/${invitation.invitationCode}`;
    const appDeepLink = `eventconnect://invitation/${invitation.invitationCode}`;

    console.log('=== EMAIL LINK DEBUG ===');
    console.log('Frontend URL:', frontendUrl);
    console.log('Invitation Link:', invitationLink);
    console.log('App Deep Link:', appDeepLink);
    console.log('Request host:', req.get('host'));
    console.log('Request protocol:', req.protocol);
    console.log('========================');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4C1D95;">${emailTitle}</h2>
        <p>Hello <strong>${participantName}</strong>,</p>
        <p>${emailIntro}</p>

        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Event Details:</strong></p>
          <ul style="margin: 0; padding-left: 20px;">
            <li style="margin: 5px 0;">Date: ${event.date.toDateString()}</li>
            <li style="margin: 5px 0;">Location: ${event.location.address}</li>
            <li style="margin: 5px 0;">Description: ${event.description || 'No description provided'}</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationLink}"
             style="display: inline-block; padding: 16px 32px; background-color: #4C1D95; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0; font-size: 16px;">
            📱 Open in Event Connect App
          </a>
        </div>

        <div style="background-color: #FFF3CD; padding: 15px; border-radius: 8px; border-left: 4px solid #FFC107; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;">
            <strong>📲 Mobile App:</strong> If you have the Event Connect mobile app installed, tap the button above to open your invitation directly in the app!
          </p>
          <p style="margin: 10px 0 0 0; font-size: 14px;">
            <strong>💻 No App?</strong> The link will take you to the web version where you can download the mobile app or view your invitation online.
          </p>
        </div>

        <p style="color: #6B7280; font-size: 14px;">Click the button above to view your invitation details and access your check-in information for the event.</p>

        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

        <p style="color: #6B7280; font-size: 14px;">Best regards,<br><strong>${organizer.name}</strong></p>
      </div>
    `;

    // Send email and wait for confirmation using Resend
    const emailSubject = isResend ? `Reminder: Invitation to ${event.title}` : `Invitation to ${event.title}`;

    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: [participantEmail],
        subject: emailSubject,
        html: emailHtml,
        reply_to: organizer.email
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log(`✅ Email sent successfully to ${participantEmail} for event: ${event.title}`);
      console.log('Resend Email ID:', data?.id);
    } catch (emailError) {
      console.error(`❌ Email sending failed for ${participantEmail}:`, emailError.message);

      // Delete the invitation since email failed
      await Invitation.findByIdAndDelete(invitation._id);

      // Provide specific error message
      let errorMsg = 'Failed to send invitation email. ';
      if (emailError.message.includes('API key') || emailError.message.includes('authentication')) {
        errorMsg += 'Email service not properly configured. Please contact administrator.';
      } else if (emailError.message.includes('validation_error')) {
        errorMsg += 'Invalid email address format.';
      } else {
        errorMsg += emailError.message;
      }

      throw new Error(errorMsg);
    }

    await invitation.populate(['event', 'participant']);

    const messagePrefix = isResend ? 'Invitation resent successfully and email delivered' : 'Invitation sent successfully and email delivered';

    res.status(201).json({
      success: true,
      message: messagePrefix,
      data: {
        invitation,
        isResend: isResend
      }
    });
  } catch (error) {
    console.error('=== INVITATION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    console.error('User:', req.user);
    console.error('========================');
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send invitation';
    let errorType = 'general';
    
    if (error.message.includes('authentication') || error.message.includes('auth') || error.message.includes('Invalid login') || error.message.includes('535')) {
      errorMessage = 'Email service authentication failed. Please verify your email configuration and API key.';
      errorType = 'authentication';
    } else if (error.message.includes('connection') || error.message.includes('ECONNECTION') || error.message.includes('ETIMEDOUT')) {
      errorMessage = 'Failed to connect to email server. Please check your internet connection and try again.';
      errorType = 'connection';
    } else if (error.message.includes('Email configuration')) {
      errorMessage = error.message;
      errorType = 'configuration';
    } else if (error.message.includes('Invitation already sent')) {
      errorMessage = error.message;
      errorType = 'duplicate';
    } else if (error.message.includes('Email sending failed')) {
      // Extract the original error from email service
      const originalError = error.message.replace('Email sending failed: ', '');
      if (originalError.includes('550')) {
        errorMessage = 'Email was rejected by the recipient\'s server. Please verify the email address.';
        errorType = 'rejected';
      } else if (originalError.includes('554')) {
        errorMessage = 'Email blocked by spam filter. Please check your email content and sender reputation.';
        errorType = 'spam';
      } else if (originalError.includes('No recipients')) {
        errorMessage = 'No valid recipient email address provided.';
        errorType = 'recipient';
      } else {
        errorMessage = `Email delivery failed: ${originalError}`;
        errorType = 'delivery';
      }
    } else if (error.message.includes('Cannot send invitations for past events')) {
      errorMessage = 'Cannot send invitations for past events. Please check the event date.';
      errorType = 'past_event';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      errorType: errorType,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @route   GET /api/invitations/event/:eventId
// @desc    Get all invitations for an event
// @access  Private (Organizer only)
router.get('/event/:eventId', auth, requireOrganizer, async (req, res) => {
  try {
    // Check if event belongs to organizer
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    // Update event status
    await updateSingleEventStatus(event._id);

    const invitations = await Invitation.find({ event: req.params.eventId })
      .populate('participant', 'name email')
      .populate('event', 'title date')
      .sort({ sentAt: -1 });

    res.json({
      success: true,
      data: {
        invitations
      }
    });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invitations',
      error: error.message
    });
  }
});

// @route   GET /api/invitations/code/:code
// @desc    Get invitation by invitation code (public access for email links)
// @access  Public
router.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Invitation code is required'
      });
    }

    // Find invitation by code and populate related data
    const invitation = await Invitation.findOne({
      invitationCode: code.toUpperCase()
    })
    .populate({
      path: 'event',
      select: 'title description date startTime endTime duration location organizer status published',
      populate: {
        path: 'organizer',
        select: 'name email'
      }
    })
    .populate('participant', 'name email isTemporaryAccount');

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or has expired'
      });
    }

    // Update event status
    await updateSingleEventStatus(invitation.event._id);

    // Check if participant has a real account (not just auto-created)
    const participant = invitation.participant;
    const requiresSignup = participant && participant.isTemporaryAccount;

    // Check if invitation has expired (but don't expire accepted invitations or if participant has checked in)
    const now = new Date();
    const event = invitation.event;

    // Debug: Log full event object to see what fields are populated
    console.log('🔍 [BACKEND EXPIRY CHECK] GET /code/:code - Full Event Data:');
    console.log('  Event ID:', event._id);
    console.log('  Event Title:', event.title);
    console.log('  Event Date:', event.date);
    console.log('  Event startTime:', event.startTime);
    console.log('  Event endTime:', event.endTime);
    console.log('  Event duration:', event.duration);
    console.log('  Event keys:', Object.keys(event));
    console.log('  Full event object:', JSON.stringify(event, null, 2));

    let eventEndTime;

    // Use actual end time (Singapore timezone)
    const eventDate = new Date(event.date);
    const year = eventDate.getFullYear();
    const month = String(eventDate.getMonth() + 1).padStart(2, '0');
    const day = String(eventDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Combine date and end time, interpret as Singapore time
    eventEndTime = new Date(`${dateStr}T${event.endTime}:00`);

    // Debug logging
    console.log('✅ Using event endTime');
    console.log('  Event End DateTime (calculated):', eventEndTime.toISOString(), '/', eventEndTime.toString());
    console.log('  Current Time:', now.toISOString(), '/', now.toString());
    console.log('  Time Difference (minutes):', ((now.getTime() - eventEndTime.getTime()) / 1000 / 60).toFixed(2));
    console.log('  Invitation Status:', invitation.status);
    console.log('  Will expire?', now > eventEndTime && invitation.status !== 'accepted');

    // Invitation expires immediately after event ends
    if (now > eventEndTime && invitation.status !== 'accepted') {
      // Check if participant has attended the event (has attendance record)
      const attendanceRecord = await AttendanceLog.findOne({
        invitation: invitation._id,
        participant: invitation.participant
      });
      
      // If participant has checked in, don't expire the invitation
      if (!attendanceRecord) {
        // Update status to expired only if not already accepted and hasn't attended
        invitation.status = 'expired';
        await invitation.save();
        
        return res.status(410).json({
          success: false,
          message: 'This invitation has expired',
          data: invitation
        });
      }
    }

    // Check if participant has attended the event for frontend use
    const attendanceRecord = await AttendanceLog.findOne({
      invitation: invitation._id,
      participant: invitation.participant
    });
    
    res.json({
      success: true,
      data: {
        ...invitation.toObject(),
        hasAttended: !!attendanceRecord
      },
      requiresSignup
    });
  } catch (error) {
    console.error('Get invitation by code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invitation',
      error: error.message
    });
  }
});

// @route   GET /api/invitations/my
// @desc    Get participant's invitations
// @access  Private (Participant only)
router.get('/my', auth, async (req, res) => {
  try {
    const invitations = await Invitation.find({ participant: req.user._id })
      .populate({
        path: 'event',
        select: 'title date startTime endTime duration location description organizer published status',
        // Participants can see all invitations they received, regardless of event publication status
        populate: {
          path: 'organizer',
          select: 'name email'
        }
      })
      .sort({ sentAt: -1 });

    // Filter out invitations where event didn't populate (should rarely happen, only if event was deleted)
    const filteredInvitations = invitations.filter(invitation => invitation.event !== null);

    // Add attendance information and update status for each invitation
    const invitationsWithAttendance = await Promise.all(
      filteredInvitations.map(async (invitation) => {
        // Update event status
        if (invitation.event && invitation.event._id) {
          await updateSingleEventStatus(invitation.event._id);
        }
        
        const attendanceRecord = await AttendanceLog.findOne({
          invitation: invitation._id,
          participant: req.user._id
        });
        
        return {
          ...invitation.toObject(),
          hasAttended: !!attendanceRecord
        };
      })
    );

    res.json({
      success: true,
      data: {
        invitations: invitationsWithAttendance
      }
    });
  } catch (error) {
    console.error('Get my invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invitations',
      error: error.message
    });
  }
});

// @route   POST /api/invitations/:id/resend
// @desc    Resend invitation email (keeps same QR code)
// @access  Private (Organizer only)
router.post('/:id/resend', auth, requireOrganizer, async (req, res) => {
  try {
    console.log('=== RESEND INVITATION REQUEST ===');
    console.log('Invitation ID:', req.params.id);
    console.log('User ID:', req.user._id);
    console.log('================================');

    // Find the invitation
    const invitation = await Invitation.findById(req.params.id)
      .populate('event')
      .populate('participant');

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Check if event belongs to organizer
    if (invitation.event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if invitation has already been accepted
    if (invitation.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: `Invitation has already been accepted by ${invitation.participantName}. Cannot resend accepted invitations.`,
        invitationStatus: 'accepted'
      });
    }

    // Check if invitation has been declined
    if (invitation.status === 'declined') {
      return res.status(400).json({
        success: false,
        message: `Invitation was declined by ${invitation.participantName}. Please confirm before resending.`,
        invitationStatus: 'declined'
      });
    }

    // Load organizer information
    const organizer = await User.findById(req.user._id);
    if (!organizer) {
      return res.status(404).json({
        success: false,
        message: 'Organizer not found'
      });
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Email service not configured. Please contact administrator.'
      });
    }

    // Validate required data for email template
    if (!invitation.event || !invitation.event.title) {
      return res.status(400).json({
        success: false,
        message: 'Invitation event data is incomplete. Cannot resend.'
      });
    }

    // Create invitation page link
    // Use the configured frontend URL for email links
    const frontendUrl = process.env.FRONTEND_URL || 'https://event-connect.site';
    const invitationLink = `${frontendUrl}/invitation/${invitation.invitationCode}`;
    const appDeepLink = `eventconnect://invitation/${invitation.invitationCode}`;

    console.log('=== EMAIL LINK DEBUG ===');
    console.log('Frontend URL:', frontendUrl);
    console.log('Invitation Link:', invitationLink);
    console.log('App Deep Link:', appDeepLink);
    console.log('Request host:', req.get('host'));
    console.log('Request protocol:', req.protocol);
    console.log('========================');

    // Send email with invitation link
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4C1D95;">Reminder: You're invited to ${invitation.event.title}</h2>
        <p>Hello <strong>${invitation.participantName || 'Guest'}</strong>,</p>
        <p>This is a reminder that you have been invited to attend <strong>${invitation.event.title}</strong></p>

        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Event Details:</strong></p>
          <ul style="margin: 0; padding-left: 20px;">
            <li style="margin: 5px 0;">Date: ${invitation.event.date ? invitation.event.date.toDateString() : 'Date TBD'}</li>
            <li style="margin: 5px 0;">Location: ${invitation.event.location?.address || 'Location TBD'}</li>
            <li style="margin: 5px 0;">Description: ${invitation.event.description || 'No description provided'}</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationLink}"
             style="display: inline-block; padding: 16px 32px; background-color: #4C1D95; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0; font-size: 16px;">
            📱 Open in Event Connect App
          </a>
        </div>

        <div style="background-color: #FFF3CD; padding: 15px; border-radius: 8px; border-left: 4px solid #FFC107; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;">
            <strong>📲 Mobile App:</strong> If you have the Event Connect mobile app installed, tap the button above to open your invitation directly in the app!
          </p>
          <p style="margin: 10px 0 0 0; font-size: 14px;">
            <strong>💻 No App?</strong> The link will take you to the web version where you can download the mobile app or view your invitation online.
          </p>
        </div>

        <p style="color: #6B7280; font-size: 14px;">Click the button above to view your invitation details and access your check-in information for the event.</p>

        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

        <p style="color: #6B7280; font-size: 14px;">Best regards,<br><strong>${organizer.name}</strong></p>
      </div>
    `;

    // Send email and wait for confirmation using Resend
    try {
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: [invitation.participantEmail],
        subject: `Reminder: Invitation to ${invitation.event.title}`,
        html: emailHtml,
        reply_to: organizer.email
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log(`✅ Email resent successfully to ${invitation.participantEmail} for event: ${invitation.event.title}`);
      console.log('Resend Email ID:', data?.id);
    } catch (emailError) {
      console.error(`❌ Email resending failed for ${invitation.participantEmail}:`, emailError.message);

      // Provide specific error message
      let errorMsg = 'Failed to resend invitation email. ';
      if (emailError.message.includes('API key') || emailError.message.includes('authentication')) {
        errorMsg += 'Email service not properly configured. Please contact administrator.';
      } else if (emailError.message.includes('validation_error')) {
        errorMsg += 'Invalid email address format.';
      } else {
        errorMsg += emailError.message;
      }

      throw new Error(errorMsg);
    }

    // Update the sentAt timestamp to indicate it was resent
    invitation.sentAt = new Date();
    // Reset status to pending if it was expired
    if (invitation.status === 'expired') {
      invitation.status = 'pending';
    }
    await invitation.save();

    console.log('=== RESEND SUCCESS ===');
    console.log('Invitation resent successfully for:', invitation.participantEmail);
    console.log('======================');

    res.json({
      success: true,
      message: 'Invitation resent successfully and email delivered',
      data: {
        invitation
      }
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    
    let errorMessage = 'Failed to resend invitation';
    if (error.message.includes('authentication') || error.message.includes('auth') || error.message.includes('Invalid login') || error.message.includes('535')) {
      errorMessage = 'Email service authentication failed. Please verify your email configuration and API key.';
    } else if (error.message.includes('connection') || error.message.includes('ECONNECTION') || error.message.includes('ETIMEDOUT')) {
      errorMessage = 'Failed to connect to email server. Please check your internet connection and try again.';
    } else if (error.message.includes('Email configuration')) {
      errorMessage = error.message;
    } else if (error.message.includes('Email resending failed')) {
      const originalError = error.message.replace('Email resending failed: ', '');
      errorMessage = `Email delivery failed: ${originalError}`;
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Optional auth middleware - allows both authenticated and unauthenticated access
const optionalAuth = (req, _res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (token) {
    // If token provided, verify it
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // Invalid token, but continue anyway for public access
      req.user = null;
    }
  } else {
    req.user = null;
  }
  
  next();
};

// @route   PUT /api/invitations/:id/respond
// @desc    Respond to invitation (accept/decline)
// @access  Public (using invitation code) or Private (authenticated user)
router.put('/:id/respond', optionalAuth, [
  body('response').isIn(['accepted', 'declined']).withMessage('Response must be accepted or declined')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { response } = req.body;

    // Find invitation by ID
    const invitation = await Invitation.findById(req.params.id);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // If user is authenticated, verify ownership
    // If not authenticated, we'll allow public response (for email links)
    if (req.user && req.user._id && invitation.participant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - not your invitation'
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Invitation has already been responded to'
      });
    }

    // Don't allow responding if expired, unless it's already accepted or participant has attended
    const now = new Date();
    const event = await Event.findById(invitation.event);

    let eventEndTime;

    // Use actual end time (Singapore timezone)
    const eventDate = new Date(event.date);
    const year = eventDate.getFullYear();
    const month = String(eventDate.getMonth() + 1).padStart(2, '0');
    const day = String(eventDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Combine date and end time, interpret as Singapore time
    eventEndTime = new Date(`${dateStr}T${event.endTime}:00`);

    // Debug logging
    console.log('🔍 [BACKEND EXPIRY CHECK] PUT /respond');
    console.log('  Event:', event.title);
    console.log('  Date String:', dateStr);
    console.log('  Event End Time (input):', event.endTime);
    console.log('  Event End DateTime (calculated):', eventEndTime.toISOString(), '/', eventEndTime.toString());
    console.log('  Current Time:', now.toISOString(), '/', now.toString());
    console.log('  Time Difference (minutes):', ((now.getTime() - eventEndTime.getTime()) / 1000 / 60).toFixed(2));
    console.log('  Invitation Status:', invitation.status);
    console.log('  Will expire?', now > eventEndTime && invitation.status !== 'accepted');

    if (now > eventEndTime && invitation.status !== 'accepted') {
      // Check if participant has attended the event (has attendance record)
      const attendanceRecord = await AttendanceLog.findOne({
        invitation: invitation._id,
        participant: invitation.participant
      });
      
      // If participant hasn't checked in, consider it expired
      if (!attendanceRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invitation has expired'
        });
      }
    }

    invitation.status = response;
    invitation.respondedAt = new Date();
    await invitation.save();

    await invitation.populate(['event', 'participant']);

    // CRITICAL: If invitation is accepted, create attendance record and initialize location tracking
    if (response === 'accepted') {
      console.log(`✅ [INVITATION ACCEPTED] Creating attendance record and initializing location tracking`);

      try {
        // Check if attendance record already exists
        let attendanceRecord = await AttendanceLog.findOne({
          event: invitation.event._id,
          participant: invitation.participant._id
        });

        if (!attendanceRecord) {
          // Extract registration data if available
          const RegistrationResponse = require('../models/RegistrationResponse');
          let registrationName = invitation.participant.name;
          let registrationEmail = invitation.participant.email;

          try {
            const registrationResponse = await RegistrationResponse.findOne({
              event: invitation.event._id,
              participant: invitation.participant._id
            }).populate('registrationForm');

            if (registrationResponse && registrationResponse.registrationForm) {
              const fields = registrationResponse.registrationForm.fields || [];
              const responsesObj = registrationResponse.responses instanceof Map
                ? Object.fromEntries(registrationResponse.responses)
                : registrationResponse.responses;

              // Find name and email from registration form
              for (const field of fields) {
                const fieldId = field.id;
                const fieldLabel = (field.label || '').toLowerCase();
                const fieldType = field.type;
                const responseValue = responsesObj[fieldId] || registrationResponse.responses.get?.(fieldId);

                // Check for name field
                if (!registrationName || registrationName === invitation.participant.name) {
                  const namePatterns = ['name', 'fullname', 'full name', 'participant', 'student'];
                  if (responseValue && namePatterns.some(pattern => fieldLabel.includes(pattern))) {
                    registrationName = responseValue;
                    console.log(`✅ [REG-DATA] Found name from registration: "${registrationName}"`);
                  }
                }

                // Check for email field
                if (!registrationEmail || registrationEmail === invitation.participant.email) {
                  if (responseValue && (fieldType === 'email' || fieldLabel.includes('email'))) {
                    registrationEmail = responseValue;
                    console.log(`✅ [REG-DATA] Found email from registration: "${registrationEmail}"`);
                  }
                }

                if (registrationName !== invitation.participant.name &&
                    registrationEmail !== invitation.participant.email) {
                  break; // Found both
                }
              }
            }
          } catch (regError) {
            console.error('⚠️ [REG-DATA] Failed to extract registration data:', regError);
          }

          // Create attendance record with status 'registered'
          // Auto check-in will happen when participant enters geofence AND event is active
          attendanceRecord = new AttendanceLog({
            event: invitation.event._id,
            participant: invitation.participant._id,
            invitation: invitation._id,
            status: 'registered', // Will be auto-checked-in when inside geofence
            registrationName: registrationName,
            registrationEmail: registrationEmail
          });

          await attendanceRecord.save();
          console.log(`✅ [ATTENDANCE] Created attendance record with status 'registered'`);

          // Initialize location tracking immediately
          const locationTrackingService = require('../services/locationTrackingService');
          try {
            await locationTrackingService.initializeLocationTracking(
              invitation.event._id,
              invitation.participant._id,
              attendanceRecord._id
            );
            console.log(`✅ [LOCATION TRACKING] Initialized location tracking for participant`);
          } catch (locationError) {
            console.error('⚠️ [LOCATION TRACKING] Failed to initialize:', locationError);
            // Don't fail the acceptance if location tracking initialization fails
          }
        } else {
          console.log(`ℹ️ [ATTENDANCE] Attendance record already exists with status: ${attendanceRecord.status}`);
        }
      } catch (attendanceError) {
        console.error('⚠️ [ATTENDANCE] Failed to create attendance record:', attendanceError);
        // Don't fail the invitation acceptance if attendance creation fails
      }
    }

    res.json({
      success: true,
      message: `Invitation ${response} successfully`,
      data: {
        invitation
      }
    });
  } catch (error) {
    console.error('Respond to invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to invitation',
      error: error.message
    });
  }
});

// @route   DELETE /api/invitations/:id
// @desc    Delete a single invitation (for participants to dismiss)
// @access  Private (Participant only - own invitations)
router.delete('/:id', auth, async (req, res) => {
  try {
    const invitation = await Invitation.findById(req.params.id);
    
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Check if the invitation belongs to the current user
    if (invitation.participant.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - not your invitation'
      });
    }

    await Invitation.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Invitation dismissed successfully'
    });
  } catch (error) {
    console.error('Delete invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss invitation',
      error: error.message
    });
  }
});

// @route   DELETE /api/invitations/my/expired
// @desc    Delete all expired invitations for current participant
// @access  Private (Participant only)
router.delete('/my/expired', auth, async (req, res) => {
  try {
    const now = new Date();
    
    // Find all invitations for the current user, populate event data
    const allInvitations = await Invitation.find({
      participant: req.user._id
    }).populate({
      path: 'event'
      // Participants can see all invitations they received, regardless of event publication status
    });

    // Filter out invitations where event didn't populate (should rarely happen, only if event was deleted)
    const filteredInvitations = allInvitations.filter(invitation => invitation.event !== null);

    // Check attendance for each invitation
    const invitationsWithAttendance = await Promise.all(
      filteredInvitations.map(async (invitation) => {
        const attendance = await AttendanceLog.findOne({
          invitation: invitation._id,
          participant: req.user._id
        });
        
        return {
          ...invitation.toObject(),
          hasAttended: !!attendance
        };
      })
    );

    // Filter expired invitations using the same logic as frontend
    const expiredInvitations = invitationsWithAttendance.filter(invitation => {
      // Don't consider accepted invitations or invitations from participants who attended as expired
      if (invitation.status === 'accepted' || invitation.hasAttended) return false;
      
      // Check if event has ended (consistent with frontend logic, Singapore timezone)
      const event = invitation.event;

      let eventEndTime;

      // Use actual end time (Singapore timezone)
      const eventDate = new Date(event.date);
      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Combine date and end time, interpret as Singapore time
      eventEndTime = new Date(`${dateStr}T${event.endTime}:00`);

      // Invitation expires immediately after event ends (matching frontend logic)
      return now > eventEndTime;
    });

    if (expiredInvitations.length === 0) {
      return res.json({
        success: true,
        message: 'No expired invitations to dismiss',
        deletedCount: 0
      });
    }

    // Delete only the truly expired invitations
    const expiredIds = expiredInvitations.map(inv => inv._id);
    const result = await Invitation.deleteMany({
      _id: { $in: expiredIds },
      participant: req.user._id
    });

    res.json({
      success: true,
      message: `${result.deletedCount} expired invitation(s) dismissed successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete expired invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss expired invitations',
      error: error.message
    });
  }
});

// @route   DELETE /api/invitations/my/accepted
// @desc    Delete all accepted invitations for current participant
// @access  Private (Participant only)
router.delete('/my/accepted', auth, async (req, res) => {
  try {
    // Find all accepted invitations for the current user
    const acceptedInvitations = await Invitation.find({
      participant: req.user._id,
      status: 'accepted'
    });

    if (acceptedInvitations.length === 0) {
      return res.json({
        success: true,
        message: 'No accepted invitations to dismiss',
        deletedCount: 0
      });
    }

    // Delete all accepted invitations for the current user
    const result = await Invitation.deleteMany({
      participant: req.user._id,
      status: 'accepted'
    });

    res.json({
      success: true,
      message: `${result.deletedCount} accepted invitation(s) dismissed successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete accepted invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss accepted invitations',
      error: error.message
    });
  }
});

// @route   DELETE /api/invitations/my/declined
// @desc    Delete all declined invitations for current participant
// @access  Private (Participant only)
router.delete('/my/declined', auth, async (req, res) => {
  try {
    // Find all declined invitations for the current user
    const declinedInvitations = await Invitation.find({
      participant: req.user._id,
      status: 'declined'
    });

    if (declinedInvitations.length === 0) {
      return res.json({
        success: true,
        message: 'No declined invitations to dismiss',
        deletedCount: 0
      });
    }

    // Delete all declined invitations for the current user
    const result = await Invitation.deleteMany({
      participant: req.user._id,
      status: 'declined'
    });

    res.json({
      success: true,
      message: `${result.deletedCount} declined invitation(s) dismissed successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete declined invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss declined invitations',
      error: error.message
    });
  }
});

// @route   GET /api/invitations/pending-approvals/:eventId
// @desc    Get all pending approval requests for an event (organizer only)
// @access  Private (Organizer)
router.get('/pending-approvals/:eventId', auth, async (req, res) => {
  try {
    console.log('📋 [PENDING APPROVALS] Fetching for event:', req.params.eventId);

    // Verify event belongs to organizer
    const event = await Event.findOne({
      _id: req.params.eventId,
      organizer: req.user._id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or access denied'
      });
    }

    // Get all pending_approval invitations for this event
    const pendingApprovals = await Invitation.find({
      event: req.params.eventId,
      status: 'pending_approval'
    })
    .populate('participant', 'name email')
    .sort({ sentAt: -1 });

    console.log('✅ [PENDING APPROVALS] Found:', pendingApprovals.length);

    res.json({
      success: true,
      data: {
        pendingApprovals,
        count: pendingApprovals.length
      }
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending approvals',
      error: error.message
    });
  }
});

// @route   PUT /api/invitations/approve/:invitationId
// @desc    Approve a pending approval request (organizer only)
// @access  Private (Organizer)
router.put('/approve/:invitationId', auth, async (req, res) => {
  try {
    console.log('✅ [APPROVE REQUEST] Processing for invitation:', req.params.invitationId);

    // Find the invitation
    const invitation = await Invitation.findById(req.params.invitationId)
      .populate('event');

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Verify event belongs to organizer
    if (invitation.event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - not your event'
      });
    }

    // Verify invitation is in pending_approval status
    if (invitation.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve invitation with status: ${invitation.status}`
      });
    }

    // Update invitation status to 'pending' (normal invitation)
    invitation.status = 'pending';
    invitation.respondedAt = new Date();
    await invitation.save();

    console.log('✅ [APPROVE REQUEST] Approved invitation:', invitation._id);

    // Populate participant info for response
    await invitation.populate('participant', 'name email');

    res.json({
      success: true,
      message: 'Access request approved successfully',
      data: {
        invitation
      }
    });
  } catch (error) {
    console.error('Approve invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve request',
      error: error.message
    });
  }
});

// @route   PUT /api/invitations/reject/:invitationId
// @desc    Reject a pending approval request (organizer only)
// @access  Private (Organizer)
router.put('/reject/:invitationId', auth, async (req, res) => {
  try {
    console.log('❌ [REJECT REQUEST] Processing for invitation:', req.params.invitationId);

    // Find the invitation
    const invitation = await Invitation.findById(req.params.invitationId)
      .populate('event');

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Verify event belongs to organizer
    if (invitation.event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - not your event'
      });
    }

    // Verify invitation is in pending_approval status
    if (invitation.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject invitation with status: ${invitation.status}`
      });
    }

    // Delete the invitation (reject and remove from system)
    await Invitation.findByIdAndDelete(req.params.invitationId);

    console.log('❌ [REJECT REQUEST] Rejected and deleted invitation:', invitation._id);

    res.json({
      success: true,
      message: 'Access request rejected successfully'
    });
  } catch (error) {
    console.error('Reject invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject request',
      error: error.message
    });
  }
});

module.exports = router;
