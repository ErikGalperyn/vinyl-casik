#!/bin/bash
# Start PostgreSQL и Backend сервер

echo "🚀 Starting Medioteka Backend with PostgreSQL"
echo ""

# Add PostgreSQL to PATH
export PATH="/usr/local/opt/postgresql@16/bin:$PATH"

# Check if PostgreSQL is running
if ! pg_isready -q; then
  echo "📦 Starting PostgreSQL..."
  brew services start postgresql@16
  sleep 2
fi

# Check database connection
if psql -lqt | cut -d \| -f 1 | grep -qw medioteka_db; then
  echo "✓ PostgreSQL is running"
  echo "✓ Database 'medioteka_db' exists"
else
  echo "Creating database..."
  createdb medioteka_db
fi

# Start backend
cd "$(dirname "$0")/backend"
echo ""
echo "🎵 Starting backend server..."
echo "   API будет доступно на http://localhost:4001"
echo ""
node server.js
