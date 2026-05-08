# Redesign Fase 3 — DataView Redesign

**Tanggal:** 2026-05-08
**Konteks:** Fase 3 dari rebuild frontend. Fase 1 menyiapkan stylesheet + theme + primitif. Fase 2 menyiapkan shell layout. Fase 3 me-rebuild halaman `/data` (DataView) dengan layout dan komponen sesuai design "Gov Modern" — stats strip, big chart, mini cards, toolbar, tabel scrollable, dan slide-in DetailPanel — lengkap di-wired ke API beneran.

## Tujuan

Setelah fase ini:
- `/data` menampilkan dashboard lengkap: hero (PageHeader + StatsStrip), trend chart 8 minggu (real data), 2 mini stat card (real), toolbar filter, tabel perkara scrollable, slide-in DetailPanel saat row diklik
- Element Plus components dihapus dari DataView (dialog, table, input, select, button, dll)
- Sync flow inline di SyncCluster (no modal); progress via SSE
- Detail panel tampilkan info perkara + jadwal sidang dengan tombol Delete + Refresh Jadwal
- Halaman lain (Bulanan, Mingguan) tidak diubah — masih Element Plus, dirombak Fase 4

## Backend Changes

Dua endpoint baru di `backend/server.js`:

### 1. `GET /api/perkara/trend?weeks=N`

Return aggregate registrasi per minggu × jenis_perkara untuk N minggu terakhir.

**Response:**
```json
[
  { "week": "W1", "pidana": 4, "perdata": 2 },
  { "week": "W2", "pidana": 6, "perdata": 3 },
  ...
]
```

**Implementasi:**
- Default `weeks=8`. Validate range [1, 52].
- Query: `SELECT jenis_perkara, sipp_tanggal_register FROM perkara WHERE sipp_tanggal_register IS NOT NULL AND sipp_tanggal_register != ''`
- Parse `sipp_tanggal_register` (format `"07 Mei 2026"`) di JS:
  - Map bulan Indo → index (`Jan=0, Feb=1, Mar=2, Apr=3, Mei=4, Jun=5, Jul=6, Agu=7, Sep=8, Okt=9, Nov=10, Des=11`)
  - Construct `Date(year, monthIdx, day)`
  - Skip rows yang gagal parse
- Hitung week index dari tanggal register relatif ke `now`. `weekIdx = floor((now - dateReg) / (7 days))`. Hanya keep yang `0 <= weekIdx < weeks`.
- Group by `weekIdx`, hitung pidana/perdata. Untuk row dengan jenis `Perikanan` atau `Lainnya`, masuk ke kategori counter terpisah tapi tidak di-return (atau bisa add `lainnya` field — diputuskan: cuma pidana + perdata, sisanya skip).
- Return array N entries, urut dari paling lama ke terbaru. Label `week: "W1"` (terlama) sampai `week: "W{N}"` (terbaru). Kalau minggu tidak punya data, isi 0.

### 2. `POST /api/perkara/sipp/jadwal/:nomor/refresh`

Force live re-fetch + update cache untuk satu perkara. Bypass cache.

**Response:**
```json
{
  "nomor_perkara": "...",
  "jadwal": [...],
  "cached": true,
  "refreshed": true
}
```

**Implementasi:**
- Decode `nomor` dari param
- Call `await sippService.fetchAndCacheJadwal(nomor, page)` — perlu launch puppeteer one-shot. Untuk simplicity, panggil `sippService.fetchJadwalSidang(nomor)` yang launch browser sendiri kemudian persist via `fetchAndCacheJadwal` — atau buat helper di service.
- Decision: tambah method `async fetchAndCacheJadwalSingleCall(nomor)` di sippSyncService yang launch browser, panggil `_fetchJadwalFromPage`, persist ke DB, return jadwal array. Endpoint return data.
- Error handling: catch + return 500 dengan message.

## Frontend `lib/api.js` Additions

Tambah 2 function di `frontend/src/lib/api.js`:

