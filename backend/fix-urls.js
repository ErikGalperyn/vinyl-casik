const db = require('./database');

// Map titles to public Spotify image URLs
const coverMapping = {
  "Good Lies": "https://i.scdn.co/image/ab67616d0000b2730e58a0f8308c1ad403d105e7",
  "Remote Access Memories": "https://i.scdn.co/image/ab67616d0000b273d4ccd28d50d8e9e4c7a8f86a",
  "4x4": "https://i.scdn.co/image/ab67616d0000b273f79d8ab0e0c8f329f1a1e86f",
  "Money Trees": "https://i.scdn.co/image/ab67616d0000b273d28d2ebdedb220e479743797",
  "Money": "https://i.scdn.co/image/ab67616d0000b273f6eb5e7e3c37f8c0d8c0e85d",
  "Views": "https://i.scdn.co/image/ab67616d0000b273f907de96b9a4fbc04accc0d5",
  "stayinit": "https://i.scdn.co/image/ab67616d0000b2733b5e11ca1b063583df9492db",
  "End of Beginning ": "https://i.scdn.co/image/ab67616d0000b273d70a0b7e7c211e09db4c6e74"
};

async function fixUrls() {
  try {
    console.log('🔄 Fixing cover and music URLs in database...');
    
    if (!db._isPostgres) {
      console.log('Not PostgreSQL, skipping');
      return;
    }

    const result = await db.query('SELECT id, title FROM vinyls');
    const vinyls = result.rows;

    for (const vinyl of vinyls) {
      const coverUrl = coverMapping[vinyl.title] || null;
      
      await db.query(
        'UPDATE vinyls SET coverUrl = $1, musicUrl = NULL WHERE id = $2',
        [coverUrl, vinyl.id]
      );
      
      console.log(`✓ Updated "${vinyl.title}" with Spotify cover`);
    }

    console.log('✅ All URLs fixed!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// Run if database is ready
setTimeout(fixUrls, 2000);
