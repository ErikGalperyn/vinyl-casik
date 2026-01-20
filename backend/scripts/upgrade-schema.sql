-- Upgrade schema: Add ENUMs, UUID, and CHECK constraints
-- Run this migration to improve data integrity

-- Step 1: Create ENUM types
CREATE TYPE user_role AS ENUM ('user', 'admin', 'moderator');
CREATE TYPE vinyl_genre AS ENUM ('rock', 'pop', 'jazz', 'electronic', 'classical', 'hiphop', 'indie', 'other');

-- Step 2: Alter users table
ALTER TABLE vinyl_likes DROP CONSTRAINT vinyl_likes_userid_fkey;
ALTER TABLE vinyls DROP CONSTRAINT vinyls_ownerid_fkey;

-- Recreate users table with UUID and constraints
CREATE TABLE users_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL CHECK (length(username) >= 3 AND length(username) <= 50),
  password VARCHAR(255) NOT NULL CHECK (length(password) >= 8),
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate data: convert text IDs to UUID (use cast or create mapping)
INSERT INTO users_new (id, username, password, role, created_at)
SELECT 
  ('00000000-0000-0000-0000-000000000' || lpad(id, 3, '0'))::UUID,
  username,
  password,
  CASE role WHEN 'admin' THEN 'admin'::user_role WHEN 'moderator' THEN 'moderator'::user_role ELSE 'user'::user_role END,
  created_at
FROM users;

DROP TABLE users CASCADE;
ALTER TABLE users_new RENAME TO users;

-- Step 3: Recreate vinyls table with UUID and constraints
CREATE TABLE vinyls_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL CHECK (length(title) >= 1 AND length(title) <= 255),
  artist VARCHAR(255) NOT NULL CHECK (length(artist) >= 1 AND length(artist) <= 255),
  year INTEGER NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
  coverUrl TEXT CHECK (coverUrl IS NULL OR coverUrl ~ '^https?://'),
  musicUrl TEXT CHECK (musicUrl IS NULL OR musicUrl ~ '^https?://'),
  note TEXT DEFAULT '',
  genre vinyl_genre DEFAULT 'other',
  ownerId UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate data
INSERT INTO vinyls_new (id, title, artist, year, coverUrl, musicUrl, note, genre, ownerId, created_at, updated_at)
SELECT 
  ('11111111-1111-1111-1111-111111111' || lpad(id, 3, '0'))::UUID,
  title,
  artist,
  year,
  coverUrl,
  musicUrl,
  note,
  'other'::vinyl_genre,
  ('00000000-0000-0000-0000-000000000' || lpad(CAST(ownerId AS text), 3, '0'))::UUID,
  created_at,
  updated_at
FROM vinyls;

DROP TABLE vinyls CASCADE;
ALTER TABLE vinyls_new RENAME TO vinyls;

-- Add foreign key back
ALTER TABLE vinyls ADD CONSTRAINT vinyls_ownerid_fkey 
FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_vinyls_ownerid ON vinyls(ownerId);
CREATE INDEX idx_vinyls_genre ON vinyls(genre);

-- Step 4: Recreate vinyl_likes with UUID
CREATE TABLE vinyl_likes_new (
  vinylId UUID NOT NULL,
  userId UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vinylId, userId)
);

-- Migrate data
INSERT INTO vinyl_likes_new (vinylId, userId, created_at)
SELECT 
  ('11111111-1111-1111-1111-111111111' || lpad(vinylId, 3, '0'))::UUID,
  ('00000000-0000-0000-0000-000000000' || lpad(CAST(userId AS text), 3, '0'))::UUID,
  created_at
FROM vinyl_likes;

DROP TABLE vinyl_likes;
ALTER TABLE vinyl_likes_new RENAME TO vinyl_likes;

-- Add foreign keys
ALTER TABLE vinyl_likes ADD CONSTRAINT vinyl_likes_vinylid_fkey 
FOREIGN KEY (vinylId) REFERENCES vinyls(id) ON DELETE CASCADE;

ALTER TABLE vinyl_likes ADD CONSTRAINT vinyl_likes_userid_fkey 
FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_vinyl_likes_userid ON vinyl_likes(userId);
CREATE INDEX idx_vinyl_likes_vinylid ON vinyl_likes(vinylId);

-- Step 5: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vinyls_timestamp
BEFORE UPDATE ON vinyls
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

COMMIT;
