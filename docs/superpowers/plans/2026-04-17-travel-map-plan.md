# 旅游地图 (Travel Map) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个移动端优先的旅游地图网页应用，用 Leaflet.js 显示地图、GPS 定位、标记店铺，配合 Node.js + Express + SQLite 后端实现数据持久化，UI 采用微信风格。

**Architecture:** 前后端一体，Express serve 静态 HTML/JS + REST API，单表 SQLite 存储。

**Tech Stack:** Node.js, Express, better-sqlite3, Leaflet.js, 原生 JavaScript

## 文件结构

```
travel-map/
├── package.json                          # 项目配置与依赖
├── server.js                             # Express 服务器入口
├── db.js                                 # 数据库初始化与操作层
├── public/
│   ├── index.html                        # 地图主页
│   ├── admin.html                        # 店铺管理页
│   ├── css/
│   │   └── wechat.css                    # 微信风格全局样式
│   └── js/
│       ├── map.js                        # 地图逻辑（定位、标记、交互）
│       └── admin.js                      # 管理页逻辑（列表、增删）
├── tests/
│   └── api.test.js                       # API 接口测试
└── docs/
    └── superpowers/
        ├── specs/2026-04-17-travel-map-design.md
        └── plans/2026-04-17-travel-map-plan.md
```

---

### Task 1: 项目初始化与 Express 骨架

**Files:**
- Create: `package.json`
- Create: `server.js`
- Create: `public/index.html`
- Create: `.gitignore`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "travel-map",
  "version": "1.0.0",
  "description": "旅游地图 - 在地图上标记你想去的店铺",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test tests/**/*.test.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "express": "^4.21.0"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: 安装依赖**

Run: `npm install`
Expected: `node_modules/` 和 `package-lock.json` 生成

- [ ] **Step 3: 创建 .gitignore**

```
node_modules/
*.db
```

- [ ] **Step 4: 创建 server.js（Express 骨架）**

```js
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Page routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Travel Map server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 5: 创建 public/index.html（空白页面骨架）**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>旅游地图</title>
  <link rel="stylesheet" href="css/wechat.css">
</head>
<body>
  <div id="app">
    <header class="navbar">
      <span class="navbar-title">旅游地图</span>
      <a href="/admin" class="navbar-btn">列表</a>
    </header>
    <main id="map-container"></main>
  </div>
</body>
</html>
```

- [ ] **Step 6: 启动验证**

Run: `npm start`
Expected: 输出 `Travel Map server running on http://localhost:3000`
访问 `http://localhost:3000` 应显示页面骨架

- [ ] **Step 7: Commit**

```bash
git add package.json server.js public/index.html .gitignore package-lock.json
git commit -m "feat: init express server skeleton"
```

---

### Task 2: 微信风格 CSS

**Files:**
- Create: `public/css/wechat.css`

- [ ] **Step 1: 创建 public/css/wechat.css**

