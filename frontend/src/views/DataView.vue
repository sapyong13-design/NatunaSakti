<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPerkara, deletePerkara, getSippStatus, syncSippData, getJadwalSidang, subscribeSyncProgress } from '../lib/api'

const tableData = ref([])
const loading = ref(false)
const searchQuery = ref('')
const jenisFilter = ref('')

// SIPP Sync state
const syncStatus = ref({ total: 0, sipp_synced: 0, last_sync: null })
const syncing = ref(false)
const syncProgressDialog = ref(false)
const syncProgress = ref({ current: 0, total: 200, message: '', inProgress: false })
let progressEventSource = null

// Jadwal Sidang state
const jadwalDialogVisible = ref(false)
const jadwalLoading = ref(false)
const currentPerkara = ref(null)
const jadwalList = ref([])

const jenisOptions = [
    { label: 'Semua', value: '' },
    { label: 'Perdata', value: 'Perdata' },
    { label: 'Pidana', value: 'Pidana' },
    { label: 'Perikanan', value: 'Perikanan' }
]

const tahunOptions = ref([])
const tahunFilter = ref('')

const fetchData = async () => {
    loading.value = true
    try {
        const filters = {}
        if (jenisFilter.value) {
            filters.jenis_perkara = jenisFilter.value
        }
        if (tahunFilter.value) {
            filters.tahun_masuk = tahunFilter.value
        }
        const data = await getPerkara(filters)
        tableData.value = data
        await fetchSyncStatus()
    } catch (error) {
        console.error('Error:', error)
        ElMessage.error('Gagal mengambil data: ' + error.message)
    } finally {
        loading.value = false
    }
}

const fetchSyncStatus = async () => {
    try {
        const status = await getSippStatus()
        syncStatus.value = status
    } catch (error) {
        console.error('Error fetching sync status:', error)
    }
}

const handleSync = async () => {
    syncing.value = true
    syncProgressDialog.value = true
    syncProgress.value = { current: 0, total: 500, message: 'Memulai sync...', inProgress: true }

    // Subscribe to progress updates
    progressEventSource = subscribeSyncProgress((progress) => {
        syncProgress.value = progress
        if (!progress.inProgress) {
            // Sync complete or failed
            syncing.value = false
            if (progress.error) {
                ElMessage.error('Gagal sync: ' + progress.error)
            } else {
                ElMessage.success(progress.message || 'Sync selesai!')
                fetchData()
            }
            setTimeout(() => {
                syncProgressDialog.value = false
            }, 2000)
            if (progressEventSource) {
                progressEventSource.close()
                progressEventSource = null
            }
        }
    })

    try {
        await syncSippData()
    } catch (error) {
        console.error('Error:', error)
        ElMessage.error('Gagal sync: ' + error.message)
        syncProgressDialog.value = false
        syncing.value = false
        if (progressEventSource) {
            progressEventSource.close()
            progressEventSource = null
        }
    }
}

const handleDelete = async (row) => {
    try {
        await ElMessageBox.confirm(
            `Hapus data perkara "${row.nomor_perkara}"?`,
            'Konfirmasi Hapus',
            {
                confirmButtonText: 'Hapus',
                cancelButtonText: 'Batal',
                type: 'warning'
            }
        )

        await deletePerkara(row.id)
        ElMessage.success('Data berhasil dihapus')
        fetchData()
    } catch (error) {
        if (error !== 'cancel') {
            console.error('Error:', error)
            ElMessage.error('Gagal menghapus data: ' + error.message)
        }
    }
}

const filteredData = ref([])

const updateFiltered = () => {
    let data = tableData.value

    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        data = data.filter(item =>
            item.nama_perkara?.toLowerCase().includes(query) ||
            item.nomor_perkara?.toLowerCase().includes(query) ||
            item.para_pihak?.toLowerCase().includes(query)
        )
    }

    filteredData.value = data
}

