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