```css
/* ===== CSS Variables ===== */
:root {
  --wechat-green: #07C160;
  --bg-color: #EDEDED;
  --card-bg: #FFFFFF;
  --text-primary: #333333;
  --text-secondary: #999999;
  --divider: #E5E5E5;
  --orange: #FF9F00;
  --blue: #4A90D9;
  --gray: #B0B0B0;
  --danger: #FA5151;
  --tap-color: #F0F0F0;
}

/* ===== Reset ===== */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC",
    "Microsoft YaHei", sans-serif;
  background: var(--bg-color);
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1.5;
  -webkit-tap-highlight-color: transparent;
}

/* ===== Navbar ===== */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: var(--card-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--divider);
  z-index: 1000;
  padding: 0 12px;
}

.navbar-title {
  font-size: 17px;
  font-weight: 600;
}

.navbar-btn {
  position: absolute;
  right: 12px;
  color: var(--text-primary);
  text-decoration: none;
  font-size: 15px;
  padding: 6px 10px;
  border-radius: 6px;
}

.navbar-btn:active {
  background: var(--tap-color);
}

/* ===== Map Container ===== */
#map-container {
  position: fixed;
  top: 48px;
  left: 0;
  right: 0;
  bottom: 0;
}

/* ===== Buttons ===== */
.btn {
  display: inline-block;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 15px;
  cursor: pointer;
  text-align: center;
  -webkit-user-select: none;
  user-select: none;
}

.btn:active {
  opacity: 0.8;
}

.btn-primary {
  background: var(--wechat-green);
  color: #fff;
}

.btn-danger {
  background: var(--danger);
  color: #fff;
}

.btn-secondary {
  background: var(--bg-color);
  color: var(--text-primary);
  border: 1px solid var(--divider);
}

/* ===== Modal / Popup ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal {
  background: var(--card-bg);
  border-radius: 12px;
  width: 85%;
  max-width: 320px;
  overflow: hidden;
}

.modal-header {
  padding: 16px;
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid var(--divider);
}

.modal-body {
  padding: 16px;
}

.modal-footer {
  display: flex;
  border-top: 1px solid var(--divider);
}

.modal-footer .btn {
  flex: 1;
  padding: 12px;
  border-radius: 0;
  background: transparent;
  color: var(--text-primary);
}

.modal-footer .btn + .btn {
  border-left: 1px solid var(--divider);
}

.modal-footer .btn-confirm {
  color: var(--wechat-green);
  font-weight: 600;
}

.modal-footer .btn-danger {
  color: var(--danger);
}

/* ===== ActionSheet ===== */
.actionsheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 2000;
}

.actionsheet {
  background: var(--card-bg);
  border-radius: 12px 12px 0 0;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
}

.actionsheet-cancel {
  margin-top: 8px;
}

/* ===== Input ===== */
.input {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid var(--divider);
  border-radius: 6px;
  font-size: 16px;
  background: var(--card-bg);
  outline: none;
}

.input:focus {
  border-bottom-color: var(--wechat-green);
}

/* ===== List ===== */
.list {
  padding-top: 48px;
}

.list-item {
  background: var(--card-bg);
  padding: 12px 16px;
  border-bottom: 1px solid var(--divider);
}

.list-item:active {
  background: var(--tap-color);
}

.list-item-title {
  font-size: 16px;
  font-weight: 500;
}

.list-item-meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* ===== Toggle Switch ===== */
.toggle {
  position: relative;
  width: 48px;
  height: 28px;
  display: inline-block;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--gray);
  border-radius: 28px;
  transition: background 0.2s;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 24px;
  background: #fff;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
}

.toggle input:checked + .toggle-slider {
  background: var(--wechat-green);
}

.toggle input:checked + .toggle-slider::after {
  transform: translateX(20px);
}

/* ===== Utility ===== */
.hidden { display: none !important; }
.text-center { text-align: center; }
.mt-8 { margin-top: 8px; }
.mt-16 { margin-top: 16px; }
.flex-center { display: flex; align-items: center; justify-content: center; }
```

- [ ] **Step 2: Commit**

```bash
git add public/css/wechat.css
git commit -m "feat: add WeChat-style CSS"
```

---

### Task 3: 数据库层 (db.js)

**Files:**
- Create: `db.js`
- Test: `tests/api.test.js` (write tests first for each DB operation)

- [ ] **Step 1: 创建 API 测试骨架（先写测试）**

```js
const assert = require('assert');
const http = require('http');

const BASE = 'http://localhost:3000';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('GET /api/shops', () => {
  it('returns empty array when no shops', async () => {
    const res = await request('GET', '/api/shops');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, []);
  });

  it('returns shops after POST', async () => {
    const postRes = await request('POST', '/api/shops', {
      name: '测试店铺',
      lat: 39.9,
      lng: 116.4,
    });
    assert.strictEqual(postRes.status, 201);

    const getRes = await request('GET', '/api/shops');
    assert.strictEqual(getRes.status, 200);
    assert.ok(getRes.body.length > 0);
    assert.strictEqual(getRes.body[0].name, '测试店铺');
  });
});

describe('DELETE /api/shops/:id', () => {
  it('deletes a shop', async () => {
    const postRes = await request('POST', '/api/shops', {
      name: '待删除店铺',
      lat: 39.9,
      lng: 116.4,
    });
    const id = postRes.body.id;

    const delRes = await request('DELETE', `/api/shops/${id}`);
    assert.strictEqual(delRes.status, 200);

    const getRes = await request('GET', '/api/shops');
    const exists = getRes.body.some((s) => s.id === id);
    assert.strictEqual(exists, false);
  });
});

describe('PATCH /api/shops/:id/status', () => {
  it('updates shop status to visited', async () => {
    const postRes = await request('POST', '/api/shops', {
      name: '状态测试',
      lat: 39.9,
      lng: 116.4,
    });
    const id = postRes.body.id;

    const patchRes = await request('PATCH', `/api/shops/${id}/status`, {
      status: 'visited',
    });
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.body.status, 'visited');
  });
});
```

- [ ] **Step 2: 创建 db.js**

```js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.db'));

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

module.exports = { getAll, create, getById, remove, updateStatus };
```

- [ ] **Step 3: 在 server.js 中添加 API 路由**

