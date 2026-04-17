const express = require('express');
const path = require('path');
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
const db = require('./db');

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

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Travel Map server running on http://localhost:${PORT}`);
  });
}
