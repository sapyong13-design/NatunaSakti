# Cache Jadwal Sidang Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache jadwal sidang perkara tahun berjalan (2026) di SQLite biar dialog tampil instan, refresh otomatis tiap cron sync per-jam. Perkara non-tahun-berjalan tetap fallback live scrape.

**Architecture:** Tabel baru `jadwal_sidang` di SQLite. `sippSyncService` dapat helper internal `_fetchJadwalFromPage(page, nomor)` yang dipakai ulang oleh single-call `fetchJadwalSidang` dan batch `cacheJadwalCurrentYear` (1 puppeteer instance untuk seluruh batch). Endpoint pilih cache vs live berdasarkan `tahun_masuk`. Trigger: sekali saat server start kalau cache kosong, dan tiap selesai cron sync.

**Tech Stack:** Node.js, Express 4, better-sqlite3, puppeteer (sudah ada di deps).

**Catatan TDD:** Project ini tidak punya test framework. Tiap task pakai *verification script* (`curl`, `node -e`, query sqlite langsung) sebagai pengganti unit test. Engineer wajib jalanin dan cek output matches expected sebelum commit.

**Sebelum mulai:** pastikan server backend di port 3000 lagi mati (atau siap di-restart antar task). Tiap task yang ngubah file akan butuh restart server untuk verifikasi. Kalau server lagi running, kill dulu:
```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

---

### Task 1: Tambah skema tabel `jadwal_sidang`

**Files:**
- Modify: `backend/server.js` (function `setupDatabase`, sekitar line 39-104)

- [ ] **Step 1: Tambah blok skema di akhir `setupDatabase`**

Edit `backend/server.js`. Tepat sebelum penutup `}` dari function `setupDatabase()` (sekarang ada di sekitar line 103-104), sisipkan:

```javascript
    // jadwal_sidang cache (per design: 2026-05-07-jadwal-sidang-cache-design.md)
    db.exec(`
        CREATE TABLE IF NOT EXISTS jadwal_sidang (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nomor_perkara TEXT NOT NULL,
            nomor INTEGER,
            tanggal TEXT,
            jam TEXT,
            agenda TEXT,
            ruangan TEXT,
            alasan_ditunda TEXT,
            fetched_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_jadwal_nomor ON jadwal_sidang(nomor_perkara);
    `);
```

- [ ] **Step 2: Restart server**

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node server.js > server.log 2>&1 &
```

- [ ] **Step 3: Verifikasi tabel + index dibuat**

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node -e "const db=require('better-sqlite3')('data/akurasi.db'); console.log('table:', db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='jadwal_sidang'\").get()); console.log('cols:', db.prepare(\"PRAGMA table_info(jadwal_sidang)\").all().map(c=>c.name)); console.log('idx:', db.prepare(\"SELECT name FROM sqlite_master WHERE type='index' AND name='idx_jadwal_nomor'\").get());"
```

Expected:
```
table: { name: 'jadwal_sidang' }
cols: [ 'id', 'nomor_perkara', 'nomor', 'tanggal', 'jam', 'agenda', 'ruangan', 'alasan_ditunda', 'fetched_at' ]
idx: { name: 'idx_jadwal_nomor' }
```

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add backend/server.js && git commit -m "schema: add jadwal_sidang cache table"
```

---

### Task 2: Refactor `fetchJadwalSidang` jadi pakai helper `_fetchJadwalFromPage`

**Tujuan:** pisahkan core scrape logic dari browser launch supaya bisa di-reuse oleh batch caching tanpa launch puppeteer per perkara.

**Files:**
- Modify: `backend/services/sippSyncService.js` (method `fetchJadwalSidang`)

- [ ] **Step 1: Pecah `fetchJadwalSidang` jadi 2 method**

Buka `backend/services/sippSyncService.js`. Cari method `fetchJadwalSidang(nomorPerkara)` (sekitar line 192). Replace seluruh method tsb dengan:

