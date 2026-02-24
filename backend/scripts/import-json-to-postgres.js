#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const getPoolConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }

  return {
    user: process.env.DB_USER || 'medioteka_user',
    password: process.env.DB_PASSWORD || 'medioteka_password',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'medioteka_db',
  };
};

const pool = new Pool(getPoolConfig());
const PUBLIC_BACKEND_URL = process.env.BACKEND_PUBLIC_URL || process.env.PUBLIC_BACKEND_URL || process.env.RENDER_EXTERNAL_URL || '';
const rewriteMediaUrl = (url) => {
  if (!url) return null;
  if (!PUBLIC_BACKEND_URL) return url;
  return String(url)
    .replace(/^http:\/\/localhost:4001/, PUBLIC_BACKEND_URL)
    .replace(/^https:\/\/vinyl-casik-production\.up\.railway\.app/, PUBLIC_BACKEND_URL);
};

async function ensureSchema(client) {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.query(schemaSql);
}

async function importData() {
  console.log('📦 Starting JSON → PostgreSQL import...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureSchema(client);

    const usersPath = path.join(__dirname, '..', 'users.json');
    const vinylsPath = path.join(__dirname, '..', 'vinyls.json');
    const oldToNewUserId = new Map();
    const oldToNewVinylId = new Map();

    if (fs.existsSync(usersPath)) {
      const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      const users = usersData.users || [];

      for (const user of users) {
        if (!user.username) continue;
        const password = user.passwordHash || user.password;

        const res = await client.query(
          `INSERT INTO users (username, password, role)
           VALUES ($1, $2, $3)
           ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
           RETURNING id`,
          [user.username, password, user.role || 'user']
        );

        if (user.id != null) {
          oldToNewUserId.set(String(user.id), res.rows[0].id);
        }
      }

      console.log(`✓ Imported/upserted ${users.length} users`);
    }

    if (fs.existsSync(vinylsPath)) {
      const vinylsData = JSON.parse(fs.readFileSync(vinylsPath, 'utf8'));
      const vinyls = vinylsData.vinyls || [];

      for (const vinyl of vinyls) {
        if (!vinyl.title || !vinyl.artist) continue;

        const ownerUuid = oldToNewUserId.get(String(vinyl.ownerId)) || [...oldToNewUserId.values()][0] || null;
        if (!ownerUuid) continue;

        const existing = await client.query(
          'SELECT id FROM vinyls WHERE title = $1 AND artist = $2 AND ownerId = $3 ORDER BY created_at DESC LIMIT 1',
          [vinyl.title, vinyl.artist, ownerUuid]
        );

        let createdId = existing.rows[0]?.id;
        if (!createdId) {
          const res = await client.query(
            `INSERT INTO vinyls (title, artist, year, coverUrl, musicUrl, note, genre, ownerId)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
              vinyl.title,
              vinyl.artist,
              vinyl.year || 2020,
              rewriteMediaUrl(vinyl.coverUrl || null),
              rewriteMediaUrl(vinyl.musicUrl || null),
              vinyl.note || '',
              'other',
              ownerUuid
            ]
          );
          createdId = res.rows[0]?.id;
        }

        if (vinyl.id != null && createdId) {
          oldToNewVinylId.set(String(vinyl.id), createdId);
        }

        if (createdId && Array.isArray(vinyl.likes)) {
          for (const oldUserId of vinyl.likes) {
            const likeUserId = oldToNewUserId.get(String(oldUserId));
            if (!likeUserId) continue;
            await client.query(
              'INSERT INTO vinyl_likes (vinylId, userId) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [createdId, likeUserId]
            );
          }
        }
      }

      console.log(`✓ Imported/upserted ${vinyls.length} vinyls`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Import completed successfully!');

    const userCount = await client.query('SELECT COUNT(*)::int AS c FROM users');
    const vinylCount = await client.query('SELECT COUNT(*)::int AS c FROM vinyls');
    const likeCount = await client.query('SELECT COUNT(*)::int AS c FROM vinyl_likes');

    console.log('\n📊 Database stats:');
    console.log(`   Users: ${userCount.rows[0].c}`);
    console.log(`   Vinyls: ${vinylCount.rows[0].c}`);
    console.log(`   Likes: ${likeCount.rows[0].c}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Import failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

importData().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
