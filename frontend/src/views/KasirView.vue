<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import PageHeader from '../components/shell/PageHeader.vue'
import Icon from '../components/Icon.vue'
import { generatePenutupanRekapXlsx } from '../lib/api'

const STORAGE_KEY = 'natunasakti-kasir-rekap-v1'

const BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const bukuOptions = [
    'Buku Induk Keuangan Perkara',
    'Buku Keuangan Konsinyasi',
    'Buku Keuangan Biaya/Penawaran Konsinyasi',
    'Buku Keuangan Eksekusi',
    'Buku Keuangan Eksekusi Biaya',
    'Buku Uang Titipan Perkara Pidana',
    'Buku Keuangan PHI',
    'Buku Keuangan Eksekusi PHI',
    'Buku Keuangan Niaga',
    'Buku Keuangan Eksekusi Niaga',
    'Buku Keuangan Delegasi',
    'Buku Keuangan Hasil Lelang',
    'Buku Keuangan Biaya Proses (ATK Perdata)',
    'Buku Keuangan Biaya Proses (ATK PHI)',
    'Buku Keuangan Biaya Proses (ATK Niaga)',
    'Buku Keuangan Lain-Lain'
]

const kategoriOptions = [
    'PNBP',
    'Biaya Pendaftaran',
    'Materai',
    'Biaya Panggilan',
    'Lain-lain'
]

const sheetTabs = [
    { id: 'input', label: 'Sheet 1 Input' },
    { id: 'laporan', label: 'Sheet 2 Laporan' },
    { id: 'rekap', label: 'Sheet 3 Rekap' }
]

const form = reactive({
    bulan: new Date().getMonth() + 1,
    tahun: new Date().getFullYear(),
    tanggalPenutupan: new Date().toISOString().slice(0, 10),
    saldoBank: 0,
    uangTunai: 0,
    materai: 0,
    penjelasan: 'Tidak Ada Selisih'
})

const newRow = reactive({
    tanggal: new Date().toISOString().slice(0, 10),
    buku: bukuOptions[0],
    kategori: 'PNBP',
    nomorPerkara: '',
    uraian: '',
    penerimaan: 0,
    pengeluaran: 0,
    ket: ''
})

const rows = ref([])
const exporting = ref(false)
const activeSheet = ref('input')

const rekap = computed(() => {
    return bukuOptions.map(buku => {
        const related = rows.value.filter(row => row.buku === buku)
        const penerimaan = related.reduce((sum, row) => sum + toNumber(row.penerimaan), 0)
        const pengeluaran = related.reduce((sum, row) => sum + toNumber(row.pengeluaran), 0)
        return {
            buku,
            penerimaan,
            pengeluaran,
            saldo: penerimaan - pengeluaran
        }
    })
})

const totalPenerimaan = computed(() => rekap.value.reduce((sum, row) => sum + row.penerimaan, 0))
const totalPengeluaran = computed(() => rekap.value.reduce((sum, row) => sum + row.pengeluaran, 0))
const saldoPembukuan = computed(() => totalPenerimaan.value - totalPengeluaran.value)
const saldoKas = computed(() => toNumber(form.saldoBank) + toNumber(form.uangTunai) + toNumber(form.materai))
const selisih = computed(() => saldoPembukuan.value - saldoKas.value)
const namaBulan = computed(() => BULAN[form.bulan - 1] || '')

function toNumber(value) {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
}

function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(toNumber(value))
}

