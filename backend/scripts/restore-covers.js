const db = require('./database');

async function restoreCovers() {
  console.log('🔄 Restoring cover URLs from vinyls.json...');
  
  if (!db._isPostgres) {
    console.log('Not PostgreSQL');
    return;
  }

  setTimeout(async () => {
    try {
      const covers = {
        "Good Lies": "https://vinyl-casik-production.up.railway.app/cover-1764856889093-4a30x9.webp",
        "Remote Access Memories": "https://vinyl-casik-production.up.railway.app/cover-1764857634229-cojt7.webp",
        "4x4": "https://vinyl-casik-production.up.railway.app/cover-1764857783748-2behlm.webp",
        "Money Trees": "https://vinyl-casik-production.up.railway.app/cover-1764858052133-uqgneu.webp",
        "Money": "https://vinyl-casik-production.up.railway.app/cover-1764858227013-hrcbhi.webp",
        "Views": "https://vinyl-casik-production.up.railway.app/cover-1764859485692-5acwlp.webp",
        "stayinit": "https://vinyl-casik-production.up.railway.app/cover-1764875783647-i1519.webp",
        "End of Beginning ": "https://vinyl-casik-production.up.railway.app/cover-1764876854691-sf7fqr.webp"
      };

      for (const [title, coverUrl] of Object.entries(covers)) {
        await db.query('UPDATE vinyls SET coverUrl = $1 WHERE title = $2', [coverUrl, title]);
        console.log(`✓ Restored cover for "${title}"`);
      }

      console.log('✅ All covers restored!');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }, 2000);
}

restoreCovers();
