# Redesign Fase 4 — Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `BulananView` dan `MingguanView` ke design language baru — Element Plus dihapus, ganti komponen custom (ReportTable + 2 FilterBar). PDF/DOCX export tetap pakai existing `lib/export.js`.

**Architecture:** 3 komponen baru di `frontend/src/components/report/`. View di-rewrite total. Filter chip pattern dari Fase 3 (DataView) di-reuse. Native `<input type="date">` dan `<input type="number">` ganti el-date-picker dan el-input-number.

**Tech Stack:** Vue 3 Composition API, vue-router, native HTML inputs.

**Sebelum mulai:** pastikan Vite dev server di port 5173 jalan.

---

### Task 1: `ReportTable.vue` shared component

**Files:**
- Create: `frontend/src/components/report/ReportTable.vue`

- [ ] **Step 1: Buat folder + file**

```bash
mkdir -p "C:\Users\faris\Documents\natunasakti\frontend\src\components\report"
```

Create `frontend/src/components/report/ReportTable.vue` with EXACTLY this content:

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

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/report/ReportTable.vue && git commit -m "feat(report): ReportTable shared component"
```

---

### Task 2: `BulananFilterBar.vue`

**Files:**
- Create: `frontend/src/components/report/BulananFilterBar.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/report/BulananFilterBar.vue` with EXACTLY this content:

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

defineProps({
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

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/report/BulananFilterBar.vue && git commit -m "feat(report): BulananFilterBar with chip dropdowns"
```

---

### Task 3: `MingguanFilterBar.vue`

**Files:**
- Create: `frontend/src/components/report/MingguanFilterBar.vue`

- [ ] **Step 1: Buat file**

Create `frontend/src/components/report/MingguanFilterBar.vue` with EXACTLY this content:

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Icon from '../Icon.vue'

