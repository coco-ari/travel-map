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

app.get('/visited', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'visited.html'));
});

// Auto-tag restaurants based on name patterns
function autoTag(name) {
  const rules = [
    [/火锅|牛肉火锅|重庆火锅/, '火锅'],
    [/椰子鸡/, '粤菜'],
    [/湘菜|辣椒炒肉|笨萝卜|浏阳蒸菜/, '湘菜'],
    [/点都德|陶陶居|蔡澜|港式点心/, '点心'],
    [/烧烤/, '烧烤'],
    [/客家菜/, '客家菜'],
    [/西贝莜面村/, '西北菜'],
    [/酸菜鱼/, '川菜'],
    [/茶餐厅|港式/, '茶餐厅'],
    [/蒸菜/, '湘菜'],
    [/椰子/, '粤菜'],
    [/莆田/, '闽菜'],
    [/桂满陇/, '江浙菜'],
    [/南京大牌档/, '江浙菜'],
    [/探鱼/, '烤鱼'],
    [/费大厨/, '湘菜'],
    [/农耕记/, '湘菜'],
    [/翠园/, '粤菜'],
    [/炳胜/, '粤菜'],
    [/海底捞/, '火锅'],
    [/木屋烧烤/, '烧烤'],
    [/胜记/, '粤菜'],
    [/凑凑/, '火锅'],
    [/怂重庆/, '火锅'],
    [/文和友/, '湘菜'],
    [/利宝阁/, '粤菜'],
    [/半岛/, '粤菜'],
    [/嘉味/, '粤菜'],
    [/喜茶/, '茶饮'],
    [/左庭右院/, '火锅'],
    [/佬麻雀/, '湘菜'],
  ];
  const tags = [];
  for (const [re, tag] of rules) {
    if (re.test(name) && !tags.includes(tag)) tags.push(tag);
  }
  return tags.join(',');
}

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
  const { status, search: q, visited } = req.query;
  if (q) {
    return res.json(db.search(q, status));
  }
  if (visited === 'true') {
    return res.json(db.getVisited());
  }
  res.json(db.getAll(status));
});

app.patch('/api/shops/:id/notes', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { notes, rating } = req.body;
  if (!db.getById(id)) {
    return res.status(404).json({ error: 'shop not found' });
  }
  const shop = db.updateNotes(id, notes || '', rating || 0);
  res.json(shop);
});

app.post('/api/shops', (req, res) => {
  const { name, lat, lng } = req.body;
  if (!name || lat == null || lng == null) {
    return res.status(400).json({ error: 'name, lat, lng are required' });
  }
  const shop = db.create({ name, lat, lng, tags: autoTag(name) });
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
      db.create({ ...r, tags: autoTag(r.name) });
    }
    console.log(`Auto-seeded ${seedRestaurants.length} restaurants.`);
  } else {
    // Tag any untagged existing shops
    const untagged = shops.filter(s => !s.tags);
    if (untagged.length > 0) {
      for (const s of untagged) {
        db.prepare('UPDATE shops SET tags = ? WHERE id = ?').run(autoTag(s.name), s.id);
      }
      console.log(`Auto-tagged ${untagged.length} existing shops.`);
    }
  }

  app.listen(PORT, () => {
    console.log(`吃货地图 server running on http://localhost:${PORT}`);
  });
}