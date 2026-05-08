<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/shell/PageHeader.vue'
import BulananFilterBar from '../components/report/BulananFilterBar.vue'
import ReportTable from '../components/report/ReportTable.vue'
import { getPerkara } from '../lib/api'
import { generateBulananPDF, downloadPDF } from '../lib/export'
import { downloadLaporanBulanan } from '../lib/api'

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
        const data = await getPerkara({ jenis_perkara: jenisCanonical.value, tahun_masuk: tahun.value, limit: 1000 })
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
            const blob = await downloadLaporanBulanan(jenisCanonical.value, bulan.value, tahun.value)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${filenameBase}.docx`
            a.click()
            URL.revokeObjectURL(url)
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
watch(tahun, () => fetchData())

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
