# Migration Checklist & Verification

## Files Created ✅

### Core Migration Files
- [x] `docker-compose.yml` - PostgreSQL + PGAdmin containers
- [x] `.env.example` - Environment configuration template
- [x] `backend/scripts/init.sql` - PostgreSQL schema definition
- [x] `backend/scripts/migrate-sqlite-to-postgres.js` - Migration engine
- [x] `backend/scripts/verify-migration.js` - Verification tool

### Documentation
- [x] `MIGRATION_README.md` - Complete implementation guide
- [x] `MIGRATION_GUIDE.md` - Step-by-step instructions
- [x] `MIGRATION_SUMMARY.md` - Quick reference
- [x] `CODE_CHANGES.md` - Technical details
- [x] `QUICK_START.sh` - Automated setup script

## Files Updated ✅

### Backend Configuration
- [x] `backend/package.json` - Added `pg` dependency (v8.11.3)
- [x] `backend/database.js` - Dual-mode (SQLite + PostgreSQL)

### Backend Models
- [x] `backend/models/users.sql.js` - Async + PostgreSQL support
- [x] `backend/models/vinyl.sql.js` - Async + PostgreSQL support

### Backend API
- [x] `backend/server.js` - All routes converted to async/await

## Pre-Migration Checklist

Before you start the migration:

- [ ] Read `MIGRATION_README.md` for overview
- [ ] Check Docker is installed: `docker --version`
- [ ] Check npm is installed: `npm --version`
- [ ] Verify SQLite database exists: `ls -lh backend/medioteka.db`
- [ ] Create backup (already done): `backend/medioteka.backup.db`
- [ ] Have 10-15 minutes available
- [ ] No other services running on port 5432 (PostgreSQL)
- [ ] No other services running on port 5050 (PGAdmin)

## Migration Steps

### Phase 1: Setup (5 minutes)

```bash
# 1. Start PostgreSQL
docker-compose up -d
# Verify: docker-compose ps

# 2. Install dependencies
cd backend
npm install

# 3. Wait for PostgreSQL to be ready
docker-compose logs postgres
# Look for: "database system is ready to accept connections"
```

### Phase 2: Migration (3 minutes)

```bash
# 4. Run migration script
node scripts/migrate-sqlite-to-postgres.js

# 5. Check for errors
# Should see: "✓ Migration completed successfully!"
```

### Phase 3: Verification (5 minutes)

```bash
# 6. Verify data integrity
node scripts/verify-migration.js

# 7. Check results
# Should see: "✓ All verification checks passed!"
```

### Phase 4: Activation (2 minutes)

```bash
# 8. Set environment variable
export DATABASE_TYPE=postgres

# 9. Start the backend
npm run dev

# 10. Test the server
curl http://localhost:4001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'
```

## Post-Migration Verification

After migration, run these checks:

### Database Checks
- [ ] Count rows in PostgreSQL matches SQLite
  ```bash
  node scripts/verify-migration.js
  ```

### API Checks
- [ ] User registration works
  ```bash
  curl -X POST http://localhost:4001/auth/register \
    -H "Content-Type: application/json" \
    -d '{"username":"test1","password":"test123"}'
  ```

- [ ] User login works
  ```bash
  curl -X POST http://localhost:4001/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test1","password":"test123"}'
  ```

- [ ] Get vinyls works (use token from login response)
  ```bash
  curl -X GET http://localhost:4001/vinyls \
    -H "Authorization: Bearer YOUR_TOKEN_HERE"
  ```

- [ ] Create vinyl works
  ```bash
  curl -X POST http://localhost:4001/vinyls \
    -H "Authorization: Bearer YOUR_TOKEN_HERE" \
    -H "Content-Type: application/json" \
    -d '{"title":"Album","artist":"Artist","year":2023}'
  ```

### Container Checks
- [ ] PostgreSQL running
  ```bash
  docker-compose ps | grep postgres
  # Should show: running
  ```

- [ ] PGAdmin accessible
  ```bash
  open http://localhost:5050
  # Or use: curl -s http://localhost:5050 | head -1
  ```

## Rollback Verification

If you need to rollback, verify:

