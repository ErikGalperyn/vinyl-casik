# SQLite to PostgreSQL Migration Guide

This guide walks you through migrating the medioteka database from SQLite to PostgreSQL using Docker.

## Overview

- **Current**: SQLite (backend/medioteka.db)
- **Target**: PostgreSQL 16 (Docker container)
- **Zero Data Loss**: All data is preserved with proper foreign key constraints
- **Fallback**: SQLite remains available as a fallback database

## Prerequisites

- Docker and Docker Compose installed
- Node.js 16+
- The medioteka application running

## Step 1: Start PostgreSQL Container

```bash
cd bookstore

# Start PostgreSQL and PGAdmin
docker-compose up -d

# Verify containers are running
docker-compose ps

# Wait for PostgreSQL to be ready (check logs)
docker-compose logs postgres
```

**Expected output**: "database system is ready to accept connections"

**PGAdmin access**: http://localhost:5050
- Email: `admin@medioteka.local`
- Password: `admin`

## Step 2: Install PostgreSQL Driver

```bash
cd backend

# Install pg driver (should already be in package.json)
npm install pg
```

## Step 3: Run Migration Script

```bash
# From backend directory
node scripts/migrate-sqlite-to-postgres.js
```

**What this does**:
1. Reads all data from SQLite
2. Creates PostgreSQL schema with proper indexes
3. Inserts data preserving all IDs and relationships
4. Validates data integrity with foreign key checks
5. Prints detailed progress logs

**Expected output**: Migration summary with row counts for users, vinyls, and vinyl_likes

## Step 4: Verify Migration

```bash
# Compare SQLite vs PostgreSQL data
node scripts/verify-migration.js
```

**This script checks**:
- Row count matching (users, vinyls, vinyl_likes)
- Foreign key integrity
- No orphaned records
- Valid user roles
- No duplicate usernames

## Step 5: Switch Backend to PostgreSQL

Edit your `.env` file:

```bash
# Copy example if you don't have .env yet
cp .env.example .env

# Edit .env and set:
DATABASE_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=medioteka_user
DB_PASSWORD=medioteka_password
DB_NAME=medioteka_db
```

## Step 6: Start Application with PostgreSQL

```bash
# From project root
DATABASE_TYPE=postgres npm run dev
```

Or if using the environment variable in `.env`:

```bash
npm run dev
```

## Testing

Test the application with:

```bash
# Test user registration/login
curl -X POST http://localhost:4001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'

# Test getting vinyls
curl -X GET http://localhost:4001/vinyls \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Rollback Plan

If you need to switch back to SQLite:

```bash
# Stop using PostgreSQL
unset DATABASE_TYPE
# or set DATABASE_TYPE=sqlite in .env

# Restart the app
npm run dev
```

**Note**: SQLite database is still intact at `backend/medioteka.db`

## Database Details

### Tables Created

#### `users`
- `id` (TEXT PRIMARY KEY)
- `username` (TEXT UNIQUE)
- `password` (TEXT)
- `role` (TEXT DEFAULT 'user')
- `created_at` (TIMESTAMP)

#### `vinyls`
- `id` (TEXT PRIMARY KEY)
- `title`, `artist`, `year` (TEXT/INT)
- `coverUrl`, `musicUrl` (TEXT nullable)
- `note` (TEXT nullable)
- `ownerId` (FK → users.id, CASCADE)
- `created_at`, `updated_at` (TIMESTAMP)

#### `vinyl_likes`
- `vinylId` (FK → vinyls.id, CASCADE)
- `userId` (FK → users.id, CASCADE)
- PRIMARY KEY: (vinylId, userId)
- `created_at` (TIMESTAMP)

### Indexes Created

```sql
CREATE INDEX idx_vinyls_ownerId ON vinyls(ownerId);
CREATE INDEX idx_vinyl_likes_vinylId ON vinyl_likes(vinylId);
CREATE INDEX idx_vinyl_likes_userId ON vinyl_likes(userId);
CREATE INDEX idx_users_username ON users(username);
```

## Troubleshooting

### "Cannot connect to PostgreSQL"

```bash
# Check if containers are running
docker-compose ps

# Restart containers
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### "Migration script fails"

```bash
# Verify SQLite database exists
ls -la backend/medioteka.db

# Verify PostgreSQL is accessible
docker-compose exec postgres psql -U medioteka_user -d medioteka_db -c "SELECT COUNT(*) FROM users;"
```

### "Foreign key errors"

This means there's data inconsistency in SQLite. Check:

```bash
# SQLite
sqlite3 backend/medioteka.db ".mode line" "SELECT * FROM vinyls WHERE ownerId NOT IN (SELECT id FROM users);"

# PostgreSQL
docker-compose exec postgres psql -U medioteka_user -d medioteka_db -c "SELECT * FROM vinyls WHERE ownerId NOT IN (SELECT id FROM users);"
```

### Duplicate usernames error

Edit SQLite before migrating:

```bash
sqlite3 backend/medioteka.db "DELETE FROM users WHERE id NOT IN (SELECT MIN(id) FROM users GROUP BY username);"
```

## Files Modified/Created

```
├── docker-compose.yml                          (NEW)
├── .env.example                                (UPDATED)
├── backend/
│   ├── package.json                           (UPDATED: added pg)
│   ├── database.js                            (UPDATED: PostgreSQL support)
│   ├── server.js                              (UPDATED: async/await routes)
│   ├── models/
│   │   ├── users.sql.js                       (UPDATED: async functions)
│   │   └── vinyl.sql.js                       (UPDATED: async + SQL variants)
│   └── scripts/
│       ├── init.sql                           (NEW: PostgreSQL schema)
│       ├── migrate-sqlite-to-postgres.js      (NEW: migration script)
│       └── verify-migration.js                (NEW: verification script)
```

## Performance Notes

PostgreSQL provides better performance for:
- Complex queries with multiple JOINs
- Large datasets (100k+ rows)
- Concurrent connections
- Transaction handling

SQLite is still fine for:
- Simple read/write operations
- Single-user/small-team usage
- Development/testing

## Next Steps

1. ✓ Run migration script
2. ✓ Verify data integrity
3. ✓ Switch backend to PostgreSQL
4. ✓ Test all features
5. Optional: Remove SQLite once confident

## Support

For issues:
1. Check migration logs: `node scripts/migrate-sqlite-to-postgres.js`
2. Verify data: `node scripts/verify-migration.js`
3. Check PostgreSQL: `docker-compose logs postgres`
4. Review database.js for connection details
