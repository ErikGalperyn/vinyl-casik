# Medioteka - Vinyl Collection App

A full-stack web application for managing and displaying vinyl record collections with role-based authentication.

## Features

- **JWT Authentication** (login, register)
- **Role-Based Access Control** (admin, user, reader)
- **Vinyl CRUD** with owner validation
- **User Management** (admin panel)
- **Shelf-style UI** with vinyl card displays
- **Responsive Design**

## Quick Start

### Backend

```bash
cd bookstore/backend
npm install
npm start
```

Backend runs on `http://localhost:4001`

**Default admin credentials:**
- Username: `admin`
- Password: `admin123`

### Frontend

```bash
cd bookstore/frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /auth/login` - Login with username/password
- `POST /auth/register` - Register new user

### Vinyl Management
- `GET /vinyls` - Get vinyls (filtered by role)
- `GET /vinyls/:id` - Get single vinyl
- `POST /vinyls` - Create vinyl (admin/user)
- `PUT /vinyls/:id` - Update vinyl (owner/admin)
- `DELETE /vinyls/:id` - Delete vinyl (owner/admin)

### User Admin
- `GET /users` - List users (admin only)
- `PUT /users/:id/role` - Change user role (admin only)
- `DELETE /users/:id` - Delete user (admin only)

## User Roles

- **Admin**: Full access to all vinyls and user management
- **User**: Can create, edit, and delete only their own vinyls
- **Reader**: Can view all vinyls (read-only)

## Tech Stack

- **Backend**: Node.js, Express, JWT, bcryptjs
- **Frontend**: Next.js, React, axios
- **Storage**: In-memory (can be extended to database)

## Project Structure

```
bookstore/
├─ backend/
│  ├─ models/
│  │  ├─ user.js
│  │  └─ vinyl.js
│  ├─ package.json
│  └─ server.js
└─ frontend/
   ├─ pages/
   │  ├─ _app.jsx
   │  ├─ index.jsx (gallery)
   │  └─ login.jsx
   ├─ styles/
   │  └─ global.css
   ├─ utils/
   │  └─ api.js
   └─ package.json
```
