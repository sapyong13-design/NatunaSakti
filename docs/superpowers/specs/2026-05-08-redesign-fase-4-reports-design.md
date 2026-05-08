# Redesign Fase 4 — Bulanan + Mingguan Reports

**Tanggal:** 2026-05-08
**Konteks:** Fase 4 dari rebuild frontend. Fase 1-3 sudah selesai (foundation, shell, DataView). Fase 4 me-rebuild dua halaman laporan (Bulanan + Mingguan) supaya konsisten dengan design language baru — Element Plus dihapus dari kedua view, diganti komponen custom yang sejalan dengan DataView. PDF/DOCX export tetap berfungsi (lib/export.js tidak disentuh).

## Tujuan

Setelah fase ini:
- `/bulanan/:jenis` (pidana/perdata/perikanan) menampilkan: PageHeader + total, BulananFilterBar (bulan + tahun + format), ReportTable. Jenis dari URL param (sidebar drives nav). Export PDF/DOCX berfungsi.
- `/mingguan` menampilkan: PageHeader + total, MingguanFilterBar (jenis chip + 2 date inputs + format), ReportTable. Export PDF/DOCX berfungsi.
- Element Plus components dihapus dari Bulanan + Mingguan (el-card, el-row/col, el-select, el-button, el-table, el-date-picker, el-input-number, ElMessage). Element Plus library tetap di dependencies untuk modul lain (kalau masih dipakai); cleanup library di-evaluasi Fase 5.

## File Structure

```
frontend/src/
├── components/
│   └── report/
│       ├── BulananFilterBar.vue
│       ├── MingguanFilterBar.vue
│       └── ReportTable.vue
└── views/
    ├── BulananView.vue        ← rewrite total
    └── MingguanView.vue       ← rewrite total
```

`components/report/` adalah folder baru.

## Backend / API

Tidak ada endpoint baru. Existing dipakai:
- `getPerkaraByMonth(bulan, tahun, { jenis_perkara })` — untuk BulananView
- `getPerkaraByDateRange(start, end, { jenis_perkara })` — untuk MingguanView
- `lib/export.js` (`generateBulananPDF`, `generateBulananDOCX`, `generateMingguanPDF`, `generateMingguanDOCX`, `downloadPDF`, `downloadDOCX`) — tidak disentuh.

## Komponen `ReportTable.vue`

Shared table untuk Bulanan + Mingguan. Kolom: No, Nama Perkara, Nomor Perkara, Para Pihak, Tahun Masuk, Tgl Putus, Ket.

Props:
- `rows: Array` — perkara yang sudah putus (filtered backend)
- `loading: Boolean` — kalau true, tampilkan placeholder

Render via `.ns-table-card` + `.ns-table-head` + `.ns-table-body` + `.ns-tr` (sudah ada di design-tokens.css). `.ns-empty` untuk empty state.

```vue
<script setup>
defineProps({
    rows: { type: Array, required: true },
    loading: { type: Boolean, default: false }
})

function formatDate(s) {
    if (!s) return '-'
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}-${mm}-${d.getFullYear()}`
}
</script>

<template>
    <div class="ns-table-card">
        <div class="ns-table-head">
            <div style="width: 50px;">No</div>
            <div style="flex: 1; min-width: 140px;">Nama Perkara</div>
            <div style="flex: 1; min-width: 180px;">Nomor Perkara</div>
            <div style="flex: 1; min-width: 180px;">Para Pihak</div>
            <div style="width: 100px;">Tahun</div>
            <div style="width: 110px;">Tgl Putus</div>
            <div style="width: 80px;">Ket</div>
        </div>
        <div class="ns-table-body" style="max-height: 520px; overflow-y: auto;">
            <div v-if="loading" class="ns-empty">Memuat...</div>
            <div v-else-if="!rows.length" class="ns-empty">Tidak ada perkara di periode ini</div>
            <div v-for="(row, idx) in rows" :key="row.id" class="ns-tr">
                <div style="width: 50px; color: var(--text-3); font-size: 12px;">{{ idx + 1 }}</div>
                <div style="flex: 1; min-width: 140px;">{{ row.nama_perkara }}</div>
                <div style="flex: 1; min-width: 180px;" class="ns-mono">{{ row.nomor_perkara }}</div>
                <div style="flex: 1; min-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="row.para_pihak">{{ row.para_pihak }}</div>
                <div style="width: 100px; font-size: 12px;">{{ row.tahun_masuk }}</div>
                <div style="width: 110px; font-size: 12px;">{{ formatDate(row.tanggal_putus) }}</div>
                <div style="width: 80px; font-size: 12px; color: var(--text-2);">{{ row.keterangan || '-' }}</div>
            </div>
        </div>
    </div>