```javascript
  /**
   * Fetch jadwal sidang untuk satu perkara (single-call: launch browser sendiri).
   */
  async fetchJadwalSidang(nomorPerkara) {
    console.log('[SIPP] Fetching jadwal for:', nomorPerkara);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      return await this._fetchJadwalFromPage(page, nomorPerkara);
    } catch (error) {
      console.error('[SIPP] Error fetching jadwal:', error.message);
      return [];
    } finally {
      await browser.close();
    }
  }

  /**
   * Core scrape logic — terima Page yang sudah ready. Dipanggil oleh
   * fetchJadwalSidang (single) dan cacheJadwalCurrentYear (batch).
   *
   * Flow:
   *   1. Submit SIPP search form for the nomor perkara
   *   2. Grab the `show_detil` URL from the matching row
   *   3. Open detail page, click the Jadwal Sidang tab (#tabs4)
   *   4. Wait for the AJAX-loaded table inside #tabs4 and scrape it
   */
  async _fetchJadwalFromPage(page, nomorPerkara) {
    // 1. Open SIPP and submit the search form
    await page.goto(this.sippUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#search-box', { timeout: 10000 });
    await page.click('#search-box');
    // Clear input first (in case batch reuses page after a previous search)
    await page.$eval('#search-box', (el) => { el.value = ''; });
    await page.type('#search-box', nomorPerkara, { delay: 25 });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      page.evaluate(() => {
        const form = document.querySelector('form[action*="search"]');
        if (form) form.submit();
      })
    ]);

    // 2. Find the detail URL for the matching row
    const detilUrl = await page.evaluate((nomor) => {
      const rows = document.querySelectorAll('table tr');
      for (const row of rows) {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 2 && cols[1].textContent.trim() === nomor) {
          const a = row.querySelector('a[href*="show_detil"]');
          return a ? a.href : null;
        }
      }
      return null;
    }, nomorPerkara);

    if (!detilUrl) {
      console.log('[SIPP] Perkara not found in search results:', nomorPerkara);
      return [];
    }

    // 3. Open detail page and click the Jadwal Sidang tab
    await page.goto(detilUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('a[href*="#tabs4"]', { timeout: 10000 });
    await page.evaluate(() => {
      const tab = document.querySelector('a[href*="#tabs4"]');
      if (tab) tab.click();
    });

    // 4. Wait for AJAX content inside #tabs4, then scrape
    await page.waitForFunction(
      () => {
        const t = document.getElementById('tabs4');
        return t && t.querySelector('table tr td');
      },
      { timeout: 15000 }
    ).catch(() => null);

    const jadwal = await page.evaluate(() => {
      const t = document.getElementById('tabs4');
      if (!t) return [];
      const out = [];
      t.querySelectorAll('table tr').forEach((row, i) => {
        if (i === 0) return; // header
        const cols = row.querySelectorAll('td');
        if (cols.length < 5) return;
        out.push({
          nomor: cols[0]?.textContent?.trim() || '',
          tanggal: cols[1]?.textContent?.trim() || '',
          jam: cols[2]?.textContent?.trim() || '',
          agenda: cols[3]?.textContent?.trim() || '',
          ruangan: cols[4]?.textContent?.trim().replace(/\s+/g, ' ') || '',
          alasanDitunda: cols[5]?.textContent?.trim() || ''
        });
      });
      return out;
    });

    console.log('[SIPP] Found', jadwal.length, 'sidang schedules for', nomorPerkara);
    return jadwal;
  }
```

- [ ] **Step 2: Restart server**

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node server.js > server.log 2>&1 &
```

- [ ] **Step 3: Verifikasi: regression test endpoint masih bekerja**

```bash
sleep 3 && curl -s "http://localhost:3000/api/perkara/sipp/jadwal/22%2FPid.B%2F2026%2FPN%20Ntn" --max-time 30 | head -c 200
echo ""
```

Expected: response JSON dengan `"jadwal":[{...}]` berisi minimal 1 entry. Endpoint behavior nggak boleh berubah dari sebelum task ini.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add backend/services/sippSyncService.js && git commit -m "refactor(sipp): extract _fetchJadwalFromPage for browser reuse"
```

---

### Task 3: Tambah method `fetchAndCacheJadwal`

**Files:**
- Modify: `backend/services/sippSyncService.js` (tambah method baru setelah `_fetchJadwalFromPage`)

