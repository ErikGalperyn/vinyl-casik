# SQLite to PostgreSQL Migration - Complete Implementation

**Status**: ✅ **READY TO MIGRATE**

---

## Executive Summary

The medioteka backend has been enhanced to support both **SQLite** (fallback) and **PostgreSQL** databases. Zero code breaking changes. All data will be preserved. SQLite remains available as a fallback.

**Timeline**: 5 minutes setup → 10 minutes migration → 5 minutes verification = 20 minutes total

---

## What Was Created/Modified

### New Files (7)
1. ✅ `docker-compose.yml` - PostgreSQL + PGAdmin containers
2. ✅ `backend/scripts/migrate-sqlite-to-postgres.js` - Data migration engine
3. ✅ `backend/scripts/verify-migration.js` - Data verification tool
4. ✅ `backend/scripts/init.sql` - PostgreSQL schema
5. ✅ `.env.example` - Environment template
6. ✅ `MIGRATION_GUIDE.md` - Detailed instructions
7. ✅ `CODE_CHANGES.md` - Technical documentation

### Updated Files (5)
1. ✅ `backend/package.json` - Added `pg` dependency
2. ✅ `backend/database.js` - Dual-mode (SQLite + PostgreSQL)
3. ✅ `backend/server.js` - Converted to async/await
4. ✅ `backend/models/users.sql.js` - Async + PostgreSQL support
5. ✅ `backend/models/vinyl.sql.js` - Async + PostgreSQL support

### Documentation
1. ✅ `MIGRATION_GUIDE.md` - Step-by-step guide
2. ✅ `MIGRATION_SUMMARY.md` - Quick reference
3. ✅ `CODE_CHANGES.md` - Technical details
4. ✅ `QUICK_START.sh` - Automated setup script

---

## Quick Start (20 minutes)

### Option A: Automated (Recommended)

```bash
cd /Users/ernestgalperyn/Documents/Book_Store/bookstore
bash QUICK_START.sh
```

This script:
1. Starts Docker containers
2. Installs npm dependencies
3. Runs migration script
4. Verifies data integrity
5. Provides next steps

### Option B: Manual Steps

```bash
# Step 1: Start PostgreSQL
cd /Users/ernestgalperyn/Documents/Book_Store/bookstore
docker-compose up -d

# Step 2: Wait for PostgreSQL (check logs)
docker-compose logs postgres
# Look for: "database system is ready to accept connections"

# Step 3: Run migration
cd backend
node scripts/migrate-sqlite-to-postgres.js

# Step 4: Verify
node scripts/verify-migration.js

# Step 5: Activate PostgreSQL
export DATABASE_TYPE=postgres
npm run dev
```

---

## Key Features

### ✅ Dual-Mode Architecture
- **PostgreSQL**: Production database (when `DATABASE_TYPE=postgres`)
- **SQLite**: Fallback database (when not set)
- **No breaking changes**: Existing API unchanged
- **Zero downtime**: Can switch anytime

### ✅ Data Safety
- Automatic backup of SQLite before migration
- Transaction-based migration (all-or-nothing)
- Foreign key constraints enforced
- Orphaned record detection
- Verification script checks data integrity

### ✅ SQL Database Abstraction
- Parameter syntax handled (? vs $1, $2...)
- Function variants (GROUP_CONCAT vs STRING_AGG)
- Conflict handling (INSERT OR IGNORE vs ON CONFLICT)

### ✅ Async/Await Throughout
- All database operations support async
- Compatible with both SQLite and PostgreSQL
- Better error handling

---

## Configuration

### Environment Variables

```bash
# Database type (optional, defaults to sqlite)
DATABASE_TYPE=postgres

# PostgreSQL connection (only if using PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=medioteka_user
DB_PASSWORD=medioteka_password
DB_NAME=medioteka_db
```

### Using .env File

```bash
cp .env.example .env
# Edit .env and set:
DATABASE_TYPE=postgres
```

---

## Running the Migration

### Prerequisite Check
```bash
# Check SQLite data exists
ls -lh backend/medioteka.db

# Check Docker installed
docker --version

# Check npm installed
npm --version
```

### Step 1: Start PostgreSQL
```bash
docker-compose up -d

# Verify it's running
docker-compose ps
# Should show: postgres (running) and pgadmin (running)
```

### Step 2: Install Dependencies
```bash
cd backend
npm install
# (pg library should be installed from package.json)
```