</template>
```

## Komponen `BulananFilterBar.vue`

Filter row untuk Bulanan: bulan dropdown, tahun number, format dropdown, Tampilkan + Export buttons.

Props (v-model):
- `bulan: Number` (1-12)
- `tahun: Number`
- `format: String` ('pdf' | 'docx')

Plus:
- `loading: Boolean` — disable Tampilkan saat fetching
- `exporting: Boolean` — disable Export saat exporting
- `canExport: Boolean` — disable Export kalau rows kosong

Emits:
- `update:bulan`, `update:tahun`, `update:format`
- `fetch` — klik tombol Tampilkan
- `export` — klik tombol Export

Internal state: `openMenu: 'bulan' | 'tahun' | 'format' | null` untuk chip dropdowns.

Bulan menu: list 12 bulan dengan label Indonesian (Januari, Februari, ...).
Tahun: chip yang shows current value, click → menu dengan list 2020-2030 atau pakai native `<input type="number">` inline. Pilih: native input untuk simplicity.

Layout: pakai `.ns-toolbar` wrapper + `.ns-toolbar-filters` + `.ns-filter-chip` + `.ns-chip-btn`.

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    bulan: { type: Number, required: true },
    tahun: { type: Number, required: true },
    format: { type: String, default: 'pdf' },
    loading: { type: Boolean, default: false },
    exporting: { type: Boolean, default: false },
    canExport: { type: Boolean, default: false }
})

const emit = defineEmits(['update:bulan', 'update:tahun', 'update:format', 'fetch', 'export'])

const BULAN_NAMA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const openMenu = ref(null)

function toggleMenu(name) {
    openMenu.value = openMenu.value === name ? null : name
}

function selectBulan(idx) {
    emit('update:bulan', idx + 1)
    openMenu.value = null
}

function selectFormat(f) {
    emit('update:format', f)
    openMenu.value = null
}

function handleClickOutside(e) {
    if (!e.target.closest('.ns-filter-chip')) openMenu.value = null
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
    <div class="ns-toolbar">
        <div class="ns-toolbar-filters">
            <div class="ns-filter-chip">
                <button type="button" class="ns-chip-btn"
                        :class="{ 'is-open': openMenu === 'bulan' }"
                        @click.stop="toggleMenu('bulan')">
                    <span class="ns-chip-label">Bulan:</span>
                    <span class="ns-chip-value">{{ BULAN_NAMA[bulan - 1] }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
                <div v-if="openMenu === 'bulan'" class="ns-chip-menu">
                    <div v-for="(nama, idx) in BULAN_NAMA" :key="idx"
                         class="ns-chip-option"
                         :class="{ 'is-selected': idx + 1 === bulan }"
                         @click="selectBulan(idx)">
                        {{ nama }}
                    </div>
                </div>
            </div>

            <div class="ns-filter-chip">
                <span class="ns-chip-btn" style="cursor: default;">
                    <span class="ns-chip-label">Tahun:</span>
                    <input type="number"
                           :value="tahun"
                           min="2020" max="2030"
                           @input="emit('update:tahun', parseInt($event.target.value) || 2020)"
                           style="width: 70px; border: 0; background: transparent; color: inherit; font-weight: 500; font-size: inherit; outline: none;">
                </span>
            </div>

            <div class="ns-filter-chip">
                <button type="button" class="ns-chip-btn"
                        :class="{ 'is-open': openMenu === 'format' }"
                        @click.stop="toggleMenu('format')">
                    <span class="ns-chip-label">Format:</span>
                    <span class="ns-chip-value">{{ format.toUpperCase() }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
                <div v-if="openMenu === 'format'" class="ns-chip-menu">
                    <div class="ns-chip-option" :class="{ 'is-selected': format === 'pdf' }" @click="selectFormat('pdf')">PDF</div>
                    <div class="ns-chip-option" :class="{ 'is-selected': format === 'docx' }" @click="selectFormat('docx')">DOCX (Word)</div>
                </div>
            </div>
        </div>

        <div style="display: flex; gap: 8px;">
            <button type="button" class="ns-btn ns-btn-ghost" :disabled="loading" @click="emit('fetch')">
                <Icon name="refresh" :size="14" />
                {{ loading ? 'Memuat...' : 'Tampilkan' }}
            </button>
            <button type="button" class="ns-btn ns-btn-primary" :disabled="exporting || !canExport" @click="emit('export')">
                <Icon name="filePlus" :size="14" />
                {{ exporting ? 'Exporting...' : `Export ${format.toUpperCase()}` }}
            </button>
        </div>
    </div>
</template>
```