```js
// Get trend data for last N weeks
export const getPerkaraTrend = async (weeks = 8) => {
    const response = await fetch(`${API_BASE}/perkara/trend?weeks=${weeks}`)
    if (!response.ok) throw new Error('Failed to fetch trend')
    return response.json()
}

// Force refresh jadwal sidang for a perkara
export const refreshJadwal = async (nomorPerkara) => {
    const encoded = encodeURIComponent(nomorPerkara)
    const response = await fetch(`${API_BASE}/perkara/sipp/jadwal/${encoded}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error('Failed to refresh jadwal')
    return response.json()
}
```

Existing function `getJadwalSidang`, `getPerkara`, `deletePerkara`, `getSippStatus`, `syncSippData`, `subscribeSyncProgress` tetap.

## Frontend Components — `frontend/src/components/dashboard/`

Folder baru. 7 komponen.

### `StatsStrip.vue`

Strip horizontal di hero area. Reuses CSS classes `.ns-c-page-stats-strip`, `.ns-c-strip-item`, `.ns-c-strip-divider`, `.ns-c-strip-label`, `.ns-c-strip-value`.

```vue
<script setup>
defineProps({ stats: { type: Object, required: true } })
// stats shape: { total: N, pidana: N, perdata: N, aktif: N }
</script>

<template>
    <div class="ns-c-page-stats-strip">
        <div class="ns-c-strip-item"><span class="ns-c-strip-label">Total</span><span class="ns-c-strip-value">{{ stats.total }}</span></div>
        <span class="ns-c-strip-divider" />
        <div class="ns-c-strip-item"><span class="ns-c-strip-label">Pidana</span><span class="ns-c-strip-value">{{ stats.pidana }}</span></div>
        <span class="ns-c-strip-divider" />
        <div class="ns-c-strip-item"><span class="ns-c-strip-label">Perdata</span><span class="ns-c-strip-value">{{ stats.perdata }}</span></div>
        <span class="ns-c-strip-divider" />
        <div class="ns-c-strip-item"><span class="ns-c-strip-label">Aktif</span><span class="ns-c-strip-value">{{ stats.aktif }}</span></div>
    </div>
