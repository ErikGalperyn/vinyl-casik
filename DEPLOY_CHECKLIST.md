# ✨ Чеклист деплоя Medioteka на Railway + Vercel

## 📦 ШАГ 1: Подготовка завершена ✅
- [x] Git репо инициализирован
- [x] Database.js обновлен для DATABASE_URL (Railway)
- [x] Procfile создан (для Railway)
- [x] Vercel.json создан
- [x] Environment файлы подготовлены
- [x] Первый коммит сделан

## 🚀 ШАГ 2: Создание GitHub репо (ВЫ ДЕЛАЕТЕ)
```bash
# На github.com создайте новый репо, затем:
cd /Users/ernestgalperyn/Documents/Book_Store/bookstore
git remote add origin https://github.com/YOUR_USERNAME/medioteka.git
git branch -M main
git push -u origin main
```

## 🚂 ШАГ 3: Развертывание на Railway (ВЫ ДЕЛАЕТЕ)

### 3.1 Создайте проект
1. Идите на **https://railway.app**
2. Нажмите **"New Project"** → **"Deploy from GitHub"**
3. Авторизируйтесь и выберите репо `medioteka`

### 3.2 Добавьте PostgreSQL БД
1. В проекте нажмите **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway создаст `DATABASE_URL` автоматически ✅

### 3.3 Конфигурируйте переменные окружения
В Railway → Variables добавьте:
```
NODE_ENV=production
PORT=8080
JWT_SECRET=medioteka-jwt-secret-key-2025-production
JWT_EXPIRES_IN=7d
SPOTIFY_CLIENT_ID=ff3d626379644c428bec1821bbf735f7
SPOTIFY_CLIENT_SECRET=80e7ace8df824219a8dbdb2a3e75fecc
```

### 3.4 Настройте бэкенд сервис
1. Выберите сервис бэкенда в Railway
2. **Settings** → **Root Directory**: `backend`
3. **Settings** → **Build Command**: `npm install`
4. **Settings** → **Start Command**: `node server.js`
5. Нажмите **Deploy**

⏳ Ожидайте развертывания (~2-3 минуты)
🎉 Получите URL типа: `https://medioteka-production.up.railway.app`

## ⚡ ШАГ 4: Развертывание на Vercel (ВЫ ДЕЛАЕТЕ)

### 4.1 Создайте проект
1. Идите на **https://vercel.com**
2. Нажмите **"Add New..."** → **"Project"**
3. **Import Git Repo** и выберите `medioteka`

### 4.2 Конфигурируйте проект
1. **Framework Preset**: Next.js
2. **Root Directory**: `frontend`
3. **Build Command**: `npm run build`
4. **Environment Variables**:
```
NEXT_PUBLIC_BACKEND_URL=https://medioteka-production.up.railway.app
```
*(Замените на реальный URL от Railway из шага 3)*

### 4.3 Деплой
Нажмите **Deploy** и ожидайте
🎉 Получите URL типа: `https://medioteka.vercel.app`

## ✅ Финальная проверка

```bash
# 1. Проверьте фронтенд доступен
curl https://medioteka.vercel.app

# 2. Проверьте API доступна
curl https://medioteka-production.up.railway.app/health

# 3. Откройте в браузере и протестируйте
https://medioteka.vercel.app
```

## 📝 URL для локального тестирования

- Фронтенд: **http://localhost:3000**
- Бэкенд: **http://localhost:4001**

## 🔗 Production URLs

- Фронтенд: **https://medioteka.vercel.app** (после деплоя)
- Бэкенд: **https://medioteka-production.up.railway.app** (после деплоя Railway)

---

## ❓ Если что-то пошло не так

### БД не подключается
- Проверьте, что `DATABASE_URL` есть в Railway Variables
- Убедитесь что PostgreSQL сервис запущен в Railway

### Фронтенд не видит бэкенд
- Обновите `NEXT_PUBLIC_BACKEND_URL` в Vercel
- Делайте `git push` чтобы Vercel пересобрала проект

### Ошибка авторизации на Spotify
- Проверьте что `SPOTIFY_CLIENT_ID` и `SPOTIFY_CLIENT_SECRET` правильные
- Можете регистрировать свое приложение на https://developer.spotify.com/

---

**Готово! 🎉 Приложение будет доступно по публичной ссылке!**
