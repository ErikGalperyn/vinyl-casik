## ✅ PRE-DEPLOY CHECKLIST

### Код готов к деплою:

✅ **Backend (Railway)**
- [x] PostgreSQL миграция автоматическая (database.js)
- [x] Playlist tables создаются при старте
- [x] API endpoints для плейлистов (+8 routes)
- [x] CORS включен
- [x] Health check работает: GET /health
- [x] Модель Playlist поддерживает PostgreSQL

✅ **Frontend (Vercel)**
- [x] @dnd-kit установлен (core, sortable, utilities)
- [x] Плейлист компоненты готовы
- [x] Drag & Drop работает
- [x] Стили добавлены (300+ строк CSS)
- [x] API calls используют env variable

✅ **Database**
- [x] schema.sql - основные таблицы
- [x] playlists-schema.sql - таблицы плейлистов
- [x] Автомиграция при первом запуске
- [x] Foreign keys настроены

✅ **Configuration**
- [x] vercel.json настроен
- [x] railway.json настроен  
- [x] .env.example есть
- [x] package.json dependencies корректны

---

## 🚀 DEPLOY STEPS

### 1️⃣ Railway Backend (5 мин)
```bash
# В Railway Dashboard:
1. New Project → Import from GitHub
2. Select repository
3. Add PostgreSQL database (кнопка "New")
4. Deploy автоматически
5. Settings → Generate Domain
6. Скопируй URL
```

**Что произойдет:**
- Railway установит зависимости
- Подключится к PostgreSQL
- Создаст таблицы автоматически (users, vinyls, playlists)
- Запустит server.js
- ✅ Backend готов!

---

### 2️⃣ Vercel Frontend (3 мин)
```bash
# В Vercel Dashboard:
1. New Project → Import Git
2. Root Directory: frontend
3. Environment Variables:
   - NEXT_PUBLIC_BACKEND_URL = https://твой-railway-url.up.railway.app
4. Deploy
```

**Что произойдет:**
- Vercel установит зависимости (@dnd-kit и др.)
- Соберет Next.js проект
- Задеплоит на CDN
- ✅ Frontend готов!

---

## 🧪 TESTING AFTER DEPLOY

### Backend API Test
```bash
# Health check
curl https://твой-backend.railway.app/health
# → {"status":"healthy","timestamp":"..."}

# Login test
curl -X POST https://твой-backend.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# → {"token":"..."}

# Playlists test (с токеном)
curl https://твой-backend.railway.app/playlists \
  -H "Authorization: Bearer ТУТ_ТОКЕН"
# → []  (пустой массив - норм)
```

### Frontend Test
1. Открой URL от Vercel
2. Залогинься (admin / admin123)
3. Создай плейлист
4. Добавь песню в плейлист
5. Открой плейлист
6. Перетащи песни (drag & drop)
7. ✅ Всё работает!

---

## 🐛 TROUBLESHOOTING

### Backend не стартует
```bash
# Проверь логи
railway logs

# Проверь что PostgreSQL подключен
railway variables
# Должна быть: DATABASE_URL

# Если нет - добавь PostgreSQL:
# Dashboard → New → Database → PostgreSQL
```

### Frontend не коннектится
```bash
# Проверь environment variable
vercel env ls

# Если нет - добавь:
vercel env add NEXT_PUBLIC_BACKEND_URL

# Введи: https://твой-backend.railway.app
# Выбери: Production
```

### Плейлисты не создаются
```sql
-- Проверь таблицы в Railway PostgreSQL
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'playlist%';

-- Должны быть: playlists, playlist_songs
```

### CORS ошибка
```javascript
// В backend/server.js проверь:
app.use(cors()); // должно быть ДО всех routes
```

---

## 📊 WHAT'S DEPLOYED

```
Production Architecture:

Railway Backend
│
├── PostgreSQL Database
│   ├── users (с admin)
│   ├── vinyls (8 виниловых пластинок)
│   ├── vinyl_likes
│   ├── playlists ✨ NEW
│   └── playlist_songs ✨ NEW
│
└── Express API
    ├── Auth endpoints
    ├── Vinyl CRUD endpoints
    ├── Like endpoints
    └── Playlist CRUD endpoints ✨ NEW
        ├── GET /playlists
        ├── POST /playlists
        ├── PUT /playlists/:id
        ├── DELETE /playlists/:id
        ├── POST /playlists/:id/songs
        ├── DELETE /playlists/:id/songs/:vinylId
        └── PUT /playlists/:id/reorder

Vercel Frontend
│
└── Next.js App
    ├── Login/Register pages
    ├── Vinyl collection
    ├── Blackjack game
    ├── Fullscreen player
    └── Playlists ✨ NEW
        ├── Create/Edit/Delete
        ├── Add/Remove songs
        └── Drag & Drop reorder
```

---

## ✨ FEATURES LIVE

После деплоя пользователи смогут:

1. ✅ Логиниться и регистрироваться
2. ✅ Смотреть коллекцию винила
3. ✅ Лайкать песни
4. ✅ Играть в блэкджек
5. ✅ Слушать музыку с fullscreen плеером
6. 🆕 **Создавать плейлисты**
7. 🆕 **Добавлять песни в плейлисты**
8. 🆕 **Сортировать песни drag & drop**
9. 🆕 **Редактировать и удалять плейлисты**

---

## 🎯 DONE!

Всё готово к деплою на Vercel и Railway! 🚀

**Zero manual migrations required** - всё происходит автоматически при первом запуске.