function formatDate(iso) {
    if (!iso) return ''
    const date = new Date(iso)
    if (isNaN(date.getTime())) return iso
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

function addRow() {
    if (!newRow.uraian.trim()) {
        alert('Uraian wajib diisi')
        return
    }

    rows.value.push({
        id: Date.now(),
        tanggal: newRow.tanggal,
        buku: newRow.buku,
        kategori: newRow.kategori,
        nomorPerkara: newRow.nomorPerkara.trim(),
        uraian: newRow.uraian.trim(),
        penerimaan: toNumber(newRow.penerimaan),
        pengeluaran: toNumber(newRow.pengeluaran),
        ket: newRow.ket.trim()
    })

    newRow.nomorPerkara = ''
    newRow.uraian = ''
    newRow.penerimaan = 0
    newRow.pengeluaran = 0
    newRow.ket = ''
}

function appendTransaction(overrides) {
    rows.value.push({
        id: Date.now() + Math.random(),
        tanggal: newRow.tanggal,
        buku: newRow.buku,
        kategori: overrides.kategori,
        nomorPerkara: newRow.nomorPerkara.trim(),
        uraian: overrides.uraian,
        penerimaan: toNumber(overrides.penerimaan),
        pengeluaran: toNumber(overrides.pengeluaran),
        ket: overrides.ket || ''
    })
}

function addBiayaPerkaraMasuk() {
    appendTransaction({ kategori: 'PNBP', uraian: 'PNBP', penerimaan: 30000, pengeluaran: 0, ket: 'Auto biaya perkara masuk' })
    appendTransaction({ kategori: 'Biaya Pendaftaran', uraian: 'Biaya Pendaftaran', penerimaan: 50000, pengeluaran: 0, ket: 'Auto biaya perkara masuk' })
}

function addMaterai() {
    appendTransaction({ kategori: 'Materai', uraian: 'Materai', penerimaan: 10000, pengeluaran: 0, ket: 'Auto materai' })
}

function prepareBiayaPanggilan() {
    newRow.kategori = 'Biaya Panggilan'
    newRow.uraian = 'Biaya Panggilan'
    newRow.penerimaan = 0
    newRow.pengeluaran = 0
}

function removeRow(id) {
    rows.value = rows.value.filter(row => row.id !== id)
}

function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, rows: rows.value }))
}

function loadLocal() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
        const parsed = JSON.parse(raw)
        Object.assign(form, parsed.form || {})
        rows.value = Array.isArray(parsed.rows) ? parsed.rows : []
    } catch {
        rows.value = []
    }
}