defineProps({
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

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -5 || echo "no errors"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/components/report/MingguanFilterBar.vue && git commit -m "feat(report): MingguanFilterBar with native date inputs"
```

---

### Task 4: `BulananView.vue` rewrite

**Files:**
- Modify: `frontend/src/views/BulananView.vue` — replace entire file

- [ ] **Step 1: Replace BulananView.vue**

Replace entire content of `C:\Users\faris\Documents\natunasakti\frontend\src\views\BulananView.vue` with:

```vue
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/shell/PageHeader.vue'
import BulananFilterBar from '../components/report/BulananFilterBar.vue'
import ReportTable from '../components/report/ReportTable.vue'
import { getPerkaraByMonth } from '../lib/api'
import { generateBulananPDF, downloadPDF, generateBulananDOCX, downloadDOCX } from '../lib/export'

const BULAN_NAMA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const route = useRoute()

const jenisCanonical = computed(() => {
    const j = (route.params.jenis || 'pidana').toLowerCase()
    return j.charAt(0).toUpperCase() + j.slice(1)
})

const bulan = ref(new Date().getMonth() + 1)
const tahun = ref(new Date().getFullYear())
const format = ref('pdf')
const rows = ref([])
const loading = ref(false)
const exporting = ref(false)

async function fetchData() {
    loading.value = true
    try {
        const data = await getPerkaraByMonth(bulan.value, tahun.value, { jenis_perkara: jenisCanonical.value })
        rows.value = Array.isArray(data) ? data : []
    } catch (err) {
        console.error('Fetch failed:', err.message)
        alert('Gagal mengambil data: ' + err.message)
    } finally {
        loading.value = false
    }
}

async function handleExport() {
    if (!rows.value.length) {
        alert('Tidak ada data untuk diekspor')
        return
    }
    exporting.value = true
    try {
        const filenameBase = `Akurasi_${jenisCanonical.value}_${BULAN_NAMA[bulan.value - 1]}_${tahun.value}`
        if (format.value === 'pdf') {
            const doc = generateBulananPDF(rows.value, {
                bulan: bulan.value, tahun: tahun.value, jenisPerkara: jenisCanonical.value
            })
            downloadPDF(doc, `${filenameBase}.pdf`)
        } else {
            const doc = await generateBulananDOCX(rows.value, {
                bulan: bulan.value, tahun: tahun.value, jenisPerkara: jenisCanonical.value
            })
            await downloadDOCX(doc, `${filenameBase}.docx`)
        }
        console.log(`File ${format.value.toUpperCase()} berhasil dibuat`)
    } catch (err) {
        console.error('Export failed:', err.message)
        alert('Gagal membuat file: ' + err.message)
    } finally {
        exporting.value = false
    }
}

watch(() => route.params.jenis, () => fetchData())

onMounted(fetchData)
</script>

<template>
    <div>
        <PageHeader
            eyebrow="Laporan Bulanan"
            :title="`Perkara ${jenisCanonical}`"
            sub="Rekapitulasi bulanan perkara yang sudah putus."
        >
            <div class="ns-c-page-stats-strip">
                <div class="ns-c-strip-item">
                    <span class="ns-c-strip-label">Total</span>
                    <span class="ns-c-strip-value">{{ rows.length }}</span>
                </div>
            </div>
        </PageHeader>

        <BulananFilterBar
            v-model:bulan="bulan"
            v-model:tahun="tahun"
            v-model:format="format"
            :loading="loading"
            :exporting="exporting"
            :can-export="rows.length > 0"
            @fetch="fetchData"
            @export="handleExport"
        />

        <ReportTable :rows="rows" :loading="loading" />
    </div>
</template>
```

(All Element Plus components removed.)

- [ ] **Step 2: Verify Vite kompilasi**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -10 || echo "no errors"
```

- [ ] **Step 3: Verify routes still work**

```bash
PORT=5173
for path in "/bulanan/pidana" "/bulanan/perdata" "/bulanan/perikanan"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$path" --max-time 3)
  echo "$path → $status"
done
```

Expected: each returns 200.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/views/BulananView.vue && git commit -m "feat: BulananView rewrite with new design"
```

---

### Task 5: `MingguanView.vue` rewrite + push semua

**Files:**
- Modify: `frontend/src/views/MingguanView.vue` — replace entire file

- [ ] **Step 1: Replace MingguanView.vue**

Replace entire content of `C:\Users\faris\Documents\natunasakti\frontend\src\views\MingguanView.vue` with:

```vue
<script setup>
import { ref } from 'vue'
import PageHeader from '../components/shell/PageHeader.vue'
import MingguanFilterBar from '../components/report/MingguanFilterBar.vue'
import ReportTable from '../components/report/ReportTable.vue'
import { getPerkaraByDateRange } from '../lib/api'
import { generateMingguanPDF, downloadPDF, generateMingguanDOCX, downloadDOCX } from '../lib/export'

const jenis = ref('Perdata')
const start = ref('')
const end = ref('')
const format = ref('pdf')
const rows = ref([])
const loading = ref(false)
const exporting = ref(false)

function formatDateForFilename(s) {
    if (!s) return ''
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}-${mm}-${d.getFullYear()}`
}

async function fetchData() {
    if (!start.value || !end.value) {
        alert('Pilih rentang tanggal terlebih dahulu')
        return
    }
    loading.value = true
    try {
        const data = await getPerkaraByDateRange(start.value, end.value, { jenis_perkara: jenis.value })
        rows.value = Array.isArray(data) ? data : []
    } catch (err) {
        console.error('Fetch failed:', err.message)
        alert('Gagal mengambil data: ' + err.message)
    } finally {
        loading.value = false
    }
}

async function handleExport() {
    if (!rows.value.length) {
        alert('Tidak ada data untuk diekspor')
        return
    }
    exporting.value = true
    try {
        const startStr = formatDateForFilename(start.value)
        const endStr = formatDateForFilename(end.value)
        const filenameBase = `Akurasi_${jenis.value}_${startStr}_s_d_${endStr}`
        if (format.value === 'pdf') {
            const doc = generateMingguanPDF(rows.value, {
                startDate: start.value, endDate: end.value, jenisPerkara: jenis.value
            })
            downloadPDF(doc, `${filenameBase}.pdf`)
        } else {
            const doc = await generateMingguanDOCX(rows.value, {
                startDate: start.value, endDate: end.value, jenisPerkara: jenis.value
            })
            await downloadDOCX(doc, `${filenameBase}.docx`)
        }
        console.log(`File ${format.value.toUpperCase()} berhasil dibuat`)
    } catch (err) {
        console.error('Export failed:', err.message)
        alert('Gagal membuat file: ' + err.message)
    } finally {
        exporting.value = false
    }
}
</script>

<template>
    <div>
        <PageHeader
            eyebrow="Laporan"
            title="Mingguan"
            sub="Rekapitulasi per rentang tanggal."
        >
            <div class="ns-c-page-stats-strip">
                <div class="ns-c-strip-item">
                    <span class="ns-c-strip-label">Total</span>
                    <span class="ns-c-strip-value">{{ rows.length }}</span>
                </div>
            </div>
        </PageHeader>

        <MingguanFilterBar
            v-model:jenis="jenis"
            v-model:start="start"
            v-model:end="end"
            v-model:format="format"
            :loading="loading"
            :exporting="exporting"
            :can-export="rows.length > 0"
            @fetch="fetchData"
            @export="handleExport"
        />

        <ReportTable :rows="rows" :loading="loading" />
    </div>
</template>
```

- [ ] **Step 2: Verify**

```bash
sleep 2 && grep -iE "error|fail" "C:\Users\faris\Documents\natunasakti\frontend\dev.log" | tail -10 || echo "no errors"
```

- [ ] **Step 3: Verify route**

```bash
curl -s -o /dev/null -w "/mingguan → %{http_code}\n" "http://localhost:5173/mingguan" --max-time 3
```

Expected: 200.

- [ ] **Step 4: Commit MingguanView**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add frontend/src/views/MingguanView.vue && git commit -m "feat: MingguanView rewrite with new design"
```

- [ ] **Step 5: Confirm 5 commits ahead, push**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git log --oneline origin/master..HEAD
```

Should show exactly 5 commits (Tasks 1-5). Then:

```bash
git push origin master
```

- [ ] **Step 6: Commit + push spec & plan**

```bash
cd "C:\Users\faris\Documents\natunasakti" && git add docs/superpowers/specs/2026-05-08-redesign-fase-4-reports-design.md docs/superpowers/plans/2026-05-08-redesign-fase-4-reports.md && git commit -m "docs: spec and plan for redesign fase 4 reports"
```

```bash
git push origin master
```
