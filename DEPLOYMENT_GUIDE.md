# 🚀 Инструкция по развертыванию на Render + Vercel

## ⚙️ ЧАСТЬ 1: Подготовка Git репозитория

### 1.1 Инициализируем Git репо (если еще не инициализирован)
```bash
cd /Users/ernestgalperyn/Documents/Book_Store/bookstore
git init
git add .
git commit -m "Initial commit for deployment"
```

### 1.2 Создаем репозиторий на GitHub
1. Идите на [github.com/new](https://github.com/new)
2. Создайте репо (например: `medioteka`)
3. Следуйте инструкциям для pushа

```bash
git remote add origin https://github.com/YOUR_USERNAME/medioteka.git
git branch -M main
git push -u origin main
```

---

## 🎯 ЧАСТЬ 2: Развертывание backend + PostgreSQL на Render

### 2.1 Быстрый вариант через Blueprint (`render.yaml`)
1. Идите на [render.com](https://render.com)
2. New → **Blueprint**
3. Подключите GitHub репозиторий
4. Render поднимет из файла `render.yaml`:
   - `medioteka-backend` (Web Service)
   - `medioteka-db` (PostgreSQL)

### 2.2 Переменные окружения backend (Render)
В сервисе `medioteka-backend` задайте/проверьте:
```bash
NODE_ENV=production
DATABASE_TYPE=postgres
JWT_SECRET=<strong-random-secret>
SPOTIFY_CLIENT_ID=<your_spotify_client_id>
SPOTIFY_CLIENT_SECRET=<your_spotify_client_secret>
```

`DATABASE_URL` будет подставлена автоматически из базы (по `render.yaml`).

### 2.3 Настройка frontend на Vercel
После первого деплоя backend возьмите URL сервиса Render (например `https://medioteka-backend.onrender.com`) и выставьте на Vercel:
```bash
NEXT_PUBLIC_BACKEND_URL=https://YOUR-RENDER-BACKEND.onrender.com
```

### 2.4 Важно про файлы музыки/обложек
- На бесплатном плане Render файловая система не подходит для постоянного хранения медиа.
- После redeploy/restart загруженные локально файлы могут пропасть.
- Для продакшена вынесите медиа в Cloudinary/S3/Supabase Storage.

---

## 🚂 ЧАСТЬ 3: Развертывание на Railway (legacy)

### 3.1 Создаем проект на Railway
1. Идите на [railway.app](https://railway.app)
2. Нажмите "New Project" → "Deploy from GitHub"
3. Подключите GitHub аккаунт и выберите репо `medioteka`

### 3.2 Добавляем PostgreSQL БД
1. В Railway проекте нажмите "+ New"
2. Выберите "Database" → "PostgreSQL"
3. Railway автоматически установит переменные окружения:
   - `DATABASE_URL` - будет использована автоматически

### 3.3 Конфигурируем переменные окружения
В Railway добавьте переменные (Variables):
```
NODE_ENV=production
PORT=8080
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=7d
SPOTIFY_CLIENT_ID=<your_spotify_client_id>
SPOTIFY_CLIENT_SECRET=<your_spotify_client_secret>
```

### 3.4 Настраиваем деплой бэкенда
1. В Railway выберите сервис бэкенда
2. Settings → "Build Command": `npm install`
3. Settings → "Start Command": `node server.js`
4. Settings → "Root Directory": `backend`

### 3.5 Запускаем деплой
Railway автоматически запустит деплой. Ожидайте ссылку типа:
```
https://medioteka-production.up.railway.app
```

---

## ⚡ ЧАСТЬ 4: Развертывание фронтенда на Vercel

### 4.1 Подключаем Vercel
1. Идите на [vercel.com](https://vercel.com)
2. Нажмите "New Project"
3. Выберите Git интеграцию и ваш репо

### 4.2 Конфигурируем проект
1. Framework Preset: **Next.js**
2. Root Directory: `frontend`
3. Build Command: `npm run build`
4. Environment Variables:
```
NEXT_PUBLIC_BACKEND_URL=https://medioteka-production.up.railway.app
```

### 4.3 Запускаем деплой
Нажмите "Deploy" и ожидайте ссылку типа:
```
https://medioteka.vercel.app
```

---

## ✅ Финальные шаги

1. Обновите `.env.production` на фронтенде с реальной Railway URL
2. Сделайте `git push` чтобы Vercel пересобрала проект
3. Тестируйте приложение по ссылке Vercel

---

## 🔧 Альтернатива: Развертывание только бэкенда на Railway

Если хотите развернуть ТОЛЬКО бэкенд сначала:

```bash
cd backend
railway init
railway up
```

Вы получите URL типа: `https://medioteka-backend.up.railway.app`

---

## 📝 Важно помнить

- **DATABASE_URL** от PostgreSQL уже установится автоматически в Railway
- **Переменные окружения** задаются в Railway и Vercel панелях
- **Эстонская** переезжает из `localhost:4001` на Railway URL
- **Фронтенд** должен знать URL бэкенда через `NEXT_PUBLIC_BACKEND_URL`

Готово! 🎉
