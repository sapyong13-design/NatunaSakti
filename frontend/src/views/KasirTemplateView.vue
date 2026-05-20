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

const kasTunaiRows = ref([
    { nominal: 100000, jenis: 'Uang Kertas', satuan: 'lembar', jumlah: 0 },
    { nominal: 50000, jenis: 'Uang Kertas', satuan: 'lembar', jumlah: 0 },
    { nominal: 20000, jenis: 'Uang Kertas', satuan: 'lembar', jumlah: 0 },
    { nominal: 10000, jenis: 'Uang Kertas', satuan: 'lembar', jumlah: 0 },
    { nominal: 5000, jenis: 'Uang Kertas', satuan: 'lembar', jumlah: 0 },
    { nominal: 2000, jenis: 'Uang Kertas', satuan: 'lembar', jumlah: 0 },
    { nominal: 1000, jenis: 'Uang Kertas', satuan: 'lembar', jumlah: 0 },
    { nominal: 500, jenis: 'Uang Logam', satuan: 'koin', jumlah: 0 },
    { nominal: 200, jenis: 'Uang Logam', satuan: 'koin', jumlah: 0 },
    { nominal: 100, jenis: 'Uang Logam', satuan: 'koin', jumlah: 0 }
])

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
const totalKasTunai = computed(() => kasTunaiRows.value.reduce((sum, row) => sum + totalPecahan(row), 0))
const totalKas = computed(() => totalKasTunai.value + numberValue(penutupan.saldoBank) + numberValue(penutupan.materai))
const selisih = computed(() => totalPembukuan.value - totalKas.value)
const bulanNama = computed(() => BULAN[penutupan.bulan - 1] || '')
const bukuRomanRows = computed(() => bukuRows.value.map((row, index) => ({
    roman: ['I', 'II', 'III'][index],
    index,
    title: row.nama,
    saldoLalu: numberValue(row.saldoLalu),
    penerimaan: numberValue(row.penerimaan),
    pengeluaran: numberValue(row.pengeluaran),
    jumlah: saldoBuku(row)
})))

function numberValue(value) {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
}

function roundToThousands(target, key) {
    target[key] = Math.round(numberValue(target[key]) / 1000) * 1000
}

function normalizeCount(row) {
    row.jumlah = Math.max(0, Math.floor(numberValue(row.jumlah)))
}

function saldoBuku(row) {
    return numberValue(row.saldoLalu) + numberValue(row.penerimaan) - numberValue(row.pengeluaran)
}

function totalPecahan(row) {
    return numberValue(row.nominal) * Math.max(0, Math.floor(numberValue(row.jumlah)))
}

function rupiah(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2
    }).format(numberValue(value))
}

function rupiahRingkas(value) {
    return `Rp${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0
    }).format(numberValue(value))}`
}