在 `app.get('/admin', ...)` 之后、`app.listen` 之前添加：

```js
const db = require('./db');

// API routes
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
```

- [ ] **Step 4: 运行测试验证**

Run: `npm start` (in one terminal), then `npm test` (in another)
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add db.js server.js tests/api.test.js
git commit -m "feat: add SQLite database layer and REST API"
```

---

### Task 4: 地图主页 — 定位与基础地图

**Files:**
- Modify: `public/index.html` (add Leaflet CDN, map.js script)
- Create: `public/js/map.js`

- [ ] **Step 1: 更新 public/index.html 引入 Leaflet**

完整文件内容：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>旅游地图</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="css/wechat.css">
</head>
<body>
  <div id="app">
    <header class="navbar">
      <span class="navbar-title">旅游地图</span>
      <a href="/admin" class="navbar-btn">列表</a>
    </header>
    <main id="map-container"></main>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="js/map.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 public/js/map.js（定位 + 基础地图）**

```js
// ===== Map Initialization =====
const map = L.map('map-container', {
  zoomControl: false,
}).setView([39.9042, 116.4074], 15); // 北京默认

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19,
}).addTo(map);

// ===== State =====
let userLat = null;
let userLng = null;
let userMarker = null;
let shopMarkers = {};

// ===== Location =====
function initLocation() {
  if (!navigator.geolocation) {
    alert('您的浏览器不支持定位功能');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      map.setView([userLat, userLng], 15);
      addLocationMarker(userLat, userLng);
      loadShops();
    },
    (err) => {
      console.error('定位失败:', err);
      alert('无法获取您的位置，请允许定位权限');
    },
    { enableHighAccuracy: true }
  );
}

function addLocationMarker(lat, lng) {
  if (userMarker) userMarker.setLatLng([lat, lng]);

  const icon = L.divIcon({
    className: 'location-pin',
    html: `<div style="
      width: 16px; height: 16px;
      background: #4A90D9;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(74,144,217,0.3);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
}

// ===== Shop Loading =====
async function loadShops() {
  const res = await fetch('/api/shops?status=unvisited');
  const shops = await res.json();
  shops.forEach((shop) => addShopMarker(shop));
}

function addShopMarker(shop) {
  if (shopMarkers[shop.id]) return;

  const isNearby = getDistance(userLat, userLng, shop.lat, shop.lng) <= 2000;

  const markerColor = isNearby ? '#FF9F00' : '#07C160';
  const markerSize = isNearby ? 14 : 10;

  const icon = L.divIcon({
    className: 'shop-pin',
    html: `<div style="
      width: ${markerSize}px; height: ${markerSize}px;
      background: ${markerColor};
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize / 2, markerSize / 2],
  });

  const marker = L.marker([shop.lat, shop.lng], { icon }).addTo(map);
  marker.bindPopup(createShopPopup(shop));
  shopMarkers[shop.id] = marker;
}

function createShopPopup(shop) {
  const popup = document.createElement('div');
  popup.className = 'shop-popup';
  popup.innerHTML = `
    <div class="shop-popup-name">${escapeHtml(shop.name)}</div>
    <div class="shop-popup-actions">
      <button class="btn btn-primary btn-sm" onclick="markVisited(${shop.id})">已吃</button>
      <button class="btn btn-secondary btn-sm" onclick="showDetail(${shop.id})">详情</button>
      <button class="btn btn-secondary btn-sm" onclick="navigateTo(${shop.lat}, ${shop.lng})">导航</button>
    </div>
  `;
  return popup;
}

