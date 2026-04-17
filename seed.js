// Standalone seed script (also used by server.js for auto-seeding)
const { seedRestaurants } = require('./seed-data');
const path = require('path');
process.env.DB_PATH = path.join(__dirname, 'data.db');
const db = require('./db');

console.log(`Inserting ${seedRestaurants.length} restaurants...`);
for (const r of seedRestaurants) {
  db.create(r);
}
console.log(`Done! Inserted ${seedRestaurants.length} restaurants.`);
