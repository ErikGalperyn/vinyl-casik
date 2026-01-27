# ⚡️ Quick Deploy Guide

## Railway (Backend) - 2 минуты

```bash
# 1. В Railway Dashboard
- New Project → Deploy from GitHub
- Select: bookstore/backend
- Add PostgreSQL database
- Deploy автоматически

# 2. Получи URL
- Settings → Domains → Generate Domain
- Копируй: https://твой-проект.up.railway.app
```

**Готово!** ✅ Таблицы плейлистов создадутся автоматически при первом запуске.

---

## Vercel (Frontend) - 1 минута

```bash
# 1. В Vercel Dashboard  
- Add New Project → Import Git Repository
- Select: bookstore (root)
- Root Directory: frontend
- Environment Variables:
  NEXT_PUBLIC_BACKEND_URL = https://твой-railway-url.up.railway.app

# 2. Deploy
- Нажми Deploy
```

**Готово!** 🚀

---

## Или через CLI

### Railway
```bash
cd backend
railway login
railway init
railway up
railway open  # открыть dashboard
```

### Vercel
```bash
cd frontend
vercel login
vercel --prod
```

---

## Тест

**Backend:**
```bash
curl https://твой-backend.railway.app/health
# → {"status":"healthy"}
```

**Frontend:**
Открой URL от Vercel → логин → создай плейлист → drag & drop работает!

---

## Что задеплоилось

✅ Backend с PostgreSQL  
✅ Таблицы users, vinyls, playlists  
✅ API для плейлистов  
✅ Frontend с drag-and-drop  
✅ Все стили и анимации  

**Zero configuration needed!** 🎉
