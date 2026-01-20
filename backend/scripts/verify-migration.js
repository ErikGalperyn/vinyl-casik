#!/usr/bin/env node

/**
 * Verification script: Compare SQLite vs PostgreSQL
 * 
 * Usage: node backend/scripts/verify-migration.js
 * 
 * This script:
 * 1. Counts rows in both databases
 * 2. Verifies foreign key relationships
 * 3. Checks for data consistency
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
  cyan: '\x1b[36m',
};

function log(type, message) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    warn: `${colors.yellow}⚠${colors.reset}`,
  }[type] || type;
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function verify() {
  log('info', 'Starting database verification...\n');

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
    process.exit(1);
  }

  const client = await pgPool.connect();

  try {
    // Get counts from both databases
    const sqliteUsers = sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const sqliteVinyls = sqliteDb.prepare('SELECT COUNT(*) as count FROM vinyls').get().count;
    const sqliteLikes = sqliteDb.prepare('SELECT COUNT(*) as count FROM vinyl_likes').get().count;

    const pgUsers = await client.query('SELECT COUNT(*) as count FROM users');
    const pgVinyls = await client.query('SELECT COUNT(*) as count FROM vinyls');
    const pgLikes = await client.query('SELECT COUNT(*) as count FROM vinyl_likes');

    console.log('\n' + '='.repeat(70));
    console.log(`${colors.cyan}DATABASE COMPARISON${colors.reset}`);
    console.log('='.repeat(70));

    const tables = [
      { name: 'users', sqlite: sqliteUsers, pg: parseInt(pgUsers.rows[0].count) },
      { name: 'vinyls', sqlite: sqliteVinyls, pg: parseInt(pgVinyls.rows[0].count) },
      { name: 'vinyl_likes', sqlite: sqliteLikes, pg: parseInt(pgLikes.rows[0].count) },
    ];

    let allMatch = true;
    for (const table of tables) {
      const match = table.sqlite === table.pg ? '✓' : '✗';
      const status = table.sqlite === table.pg ? colors.green : colors.red;
      console.log(
        `${status}${match}${colors.reset} ${table.name.padEnd(15)} | SQLite: ${table.sqlite.toString().padStart(4)} | PostgreSQL: ${table.pg.toString().padStart(4)}`
      );
      if (table.sqlite !== table.pg) {
        allMatch = false;
      }
    }

    console.log('='.repeat(70) + '\n');

    // Check foreign keys
    log('info', 'Checking foreign key integrity...');

    const orphanVinyls = sqliteDb.prepare(
      `SELECT COUNT(*) as count FROM vinyls 
       WHERE ownerId NOT IN (SELECT id FROM users)`
    ).get().count;

    const orphanVinylsCount = (await client.query(
      `SELECT COUNT(*) as count FROM vinyls 
       WHERE ownerId NOT IN (SELECT id FROM users)`
    )).rows[0].count;

    const orphanLikes = sqliteDb.prepare(
      `SELECT COUNT(*) as count FROM vinyl_likes 
       WHERE vinylId NOT IN (SELECT id FROM vinyls) 
       OR userId NOT IN (SELECT id FROM users)`
    ).get().count;

    const orphanLikesCount = (await client.query(
      `SELECT COUNT(*) as count FROM vinyl_likes 
       WHERE vinylId NOT IN (SELECT id FROM vinyls) 
       OR userId NOT IN (SELECT id FROM users)`
    )).rows[0].count;

    console.log('='.repeat(70));
    console.log(`${colors.cyan}FOREIGN KEY INTEGRITY${colors.reset}`);
    console.log('='.repeat(70));

    if (orphanVinyls === 0 && orphanVinylsCount === 0) {
      console.log(`${colors.green}✓${colors.reset} All vinyls have valid owners (SQLite: 0, PostgreSQL: 0)`);
    } else {
      console.log(`${colors.red}✗${colors.reset} Orphaned vinyls found (SQLite: ${orphanVinyls}, PostgreSQL: ${orphanVinylsCount})`);
      allMatch = false;
    }

    if (orphanLikes === 0 && orphanLikesCount === 0) {
      console.log(`${colors.green}✓${colors.reset} All likes have valid references (SQLite: 0, PostgreSQL: 0)`);
    } else {
      console.log(`${colors.red}✗${colors.reset} Invalid likes found (SQLite: ${orphanLikes}, PostgreSQL: ${orphanLikesCount})`);
      allMatch = false;
    }

    console.log('='.repeat(70) + '\n');

    // Additional data consistency checks
    log('info', 'Running additional data consistency checks...');

    // Check for unique usernames
    const duplicateUsernames = sqliteDb.prepare(
      'SELECT COUNT(*) as count FROM (SELECT username, COUNT(*) as c FROM users GROUP BY username HAVING c > 1)'
    ).get().count;

    const pgDuplicateUsernames = (await client.query(
      'SELECT COUNT(*) as count FROM (SELECT username, COUNT(*) as c FROM users GROUP BY username HAVING c > 1) sub'
    )).rows[0].count;

    console.log('='.repeat(70));
    console.log(`${colors.cyan}DATA CONSISTENCY CHECKS${colors.reset}`);
    console.log('='.repeat(70));

    if (duplicateUsernames === 0 && pgDuplicateUsernames === 0) {
      console.log(`${colors.green}✓${colors.reset} No duplicate usernames`);
    } else {
      console.log(`${colors.red}✗${colors.reset} Duplicate usernames found`);
      allMatch = false;
    }

    // Check for valid roles
    const invalidRoles = sqliteDb.prepare(
      `SELECT COUNT(*) as count FROM users WHERE role NOT IN ('admin', 'user')`
    ).get().count;

    const pgInvalidRoles = (await client.query(
      `SELECT COUNT(*) as count FROM users WHERE role NOT IN ('admin', 'user')`
    )).rows[0].count;

    if (invalidRoles === 0 && pgInvalidRoles === 0) {
      console.log(`${colors.green}✓${colors.reset} All user roles are valid (admin/user)`);
    } else {
      console.log(`${colors.red}✗${colors.reset} Invalid roles found`);
      allMatch = false;
    }

    console.log('='.repeat(70) + '\n');

    if (allMatch) {
      log('success', 'All verification checks passed! ✓\n');
      log('info', 'The database migration was successful.');
      log('info', 'You can now use: DATABASE_TYPE=postgres npm run dev');
    } else {
      log('warn', 'Some verification checks failed. Review the results above.\n');
    }

  } catch (err) {
    log('error', `Verification failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pgPool.end();
    sqliteDb.close();
  }
}

verify().catch(err => {
  log('error', `Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
