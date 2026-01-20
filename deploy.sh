#!/bin/bash

# 🚀 БЫСТРЫЙ ДЕПЛОЙ НА RAILWAY + VERCEL

echo "📋 Проверяем подготовку проекта..."

# 1. Проверяем Git
if [ ! -d ".git" ]; then
    echo "🔧 Инициализируем Git..."
    git init
    git add .
    git commit -m "Initial commit for deployment"
    echo "✅ Git инициализирован"
else
    echo "✅ Git репо найдено"
fi

echo ""
echo "📚 ИНСТРУКЦИЯ ПО РАЗВЕРТЫВАНИЮ:"
echo "================================"
echo ""
echo "1️⃣  GITHUB ПОДГОТОВКА:"
echo "   - Создайте репо на github.com"
echo "   - Запустите в терминале:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/medioteka.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "2️⃣  RAILWAY (Бэкенд + БД):"
echo "   - Идите на railway.app"
echo "   - New Project → Deploy from GitHub"
echo "   - Выберите медиотека репо"
echo "   - Add → PostgreSQL"
echo "   - Environment Variables:"
echo "     NODE_ENV=production"
echo "     JWT_SECRET=medioteka-jwt-secret-key-2025-production"
echo "     JWT_EXPIRES_IN=7d"
echo "     SPOTIFY_CLIENT_ID=ff3d626379644c428bec1821bbf735f7"
echo "     SPOTIFY_CLIENT_SECRET=80e7ace8df824219a8dbdb2a3e75fecc"
echo "   - Settings → Root Directory: backend"
echo ""
echo "3️⃣  VERCEL (Фронтенд):"
echo "   - Идите на vercel.com"
echo "   - New Project → Import Git Repo"
echo "   - Root Directory: frontend"
echo "   - Environment: NEXT_PUBLIC_BACKEND_URL=https://YOUR-RAILWAY-URL"
echo ""
echo "✨ Полная инструкция в DEPLOYMENT_GUIDE.md"