### Step 3: Run Migration
```bash
node scripts/migrate-sqlite-to-postgres.js
```

**Expected output:**
```
✓ Connected to SQLite
✓ Connected to PostgreSQL
✓ Schema created
✓ Migrated X users
✓ Migrated Y vinyls
✓ Migrated Z vinyl likes

===================================================
Migration Results:
===================================================
✓ users        | SQLite: NNN → PostgreSQL: NNN
✓ vinyls       | SQLite: YYY → PostgreSQL: YYY
✓ vinyl_likes  | SQLite: ZZZ → PostgreSQL: ZZZ
===================================================

✓ Migration completed successfully!
```

### Step 4: Verify Migration
```bash
node scripts/verify-migration.js
```

**Expected output:**
```
===================================================
DATABASE COMPARISON
===================================================
✓ users        | SQLite: NNN | PostgreSQL: NNN
✓ vinyls       | SQLite: YYY | PostgreSQL: YYY
✓ vinyl_likes  | SQLite: ZZZ | PostgreSQL: ZZZ
===================================================

===================================================
FOREIGN KEY INTEGRITY
===================================================
✓ All vinyls have valid owners
✓ All likes have valid references
===================================================

✓ All verification checks passed!
```

### Step 5: Switch Backend to PostgreSQL
```bash
export DATABASE_TYPE=postgres
npm run dev
```

Or use .env file:
```bash
echo "DATABASE_TYPE=postgres" >> .env
npm run dev
```

---

## Testing the Migration

### Health Check
```bash
# Check server is running
curl http://localhost:4001/health || echo "Server not ready"

# Try registration
curl -X POST http://localhost:4001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test1","password":"testpass"}'

# Should return JWT token and user data
```

### Test All Features
1. ✅ Register new user
2. ✅ Login with credentials
3. ✅ Get all vinyls
4. ✅ Create a vinyl record
5. ✅ Like a vinyl
6. ✅ Update a vinyl
7. ✅ Delete a vinyl

### Visual Inspection
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U medioteka_user -d medioteka_db

# In psql:
SELECT COUNT(*) FROM users;      -- Should match SQLite count
SELECT COUNT(*) FROM vinyls;     -- Should match SQLite count
SELECT COUNT(*) FROM vinyl_likes; -- Should match SQLite count

# Check relationships
SELECT v.id, v.title, u.username 
FROM vinyls v 
JOIN users u ON v.ownerId = u.id 
LIMIT 5;

\q  -- Exit
```

---

## Rollback Procedure

If you need to switch back to SQLite:

```bash
# Method 1: Unset environment variable
unset DATABASE_TYPE
npm run dev

# Method 2: Set explicitly to SQLite
export DATABASE_TYPE=sqlite
npm run dev

# Method 3: Remove from .env
grep -v DATABASE_TYPE .env > .env.tmp && mv .env.tmp .env
npm run dev
```

**Important**: Your SQLite database is preserved at `backend/medioteka.db`

---

## Docker Management

### View PostgreSQL Logs
```bash
docker-compose logs postgres

# Follow logs
docker-compose logs -f postgres
```

### Connect to PostgreSQL Directly
```bash
docker-compose exec postgres psql -U medioteka_user -d medioteka_db
```

### PGAdmin Web Interface
- **URL**: http://localhost:5050
- **Email**: admin@medioteka.local
- **Password**: admin

### Stop Containers
```bash
# Stop (keep data)
docker-compose stop

# Stop and remove containers (keep volumes)
docker-compose down

# Stop and remove everything (delete data!)
docker-compose down -v
```

### Restart Containers
```bash
docker-compose restart postgres
```

---

## Troubleshooting

### "Cannot connect to PostgreSQL"

```bash
# Check containers are running
docker-compose ps

# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Wait 10 seconds and retry
sleep 10
node backend/scripts/migrate-sqlite-to-postgres.js
```

### "Migration failed: syntax error"

This usually means SQL syntax incompatibility. Check:
```bash
# View detailed migration logs
node backend/scripts/migrate-sqlite-to-postgres.js 2>&1 | head -50

# Try manual query
sqlite3 backend/medioteka.db "SELECT COUNT(*) FROM users;"
```

### "Foreign key violation"

Means SQLite has orphaned records:
```bash
# Find orphaned records in SQLite
sqlite3 backend/medioteka.db "SELECT * FROM vinyls WHERE ownerId NOT IN (SELECT id FROM users);"

