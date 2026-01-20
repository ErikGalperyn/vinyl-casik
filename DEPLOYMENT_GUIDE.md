# 🚀 Инструкция по развертыванию на Railway + Vercel

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

## 🚂 ЧАСТЬ 2: Развертывание на Railway

### 2.1 Создаем проект на Railway
1. Идите на [railway.app](https://railway.app)
2. Нажмите "New Project" → "Deploy from GitHub"
3. Подключите GitHub аккаунт и выберите репо `medioteka`

### 2.2 Добавляем PostgreSQL БД
1. В Railway проекте нажмите "+ New"
2. Выберите "Database" → "PostgreSQL"
3. Railway автоматически установит переменные окружения:
   - `DATABASE_URL` - будет использована автоматически

### 2.3 Конфигурируем переменные окружения
В Railway добавьте переменные (Variables):
```
NODE_ENV=production
PORT=8080
JWT_SECRET=medioteka-jwt-secret-key-2025-production
JWT_EXPIRES_IN=7d
SPOTIFY_CLIENT_ID=ff3d626379644c428bec1821bbf735f7
SPOTIFY_CLIENT_SECRET=80e7ace8df824219a8dbdb2a3e75fecc
```

### 2.4 Настраиваем деплой бэкенда
1. В Railway выберите сервис бэкенда
2. Settings → "Build Command": `npm install`
3. Settings → "Start Command": `node server.js`
4. Settings → "Root Directory": `backend`

### 2.5 Запускаем деплой
Railway автоматически запустит деплой. Ожидайте ссылку типа:
```
https://medioteka-production.up.railway.app
```

---

## ⚡ ЧАСТЬ 3: Развертывание фронтенда на Vercel

### 3.1 Подключаем Vercel
1. Идите на [vercel.com](https://vercel.com)
2. Нажмите "New Project"
3. Выберите Git интеграцию и ваш репо

### 3.2 Конфигурируем проект
1. Framework Preset: **Next.js**
2. Root Directory: `frontend`
3. Build Command: `npm run build`
4. Environment Variables:
```
NEXT_PUBLIC_BACKEND_URL=https://medioteka-production.up.railway.app
```

### 3.3 Запускаем деплой
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