- [ ] **Step 1: Tambah method `fetchAndCacheJadwal`**

Setelah method `_fetchJadwalFromPage` (sekitar line akhir di task 2), sisipkan method baru:

```javascript
  /**
   * Fetch jadwal sidang dan persist ke tabel jadwal_sidang.
   * Strategi: DELETE existing + INSERT new dalam satu transaction.
   *
   * @param {string} nomorPerkara
   * @param {import('puppeteer').Page} page - reused page instance
   * @returns {Promise<number>} jumlah jadwal yang ke-cache
   */
  async fetchAndCacheJadwal(nomorPerkara, page) {
    const jadwal = await this._fetchJadwalFromPage(page, nomorPerkara);
    const fetchedAt = new Date().toISOString();

    const del = this.db.prepare('DELETE FROM jadwal_sidang WHERE nomor_perkara = ?');
    const ins = this.db.prepare(`
      INSERT INTO jadwal_sidang
      (nomor_perkara, nomor, tanggal, jam, agenda, ruangan, alasan_ditunda, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((entries) => {
      del.run(nomorPerkara);
      for (const e of entries) {
        ins.run(
          nomorPerkara,
          parseInt(e.nomor) || null,
          e.tanggal || null,
          e.jam || null,
          e.agenda || null,
          e.ruangan || null,
          e.alasanDitunda || null,
          fetchedAt
        );
      }
    });

    tx(jadwal);
    return jadwal.length;
  }
```

- [ ] **Step 2: Restart server**

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node server.js > server.log 2>&1 &
```

- [ ] **Step 3: Verifikasi: panggil method langsung, cek baris ke-insert**

```bash
sleep 2 && cd "C:\Users\faris\Documents\natunasakti\backend" && node -e "
(async () => {
  const Database = require('better-sqlite3');
  const SIPP = require('./services/sippSyncService');
  const puppeteer = require('puppeteer');
  const db = new Database('data/akurasi.db');
  const svc = new SIPP(db);
  const browser = await puppeteer.launch({headless: 'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const n = await svc.fetchAndCacheJadwal('22/Pid.B/2026/PN Ntn', page);
  console.log('cached', n, 'rows');
  const rows = db.prepare('SELECT nomor, tanggal, jam, agenda FROM jadwal_sidang WHERE nomor_perkara = ?').all('22/Pid.B/2026/PN Ntn');
  console.log('db rows:', rows.length);
  console.log('first:', rows[0]);
  await browser.close();
})();
"
```

Expected:
- `cached N rows` dengan N >= 1
- `db rows: N` (sama angka)
- `first: { nomor: 1, tanggal: 'Rabu, ...', jam: '...', agenda: '...' }`

