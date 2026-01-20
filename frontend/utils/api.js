import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001',
});

// Initialize token from localStorage if available (client-side only)
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('token');
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

// Store token in localStorage
export function setToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

export function getToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

export function clearToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
  }
}

// Auth
export async function login(username, password) {
  const res = await api.post('/auth/login', { username, password });
  setToken(res.data.token);
  return res.data;
}

export async function register(username, password) {
  const res = await api.post('/auth/register', { username, password });
  setToken(res.data.token);
  return res.data;
}

// Vinyl CRUD
export async function getVinyls() {
  const res = await api.get('/vinyls');
  return res.data;
}

export async function getVinyl(id) {
  const res = await api.get(`/vinyls/${id}`);
  return res.data;
}

export async function createVinyl(data) {
  const res = await api.post('/vinyls', data);
  return res.data;
}

export async function updateVinyl(id, data) {
  const res = await api.put(`/vinyls/${id}`, data);
  return res.data;
}

export async function deleteVinyl(id) {
  const res = await api.delete(`/vinyls/${id}`);
  return res.status === 204;
}

// Likes
export async function likeVinyl(id) {
  const res = await api.post(`/vinyls/${id}/like`);
  return res.data;
}

export async function unlikeVinyl(id) {
  const res = await api.delete(`/vinyls/${id}/like`);
  return res.data;
}

// Upload functions
export async function uploadCover(file) {
  const formData = new FormData();
  formData.append('cover', file);
  const res = await api.post('/upload-cover', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function uploadMusic(file) {
  const formData = new FormData();
  formData.append('music', file);
  const res = await api.post('/upload-music', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

// Spotify
export async function searchSpotify(query) {
  const res = await api.get('/spotify/search', { params: { q: query } });
  return res.data;
}

// Users (admin)
export async function getUsers() {
  const res = await api.get('/users');
  return res.data;
}

export async function updateUserRole(id, role) {
  const res = await api.put(`/users/${id}/role`, { role });
  return res.data;
}

export async function deleteUser(id) {
  const res = await api.delete(`/users/${id}`);
  return res.status === 204;
}

export default api;
