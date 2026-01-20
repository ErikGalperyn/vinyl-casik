import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001',
});

export async function getBooks() {
  const res = await api.get('/books');
  return res.data;
}

export async function createBook(book) {
  const res = await api.post('/books', book);
  return res.data;
}

export async function updateBook(id, book) {
  const res = await api.put(`/books/${id}`, book);
  return res.data;
}

export async function deleteBook(id) {
  const res = await api.delete(`/books/${id}`);
  return res.status === 204;
}

export default api;
