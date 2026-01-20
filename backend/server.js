// Load environment variables
try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const axios = require('axios');
const User = require('./models/users.sql');
const Vinyl = require('./models/vinyl.sql');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

const SECRET = 'medioteka-secret-key-2025';

// Spotify API credentials (временные для демо - позже нужно будет создать свое приложение на https://developer.spotify.com/)
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify credentials missing');
  }
  if (spotifyAccessToken && Date.now() < spotifyTokenExpiry) {
    return spotifyAccessToken;
  }

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      'grant_type=client_credentials', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    spotifyAccessToken = response.data.access_token;
    spotifyTokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return spotifyAccessToken;
  } catch (error) {
    const resp = error.response?.data;
    const msg = resp?.error_description || resp?.error || error.message;
    console.error('Spotify token error:', resp || msg);
    if (msg && msg.toLowerCase().includes('invalid client')) {
      throw new Error('Spotify credentials invalid');
    }
    throw new Error('Failed to get Spotify token');
  }
}

// Normalize DB keys (PostgreSQL returns lowercase column names)
function normalizeVinyl(v) {
  return {
    id: v.id,
    title: v.title,
    artist: v.artist,
    year: v.year,
    coverUrl: v.coverUrl || v.coverurl || null,
    musicUrl: v.musicUrl || v.musicurl || null,
    note: v.note || '',
    ownerId: v.ownerId || v.ownerid,
    likes: Array.isArray(v.likes) ? v.likes : (v.likes || []),
    created_at: v.created_at,
    updated_at: v.updated_at,
  };
}

async function enrichVinylWithOwner(vinyl) {
  const normalized = normalizeVinyl(vinyl);
  const owner = await User.getById(normalized.ownerId);
  return { ...normalized, ownerName: owner?.username || 'Unknown' };
}

async function enrichVinylsWithOwners(vinyls) {
  return Promise.all(vinyls.map(enrichVinylWithOwner));
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const audioUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio type'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB for audio
});

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const roleMiddleware = (allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

app.post('/upload-cover', authMiddleware, upload.single('cover'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  try {
    const filename = `cover-${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
    const filepath = path.join(__dirname, 'uploads', filename);
    
    await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toFile(filepath);
    
    const url = `http://localhost:4001/${filename}`;
    res.json({ url, filename });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

app.post('/upload-music', authMiddleware, audioUpload.single('music'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  try {
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const filename = `music-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filepath = path.join(__dirname, 'uploads', 'music', filename);
    
    const musicDir = path.join(__dirname, 'uploads', 'music');
    if (!fs.existsSync(musicDir)) {
      fs.mkdirSync(musicDir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, req.file.buffer);
    
    const url = `http://localhost:4001/music/${filename}`;
    res.json({ url, filename });
  } catch (error) {
    console.error('Music upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

app.get('/spotify/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ message: 'Query parameter "q" is required' });
  }

  try {
    const token = await getSpotifyToken();
    
    const response = await axios.get('https://api.spotify.com/v1/search', {
      params: {
        q,
        type: 'track',
        limit: 10,
        market: 'US',
        include_external: 'audio'
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const tracks = response.data.tracks.items.map(track => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      year: parseInt(track.album.release_date.split('-')[0]),
      coverUrl: track.album.images[0]?.url || null,
      previewUrl: track.preview_url,
      spotifyUrl: track.external_urls.spotify
    }));

    res.json(tracks);
  } catch (error) {
    const msg = error?.message || 'Unknown error';
    console.error('Spotify search error:', error.response?.data || msg);
    if (msg.includes('Spotify credentials missing')) {
      return res.status(400).json({ message: 'Spotify credentials missing. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.' });
    }
    if (msg.includes('Spotify credentials invalid')) {
      return res.status(400).json({ message: 'Spotify credentials invalid. Check SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET values.' });
    }
    res.status(500).json({ message: 'Spotify search failed', error: msg });
  }
});

app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing fields' });
  const user = await User.create(username, password, 'user');
  if (!user) return res.status(400).json({ message: 'User exists' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.getByUsername(username);
  if (!user || !User.verifyPassword(user, password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.get('/vinyls', authMiddleware, async (req, res) => {
  const vinyls = await Vinyl.getAll();
  const enriched = await enrichVinylsWithOwners(vinyls);
  res.json(enriched);
});

app.get('/vinyls/:id', authMiddleware, async (req, res) => {
  const vinyl = await Vinyl.getById(req.params.id);
  if (!vinyl) return res.status(404).json({ message: 'Not found' });
  const enriched = await enrichVinylWithOwner(vinyl);
  res.json(enriched);
});

app.post('/vinyls', authMiddleware, roleMiddleware(['admin', 'user']), async (req, res) => {
  const { title, artist, year, coverUrl, musicUrl, note } = req.body;
  console.log('Creating vinyl with:', { title, artist, year, coverUrl, musicUrl, note });
  if (!title || !artist) return res.status(400).json({ message: 'Missing fields' });
  const vinyl = await Vinyl.create({ title, artist, year, coverUrl, musicUrl: musicUrl || '', note: note || '', ownerId: req.user.id });
  console.log('Created vinyl:', vinyl);
  const enriched = await enrichVinylWithOwner(vinyl);
  res.status(201).json(enriched);
});

app.put('/vinyls/:id', authMiddleware, async (req, res) => {
  const vinyl = await Vinyl.getById(req.params.id);
  if (!vinyl) return res.status(404).json({ message: 'Not found' });
  if (req.user.role !== 'admin' && vinyl.ownerId !== req.user.id) {
    return res.status(403).json({ message: 'Cannot edit other user\'s vinyl' });
  }
  const updated = await Vinyl.update(req.params.id, req.body);
  const enriched = await enrichVinylWithOwner(updated);
  res.json(enriched);
});

app.delete('/vinyls/:id', authMiddleware, async (req, res) => {
  const vinyl = await Vinyl.getById(req.params.id);
  if (!vinyl) return res.status(404).json({ message: 'Not found' });
  if (req.user.role !== 'admin' && vinyl.ownerId !== req.user.id) {
    return res.status(403).json({ message: 'Cannot delete other user\'s vinyl' });
  }
  await Vinyl.delete(req.params.id);
  res.status(204).end();
});

app.post('/vinyls/:id/like', authMiddleware, async (req, res) => {
  const vinyl = await Vinyl.addLike(req.params.id, req.user.id);
  if (!vinyl) return res.status(404).json({ message: 'Not found' });
  res.json({ likes: vinyl.likes.length, liked: true });
});

app.delete('/vinyls/:id/like', authMiddleware, async (req, res) => {
  const vinyl = await Vinyl.removeLike(req.params.id, req.user.id);
  if (!vinyl) return res.status(404).json({ message: 'Not found' });
  res.json({ likes: vinyl.likes.length, liked: false });
});

app.get('/users', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const users = (await User.getAll()).map(u => ({ id: u.id, username: u.username, role: u.role }));
  res.json(users);
});

app.put('/users/:id/role', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const { role } = req.body;
  const updated = await User.update(req.params.id, { role });
  if (!updated) return res.status(404).json({ message: 'Not found' });
  res.json({ id: updated.id, username: updated.username, role: updated.role });
});

app.delete('/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  if (!await User.delete(req.params.id)) return res.status(404).json({ message: 'Not found' });
  res.status(204).end();
});

const PORT = process.env.PORT || 4001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Medioteka backend on http://${HOST}:${PORT}`));
