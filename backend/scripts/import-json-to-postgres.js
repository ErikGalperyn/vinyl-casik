#!/usr/bin/env node

/**
 * Import JSON data to PostgreSQL
 * Usage: node backend/scripts/import-json-to-postgres.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'medioteka_user',
  password: process.env.DB_PASSWORD || 'medioteka_password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'medioteka_db',
});

async function importData() {
  console.log('📦 Starting JSON to PostgreSQL import...\n');

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Import users
    const usersPath = path.join(__dirname, '..', 'users.json');
    if (fs.existsSync(usersPath)) {
      const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      const users = usersData.users || [];
      
      for (const user of users) {
        if (user.id && user.username) {
          const password = user.passwordHash || user.password;
          await client.query(
            'INSERT INTO users (id, username, password, role, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (id) DO NOTHING',
            [user.id.toString(), user.username, password, user.role || 'user']
          );
        }
      }
      console.log(`✓ Imported ${users.length} users`);
    }

    // Import vinyls
    const vinylsPath = path.join(__dirname, '..', 'vinyls.json');
    if (fs.existsSync(vinylsPath)) {
      const vinylsData = JSON.parse(fs.readFileSync(vinylsPath, 'utf8'));
      const vinyls = vinylsData.vinyls || [];
      
      for (const vinyl of vinyls) {
        if (vinyl.id && vinyl.title && vinyl.artist && vinyl.ownerId) {
          await client.query(
            'INSERT INTO vinyls (id, title, artist, year, coverUrl, musicUrl, note, ownerId, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) ON CONFLICT (id) DO NOTHING',
            [vinyl.id.toString(), vinyl.title, vinyl.artist, vinyl.year || 2020, vinyl.coverUrl, vinyl.musicUrl, vinyl.note || '', vinyl.ownerId.toString()]
          );

          // Import likes
          if (vinyl.likes && Array.isArray(vinyl.likes)) {
            for (const userId of vinyl.likes) {
              await client.query(
                'INSERT INTO vinyl_likes (vinylId, userId, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (vinylId, userId) DO NOTHING',
                [vinyl.id.toString(), userId.toString()]
              );
            }
          }
        }
      }
      console.log(`✓ Imported ${vinyls.length} vinyls`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Import completed successfully!');

    // Show stats
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const vinylCount = await client.query('SELECT COUNT(*) FROM vinyls');
    const likeCount = await client.query('SELECT COUNT(*) FROM vinyl_likes');

    console.log('\n📊 Database stats:');
    console.log(`   Users: ${userCount.rows[0].count}`);
    console.log(`   Vinyls: ${vinylCount.rows[0].count}`);
    console.log(`   Likes: ${likeCount.rows[0].count}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Import failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

importData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
