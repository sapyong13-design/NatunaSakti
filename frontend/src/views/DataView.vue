<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPerkara, deletePerkara } from '../lib/api'

const tableData = ref([])
const loading = ref(false)
const searchQuery = ref('')
const jenisFilter = ref('')

const jenisOptions = [
    { label: 'Semua', value: '' },
    { label: 'Perdata', value: 'Perdata' },
    { label: 'Pidana', value: 'Pidana' },
    { label: 'Perikanan', value: 'Perikanan' }
]

const fetchData = async () => {
    loading.value = true
    try {
        const filters = {}
        if (jenisFilter.value) {
            filters.jenis_perkara = jenisFilter.value
        }
        const data = await getPerkara(filters)
        tableData.value = data
    } catch (error) {
        console.error('Error:', error)
        ElMessage.error('Gagal mengambil data: ' + error.message)
    } finally {
        loading.value = false
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

// Watch for changes
const handleSearch = () => {
    updateFiltered()
}

const handleFilter = () => {
    fetchData()
}

onMounted(() => {
    fetchData()
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
                <el-col :span="6">
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
                <el-col :span="5">
                    <el-select v-model="jenisFilter" placeholder="Jenis Perkara" @change="handleFilter">
                        <el-option
                            v-for="item in jenisOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-col>
                <el-col :span="13">
                    <el-button @click="fetchData" :loading="loading">
                        <el-icon><Refresh /></el-icon>
                        Refresh
                    </el-button>
                </el-col>
            </el-row>
        </el-card>

        <el-card class="table-card" style="margin-top: 20px">
            <el-table :data="filteredData" v-loading="loading" stripe>
                <el-table-column type="index" label="No" width="60" />
                <el-table-column prop="jenis_perkara" label="Jenis" width="100">
                    <template #default="{ row }">
                        <el-tag :type="row.jenis_perkara === 'Perdata' ? 'success' : row.jenis_perkara === 'Pidana' ? 'danger' : 'warning'">
                            {{ row.jenis_perkara }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="nama_perkara" label="Nama Perkara" min-width="150" />
                <el-table-column prop="nomor_perkara" label="Nomor Perkara" min-width="180" />
                <el-table-column prop="para_pihak" label="Para Pihak" min-width="200" show-overflow-tooltip />
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
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.table-footer {
    margin-top: 15px;
    text-align: right;
    color: #606266;
    font-weight: bold;
}
</style>
