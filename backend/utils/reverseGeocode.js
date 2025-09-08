const axios = require('axios');

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'EventConnect-App' }
  });
  return response.data.display_name || 'Unknown address';
}

module.exports = reverseGeocode;
