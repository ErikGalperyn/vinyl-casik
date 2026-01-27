const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Support both SQLite (fallback) and PostgreSQL
const USE_POSTGRES = process.env.DATABASE_TYPE === 'postgres' || process.env.DB_HOST;
let db;

if (USE_POSTGRES) {
  // PostgreSQL configuration
  // Support Railway's DATABASE_URL format
  let poolConfig;
  if (process.env.DATABASE_URL) {
    poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Railway requires SSL
    };
  } else {
    poolConfig = {
      user: process.env.DB_USER || 'medioteka_user',
      password: process.env.DB_PASSWORD || 'medioteka_password',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'medioteka_db',
    };
  }
  const pool = new Pool(poolConfig);

  const PUBLIC_BACKEND_URL = process.env.BACKEND_PUBLIC_URL || process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL || '';
  const rewriteMediaUrl = (url) => {
    if (!url) return null;
    if (!PUBLIC_BACKEND_URL) return url;
    return url.replace(/^http:\/\/localhost:4001/, PUBLIC_BACKEND_URL);
  };

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  // Initialize schema only if core tables are missing
  (async () => {
    try {
      const { rows } = await pool.query("SELECT to_regclass('public.users') AS exists");
      if (!rows[0] || !rows[0].exists) {
        const schemaSql = fs.readFileSync(path.join(__dirname, 'scripts/schema.sql'), 'utf8');
        await pool.query(schemaSql);
        console.log('✓ PostgreSQL schema created');
      } else {
        console.log('✓ PostgreSQL schema present');
      }
      
      // Initialize playlist tables - force recreate with correct schema
      try {
        // Aggressively drop and recreate
        console.log('⏳ Dropping old playlist tables...');
        try { await pool.query("DROP TABLE IF EXISTS playlist_songs CASCADE"); } catch (e) { console.error('Drop playlist_songs error:', e.message); }
        try { await pool.query("DROP TABLE IF EXISTS playlists CASCADE"); } catch (e) { console.error('Drop playlists error:', e.message); }
        
        console.log('📝 Creating playlist tables...');
        const playlistSql = fs.readFileSync(path.join(__dirname, 'scripts/playlists-schema.sql'), 'utf8');
        // Execute as single statement to avoid constraint issues
        const statements = playlistSql.split(';').filter(s => s.trim());
        console.log(`🔍 Found ${statements.length} SQL statements to execute`);
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          try {
            console.log(`  [${i+1}/${statements.length}] Executing...`);
            await pool.query(statement);
            console.log(`  ✓ Statement ${i+1} OK`);
          } catch (stmtErr) {
            console.error(`  ✗ Statement ${i+1} error:`, stmtErr.message);
            if (!stmtErr.message.includes('already exists')) {
              throw stmtErr;
            }
          }
        }
        console.log('✓ Playlist tables initialized');
      } catch (playlistErr) {
        console.error('❌ Playlist table initialization error:', playlistErr.message);
        // Continue even if playlist tables fail - core app still works
      }
      // Seed data from JSON files (idempotent):
      // - Always upsert users from users.json
      // - Insert vinyls/likes only if vinyls table is empty
      try {
        const usersJsonPath = path.join(__dirname, 'users.json');
        const vinylsJsonPath = path.join(__dirname, 'vinyls.json');
        const idMap = new Map(); // old numeric id -> new UUID

        if (fs.existsSync(usersJsonPath)) {
          const uData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf-8'));
          const users = uData.users || [];
          let seededUsers = 0;
          for (const u of users) {
            const ins = await pool.query(
              'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username RETURNING id',
              [u.username, u.passwordHash || u.password, u.role || 'user']
            );
            idMap.set(String(u.id), ins.rows[0].id);
            seededUsers++;
          }
          if (seededUsers > 0) console.log(`✓ Seeded/updated ${seededUsers} users`);
        }

        const vinylsCountRes = await pool.query('SELECT COUNT(*)::int AS c FROM vinyls');
        if (vinylsCountRes.rows[0].c === 0 && fs.existsSync(vinylsJsonPath)) {
          // Only seed if database is empty
          const vData = JSON.parse(fs.readFileSync(vinylsJsonPath, 'utf-8'));
          const vinyls = vData.vinyls || [];
          let vCount = 0, lCount = 0;
          for (const v of vinyls) {
            const ownerUuid = idMap.get(String(v.ownerId)) || [...idMap.values()][0];
            if (!ownerUuid) continue;
            const cover = rewriteMediaUrl(v.coverUrl || null);
            const music = rewriteMediaUrl(v.musicUrl || null);
            const insV = await pool.query(
              'INSERT INTO vinyls (title, artist, year, coverUrl, musicUrl, note, genre, ownerId) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
              [v.title, v.artist, v.year || null, cover, music, v.note || '', 'other', ownerUuid]
            );
            vCount++;
            const vid = insV.rows[0].id;
            if (Array.isArray(v.likes)) {
              for (const oldUid of v.likes) {
                const likeUuid = idMap.get(String(oldUid));
                if (likeUuid) {
                  await pool.query(
                    'INSERT INTO vinyl_likes (vinylId, userId) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                    [vid, likeUuid]
                  );
                  lCount++;
                }
              }
            }
          }
          console.log(`✓ Seeded ${vCount} vinyls and ${lCount} likes`);
        } else {
          console.log(`✓ Database has ${vinylsCountRes.rows[0].c} vinyls (skipping seed)`);
        }
        
        // Restore covers from user uploads instead of Spotify
        try {
          console.log('🔄 Restoring covers to user uploads...');
          const updates = [
            { title: 'End of Beginning ', url: 'https://vinyl-casik-production.up.railway.app/cover-1764876854691-sf7fqr.webp' },
            { title: 'stayinit', url: 'https://vinyl-casik-production.up.railway.app/cover-1764875783647-i1519.webp' },
            { title: 'Views', url: 'https://vinyl-casik-production.up.railway.app/cover-1764859485692-5acwlp.webp' },
            { title: 'Money', url: 'https://vinyl-casik-production.up.railway.app/cover-1764858227013-hrcbhi.webp' },
            { title: 'Money Trees', url: 'https://vinyl-casik-production.up.railway.app/cover-1764858052133-uqgneu.webp' },
            { title: '4x4', url: 'https://vinyl-casik-production.up.railway.app/cover-1764857783748-2behlm.webp' },
            { title: 'Remote Access Memories', url: 'https://vinyl-casik-production.up.railway.app/cover-1764857634229-cojt7.webp' },
            { title: 'Good Lies', url: 'https://vinyl-casik-production.up.railway.app/cover-1764856889093-4a30x9.webp' }
          ];
          
          for (const { title, url } of updates) {
            const res = await pool.query("UPDATE vinyls SET coverUrl = $1 WHERE title = $2", [url, title]);
            console.log(`✓ Updated "${title}" - rows: ${res.rowCount}`);
          }
          console.log('✓ All covers restored to user uploads');
        } catch (coverErr) {
          console.error('Cover restore error:', coverErr.message);
        }
      } catch (seedErr) {
        console.error('Seed warning:', seedErr.message);
      }
    } catch (err) {
      console.error('Schema init warning:', err.message);
    }
  })();

  // Wrapper object that provides async/sync interface
  db = {
    _isPostgres: true,
    _pool: pool,
    
    query: async (sql, params = []) => {
      try {
        return await pool.query(sql, params);
      } catch (err) {
        console.error('Query error:', err.message);
        throw err;
      }
    },
    
    prepare: (sql) => ({
      run: async (...params) => {
        try {
          const result = await pool.query(sql, params);
          return { changes: result.rowCount };
        } catch (err) {
          console.error('Query error:', err.message);
          throw err;
        }
      },
      get: async (...params) => {
        try {
          const result = await pool.query(sql, params);
          return result.rows[0];
        } catch (err) {
          console.error('Query error:', err.message);
          throw err;
        }
      },
      all: async (...params) => {
        try {
          const result = await pool.query(sql, params);
          return result.rows;
        } catch (err) {
          console.error('Query error:', err.message);
          throw err;
        }
      },
    }),
    
    exec: async (sql) => {
      try {
        await pool.query(sql);
      } catch (err) {
        console.error('Exec error:', err.message);
      }
    },
    
    close: async () => {
      await pool.end();
    },
  };

  console.log('✓ Using PostgreSQL database');
} else {
  // Fallback to SQLite (better-sqlite3)
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, 'medioteka.db');

  const sqlite = new Database(dbPath);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS vinyls (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      year INTEGER NOT NULL,
      coverUrl TEXT,
      musicUrl TEXT,
      note TEXT,
      ownerId TEXT NOT NULL,
      FOREIGN KEY (ownerId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS vinyl_likes (
      vinylId TEXT NOT NULL,
      userId TEXT NOT NULL,
      PRIMARY KEY (vinylId, userId),
      FOREIGN KEY (vinylId) REFERENCES vinyls(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  function migrateFromJSON() {
    const usersJsonPath = path.join(__dirname, 'users.json');
    const vinylsJsonPath = path.join(__dirname, 'vinyls.json');
    
    const checkUsers = sqlite.prepare('SELECT COUNT(*) as count FROM users').get();
    if (checkUsers.count > 0) {
      console.log('Database already has data, skipping migration');
      return;
    }

    if (fs.existsSync(usersJsonPath)) {
      const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf-8'));
      const insertUser = sqlite.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)');
      
      const users = usersData.users || usersData;
      users.forEach(user => {
        insertUser.run(user.id.toString(), user.username, user.passwordHash || user.password, user.role);
      });
      console.log(`Migrated ${users.length} users`);
    }

    if (fs.existsSync(vinylsJsonPath)) {
      const vinylsData = JSON.parse(fs.readFileSync(vinylsJsonPath, 'utf-8'));
      const insertVinyl = sqlite.prepare('INSERT INTO vinyls (id, title, artist, year, coverUrl, musicUrl, note, ownerId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const insertLike = sqlite.prepare('INSERT INTO vinyl_likes (vinylId, userId) VALUES (?, ?)');
      
      const vinyls = Array.isArray(vinylsData) ? vinylsData : (vinylsData.vinyls || []);
      vinyls.forEach(vinyl => {
        insertVinyl.run(
          vinyl.id.toString(),
          vinyl.title,
          vinyl.artist,
          vinyl.year,
          vinyl.coverUrl || null,
          vinyl.musicUrl || null,
          vinyl.note || null,
          vinyl.ownerId.toString()
        );
        
        if (vinyl.likes && vinyl.likes.length > 0) {
          vinyl.likes.forEach(userId => {
            try {
              insertLike.run(vinyl.id.toString(), userId.toString());
            } catch (e) {}
          });
        }
      });
      console.log(`Migrated ${vinyls.length} vinyls`);
    }
  }

  migrateFromJSON();
  
  db = sqlite;
  db._isPostgres = false;

  console.log('✓ Using SQLite database (fallback mode)');
}

module.exports = db;
