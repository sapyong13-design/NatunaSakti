const FIELDS = ['id', 'perkara_id', 'tahapan_id', 'tanggal_penetapan', 'urutan', 'jabatan_hakim_id',
  'jabatan_hakim_nama', 'hakim_id', 'hakim_nama', 'aktif', 'tanggal_tidak_aktif', 'diganti_oleh_id'];

function ensureAssignmentSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS hakim_assignment (
    id INTEGER PRIMARY KEY, perkara_id INTEGER NOT NULL, tahapan_id INTEGER,
    tanggal_penetapan TEXT, urutan INTEGER, jabatan_hakim_id INTEGER, jabatan_hakim_nama TEXT,
    hakim_id INTEGER, hakim_nama TEXT, aktif TEXT, tanggal_tidak_aktif TEXT, diganti_oleh_id INTEGER);
    CREATE INDEX IF NOT EXISTS hakim_assignment_date ON hakim_assignment(tanggal_penetapan);
    CREATE TABLE IF NOT EXISTS hakim_assignment_sync (id INTEGER PRIMARY KEY CHECK(id=1), synced_at TEXT NOT NULL);`);
}

// Called inside the full-sync transaction: never replace the cache on a partial/detail read.
function replaceAssignments(db, rows) {
  if (!Array.isArray(rows)) throw new Error('Snapshot hakim tidak valid');
  db.prepare('DELETE FROM hakim_assignment').run();
  const insert = db.prepare(`INSERT OR IGNORE INTO hakim_assignment (${FIELDS.join(',')}) VALUES (${FIELDS.map(() => '?').join(',')})`);
  const seen = new Map();
  for (const row of rows) {
    if (!Number.isSafeInteger(Number(row.id)) || Number(row.id) <= 0 || !Number.isSafeInteger(Number(row.perkara_id)) || Number(row.perkara_id) <= 0) throw new Error('Identitas assignment tidak valid');
    const values = FIELDS.map(key => row[key] ?? null);
    const encoded = JSON.stringify(values);
    const id = Number(row.id);
    if (seen.has(id)) {
      if (seen.get(id) !== encoded) throw new Error('Assignment duplikat bertentangan');
      continue;
    }
    seen.set(id, encoded);
    insert.run(...values);
  }
  db.prepare('INSERT OR REPLACE INTO hakim_assignment_sync (id,synced_at) VALUES (1,?)').run(new Date().toISOString());
}

// Verified SIPP PN semantics: member order 2/3, not guessed zero/one-based ranks.
function assignmentRole(row) {
  const name = String(row.jabatan_hakim_nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const id = Number(row.jabatan_hakim_id);
  const order = Number(row.urutan);
  if (id === 1 && name === 'hakim ketua' && order === 1) return 'ketua';
  if (id === 3 && name === 'hakim tunggal' && order === 1) return 'tunggal';
  if (id === 2 && name === 'hakim anggota' && order === 2) return 'anggota1';
  if (id === 2 && name === 'hakim anggota' && order === 3) return 'anggota2';
  return null;
}

function getJudgeLeaderboard(db, query = {}, now = new Date()) {
  const period = query.period ?? 'monthly';
  const year = query.year ?? now.getFullYear();
  const month = query.month ?? now.getMonth() + 1;
  if (!['monthly', 'yearly'].includes(period) || !/^\d{4}$/.test(String(year)) || Number(year) < 1000 || Number(year) > 9998 || !/^\d{1,2}$/.test(String(month)) || Number(month) < 1 || Number(month) > 12) throw new Error('Invalid leaderboard period');
  const y = Number(year), m = Number(month);
  const iso = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  const start = iso(y, period === 'yearly' ? 1 : m);
  const end = period === 'yearly' ? iso(y + 1, 1) : iso(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1);
  const all = db.prepare('SELECT * FROM hakim_assignment ORDER BY tanggal_penetapan,id').all();
  const rows = all.filter(row => row.tanggal_penetapan >= start && row.tanggal_penetapan < end);
  const judges = new Map(), unknown = new Map();
  let counted = 0, missingJudge = 0;
  for (const row of rows) {
    const role = assignmentRole(row);
    if (!role) {
      const key = JSON.stringify([row.jabatan_hakim_id, row.jabatan_hakim_nama, row.urutan]);
      if (!unknown.has(key)) unknown.set(key, {jabatan_hakim_id:row.jabatan_hakim_id,jabatan_hakim_nama:row.jabatan_hakim_nama,urutan:row.urutan,rows:0});
      unknown.get(key).rows++;
      continue;
    }
    if (!row.hakim_id || !String(row.hakim_nama || '').trim()) { missingJudge++; continue; }
    counted++;
    if (!judges.has(row.hakim_id)) judges.set(row.hakim_id, {hakim_id:row.hakim_id,hakim_nama:row.hakim_nama,ketua:new Set(),tunggal:new Set(),anggota1:new Set(),anggota2:new Set(),total:new Set()});
    const judge = judges.get(row.hakim_id);
    judge.hakim_nama = row.hakim_nama; // Latest appointment spelling, same stable source ID.
    judge[role].add(row.perkara_id);
    judge.total.add(row.perkara_id);
  }
  const data = [...judges.values()].map(judge => ({...judge,...Object.fromEntries(['ketua','tunggal','anggota1','anggota2','total'].map(role => [role,judge[role].size]))}));
  data.sort((a,b) => b.total-a.total || a.hakim_nama.localeCompare(b.hakim_nama,'id') || a.hakim_id-b.hakim_id);
  const syncedAt = db.prepare('SELECT synced_at FROM hakim_assignment_sync WHERE id=1').get()?.synced_at || null;
  return { data, date_basis:'tanggal_penetapan', period:{period,year:y,month:period === 'monthly' ? m : null,start,end},
    coverage:{synced_at:syncedAt,cached_rows:all.length,period_rows:rows.length,counted_rows:counted,missing_judge_rows:missingJudge,
      missing_date_rows:all.filter(r=>!r.tanggal_penetapan).length,unknown_roles:[...unknown.values()],all_pn_stages:true,includes_inactive:true} };
}

module.exports = { ensureAssignmentSchema, replaceAssignments, getJudgeLeaderboard };
