const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const {
  storeGmailCredentials,
  verifyGmailCredentials,
  getGmailCredentials,
  getUserGmailConfigs,
  deactivateGmailCredentials,
  deleteGmailCredentials,
  getDecryptedPassword
} = require('../services/emailCredentialsService');

const router = express.Router();

// Rate limiting for email credential operations
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many credential operations, please try again later.'
  }
});

// Validation rules
const credentialValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .matches(/^[a-zA-Z0-9._%+-]+@gmail\.com$/)
    .withMessage('Must be a valid Gmail address'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
];

// Store Gmail credentials
router.post('/store', 
  credentialsLimiter,
  auth,
  credentialValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password } = req.body;
      const userId = req.user.id;

      const emailConfig = await storeGmailCredentials(userId, email, password);

      res.json({
        success: true,
        message: 'Gmail credentials stored successfully',
        data: emailConfig
      });
    } catch (error) {
      console.error('Store credentials error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to store credentials'
      });
    }
  }
);

// Verify Gmail credentials
router.post('/verify',
  credentialsLimiter,
  auth,
  credentialValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email, password } = req.body;
      const userId = req.user.id;

      const isValid = await verifyGmailCredentials(userId, email, password);

      res.json({
        success: true,
        data: { isValid }
      });
    } catch (error) {
      console.error('Verify credentials error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify credentials'
      });
    }
  }
);

// Get Gmail credentials info (without password)
router.get('/info/:email?',
  auth,
  async (req, res) => {
    try {
      const { email } = req.params;
      const userId = req.user.id;

      const emailConfig = await getGmailCredentials(userId, email);

      if (!emailConfig) {
        return res.status(404).json({
          success: false,
          message: 'Email configuration not found'
        });
      }

      res.json({
        success: true,
        data: emailConfig
      });
    } catch (error) {
      console.error('Get credentials info error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get credentials info'
      });
    }
  }
);

// Get all user Gmail configurations
router.get('/list',
  auth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const emailConfigs = await getUserGmailConfigs(userId);

      res.json({
        success: true,
        data: emailConfigs
      });
    } catch (error) {
      console.error('Get user email configs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get email configurations'
      });
    }
  }
);

// Check if user has any stored credentials
router.get('/has-credentials',
  auth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const emailConfigs = await getUserGmailConfigs(userId);
      const hasCredentials = emailConfigs.length > 0;

      res.json({
        success: true,
        data: { hasCredentials }
      });
    } catch (error) {
      console.error('Check credentials error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check credentials'
      });
    }
  }
);

// Deactivate Gmail credentials
router.patch('/deactivate',
  credentialsLimiter,
  auth,
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email } = req.body;
      const userId = req.user.id;

      const success = await deactivateGmailCredentials(userId, email);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Email configuration not found'
        });
      }

      res.json({
        success: true,
        message: 'Gmail credentials deactivated successfully'
      });
    } catch (error) {
      console.error('Deactivate credentials error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate credentials'
      });
    }
  }
);

// Delete Gmail credentials permanently
router.delete('/:email',
  credentialsLimiter,
  auth,
  async (req, res) => {
    try {
      const { email } = req.params;
      const userId = req.user.id;

      // Validate email format
      if (!email || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Gmail address'
        });
      }

      const success = await deleteGmailCredentials(userId, email);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Email configuration not found'
        });
      }

      res.json({
        success: true,
        message: 'Gmail credentials deleted successfully'
      });
    } catch (error) {
      console.error('Delete credentials error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete credentials'
      });
    }
  }
);

// Simplified password-only endpoints

