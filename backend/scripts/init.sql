-- PostgreSQL schema initialization for medioteka
-- Run this after docker-compose is up

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vinyl_likes (
  vinylId TEXT NOT NULL,
  userId TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vinylId, userId),
  FOREIGN KEY (vinylId) REFERENCES vinyls(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_vinyls_ownerId ON vinyls(ownerId);
CREATE INDEX IF NOT EXISTS idx_vinyl_likes_vinylId ON vinyl_likes(vinylId);
CREATE INDEX IF NOT EXISTS idx_vinyl_likes_userId ON vinyl_likes(userId);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

COMMIT;
