
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is missing or invalid'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Access token is invalid'
    });
  }
};

// Middleware to check if user is organizer
const requireOrganizer = (req, res, next) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Organizer role required.'
    });
  }
  next();
};

// Middleware to check if user is participant
const requireParticipant = (req, res, next) => {
  if (req.user.role !== 'participant') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Participant role required.'
    });
  }
  next();
};

module.exports = { auth, requireOrganizer, requireParticipant };
