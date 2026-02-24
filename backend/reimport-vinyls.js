const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://medioteka_user:3gVgbNpQMxbofJjIrg204oP4XzWGyXen@dpg-d6emi97gi27c73adi0j0-a.oregon-postgres.render.com/medioteka?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

// Rewrite localhost URLs to Render backend
const rewriteMediaUrl = (url) => {
  if (!url) return null;
  return url.replace(/^http:\/\/localhost:4001/, 'https://medioteka-backend.onrender.com');
};

(async () => {
  try {
    console.log('1️⃣ Deleting old vinyls and likes...');
    await pool.query('DELETE FROM vinyl_likes');
    await pool.query('DELETE FROM vinyls');
    console.log('   ✓ Old data cleared');
    
    // Read users to get UUID mapping
    console.log('\n2️⃣ Getting user IDs...');
    const usersRes = await pool.query('SELECT id, username FROM users');
    const userIdByUsername = {};
    usersRes.rows.forEach(u => {
      userIdByUsername[u.username] = u.id;
    });
    console.log('   Users:', Object.keys(userIdByUsername));
    
    // Create hardcoded ID mapping (from ids in vinyls.json)
    const idMap = {
      '1': usersRes.rows.find(u => u.username === 'Swwaggy')?.id,
      '2': usersRes.rows.find(u => u.username === 'PepeNestea')?.id,
    };
    
    // Read and import vinyls
    console.log('\n3️⃣ Importing vinyls...');
    const vinylsPath = path.join(__dirname, 'vinyls.json');
    const vData = JSON.parse(fs.readFileSync(vinylsPath, 'utf-8'));
    const vinyls = vData.vinyls || [];
    
    let vCount = 0;
    for (const v of vinyls) {
      const ownerUuid = idMap[String(v.ownerId)];
      if (!ownerUuid) {
        console.log(`   ⚠️  Skipping "${v.title}" - owner not found`);
        continue;
      }
      
      const cover = rewriteMediaUrl(v.coverUrl || null);
      const music = rewriteMediaUrl(v.musicUrl || null);
      const lyrics = v.lyricsLrc || null;
      
      const insV = await pool.query(
        'INSERT INTO vinyls (title, artist, year, coverUrl, musicUrl, lyricsLrc, note, genre, ownerId) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [v.title, v.artist, v.year || null, cover, music, lyrics, v.note || '', 'other', ownerUuid]
      );
      
      vCount++;
      const vid = insV.rows[0].id;
      
      // Import likes
      if (Array.isArray(v.likes)) {
        for (const oldUid of v.likes) {
          const likeUuid = idMap[String(oldUid)];
          if (likeUuid) {
            await pool.query(
              'INSERT INTO vinyl_likes (vinylId, userId) VALUES ($1,$2) ON CONFLICT DO NOTHING',
              [vid, likeUuid]
            );
          }
        }
      }
    }
    
    console.log(`   ✓ Imported ${vCount} vinyls`);
    
    // Verify
    console.log('\n4️⃣ Verifying import...');
    const verifyRes = await pool.query(`
      SELECT id, title, artist, musicurl, lyricslrc
      FROM vinyls
      ORDER BY title
    `);
    
    console.log(`   Total: ${verifyRes.rows.length} vinyls`);
    verifyRes.rows.forEach(v => {
      console.log(`   ✓ ${v.title} - ${v.artist} (lyrics: ${v.lyricslrc ? '✅' : '❌'})`);
    });
    
    await pool.end();
    console.log('\n✅ Import complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
