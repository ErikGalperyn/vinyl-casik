// Script to create playlist tables
const db = require('../database');
const fs = require('fs');
const path = require('path');

async function migrate() {
  try {
    console.log('Creating playlist tables...');
    
    if (db._isPostgres) {
      // PostgreSQL
      const sql = fs.readFileSync(path.join(__dirname, 'playlists-schema.sql'), 'utf8');
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await db.query(statement);
        }
      }
    } else {
      // SQLite
      const sqliteSql = `
        CREATE TABLE IF NOT EXISTS playlists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          cover_url TEXT,
          owner_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS playlist_songs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          playlist_id INTEGER NOT NULL,
          vinyl_id INTEGER NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
          FOREIGN KEY (vinyl_id) REFERENCES vinyls(id) ON DELETE CASCADE,
          UNIQUE(playlist_id, vinyl_id)
        );

        CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
        CREATE INDEX IF NOT EXISTS idx_playlist_songs_position ON playlist_songs(playlist_id, position);
        CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_id);
      `;

      const statements = sqliteSql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          db.prepare(statement).run();
        }
      }
    }
    
    console.log('✅ Playlist tables created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
