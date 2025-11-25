
const generateInvitationEmail = (invitation, event, organizer, qrCodeDataURL) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Invitation</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 10px 10px 0 0;
            }
            .content {
                background: #f9f9f9;
                padding: 30px;
                border-radius: 0 0 10px 10px;
            }
            .event-details {
                background: white;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #667eea;
            }
            .qr-section {
                text-align: center;
                background: white;
                padding: 30px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .qr-code {
                max-width: 200px;
                height: auto;
                border: 2px solid #ddd;
                border-radius: 8px;
                padding: 10px;
            }
            .footer {
                text-align: center;
                color: #666;
                font-size: 14px;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
            }
            .button {
                display: inline-block;
                padding: 12px 24px;
                background: #667eea;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎉 You're Invited!</h1>
            <h2>${event.title}</h2>
        </div>
        
        <div class="content">
            <p>Hello <strong>${invitation.participantName}</strong>,</p>
            
            <p>You have been invited to attend <strong>${event.title}</strong> by ${organizer.name}.</p>
            
            <div class="event-details">
                <h3>📅 Event Details</h3>
                <ul>
                    <li><strong>Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</li>
                    <li><strong>Time:</strong> ${event.startTime || 'TBA'}${event.endTime ? ` - ${event.endTime}` : ''}</li>
                    <li><strong>Location:</strong> ${event.location.address}</li>
                    ${event.description ? `<li><strong>Description:</strong> ${event.description}</li>` : ''}
                </ul>
            </div>
            
            <div class="qr-section">
                <h3>📱 Check-in QR Code</h3>
                <p>Use this QR code to check in at the event:</p>
                <img src="${qrCodeDataURL}" alt="Event Check-in QR Code" class="qr-code">
                <p><small>Save this email or take a screenshot of the QR code for easy access</small></p>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>Please arrive on time for the event</li>
                <li>Bring a valid ID for verification</li>
                <li>This QR code is unique to you and cannot be transferred</li>
                <li>Contact the organizer if you have any questions</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>This invitation was sent by ${organizer.name} (${organizer.email})</p>
            <p>Event Attendance Tracking System</p>
        </div>
    </body>
    </html>
  `;
};

module.exports = {
  generateInvitationEmail
};
