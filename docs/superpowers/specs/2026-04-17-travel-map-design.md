# 旅游地图 (Travel Map) — Design Spec

## Overview
A mobile-first web app that shows a map centered on the user's current location, lets them add restaurants/shops as markers on the map, and manage them via an admin list. Data is persisted in SQLite on the server.

## Tech Stack
- **Frontend**: Vanilla JS + Leaflet.js (OpenStreetMap tiles, no API key needed)
- **Backend**: Node.js + Express
- **Database**: SQLite (single table)
- **Deployment**: Tencent Cloud VPS with public IP, managed by pm2/systemd

## Architecture

```
┌─────────────────────────────────────────────┐
│                 手机浏览器                    │
│  ┌───────────────────────────────────────┐   │
│  │          Leaflet.js 地图               │   │
│  │   (OpenStreetMap 免费瓦片, 无需Key)     │   │
│  │   - 显示当前位置 (浏览器GPS定位)         │   │
│  │   - 地图标记店铺                        │   │
│  │   - 点击地图添加店铺                    │   │
│  │   - 弹出表单输入店名                    │   │
│  └───────────────────────────────────────┘   │
│  ┌───────────────────────────────────────┐   │
│  │         店铺管理列表 (Admin)            │   │
│  │   - 新增 / 删除店铺                    │   │
│  └───────────────────────────────────────┘   │
│         ↕ HTTP REST API                      │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│            Node.js + Express                 │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
│  │ GET /shops│ │POST/shops│ │DELETE/shops│  │
│  └─────────┘  └──────────┘  └────────────┘  │
│         ↕                                    │
│  ┌───────────────────────────────────────┐   │
│  │            SQLite (数据库)              │   │
│  │  shop: id, name, lat, lng, status,     │   │
│  │         created_at                     │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

- Monolithic: Express serves static HTML/JS directly
- No auth (personal tool)

## Database Schema

```sql
CREATE TABLE shops (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  status      TEXT DEFAULT 'unvisited',  -- 'visited' | 'unvisited'
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

```
GET    /api/shops              — 获取所有店铺（支持 ?status=unvisited 过滤）
POST   /api/shops              — 新增店铺 {name, lat, lng}
DELETE /api/shops/:id          — 删除店铺
PATCH  /api/shops/:id/status   — 更新状态 {status: "visited" | "unvisited"}
```

## Page Routes

```
GET  /          — 地图主页
GET  /admin     — 店铺管理列表
```

## Frontend

### Page 1: Map (default homepage)
- Browser requests GPS on load via `navigator.geolocation`
- Map centers on current position with blue location marker
- Existing shops shown as markers on the map
- **Add shop**: click "Add" button then tap map location → popup input for name → confirm → new marker appears
- **Shop marker popup**:
  ```
  ┌─────────────────────────┐
  │        店铺名称            │
  │                         │
  │  [已吃]  [详情]  [导航]    │
  └─────────────────────────┘
  ```
  - **已吃**: marks shop as visited, marker turns gray/strikethrough
  - **详情**: popup card showing name, coordinates, created_at, status
  - **导航**: opens Amap via URL Scheme `amapuri://route/plan/?slat=current&slon=current&dlat=target&dlon=target&dev=0`, fallback to browser map navigation
- Default filter: only shows "unvisited" shops
- Nearby highlight: unvisited shops within 2km of current location are enlarged + orange color, other unvisited shops are blue
- Toggle switch "显示全部" to show visited shops (gray markers)
- "列表" icon in corner → navigates to admin page

### Page 2: Admin (Shop Management)
- Card/list view of all shops, sorted by creation date descending
- Each entry: name, coordinates, mini-map thumbnail
- Actions: delete (confirmation dialog)
- "返回地图" button at top
- "手动添加" button: manual input of coordinates + name

## Deployment
- Tencent Cloud VPS with public IP
- Process manager: pm2 or systemd
- Nginx reverse proxy (optional)
