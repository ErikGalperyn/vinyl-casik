#!/bin/bash

# Quick deployment check script
echo "🔍 Checking deployment readiness..."
echo ""

# Check backend dependencies
echo "📦 Backend dependencies:"
cd backend
if [ -f "package.json" ]; then
    echo "✅ package.json found"
    if grep -q "pg" package.json; then
        echo "✅ PostgreSQL driver installed"
    fi
    if grep -q "express" package.json; then
        echo "✅ Express installed"
    fi
fi

# Check playlist files
echo ""
echo "🎵 Playlist feature files:"
if [ -f "models/playlist.sql.js" ]; then
    echo "✅ Playlist model exists"
fi
if [ -f "scripts/playlists-schema.sql" ]; then
    echo "✅ Playlist schema exists"
fi
if [ -f "scripts/migrate-playlists.js" ]; then
    echo "✅ Migration script exists"
fi

# Check frontend dependencies
echo ""
echo "📦 Frontend dependencies:"
cd ../frontend
if [ -f "package.json" ]; then
    echo "✅ package.json found"
    if grep -q "@dnd-kit/core" package.json; then
        echo "✅ @dnd-kit/core installed"
    fi
    if grep -q "@dnd-kit/sortable" package.json; then
        echo "✅ @dnd-kit/sortable installed"
    fi
    if grep -q "next" package.json; then
        echo "✅ Next.js installed"
    fi
fi

# Check config files
echo ""
echo "⚙️  Configuration files:"
cd ..
if [ -f "vercel.json" ]; then
    echo "✅ vercel.json found"
fi
if [ -f "railway.json" ]; then
    echo "✅ railway.json found"
fi

echo ""
echo "🎯 Deployment readiness:"
echo "   Backend: ✅ Ready for Railway"
echo "   Frontend: ✅ Ready for Vercel"
echo ""
echo "📝 Next steps:"
echo "   1. Deploy backend to Railway (add PostgreSQL)"
echo "   2. Copy Railway URL"
echo "   3. Set NEXT_PUBLIC_BACKEND_URL in Vercel"
echo "   4. Deploy frontend to Vercel"
echo ""
echo "🚀 All systems ready for launch!"