Hati-hati: ini akan tabrakan kalau server lagi pakai DB. SQLite single-writer — tapi karena script ini cepat, harusnya OK. Kalau ke-lock, kill server dulu.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add backend/services/sippSyncService.js && git commit -m "feat(sipp): fetchAndCacheJadwal persists schedule to jadwal_sidang"
```

---

### Task 4: Tambah method `cacheJadwalCurrentYear`

**Files:**
- Modify: `backend/services/sippSyncService.js` (tambah method setelah `fetchAndCacheJadwal`)

- [ ] **Step 1: Tambah method**

```javascript
  /**
   * Cache jadwal sidang untuk semua perkara tahun berjalan.
   * 1 browser instance dipakai ulang untuk seluruh batch.
   *
   * @returns {Promise<{ok: number, failed: number, total: number}>}
   */
  async cacheJadwalCurrentYear() {
    const year = new Date().getFullYear();
    const perkara = this.db.prepare(
      'SELECT nomor_perkara FROM perkara WHERE tahun_masuk = ?'
    ).all(year);

    console.log(`[CACHE] Caching jadwal for ${perkara.length} perkara tahun ${year}`);

    if (perkara.length === 0) {
      return { ok: 0, failed: 0, total: 0 };
    }

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    let ok = 0;
    let failed = 0;
    try {
      const page = await browser.newPage();
      for (const p of perkara) {
        try {
          const n = await this.fetchAndCacheJadwal(p.nomor_perkara, page);
          ok++;
          console.log(`[CACHE] ${ok + failed}/${perkara.length}: ${p.nomor_perkara} -> ${n} jadwal`);
        } catch (err) {
          failed++;
          console.error(`[CACHE] failed ${p.nomor_perkara}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 200)); // throttle SIPP
      }
    } finally {
      await browser.close();
    }

    console.log(`[CACHE] done: ok=${ok}, failed=${failed}, total=${perkara.length}`);
    return { ok, failed, total: perkara.length };
  }
```

- [ ] **Step 2: Verifikasi: jalankan batch, cek jumlah cache**

Pastikan server di-stop dulu (script bakal pakai DB ekslusif & launch puppeteer panjang ~100 detik):

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node -e "
(async () => {
  const Database = require('better-sqlite3');
  const SIPP = require('./services/sippSyncService');
  const db = new Database('data/akurasi.db');
  const svc = new SIPP(db);
  console.time('cache');
  const r = await svc.cacheJadwalCurrentYear();
  console.timeEnd('cache');
  console.log('result:', r);
  const total = db.prepare('SELECT COUNT(*) as n FROM jadwal_sidang').get().n;
  const distinct = db.prepare('SELECT COUNT(DISTINCT nomor_perkara) as n FROM jadwal_sidang').get().n;
  console.log('total rows:', total, '| distinct perkara:', distinct);
})();
"
```

Expected (durasi ~80-150 detik untuk 48 perkara):
- `result: { ok: 48, failed: 0, total: 48 }` (atau ok ≈ 48; sedikit failed kalau ada perkara yang nggak ke-deteksi)
- `total rows: <ratusan>` (depends on rata-rata jadwal per perkara)
- `distinct perkara: 48`

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add backend/services/sippSyncService.js && git commit -m "feat(sipp): cacheJadwalCurrentYear batches jadwal fetch with shared browser"
```

---

### Task 5: Endpoint baca cache untuk perkara tahun berjalan

**Files:**
- Modify: `backend/server.js` (handler `app.get('/api/perkara/sipp/jadwal/:nomor', ...)`, sekitar line 341-356)

- [ ] **Step 1: Replace handler**

Cari handler yang sekarang:

```javascript
// Get jadwal sidang for a perkara
app.get('/api/perkara/sipp/jadwal/:nomor', async (req, res) => {
    console.log('[SIPP-JADWAL] Called for:', req.params.nomor);
    try {
        const nomorPerkara = decodeURIComponent(req.params.nomor);
        const jadwal = await sippService.fetchJadwalSidang(nomorPerkara);
        res.json({
            nomor_perkara: nomorPerkara,
            jadwal
        });
    } catch (error) {
        console.error('[SIPP] Jadwal error:', error.message);
        res.status(500).json({
            error: error.message
        });
    }
});
```

Replace seluruh handler tsb dengan:

```javascript
// Get jadwal sidang for a perkara
app.get('/api/perkara/sipp/jadwal/:nomor', async (req, res) => {
    console.log('[SIPP-JADWAL] Called for:', req.params.nomor);
    try {
        const nomorPerkara = decodeURIComponent(req.params.nomor);
        const currentYear = new Date().getFullYear();

        // Cek tahun perkara
        const row = db.prepare(
            'SELECT tahun_masuk FROM perkara WHERE nomor_perkara = ?'
        ).get(nomorPerkara);

        if (row?.tahun_masuk === currentYear) {
            // Cache hit path: baca dari DB, instant
            const cached = db.prepare(`
                SELECT nomor, tanggal, jam, agenda, ruangan,
                       alasan_ditunda AS alasanDitunda
                FROM jadwal_sidang
                WHERE nomor_perkara = ?
                ORDER BY id
            `).all(nomorPerkara);

            if (cached.length > 0) {
                return res.json({
                    nomor_perkara: nomorPerkara,
                    jadwal: cached,
                    cached: true
                });
            }
            // 2026 tapi cache miss (mungkin populasi awal belum selesai) → fall through ke live
        }

        // Non-current-year atau cache miss → live scrape
        const jadwal = await sippService.fetchJadwalSidang(nomorPerkara);
        res.json({
            nomor_perkara: nomorPerkara,
            jadwal,
            cached: false
        });
    } catch (error) {
        console.error('[SIPP] Jadwal error:', error.message);
        res.status(500).json({
            error: error.message
        });
    }
});
```

- [ ] **Step 2: Restart server**

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node server.js > server.log 2>&1 &
```

- [ ] **Step 3: Verifikasi cache hit untuk 2026 (instant)**

```bash
sleep 2 && curl -s -w "\ntime=%{time_total}s\n" "http://localhost:3000/api/perkara/sipp/jadwal/22%2FPid.B%2F2026%2FPN%20Ntn" --max-time 5 | head -c 300
echo ""
```

Expected:
- Response JSON contains `"cached":true`
- `time=0.0XXs` (di bawah 100ms — baca dari DB lokal)

- [ ] **Step 4: Verifikasi cache miss untuk 2025 (fallback live)**

```bash
curl -s -w "\ntime=%{time_total}s\n" "http://localhost:3000/api/perkara/sipp/jadwal/4%2FPid.Sus-PRK%2F2025%2FPN%20Ntn" --max-time 30 | head -c 300
echo ""
```

Expected:
- Response JSON contains `"cached":false`
- `time=1-3s` (puppeteer scrape live)
- `jadwal` array berisi data jadwal sidang seperti sebelumnya

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add backend/server.js && git commit -m "feat(sipp): jadwal endpoint reads cache for current-year perkara"
```

---

### Task 6: Trigger initial cache saat server start kalau cache kosong

**Files:**
- Modify: `backend/server.js` (di dalam callback `app.listen`, sekitar line 472-475)

- [ ] **Step 1: Tambah trigger di callback `app.listen`**

Cari callback `app.listen` yang sekarang:

```javascript
// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database: ${dbPath}`);
});
```

Replace dengan:

```javascript
// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database: ${dbPath}`);

    // Initial populate jadwal cache kalau kosong (fire-and-forget, jangan blok startup)
    const cachedCount = db.prepare('SELECT COUNT(*) AS n FROM jadwal_sidang').get().n;
    if (cachedCount === 0) {
        console.log('[CACHE] empty on startup, populating jadwal cache for current year...');
        sippService.cacheJadwalCurrentYear()
            .then(r => console.log('[CACHE] startup populate done:', r))
            .catch(e => console.error('[CACHE] startup populate error:', e.message));
    } else {
        console.log(`[CACHE] ${cachedCount} jadwal rows already cached, skipping initial populate`);
    }
});
```

- [ ] **Step 2: Verifikasi (cache sudah ada path — skip populate)**

Karena Task 4 sudah populate, restart server harusnya log "skipping initial populate":

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node server.js > server.log 2>&1 &
sleep 3 && grep -E "\[CACHE\]" server.log
```

