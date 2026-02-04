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
const Playlist = require('./models/playlist.sql');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

const SECRET = 'medioteka-secret-key-2025';

// iTunes API - no authentication required! 🎵

// Fix localhost URLs to production URLs
function fixMediaUrls(url) {
  if (!url) return url;
  if (typeof url !== 'string') return url;
  return url.replace('http://localhost:4001', 'https://vinyl-casik-production.up.railway.app');
}

// Normalize DB keys (PostgreSQL returns lowercase column names)
function normalizeVinyl(v) {
  const normalized = {
    id: v.id,
    title: v.title,
    artist: v.artist,
    year: v.year,
    coverUrl: fixMediaUrls(v.coverUrl || v.coverurl || null),
    musicUrl: fixMediaUrls(v.musicUrl || v.musicurl || null),
    note: v.note || '',
    ownerId: v.ownerId || v.ownerid,
    likes: Array.isArray(v.likes) ? v.likes : (v.likes || []),
    created_at: v.created_at,
    updated_at: v.updated_at,
  };
  return normalized;
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

app.post('/upload-playlist-cover', authMiddleware, upload.single('cover'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  try {
    const filename = `playlist-cover-${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
    const filepath = path.join(__dirname, 'uploads', filename);
    
    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toFile(filepath);
    
    const PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || process.env.PUBLIC_BACKEND_URL || 'http://localhost:4001';
    const url = `${PUBLIC_URL}/${filename}`;
    res.json({ url, filename });
  } catch (error) {
    console.error('Playlist cover upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// Search iTunes for music tracks with preview URLs
async function searchItunes(query) {
  try {
    const response = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: query,
        media: 'music',
        entity: 'song',
        limit: 50
      }
    });
    
    // Helper function to get high quality image URL
    const getHighQualityCover = (artworkUrl) => {
      if (!artworkUrl) return null;
      // Replace 100x100 or 60x60 with 500x500 for high quality
      return artworkUrl.replace(/\d{2,3}x\d{2,3}/, '500x500');
    };
    
    // Map results and remove duplicates
    const seen = new Set();
    const tracks = [];
    
    // First pass: tracks WITH preview
    for (const result of response.data.results) {
      if (result.previewUrl) {
        const key = `${result.trackName.toLowerCase()}-${result.artistName.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          const coverUrl = result.artworkUrl100 || result.artworkUrl60;
          tracks.push({
            id: result.trackId,
            title: result.trackName,
            artist: result.artistName,
            album: result.collectionName,
            year: parseInt(result.releaseDate.split('-')[0]),
            coverUrl: getHighQualityCover(coverUrl),
            previewUrl: result.previewUrl
          });
        }
      }
    }
    
    // Second pass: tracks WITHOUT preview (fill remaining)
    for (const result of response.data.results) {
      if (!result.previewUrl) {
        const key = `${result.trackName.toLowerCase()}-${result.artistName.toLowerCase()}`;
        if (!seen.has(key) && tracks.length < 20) {
          seen.add(key);
          const coverUrl = result.artworkUrl100 || result.artworkUrl60;
          tracks.push({
            id: result.trackId,
            title: result.trackName,
            artist: result.artistName,
            album: result.collectionName,
            year: parseInt(result.releaseDate.split('-')[0]),
            coverUrl: getHighQualityCover(coverUrl),
            previewUrl: null
          });
        }
      }
    }
    
    return tracks.slice(0, 20);
  } catch (error) {
    console.error('iTunes search error:', error.message);
    return [];
  }
}

app.get('/spotify/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ message: 'Query parameter "q" is required' });
  }

  try {
    console.log('🎵 iTunes Search for:', q);
    const tracks = await searchItunes(q);
    
    console.log('=== iTunes Search Results ===');
    console.log('Query:', q);
    console.log('Total results:', tracks.length);
    if (tracks.length > 0) {
      console.log('First track:', JSON.stringify(tracks[0], null, 2));
    }
    console.log('Tracks with preview:', tracks.filter(t => t.previewUrl).length);

    res.json(tracks);
  } catch (error) {
    const msg = error?.message || 'Unknown error';
    console.error('Search error:', msg);
    res.status(500).json({ message: msg });
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

// ===== PLAYLIST ROUTES =====

// Get all playlists for current user
app.get('/playlists', authMiddleware, async (req, res) => {
  try {
    const playlists = await Playlist.getAllByUser(req.user.id);
    res.json(playlists);
  } catch (err) {
    console.error('Get playlists error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get single playlist with songs
app.get('/playlists/:id', authMiddleware, async (req, res) => {
  try {
    const playlist = await Playlist.getById(req.params.id, req.user.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    res.json(playlist);
  } catch (err) {
    console.error('Get playlist error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Create new playlist
app.post('/playlists', authMiddleware, async (req, res) => {
  try {
    const { name, description, coverUrl } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const playlist = await Playlist.create(name, description, coverUrl, req.user.id);
    res.status(201).json(playlist);
  } catch (err) {
    console.error('Create playlist error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update playlist
app.put('/playlists/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description, coverUrl } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const playlist = await Playlist.update(req.params.id, req.user.id, name, description, coverUrl);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    res.json(playlist);
  } catch (err) {
    console.error('Update playlist error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete playlist
app.delete('/playlists/:id', authMiddleware, async (req, res) => {
  try {
    await Playlist.delete(req.params.id, req.user.id);
    res.status(204).end();
  } catch (err) {
    console.error('Delete playlist error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Add song to playlist
app.post('/playlists/:id/songs', authMiddleware, async (req, res) => {
  try {
    const { vinylId } = req.body;
    if (!vinylId) return res.status(400).json({ message: 'vinylId is required' });
    await Playlist.addSong(req.params.id, vinylId, req.user.id);
    res.status(201).json({ message: 'Song added to playlist' });
  } catch (err) {
    console.error('Add song error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Remove song from playlist
app.delete('/playlists/:id/songs/:vinylId', authMiddleware, async (req, res) => {
  try {
    await Playlist.removeSong(req.params.id, req.params.vinylId, req.user.id);
    res.status(204).end();
  } catch (err) {
    console.error('Remove song error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Reorder songs in playlist
app.put('/playlists/:id/reorder', authMiddleware, async (req, res) => {
  try {
    const { songOrder } = req.body;
    if (!Array.isArray(songOrder)) return res.status(400).json({ message: 'songOrder must be an array' });
    await Playlist.reorderSongs(req.params.id, req.user.id, songOrder);
    res.json({ message: 'Playlist reordered' });
  } catch (err) {
    console.error('Reorder error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Medioteka backend is running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Medioteka backend on http://${HOST}:${PORT}`));