const formatTanggalRegister = (tgl) => {
    if (!tgl) return '-'
    // Parse format "07 May 2026" ke Indonesia
    const months = {
        'January': 'Januari', 'February': 'Februari', 'March': 'Maret',
        'April': 'April', 'May': 'Mei', 'June': 'Juni',
        'July': 'Juli', 'August': 'Agustus', 'September': 'September',
        'October': 'Oktober', 'November': 'November', 'December': 'Desember'
    }
    let indo = tgl
    for (const [eng, ind] of Object.entries(months)) {
        indo = indo.replace(eng, ind)
    }
    return indo
}

const extractNamaPihak = (row) => {
    if (!row.para_pihak) return '-'

    const text = row.para_pihak

    if (row.jenis_perkara === 'Perikanan') {
        // PRK format: "Pihak: NotFound" or similar, then name at the bottom
        // Get the LAST capitalized name in the text (name at the bottom)
        const allNames = text.match(/([A-Z][A-Z\s]+(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?)/g)

        if (allNames && allNames.length > 0) {
            // Get the last match (name at the bottom)
            let nama = allNames[allNames.length - 1].trim()
            // Clean up
            nama = nama.replace(/^[\d.\s]+/, '') // Remove leading numbers/dots
            nama = nama.replace(/[\.,;]+$/, '') // Remove trailing punctuation
            nama = nama.trim()
            // Filter out common non-name words
            const excludeWords = ['NOTFOUND', 'NOT FOUND', 'TIDAK DITEMUKAN', 'PIHAK', 'PENUNTUT UMUM', 'TERDAKWA']
            if (!excludeWords.some(ex => nama.includes(ex)) && nama.length > 2) {
                return nama
            }
        }

        // Fallback: try to find name pattern with mixed case
        const mixedCaseMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g)
        if (mixedCaseMatch && mixedCaseMatch.length > 0) {
            return mixedCaseMatch[mixedCaseMatch.length - 1].trim()
        }

        return text.substring(0, 80) + '...'
    }

    if (row.jenis_perkara === 'Pidana') {
        // Extract all Terdakwa: "Terdakwa:1.NAMA 2.NAMA 3.NAMA" or "Terdakwa: 1.NAMA, 2.NAMA"
        const terdakwaMatch = text.match(/Terdakwa:\s*(.+?)(?:\n|Penuntut Umum|$)/i)
        if (terdakwaMatch) {
            let section = terdakwaMatch[1].trim()
            // Extract numbered names: 1.NAMA 2.NAMA 3.NAMA
            const names = section.match(/\d+\.?\s*([^0-9.,]+?)(?=\s*\d+\.|$|\.|,)/g)
            if (names && names.length > 0) {
                const cleanNames = names.map(n => n.replace(/^\d+\.?\s*/, '').trim()).filter(n => n)
                if (cleanNames.length > 0) {
                    return cleanNames.join(', ')
                }
            }
            // Fallback: take first part
            section = section.split(/\d+\.|Penuntut Umum/)[0].trim()
            section = section.replace(/[.,;]+$/, '').trim()
            if (section.toLowerCase() === 'disamarkan') return 'Disamarkan'
            return section
        }
        return text.substring(0, 80) + '...'
    }

    if (row.jenis_perkara === 'Perdata') {
        // Extract Pemohon/Penggugat with multiple names
        const pemohonMatch = text.match(/Pemohon:\s*(.+?)(?:Tergugat|Termohon|Para Pihak|$)/i)
        const penggugatMatch = text.match(/Penggugat:\s*(.+?)(?:Tergugat|Termohon|Para Pihak|$)/i)

        let section = null
        if (pemohonMatch) section = pemohonMatch[1]
        else if (penggugatMatch) section = penggugatMatch[1]

        if (section) {
            section = section.trim()
            // Extract numbered names
            const names = section.match(/\d+\.?\s*([^0-9.,]+?)(?=\s*\d+\.|$|\.|,)/g)
            if (names && names.length > 0) {
                const cleanNames = names.map(n => n.replace(/^\d+\.?\s*/, '').trim()).filter(n => n)
                if (cleanNames.length > 0) {
                    return cleanNames.join(', ')
                }
            }
            // Fallback
            section = section.replace(/[.,;]+$/, '').trim()
            return section
        }
        return text.substring(0, 80) + '...'
    }

    return text.substring(0, 80) + '...'
}

