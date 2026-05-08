# Redesign Fase 3 — DataView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild halaman `/data` (DataView) ke design "Gov Modern" — hero + stats strip + trend chart + 2 mini cards + toolbar + tabel scrollable + slide-in DetailPanel — wired ke API beneran. Tambah 2 endpoint backend baru (trend + refresh jadwal). Halaman lain (Bulanan, Mingguan) tidak diubah.

**Architecture:** Backend dapat 2 endpoint baru di `server.js`. Frontend dapat 7 komponen baru di `components/dashboard/`. `DataView.vue` di-rewrite total dari Element Plus ke komponen custom. State Vue 3 Composition API + computed dari raw data.

**Tech Stack:** Node.js (Express + better-sqlite3 + puppeteer), Vue 3 Composition API, vue-router. CSS classes dari `design-tokens.css` + `design-bookman.css`.

**Catatan TDD:** Project tidak punya test runner. Verifikasi tiap task: dev server compile, curl endpoint, browser visual check.

**Sebelum mulai:** kalau backend/frontend dev server mati, start ulang:

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node server.js > server.log 2>&1 &
```

Vite frontend should be running at port 5173 (atau cek dengan `Get-NetTCPConnection -LocalPort 5173`).

---

### Task 1: Backend — `GET /api/perkara/trend?weeks=N`

**Files:**
- Modify: `C:\Users\faris\Documents\natunasakti\backend\server.js` — tambah handler. Sisipkan SEBELUM handler `/api/perkara/:id` (line ~403, supaya tidak bentrok param).

- [ ] **Step 1: Tambah handler**

Cari line `app.get('/api/perkara/:id', ...)` (around line 359 in current file). Sisipkan blok berikut TEPAT SEBELUM handler tsb (handlers Express dipilih by order — wildcard `/api/perkara/:id` akan menangkap `/api/perkara/trend` kalau `/trend` tidak didefinisikan duluan).

```javascript
// Trend pendaftaran per minggu (last N weeks, max 52)
app.get('/api/perkara/trend', (req, res) => {
    try {
        const weeks = Math.max(1, Math.min(52, parseInt(req.query.weeks) || 8));
        const rows = db.prepare(`
            SELECT jenis_perkara, sipp_tanggal_register
            FROM perkara
            WHERE sipp_tanggal_register IS NOT NULL AND sipp_tanggal_register != ''
        `).all();

        const monthMap = {
            jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, jun: 5,
            jul: 6, agu: 7, sep: 8, okt: 9, nov: 10, des: 11
        };

        function parseTanggal(s) {
            // Format: "07 Mei 2026" or "07 May 2026" (English fallback)
            const parts = s.trim().split(/\s+/);
            if (parts.length < 3) return null;
            const day = parseInt(parts[0]);
            const monKey = parts[1].toLowerCase().slice(0, 3);
            const enMap = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
            const mon = monthMap[monKey] ?? enMap[monKey];
            const year = parseInt(parts[2]);
            if (mon === undefined || isNaN(day) || isNaN(year)) return null;
            return new Date(year, mon, day);
        }

        const now = new Date();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const buckets = Array.from({ length: weeks }, () => ({ pidana: 0, perdata: 0 }));

        for (const r of rows) {
            const d = parseTanggal(r.sipp_tanggal_register);
            if (!d) continue;
            const diff = now - d;
            if (diff < 0) continue;
            const weekIdx = Math.floor(diff / weekMs);
            if (weekIdx >= weeks) continue;
            // Reverse so W1 is oldest, W{weeks} is newest
            const bucketIdx = weeks - 1 - weekIdx;
            if (r.jenis_perkara === 'Pidana') buckets[bucketIdx].pidana++;
            else if (r.jenis_perkara === 'Perdata') buckets[bucketIdx].perdata++;
            // Perikanan/Lainnya: skipped per spec
        }

        const result = buckets.map((b, i) => ({
            week: `W${i + 1}`,
            pidana: b.pidana,
            perdata: b.perdata
        }));
        res.json(result);
    } catch (error) {
        console.error('[TREND] error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

```

- [ ] **Step 2: Restart backend, verify endpoint**

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node server.js > server.log 2>&1 &
sleep 3 && curl -s "http://localhost:3000/api/perkara/trend?weeks=8" --max-time 5 | head -c 400
echo ""
```

Expected: JSON array dengan 8 entries, masing-masing `{week:"W1",pidana:N,perdata:N}` sampai `W8`. Total counts non-zero.

Test edge cases:
```bash
curl -s "http://localhost:3000/api/perkara/trend?weeks=4" --max-time 5 | head -c 200
curl -s "http://localhost:3000/api/perkara/trend" --max-time 5 | head -c 200  # default 8
```

Expected: 4 entries dan 8 entries respectively.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add backend/server.js && git commit -m "feat(api): GET /api/perkara/trend for weekly registration aggregation"
```

---

### Task 2: Backend — `POST /api/perkara/sipp/jadwal/:nomor/refresh`

**Files:**
- Modify: `C:\Users\faris\Documents\natunasakti\backend\server.js` — tambah handler setelah handler GET `/api/perkara/sipp/jadwal/:nomor`.

- [ ] **Step 1: Tambah handler**

Cari handler `app.get('/api/perkara/sipp/jadwal/:nomor', async (req, res) => { ... });` (currently around line 357-401). Tambah handler baru TEPAT SETELAH-nya:

```javascript
// Force refresh jadwal sidang for a perkara (bypass cache, re-fetch from SIPP)
app.post('/api/perkara/sipp/jadwal/:nomor/refresh', async (req, res) => {
    const nomorPerkara = decodeURIComponent(req.params.nomor);
    console.log('[SIPP-JADWAL-REFRESH] Called for:', nomorPerkara);
    const puppeteer = require('puppeteer');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await sippService.fetchAndCacheJadwal(nomorPerkara, page);

        const cached = db.prepare(`
            SELECT nomor, tanggal, jam, agenda, ruangan,
                   alasan_ditunda AS alasanDitunda
            FROM jadwal_sidang
            WHERE nomor_perkara = ? AND nomor IS NOT NULL
            ORDER BY id
        `).all(nomorPerkara);

        res.json({
            nomor_perkara: nomorPerkara,
            jadwal: cached,
            cached: true,
            refreshed: true
        });
    } catch (error) {
        console.error('[SIPP-JADWAL-REFRESH] error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

```

- [ ] **Step 2: Restart backend, verify**

```powershell
$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { Stop-Process -Id $p.OwningProcess -Force }
```

```bash
cd "C:\Users\faris\Documents\natunasakti\backend" && node server.js > server.log 2>&1 &
sleep 3 && curl -s -X POST "http://localhost:3000/api/perkara/sipp/jadwal/22%2FPid.B%2F2026%2FPN%20Ntn/refresh" --max-time 30 -w "\ntime=%{time_total}s\n" | head -c 400
echo ""
```

Expected: JSON dengan `"refreshed":true`, `"cached":true`, `jadwal` array non-empty. Time ~2-3s (live puppeteer call).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add backend/server.js && git commit -m "feat(api): POST /api/perkara/sipp/jadwal/:nomor/refresh"
```

---

### Task 3: Frontend `lib/api.js` — tambah 2 function

**Files:**
- Modify: `C:\Users\faris\Documents\natunasakti\frontend\src\lib\api.js`

- [ ] **Step 1: Append functions di akhir file**

Buka `C:\Users\faris\Documents\natunasakti\frontend\src\lib\api.js`. Di akhir file, tambah:

```javascript

// Get trend data for last N weeks
export const getPerkaraTrend = async (weeks = 8) => {
    const response = await fetch(`${API_BASE}/perkara/trend?weeks=${weeks}`);
    if (!response.ok) throw new Error('Failed to fetch trend');
    return response.json();
};

// Force refresh jadwal sidang (bypass cache, re-scrape SIPP)
export const refreshJadwal = async (nomorPerkara) => {
    const encoded = encodeURIComponent(nomorPerkara);
    const response = await fetch(`${API_BASE}/perkara/sipp/jadwal/${encoded}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to refresh jadwal');
    return response.json();
};
```

- [ ] **Step 2: Verify Vite hot-reload**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/lib/api.js && git commit -m "feat(api): add getPerkaraTrend and refreshJadwal client functions"
```

---

### Task 4: `StatsStrip.vue`

**Files:**
- Create: `frontend/src/components/dashboard/StatsStrip.vue`

- [ ] **Step 1: Buat folder + file**

```bash
mkdir -p "C:\Users\faris\Documents\natunasakti\frontend\src\components\dashboard"
```

Create `frontend/src/components/dashboard/StatsStrip.vue`:

```vue
<script setup>
defineProps({
    stats: {
        type: Object,
        required: true
    }
})
</script>

<template>
    <div class="ns-c-page-stats-strip">
        <div class="ns-c-strip-item">
            <span class="ns-c-strip-label">Total</span>
            <span class="ns-c-strip-value">{{ stats.total }}</span>
        </div>
        <span class="ns-c-strip-divider" />
        <div class="ns-c-strip-item">
            <span class="ns-c-strip-label">Pidana</span>
            <span class="ns-c-strip-value">{{ stats.pidana }}</span>
        </div>
        <span class="ns-c-strip-divider" />
        <div class="ns-c-strip-item">
            <span class="ns-c-strip-label">Perdata</span>
            <span class="ns-c-strip-value">{{ stats.perdata }}</span>
        </div>
        <span class="ns-c-strip-divider" />
        <div class="ns-c-strip-item">
            <span class="ns-c-strip-label">Aktif</span>
            <span class="ns-c-strip-value">{{ stats.aktif }}</span>
        </div>
    </div>
</template>
```

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/dashboard/StatsStrip.vue && git commit -m "feat(dashboard): StatsStrip component"
```

---

### Task 5: `MiniStatCard.vue`

**Files:**
- Create: `frontend/src/components/dashboard/MiniStatCard.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/dashboard/MiniStatCard.vue`:

```vue
<script setup>
import Icon from '../Icon.vue'

defineProps({
    label: { type: String, required: true },
    value: { type: [Number, String], required: true },
    unit: { type: String, default: '' },
    deltaText: { type: String, default: '' },
    deltaTrend: { type: String, default: 'flat' }, // 'up' | 'down' | 'flat'
    deltaIcon: { type: String, default: 'activity' }
})
</script>

<template>
    <div class="ns-c-mini-card">
        <div class="ns-stat-label">{{ label }}</div>
        <div class="ns-c-mini-value">
            {{ value }}<span v-if="unit" class="ns-c-mini-unit">{{ unit }}</span>
        </div>
        <div
            v-if="deltaText"
            class="ns-stat-delta"
            :class="{ 'is-up': deltaTrend === 'up', 'is-down': deltaTrend === 'down' }"
            style="align-self: flex-start"
        >
            <Icon :name="deltaIcon" :size="11" />
            {{ deltaText }}
        </div>
    </div>
</template>
```

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/dashboard/MiniStatCard.vue && git commit -m "feat(dashboard): MiniStatCard component"
```

---

### Task 6: `TrendCard.vue`

**Files:**
- Create: `frontend/src/components/dashboard/TrendCard.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/dashboard/TrendCard.vue`:

```vue
<script setup>
import { computed } from 'vue'
import Icon from '../Icon.vue'
import StackedBars from '../charts/StackedBars.vue'

const props = defineProps({
    data: { type: Array, required: true }
    // Array of { week: 'W1', pidana: N, perdata: N }
})

const delta = computed(() => {
    if (!props.data.length) return { text: '—', trend: 'flat', icon: 'activity' }
    const first = props.data[0]
    const last = props.data[props.data.length - 1]
    const firstTotal = first.pidana + first.perdata
    const lastTotal = last.pidana + last.perdata
    if (firstTotal === 0) return { text: '—', trend: 'flat', icon: 'activity' }
    const pct = ((lastTotal - firstTotal) / firstTotal) * 100
    const sign = pct >= 0 ? '+' : ''
    return {
        text: `${sign}${pct.toFixed(1)}%`,
        trend: pct >= 0 ? 'up' : 'down',
        icon: pct >= 0 ? 'trendUp' : 'trendDown'
    }
})

const weeksLabel = computed(() => `${props.data.length} Minggu`)
</script>

<template>
    <div class="ns-c-big-card">
        <div class="ns-stat-row">
            <div>
                <div class="ns-stat-label">Trend Pendaftaran {{ weeksLabel }}</div>
                <div class="ns-c-big-card-sub">Pidana vs Perdata</div>
            </div>
            <span
                class="ns-stat-delta"
                :class="{ 'is-up': delta.trend === 'up', 'is-down': delta.trend === 'down' }"
            >
                <Icon :name="delta.icon" :size="11" /> {{ delta.text }}
            </span>
        </div>
        <div class="ns-c-bigchart">
            <StackedBars :data="data" :width="420" :height="120" color-a="#ef4444" color-b="#10b981" />
        </div>
        <div class="ns-c-bigchart-legend">
            <span><span class="ns-legend-dot" style="background:#ef4444" /> Pidana</span>
            <span><span class="ns-legend-dot" style="background:#10b981" /> Perdata</span>
        </div>
    </div>
</template>
```

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/dashboard/TrendCard.vue && git commit -m "feat(dashboard): TrendCard with delta computation"
```

---

### Task 7: `ToolbarFilters.vue`

**Files:**
- Create: `frontend/src/components/dashboard/ToolbarFilters.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/dashboard/ToolbarFilters.vue`:

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    search: { type: String, default: '' },
    jenis: { type: String, default: 'Semua' },
    tahun: { type: String, default: '' },
    jenisOptions: { type: Array, default: () => ['Semua', 'Pidana', 'Perdata', 'Perikanan'] },
    tahunOptions: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:search', 'update:jenis', 'update:tahun'])

const openMenu = ref(null) // 'jenis' | 'tahun' | null

function toggleMenu(name) {
    openMenu.value = openMenu.value === name ? null : name
}

function selectOption(name, value) {
    if (name === 'jenis') emit('update:jenis', value)
    else if (name === 'tahun') emit('update:tahun', value)
    openMenu.value = null
}

function handleClickOutside(e) {
    if (!e.target.closest('.ns-filter-chip')) {
        openMenu.value = null
    }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
    <div class="ns-toolbar-filters">
        <div style="position: relative; flex: 1; max-width: 280px;">
            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-3);">
                <Icon name="search" :size="14" />
            </span>
            <input
                type="text"
                placeholder="Cari nomor / pihak..."
                :value="search"
                @input="emit('update:search', $event.target.value)"
                style="width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 13px;"
            />
        </div>

        <div class="ns-filter-chip">
            <button
                type="button"
                class="ns-chip-btn"
                :class="{ 'is-open': openMenu === 'jenis' }"
                @click.stop="toggleMenu('jenis')"
            >
                <span class="ns-chip-label">Jenis:</span>
                <span class="ns-chip-value">{{ jenis }}</span>
                <Icon name="chevronDown" :size="12" />
            </button>
            <div v-if="openMenu === 'jenis'" class="ns-chip-menu">
                <div
                    v-for="opt in jenisOptions"
                    :key="opt"
                    class="ns-chip-option"
                    :class="{ 'is-selected': opt === jenis }"
                    @click="selectOption('jenis', opt)"
                >
                    {{ opt }}
                </div>
            </div>
        </div>

        <div class="ns-filter-chip" v-if="tahunOptions.length">
            <button
                type="button"
                class="ns-chip-btn"
                :class="{ 'is-open': openMenu === 'tahun' }"
                @click.stop="toggleMenu('tahun')"
            >
                <span class="ns-chip-label">Tahun:</span>
                <span class="ns-chip-value">{{ tahun || 'Semua' }}</span>
                <Icon name="chevronDown" :size="12" />
            </button>
            <div v-if="openMenu === 'tahun'" class="ns-chip-menu">
                <div
                    class="ns-chip-option"
                    :class="{ 'is-selected': tahun === '' }"
                    @click="selectOption('tahun', '')"
                >
                    Semua
                </div>
                <div
                    v-for="opt in tahunOptions"
                    :key="opt"
                    class="ns-chip-option"
                    :class="{ 'is-selected': String(opt) === tahun }"
                    @click="selectOption('tahun', String(opt))"
                >
                    {{ opt }}
                </div>
            </div>
        </div>
    </div>
</template>
```

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/dashboard/ToolbarFilters.vue && git commit -m "feat(dashboard): ToolbarFilters with search and chip dropdowns"
```

---

### Task 8: `SyncCluster.vue`

**Files:**
- Create: `frontend/src/components/dashboard/SyncCluster.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/dashboard/SyncCluster.vue`:

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'
import { syncSippData, subscribeSyncProgress, getSippStatus } from '../../lib/api'

const props = defineProps({
    count: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
})

const emit = defineEmits(['synced'])

const syncing = ref(false)
const progress = ref({ current: 0, total: 200, message: '' })
const lastSync = ref('--')
let eventSource = null

function formatTime(iso) {
    if (!iso) return '--'
    const d = new Date(iso)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

async function loadStatus() {
    try {
        const s = await getSippStatus()
        lastSync.value = formatTime(s.last_sync)
    } catch (err) {
        console.error('Status load failed:', err.message)
    }
}

async function handleSync() {
    syncing.value = true
    progress.value = { current: 0, total: 200, message: 'Memulai...' }

    eventSource = subscribeSyncProgress((p) => {
        progress.value = p
        if (!p.inProgress) {
            syncing.value = false
            if (eventSource) {
                eventSource.close()
                eventSource = null
            }
            lastSync.value = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            emit('synced')
        }
    })

    try {
        await syncSippData()
    } catch (err) {
        console.error('Sync failed:', err.message)
        syncing.value = false
        if (eventSource) {
            eventSource.close()
            eventSource = null
        }
    }
}

onMounted(loadStatus)
onUnmounted(() => {
    if (eventSource) eventSource.close()
})
</script>

<template>
    <div style="display: flex; align-items: center; gap: 12px;">
        <div class="ns-live" v-if="!syncing">
            <span class="ns-live-pulse" />
            <span class="ns-live-label">{{ count }}/{{ total }}</span>
            <span class="ns-live-sep">·</span>
            <span class="ns-live-time">last sync {{ lastSync }}</span>
        </div>
        <div class="ns-live is-syncing" v-else>
            <span class="ns-live-pulse" />
            <span class="ns-live-label">{{ progress.message || 'Syncing...' }}</span>
            <span class="ns-live-sep">·</span>
            <span class="ns-live-time">{{ progress.current }}/{{ progress.total }}</span>
        </div>
        <button class="ns-btn ns-btn-primary" type="button" :disabled="syncing" @click="handleSync">
            <Icon name="sync" :size="14" />
            {{ syncing ? 'Syncing...' : 'Sync SIPP' }}
        </button>
    </div>
</template>
```

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/dashboard/SyncCluster.vue && git commit -m "feat(dashboard): SyncCluster with inline SSE progress"
```

---

### Task 9: `PerkaraTable.vue`

**Files:**
- Create: `frontend/src/components/dashboard/PerkaraTable.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/dashboard/PerkaraTable.vue`:

```vue
<script setup>
defineProps({
    rows: { type: Array, required: true }
})

const emit = defineEmits(['rowClick'])

function jenisColor(jenis) {
    if (jenis === 'Pidana') return '#ef4444'
    if (jenis === 'Perdata') return '#10b981'
    if (jenis === 'Perikanan') return '#3b82f6'
    return '#9ca3af'
}
</script>

<template>
    <div class="ns-table-card">
        <div class="ns-table-head">
            <div style="width: 50px;">No</div>
            <div style="width: 90px;">Jenis</div>
            <div style="flex: 1; min-width: 180px;">Nomor Perkara</div>
            <div style="flex: 1; min-width: 150px;">Para Pihak</div>
            <div style="width: 110px;">Register</div>
            <div style="width: 130px;">Status</div>
            <div style="width: 90px;">Lama</div>
        </div>
        <div class="ns-table-body" style="max-height: 480px; overflow-y: auto;">
            <div
                v-for="(row, idx) in rows"
                :key="row.id || row.nomor_perkara"
                class="ns-tr"
                :class="{ 'is-clickable': true }"
                style="cursor: pointer;"
                @click="emit('rowClick', row)"
            >
                <div style="width: 50px; color: var(--text-3); font-size: 12px;">{{ idx + 1 }}</div>
                <div style="width: 90px;">
                    <span :style="{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: jenisColor(row.jenis_perkara) + '22', color: jenisColor(row.jenis_perkara), fontSize: '11px', fontWeight: 600 }">
                        {{ row.jenis_perkara }}
                    </span>
                </div>
                <div style="flex: 1; min-width: 180px;" class="ns-mono">{{ row.nomor_perkara }}</div>
                <div style="flex: 1; min-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="row.para_pihak">{{ row.para_pihak }}</div>
                <div style="width: 110px; font-size: 12px; color: var(--text-2);">{{ row.sipp_tanggal_register || '—' }}</div>
                <div style="width: 130px; font-size: 12px;">{{ row.sipp_status || '—' }}</div>
                <div style="width: 90px; font-size: 12px; color: var(--text-2);">{{ row.sipp_lama_proses || '—' }}</div>
            </div>
            <div v-if="!rows.length" class="ns-empty">Tidak ada perkara</div>
        </div>
    </div>
</template>
```

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/dashboard/PerkaraTable.vue && git commit -m "feat(dashboard): PerkaraTable with custom rows and jenis color tags"
```

---

### Task 10: `DetailPanel.vue`

**Files:**
- Create: `frontend/src/components/dashboard/DetailPanel.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/dashboard/DetailPanel.vue`:

```vue
<script setup>
import { ref, watch } from 'vue'
import Icon from '../Icon.vue'
import { getJadwalSidang, refreshJadwal, deletePerkara } from '../../lib/api'

const props = defineProps({
    row: { type: Object, default: null },
    open: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'deleted'])

const jadwal = ref([])
const loadingJadwal = ref(false)
const refreshing = ref(false)
const deleting = ref(false)

async function loadJadwal(nomor) {
    loadingJadwal.value = true
    jadwal.value = []
    try {
        const res = await getJadwalSidang(nomor)
        jadwal.value = res.jadwal || []
    } catch (err) {
        console.error('Load jadwal failed:', err.message)
    } finally {
        loadingJadwal.value = false
    }
}

async function handleRefreshJadwal() {
    if (!props.row) return
    refreshing.value = true
    try {
        const res = await refreshJadwal(props.row.nomor_perkara)
        jadwal.value = res.jadwal || []
    } catch (err) {
        console.error('Refresh jadwal failed:', err.message)
        alert('Gagal refresh jadwal: ' + err.message)
    } finally {
        refreshing.value = false
    }
}

async function handleDelete() {
    if (!props.row) return
    if (!window.confirm(`Hapus perkara ${props.row.nomor_perkara}?`)) return
    deleting.value = true
    try {
        await deletePerkara(props.row.id)
        emit('deleted', props.row.nomor_perkara)
        emit('close')
    } catch (err) {
        console.error('Delete failed:', err.message)
        alert('Gagal hapus: ' + err.message)
    } finally {
        deleting.value = false
    }
}

watch(() => props.row, (newRow) => {
    if (newRow) loadJadwal(newRow.nomor_perkara)
})
</script>

<template>
    <Teleport to="body">
        <div v-if="open" class="ns-detail-backdrop" @click="emit('close')" />
        <aside v-if="open && row" class="ns-detail-panel">
            <header class="ns-detail-head">
                <div>
                    <div class="ns-detail-eyebrow">{{ row.jenis_perkara }}</div>
                    <h2 class="ns-detail-title ns-mono">{{ row.nomor_perkara }}</h2>
                    <div class="ns-detail-pihak">{{ row.para_pihak }}</div>
                </div>
                <button class="ns-icon-btn" type="button" @click="emit('close')" aria-label="Close">
                    <Icon name="close" :size="18" />
                </button>
            </header>

            <div class="ns-detail-body">
                <div class="ns-detail-status-card">
                    <span class="ns-detail-status-pulse" />
                    <div>
                        <div>{{ row.sipp_status || 'Status tidak diketahui' }}</div>
                        <div class="ns-detail-status-sub">Lama proses: {{ row.sipp_lama_proses || '—' }}</div>
                    </div>
                </div>

                <div class="ns-detail-section">
                    <div class="ns-detail-section-title">Informasi Perkara</div>
                    <div class="ns-detail-grid">
                        <div class="ns-detail-field">
                            <div class="ns-detail-field-label">Klasifikasi</div>
                            <div class="ns-detail-field-value">{{ row.sipp_klasifikasi || '—' }}</div>
                        </div>
                        <div class="ns-detail-field">
                            <div class="ns-detail-field-label">Tanggal Register</div>
                            <div class="ns-detail-field-value">{{ row.sipp_tanggal_register || '—' }}</div>
                        </div>
                        <div class="ns-detail-field">
                            <div class="ns-detail-field-label">Tahun Masuk</div>
                            <div class="ns-detail-field-value">{{ row.tahun_masuk }}</div>
                        </div>
                        <div class="ns-detail-field">
                            <div class="ns-detail-field-label">Tanggal Putus</div>
                            <div class="ns-detail-field-value">{{ row.tanggal_putus || '—' }}</div>
                        </div>
                    </div>
                </div>

                <div class="ns-detail-section">
                    <div class="ns-detail-section-title">Jadwal Sidang</div>
                    <div v-if="loadingJadwal" style="padding: 16px; color: var(--text-3); font-size: 13px;">Memuat...</div>
                    <div v-else-if="!jadwal.length" class="ns-empty">Tidak ada jadwal sidang</div>
                    <div v-else style="display: flex; flex-direction: column; gap: 10px;">
                        <div v-for="(j, i) in jadwal" :key="i" class="ns-detail-agenda">
                            <div style="font-weight: 600;">{{ j.tanggal }}<span v-if="j.jam" style="color: var(--text-3); font-weight: 400; margin-left: 8px;">{{ j.jam }}</span></div>
                            <div style="margin-top: 4px;">{{ j.agenda }}</div>
                            <div v-if="j.ruangan" class="ns-detail-status-sub">{{ j.ruangan }}</div>
                            <div v-if="j.alasanDitunda && j.alasanDitunda !== '0'" style="margin-top: 4px; font-size: 11.5px; color: var(--warn);">Ditunda: {{ j.alasanDitunda }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="ns-detail-actions">
                <button class="ns-btn ns-btn-ghost" type="button" :disabled="refreshing" @click="handleRefreshJadwal">
                    <Icon name="refresh" :size="14" />
                    {{ refreshing ? 'Refreshing...' : 'Refresh Jadwal' }}
                </button>
                <button class="ns-btn ns-btn-danger" type="button" :disabled="deleting" @click="handleDelete">
                    <Icon name="trash" :size="14" />
                    {{ deleting ? 'Deleting...' : 'Delete' }}
                </button>
            </div>
        </aside>
    </Teleport>
</template>
```

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/dashboard/DetailPanel.vue && git commit -m "feat(dashboard): DetailPanel slide-in with jadwal + actions"
```

---

### Task 11: `DataView.vue` rewrite + push semua

**Files:**
- Modify (replace): `frontend/src/views/DataView.vue`

- [ ] **Step 1: Replace DataView.vue**

Replace ENTIRE content of `C:\Users\faris\Documents\natunasakti\frontend\src\views\DataView.vue` with:

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'
import PageHeader from '../components/shell/PageHeader.vue'
import StatsStrip from '../components/dashboard/StatsStrip.vue'
import TrendCard from '../components/dashboard/TrendCard.vue'
import MiniStatCard from '../components/dashboard/MiniStatCard.vue'
import ToolbarFilters from '../components/dashboard/ToolbarFilters.vue'
import SyncCluster from '../components/dashboard/SyncCluster.vue'
import PerkaraTable from '../components/dashboard/PerkaraTable.vue'
import DetailPanel from '../components/dashboard/DetailPanel.vue'
import { getPerkara, getSippStatus, getPerkaraTrend } from '../lib/api'

const rows = ref([])
const trendData = ref([])
const syncStatus = ref({ total: 0, sipp_synced: 0, last_sync: null })

const search = ref('')
const filterJenis = ref('Semua')
const filterTahun = ref(String(new Date().getFullYear()))

const selectedRow = ref(null)

const filtered = computed(() => {
    return rows.value.filter(r => {
        if (filterJenis.value !== 'Semua' && r.jenis_perkara !== filterJenis.value) return false
        if (filterTahun.value && String(r.tahun_masuk) !== filterTahun.value) return false
        if (search.value) {
            const q = search.value.toLowerCase()
            const nomor = (r.nomor_perkara || '').toLowerCase()
            const pihak = (r.para_pihak || '').toLowerCase()
            if (!nomor.includes(q) && !pihak.includes(q)) return false
        }
        return true
    })
})

const stats = computed(() => ({
    total: rows.value.length,
    pidana: rows.value.filter(r => r.jenis_perkara === 'Pidana').length,
    perdata: rows.value.filter(r => r.jenis_perkara === 'Perdata').length,
    aktif: rows.value.filter(r => !r.tanggal_putus).length
}))

const monthMap = { jan:0, feb:1, mar:2, apr:3, mei:4, jun:5, jul:6, agu:7, sep:8, okt:9, nov:10, des:11, may:4, aug:7, oct:9, dec:11 }

function parseTanggal(s) {
    if (!s) return null
    const parts = s.trim().split(/\s+/)
    if (parts.length < 3) return null
    const day = parseInt(parts[0])
    const mon = monthMap[parts[1].toLowerCase().slice(0, 3)]
    const year = parseInt(parts[2])
    if (mon === undefined || isNaN(day) || isNaN(year)) return null
    return new Date(year, mon, day)
}

const avgDays = computed(() => {
    const closed = rows.value.filter(r => r.tanggal_putus)
    if (!closed.length) return '—'
    let total = 0
    let count = 0
    for (const r of closed) {
        const reg = parseTanggal(r.sipp_tanggal_register)
        const put = parseTanggal(r.tanggal_putus) || new Date(r.tanggal_putus)
        if (!reg || !put || isNaN(put.getTime())) continue
        const days = Math.floor((put - reg) / (24 * 60 * 60 * 1000))
        if (days >= 0) {
            total += days
            count++
        }
    }
    return count > 0 ? Math.round(total / count) : '—'
})

const syncRate = computed(() => {
    if (!syncStatus.value.total) return '—'
    return ((syncStatus.value.sipp_synced / syncStatus.value.total) * 100).toFixed(1)
})

const tahunOptions = computed(() => {
    const set = new Set(rows.value.map(r => r.tahun_masuk).filter(Boolean))
    return Array.from(set).sort((a, b) => b - a)
})

const jenisOptions = ['Semua', 'Pidana', 'Perdata', 'Perikanan']

async function loadAll() {
    try {
        const [perkaraRes, statusRes, trendRes] = await Promise.all([
            getPerkara({ limit: 1000 }),
            getSippStatus(),
            getPerkaraTrend(8)
        ])
        rows.value = Array.isArray(perkaraRes) ? perkaraRes : (perkaraRes.data || [])
        syncStatus.value = statusRes
        trendData.value = trendRes
    } catch (err) {
        console.error('Load failed:', err.message)
    }
}

function onRowDeleted(nomor) {
    rows.value = rows.value.filter(r => r.nomor_perkara !== nomor)
    selectedRow.value = null
}

onMounted(loadAll)
</script>

<template>
    <div>
        <PageHeader
            eyebrow="Akurasi Kepaniteraan"
            title="Data Perkara"
            sub="Daftar perkara aktif disinkronkan dengan SIPP"
        >
            <StatsStrip :stats="stats" />
        </PageHeader>

        <div class="ns-c-cards-row">
            <TrendCard :data="trendData" />
            <div class="ns-c-side-cards">
                <MiniStatCard
                    label="Rata-rata penyelesaian"
                    :value="avgDays"
                    unit="hari"
                    delta-text=""
                    delta-trend="flat"
                    delta-icon="activity"
                />
                <MiniStatCard
                    label="Sync rate"
                    :value="syncRate"
                    unit="%"
                    delta-text="Stabil"
                    delta-trend="up"
                    delta-icon="activity"
                />
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
</template>
```

Hapus seluruh isi lama (Element Plus components, jadwalDialog, syncProgressDialog, dll).

- [ ] **Step 2: Verify Vite kompilasi**

```bash
sleep 3 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -10 || echo "no errors"
```

- [ ] **Step 3: Verify endpoint + page render**

```bash
PORT=5173
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:$PORT/data" --max-time 3
curl -s "http://localhost:3000/api/perkara/trend?weeks=8" --max-time 5 | head -c 200
echo ""
```

Expected: page returns 200, trend endpoint returns JSON array.

- [ ] **Step 4: Commit DataView**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/views/DataView.vue && git commit -m "feat: DataView rewrite with new dashboard components"
```

- [ ] **Step 5: Confirm 11 commits ahead, push**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git log --oneline origin/master..HEAD
```

Should show 11 commits (Tasks 1-11). Then:

```bash
git push origin master
```

- [ ] **Step 6: Commit + push spec & plan**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add docs/superpowers/specs/2026-05-08-redesign-fase-3-dataview-design.md docs/superpowers/plans/2026-05-08-redesign-fase-3-dataview.md && git commit -m "docs: spec and plan for redesign fase 3 dataview"
```

```bash
git push origin master
```
