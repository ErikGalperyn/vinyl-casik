-- Fresh PostgreSQL schema for MedioteKa with UUIDs and enums
-- Safe to run on an empty database. If objects exist, ignore duplicate errors.

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin', 'moderator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vinyl_genre AS ENUM ('rock', 'pop', 'jazz', 'electronic', 'classical', 'hiphop', 'indie', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL CHECK (length(username) >= 3 AND length(username) <= 50),
  password VARCHAR(255) NOT NULL CHECK (length(password) >= 8),
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vinyls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL CHECK (length(title) >= 1 AND length(title) <= 255),
  artist VARCHAR(255) NOT NULL CHECK (length(artist) >= 1 AND length(artist) <= 255),
  year INTEGER NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
  coverUrl TEXT CHECK (coverUrl IS NULL OR coverUrl ~ '^https?://'),
  musicUrl TEXT CHECK (musicUrl IS NULL OR musicUrl ~ '^https?://'),
  note TEXT DEFAULT '',
  genre vinyl_genre DEFAULT 'other',
  ownerId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vinyl_likes (
  vinylId UUID NOT NULL REFERENCES vinyls(id) ON DELETE CASCADE,
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vinylId, userId)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_vinyls_ownerid ON vinyls(ownerId);
CREATE INDEX IF NOT EXISTS idx_vinyls_genre ON vinyls(genre);
CREATE INDEX IF NOT EXISTS idx_vinyl_likes_userid ON vinyl_likes(userId);
CREATE INDEX IF NOT EXISTS idx_vinyl_likes_vinylid ON vinyl_likes(vinylId);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trigger_vinyls_timestamp
  BEFORE UPDATE ON vinyls
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
