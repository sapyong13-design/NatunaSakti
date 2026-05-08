# Cache Jadwal Sidang — Design

**Tanggal:** 2026-05-07
**Konteks:** Endpoint `/api/perkara/sipp/jadwal/:nomor` selalu hit puppeteer + SIPP (~1.5–3 detik per call). Untuk perkara tahun berjalan yang sering dilihat, ini terasa lambat.

## Tujuan

Jadwal sidang perkara tahun berjalan tampil **instan** di UI (read dari DB), refresh otomatis tiap kali cron sync per-jam jalan. Perkara tahun lampau tetap pakai live scrape biar masih bisa diakses.

## Skema

Tambah tabel baru:

```sql
CREATE TABLE jadwal_sidang (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor_perkara TEXT NOT NULL,
  nomor INTEGER,                    -- urutan dari SIPP (1, 2, 3, ...)
  tanggal TEXT,                     -- "Senin, 21 Jul. 2025"
  jam TEXT,                         -- "11:00:00 s/d 12:30:00"
  agenda TEXT,
  ruangan TEXT,
  alasan_ditunda TEXT,
  fetched_at TEXT NOT NULL          -- ISO timestamp
);
CREATE INDEX idx_jadwal_nomor ON jadwal_sidang(nomor_perkara);
```

Migrasi idempoten: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`. Dijalankan di `setupDatabase()` saat server start, sama seperti kolom `sipp_*` di `perkara`.

Tidak ada FK constraint formal — `better-sqlite3` di project ini tidak mengaktifkan `foreign_keys` PRAGMA, dan relasi via `nomor_perkara` cukup untuk lookup.

## Perubahan `sippSyncService.js`

### `fetchJadwalSidangWithBrowser(page, nomorPerkara)`

Pisahkan core logic `fetchJadwalSidang` jadi varian yang menerima `page` (puppeteer Page) dari luar — bisa dipakai ulang dalam batch tanpa launch browser per-perkara. Method `fetchJadwalSidang(nomor)` lama tetap ada untuk single-call fallback (perkara non-2026), tapi internalnya delegate ke variant ini setelah launch sendiri.

### `fetchAndCacheJadwal(nomorPerkara, page)`

1. Panggil `fetchJadwalSidangWithBrowser(page, nomorPerkara)`.
2. Dalam transaction:
   - `DELETE FROM jadwal_sidang WHERE nomor_perkara = ?`
   - `INSERT INTO jadwal_sidang ...` untuk tiap entry, `fetched_at = new Date().toISOString()`.
3. Return jumlah jadwal yang di-cache.

Replace strategy (delete + insert) lebih simpel daripada upsert per-row, dan cocok karena urutan dari SIPP bisa berubah.

### `cacheJadwalCurrentYear()`

```js
async cacheJadwalCurrentYear() {
  const year = new Date().getFullYear();
  const perkara = this.db.prepare(
    'SELECT nomor_perkara FROM perkara WHERE tahun_masuk = ?'
  ).all(year);

  const browser = await puppeteer.launch({...});
  try {
    const page = await browser.newPage();
    let ok = 0, failed = 0;
    for (const p of perkara) {
      try {
        await this.fetchAndCacheJadwal(p.nomor_perkara, page);
        ok++;
      } catch (err) {
        console.error('[CACHE] failed', p.nomor_perkara, err.message);
        failed++;
      }
      await new Promise(r => setTimeout(r, 200)); // throttle SIPP
    }
    return { ok, failed };
  } finally {
    await browser.close();
  }
}
```

1 browser instance untuk seluruh batch. 200ms delay antar perkara → throttle ringan ke SIPP.

## Trigger

### 1. Setelah cron sync per-jam

Di `server.js`, di handler cron yang sudah ada:
```js
await sippService.fetchSIPPData(...);
await sippService.saveToDatabase(...);
await sippService.cacheJadwalCurrentYear(); // baru
```

### 2. Saat server start (lazy initial)

Setelah `app.listen` callback berhasil, fire-and-forget:
```js
// fire-and-forget — jangan blok startup
const cached = db.prepare('SELECT COUNT(*) AS n FROM jadwal_sidang').get().n;
if (cached === 0) {
  console.log('[CACHE] empty, populating jadwal cache for current year...');
  sippService.cacheJadwalCurrentYear()
    .then(r => console.log('[CACHE] done', r))
    .catch(e => console.error('[CACHE] error', e.message));
}
```

Server tetap responsif selama 100 detik populasi awal — endpoint untuk perkara 2026 yang belum ke-cache fallback ke live scrape sementara.

## Perubahan endpoint `/api/perkara/sipp/jadwal/:nomor`

```js
app.get('/api/perkara/sipp/jadwal/:nomor', async (req, res) => {
  const nomor = decodeURIComponent(req.params.nomor);
  const currentYear = new Date().getFullYear();

  // Cek tahun perkara
  const row = db.prepare(
    'SELECT tahun_masuk FROM perkara WHERE nomor_perkara = ?'
  ).get(nomor);

  if (row?.tahun_masuk === currentYear) {
    const cached = db.prepare(
      'SELECT nomor, tanggal, jam, agenda, ruangan, alasan_ditunda AS alasanDitunda ' +
      'FROM jadwal_sidang WHERE nomor_perkara = ? ORDER BY id'
    ).all(nomor);
    if (cached.length > 0) {
      return res.json({ nomor_perkara: nomor, jadwal: cached, cached: true });
    }
    // 2026 tapi belum ke-cache: fallback live (bisa kejadian sebelum cache awal selesai)
  }

  // Non-current-year atau cache miss → live
  const jadwal = await sippService.fetchJadwalSidang(nomor);
  res.json({ nomor_perkara: nomor, jadwal, cached: false });
});
```

Field `cached: true|false` ditambahin ke response — frontend bisa pakai untuk indikator (opsional, tidak required).

## Frontend

Tidak ada perubahan wajib. Response shape masih `{ nomor_perkara, jadwal: [...] }`. Frontend bisa diutak-atik kemudian (misal: tombol "Refresh dari SIPP" untuk paksa refetch live + update cache), tapi itu di luar scope spec ini.

## Verifikasi

1. Server restart → log `[CACHE] empty, populating...` muncul, ~100 detik kemudian `[CACHE] done {ok: 48, failed: 0}`.
2. `SELECT COUNT(*) FROM jadwal_sidang` ≈ jumlah jadwal × 48.
3. `curl /api/perkara/sipp/jadwal/<2026-case>` → `cached: true`, response < 50ms.
4. `curl /api/perkara/sipp/jadwal/<2025-case>` → `cached: false`, response ~2s, behavior sama dengan sekarang.
5. Sync manual atau cron → log `[CACHE] done` muncul lagi, baris di tabel ke-replace untuk tiap perkara.

## Out of scope

- Tombol refresh manual per-perkara di UI.
- Indikator "fetched X jam lalu" di dialog jadwal.
- Cache untuk perkara non-tahun-berjalan (tetap live).
- Background job framework (BullMQ dll) — pakai `setInterval`/cron yang sudah ada.
- Rate-limit lebih canggih dari fixed 200ms delay.
- Concurrency > 1 saat populasi (sequential cukup; SIPP scraping shared session).
