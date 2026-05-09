// ============================================
// UPDATE SEED DATABASE
// Copy current akurasi.db to akurasi-seed.db
// Run this after first sync to create base database for new setups
// ============================================

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const sourceDb = path.join(dataDir, 'akurasi.db');
const seedDb = path.join(dataDir, 'akurasi-seed.db');

console.log('[SEED] Updating seed database...');

if (!fs.existsSync(sourceDb)) {
    console.error('[SEED] ERROR: akurasi.db not found!');
    console.error('[SEED] Run sync first: POST /api/perkara/sipp/sync');
    process.exit(1);
}

// Copy database
fs.copyFileSync(sourceDb, seedDb);

// Get file size
const stats = fs.statSync(seedDb);
const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

console.log(`[SEED] Seed database updated: ${seedDb}`);
console.log(`[SEED] Size: ${sizeMB} MB`);
console.log('[SEED] Commit this file to Git for use on other PCs!');
console.log('[SEED] On new setups, the seed will be copied automatically.');
