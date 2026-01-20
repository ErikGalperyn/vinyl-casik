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

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  // Initialize schema on first connection
  (async () => {
    try {
      const initSql = fs.readFileSync(path.join(__dirname, 'scripts/upgrade-schema.sql'), 'utf8');
      await pool.query(initSql);
      console.log('✓ PostgreSQL schema initialized');
    } catch (err) {
      if (err.code !== '42P07') { // Ignore "relation already exists" error
        console.error('Schema init warning:', err.message);
      }
    }
  })();

  // Wrapper object that provides async/sync interface
  db = {
    _isPostgres: true,
    _pool: pool,
    
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
