const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const frontendLrcDir = path.join(__dirname, '..', 'frontend', 'public', 'lrc');
const pool = new Pool({
  connectionString: 'postgresql://medioteka_user:3gVgbNpQMxbofJjIrg204oP4XzWGyXen@dpg-d6emi97gi27c73adi0j0-a.oregon-postgres.render.com/medioteka?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    console.log('📝 Loading LRC files...\n');
    
    // Read all LRC files
    const lrcFiles = fs.readdirSync(frontendLrcDir).filter(f => f.endsWith('.lrc'));
    const lrcMap = {};
    
    lrcFiles.forEach(file => {
      const name = file.replace('.lrc', '');
      const content = fs.readFileSync(path.join(frontendLrcDir, file), 'utf-8');
      lrcMap[name] = content;
      console.log(`✓ ${name}`);
    });
    
    console.log(`\n🔍 Found ${lrcFiles.length} LRC files\n`);
    
    // Get all vinyls from DB
    const vinyls = await pool.query('SELECT id, title FROM vinyls ORDER BY title');
    console.log(`Found ${vinyls.rows.length} vinyls in DB\n`);
    
    let updated = 0;
    
    // Try to match and update
    for (const vinyl of vinyls.rows) {
      const title = vinyl.title.replace(/\s+/g, '_').replace(/"/g, ''); // "Good Lies" -> "Good_Lies"
      const cleanTitle = vinyl.title.replace(/[^\w\s]/g, '').trim(); // "Good Lies"
      
      // Try exact match
      let lrcText = lrcMap[title];
      
      // Try with underscores
      if (!lrcText) {
        lrcText = lrcMap[title.replace(/\s/g, '_')];
      }
      
      // Try partial match
      if (!lrcText) {
        for (const [name, content] of Object.entries(lrcMap)) {
          if (name.toLowerCase().includes(cleanTitle.toLowerCase().split(' ')[0])) {
            lrcText = content;
            break;
          }
        }
      }
      
      if (lrcText) {
        await pool.query(
          'UPDATE vinyls SET lyricslrc = $1 WHERE id = $2',
          [lrcText, vinyl.id]
        );
        console.log(`✅ Updated: ${vinyl.title}`);
        updated++;
      } else {
        console.log(`⏭️  Skipped: ${vinyl.title}`);
      }
    }
    
    console.log(`\n✓ Updated ${updated}/${vinyls.rows.length} vinyls with lyrics`);
    
    // Verify
    const verified = await pool.query('SELECT COUNT(*)::int as count FROM vinyls WHERE lyricslrc IS NOT NULL AND lyricslrc != \'\'');
    console.log(`✓ Total vinyls with lyrics: ${verified.rows[0].count}`);
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