</template>
```

### `TrendCard.vue`

Big chart card dengan StackedBars + delta indicator. CSS: `.ns-c-big-card`, `.ns-stat-row`, `.ns-stat-label`, `.ns-stat-delta`, `.ns-c-bigchart`, `.ns-c-bigchart-legend`, `.ns-legend-dot`.

Props: `data` (array dari `getPerkaraTrend()`), `delta` (computed string seperti `+18.2%`).

Renders: title "Trend Pendaftaran 8 Minggu", sub "Pidana vs Perdata", delta pill, StackedBars dengan `colorA="#ef4444"` (Pidana red) dan `colorB="#10b981"` (Perdata green), legend di bawah.

Delta computation: bandingkan total minggu terakhir vs minggu pertama, `((last - first) / first) * 100`. Kalau first=0, tampil "—".

### `MiniStatCard.vue`

Generic kartu kecil untuk metric. Reusable.

Props:
- `label: String`
- `value: Number | String`
- `unit: String` (default `''`)
- `deltaText: String` (e.g., `'-3 hari'`)
- `deltaTrend: 'up' | 'down' | 'flat'` (default `'flat'`)
- `deltaIcon: String` (icon name, e.g., `'trendDown'`)

CSS: `.ns-c-mini-card`, `.ns-c-mini-value`, `.ns-c-mini-unit`, `.ns-stat-delta`, `.is-up`, `.is-down`.

### `ToolbarFilters.vue`

Search input + 2 chip selectors. CSS: `.ns-toolbar`, `.ns-filter-chip`, `.ns-chip-btn`, `.ns-chip-label`, `.ns-chip-value`, `.ns-chip-menu`, `.ns-chip-option`.

Props (all v-model):
- `search: String` (`update:search` event)
- `jenis: String` (`update:jenis`)
- `tahun: String` (`update:tahun`)
- `jenisOptions: String[]` (e.g., `['Semua', 'Pidana', 'Perdata', 'Perikanan']`)
- `tahunOptions: String[]` (e.g., `['2026', '2025', '2024']`)

Render: search input dengan ikon search, chip Jenis (klik open menu), chip Tahun (klik open menu).

Chip menu: simple dropdown yang muncul saat chip diklik. Pakai click-outside listener untuk close. Implementasi: `useState(open)` di chip, listen event `click` di document untuk close.

### `SyncCluster.vue`

Tombol sync + inline progress + count info. CSS: `.ns-btn`, `.ns-btn-primary`, `.ns-live`, `.ns-live-pulse`, `.ns-live-time`.

Props:
- `count: Number` — perkara yang lagi tampil (filtered)
- `total: Number` — total perkara

Internal state:
- `syncing: Boolean`
- `progress: { current, total, message }`
- `lastSync: String` (timestamp formatted)
- `eventSource: EventSource | null`

Behavior:
- Default state: tombol "Sync SIPP" + label `{count}/{total} perkara · last sync {lastSync}`
- Klik sync → `POST /api/perkara/sipp/sync` (existing) + `subscribeSyncProgress(handler)`
- Selama syncing: tombol disabled, progress bar inline + message
- Selesai: emit `synced` (parent re-fetch), set `lastSync` ke `new Date().toLocaleTimeString()`, close EventSource

On mount: `getSippStatus()` → set `lastSync` from `sipp_last_sync` field.

### `PerkaraTable.vue`

Custom table replacing el-table. CSS: `.ns-table-card`, plus custom row styling. Karena design-tokens.css mungkin tidak punya class table lengkap, fallback ke styling minimal di scoped style.

Props:
- `rows: Array` — array of perkara objects

Emits:
- `rowClick(row)` saat row diklik

Kolom (urutan):
1. No (index)
2. Jenis (tag dengan warna: Pidana=red, Perdata=green, Perikanan=blue, Lainnya=gray)
3. Nomor Perkara (mono font — class `.ns-mono`)
4. Para Pihak (truncate dengan tooltip CSS)
5. Tanggal Register (`sipp_tanggal_register`)
6. Status (`sipp_status` — text)
7. Lama Proses (`sipp_lama_proses`)

Row hover effect via CSS, click → emit. Empty state kalau `rows.length === 0`: "Tidak ada perkara".

Tabel scrollable: parent container fixed height, body scroll. Header sticky.

### `DetailPanel.vue`

Slide-in panel dari kanan saat row dipilih. CSS extensive: `.ns-detail-backdrop`, `.ns-detail-panel`, `.ns-detail-head`, `.ns-detail-eyebrow`, `.ns-detail-title`, `.ns-detail-no-label`, `.ns-detail-pihak`, `.ns-detail-actions`, `.ns-detail-body`, `.ns-detail-status-card`, `.ns-detail-status-pulse`, `.ns-detail-status-sub`, `.ns-detail-agenda`, `.ns-detail-grid`, `.ns-detail-section`, `.ns-detail-section-title`, `.ns-detail-field`, `.ns-detail-field-label`, `.ns-detail-field-value`.

Props:
- `row: Object | null` (perkara object dari list)
- `open: Boolean`

Emits:
- `close`
- `deleted(nomorPerkara)` — parent menghapus row dari list

Internal state:
- `jadwal: Array` — jadwal sidang
- `loadingJadwal: Boolean`
- `refreshing: Boolean`

Lifecycle:
- `watch(() => props.row, async (row) => { if (row) await loadJadwal(row.nomor_perkara) })`

Methods:
- `async loadJadwal(nomor)` → `getJadwalSidang(nomor)`, set jadwal
- `async handleRefreshJadwal()` → `refreshJadwal(row.nomor_perkara)`, update jadwal
- `async handleDelete()` → confirm via `window.confirm`, `deletePerkara(row.id)`, emit `deleted`

Render structure:
```vue
<div v-if="open" class="ns-detail-backdrop" @click="$emit('close')" />
<aside v-if="open" class="ns-detail-panel">
    <header class="ns-detail-head">
        <div>
            <div class="ns-detail-eyebrow">{{ row.jenis_perkara }}</div>
            <h2 class="ns-detail-title">{{ row.nomor_perkara }}</h2>
            <div class="ns-detail-pihak">{{ row.para_pihak }}</div>
        </div>
        <button class="ns-icon-btn" @click="$emit('close')">
            <Icon name="close" :size="18" />
        </button>
    </header>
    <div class="ns-detail-body">
        <!-- Status card -->
        <div class="ns-detail-status-card">
            <span class="ns-detail-status-pulse" />
            <div>
                <div>{{ row.sipp_status || 'Status tidak diketahui' }}</div>
                <div class="ns-detail-status-sub">Lama proses: {{ row.sipp_lama_proses || '—' }}</div>
            </div>
        </div>

        <!-- Field grid -->
        <div class="ns-detail-section">
            <div class="ns-detail-section-title">Informasi Perkara</div>
            <div class="ns-detail-grid">
                <div class="ns-detail-field"><div class="ns-detail-field-label">Klasifikasi</div><div class="ns-detail-field-value">{{ row.sipp_klasifikasi || '—' }}</div></div>
                <div class="ns-detail-field"><div class="ns-detail-field-label">Tanggal Register</div><div class="ns-detail-field-value">{{ row.sipp_tanggal_register || '—' }}</div></div>
                <div class="ns-detail-field"><div class="ns-detail-field-label">Tahun</div><div class="ns-detail-field-value">{{ row.tahun_masuk }}</div></div>
                <div class="ns-detail-field"><div class="ns-detail-field-label">Tanggal Putus</div><div class="ns-detail-field-value">{{ row.tanggal_putus || '—' }}</div></div>
            </div>
        </div>

        <!-- Jadwal sidang -->
        <div class="ns-detail-section">
            <div class="ns-detail-section-title">Jadwal Sidang</div>
            <div v-if="loadingJadwal">Memuat...</div>
            <div v-else-if="!jadwal.length" class="ns-empty">Tidak ada jadwal sidang</div>
            <div v-else>
                <div v-for="j in jadwal" :key="j.nomor || j.tanggal" class="ns-detail-agenda">
                    <strong>{{ j.tanggal }}</strong> · {{ j.jam }}
                    <div>{{ j.agenda }}</div>
                    <div class="ns-detail-status-sub">{{ j.ruangan }}</div>
                </div>
            </div>
        </div>

        <!-- Actions -->
        <div class="ns-detail-actions">
            <button class="ns-btn ns-btn-ghost" @click="handleRefreshJadwal" :disabled="refreshing">
                {{ refreshing ? 'Refreshing...' : 'Refresh Jadwal' }}
            </button>
            <button class="ns-btn ns-btn-danger" @click="handleDelete">Delete</button>
        </div>
    </div>
