const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { auth, requireOrganizer } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/user-settings/email-config
// @desc    Get user's email configuration (excluding password)
// @access  Private (Organizer only)
router.get('/email-config', auth, requireOrganizer, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        emailConfig: {
          smtpHost: user.emailConfig.smtpHost,
          smtpPort: user.emailConfig.smtpPort,
          isEmailConfigured: user.emailConfig.isEmailConfigured
        }
      }
    });
  } catch (error) {
    console.error('Get email config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email configuration',
      error: error.message
    });
  }
});

// @route   PUT /api/user-settings/email-config
// @desc    Update user's email configuration (without password)
// @access  Private (Organizer only)
router.put('/email-config', auth, requireOrganizer, [
  body('smtpHost').trim().notEmpty().withMessage('SMTP host is required'),
  body('smtpPort').isInt({ min: 1, max: 65535 }).withMessage('Valid SMTP port is required')
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

    const { smtpHost, smtpPort } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        'emailConfig.smtpHost': smtpHost,
        'emailConfig.smtpPort': parseInt(smtpPort),
        'emailConfig.isEmailConfigured': true
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Email configuration updated successfully',
      data: {
        emailConfig: {
          smtpHost: user.emailConfig.smtpHost,
          smtpPort: user.emailConfig.smtpPort,
          isEmailConfigured: user.emailConfig.isEmailConfigured
        }
      }
    });
  } catch (error) {
    console.error('Update email config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email configuration',
      error: error.message
    });
  }
});

// @route   POST /api/user-settings/test-email
// @desc    Test email configuration by sending a test email
// @access  Private (Organizer only)
router.post('/test-email', auth, requireOrganizer, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+emailConfig.emailPassword');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.emailConfig.isEmailConfigured) {
      return res.status(400).json({
        success: false,
        message: 'Email configuration not set up'
      });
    }

    // Decrypt email password for testing
    const isPasswordValid = await bcrypt.compare(req.body.testPassword || '', user.emailConfig.emailPassword);
    if (!isPasswordValid && !req.body.testPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email password to test'
      });
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter({
      host: user.emailConfig.smtpHost,
      port: user.emailConfig.smtpPort,
      secure: user.emailConfig.smtpPort === 465,
      auth: {
        user: user.email,
        pass: req.body.testPassword || user.emailConfig.emailPassword
      }
    });

    await transporter.sendMail({
      from: `"${user.name}" <${user.email}>`,
      to: user.email,
      subject: 'Email Configuration Test - Event Connect',
      html: `
        <h2>Email Configuration Test Successful!</h2>
        <p>Hi ${user.name},</p>
        <p>Your email configuration is working correctly. You can now send event invitations from your email address.</p>
        <p>Best regards,<br>Event Connect Team</p>
      `
    });

    res.json({
      success: true,
      message: 'Test email sent successfully!'
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email. Please check your email configuration.',
      error: error.message
    });
  }
});

module.exports = router;