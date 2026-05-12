<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/shell/PageHeader.vue'
import Icon from '../components/Icon.vue'
import { downloadKasirTemplate, generatePenutupanKasRtf } from '../lib/api'

const route = useRoute()
const downloading = ref(false)

const templates = {
    'pemeriksaan-mendadak': {
        eyebrow: 'Kasir',
        title: 'Pemeriksaan Mendadak',
        description: 'Template berita acara pemeriksaan kas keuangan perkara.',
        filename: 'BERITA_ACARA_PEMERIKSAAN_MENDADAK.docx',
        type: 'DOCX',
        items: [
            'Tanggal pemeriksaan',
            'Saldo buku dan saldo kas',
            'Tanda tangan kasir, panitera, dan ketua'
        ]
    },
    'penutupan-kas': {
        eyebrow: 'Kasir',
        title: 'Penutupan Kas',
        description: 'Template RTF penutupan kas bulanan.',
        filename: 'PENUTUPAN_KAS_TEMPLATE.rtf',
        type: 'RTF',
        items: [
            'Bulan penutupan kas',
            'Rincian saldo pembukuan dan saldo kas',
            'Penjelasan selisih'
        ]
    }
}

const active = computed(() => templates[route.params.template] || templates['pemeriksaan-mendadak'])
const isPenutupanKas = computed(() => route.params.template === 'penutupan-kas')

const BULAN = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const bukuRows = ref([
    'Buku Induk Keuangan Perkara',
    'Buku Keuangan Konsinyasi',
    'Buku Keuangan Eksekusi'
].map((nama, idx) => ({
    no: idx + 1,
    nama,
    saldoLalu: 0,
    penerimaan: 0,
    pengeluaran: 0,
    kas: 0
})))

const penutupan = reactive({
    bulan: new Date().getMonth() + 1,
    tahun: new Date().getFullYear(),
    tanggalPemeriksaan: new Date().toISOString().slice(0, 10),
    tanggalBank: new Date().toISOString().slice(0, 10),
    saldoBank: 0,
    materai: 0,
    penjelasan: 'Tidak Ada Selisih'
})

const totalSaldoLalu = computed(() => bukuRows.value.reduce((sum, row) => sum + numberValue(row.saldoLalu), 0))
const totalPenerimaan = computed(() => bukuRows.value.reduce((sum, row) => sum + numberValue(row.penerimaan), 0))
const totalPengeluaran = computed(() => bukuRows.value.reduce((sum, row) => sum + numberValue(row.pengeluaran), 0))
const totalPembukuan = computed(() => bukuRows.value.reduce((sum, row) => sum + saldoBuku(row), 0))
const totalKasBuku = computed(() => bukuRows.value.reduce((sum, row) => sum + numberValue(row.kas), 0))
const totalKas = computed(() => totalKasBuku.value + numberValue(penutupan.saldoBank) + numberValue(penutupan.materai))
const selisih = computed(() => totalPembukuan.value - totalKas.value)
const bulanNama = computed(() => BULAN[penutupan.bulan - 1] || '')

function numberValue(value) {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
}

function roundToThousands(target, key) {
    target[key] = Math.round(numberValue(target[key]) / 1000) * 1000
}

function saldoBuku(row) {
    return numberValue(row.saldoLalu) + numberValue(row.penerimaan) - numberValue(row.pengeluaran)
}

function rupiah(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2
    }).format(numberValue(value))
}

function tanggalPanjang(iso) {
    const date = new Date(iso)
    if (isNaN(date.getTime())) return iso || ''
    return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })
}

function tanggalTanpaHari(iso) {
    const date = new Date(iso)
    if (isNaN(date.getTime())) return iso || ''
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })
}

