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
    notes       TEXT DEFAULT '',
    rating      INTEGER DEFAULT 0,
    tags        TEXT DEFAULT '',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: add new columns to existing databases
const columns = db.pragma('table_info(shops)').map(c => c.name);
if (!columns.includes('notes')) db.exec("ALTER TABLE shops ADD COLUMN notes TEXT DEFAULT ''");
if (!columns.includes('rating')) db.exec("ALTER TABLE shops ADD COLUMN rating INTEGER DEFAULT 0");
if (!columns.includes('tags')) db.exec("ALTER TABLE shops ADD COLUMN tags TEXT DEFAULT ''");

db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id     INTEGER NOT NULL,
    url         TEXT NOT NULL,
    s3_key      TEXT DEFAULT '',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
  )
`);

// Migration: add url and s3_key columns to existing databases
const photoColumns = db.pragma('table_info(photos)').map(c => c.name);
if (!photoColumns.includes('url')) {
  db.exec("ALTER TABLE photos ADD COLUMN url TEXT DEFAULT ''");
  // Migrate old filename data to url
  db.exec("UPDATE photos SET url = '/photos/' || filename WHERE url = '' AND filename != ''");
}
if (!photoColumns.includes('s3_key')) {
  db.exec("ALTER TABLE photos ADD COLUMN s3_key TEXT DEFAULT ''");
}

// Migration: make filename nullable since we now use url column
// SQLite doesn't support ALTER COLUMN, so we recreate the table
const filenameInfo = db.pragma('table_info(photos)').find(c => c.name === 'filename');
if (filenameInfo && filenameInfo.notnull === 1) {
  db.exec(`
    CREATE TABLE photos_new (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id     INTEGER NOT NULL,
      filename    TEXT,
      url         TEXT NOT NULL DEFAULT '',
      s3_key      TEXT DEFAULT '',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );
    INSERT INTO photos_new (shop_id, filename, url, s3_key, created_at)
      SELECT shop_id, filename, url, s3_key, created_at FROM photos;
    DROP TABLE photos;
    ALTER TABLE photos_new RENAME TO photos;
  `);
}

function addPhoto(shopId, url, s3Key) {
  const info = db.prepare(
    'INSERT INTO photos (shop_id, url, s3_key) VALUES (?, ?, ?)'
  ).run(shopId, url, s3Key || '');
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

function removePhoto(id) {
  db.prepare('DELETE FROM photos WHERE id = ?').run(id);
}

function getAll(status) {
  if (status) {
    return db.prepare('SELECT * FROM shops WHERE status = ? ORDER BY created_at DESC').all(status);
  }
  return db.prepare('SELECT * FROM shops ORDER BY created_at DESC').all();
}

function create({ name, lat, lng, tags }) {
  const info = db.prepare(
    'INSERT INTO shops (name, lat, lng, tags) VALUES (?, ?, ?, ?)'
  ).run(name, lat, lng, tags || '');
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

function search(keyword, status) {
  if (status && status !== 'all') {
    return db.prepare(
      "SELECT * FROM shops WHERE status = ? AND name LIKE ? ORDER BY created_at DESC"
    ).all(status, `%${keyword}%`);
  }
  return db.prepare(
    "SELECT * FROM shops WHERE name LIKE ? ORDER BY created_at DESC"
  ).all(`%${keyword}%`);
}

function getVisited() {
  return db.prepare(
    "SELECT * FROM shops WHERE status = 'visited' ORDER BY created_at DESC"
  ).all();
}

function updateNotes(id, notes, rating) {
  db.prepare('UPDATE shops SET notes = ?, rating = ? WHERE id = ?').run(notes, rating || 0, id);
  return db.prepare('SELECT * FROM shops WHERE id = ?').get(id);
}

module.exports = { getAll, create, getById, remove, updateStatus, addPhoto, getPhotosByShopId, deletePhoto, removePhoto, search, getVisited, updateNotes };
