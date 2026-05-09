// Loop sync sampai selesai
const { execSync } = require('child_process');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'akurasi.db'));

const TARGET = 4557; // Target total perkara

async function main() {
  let attempts = 0;
  const maxAttempts = 50; // Max 50 attempts

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n[LOOP] Attempt ${attempts}/${maxAttempts}`);
    console.log(`[LOOP] Starting sync...`);

    try {
      execSync('node scripts/sync-direct.js', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        timeout: 300000 // 5 minutes per attempt
      });
    } catch (e) {
      console.log(`[LOOP] Sync attempt ${attempts} ended with error`);
    }

    // Check current total
    const count = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
    console.log(`[LOOP] Current total: ${count} perkara`);

    if (count >= TARGET) {
      console.log(`[LOOP] Target reached! ${count} perkara synced.`);
      break;
    }

    // Short pause before next attempt
    await new Promise(r => setTimeout(r, 3000));
  }

  const finalCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
  console.log(`\n[LOOP] Final total: ${finalCount} perkara`);
}

main().catch(console.error);
