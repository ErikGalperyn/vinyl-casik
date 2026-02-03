const axios = require('axios');
require('dotenv').config();

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.log('❌ Spotify credentials missing');
  process.exit(1);
}

async function testSpotify() {
  try {
    // Get token
    const tokenRes = await axios.post('https://accounts.spotify.com/api/token', 
      `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const token = tokenRes.data.access_token;
    console.log('✓ Got Spotify token');
    
    // Test multiple songs
    const queries = [
      'Blinding Lights The Weeknd',
      'Daft Punk Get Lucky',
      'Yeat Money So Big',
      'The Weeknd Starboy'
    ];
    
    for (const query of queries) {
      const searchRes = await axios.get('https://api.spotify.com/v1/search', {
        params: { q: query, type: 'track', limit: 1 },
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const track = searchRes.data.tracks.items[0];
      if (track) {
        console.log(`\n🎵 "${track.name}" by ${track.artists[0].name}`);
        console.log(`   Preview: ${track.preview_url ? '✓ EXISTS' : '❌ NULL'}`);
      }
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}

testSpotify();
