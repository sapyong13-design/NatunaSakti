// One-shot: re-classify rows whose nomor_perkara contains PRK
// (e.g. "Pid.Sus-PRK") from 'Pidana' to 'Perikanan'.
// Safe to re-run — UPDATE skips rows already classified as 'Perikanan'.

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data', 'akurasi.db');
const db = new Database(dbPath);

const before = db.prepare(
  'SELECT jenis_perkara, COUNT(*) AS n FROM perkara GROUP BY jenis_perkara'
).all();
console.log('[before]', before);

const targets = db.prepare(
  "SELECT nomor_perkara, jenis_perkara FROM perkara " +
  "WHERE UPPER(nomor_perkara) LIKE '%PRK%' AND jenis_perkara != 'Perikanan'"
).all();
console.log(`[targets] ${targets.length} row(s) to update`);
targets.forEach(r => console.log('  -', r.nomor_perkara, '|', r.jenis_perkara));

const result = db.prepare(
  "UPDATE perkara SET jenis_perkara = 'Perikanan' " +
  "WHERE UPPER(nomor_perkara) LIKE '%PRK%' AND jenis_perkara != 'Perikanan'"
).run();
console.log(`[update] changes=${result.changes}`);

const after = db.prepare(
  'SELECT jenis_perkara, COUNT(*) AS n FROM perkara GROUP BY jenis_perkara'
).all();
console.log('[after]', after);

db.close();