## Komponen `MingguanFilterBar.vue`

Filter untuk Mingguan: jenis chip + 2 date inputs + format chip + tombol.

Props (v-model):
- `jenis: String` — 'Pidana' | 'Perdata' | 'Perikanan'
- `start: String` — YYYY-MM-DD
- `end: String` — YYYY-MM-DD
- `format: String`

Plus `loading`, `exporting`, `canExport` like above.

Native `<input type="date">` returns `YYYY-MM-DD` string — match existing API.

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    jenis: { type: String, default: 'Perdata' },
    start: { type: String, default: '' },
    end: { type: String, default: '' },
    format: { type: String, default: 'pdf' },
    loading: { type: Boolean, default: false },
    exporting: { type: Boolean, default: false },
    canExport: { type: Boolean, default: false }
})

const emit = defineEmits(['update:jenis', 'update:start', 'update:end', 'update:format', 'fetch', 'export'])

const JENIS_OPTIONS = ['Pidana', 'Perdata', 'Perikanan']
const openMenu = ref(null)

function toggleMenu(name) {
    openMenu.value = openMenu.value === name ? null : name
}

function selectJenis(j) {
    emit('update:jenis', j)
    openMenu.value = null
}

function selectFormat(f) {
    emit('update:format', f)
    openMenu.value = null
}

