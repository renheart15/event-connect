const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 12;
// Ensure we have a proper 32-character encryption key
let encryptionKey = process.env.ENCRYPTION_KEY;
if (!encryptionKey || encryptionKey.length < 32) {
  encryptionKey = 'your-32-char-secret-key-here123456'; // Default 32-char key
  console.warn('Using default encryption key. Set ENCRYPTION_KEY environment variable for production.');
}
const ENCRYPTION_KEY = encryptionKey.slice(0, 32); // Ensure exactly 32 characters
const ALGORITHM = 'aes-256-cbc';

/**
 * Hash a password using bcrypt with salt (for user account passwords)
 * @param {string} password - The plain text password to hash
 * @returns {Promise<string>} - The hashed password
 */
const hashPassword = async (password) => {
  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    throw new Error('Error hashing password: ' + error.message);
  }
};

/**
 * Verify a password against its hash
 * @param {string} password - The plain text password to verify
 * @param {string} hash - The hashed password to verify against
 * @returns {Promise<boolean>} - True if password matches hash, false otherwise
 */
const verifyPassword = async (password, hash) => {
  try {
    const isValid = await bcrypt.compare(password, hash);
    return isValid;
  } catch (error) {
    throw new Error('Error verifying password: ' + error.message);
  }
};

/**
 * Encrypt a password using AES (for Gmail app passwords that need to be retrievable)
 * @param {string} password - Plain text password
 * @returns {string} - Encrypted password with IV
 */
const encryptPassword = (password) => {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    throw new Error('Password encryption failed: ' + error.message);
  }
};

/**
 * Decrypt a password using AES
 * @param {string} encryptedPassword - Encrypted password with IV
 * @returns {string} - Plain text password
 */
const decryptPassword = (encryptedPassword) => {
  try {
    const parts = encryptedPassword.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Password decryption failed: ' + error.message);
  }
};

module.exports = {
  hashPassword,
  verifyPassword,
  encryptPassword,
  decryptPassword
};