#!/usr/bin/env node

/**
 * Migration script: SQLite → PostgreSQL
 * 
 * Usage: node backend/scripts/migrate-sqlite-to-postgres.js
 * 
 * This script:
 * 1. Reads all data from SQLite (better-sqlite3)
 * 2. Initializes PostgreSQL schema
 * 3. Inserts data with proper transaction handling
 * 4. Validates data integrity
 */

const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(type, message) {
  const timestamp = new Date().toISOString();
  const prefix = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    warn: `${colors.yellow}⚠${colors.reset}`,
  }[type] || type;
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function migrate() {
  log('info', 'Starting SQLite to PostgreSQL migration...\n');

  // Initialize SQLite connection
  const sqliteDbPath = path.join(__dirname, '..', 'medioteka.db');
  let sqliteDb;
  
  try {
    sqliteDb = new Database(sqliteDbPath);
    log('success', `Connected to SQLite: ${sqliteDbPath}`);
  } catch (err) {
    log('error', `Failed to open SQLite database: ${err.message}`);
    process.exit(1);
  }

  // Initialize PostgreSQL connection
  const pgPool = new Pool({
    user: process.env.DB_USER || 'medioteka_user',
    password: process.env.DB_PASSWORD || 'medioteka_password',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'medioteka_db',
  });

  try {
    await pgPool.query('SELECT 1');
    log('success', `Connected to PostgreSQL at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
  } catch (err) {
    log('error', `Failed to connect to PostgreSQL: ${err.message}`);
    log('error', 'Make sure Docker is running: docker-compose up -d');
    process.exit(1);
  }

  const client = await pgPool.connect();

  try {
    // Step 1: Create schema
    log('info', 'Creating PostgreSQL schema...');
    await client.query(`
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

      CREATE INDEX IF NOT EXISTS idx_vinyls_ownerId ON vinyls(ownerId);
      CREATE INDEX IF NOT EXISTS idx_vinyl_likes_vinylId ON vinyl_likes(vinylId);
      CREATE INDEX IF NOT EXISTS idx_vinyl_likes_userId ON vinyl_likes(userId);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    log('success', 'Schema created');

    // Step 2: Migrate users
    log('info', 'Migrating users...');
    const users = sqliteDb.prepare('SELECT * FROM users').all();
    
    if (users.length > 0) {
      await client.query('BEGIN');
      
      for (const user of users) {
        await client.query(
          `INSERT INTO users (id, username, password, role) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [user.id, user.username, user.password, user.role || 'user']
        );
      }
      
      await client.query('COMMIT');
      log('success', `Migrated ${users.length} users`);
    } else {
      log('warn', 'No users found in SQLite');
    }

    // Step 3: Migrate vinyls
    log('info', 'Migrating vinyls...');
    const vinyls = sqliteDb.prepare('SELECT * FROM vinyls').all();
    
    if (vinyls.length > 0) {
      await client.query('BEGIN');
      
      for (const vinyl of vinyls) {
        await client.query(
          `INSERT INTO vinyls (id, title, artist, year, coverUrl, musicUrl, note, ownerId) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            vinyl.id,
            vinyl.title,
            vinyl.artist,
            vinyl.year,
            vinyl.coverUrl || null,
            vinyl.musicUrl || null,
            vinyl.note || null,
            vinyl.ownerId
          ]
        );
      }
      
      await client.query('COMMIT');
      log('success', `Migrated ${vinyls.length} vinyls`);
    } else {
      log('warn', 'No vinyls found in SQLite');
    }

    // Step 4: Migrate vinyl_likes
    log('info', 'Migrating vinyl likes...');
    const likes = sqliteDb.prepare('SELECT * FROM vinyl_likes').all();
    
    if (likes.length > 0) {
      await client.query('BEGIN');
      
      for (const like of likes) {
        await client.query(
          `INSERT INTO vinyl_likes (vinylId, userId) 
           VALUES ($1, $2)
           ON CONFLICT (vinylId, userId) DO NOTHING`,
          [like.vinylId, like.userId]
        );
      }
      
      await client.query('COMMIT');
      log('success', `Migrated ${likes.length} vinyl likes`);
    } else {
      log('info', 'No vinyl likes found in SQLite');
    }

    // Step 5: Verify migration
    log('info', 'Verifying migration...\n');
    
    const pgUsers = await client.query('SELECT COUNT(*) as count FROM users');
    const pgVinyls = await client.query('SELECT COUNT(*) as count FROM vinyls');
    const pgLikes = await client.query('SELECT COUNT(*) as count FROM vinyl_likes');

    const counts = {
      users: { sqlite: users.length, postgres: parseInt(pgUsers.rows[0].count) },
      vinyls: { sqlite: vinyls.length, postgres: parseInt(pgVinyls.rows[0].count) },
      likes: { sqlite: likes.length, postgres: parseInt(pgLikes.rows[0].count) },
    };

    console.log('\n' + '='.repeat(50));
    console.log('Migration Results:');
    console.log('='.repeat(50));
    
    let allMatch = true;
    for (const [table, counts_data] of Object.entries(counts)) {
      const match = counts_data.sqlite === counts_data.postgres ? '✓' : '✗';
      console.log(
        `${match} ${table.padEnd(10)} | SQLite: ${counts_data.sqlite.toString().padStart(3)} → PostgreSQL: ${counts_data.postgres.toString().padStart(3)}`
      );
      if (counts_data.sqlite !== counts_data.postgres) {
        allMatch = false;
      }
    }
    
    console.log('='.repeat(50) + '\n');

    // Check foreign key integrity
    log('info', 'Checking foreign key integrity...');
    
    const orphanVinyls = await client.query(
      `SELECT COUNT(*) as count FROM vinyls 
       WHERE ownerId NOT IN (SELECT id FROM users)`
    );
    
    const orphanLikes = await client.query(
      `SELECT COUNT(*) as count FROM vinyl_likes 
       WHERE vinylId NOT IN (SELECT id FROM vinyls) 
       OR userId NOT IN (SELECT id FROM users)`
    );

    const orphanVinylsCount = parseInt(orphanVinyls.rows[0].count);
    const orphanLikesCount = parseInt(orphanLikes.rows[0].count);

    if (orphanVinylsCount > 0) {
      log('warn', `Found ${orphanVinylsCount} vinyls with non-existent owners`);
    } else {
      log('success', 'All vinyls have valid owners');
    }

    if (orphanLikesCount > 0) {
      log('warn', `Found ${orphanLikesCount} likes with invalid references`);
    } else {
      log('success', 'All likes have valid references');
    }

    if (allMatch && orphanVinylsCount === 0 && orphanLikesCount === 0) {
      log('success', '\n✓ Migration completed successfully!');
      log('info', 'Backend is ready to use PostgreSQL.');
      log('info', 'Set DATABASE_TYPE=postgres environment variable.');
    } else {
      log('warn', '\n⚠ Migration completed with warnings. Review the results above.');
    }

  } catch (err) {
    log('error', `Migration failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pgPool.end();
    sqliteDb.close();
    log('info', 'Database connections closed');
  }
}

migrate().catch(err => {
  log('error', `Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
