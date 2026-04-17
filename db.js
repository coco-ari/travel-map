const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(dbPath);

// Initialize table
db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    lat         REAL NOT NULL,
    lng         REAL NOT NULL,
    status      TEXT DEFAULT 'unvisited',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id     INTEGER NOT NULL,
    filename    TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
  )
`);

function addPhoto(shopId, filename) {
  const info = db.prepare(
    'INSERT INTO photos (shop_id, filename) VALUES (?, ?)'
  ).run(shopId, filename);
  return db.prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid);
}

function getPhotosByShopId(shopId) {
  return db.prepare(
    'SELECT * FROM photos WHERE shop_id = ? ORDER BY created_at DESC'
  ).all(shopId);
}

function deletePhoto(id) {
  return db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
}

function getAll(status) {
  if (status) {
    return db.prepare('SELECT * FROM shops WHERE status = ? ORDER BY created_at DESC').all(status);
  }
  return db.prepare('SELECT * FROM shops ORDER BY created_at DESC').all();
}

function create({ name, lat, lng }) {
  const info = db.prepare(
    'INSERT INTO shops (name, lat, lng) VALUES (?, ?, ?)'
  ).run(name, lat, lng);
  return db.prepare('SELECT * FROM shops WHERE id = ?').get(info.lastInsertRowid);
}

function getById(id) {
  return db.prepare('SELECT * FROM shops WHERE id = ?').get(id);
}

function remove(id) {
  db.prepare('DELETE FROM shops WHERE id = ?').run(id);
}

function updateStatus(id, status) {
  db.prepare('UPDATE shops SET status = ? WHERE id = ?').run(status, id);
  return db.prepare('SELECT * FROM shops WHERE id = ?').get(id);
}

module.exports = { getAll, create, getById, remove, updateStatus, addPhoto, getPhotosByShopId, deletePhoto };
