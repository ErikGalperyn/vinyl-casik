const db = require('../database');

// Public cover URLs as fallbacks
const coverMapping = {
  "Good Lies": "https://i.scdn.co/image/ab67616d0000b2730e58a0f8308c1ad403d105e7",
  "Remote Access Memories": "https://i.scdn.co/image/ab67616d0000b273d4ccd28d50d8e9e4c7a8f86a",
  "4x4": "https://i.scdn.co/image/ab67616d0000b273f79d8ab0e0c8f329f1a1e86f",
  "Money Trees": "https://i.scdn.co/image/ab67616d0000b273d28d2ebdedb220e479743797",
  "Dark Red": "https://i.scdn.co/image/ab67616d0000b273f6eb5e7e3c37f8c0d8c0e85d",
  "End of Beginning": "https://i.scdn.co/image/ab67616d0000b2730e58a0f8308c1ad403d105e7",
  "Lovin On Me": "https://i.scdn.co/image/ab67616d0000b2737aede4855f6d0d738012e2e5",
  "BIRDS OF A FEATHER": "https://i.scdn.co/image/ab67616d0000b27371d62ea7ea8a5be92d3c1f62"
};

async function fixCoverUrls() {
  console.log('🔧 Fixing cover URLs...');
  
  try {
    if (db._isPostgres) {
      // Get all vinyls
      const result = await db.query('SELECT id, title, coverurl FROM vinyls');
      const vinyls = result.rows;
      
      console.log(`Found ${vinyls.length} vinyls to update`);
      
      for (const vinyl of vinyls) {
        const newCoverUrl = coverMapping[vinyl.title] || 'https://via.placeholder.com/300x300/1a1a1a/ffffff?text=' + encodeURIComponent(vinyl.title);
        
        await db.query(
          'UPDATE vinyls SET coverurl = $1 WHERE id = $2',
          [newCoverUrl, vinyl.id]
        );
        
        console.log(`✓ Updated "${vinyl.title}" with public cover URL`);
      }
      
      console.log('✅ All cover URLs updated!');
    } else {
      console.log('SQLite mode - skipping (run on production)');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (db.close) await db.close();
  }
}

fixCoverUrls();
