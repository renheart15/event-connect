
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    let user = null;

    // Check for session-based authentication first
    if (req.session && req.session.userId) {
      user = await User.findById(req.session.userId)
        .select('-password')
        .populate('organization', 'name organizationCode');
      if (user && user.isActive) {
        req.user = user;
        return next();
      }
    }

    // Fallback to JWT authentication for backward compatibility
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        user = await User.findById(decoded.id)
          .select('-password')
          .populate('organization', 'name organizationCode');

        if (user && user.isActive) {
          req.user = user;
          return next();
        }
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError);
      }
    }

    // No valid authentication found
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
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
