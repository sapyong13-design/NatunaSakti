<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getPerkaraByMonth } from '../lib/api'
import { generateBulananPDF, downloadPDF, generateBulananDOCX, downloadDOCX } from '../lib/export'

const BULAN_NAMA = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const filters = ref({
    bulan: new Date().getMonth() + 1,
    tahun: new Date().getFullYear(),
    jenis_perkara: 'Perdata'
})

const tableData = ref([])
const loading = ref(false)
const exporting = ref(false)
const exportFormat = ref('pdf')

const jenisOptions = [
    { label: 'Perdata', value: 'Perdata' },
    { label: 'Pidana', value: 'Pidana' },
    { label: 'Perikanan', value: 'Perikanan' }
]

const formatOptions = [
    { label: 'PDF', value: 'pdf' },
    { label: 'DOCX (Word)', value: 'docx' }
]

const fetchData = async () => {
    loading.value = true
    try {
        const data = await getPerkaraByMonth(
            filters.value.bulan,
            filters.value.tahun,
            { jenis_perkara: filters.value.jenis_perkara }
        )
        tableData.value = data

        if (data.length === 0) {
            ElMessage.warning('Tidak ada data untuk periode ini')
        }
    } catch (error) {
        console.error('Error:', error)
        ElMessage.error('Gagal mengambil data: ' + error.message)
    } finally {
        loading.value = false
    }
}

const handleExport = async () => {
    if (tableData.value.length === 0) {
        ElMessage.warning('Tidak ada data untuk diekspor')
        return
    }

    exporting.value = true
    try {
        const filenameBase = `Akurasi_${filters.value.jenis_perkara}_${BULAN_NAMA[filters.value.bulan - 1]}_${filters.value.tahun}`

        if (exportFormat.value === 'pdf') {
            const doc = generateBulananPDF(tableData.value, {
                bulan: filters.value.bulan,
                tahun: filters.value.tahun,
                jenisPerkara: filters.value.jenis_perkara
            })
            downloadPDF(doc, `${filenameBase}.pdf`)
        } else {
            const doc = await generateBulananDOCX(tableData.value, {
                bulan: filters.value.bulan,
                tahun: filters.value.tahun,
                jenisPerkara: filters.value.jenis_perkara
            })
            await downloadDOCX(doc, `${filenameBase}.docx`)
        }

        ElMessage.success(`File ${exportFormat.value.toUpperCase()} berhasil dibuat`)
    } catch (error) {
        console.error('Error:', error)
        ElMessage.error('Gagal membuat file: ' + error.message)
    } finally {
        exporting.value = false
    }
}

onMounted(() => {
    fetchData()
})
</script>

<template>
    <div class="bulanan-view">
        <el-card class="filter-card">
            <el-row :gutter="20" align="middle">
                <el-col :span="5">
                    <el-select v-model="filters.jenis_perkara" placeholder="Jenis Perkara" @change="fetchData">
                        <el-option
                            v-for="item in jenisOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-col>
                <el-col :span="4">
                    <el-select v-model="filters.bulan" placeholder="Bulan" @change="fetchData">
                        <el-option
                            v-for="(nama, idx) in BULAN_NAMA"
                            :key="idx + 1"
                            :label="nama"
                            :value="idx + 1"
                        />
                    </el-select>
                </el-col>
                <el-col :span="4">
                    <el-input-number v-model="filters.tahun" :min="2020" :max="2030" @change="fetchData" />
                </el-col>
                <el-col :span="4">
                    <el-select v-model="exportFormat" placeholder="Format">
                        <el-option
                            v-for="item in formatOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-col>
                <el-col :span="7">
                    <el-button type="primary" @click="handleExport" :loading="exporting">
                        <el-icon><Download /></el-icon>
                        Export {{ exportFormat.toUpperCase() }}
                    </el-button>
                    <el-button @click="fetchData" :loading="loading">
                        <el-icon><Refresh /></el-icon>
                        Refresh
                    </el-button>
                </el-col>
            </el-row>
        </el-card>

        <el-card class="table-card" style="margin-top: 20px">
            <el-table :data="tableData" v-loading="loading" stripe>
                <el-table-column type="index" label="No" width="60" />
                <el-table-column prop="nama_perkara" label="Nama Perkara" min-width="150" />
                <el-table-column prop="nomor_perkara" label="Nomor Perkara" min-width="180" />
                <el-table-column prop="para_pihak" label="Para Pihak" min-width="200" show-overflow-tooltip />
                <el-table-column prop="tahun_masuk" label="Tahun Masuk" width="100" align="center" />
                <el-table-column label="Tgl Putus" width="110" align="center">
                    <template #default="{ row }">
                        {{ formatDate(row.tanggal_putus) }}
                    </template>
                </el-table-column>
                <el-table-column prop="keterangan" label="Ket" width="80" align="center" />
            </el-table>

            <div class="table-footer">
                <span>Total: {{ tableData.length }} perkara</span>
            </div>
        </el-card>
    </div>
</template>

<script>
import { Download, Refresh } from '@element-plus/icons-vue'

export default {
    components: {
        Download, Refresh
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
.bulanan-view {
    max-width: 1400px;
    margin: 0 auto;
}

.filter-card, .table-card {
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.table-footer {
    margin-top: 15px;
    text-align: right;
    color: #606266;
    font-weight: bold;
}
</style>