function resetData() {
    if (!confirm('Kosongkan data rekap kasir?')) return
    rows.value = []
    form.saldoBank = 0
    form.uangTunai = 0
    form.materai = 0
    form.penjelasan = 'Tidak Ada Selisih'
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

async function exportExcel() {
    exporting.value = true
    try {
        const blob = await generatePenutupanRekapXlsx({
            bulanNama: namaBulan.value,
            tahun: form.tahun,
            rows: rows.value
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `REKAP_KASIR_${namaBulan.value.toUpperCase()}_${form.tahun}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
    } finally {
        exporting.value = false
    }
}

watch([form, rows], saveLocal, { deep: true })
onMounted(loadLocal)
</script>

<template>
    <div class="ns-kasir-view">
        <PageHeader
            eyebrow="Kasir"
            title="Rekap Excel Kasir"
            sub="Pendataan uang kasir, rekap saldo, dan export Excel penutupan."
        >
            <div class="ns-c-page-stats-strip">
                <div class="ns-c-strip-item">
                    <span class="ns-c-strip-label">Penerimaan</span>
                    <span class="ns-c-strip-value">{{ formatCurrency(totalPenerimaan) }}</span>
                </div>
                <div class="ns-c-strip-item">
                    <span class="ns-c-strip-label">Pengeluaran</span>
                    <span class="ns-c-strip-value">{{ formatCurrency(totalPengeluaran) }}</span>
                </div>
            </div>
        </PageHeader>

        <section class="ns-kasir-grid">
            <div class="ns-panel">
                <div class="ns-panel-title">Periode & Saldo Kas</div>
                <div class="ns-form-grid">
                    <label>
                        <span>Bulan</span>
                        <select v-model.number="form.bulan">
                            <option v-for="(b, idx) in BULAN" :key="b" :value="idx + 1">{{ b }}</option>
                        </select>
                    </label>
                    <label>
                        <span>Tahun</span>
                        <input v-model.number="form.tahun" type="number">
                    </label>
                    <label>
                        <span>Tanggal Penutupan</span>
                        <input v-model="form.tanggalPenutupan" type="date">
                    </label>
                    <label>
                        <span>Saldo Bank</span>
                        <input v-model.number="form.saldoBank" type="number" min="0">
                    </label>
                    <label>
                        <span>Uang Tunai</span>
                        <input v-model.number="form.uangTunai" type="number" min="0">
                    </label>
                    <label>
                        <span>Materai</span>
                        <input v-model.number="form.materai" type="number" min="0">
                    </label>
                    <label class="is-wide">
                        <span>Penjelasan Selisih</span>
                        <input v-model="form.penjelasan" type="text">
                    </label>
                </div>
            </div>

            <div class="ns-panel ns-summary">
                <div>
                    <span>Saldo Pembukuan</span>
                    <strong>{{ formatCurrency(saldoPembukuan) }}</strong>
                </div>
                <div>
                    <span>Saldo Kas</span>
                    <strong>{{ formatCurrency(saldoKas) }}</strong>
                </div>
                <div>
                    <span>Selisih</span>
                    <strong :class="{ danger: selisih !== 0 }">{{ formatCurrency(selisih) }}</strong>
                </div>
            </div>
        </section>

        <section class="ns-panel ns-excel-toolbar">
            <div class="ns-panel-title">Menu Cepat Excel</div>
            <div class="ns-quick-actions">
                <button class="ns-btn ns-btn-primary" @click="addBiayaPerkaraMasuk">
                    <Icon name="filePlus" :size="14" />
                    Biaya Perkara Masuk
                </button>
                <button class="ns-btn ns-btn-ghost" @click="addMaterai">
                    <Icon name="filePlus" :size="14" />
                    Materai 10.000
                </button>
                <button class="ns-btn ns-btn-ghost" @click="prepareBiayaPanggilan">
                    <Icon name="filePlus" :size="14" />
                    Biaya Panggilan
                </button>
            </div>
        </section>

        <nav class="ns-sheet-tabs" aria-label="Sheet rekap kasir">
            <button
                v-for="tab in sheetTabs"
                :key="tab.id"
                type="button"
                :class="{ active: activeSheet === tab.id }"
                @click="activeSheet = tab.id"
            >
                {{ tab.label }}
            </button>
        </nav>

        <section class="ns-panel">
            <div class="ns-panel-title">Sheet 1 Input Transaksi</div>
            <div class="ns-transaction-form">
                <input v-model="newRow.tanggal" type="date">
                <select v-model="newRow.buku">
                    <option v-for="buku in bukuOptions" :key="buku" :value="buku">{{ buku }}</option>
                </select>
                <select v-model="newRow.kategori">
                    <option v-for="kategori in kategoriOptions" :key="kategori" :value="kategori">{{ kategori }}</option>
                </select>
                <input v-model="newRow.nomorPerkara" type="text" placeholder="Nomor perkara">
                <input v-model="newRow.uraian" type="text" placeholder="Uraian">
                <input v-model.number="newRow.penerimaan" type="number" min="0" placeholder="Penerimaan">
                <input v-model.number="newRow.pengeluaran" type="number" min="0" placeholder="Pengeluaran">
                <input v-model="newRow.ket" type="text" placeholder="Ket">
                <button class="ns-btn ns-btn-primary" @click="addRow">
                    <Icon name="filePlus" :size="14" />
                    Tambah
                </button>
            </div>
        </section>

        <div class="ns-actions">
            <button class="ns-btn ns-btn-ghost" @click="resetData">
                <Icon name="trash" :size="14" />
                Kosongkan
            </button>
            <button class="ns-btn ns-btn-primary" :disabled="exporting || !rows.length" @click="exportExcel">
                <Icon name="download" :size="14" />
                {{ exporting ? 'Exporting...' : 'Export Excel' }}
            </button>
        </div>

        <section v-show="activeSheet === 'rekap'" class="ns-panel">
            <div class="ns-panel-title">Sheet 3 Rekap Per Buku</div>
            <div class="ns-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Buku</th>
                            <th>Penerimaan</th>
                            <th>Pengeluaran</th>
                            <th>Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in rekap" :key="row.buku">
                            <td>{{ row.buku }}</td>
                            <td>{{ formatCurrency(row.penerimaan) }}</td>
                            <td>{{ formatCurrency(row.pengeluaran) }}</td>
                            <td>{{ formatCurrency(row.saldo) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section v-show="activeSheet === 'input'" class="ns-panel">
            <div class="ns-panel-title">Sheet 1 Input</div>
            <div class="ns-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Tanggal</th>
                            <th>Buku</th>
                            <th>Kategori</th>
                            <th>Nomor Perkara</th>
                            <th>Uraian</th>
                            <th>Penerimaan</th>
                            <th>Pengeluaran</th>
                            <th>Ket</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="!rows.length">
                            <td colspan="10" class="ns-empty">Belum ada transaksi</td>
                        </tr>
                        <tr v-for="(row, idx) in rows" :key="row.id">
                            <td>{{ idx + 1 }}</td>
                            <td>{{ formatDate(row.tanggal) }}</td>
                            <td>{{ row.buku }}</td>
                            <td>{{ row.kategori || '-' }}</td>
                            <td>{{ row.nomorPerkara || '-' }}</td>
                            <td>{{ row.uraian }}</td>
                            <td>{{ formatCurrency(row.penerimaan) }}</td>
                            <td>{{ formatCurrency(row.pengeluaran) }}</td>
                            <td>{{ row.ket || '-' }}</td>
                            <td>
                                <button class="ns-icon-btn" @click="removeRow(row.id)" title="Hapus">
                                    <Icon name="trash" :size="14" />
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section v-show="activeSheet === 'laporan'" class="ns-panel">
            <div class="ns-panel-title">Sheet 2 Laporan Mengikuti Sheet 1</div>
            <div class="ns-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Uraian Laporan</th>
                            <th>Penerimaan</th>
                            <th>Pengeluaran</th>
                            <th>Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="!rows.length">
                            <td colspan="5" class="ns-empty">Sheet 2 akan terisi dari Sheet 1</td>
                        </tr>
                        <tr v-for="(row, idx) in rows" :key="`lap-${row.id}`">
                            <td>{{ idx + 1 }}</td>
                            <td>{{ row.uraian }}</td>
                            <td>{{ formatCurrency(row.penerimaan) }}</td>
                            <td>{{ formatCurrency(row.pengeluaran) }}</td>
                            <td>{{ formatCurrency(toNumber(row.penerimaan) - toNumber(row.pengeluaran)) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </div>
</template>

<style scoped>
.ns-kasir-view {
    display: grid;
    gap: 16px;
}

.ns-kasir-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 16px;
    align-items: stretch;
}

.ns-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
}

.ns-panel-title {
    margin-bottom: 12px;
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
}

.ns-form-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

label {
    display: grid;
    gap: 6px;
    color: var(--text2);
    font-size: 12px;
}

label.is-wide {
    grid-column: 1 / -1;
}

input,
select {
    width: 100%;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0 10px;
    background: var(--bg);
    color: var(--text);
    outline: none;
}

.ns-summary {
    display: grid;
    gap: 12px;
    align-content: center;
}

.ns-summary div {
    display: grid;
    gap: 4px;
}

.ns-summary span {
    color: var(--text3);
    font-size: 12px;
}

.ns-summary strong {
    color: var(--text);
    font-size: 20px;
}

.ns-summary strong.danger {
    color: var(--danger, #dc2626);
}

.ns-excel-toolbar {
    display: grid;
    gap: 10px;
}

.ns-quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.ns-sheet-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
}

.ns-sheet-tabs button {
    height: 34px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--text2);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}

.ns-sheet-tabs button.active {
    color: var(--accent);
    background: var(--accentSoft);
    border-color: var(--accent);
}

.ns-transaction-form {
    display: grid;
    grid-template-columns: 140px 220px 170px 160px minmax(180px, 1fr) 120px 120px 120px auto;
    gap: 8px;
}

.ns-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.ns-table-wrap {
    overflow-x: auto;
}

table {
    width: 100%;
    min-width: 900px;
    border-collapse: collapse;
    font-size: 12px;
}

th,
td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: top;
}

th {
    color: var(--text3);
    background: var(--bg-2);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
}

td {
    color: var(--text);
}

.ns-empty {
    height: 90px;
    text-align: center;
    color: var(--text3);
}

.ns-icon-btn {
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--surface);
    color: var(--text2);
    cursor: pointer;
}

.ns-icon-btn:hover {
    color: var(--danger, #dc2626);
    border-color: currentColor;
}

@media (max-width: 1200px) {
    .ns-kasir-grid {
        grid-template-columns: 1fr;
    }

    .ns-transaction-form {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 700px) {
    .ns-form-grid,
    .ns-transaction-form {
        grid-template-columns: 1fr;
    }
}
</style>