Expected: line `[CACHE] N jadwal rows already cached, skipping initial populate` di mana N > 0.

- [ ] **Step 3: Verifikasi (cache kosong path — populate jalan)**

Backup cache dulu, kosongkan tabel, restart server, cek populate jalan:

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node -e "
const db = require('better-sqlite3')('data/akurasi.db');
const before = db.prepare('SELECT COUNT(*) as n FROM jadwal_sidang').get().n;
console.log('before:', before);
db.prepare('DELETE FROM jadwal_sidang').run();
const after = db.prepare('SELECT COUNT(*) as n FROM jadwal_sidang').get().n;
console.log('after delete:', after);
"
```

Expected: `before: <N>` (some number), `after delete: 0`.

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node server.js > server.log 2>&1 &
sleep 5 && grep -E "\[CACHE\]" server.log
```

Expected: line `[CACHE] empty on startup, populating jadwal cache for current year...` segera muncul.

Tunggu populate selesai (~80-150 detik). Cek log lagi:

```bash
sleep 150 && grep -E "\[CACHE\]" "C:\Users\faris\Documents\natunasakti\backend\server.log"
```

Expected: line `[CACHE] startup populate done: { ok: 48, failed: 0, total: 48 }` (atau angka serupa).

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add backend/server.js && git commit -m "feat(sipp): populate jadwal cache on server start when empty"
```

---

### Task 7: Trigger refresh setelah cron sync per-jam

**Files:**
- Modify: `backend/server.js` (handler cron, sekitar line 454-465)

- [ ] **Step 1: Tambah cache call di akhir cron handler**

Cari handler cron yang sekarang:

```javascript
const syncTask = cron.schedule('0 * * * *', async () => {
    try {
        console.log('[CRON] Starting scheduled SIPP sync...');
        const data = await sippService.fetchSIPPData();
        const count = await sippService.saveToDatabase(data);
        console.log(`[CRON] Sync completed: ${count} perkara updated`);
    } catch (error) {
        console.error('[CRON] Sync error:', error.message);
    }
}, {
    scheduled: false // Don't start immediately
});
```

Replace dengan:

```javascript
const syncTask = cron.schedule('0 * * * *', async () => {
    try {
        console.log('[CRON] Starting scheduled SIPP sync...');
        const data = await sippService.fetchSIPPData();
        const count = await sippService.saveToDatabase(data);
        console.log(`[CRON] Sync completed: ${count} perkara updated`);

        // Refresh jadwal cache untuk perkara tahun berjalan
        console.log('[CRON] Refreshing jadwal cache...');
        const cacheResult = await sippService.cacheJadwalCurrentYear();
        console.log('[CRON] Jadwal cache refreshed:', cacheResult);
    } catch (error) {
        console.error('[CRON] Sync error:', error.message);
    }
}, {
    scheduled: false // Don't start immediately
});
```

- [ ] **Step 2: Verifikasi (manual trigger handler tanpa nunggu jam)**

Restart server, lalu invoke handler manually via REPL biar nggak nunggu cron 1 jam:

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node -e "
(async () => {
  const Database = require('better-sqlite3');
  const SIPP = require('./services/sippSyncService');
  const db = new Database('data/akurasi.db');
  const svc = new SIPP(db);
  console.log('Manually invoking cron-equivalent...');
  const data = await svc.fetchSIPPData();
  const count = await svc.saveToDatabase(data);
  console.log('synced', count, 'perkara');
  const r = await svc.cacheJadwalCurrentYear();
  console.log('cache result:', r);
})();
" 2>&1 | tail -10
```

