<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getPerkaraByDateRange } from '../lib/api'
import { generateMingguanPDF, downloadPDF, generateMingguanDOCX, downloadDOCX } from '../lib/export'

const dateRange = ref({
    start: null,
    end: null
})

const jenisPerkara = ref('Perdata')
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
    if (!dateRange.value.start || !dateRange.value.end) {
        ElMessage.warning('Pilih rentang tanggal terlebih dahulu')
        return
    }

    loading.value = true
    try {
        const data = await getPerkaraByDateRange(
            dateRange.value.start,
            dateRange.value.end,
            { jenis_perkara: jenisPerkara.value }
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
        const start = formatDate(dateRange.value.start)
        const end = formatDate(dateRange.value.end)
        const filenameBase = `Akurasi_${jenisPerkara.value}_${start}_s_d_${end}`

        if (exportFormat.value === 'pdf') {
            const doc = generateMingguanPDF(tableData.value, {
                startDate: dateRange.value.start,
                endDate: dateRange.value.end,
                jenisPerkara: jenisPerkara.value
            })
            downloadPDF(doc, `${filenameBase}.pdf`)
        } else {
            const doc = await generateMingguanDOCX(tableData.value, {
                startDate: dateRange.value.start,
                endDate: dateRange.value.end,
                jenisPerkara: jenisPerkara.value
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

const formatDate = (date) => {
    if (!date) return '-'
    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
}
</script>

<template>
    <div class="mingguan-view">
        <el-card class="filter-card">
            <el-row :gutter="20" align="middle">
                <el-col :span="4">
                    <el-select v-model="jenisPerkara" placeholder="Jenis Perkara">
                        <el-option
                            v-for="item in jenisOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-col>
                <el-col :span="5">
                    <el-date-picker
                        v-model="dateRange.start"
                        type="date"
                        placeholder="Tanggal Mulai"
                        format="DD-MM-YYYY"
                        value-format="YYYY-MM-DD"
                    />
                </el-col>
                <el-col :span="5">
                    <el-date-picker
                        v-model="dateRange.end"
                        type="date"
                        placeholder="Tanggal Akhir"
                        format="DD-MM-YYYY"
                        value-format="YYYY-MM-DD"
                    />
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
                <el-col :span="6">
                    <el-button type="primary" @click="fetchData" :loading="loading">
                        Tampilkan
                    </el-button>
                    <el-button @click="handleExport" :loading="exporting" :disabled="tableData.length === 0">
                        Export {{ exportFormat.toUpperCase() }}
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

<style scoped>
.mingguan-view {
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