// ===== Distance (Haversine) =====
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Public API =====
window.markVisited = async function(id) {
  await fetch(`/api/shops/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'visited' }),
  });
  if (shopMarkers[id]) {
    map.removeLayer(shopMarkers[id]);
    delete shopMarkers[id];
  }
  map.closePopup();
};

window.showDetail = function(id) {
  const marker = shopMarkers[id];
  if (marker) {
    const { lat, lng } = marker.getLatLng();
    // Extract shop name from popup content
    const popupEl = marker.getPopup().getElement();
    const nameEl = popupEl.querySelector('.shop-popup-name');
    const name = nameEl ? nameEl.textContent : '未知';

    const detail = document.createElement('div');
    detail.className = 'modal-overlay';
    detail.innerHTML = `
      <div class="modal">
        <div class="modal-header">店铺详情</div>
        <div class="modal-body">
          <div style="margin-bottom:8px;"><strong>店名：</strong>${escapeHtml(name)}</div>
          <div style="margin-bottom:8px;"><strong>坐标：</strong>${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
          <div><strong>状态：</strong>未去</div>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(detail);
  }
};

window.navigateTo = function(lat, lng) {
  if (userLat && userLng) {
    window.location.href = `amapuri://route/plan/?slat=${userLat}&slon=${userLng}&dlat=${lat}&dlon=${lng}&dev=0`;
  } else {
    window.open(`https://uri.amap.com/marker?position=${lng},${lat}`);
  }
};

// ===== Add Shop Mode =====
let addMode = false;

window.toggleAddMode = function() {
  addMode = !addMode;
  document.getElementById('add-btn').textContent = addMode ? '取消' : '添加';
  document.getElementById('add-btn').classList.toggle('btn-primary', !addMode);
  document.getElementById('add-btn').classList.toggle('btn-danger', addMode);
  map.getContainer().style.cursor = addMode ? 'crosshair' : '';
};

map.on('click', async (e) => {
  if (!addMode) return;

  const name = prompt('请输入店名:');
  if (!name) return;

  const res = await fetch('/api/shops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, lat: e.latlng.lat, lng: e.latlng.lng }),
  });

  if (res.ok) {
    const shop = await res.json();
    addShopMarker(shop);
    toggleAddMode();
  }
});

// ===== Init =====
initLocation();
```

- [ ] **Step 3: 更新 index.html 添加"添加"按钮**

在 `<main id="map-container"></main>` 后面添加：

```html
    <button id="add-btn" class="btn btn-primary add-btn" onclick="toggleAddMode()">添加</button>