function cashLetter(index) {
    return `${String.fromCharCode(97 + index)}.`
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
            bukuRows: bukuRows.value,
            kasTunaiRows: kasTunaiRows.value.map(row => ({
                nominal: row.nominal,
                jumlah: Math.max(0, Math.floor(numberValue(row.jumlah)))
            }))
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
                {{ downloading ? 'Mengunduh…' : 'Download Template' }}
            </button>
        </section>

        <template v-else>
            <div class="ns-document-stack">
                <section class="ns-document-page">
                    <div class="ns-document-page-head">
                        <span>Halaman 1</span>
                        <strong>Berita Acara Laporan Keuangan Perkara</strong>
                    </div>

                    <div class="ns-form-grid ns-period-grid">
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
                    </div>

                    <div class="ns-roman-list">
                        <div v-for="row in bukuRomanRows" :key="row.roman" class="ns-roman-row">
                            <div class="ns-roman-title">{{ row.roman }}. {{ row.title }}</div>
                            <div class="ns-roman-fields">
                                <label>
                                    <span>Saldo awal bulan {{ bulanNama }}</span>
                                    <input v-model.number="bukuRows[row.index].saldoLalu" type="number" step="1000" @change="roundToThousands(bukuRows[row.index], 'saldoLalu')">
                                </label>
                                <label>
                                    <span>Penerimaan</span>
                                    <input v-model.number="bukuRows[row.index].penerimaan" type="number" step="1000" @change="roundToThousands(bukuRows[row.index], 'penerimaan')">
                                </label>
                                <label>
                                    <span>Pengeluaran</span>
                                    <input v-model.number="bukuRows[row.index].pengeluaran" type="number" step="1000" @change="roundToThousands(bukuRows[row.index], 'pengeluaran')">
                                </label>
                                <div class="ns-readonly-total">
                                    <span>Jumlah</span>
                                    <strong>{{ rupiah(row.jumlah) }}</strong>
                                </div>
                            </div>
                        </div>

                        <div class="ns-roman-row">
                            <div class="ns-roman-title">IV. Saldo Pembukuan</div>
                            <div class="ns-finance-line">
                                <span>I + II + III</span>
                                <strong>{{ rupiah(totalPembukuan) }}</strong>
                            </div>
                            <div class="ns-subsection">
                                <span>Menurut Kas</span>
                                <div>1. Uang tunai <strong>{{ rupiah(totalKasTunai) }}</strong></div>
                                <label>
                                    <span>2. Saldo Bank</span>
                                    <input v-model.number="penutupan.saldoBank" type="number" min="0" step="1000" @change="roundToThousands(penutupan, 'saldoBank')">
                                </label>
                                <label>
                                    <span>3. Materai</span>
                                    <input v-model.number="penutupan.materai" type="number" min="0" step="1000" @change="roundToThousands(penutupan, 'materai')">
                                </label>
                            </div>
                        </div>

                        <div class="ns-roman-row">
                            <div class="ns-roman-title">V. Saldo Kas</div>
                            <div class="ns-finance-line">
                                <span>Uang tunai + saldo bank + materai</span>
                                <strong>{{ rupiah(totalKas) }}</strong>
                            </div>
                        </div>

                        <div class="ns-roman-row">
                            <div class="ns-roman-title">VI. Selisih</div>
                            <div class="ns-finance-line">
                                <span>IV - V</span>
                                <strong :class="{ danger: selisih !== 0 }">{{ rupiah(selisih) }}</strong>
                            </div>
                            <label class="is-wide">
                                <span>Penjelasan</span>
                                <input v-model="penutupan.penjelasan" type="text">
                            </label>
                        </div>
                    </div>
                </section>

                <section class="ns-document-page">
                    <div class="ns-document-page-head">
                        <span>Halaman 2</span>
                        <strong>Lampiran Rincian Kas Tunai</strong>
                    </div>
                    <div class="ns-cash-document-head">
                        <span>Kas Tunai</span>
                        <strong>{{ rupiah(totalKasTunai) }}</strong>
                    </div>
                    <div class="ns-cash-document-subtitle">Terdiri dari perincian</div>
                    <div class="ns-cash-ledger" role="table" aria-label="Rincian kas tunai">
                        <div class="ns-cash-ledger-head" role="row">
                            <span>Uraian</span>
                            <span>Nominal</span>
                            <span>Jumlah</span>
                            <span>Satuan</span>
                            <span>Total</span>
                        </div>
                        <label v-for="(row, index) in kasTunaiRows" :key="row.nominal" class="ns-cash-row" role="row">
                            <span class="ns-cash-desc">
                                <strong>{{ cashLetter(index) }} {{ rupiahRingkas(row.nominal) }}</strong>
                                <small>{{ row.jenis }}</small>
                            </span>
                            <span class="ns-cash-nominal">{{ rupiahRingkas(row.nominal) }}</span>
                            <input
                                v-model.number="row.jumlah"
                                type="number"
                                min="0"
                                step="1"
                                inputmode="numeric"
                                aria-label="Jumlah pecahan kas tunai"
                                @change="normalizeCount(row)"
                            >
                            <span class="ns-cash-unit">{{ row.satuan }}</span>
                            <span class="ns-cash-total">{{ rupiah(totalPecahan(row)) }}</span>
                        </label>
                    </div>
                    <div class="ns-cash-document-total">
                        <span>+</span>
                        <strong>{{ rupiah(totalKasTunai) }}</strong>
                    </div>
                    <div class="ns-cash-materai-line">
                        <span>Materai Rp10.000</span>
                        <strong>{{ rupiah(penutupan.materai) }}</strong>
                    </div>
                </section>

                <section class="ns-document-page">
                    <div class="ns-document-page-head">
                        <span>Halaman 3</span>
                        <strong>Rekap Rincian Pembukuan</strong>
                    </div>
                    <div class="ns-recap-grid">
                        <div v-for="row in bukuRomanRows" :key="`recap-${row.roman}`" class="ns-recap-item">
                            <span>{{ row.roman }}. {{ row.title }}</span>
                            <strong>{{ rupiah(row.jumlah) }}</strong>
                        </div>
                    </div>
                    <div class="ns-recap-total">
                        <span>IV. Saldo Pembukuan</span>
                        <strong>{{ rupiah(totalPembukuan) }}</strong>
                    </div>
                    <div class="ns-subsection ns-bank-note">
                        <label>
                            <span>Tanggal Saldo Bank</span>
                            <input v-model="penutupan.tanggalBank" type="date">
                        </label>
                        <div>Saldo bank <strong>{{ rupiah(penutupan.saldoBank) }}</strong></div>
                        <div>Materai <strong>{{ rupiah(penutupan.materai) }}</strong></div>
                    </div>
                </section>

                <section class="ns-document-page">
                    <div class="ns-document-page-head">
                        <span>Halaman 4</span>
                        <strong>Penjelasan dan Penutup</strong>
                    </div>
                    <div class="ns-roman-row">
                        <div class="ns-roman-title">V. Saldo Kas</div>
                        <div class="ns-finance-line">
                            <span>Kas tunai + saldo bank + materai</span>
                            <strong>{{ rupiah(totalKas) }}</strong>
                        </div>
                    </div>
                    <div class="ns-roman-row">
                        <div class="ns-roman-title">VI. Selisih</div>
                        <div class="ns-finance-line">
                            <span>Saldo pembukuan - saldo kas</span>
                            <strong :class="{ danger: selisih !== 0 }">{{ rupiah(selisih) }}</strong>
                        </div>
                    </div>
                    <div class="ns-roman-row">
                        <div class="ns-roman-title">Penjelasan</div>
                        <label class="is-wide">
                            <span>Keterangan yang dicetak di RTF</span>
                            <input v-model="penutupan.penjelasan" type="text">
                        </label>
                    </div>
                    <div class="ns-signature-preview">
                        <span>Kasir</span>
                        <span>Panitera</span>
                        <span>Wakil Ketua</span>
                    </div>
                </section>
            </div>

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

.ns-document-stack {
    display: grid;
    gap: 16px;
}

.ns-document-page {
    padding: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
}

.ns-document-page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
}

