-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cover_url TEXT,
  owner_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Playlist songs junction table with order
CREATE TABLE IF NOT EXISTS playlist_songs (
  id SERIAL PRIMARY KEY,
  playlist_id INTEGER NOT NULL,
  vinyl_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (vinyl_id) REFERENCES vinyls(id) ON DELETE CASCADE,
  UNIQUE(playlist_id, vinyl_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_position ON playlist_songs(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_id);
