// Check if the fix is actually deployed on Render
const https = require('https');

const checkDeployment = () => {
  console.log('Checking Render deployment...');
  console.log('Making request to health endpoint...');

  https.get('https://event-connect-jin2.onrender.com/api/health', (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response:', data);
      const health = JSON.parse(data);
      console.log('Server timestamp:', health.timestamp);
      console.log('Server status:', health.status);

      // The fix was committed at approximately 21:55 SGT
      console.log('\n✅ Backend is responding');
      console.log('⚠️  Note: Render deployments take 2-5 minutes');
      console.log('⚠️  Last commit was at 21:55 SGT (check if current time is after that + 5 min)');
    });
  }).on('error', (err) => {
    console.error('Error:', err.message);
  });
};

checkDeployment();