// Store password only
router.post('/store-password', 
  credentialsLimiter,
  auth,
  [
    body('password').isLength({ min: 1 }).withMessage('Password is required'),
    body('gmailEmail').optional().isEmail().normalizeEmail().matches(/^[a-zA-Z0-9._%+-]+@gmail\.com$/).withMessage('Must be a valid Gmail address')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { password, gmailEmail: providedGmailEmail } = req.body;
      const userId = req.user.id;

      // Check if user already has a Gmail credential stored
      const existingConfigs = await getUserGmailConfigs(userId);
      let gmailEmail;
      
      if (providedGmailEmail) {
        // User provided a Gmail email address
        gmailEmail = providedGmailEmail;
      } else if (existingConfigs.length > 0) {
        // Use existing Gmail address
        gmailEmail = existingConfigs[0].email;
      } else {
        // Get the user's registered email address
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }
        
        console.log('User found:', user.email);
        
        // Check if user's registered email is Gmail
        if (user.email.endsWith('@gmail.com')) {
          gmailEmail = user.email;
        } else {
          // User needs to provide a Gmail address
          return res.status(400).json({
            success: false,
            message: 'Please provide a Gmail address. Your registered email is not a Gmail account.',
            requiresGmailEmail: true
          });
        }
      }

      console.log('=== PASSWORD STORAGE DEBUG ===');
      console.log('User ID:', userId);
      console.log('Gmail Email:', gmailEmail);
      console.log('Existing configs:', existingConfigs.length);
      console.log('=============================');

      const emailConfig = await storeGmailCredentials(userId, gmailEmail, password);

      res.json({
        success: true,
        message: 'Password stored successfully'
      });
    } catch (error) {
      console.error('Store password error:', error);
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
      console.error('Error name:', error.name);
      
      let errorMessage = 'Failed to store password';
      let statusCode = 500;
      
      if (error.name === 'ValidationError') {
        errorMessage = 'Invalid Gmail address format. Please ensure you provide a valid Gmail address.';
        statusCode = 400;
      } else if (error.message.includes('validation') || error.message.includes('Gmail')) {
        errorMessage = 'Invalid Gmail address. Please ensure you have a Gmail account registered.';
        statusCode = 400;
      } else if (error.message.includes('duplicate') || error.message.includes('unique') || error.code === 11000) {
        errorMessage = 'Email configuration already exists. Password updated successfully.';
        statusCode = 200; // This is actually success
      } else if (error.message.includes('Cast to ObjectId failed')) {
        errorMessage = 'Invalid user ID format.';
        statusCode = 400;
      } else if (error.message.includes('User not found')) {
        errorMessage = 'User not found.';
        statusCode = 404;
      }
      
      res.status(statusCode).json({
        success: statusCode === 200,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          name: error.name,
          code: error.code
        } : undefined
      });
    }
  }
);

// Get stored password
router.get('/get-password',
  auth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Get any active credential for this user
      const emailConfigs = await getUserGmailConfigs(userId);
      const activeConfig = emailConfigs.find(config => config.isActive);

      if (!activeConfig) {
        return res.status(404).json({
          success: false,
          message: 'No stored password found'
        });
      }

      // Get the decrypted password for auto-filling
      const decryptedPassword = await getDecryptedPassword(userId);
      
      if (!decryptedPassword) {
        return res.status(404).json({
          success: false,
          message: 'No stored password found'
        });
      }

      res.json({
        success: true,
        data: { password: decryptedPassword }
      });
    } catch (error) {
      console.error('Get password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get password'
      });
    }
  }
);

// Check if user has stored password
router.get('/has-password',
  auth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const emailConfigs = await getUserGmailConfigs(userId);
      const hasCredentials = emailConfigs.some(config => config.isActive);

      res.json({
        success: true,
        data: { hasCredentials }
      });
    } catch (error) {
      console.error('Check password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check password'
      });
    }
  }
);

// Delete stored password
router.delete('/delete-password',
  credentialsLimiter,
  auth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Delete all credentials for this user
      const emailConfigs = await getUserGmailConfigs(userId);
      let deletedCount = 0;
      
      for (const config of emailConfigs) {
        const success = await deleteGmailCredentials(userId, config.email);
        if (success) deletedCount++;
      }

      res.json({
        success: true,
        message: 'Stored password deleted successfully'
      });
    } catch (error) {
      console.error('Delete password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete stored password'
      });
    }
  }
);

module.exports = router;