Expected output (durasi total ~3-4 menit):
- `synced N perkara` (where N matches DB count)
- `cache result: { ok: 48, failed: 0, total: 48 }` (atau serupa)

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add backend/server.js && git commit -m "feat(sipp): refresh jadwal cache after each cron sync"
```

---

### Task 8: Final verification end-to-end + commit spec & plan

- [ ] **Step 1: Restart server, kosongkan cache, biarkan startup populate**

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node -e "require('better-sqlite3')('data/akurasi.db').prepare('DELETE FROM jadwal_sidang').run(); console.log('cache cleared');"
cd "C:\Users\faris\Documents\natunasakti\backend" && node server.js > server.log 2>&1 &
```

- [ ] **Step 2: Kunjungi UI sambil populate jalan**

Buka http://localhost:5173, klik baris perkara 2026 → harus tetap tampil isi (akan fallback live selama populate jalan, ~2 detik).

Tunggu populate selesai:
```bash
sleep 150 && grep "startup populate done" "C:\Users\faris\Documents\natunasakti\backend\server.log"
```

- [ ] **Step 3: Klik baris yang sama → harus instant**

Di browser, klik baris perkara 2026 lagi. Network tab DevTools harus nunjukin response < 100ms dengan `cached: true`.

- [ ] **Step 4: Klik baris perkara 2025 → fallback live (~2s)**

Di browser, klik perkara 2025 (PRK). Response time ~2s, `cached: false`. Jadwal masih tampil dengan benar.

- [ ] **Step 5: Commit spec dan plan**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add docs/superpowers/specs/2026-05-07-jadwal-sidang-cache-design.md docs/superpowers/plans/2026-05-07-jadwal-sidang-cache.md && git commit -m "docs: add spec and plan for jadwal sidang cache"
```

- [ ] **Step 6: Push semua commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git push origin master
```
