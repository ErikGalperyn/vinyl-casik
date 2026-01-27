const db = require('../database');

class Playlist {
  // Helper to execute queries based on DB type
  static async query(sql, params = []) {
    if (db._isPostgres) {
      // Use pool.query for PostgreSQL
      const result = await db.query(sql, params);
      return result.rows;
    } else {
      // Use prepared statements for SQLite
      const stmt = db.prepare(sql);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return await stmt.all(...params);
      } else {
        const result = await stmt.run(...params);
        return [{ id: result.lastInsertRowid, changes: result.changes }];
      }
    }
  }

  // Create new playlist
  static async create(name, description, coverUrl, ownerId) {
    const sql = db._isPostgres
      ? `INSERT INTO playlists (name, description, cover_url, owner_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`
      : `INSERT INTO playlists (name, description, cover_url, owner_id)
         VALUES (?, ?, ?, ?)`;
    
    if (db._isPostgres) {
      const result = await db.query(sql, [name, description || null, coverUrl || null, ownerId]);
      return result.rows[0];
    } else {
      const stmt = db.prepare(sql);
      const result = stmt.run(name, description || null, coverUrl || null, ownerId);
      const selectSql = `SELECT * FROM playlists WHERE id = ?`;
      const selectStmt = db.prepare(selectSql);
      return selectStmt.get(result.lastInsertRowid);
    }
  }

  // Get all playlists for a user
  static async getAllByUser(userId) {
    if (db._isPostgres) {
      const sql = `
        SELECT p.*, 
          COUNT(ps.id) as song_count,
          json_agg(
            json_build_object(
              'id', v.id,
              'title', v.title,
              'artist', v.artist,
              'coverUrl', v.cover_url
            ) ORDER BY ps.position
          ) FILTER (WHERE v.id IS NOT NULL) as songs
        FROM playlists p
        LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
        LEFT JOIN vinyls v ON ps.vinyl_id::text = v.id::text
        WHERE p.owner_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `;
      const result = await db.query(sql, [userId]);
      return result.rows;
    } else {
      // SQLite: simplified approach
      const sql = `SELECT * FROM playlists WHERE owner_id = ? ORDER BY created_at DESC`;
      const stmt = db.prepare(sql);
      const playlists = stmt.all(userId);
      
      // Get song count for each playlist
      for (const playlist of playlists) {
        const countSql = `SELECT COUNT(*) as song_count FROM playlist_songs WHERE playlist_id = ?`;
        const countStmt = db.prepare(countSql);
        const countResult = countStmt.get(playlist.id);
        playlist.song_count = countResult.song_count;
      }
      
      return playlists;
    }
  }

  // Get playlist by ID
  static async getById(id, userId) {
    if (db._isPostgres) {
      const sql = `
        SELECT p.*, 
          json_agg(
            json_build_object(
              'id', v.id,
              'title', v.title,
              'artist', v.artist,
              'year', v.year,
              'coverUrl', v.cover_url,
              'musicUrl', v.music_url,
              'note', v.note,
              'position', ps.position
            ) ORDER BY ps.position
          ) FILTER (WHERE v.id IS NOT NULL) as songs
        FROM playlists p
        LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
        LEFT JOIN vinyls v ON ps.vinyl_id::text = v.id::text
        WHERE p.id = $1 AND p.owner_id = $2
        GROUP BY p.id
      `;
      const result = await db.query(sql, [id, userId]);
      return result.rows[0];
    } else {
      const sql = `SELECT * FROM playlists WHERE id = ? AND owner_id = ?`;
      const stmt = db.prepare(sql);
      const playlist = stmt.get(id, userId);
      
      if (!playlist) return null;
      
      // Get songs
      const songsSql = `
        SELECT v.*, ps.position
        FROM playlist_songs ps
        JOIN vinyls v ON ps.vinyl_id = v.id
        WHERE ps.playlist_id = ?
        ORDER BY ps.position
      `;
      const songsStmt = db.prepare(songsSql);
      playlist.songs = songsStmt.all(id);
      
      return playlist;
    }
  }

  // Update playlist
  static async update(id, userId, name, description, coverUrl) {
    const sql = db._isPostgres
      ? `UPDATE playlists
         SET name = $1, description = $2, cover_url = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND owner_id = $5
         RETURNING *`
      : `UPDATE playlists
         SET name = ?, description = ?, cover_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND owner_id = ?`;
    
    if (db._isPostgres) {
      const result = await db.query(sql, [name, description || null, coverUrl || null, id, userId]);
      return result.rows[0];
    } else {
      const stmt = db.prepare(sql);
      stmt.run(name, description || null, coverUrl || null, id, userId);
      const selectSql = `SELECT * FROM playlists WHERE id = ?`;
      const selectStmt = db.prepare(selectSql);
      return selectStmt.get(id);
    }
  }

  // Delete playlist
  static async delete(id, userId) {
    const sql = db._isPostgres
      ? 'DELETE FROM playlists WHERE id = $1 AND owner_id = $2'
      : 'DELETE FROM playlists WHERE id = ? AND owner_id = ?';
    
    if (db._isPostgres) {
      await db.query(sql, [id, userId]);
    } else {
      const stmt = db.prepare(sql);
      stmt.run(id, userId);
    }
  }

  // Add song to playlist
  static async addSong(playlistId, vinylId, userId) {
    // First check if user owns this playlist
    const checkSql = db._isPostgres
      ? 'SELECT id FROM playlists WHERE id = $1 AND owner_id = $2'
      : 'SELECT id FROM playlists WHERE id = ? AND owner_id = ?';
    
    let checkRes;
    if (db._isPostgres) {
      checkRes = await db.query(checkSql, [playlistId, userId]);
      if (checkRes.rows.length === 0) {
        throw new Error('Playlist not found or access denied');
      }
    } else {
      const stmt = db.prepare(checkSql);
      checkRes = stmt.get(playlistId, userId);
      if (!checkRes) {
        throw new Error('Playlist not found or access denied');
      }
    }

    // Get max position
    const posSql = db._isPostgres
      ? 'SELECT COALESCE(MAX(position), -1) as max_pos FROM playlist_songs WHERE playlist_id = $1'
      : 'SELECT COALESCE(MAX(position), -1) as max_pos FROM playlist_songs WHERE playlist_id = ?';
    
    let nextPosition;
    if (db._isPostgres) {
      const posRes = await db.query(posSql, [playlistId]);
      nextPosition = posRes.rows[0].max_pos + 1;
    } else {
      const stmt = db.prepare(posSql);
      const posRes = stmt.get(playlistId);
      nextPosition = posRes.max_pos + 1;
    }

    // Add song
    const sql = db._isPostgres
      ? `INSERT INTO playlist_songs (playlist_id, vinyl_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (playlist_id, vinyl_id) DO NOTHING
         RETURNING *`
      : `INSERT OR IGNORE INTO playlist_songs (playlist_id, vinyl_id, position)
         VALUES (?, ?, ?)`;
    
    if (db._isPostgres) {
      const result = await db.query(sql, [playlistId, vinylId, nextPosition]);
      return result.rows[0];
    } else {
      const stmt = db.prepare(sql);
      const result = stmt.run(playlistId, vinylId, nextPosition);
      return { id: result.lastInsertRowid };
    }
  }

  // Remove song from playlist
  static async removeSong(playlistId, vinylId, userId) {
    // Check ownership
    const checkSql = db._isPostgres
      ? 'SELECT id FROM playlists WHERE id = $1 AND owner_id = $2'
      : 'SELECT id FROM playlists WHERE id = ? AND owner_id = ?';
    
    let checkRes;
    if (db._isPostgres) {
      checkRes = await db.query(checkSql, [playlistId, userId]);
      if (checkRes.rows.length === 0) {
        throw new Error('Playlist not found or access denied');
      }
    } else {
      const stmt = db.prepare(checkSql);
      checkRes = stmt.get(playlistId, userId);
      if (!checkRes) {
        throw new Error('Playlist not found or access denied');
      }
    }

    const sql = db._isPostgres
      ? 'DELETE FROM playlist_songs WHERE playlist_id = $1 AND vinyl_id = $2'
      : 'DELETE FROM playlist_songs WHERE playlist_id = ? AND vinyl_id = ?';
    
    if (db._isPostgres) {
      await db.query(sql, [playlistId, vinylId]);
    } else {
      const stmt = db.prepare(sql);
      stmt.run(playlistId, vinylId);
    }
  }

  // Reorder songs in playlist
  static async reorderSongs(playlistId, userId, songOrder) {
    // Check ownership
    const checkSql = db._isPostgres
      ? 'SELECT id FROM playlists WHERE id = $1 AND owner_id = $2'
      : 'SELECT id FROM playlists WHERE id = ? AND owner_id = ?';
    
    let checkRes;
    if (db._isPostgres) {
      checkRes = await db.query(checkSql, [playlistId, userId]);
      if (checkRes.rows.length === 0) {
        throw new Error('Playlist not found or access denied');
      }
    } else {
      const stmt = db.prepare(checkSql);
      checkRes = stmt.get(playlistId, userId);
      if (!checkRes) {
        throw new Error('Playlist not found or access denied');
      }
    }

    // Update positions for each song
    const sql = db._isPostgres
      ? `UPDATE playlist_songs
         SET position = $1
         WHERE playlist_id = $2 AND vinyl_id = $3`
      : `UPDATE playlist_songs
         SET position = ?
         WHERE playlist_id = ? AND vinyl_id = ?`;
    
    for (let i = 0; i < songOrder.length; i++) {
      const vinylId = songOrder[i];
      if (db._isPostgres) {
        await db.query(sql, [i, playlistId, vinylId]);
      } else {
        const stmt = db.prepare(sql);
        stmt.run(i, playlistId, vinylId);
      }
    }
  }
}

module.exports = Playlist;
