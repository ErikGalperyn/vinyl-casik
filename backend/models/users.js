const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'users.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading users DB:', e);
  }
  return {
    users: [
      { id: 1, username: 'Swwaggy', passwordHash: bcrypt.hashSync('admin123', 10), role: 'admin' }
    ],
    nextId: 2
  };
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Error saving users DB:', e);
  }
}

let db = loadDB();

module.exports = {
  getAll: () => db.users,
  getById: (id) => db.users.find(u => u.id == id),
  getByUsername: (username) => db.users.find(u => u.username === username),
  create: (username, password, role = 'user') => {
    if (module.exports.getByUsername(username)) return null;
    const user = { 
      id: db.nextId++, 
      username, 
      passwordHash: bcrypt.hashSync(password, 10), 
      role 
    };
    db.users.push(user);
    saveDB(db);
    return user;
  },
  verifyPassword: (user, password) => bcrypt.compareSync(password, user.passwordHash),
  updateRole: (id, role) => {
    const user = module.exports.getById(id);
    if (!user) return null;
    user.role = role;
    saveDB(db);
    return user;
  },
  delete: (id) => {
    const idx = db.users.findIndex(u => u.id == id);
    if (idx === -1) return false;
    db.users.splice(idx, 1);
    saveDB(db);
    return true;
  }
};
