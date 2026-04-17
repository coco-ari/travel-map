const express = require('express');
const path = require('path');
const db = require('./db');
const app = express();
const PORT = process.env.PORT || 9800;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Page routes (admin added in Task 5)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API routes
const multer = require('multer');
const fs = require('fs');

// Ensure photos directory exists
fs.mkdirSync(path.join(__dirname, 'public', 'photos'), { recursive: true });

const storage = multer.diskStorage({
  destination: path.join(__dirname, 'public', 'photos'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 jpg/png/webp 图片'));
    }
  }
});

app.get('/api/shops', (req, res) => {
  const { status } = req.query;
  res.json(db.getAll(status));
});

app.post('/api/shops', (req, res) => {
  const { name, lat, lng } = req.body;
  if (!name || lat == null || lng == null) {
    return res.status(400).json({ error: 'name, lat, lng are required' });
  }
  const shop = db.create({ name, lat, lng });
  res.status(201).json(shop);
});

app.delete('/api/shops/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!db.getById(id)) {
    return res.status(404).json({ error: 'shop not found' });
  }
  db.remove(id);
  res.json({ ok: true });
});

app.patch('/api/shops/:id/status', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  if (!['visited', 'unvisited'].includes(status)) {
    return res.status(400).json({ error: 'status must be visited or unvisited' });
  }
  if (!db.getById(id)) {
    return res.status(404).json({ error: 'shop not found' });
  }
  const shop = db.updateStatus(id, status);
  res.json(shop);
});

// Photo routes
app.post('/api/shops/:id/photo', upload.single('photo'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!db.getById(id)) {
    return res.status(404).json({ error: 'shop not found' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'no photo uploaded' });
  }
  const photo = db.addPhoto(id, req.file.filename);
  res.status(201).json(photo);
});

app.get('/api/shops/:id/photos', (req, res) => {
  const id = parseInt(req.params.id, 10);
  res.json(db.getPhotosByShopId(id));
});

app.delete('/api/photos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const photo = db.deletePhoto(id);
  if (!photo) {
    return res.status(404).json({ error: 'photo not found' });
  }
  db.prepare('DELETE FROM photos WHERE id = ?').run(id);
  // Delete file
  try {
    fs.unlinkSync(path.join(__dirname, 'public', 'photos', photo.filename));
  } catch {}
  res.json({ ok: true });
});

module.exports = app;

// Auto-seed on first run if database is empty
if (require.main === module) {
  const shops = db.getAll();
  if (shops.length === 0) {
    const { seedRestaurants } = require('./seed-data');
    for (const r of seedRestaurants) {
      db.create(r);
    }
    console.log(`Auto-seeded ${seedRestaurants.length} restaurants.`);
  }

  app.listen(PORT, () => {
    console.log(`Travel Map server running on http://localhost:${PORT}`);
  });
}