# 🚀 Deploy Instructions

## Railway (Backend) 

### 1. Подготовка
```bash
# Убедись что у тебя есть Railway CLI
npm i -g @railway/cli

# Залогинься
railway login
```

### 2. Деплой Backend
```bash
cd backend
railway init
railway up
```

### 3. Добавь PostgreSQL
В Railway Dashboard:
1. Открой проект
2. Нажми **"New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway автоматически создаст переменную `DATABASE_URL`

### 4. Переменные окружения (опционально)
Если нужен Spotify:
```
SPOTIFY_CLIENT_ID=твой_client_id
SPOTIFY_CLIENT_SECRET=твой_secret
```

### 5. Получи URL бэкенда
```bash
railway domain
# Скопируй URL типа: https://твой-проект.up.railway.app
```

---

## Vercel (Frontend)

### 1. Установи Vercel CLI
```bash
npm i -g vercel
```

### 2. Настрой переменную окружения
Отредактируй `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_BACKEND_URL": "https://твой-backend.up.railway.app"
  }
}
```

Или в Vercel Dashboard → Settings → Environment Variables:
- `NEXT_PUBLIC_BACKEND_URL` = `https://твой-backend.up.railway.app`

### 3. Деплой Frontend
```bash
cd frontend
vercel --prod
```

---

## 🎯 Автоматическая миграция

✅ **Таблицы плейлистов создаются автоматически!**

При первом запуске на Railway бэкенд проверит:
- Если нет таблицы `users` → создаст schema.sql
- Если нет таблицы `playlists` → создаст playlists-schema.sql

Никаких ручных миграций не нужно!

---

## 🔍 Проверка деплоя

### Backend (Railway)
```bash
curl https://твой-backend.up.railway.app/health
# Должно вернуть: {"status":"healthy","timestamp":"..."}
```

### Frontend (Vercel)
Открой URL от Vercel в браузере → должна загрузиться страница логина

---

## 🐛 Troubleshooting

### Backend не запускается
1. Проверь логи: `railway logs`
2. Проверь что PostgreSQL подключен
3. Проверь переменную `DATABASE_URL` в Railway

### Frontend не коннектится к бэкенду
1. Проверь переменную `NEXT_PUBLIC_BACKEND_URL` в Vercel
2. Проверь CORS в backend/server.js (должен быть `app.use(cors())`)
3. Проверь что бэкенд доступен через curl

### Плейлисты не работают
1. Проверь логи Railway - должна быть строка: `✓ Playlist tables created`
2. Если нет - выполни миграцию вручную:
```bash
railway run node scripts/migrate-playlists.js
```

---

## 📦 Структура деплоя

```
Railway (Backend)
├── PostgreSQL Database
│   ├── users, vinyls, vinyl_likes
│   └── playlists, playlist_songs ✨ NEW
└── Node.js Server (Express)
    └── API endpoints

Vercel (Frontend)
└── Next.js App
    └── React Components
```

---

## 🔄 Обновление после деплоя

### Backend
```bash
cd backend
git add .
git commit -m "update"
git push
# Railway автоматически задеплоит
```

### Frontend  
```bash
cd frontend
vercel --prod
# Или git push в Vercel Git Integration
```

---

## ✅ Checklist перед деплоем

Backend:
- [x] PostgreSQL schema готова (schema.sql)
- [x] Playlists schema готова (playlists-schema.sql)
- [x] Автомиграция включена в database.js
- [x] CORS настроен
- [x] Health check endpoint работает

Frontend:
- [x] @dnd-kit библиотеки установлены
- [x] NEXT_PUBLIC_BACKEND_URL настроен
- [x] API calls используют правильный URL
- [x] Build проходит без ошибок

---

**Готово к деплою! 🚀**