```bash
# 1. Unset PostgreSQL
unset DATABASE_TYPE

# 2. Restart server
npm run dev

# 3. Verify SQLite still works
curl -X GET http://localhost:4001/vinyls \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

- [ ] SQLite database still at `backend/medioteka.db`
- [ ] All data intact
- [ ] Server running without errors

## Documentation Verification

- [ ] `MIGRATION_README.md` explains process ✓
- [ ] `MIGRATION_GUIDE.md` has troubleshooting ✓
- [ ] `CODE_CHANGES.md` documents changes ✓
- [ ] `.env.example` has all variables ✓
- [ ] `QUICK_START.sh` is executable ✓

## Success Criteria

Migration is successful when:

✅ **All verification checks pass**
```bash
node scripts/verify-migration.js
# Should show: "✓ All verification checks passed!"
```

✅ **Row counts match**
- users
- vinyls
- vinyl_likes

✅ **Foreign keys valid**
- No orphaned vinyls
- No orphaned likes

✅ **API fully functional**
- Register ✓
- Login ✓
- Get vinyls ✓
- Create vinyl ✓
- Like vinyl ✓
- All other endpoints ✓

✅ **No data loss**
- All users migrated
- All vinyls migrated
- All likes migrated
- All relationships preserved

## Common Issues & Solutions

### Issue: PostgreSQL won't start
```bash
# Solution:
docker-compose logs postgres
docker-compose restart postgres
# Wait 10 seconds and retry
```

### Issue: Migration hangs
```bash
# Solution:
# Check PostgreSQL is ready
docker-compose exec postgres pg_isready
# If not ready, wait longer
sleep 30
# Then retry migration
```

### Issue: Foreign key violations
```bash
# Solution:
# Check for orphaned records in SQLite
sqlite3 backend/medioteka.db \
  "SELECT * FROM vinyls WHERE ownerId NOT IN (SELECT id FROM users);"
# Delete orphaned records
sqlite3 backend/medioteka.db \
  "DELETE FROM vinyls WHERE ownerId NOT IN (SELECT id FROM users);"
# Retry migration
```

### Issue: Duplicate usernames
```bash
# Solution:
# Delete duplicates in SQLite first
sqlite3 backend/medioteka.db \
  "DELETE FROM users WHERE id NOT IN (SELECT MIN(id) FROM users GROUP BY username);"
# Retry migration
```

### Issue: Server won't start with PostgreSQL
```bash
# Solution:
# Verify DATABASE_TYPE is set
echo $DATABASE_TYPE  # Should show: postgres

# Test PostgreSQL connection
cd backend
node -e "
  const {Pool} = require('pg');
  new Pool({
    user: 'medioteka_user',
    password: 'medioteka_password',
    host: 'localhost',
    database: 'medioteka_db'
  }).query('SELECT NOW()', (err, res) => {
    console.log(err ? 'ERROR: ' + err.message : 'SUCCESS: ' + res.rows[0].now);
    process.exit(err ? 1 : 0);
  });
"
```

## Performance Testing

Optional: Compare performance before/after

```bash
# Test query performance with SQLite
unset DATABASE_TYPE
time curl -X GET http://localhost:4001/vinyls \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test query performance with PostgreSQL
export DATABASE_TYPE=postgres
time curl -X GET http://localhost:4001/vinyls \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Sign-Off

When complete:

- [ ] Migration script runs successfully
- [ ] Verification script passes all checks
- [ ] All API endpoints tested
- [ ] No errors in server logs
- [ ] Database has correct row counts
- [ ] Foreign key integrity verified
- [ ] Documentation reviewed

**Migration completed on**: ________________

**Tested by**: ________________

**Approved by**: ________________

## Next Steps

After successful migration:

1. Monitor the application for 24 hours
2. Keep SQLite backup safe
3. Consider removing SQLite only after long-term stability
4. Update deployment documentation if applicable
5. Train team on new database setup

## Support

For issues:
1. Check `MIGRATION_GUIDE.md` → Troubleshooting section
2. Review logs: `docker-compose logs postgres`
3. Run verification: `node scripts/verify-migration.js`
4. Check `CODE_CHANGES.md` for technical details

---

**Ready?** Run: `bash QUICK_START.sh`
