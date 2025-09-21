
# Event Attendance Tracking Backend

A comprehensive backend system for managing event attendance with QR code-based check-ins, built with Node.js, Express, and MongoDB.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access (Organizer/Participant)
- **Event Management**: Create, update, and manage events with location data
- **Invitation System**: Send personalized invitations with unique QR codes via email
- **QR Code Check-in**: Secure attendance tracking using QR codes
- **Real-time Attendance**: Track check-ins/check-outs with location data
- **Email Notifications**: Automated email sending with Nodemailer
- **Data Validation**: Comprehensive input validation with express-validator

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Email**: Nodemailer
- **QR Codes**: qrcode package
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate limiting

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd event-attendance-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
MONGODB_URI=mongodb://localhost:27017/event_attendance
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Events
- `POST /api/events` - Create event (Organizer only)
- `GET /api/events` - Get events
- `GET /api/events/:id` - Get single event
- `PUT /api/events/:id` - Update event (Organizer only)
- `DELETE /api/events/:id` - Delete event (Organizer only)

### Invitations
- `POST /api/invitations` - Send invitation (Organizer only)
- `GET /api/invitations/event/:eventId` - Get event invitations (Organizer only)
- `GET /api/invitations/my` - Get participant's invitations
- `PUT /api/invitations/:id/respond` - Respond to invitation (Participant only)

### Attendance
- `POST /api/attendance/checkin` - Check in with QR code
- `PUT /api/attendance/:id/checkout` - Check out participant
- `GET /api/attendance/event/:eventId` - Get event attendance (Organizer only)
- `GET /api/attendance/my` - Get participant's attendance history

## Database Models

### User
- Basic user information
- Role-based access (organizer/participant)
- Password hashing with bcrypt

### Event
- Event details with location support
- GPS coordinates for geofencing
- Status tracking (upcoming/ongoing/completed/cancelled)

### Invitation
- Unique invitation codes
- QR code data storage
- Expiration and usage tracking

### AttendanceLog
- Check-in/check-out times
- Location data
- Duration calculations

## Security Features

- JWT authentication
- Password hashing
- Input validation
- Rate limiting
- CORS protection
- Helmet security headers

## Email Configuration

The system uses Nodemailer for sending invitation emails. Configure your email provider in the `.env` file:

For Gmail:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password in `EMAIL_PASS`

## QR Code System

Each invitation generates a unique QR code containing:
- Invitation ID
- Event ID
- Participant ID
- Unique invitation code

QR codes are embedded in invitation emails and used for secure check-ins.

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests (when implemented)
npm test
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a process manager like PM2
3. Set up MongoDB replica set for production
4. Configure proper SSL certificates
5. Set up monitoring and logging

## API Usage Examples

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "organizer"
  }'
```

### Create Event
```bash
curl -X POST http://localhost:5000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Tech Conference 2024",
    "date": "2024-06-25T09:00:00Z",
    "location": {
      "address": "Tech Center, Building A",
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
      }
    },
    "description": "Annual technology conference"
  }'
```

### Send Invitation
```bash
curl -X POST http://localhost:5000/api/invitations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "eventId": "EVENT_ID",
    "participantEmail": "participant@example.com",
    "participantName": "Jane Smith"
  }'
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
# Force Railway redeploy - Sun, Sep 21, 2025  10:45:00 PM
