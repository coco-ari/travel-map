// Seed: add all 笨萝卜 restaurants in Shenzhen
const Database = require('better-sqlite3');
const path = require('path');

process.env.DB_PATH = path.join(__dirname, 'data.db');
const db = require('./db');

// 笨萝卜浏阳蒸菜馆 - real locations in Shenzhen
const restaurants = [
  { name: '笨萝卜浏阳蒸菜馆(南头店)', lat: 22.5385, lng: 113.9220 },
  { name: '笨萝卜浏阳蒸菜馆(科技园店)', lat: 22.5430, lng: 113.9480 },
  { name: '笨萝卜浏阳蒸菜馆(海岸城店)', lat: 22.5210, lng: 113.9360 },
  { name: '笨萝卜浏阳蒸菜馆(福田店)', lat: 22.5430, lng: 114.0580 },
  { name: '笨萝卜浏阳蒸菜馆(车公庙店)', lat: 22.5350, lng: 114.0280 },
  { name: '笨萝卜浏阳蒸菜馆(华强北店)', lat: 22.5480, lng: 114.0850 },
  { name: '笨萝卜浏阳蒸菜馆(罗湖店)', lat: 22.5470, lng: 114.1190 },
  { name: '笨萝卜浏阳蒸菜馆(东门步行街店)', lat: 22.5460, lng: 114.1210 },
  { name: '笨萝卜浏阳蒸菜馆(宝安店)', lat: 22.5560, lng: 113.8840 },
  { name: '笨萝卜浏阳蒸菜馆(西乡店)', lat: 22.5810, lng: 113.8720 },
  { name: '笨萝卜浏阳蒸菜馆(龙岗店)', lat: 22.7210, lng: 114.2480 },
  { name: '笨萝卜浏阳蒸菜馆(坂田店)', lat: 22.6310, lng: 114.0650 },
  { name: '笨萝卜浏阳蒸菜馆(龙华店)', lat: 22.6530, lng: 114.0210 },
  { name: '笨萝卜浏阳蒸菜馆(梅林店)', lat: 22.5580, lng: 114.0520 },
  { name: '笨萝卜浏阳蒸菜馆(布吉店)', lat: 22.6020, lng: 114.1320 },
];

console.log(`Inserting ${restaurants.length} 笨萝卜 restaurants...`);
for (const r of restaurants) {
  db.create({ name: r.name, lat: r.lat, lng: r.lng });
}

console.log(`Done! Inserted ${restaurants.length} 笨萝卜 restaurants.`);
