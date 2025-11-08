require('dotenv').config();
const { Resend } = require('resend');

console.log('Testing Resend configuration...');
console.log('API Key exists:', !!process.env.RESEND_API_KEY);
console.log('API Key starts with re_:', process.env.RESEND_API_KEY?.startsWith('re_'));

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  try {
    console.log('\nSending test email...');
    const { data, error } = await resend.emails.send({
      from: 'Event Connect <onboarding@resend.dev>',
      to: ['delivered@resend.dev'], // Resend's test email
      subject: 'Test Email from Event Connect',
      html: '<p>This is a test email to verify Resend is working!</p>'
    });

    if (error) {
      console.error('❌ Resend Error:', error);
      process.exit(1);
    }

    console.log('✅ Email sent successfully!');
    console.log('Email ID:', data.id);
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
}

testEmail();
