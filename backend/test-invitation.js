// Simple test for invitation functionality
const nodemailer = require('nodemailer');

const testEmail = async () => {
  try {
    console.log('Testing nodemailer...');
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'ralfalfa66@gmail.com', // Replace with your email
        pass: 'uyqj mmsw uwyl obpe' // Replace with your app password
      }
    });

    console.log('Transporter created, attempting to send...');

    const result = await transporter.sendMail({
      from: '"Test User" <ralfalfa66@gmail.com>',
      to: 'kizybuhia@gmail.com',
      subject: 'Test Email',
      html: '<h1>Test Email</h1><p>This is a test email.</p>'
    });

    console.log('Email sent successfully:', result.messageId);
  } catch (error) {
    console.error('Email test failed:', error.message);
    console.error('Full error:', error);
  }
};

testEmail();