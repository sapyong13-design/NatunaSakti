<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/shell/PageHeader.vue'
import MingguanFilterBar from '../components/report/MingguanFilterBar.vue'
import ReportTable from '../components/report/ReportTable.vue'
import ReportHistoryModal from '../components/report/ReportHistoryModal.vue'
import { getPerkaraLaporanMingguan, downloadLaporanMingguan, getLaporanHistory, deleteLaporanHistory } from '../lib/api'

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
const errorMessage = ref('')
const historyOpen = ref(false)
const historyLoading = ref(false)
const historyItems = ref([])

async function fetchData() {
    if (!start.value || !end.value) {
        errorMessage.value = 'Pilih rentang tanggal terlebih dahulu'
        return
    }
    loading.value = true
    errorMessage.value = ''
    try {
        const data = await getPerkaraLaporanMingguan(jenisCanonical.value, start.value, end.value)
        rows.value = Array.isArray(data) ? data : []
    } catch (err) {
        console.error('Fetch failed:', err.message)
        errorMessage.value = 'Gagal mengambil data: ' + err.message
    } finally {
        loading.value = false
    }
}

watch(() => route.params.jenis, () => { rows.value = [] })

async function handleExport() {
    if (!start.value || !end.value) {
        errorMessage.value = 'Pilih rentang tanggal terlebih dahulu'
        return
    }
    exporting.value = true
    errorMessage.value = ''
    try {
        const download = await downloadLaporanMingguan(jenisCanonical.value, start.value, end.value, format.value)
        const url      = URL.createObjectURL(download.blob)
        const a        = document.createElement('a')
        a.href         = url
        a.download     = download.filename
        a.click()
        URL.revokeObjectURL(url)
        await loadHistory()
        historyOpen.value = true
    } catch (err) {
        console.error('Export failed:', err.message)
        errorMessage.value = 'Gagal membuat file: ' + err.message
    } finally {
        exporting.value = false
    }
}

async function loadHistory() {
    historyLoading.value = true
    try {
        historyItems.value = await getLaporanHistory({ tipe: 'mingguan', jenis: jenisCanonical.value })
    } catch (err) {
        errorMessage.value = 'Gagal mengambil riwayat laporan: ' + err.message
    } finally {
        historyLoading.value = false
    }
}

async function openHistory() {
    historyOpen.value = true
    await loadHistory()
}

async function removeHistory(item) {
    if (!confirm(`Hapus riwayat generate ${item.filename}?`)) return
    await deleteLaporanHistory(item.id)
    await loadHistory()
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
            @history="openHistory"
        />

        <div v-if="errorMessage" class="ns-report-error" role="alert">
            <strong>Proses laporan gagal</strong>
            <span>{{ errorMessage }}</span>
            <button type="button" @click="fetchData">Coba lagi</button>
        </div>

        <ReportTable :rows="rows" :loading="loading" />

        <ReportHistoryModal
            :show="historyOpen"
            :items="historyItems"
            :loading="historyLoading"
            title="Riwayat Generate Laporan Mingguan"
            @close="historyOpen = false"
            @delete="removeHistory"
        />
    </div>
</template>

<style scoped>
.ns-report-error {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 12px;
    align-items: center;
    margin: 0 0 12px;
    padding: 12px;
    background: color-mix(in srgb, var(--danger, #C75B4A) 10%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--danger, #C75B4A) 30%, var(--border));
    border-radius: 10px;
}

.ns-report-error span {
    color: var(--text-2);
    font-size: 12px;
}

.ns-report-error button {
    grid-row: 1 / span 2;
    grid-column: 2;
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    font-weight: 700;
}

@media (max-width: 560px) {
    .ns-report-error {
        grid-template-columns: 1fr;
    }

    .ns-report-error button {
        grid-row: auto;
        grid-column: 1;
        width: 100%;
    }
}
</style>