```

并在 wechat.css 中添加：

```css
.add-btn {
  position: fixed;
  bottom: 24px;
  right: 16px;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
```

- [ ] **Step 4: 手动验证**

Run: `npm start`
访问 `http://localhost:3000`
- 允许定位后地图应显示蓝色圆点
- 点击"添加"后点击地图位置，输入店名，出现绿色标记
- 点击标记弹出气泡，有"已吃"、"详情"、"导航"按钮

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/js/map.js public/css/wechat.css
git commit -m "feat: add map page with GPS location and shop markers"
```

---

### Task 5: 店铺管理后台页面

**Files:**
- Create: `public/admin.html`
- Create: `public/js/admin.js`

- [ ] **Step 1: 创建 public/admin.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>店铺管理</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="css/wechat.css">
</head>
<body>
  <header class="navbar">
    <a href="/" class="navbar-btn" style="left:12px;right:auto;">返回地图</a>
    <span class="navbar-title">店铺管理</span>
    <span class="navbar-btn" onclick="openManualAdd()">添加</span>
  </header>

  <main class="list" id="shop-list"></main>

  <!-- Manual Add Modal -->
  <div id="manual-add-modal" class="modal-overlay hidden">
    <div class="modal">
      <div class="modal-header">手动添加店铺</div>
      <div class="modal-body">
        <input id="manual-name" class="input" placeholder="店名" style="margin-bottom:12px;">
        <input id="manual-lat" class="input" placeholder="纬度" style="margin-bottom:12px;" type="number" step="0.000001">
        <input id="manual-lng" class="input" placeholder="经度" type="number" step="0.000001">
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeManualAdd()">取消</button>
        <button class="btn btn-confirm" onclick="submitManualAdd()">确定</button>
      </div>
    </div>
  </div>

  <!-- Delete ActionSheet -->
  <div id="delete-actionsheet" class="actionsheet-overlay hidden">
    <div>
      <div class="actionsheet">
        <div class="modal-body text-center" style="padding:16px;">
          确定删除 <strong id="delete-shop-name"></strong> 吗？
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="closeDeleteSheet()">取消</button>
          <button class="btn btn-danger" onclick="confirmDelete()">删除</button>
        </div>
      </div>
    </div>
  </div>

  <script src="js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 public/js/admin.js**

```js
let deleteTargetId = null;

async function loadShops() {
  const res = await fetch('/api/shops');
  const shops = await res.json();
  const container = document.getElementById('shop-list');
  container.innerHTML = '';

  if (shops.length === 0) {
    container.innerHTML = '<div class="list-item text-center" style="color:#999;padding:40px 16px;">暂无店铺记录</div>';
    return;
  }

  shops.forEach((shop) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-title">
        ${escapeHtml(shop.name)}
        <span style="float:right;font-size:12px;color:${shop.status === 'visited' ? '#B0B0B0' : '#07C160'};">
          ${shop.status === 'visited' ? '已去' : '未去'}
        </span>
      </div>
      <div class="list-item-meta">
        ${shop.lat.toFixed(4)}, ${shop.lng.toFixed(4)} · ${formatDate(shop.created_at)}
      </div>
      <div style="margin-top:8px;">
        <button class="btn btn-secondary" style="font-size:13px;padding:4px 12px;" onclick="openDeleteSheet(${shop.id}, '${escapeHtml(shop.name)}')">删除</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openManualAdd() {
  document.getElementById('manual-add-modal').classList.remove('hidden');
}

function closeManualAdd() {
  document.getElementById('manual-add-modal').classList.add('hidden');
  document.getElementById('manual-name').value = '';
  document.getElementById('manual-lat').value = '';
  document.getElementById('manual-lng').value = '';
}

async function submitManualAdd() {
  const name = document.getElementById('manual-name').value.trim();
  const lat = parseFloat(document.getElementById('manual-lat').value);
  const lng = parseFloat(document.getElementById('manual-lng').value);

  if (!name || isNaN(lat) || isNaN(lng)) {
    alert('请填写完整的店名、纬度和经度');
    return;
  }

  const res = await fetch('/api/shops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, lat, lng }),
  });

  if (res.ok) {
    closeManualAdd();
    loadShops();
  } else {
    alert('添加失败');
  }
}

function openDeleteSheet(id, name) {
  deleteTargetId = id;
  document.getElementById('delete-shop-name').textContent = name;
  document.getElementById('delete-actionsheet').classList.remove('hidden');
}

function closeDeleteSheet() {
  document.getElementById('delete-actionsheet').classList.add('hidden');
  deleteTargetId = null;
}

async function confirmDelete() {
  if (!deleteTargetId) return;

  const res = await fetch(`/api/shops/${deleteTargetId}`, { method: 'DELETE' });
  if (res.ok) {
    closeDeleteSheet();
    loadShops();
  } else {
    alert('删除失败');
  }
}

// Init
loadShops();
```

- [ ] **Step 3: Commit**

```bash
git add public/admin.html public/js/admin.js
git commit -m "feat: add admin page with shop list, manual add, and delete"
```

---

### Task 6: "显示全部"开关 + 已去店铺灰化

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/map.js`
- Modify: `public/css/wechat.css`

- [ ] **Step 1: 在 index.html 导航栏添加"显示全部"开关**

将导航栏改为：

```html
    <header class="navbar">
      <label class="toggle" style="margin-left:auto;position:absolute;left:12px;">
        <input type="checkbox" id="show-all-toggle" onchange="toggleShowAll()">
        <span class="toggle-slider"></span>
      </label>
      <span class="navbar-title">旅游地图</span>
      <a href="/admin" class="navbar-btn">列表</a>
    </header>
```

并在导航栏后添加标签：

```html
    <div id="show-all-label" style="position:fixed;top:52px;left:12px;font-size:12px;color:#999;z-index:999;">显示全部</div>
```

- [ ] **Step 2: 在 wechat.css 中添加 shop-popup 样式**

```css
.shop-popup {
  text-align: center;
  min-width: 120px;
}

.shop-popup-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}

.shop-popup-actions {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 13px;
}

.location-pin {
  background: transparent !important;
  border: none !important;
}
```

- [ ] **Step 3: 在 map.js 中添加 toggleShowAll 和 visited marker 逻辑**

在 `// ===== Public API =====` 之前添加：

```js
let showAll = false;

window.toggleShowAll = async function() {
  showAll = !showAll;
  // Reload all markers
  Object.values(shopMarkers).forEach((m) => map.removeLayer(m));
  shopMarkers = {};

  const res = await fetch(showAll ? '/api/shops' : '/api/shops?status=unvisited');
  const shops = await res.json();
  shops.forEach((shop) => addShopMarker(shop));
};
```

修改 `addShopMarker` 函数，在 marker icon 创建逻辑中加入已去店铺判断：

在 `addShopMarker` 函数开头添加：

```js
function addShopMarker(shop) {
  if (shopMarkers[shop.id]) return;

  const isVisited = shop.status === 'visited';
  const markerColor = isVisited ? '#B0B0B0' : (getDistance(userLat, userLng, shop.lat, shop.lng) <= 2000 ? '#FF9F00' : '#07C160');
  const markerSize = isVisited ? 8 : (getDistance(userLat, userLng, shop.lat, shop.lng) <= 2000 ? 14 : 10);

  // ... rest unchanged
```

- [ ] **Step 4: 手动验证**

Run: `npm start`
- 点击"显示全部"开关，已去店铺应显示为灰色小标记
- 关闭开关，仅显示未去店铺

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/js/map.js public/css/wechat.css
git commit -m "feat: add show-all toggle and visited shop gray markers"
```
