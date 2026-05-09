<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/shell/PageHeader.vue'
import MingguanFilterBar from '../components/report/MingguanFilterBar.vue'
import ReportTable from '../components/report/ReportTable.vue'
import { getPerkaraByDateRange, downloadLaporanMingguan } from '../lib/api'

const route = useRoute()

const jenisCanonical = computed(() => {
    const j = (route.params.jenis || 'pidana').toLowerCase()
    return j.charAt(0).toUpperCase() + j.slice(1)
})

const start = ref('')
const end = ref('')
const format = ref('docx')
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
        const data = await getPerkaraByDateRange(start.value, end.value, { jenis_perkara: jenisCanonical.value })
        rows.value = Array.isArray(data) ? data : []
    } catch (err) {
        console.error('Fetch failed:', err.message)
        alert('Gagal mengambil data: ' + err.message)
    } finally {
        loading.value = false
    }
}

watch(() => route.params.jenis, () => { rows.value = [] })

async function handleExport() {
    if (!start.value || !end.value) {
        alert('Pilih rentang tanggal terlebih dahulu')
        return
    }
    exporting.value = true
    try {
        const startStr = formatDateForFilename(start.value)
        const endStr   = formatDateForFilename(end.value)
        const ext      = format.value === 'pdf' ? 'pdf' : 'docx'
        const filename = `Akurasi_${jenisCanonical.value}_${startStr}_sd_${endStr}.${ext}`
        const blob     = await downloadLaporanMingguan(jenisCanonical.value, start.value, end.value, format.value)
        const url      = URL.createObjectURL(blob)
        const a        = document.createElement('a')
        a.href         = url
        a.download     = filename
        a.click()
        URL.revokeObjectURL(url)
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
            :title="`Perkara ${jenisCanonical}`"
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
            v-model:start="start"
            v-model:end="end"
            v-model:format="format"
            :loading="loading"
            :exporting="exporting"
            :can-export="!!(start && end)"
            @fetch="fetchData"
            @export="handleExport"
        />

        <ReportTable :rows="rows" :loading="loading" />
    </div>
</template>