// Watch for changes
const handleSearch = () => {
    updateFiltered()
}

const handleFilter = () => {
    fetchData()
}

const handleRowClick = async (row) => {
    currentPerkara.value = row
    jadwalDialogVisible.value = true
    jadwalLoading.value = true
    jadwalList.value = []

    try {
        const result = await getJadwalSidang(row.nomor_perkara)
        jadwalList.value = result.jadwal || []
    } catch (error) {
        console.error('Error fetching jadwal:', error)
        ElMessage.error('Gagal mengambil jadwal sidang')
    } finally {
        jadwalLoading.value = false
    }
}

const closeJadwalDialog = () => {
    jadwalDialogVisible.value = false
    jadwalList.value = []
    currentPerkara.value = null
}

// Populate tahun options from existing data
const loadTahunOptions = async () => {
    try {
        const data = await getPerkara({ limit: 1000 })
        const tahunSet = new Set(data.map(item => item.tahun_masuk).filter(Boolean))
        tahunOptions.value = Array.from(tahunSet).sort((a, b) => b - a)
    } catch (error) {
        console.error('Error loading tahun options:', error)
    }
}

onMounted(() => {
    fetchData()
    loadTahunOptions()
})

// Watch tableData changes
import { watch } from 'vue'
watch(tableData, () => {
    updateFiltered()
})
</script>