function handleClickOutside(e) {
    if (!e.target.closest('.ns-filter-chip')) openMenu.value = null
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
    <div class="ns-toolbar">
        <div class="ns-toolbar-filters">
            <div class="ns-filter-chip">
                <button type="button" class="ns-chip-btn"
                        :class="{ 'is-open': openMenu === 'jenis' }"
                        @click.stop="toggleMenu('jenis')">
                    <span class="ns-chip-label">Jenis:</span>
                    <span class="ns-chip-value">{{ jenis }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
                <div v-if="openMenu === 'jenis'" class="ns-chip-menu">
                    <div v-for="opt in JENIS_OPTIONS" :key="opt"
                         class="ns-chip-option"
                         :class="{ 'is-selected': opt === jenis }"
                         @click="selectJenis(opt)">
                        {{ opt }}
                    </div>
                </div>
            </div>

            <div class="ns-filter-chip">
                <span class="ns-chip-btn" style="cursor: default;">
                    <span class="ns-chip-label">Mulai:</span>
                    <input type="date"
                           :value="start"
                           @input="emit('update:start', $event.target.value)"
                           style="border: 0; background: transparent; color: inherit; font-size: inherit; outline: none;">
                </span>
            </div>

            <div class="ns-filter-chip">
                <span class="ns-chip-btn" style="cursor: default;">
                    <span class="ns-chip-label">Akhir:</span>
                    <input type="date"
                           :value="end"
                           @input="emit('update:end', $event.target.value)"
                           style="border: 0; background: transparent; color: inherit; font-size: inherit; outline: none;">
                </span>
            </div>

            <div class="ns-filter-chip">
                <button type="button" class="ns-chip-btn"
                        :class="{ 'is-open': openMenu === 'format' }"
                        @click.stop="toggleMenu('format')">
                    <span class="ns-chip-label">Format:</span>
                    <span class="ns-chip-value">{{ format.toUpperCase() }}</span>
                    <Icon name="chevronDown" :size="12" />
                </button>
                <div v-if="openMenu === 'format'" class="ns-chip-menu">
                    <div class="ns-chip-option" :class="{ 'is-selected': format === 'pdf' }" @click="selectFormat('pdf')">PDF</div>
                    <div class="ns-chip-option" :class="{ 'is-selected': format === 'docx' }" @click="selectFormat('docx')">DOCX (Word)</div>
                </div>
            </div>
        </div>

        <div style="display: flex; gap: 8px;">
            <button type="button" class="ns-btn ns-btn-ghost" :disabled="loading" @click="emit('fetch')">
                <Icon name="refresh" :size="14" />
                {{ loading ? 'Memuat...' : 'Tampilkan' }}
            </button>
            <button type="button" class="ns-btn ns-btn-primary" :disabled="exporting || !canExport" @click="emit('export')">
                <Icon name="filePlus" :size="14" />
                {{ exporting ? 'Exporting...' : `Export ${format.toUpperCase()}` }}
            </button>
        </div>
    </div>
</template>
```

## `BulananView.vue` rewrite

Replace entire file. State: `bulan, tahun, format, rows, loading, exporting`. Lifecycle: fetch on mount + on route param change.

Jenis dari URL: `route.params.jenis` (`'pidana' | 'perdata' | 'perikanan'`). API expects capitalized → convert.

PageHeader: eyebrow="Laporan Bulanan", title=`"Perkara ${jenisLabel}"`, sub="Rekapitulasi bulanan perkara yang sudah putus".

Stats: simple "Total" count strip.

## `MingguanView.vue` rewrite

Replace entire file. State: `jenis, start, end, format, rows, loading, exporting`. PageHeader: eyebrow="Laporan", title="Mingguan", sub="Rekapitulasi per rentang tanggal".

Initial dates: empty; user pilih sebelum klik Tampilkan. Validasi: kalau start/end empty saat klik Tampilkan → `alert('Pilih rentang tanggal terlebih dahulu')`, jangan fetch.

## Element Plus Replacement Map

| Old | New |
|---|---|
| `el-card` | div biasa atau `.ns-table-card` |
| `el-row` / `el-col` | flexbox inline style |
| `el-select` | chip dropdown di FilterBar |
| `el-input-number` | native `<input type="number">` |
| `el-date-picker` | native `<input type="date">` |
| `el-button` | `<button class="ns-btn ns-btn-primary">` / `ns-btn-ghost` |
| `el-table` | `ReportTable.vue` |
| `el-icon` + `@element-plus/icons-vue` | `<Icon>` Vue component (Fase 1) |
| `ElMessage.error` | `alert(...)` |
| `ElMessage.warning` | `alert(...)` (jika critical) atau diabaikan |
| `ElMessage.success` | `console.log(...)` |
| `v-loading="loading"` | conditional UI in ReportTable (loading prop) |

## Verifikasi

1. `/bulanan/pidana` → PageHeader "Laporan Bulanan / Perkara Pidana", filter bar (Bulan/Tahun/Format), tabel pidana closed cases di periode default (bulan ini, tahun ini)
2. Klik chip Bulan, pilih "Februari" → state update. Klik "Tampilkan" → tabel re-fetch
3. Klik tombol "Export PDF" → file `Akurasi_Pidana_Februari_2026.pdf` ter-download
4. Switch Format ke DOCX, klik Export → file .docx ter-download
5. Klik sidebar "Perdata" → URL `/bulanan/perdata`, halaman re-fetch otomatis (watch route.params.jenis), title update ke "Perkara Perdata"
6. `/mingguan` → PageHeader "Laporan / Mingguan", filter (Jenis chip + 2 date inputs + Format)
7. Pilih Jenis="Perdata", Mulai=2026-04-01, Akhir=2026-04-30 → klik Tampilkan → tabel update
8. Klik Export — file PDF/DOCX dengan naming `Akurasi_Perdata_01-04-2026_s_d_30-04-2026.pdf`
9. Theme toggle masih kerja, sidebar masih functional
10. `/test-foundation` masih render (Fase 1 verification page)

## Out of scope

- InputView cleanup / hapus route (Fase 5)
- Hapus existing `frontend/src/style.css` lama (Fase 5)
- Hapus `@element-plus/icons-vue` dependency (Fase 5 setelah audit)
- Toast component menggantikan `alert()` (skip, simple alert sudah cukup)
- Animasi transisi route (Fase 5)
- Mobile/responsive breakpoints (Fase 5)
- Replace `lib/export.js` (PDF/DOCX generation tetap pakai existing — battle-tested)
