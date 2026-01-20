import fs from 'fs';
import path from 'path';
import { getBooks as getBooksDefault, createBook as createBookDefault, updateBook as updateBookDefault, deleteBook as deleteBookDefault, default as apiDefault } from './api.js';

function getBackendBase() {
  // Prefer explicit env var
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
  // Fallback to port file written by backend
  try {
    const p = path.resolve(new URL('.', import.meta.url).pathname, '..', 'backend', '.backend-port.json');
    if (fs.existsSync(p)) {
      const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (obj && obj.port) return `http://localhost:${obj.port}`;
    }
  } catch (e) {
    // ignore
  }
  return 'http://localhost:4000';
}

async function runChecks() {
  const base = getBackendBase();
  apiDefault.defaults.baseURL = base;
  try {
    console.log('Calling getBooks() against', base);
    const books = await getBooksDefault();
    console.log('getBooks result:', books);

    console.log('Creating a test book...');
    const created = await createBookDefault({ name: 'Test Book', author: 'Tester', publishDate: '2025-01-01' });
    console.log('Created:', created);

    console.log('Updating the test book...');
    const updated = await updateBookDefault(created.id, { name: 'Updated Test Book' });
    console.log('Updated:', updated);

    console.log('Deleting the test book...');
    const deleted = await deleteBookDefault(created.id);
    console.log('Deleted:', deleted);
  } catch (err) {
    console.error('API check failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
}

runChecks();
