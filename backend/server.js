const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const attendanceRoutes = require('./routes/attendance');
const invitationRoutes = require('./routes/invitations');
const registrationFormRoutes = require('./routes/registrationForms');
const registrationResponseRoutes = require('./routes/registrationResponses');
const feedbackFormRoutes = require('./routes/feedbackForms'); // ✅ Added this line
const userSettingsRoutes = require('./routes/userSettings');
const locationTrackingRoutes = require('./routes/locationTracking');
const emailCredentialsRoutes = require('./routes/emailCredentials');
const organizationsRoutes = require('./routes/organizations');
const organizationMembershipRoutes = require('./routes/organizationMembership');

// Import cron job
const { updateEventStatuses } = require('./utils/updateEventStatuses');

const app = express();

// Database logging middleware - tracks all database operations
mongoose.set('debug', function(collectionName, methodName, ...args) {
  const timestamp = new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
  console.log(`🗄️  [DB ${timestamp}] ${collectionName}.${methodName}`, {
    operation: methodName,
    collection: collectionName,
    query: args[0] || 'N/A',
    timestamp: timestamp
  });
});

// Add request logging with timestamp
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
  console.log(`🌐 [API ${timestamp}] ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    timestamp: timestamp,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Trust proxy for ngrok
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: true, // Allow all origins for now (change this in production)
  credentials: true
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-session-secret-for-development',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600 // lazy session update after 24 hours
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // XSS protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Allow cross-site cookies
  }
}));

// Rate limiting - more generous for real-time monitoring
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for live monitoring)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  const timestamp = new Date().toISOString();
  console.log(`🚀 [RAILWAY BACKEND ${timestamp}] Connected to MongoDB - Railway backend is online!`);
  console.log(`📊 Database logging enabled - all queries will be tracked`);

  // ✅ Start cron job after successful DB connection
  updateEventStatuses();
})
.catch((err) => console.error('MongoDB connection error:', err));

// Routes
console.log('🔧 [RAILWAY] Registering API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/registration-forms', registrationFormRoutes);
app.use('/api/registration-responses', registrationResponseRoutes);
app.use('/api/feedback-forms', feedbackFormRoutes); // ✅ Added this line
app.use('/api/user-settings', userSettingsRoutes);
app.use('/api/location-tracking', locationTrackingRoutes);
console.log('🎯 [RAILWAY] Location tracking routes registered successfully');
app.use('/api/email-credentials', emailCredentialsRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/organization-membership', organizationMembershipRoutes);
console.log('✅ [RAILWAY] All API routes registered');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Simple time check endpoint
app.get('/api/time', (req, res) => {
  const now = new Date();
  res.json({
    success: true,
    serverTime: {
      iso: now.toISOString(),
      local: now.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
      singapore: now.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }),
      utc: now.toUTCString(),
      timestamp: now.getTime(),
      timezone: 'Asia/Singapore'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  const timestamp = new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
  console.log(`🚀 [RAILWAY BACKEND ${timestamp}] Server running on port ${PORT}, accessible from all network interfaces`);
  console.log(`🔍 [RAILWAY BACKEND] Use browser DevTools to see database fetch logs in real-time`);
  console.log(`📍 [RAILWAY BACKEND] Backend URL: https://backend.event-connect.site`);
  console.log(`🎯 [RAILWAY BACKEND] Location tracking routes enabled`);
});

module.exports = app;