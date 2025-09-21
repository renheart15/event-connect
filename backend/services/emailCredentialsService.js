const EmailConfig = require('../models/EmailConfig');
const { hashPassword, verifyPassword, encryptPassword, decryptPassword } = require('../utils/passwordUtils');

/**
 * Store Gmail credentials securely in the database
 * @param {string} userId - The user ID
 * @param {string} email - Gmail email address
 * @param {string} password - Plain text password (will be hashed)
 * @returns {Promise<Object>} - The saved email config (without password)
 */
const storeGmailCredentials = async (userId, email, password) => {
  try {
    // Encrypt the password for retrievable storage (Gmail app passwords need to be reusable)
    const encryptedPassword = encryptPassword(password);
    
    // Check if email config already exists for this user and email
    let emailConfig = await EmailConfig.findOne({ user: userId, email });
    
    if (emailConfig) {
      // Update existing config
      emailConfig.hashedPassword = encryptedPassword;
      emailConfig.isActive = true;
      emailConfig.updatedAt = new Date();
      await emailConfig.save();
    } else {
      // Create new config
      emailConfig = new EmailConfig({
        user: userId,
        email,
        hashedPassword: encryptedPassword,
        isActive: true
      });
      await emailConfig.save();
    }
    
    // Return config without sensitive data
    return {
      id: emailConfig._id,
      user: emailConfig.user,
      email: emailConfig.email,
      isActive: emailConfig.isActive,
      createdAt: emailConfig.createdAt,
      updatedAt: emailConfig.updatedAt
    };
  } catch (error) {
    throw new Error('Failed to store Gmail credentials: ' + error.message);
  }
};

/**
 * Verify Gmail credentials
 * @param {string} userId - The user ID
 * @param {string} email - Gmail email address
 * @param {string} password - Plain text password to verify
 * @returns {Promise<boolean>} - True if credentials are valid
 */
const verifyGmailCredentials = async (userId, email, password) => {
  try {
    const emailConfig = await EmailConfig.findOne({ 
      user: userId, 
      email, 
      isActive: true 
    });
    
    if (!emailConfig) {
      return false;
    }
    
    // Decrypt and compare passwords
    const decryptedPassword = decryptPassword(emailConfig.hashedPassword);
    const isValid = password === decryptedPassword;
    
    if (isValid) {
      // Update last used timestamp
      emailConfig.lastUsed = new Date();
      await emailConfig.save();
    }
    
    return isValid;
  } catch (error) {
    throw new Error('Failed to verify Gmail credentials: ' + error.message);
  }
};

/**
 * Get Gmail credentials for authentication (returns email only, password verification needed separately)
 * @param {string} userId - The user ID
 * @param {string} email - Gmail email address (optional, gets active config if not specified)
 * @returns {Promise<Object|null>} - Email config or null if not found
 */
const getGmailCredentials = async (userId, email = null) => {
  try {
    let query = { user: userId, isActive: true };
    if (email) {
      query.email = email;
    }
    
    const emailConfig = await EmailConfig.findOne(query).select('-hashedPassword');
    
    return emailConfig;
  } catch (error) {
    throw new Error('Failed to get Gmail credentials: ' + error.message);
  }
};

/**
 * Get all Gmail configurations for a user (without sensitive data)
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} - Array of email configs
 */
const getUserGmailConfigs = async (userId) => {
  try {
    const emailConfigs = await EmailConfig.find({ user: userId })
      .select('-hashedPassword')
      .sort({ createdAt: -1 });
    
    return emailConfigs;
  } catch (error) {
    throw new Error('Failed to get user Gmail configs: ' + error.message);
  }
};

/**
 * Deactivate Gmail credentials
 * @param {string} userId - The user ID
 * @param {string} email - Gmail email address
 * @returns {Promise<boolean>} - True if deactivated successfully
 */
const deactivateGmailCredentials = async (userId, email) => {
  try {
    const result = await EmailConfig.updateOne(
      { user: userId, email },
      { isActive: false, updatedAt: new Date() }
    );
    
    return result.modifiedCount > 0;
  } catch (error) {
    throw new Error('Failed to deactivate Gmail credentials: ' + error.message);
  }
};

/**
 * Delete Gmail credentials permanently
 * @param {string} userId - The user ID
 * @param {string} email - Gmail email address
 * @returns {Promise<boolean>} - True if deleted successfully
 */
const deleteGmailCredentials = async (userId, email) => {
  try {
    const result = await EmailConfig.deleteOne({ user: userId, email });
    return result.deletedCount > 0;
  } catch (error) {
    throw new Error('Failed to delete Gmail credentials: ' + error.message);
  }
};

/**
 * Get decrypted Gmail password for a user
 * @param {string} userId - The user ID
 * @param {string} email - Gmail email address (optional, gets active config if not specified)
 * @returns {Promise<string|null>} - Decrypted password or null if not found
 */
const getDecryptedPassword = async (userId, email = null) => {
  try {
    let query = { user: userId, isActive: true };
    if (email) {
      query.email = email;
    }
    
    const emailConfig = await EmailConfig.findOne(query);
    
    if (!emailConfig) {
      return null;
    }
    
    // Decrypt and return the password
    const decryptedPassword = decryptPassword(emailConfig.hashedPassword);
    return decryptedPassword;
  } catch (error) {
    throw new Error('Failed to get decrypted password: ' + error.message);
  }
};

module.exports = {
  storeGmailCredentials,
  verifyGmailCredentials,
  getGmailCredentials,
  getUserGmailConfigs,
  deactivateGmailCredentials,
  deleteGmailCredentials,
  getDecryptedPassword
};