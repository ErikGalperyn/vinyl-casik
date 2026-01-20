const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../vinyls.json');

let vinyls = [];
let nextId = 1;

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      vinyls = data.vinyls || [];
      nextId = data.nextId || 1;
    } else {
      vinyls = [
        { id: 1, title: 'Abbey Road', artist: 'The Beatles', year: 1969, coverUrl: '', musicUrl: '', note: 'Classic collection', ownerId: 1, likes: [] },
        { id: 2, title: 'Dark Side of the Moon', artist: 'Pink Floyd', year: 1973, coverUrl: '', musicUrl: '', note: '', ownerId: 1, likes: [] }
      ];
      nextId = 3;
      saveDB();
    }
  } catch (err) {
    console.error('Failed to load DB:', err);
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({ vinyls, nextId }, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save DB:', err);
  }
}

loadDB();

module.exports = {
  getAll: () => vinyls,
  getById: (id) => vinyls.find(v => String(v.id) === String(id)),
  getByOwner: (ownerId) => vinyls.filter(v => v.ownerId == ownerId),
  create: (data) => {
    const vinyl = { id: String(nextId++), ...data, likes: [] };
    vinyls.push(vinyl);
    saveDB();
    return vinyl;
  },
  update: (id, data) => {
    const idx = vinyls.findIndex(v => v.id == id);
    if (idx === -1) return null;
    vinyls[idx] = { ...vinyls[idx], ...data, id };
    saveDB();
    return vinyls[idx];
  },
  delete: (id) => {
    const idx = vinyls.findIndex(v => v.id == id);
    if (idx === -1) return false;
    vinyls.splice(idx, 1);
    saveDB();
    return true;
  },
  addLike: (vinylId, userId) => {
    const vinyl = vinyls.find(v => v.id == vinylId);
    if (!vinyl) return null;
    if (!vinyl.likes) vinyl.likes = [];
    if (vinyl.likes.includes(userId)) return vinyl; // Already liked
    vinyl.likes.push(userId);
    saveDB();
    return vinyl;
  },
  removeLike: (vinylId, userId) => {
    const vinyl = vinyls.find(v => v.id == vinylId);
    if (!vinyl) return null;
    if (!vinyl.likes) vinyl.likes = [];
    vinyl.likes = vinyl.likes.filter(id => id !== userId);
    saveDB();
    return vinyl;
  }
};