<template>
    <div class="data-view">
        <el-card class="filter-card">
            <el-row :gutter="20" align="middle">
                <el-col :span="5">
                    <el-input
                        v-model="searchQuery"
                        placeholder="Cari perkara..."
                        clearable
                        @input="handleSearch"
                    >
                        <template #prefix>
                            <el-icon><Search /></el-icon>
                        </template>
                    </el-input>
                </el-col>
                <el-col :span="4">
                    <el-select v-model="jenisFilter" placeholder="Jenis Perkara" @change="handleFilter">
                        <el-option
                            v-for="item in jenisOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-col>
                <el-col :span="4">
                    <el-select v-model="tahunFilter" placeholder="Tahun" @change="handleFilter" clearable>
                        <el-option
                            v-for="tahun in tahunOptions"
                            :key="tahun"
                            :label="String(tahun)"
                            :value="String(tahun)"
                        />
                    </el-select>
                </el-col>
                <el-col :span="11">
                    <el-button @click="fetchData" :loading="loading">
                        <el-icon><Refresh /></el-icon>
                        Refresh
                    </el-button>
                    <el-button
                        type="success"
                        @click="handleSync"
                        :loading="syncing"
                        :icon="syncing ? 'Loading' : 'Connection'"
                    >
                        Sync SIPP
                    </el-button>
                    <span style="margin-left: 15px; color: #606266; font-size: 13px">
                        Ter-sync: {{ syncStatus.sipp_synced || 0 }} / {{ syncStatus.total || 0 }}
                        <span v-if="syncStatus.last_sync" style="margin-left: 8px; color: #909399">
                            (Last: {{ new Date(syncStatus.last_sync).toLocaleTimeString('id-ID') }})
                        </span>
                    </span>
                </el-col>
            </el-row>
        </el-card>

        <el-card class="table-card" style="margin-top: 20px">
            <el-table :data="filteredData" v-loading="loading" stripe @row-click="handleRowClick" style="cursor: pointer">
                <el-table-column type="index" label="No" width="60" />
                <el-table-column prop="jenis_perkara" label="Jenis" width="100">
                    <template #default="{ row }">
                        <el-tag :type="row.jenis_perkara === 'Perdata' ? 'success' : row.jenis_perkara === 'Pidana' ? 'danger' : 'warning'">
                            {{ row.jenis_perkara }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="nomor_perkara" label="Nomor Perkara" min-width="180" />
                <el-table-column prop="para_pihak" label="Para Pihak" min-width="200" show-overflow-tooltip>
                    <template #default="{ row }">
                        {{ extractNamaPihak(row) }}
                    </template>
                </el-table-column>
                <el-table-column label="Tgl Register" width="130" align="center">
                    <template #default="{ row }">
                        {{ formatTanggalRegister(row.sipp_tanggal_register) }}
                    </template>
                </el-table-column>
                <el-table-column label="Status" width="110" align="center">
                    <template #default="{ row }">
                        <el-tag v-if="row.tanggal_putus" type="success" size="small">Minutasi</el-tag>
                        <el-tag v-else-if="row.sipp_status" type="warning" size="small">{{ row.sipp_status }}</el-tag>
                        <el-tag v-else type="info" size="small">-</el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="tahun_masuk" label="Tahun" width="80" align="center" />
                <el-table-column label="Tgl Putus" width="110" align="center">
                    <template #default="{ row }">
                        {{ formatDate(row.tanggal_putus) }}
                    </template>
                </el-table-column>
                <el-table-column prop="keterangan" label="Ket" width="80" align="center" />
                <el-table-column label="Aksi" width="100" align="center" fixed="right">
                    <template #default="{ row }">
                        <el-button type="danger" size="small" @click="handleDelete(row)">
                            <el-icon><Delete /></el-icon>
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>

            <div class="table-footer">
                <span>Menampilkan {{ filteredData.length }} dari {{ tableData.length }} perkara</span>
            </div>
        </el-card>

        <!-- Jadwal Sidang Dialog -->
        <el-dialog
            v-model="jadwalDialogVisible"
            :title="`Jadwal Sidang - ${currentPerkara?.nomor_perkara || ''}`"
            width="700px"
            @close="closeJadwalDialog"
        >
            <div v-loading="jadwalLoading">
                <el-alert
                    type="info"
                    :closable="false"
                    style="margin-bottom: 15px"
                >
                    Klik baris tabel untuk melihat jadwal sidang perkara
                </el-alert>

                <el-table :data="jadwalList" stripe v-if="jadwalList.length > 0">
                    <el-table-column prop="nomor" label="No" width="60" />
                    <el-table-column prop="tanggal" label="Tanggal Sidang" min-width="150" />
                    <el-table-column prop="agenda" label="Agenda" min-width="200" show-overflow-tooltip />
                    <el-table-column prop="ruangan" label="Ruangan" width="100" />
                    <el-table-column prop="alasanDitunda" label="Alasan Ditunda" min-width="150" show-overflow-tooltip />
                </el-table>

                <el-empty
                    v-else-if="!jadwalLoading"
                    description="Tidak ada jadwal sidang ditemukan"
                />
            </div>

            <template #footer>
                <el-button @click="closeJadwalDialog">Tutup</el-button>
            </template>
        </el-dialog>

        <!-- Sync Progress Dialog -->
        <el-dialog
            v-model="syncProgressDialog"
            title="Sync SIPP"
            width="500px"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :show-close="!syncProgress.inProgress"
        >
            <div class="sync-progress-content">
                <el-progress
                    :percentage="Math.round((syncProgress.current / syncProgress.total) * 100)"
                    :status="syncProgress.error ? 'exception' : (syncProgress.inProgress ? '' : 'success')"
                />
                <div style="margin-top: 15px; text-align: center">
                    <p style="margin: 0; font-size: 14px; color: #606266">
                        {{ syncProgress.message }}
                    </p>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #909399">
                        {{ syncProgress.current }} / {{ syncProgress.total }} perkara
                    </p>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import { Search, Refresh, Delete } from '@element-plus/icons-vue'

export default {
    components: {
        Search, Refresh, Delete
    },
    methods: {
        formatDate(date) {
            if (!date) return '-'
            const d = new Date(date)
            const day = String(d.getDate()).padStart(2, '0')
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const year = d.getFullYear()
            return `${day}-${month}-${year}`
        }
    }
}
</script>

<style scoped>
.data-view {
    max-width: 1600px;
    margin: 0 auto;
}

.filter-card, .table-card {
    box-shadow: 0 2px 12px 0 rgba(27, 94, 32, 0.15);
}

.filter-card :deep(.el-card__header) {
    background: #e8f5e9;
    border-bottom: 1px solid #c8e6c9;
}

.table-footer {
    margin-top: 15px;
    text-align: right;
    color: #606266;
    font-weight: bold;
}
</style>
