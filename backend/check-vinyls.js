const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://medioteka_user:3gVgbNpQMxbofJjIrg204oP4XzWGyXen@dpg-d6emi97gi27c73adi0j0-a.oregon-postgres.render.com/medioteka?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    const res = await pool.query(`
      SELECT id, title, artist, musicurl, lyricslrc
      FROM vinyls
      ORDER BY id
    `);
    
    console.log('🎵 Vinyls in Render DB:');
    res.rows.forEach((v, i) => {
      console.log(`\n${i+1}. ${v.title} - ${v.artist}`);
      console.log(`   musicurl: ${v.musicurl ? '✅' : '❌ empty'}`);
      console.log(`   lyricslrc: ${v.lyricslrc ? '✅' : '❌ empty'}`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