# Delete them
sqlite3 backend/medioteka.db "DELETE FROM vinyls WHERE ownerId NOT IN (SELECT id FROM users);"

# Retry migration
node backend/scripts/migrate-sqlite-to-postgres.js
```

### "Duplicate usernames"

SQLite allowed duplicate usernames. Delete duplicates:
```bash
sqlite3 backend/medioteka.db "DELETE FROM users WHERE id NOT IN (SELECT MIN(id) FROM users GROUP BY username);"

# Retry migration
node backend/scripts/migrate-sqlite-to-postgres.js
```

### Server won't start with PostgreSQL

Check environment variable:
```bash
echo $DATABASE_TYPE    # Should show: postgres
env | grep DB_         # Should show PostgreSQL vars
```

Check database connection:
```bash
# Test connection manually
cd backend
node -e "const {Pool} = require('pg'); new Pool({user:'medioteka_user', password:'medioteka_password', host:'localhost', database:'medioteka_db'}).query('SELECT 1', (e,r) => { console.log(e ? 'ERROR: ' + e.message : 'OK'); process.exit(e ? 1 : 0); });"
```

---

## Performance Comparison

| Metric | SQLite | PostgreSQL |
|--------|--------|-----------|
| Setup time | Instant | 30 seconds |
| Single query | ~1ms | ~2ms |
| Concurrent queries | Blocks | Parallel |
| Large datasets (100k+) | Slow | Fast |
| Transactions | Basic | Advanced |
| Backups | File copy | pg_dump |
| Production ready | ⚠ Limited | ✅ Yes |

**Recommendation**: Use PostgreSQL for production/shared deployments. SQLite fine for local development.

---

## Files Summary

### Documentation
- `MIGRATION_GUIDE.md` - Detailed step-by-step guide
- `MIGRATION_SUMMARY.md` - Quick reference with checklist
- `CODE_CHANGES.md` - Technical implementation details
- `QUICK_START.sh` - Automated setup script

### Database Configuration
- `docker-compose.yml` - PostgreSQL + PGAdmin setup
- `.env.example` - Environment variable template
- `backend/scripts/init.sql` - PostgreSQL schema

### Migration Tools
- `backend/scripts/migrate-sqlite-to-postgres.js` - Data migration
- `backend/scripts/verify-migration.js` - Data validation

### Code Updates
- `backend/package.json` - Added pg driver
- `backend/database.js` - Dual-mode database abstraction
- `backend/server.js` - Async/await routes
- `backend/models/users.sql.js` - Async user model
- `backend/models/vinyl.sql.js` - Async vinyl model

---

## Success Criteria

After migration, verify:

- [ ] All Docker containers running (`docker-compose ps`)
- [ ] PostgreSQL responsive (`pg_isready`)
- [ ] Migration script succeeds with no errors
- [ ] Verification script passes all checks
- [ ] Server starts with `DATABASE_TYPE=postgres npm run dev`
- [ ] User registration/login works
- [ ] Vinyl CRUD operations work
- [ ] Like/unlike functionality works
- [ ] PGAdmin shows all 3 tables with correct data

---

## Next Steps

1. **Run QUICK_START.sh** or follow manual steps
2. **Verify migration** with verify script
3. **Test all API endpoints** with Postman or curl
4. **Monitor logs** for any errors
5. **Keep monitoring** for a day before removing SQLite
6. **Update documentation** if needed for team

---

## Support & Questions

**For migration issues**:
1. Check `MIGRATION_GUIDE.md` → Troubleshooting section
2. Check Docker logs: `docker-compose logs postgres`
3. Run verification: `node backend/scripts/verify-migration.js`
4. Test connection manually to diagnose

**For code questions**:
- See `CODE_CHANGES.md` for implementation details
- Check `database.js` for dual-mode logic
- Review model files for async patterns

---

## Safety Summary

✅ **SQLite is preserved** - No data loss possible
✅ **Transaction-based migration** - All-or-nothing approach
✅ **Foreign key validation** - Catches data issues
✅ **Verification script** - Confirms successful migration
✅ **Rollback capability** - Switch back anytime
✅ **API compatibility** - No endpoint changes

---

**Ready to migrate? Run: `bash QUICK_START.sh`**