async function exportPenutupanKas() {
    downloading.value = true
    try {
        const blob = await generatePenutupanKasRtf({
            ...penutupan,
            bulanNama: bulanNama.value,
            bukuRows: bukuRows.value
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `PENUTUPAN_KAS_${bulanNama.value.toUpperCase()}_${penutupan.tahun}.rtf`
        a.click()
        URL.revokeObjectURL(url)
    } catch (err) {
        alert('Gagal generate RTF: ' + err.message)
    } finally {
        downloading.value = false
    }
}

async function downloadTemplate() {
    downloading.value = true
    try {
        const blob = await downloadKasirTemplate(route.params.template)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = active.value.filename
        a.click()
        URL.revokeObjectURL(url)
    } catch (err) {
        alert('Gagal mengunduh template: ' + err.message)
    } finally {
        downloading.value = false
    }
}
</script>

<template>
    <div>
        <PageHeader
            :eyebrow="active.eyebrow"
            :title="active.title"
            :sub="active.description"
        >
            <div class="ns-c-page-stats-strip">
                <div class="ns-c-strip-item">
                    <span class="ns-c-strip-label">Format</span>
                    <span class="ns-c-strip-value">{{ active.type }}</span>
                </div>
            </div>
        </PageHeader>

        <section v-if="!isPenutupanKas" class="ns-template-panel">
            <div class="ns-template-main">
                <div class="ns-template-icon">
                    <Icon name="fileCheck" :size="28" />
                </div>
                <div>
                    <h2>{{ active.filename }}</h2>
                    <p>Template awal disimpan di backend dan bisa dipakai sebagai dasar output umum.</p>
                </div>
            </div>

            <div class="ns-template-list">
                <div v-for="item in active.items" :key="item" class="ns-template-item">
                    <Icon name="check" :size="14" />
                    <span>{{ item }}</span>
                </div>
            </div>

            <button class="ns-btn ns-btn-primary" :disabled="downloading" @click="downloadTemplate">
                <Icon name="download" :size="14" />
                {{ downloading ? 'Mengunduh...' : 'Download Template' }}
            </button>
        </section>

        <template v-else>
            <section class="ns-penutupan-panel">
                <div class="ns-section-title">Periode Pemeriksaan</div>
                <div class="ns-form-grid">
                    <label>
                        <span>Bulan</span>
                        <select v-model.number="penutupan.bulan">
                            <option v-for="(bulan, idx) in BULAN" :key="bulan" :value="idx + 1">{{ bulan }}</option>
                        </select>
                    </label>
                    <label>
                        <span>Tahun</span>
                        <input v-model.number="penutupan.tahun" type="number">
                    </label>
                    <label>
                        <span>Tanggal Pemeriksaan</span>
                        <input v-model="penutupan.tanggalPemeriksaan" type="date">
                    </label>
                    <label>
                        <span>Tanggal Saldo Bank</span>
                        <input v-model="penutupan.tanggalBank" type="date">
                    </label>
                    <label>
                        <span>Saldo Bank</span>
                        <input
                            v-model.number="penutupan.saldoBank"
                            type="number"
                            min="0"
                            step="1000"
                            @change="roundToThousands(penutupan, 'saldoBank')"
                        >
                    </label>
                    <label>
                        <span>Materai</span>
                        <input
                            v-model.number="penutupan.materai"
                            type="number"
                            min="0"
                            step="1000"
                            @change="roundToThousands(penutupan, 'materai')"
                        >
                    </label>
                    <label class="is-wide">
                        <span>Penjelasan Selisih</span>
                        <input v-model="penutupan.penjelasan" type="text">
                    </label>
                </div>
            </section>

            <section class="ns-summary-grid">
                <div>
                    <span>Total Saldo Lalu</span>
                    <strong>{{ rupiah(totalSaldoLalu) }}</strong>
                </div>
                <div>
                    <span>Penerimaan</span>
                    <strong>{{ rupiah(totalPenerimaan) }}</strong>
                </div>
                <div>
                    <span>Pengeluaran</span>
                    <strong>{{ rupiah(totalPengeluaran) }}</strong>
                </div>
                <div>
                    <span>Selisih</span>
                    <strong :class="{ danger: selisih !== 0 }">{{ rupiah(selisih) }}</strong>
                </div>
            </section>

            <section class="ns-penutupan-panel">
                <div class="ns-section-title">Rincian Menurut Buku</div>
                <div class="ns-book-table-wrap">
                    <table class="ns-book-table">
                        <thead>
                            <tr>
                                <th>Buku</th>
                                <th>Saldo Lalu</th>
                                <th>Penerimaan</th>
                                <th>Pengeluaran</th>
                                <th>Jumlah Buku</th>
                                <th>Kas Fisik</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in bukuRows" :key="row.nama">
                                <td>{{ row.no }}. {{ row.nama }}</td>
                                <td><input v-model.number="row.saldoLalu" type="number" step="1000" @change="roundToThousands(row, 'saldoLalu')"></td>
                                <td><input v-model.number="row.penerimaan" type="number" step="1000" @change="roundToThousands(row, 'penerimaan')"></td>
                                <td><input v-model.number="row.pengeluaran" type="number" step="1000" @change="roundToThousands(row, 'pengeluaran')"></td>
                                <td>{{ rupiah(saldoBuku(row)) }}</td>
                                <td><input v-model.number="row.kas" type="number" step="1000" @change="roundToThousands(row, 'kas')"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <div class="ns-template-actions">
                <button class="ns-btn ns-btn-ghost" :disabled="downloading" @click="downloadTemplate">
                    <Icon name="download" :size="14" />
                    Template Asli
                </button>
                <button class="ns-btn ns-btn-primary" @click="exportPenutupanKas">
                    <Icon name="filePlus" :size="14" />
                    Generate RTF
                </button>
            </div>
        </template>
    </div>
</template>

<style scoped>
.ns-template-panel {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 760px;
    padding: 18px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
}

.ns-template-main {
    display: flex;
    gap: 14px;
    align-items: flex-start;
}

.ns-template-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    color: var(--accent);
    background: var(--accentSoft);
}

.ns-template-main h2 {
    margin: 0 0 6px;
    font-size: 18px;
    color: var(--text);
}

.ns-template-main p {
    margin: 0;
    color: var(--text2);
    font-size: 13px;
}

.ns-template-list {
    display: grid;
    gap: 8px;
}

.ns-template-item {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text2);
    font-size: 13px;
}

.ns-penutupan-panel {
    margin-bottom: 16px;
    padding: 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
}

.ns-section-title {
    margin-bottom: 12px;
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
}

.ns-form-grid,
.ns-sign-grid {
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
    height: 34px;
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 0 9px;
    background: var(--bg);
    color: var(--text);
    outline: none;
}

.ns-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
}

.ns-summary-grid div {
    display: grid;
    gap: 5px;
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
}

.ns-summary-grid span {
    color: var(--text3);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
}

.ns-summary-grid strong {
    color: var(--text);
    font-size: 18px;
}

.ns-summary-grid strong.danger {
    color: var(--danger, #dc2626);
}

.ns-book-table-wrap {
    overflow-x: auto;
}

.ns-book-table {
    width: 100%;
    min-width: 980px;
    border-collapse: collapse;
    font-size: 12px;
}

.ns-book-table th,
.ns-book-table td {
    padding: 9px 10px;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: middle;
}

.ns-book-table th {
    background: var(--bg-2);
    color: var(--text3);
    font-size: 11px;
    text-transform: uppercase;
}

.ns-book-table td:first-child {
    min-width: 280px;
    color: var(--text);
    font-weight: 500;
}

.ns-template-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

@media (max-width: 900px) {
    .ns-form-grid,
    .ns-sign-grid,
    .ns-summary-grid {
        grid-template-columns: 1fr;
    }
}
</style>