</aside>
```

## DataView.vue Rewrite

Replace entire file. Imports: `PageHeader, StatsStrip, TrendCard, MiniStatCard, ToolbarFilters, SyncCluster, PerkaraTable, DetailPanel`, plus `getPerkara, getSippStatus, getPerkaraTrend, deletePerkara` dari `lib/api.js`.

State:
- `rows = ref([])` — full list
- `trendData = ref([])`
- `syncStatus = ref({ total: 0, sipp_synced: 0, last_sync: null })`
- `search = ref('')`
- `filterJenis = ref('Semua')`
- `filterTahun = ref(String(new Date().getFullYear()))`
- `selectedRow = ref(null)`

Computed:
- `filtered` — apply search + jenis + tahun filters to rows
- `stats` — `{ total, pidana, perdata, aktif }` from rows
- `avgDays` — avg days between sipp_tanggal_register and tanggal_putus for closed rows. Round to int. If no closed rows → `'—'`.
- `syncRate` — `(syncStatus.sipp_synced / syncStatus.total * 100).toFixed(1)`. If total=0 → `'—'`.
- `tahunOptions` — uniques from rows, sorted desc + 'Semua'
- `jenisOptions` — `['Semua', 'Pidana', 'Perdata', 'Perikanan']`

Methods:
- `async loadAll()` — parallel: `getPerkara({limit:1000})`, `getSippStatus()`, `getPerkaraTrend(8)`. Set state.
- `onRowDeleted(nomor)` — remove from rows, close panel
- `onSynced()` — re-call loadAll

Lifecycle: `onMounted(loadAll)`.

Layout (template):
```vue
<div>
    <PageHeader eyebrow="Akurasi Kepaniteraan" title="Data Perkara"
                sub="Daftar perkara aktif disinkronkan dengan SIPP">
        <StatsStrip :stats="stats" />
    </PageHeader>

    <div class="ns-c-cards-row">
        <TrendCard :data="trendData" />
        <div class="ns-c-side-cards">
            <MiniStatCard label="Rata-rata penyelesaian" :value="avgDays" unit="hari"
                          deltaText="—" deltaTrend="flat" deltaIcon="activity" />
            <MiniStatCard label="Sync rate" :value="syncRate" unit="%"
                          deltaText="Stabil" deltaTrend="up" deltaIcon="activity" />
        </div>
    </div>

    <div class="ns-toolbar">
        <ToolbarFilters
            v-model:search="search"
            v-model:jenis="filterJenis"
            v-model:tahun="filterTahun"
            :jenis-options="jenisOptions"
            :tahun-options="tahunOptions"
        />
        <SyncCluster :count="filtered.length" :total="rows.length" @synced="loadAll" />
    </div>

    <PerkaraTable :rows="filtered" @row-click="selectedRow = $event" />

    <DetailPanel
        :row="selectedRow"
        :open="!!selectedRow"
        @close="selectedRow = null"
        @deleted="onRowDeleted"
    />