.ns-document-page-head span {
    color: var(--accent);
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
}

.ns-document-page-head strong {
    color: var(--text);
    font-size: 16px;
    text-align: right;
}

.ns-period-grid {
    margin-bottom: 14px;
}

.ns-roman-list {
    display: grid;
    gap: 10px;
}

.ns-roman-row {
    display: grid;
    gap: 10px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
}

.ns-roman-title {
    color: var(--text);
    font-size: 13px;
    font-weight: 800;
}

.ns-roman-fields {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    align-items: end;
}

.ns-readonly-total {
    display: grid;
    gap: 6px;
    min-height: 34px;
}

.ns-readonly-total span,
.ns-subsection > span {
    color: var(--text3);
    font-size: 12px;
}

.ns-readonly-total strong {
    display: flex;
    align-items: center;
    min-height: 34px;
    color: var(--text);
    font-size: 13px;
}

.ns-finance-line,
.ns-recap-total {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 7px;
}

.ns-finance-line span,
.ns-recap-total span {
    color: var(--text2);
    font-size: 12px;
}

.ns-finance-line strong,
.ns-recap-total strong {
    color: var(--text);
    font-size: 14px;
    white-space: nowrap;
}

.ns-finance-line strong.danger {
    color: var(--danger, #dc2626);
}

.ns-subsection {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    align-items: end;
}

.ns-subsection div {
    display: grid;
    gap: 5px;
    color: var(--text2);
    font-size: 12px;
}

.ns-subsection strong {
    color: var(--text);
}

.ns-page-total {
    margin-top: 12px;
}

.ns-recap-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
}

