#!/bin/bash

# Quick Start: SQLite to PostgreSQL Migration
# Run from project root: bash QUICK_START.sh

set -e  # Exit on error

echo "================================================"
echo "Medioteka: SQLite → PostgreSQL Migration"
echo "================================================"
echo ""

# Step 1: Start Docker
echo "Step 1: Starting PostgreSQL and PGAdmin..."
docker-compose up -d
echo "OK: Docker containers started"
echo "  - PostgreSQL: localhost:5432"
echo "  - PGAdmin: http://localhost:5050"
echo ""

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 3
for i in {1..30}; do
  if docker-compose exec postgres pg_isready -U medioteka_user -d medioteka_db 2>/dev/null; then
    echo "OK: PostgreSQL is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "ERROR: PostgreSQL failed to start"
    exit 1
  fi
  sleep 1
done
echo ""

# Step 2: Install dependencies
echo "Step 2: Installing dependencies..."
cd backend
npm install --silent
cd ..
echo "OK: Dependencies installed"
echo ""

# Step 3: Run migration script
echo "Step 3: Running migration script..."
echo "  (Reading from SQLite, writing to PostgreSQL)"
cd backend
node scripts/migrate-sqlite-to-postgres.js
cd ..
echo "OK: Migration completed"
echo ""

# Step 4: Verify migration
echo "Step 4: Verifying migration..."
cd backend
node scripts/verify-migration.js
cd ..
echo "OK: Verification completed"
echo ""

# Summary
echo "================================================"
echo "OK: MIGRATION SUCCESSFUL!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Set environment variable:"
echo "   export DATABASE_TYPE=postgres"
echo ""
echo "2. Start the application:"
echo "   npm run dev"
echo ""
echo "3. Test the API:"
echo "   curl -X POST http://localhost:4001/auth/register \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"test\",\"password\":\"test\"}'"
echo ""
echo "4. View data in PGAdmin:"
echo "   http://localhost:5050"
echo "   Email: admin@medioteka.local"
echo "   Password: admin"
echo ""
echo "To rollback to SQLite:"
echo "   unset DATABASE_TYPE"
echo "   npm run dev"
echo ""