</div>
```

Hapus seluruh isi lama (Element Plus dialog, table, dll).

## Verifikasi End-to-End

1. `/data` tampil tanpa error. Hero + StatsStrip dengan angka real (Total, Pidana, Perdata, Aktif counts cocok dengan DB).
2. TrendCard tampil bar chart 8 minggu — bar height proporsional dengan registrasi perkara per minggu. Delta pill tampil persen.
3. MiniStatCards: Rata-rata penyelesaian tampil angka (atau "—" kalau tidak ada closed). Sync rate ~99-100%.
4. Toolbar filter: ketik di search → tabel update. Klik chip jenis → menu dropdown, pilih "Pidana" → tabel filter. Sama untuk tahun.
5. Klik row → DetailPanel slide-in dari kanan dengan info perkara + jadwal sidang loaded. Klik backdrop → close.
6. Di DetailPanel klik "Refresh Jadwal" → tombol disable, fetch baru → list update.
7. Klik "Delete" di DetailPanel → confirm prompt → row hilang dari tabel, panel close.
8. Klik "Sync SIPP" → progress inline tampil, button disabled, on complete data refresh, panel close otomatis.
9. Theme toggle masih kerja.

## Out of Scope

- Bulanan/Mingguan rebuild (Fase 4)
- Hapus `InputView.vue` route (Fase 5)
- Animasi slide-in DetailPanel (Fase 5; default tidak ada transition)
- Responsive breakpoints (Fase 5)
- Hapus `style.css` lama (Fase 5)
- Bell dropdown (out of MVP)
- Buka di SIPP link (butuh schema baru)
- Custom date range pada trend chart (default 8 minggu)
- Real "Rata-rata penyelesaian delta" (current period vs previous) — tampilkan flat untuk MVP
- Test framework setup (no test runner exists — verifikasi manual via browser)