.ns-recap-item {
    display: grid;
    gap: 8px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
}

.ns-recap-item span {
    color: var(--text2);
    font-size: 12px;
}

.ns-recap-item strong {
    color: var(--text);
    font-size: 16px;
}

.ns-recap-total {
    margin-bottom: 12px;
}

.ns-bank-note {
    grid-template-columns: 1fr 1fr 1fr;
}

.ns-signature-preview {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
}

.ns-signature-preview span {
    padding: 18px 10px;
    color: var(--text2);
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    border: 1px dashed var(--border);
    border-radius: 8px;
}

.ns-section-title {
    margin-bottom: 12px;
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
}

.ns-section-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 12px;
}

.ns-section-heading .ns-section-title {
    margin-bottom: 4px;
}

.ns-section-heading p {
    margin: 0;
    color: var(--text3);
    font-size: 12px;
}

.ns-section-heading strong {
    color: var(--text);
    font-size: 18px;
    white-space: nowrap;
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
    outline: 0;
}

.ns-summary-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
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

.ns-cash-document-head,
.ns-cash-document-total,
.ns-cash-materai-line {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) minmax(160px, auto);
    align-items: center;
    gap: 16px;
}

.ns-cash-document-head {
    margin-bottom: 16px;
    color: var(--text);
    font-size: 14px;
}

.ns-cash-document-head strong,
.ns-cash-document-total strong,
.ns-cash-materai-line strong {
    justify-self: end;
    color: var(--text);
    font-size: 15px;
    font-variant-numeric: tabular-nums;
}

.ns-cash-document-subtitle {
    margin-bottom: 8px;
    color: var(--text2);
    font-size: 13px;
}

.ns-cash-ledger {
    display: grid;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
}

.ns-cash-ledger-head,
.ns-cash-row {
    display: grid;
    grid-template-columns: minmax(180px, 1.25fr) minmax(104px, 0.7fr) 86px 72px minmax(136px, 0.9fr);
    gap: 12px;
    align-items: center;
}

.ns-cash-ledger-head {
    padding: 8px 0;
    color: var(--text3);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    border-bottom: 1px solid var(--border);
}

.ns-cash-row {
    min-height: 43px;
    padding: 7px 0;
    color: var(--text2);
    border-bottom: 1px solid var(--border);
}

.ns-cash-row:last-child {
    border-bottom: 0;
}

.ns-cash-desc {
    display: grid;
    gap: 1px;
}

.ns-cash-desc strong {
    color: var(--text);
    font-size: 13px;
}

.ns-cash-desc small,
.ns-cash-nominal,
.ns-cash-unit {
    color: var(--text3);
    font-size: 11px;
}

.ns-cash-row input {
    height: 30px;
    text-align: right;
}

.ns-cash-total {
    justify-self: end;
    color: var(--text2);
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

.ns-cash-document-total {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--text);
}

.ns-cash-document-total span {
    justify-self: end;
    color: var(--text);
    font-size: 16px;
    font-weight: 800;
}

.ns-cash-materai-line {
    margin-top: 14px;
    padding-top: 10px;
    color: var(--text2);
    font-size: 13px;
}

.ns-book-table-wrap {
    overflow-x: hidden;
}

.ns-book-table {
    width: 100%;
    table-layout: fixed;
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
    .ns-summary-grid,
    .ns-roman-fields,
    .ns-subsection,
    .ns-recap-grid,
    .ns-bank-note,
    .ns-signature-preview {
        grid-template-columns: 1fr;
    }

    .ns-document-page-head,
    .ns-finance-line,
    .ns-recap-total {
        display: grid;
    }

    .ns-document-page-head strong {
        text-align: left;
    }

    .ns-section-heading,
    .ns-cash-ledger-head,
    .ns-cash-row,
    .ns-cash-document-head,
    .ns-cash-document-total,
    .ns-cash-materai-line {
        grid-template-columns: 1fr;
    }

    .ns-section-heading {
        display: grid;
    }

    .ns-cash-total,
    .ns-cash-document-head strong,
    .ns-cash-document-total strong,
    .ns-cash-document-total span,
    .ns-cash-materai-line strong {
        justify-self: start;
    }
}
</style>
