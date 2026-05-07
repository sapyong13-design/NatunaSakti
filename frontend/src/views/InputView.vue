<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPerkara } from '../lib/api'

const form = ref({
    nama_perkara: '',
    nomor_perkara: '',
    para_pihak: '',
    tahun_masuk: new Date().getFullYear(),
    tanggal_putus: null,
    keterangan: '',
    jenis_perkara: 'Perdata'
})

const loading = ref(false)

const keteranganOptions = [
    { label: 'Lengkap', value: 'Lengkap' },
    { label: 'Sisa', value: 'Sisa' }
]

const jenisOptions = [
    { label: 'Perdata', value: 'Perdata' },
    { label: 'Pidana', value: 'Pidana' },
    { label: 'Perikanan', value: 'Perikanan' }
]

const resetForm = () => {
    form.value = {
        nama_perkara: '',
        nomor_perkara: '',
        para_pihak: '',
        tahun_masuk: new Date().getFullYear(),
        tanggal_putus: null,
        keterangan: '',
        jenis_perkara: 'Perdata'
    }
}

const handleSubmit = async () => {
    if (!form.value.nama_perkara) {
        ElMessage.error('Nama perkara harus diisi')
        return
    }
    if (!form.value.nomor_perkara) {
        ElMessage.error('Nomor perkara harus diisi')
        return
    }
    if (!form.value.para_pihak) {
        ElMessage.error('Para pihak harus diisi')
        return
    }

    loading.value = true

    try {
        const dataToSubmit = {
            nama_perkara: form.value.nama_perkara,
            nomor_perkara: form.value.nomor_perkara,
            para_pihak: form.value.para_pihak,
            tahun_masuk: form.value.tahun_masuk,
            jenis_perkara: form.value.jenis_perkara
        }

        if (form.value.tanggal_putus) {
            dataToSubmit.tanggal_putus = form.value.tanggal_putus
        }

        if (form.value.keterangan) {
            dataToSubmit.keterangan = form.value.keterangan
        }

        await createPerkara(dataToSubmit)

        ElMessage.success('Data perkara berhasil disimpan')
        resetForm()
    } catch (error) {
        console.error('Error:', error)
        ElMessage.error('Gagal menyimpan data: ' + error.message)
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="input-view">
        <el-card class="form-card">
            <template #header>
                <div class="card-header">
                    <h2>Input Data Perkara</h2>
                </div>
            </template>

            <el-form :model="form" label-width="140px">
                <el-form-item label="Jenis Perkara">
                    <el-select v-model="form.jenis_perkara" placeholder="Pilih jenis perkara">
                        <el-option
                            v-for="item in jenisOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>

                <el-form-item label="Nama Perkara">
                    <el-input
                        v-model="form.nama_perkara"
                        placeholder="Contoh: Perceraian, Wanprestasi"
                        clearable
                    />
                </el-form-item>

                <el-form-item label="Nomor Perkara">
                    <el-input
                        v-model="form.nomor_perkara"
                        placeholder="Contoh: 123/Pdt.G/2026/PN Nta"
                        clearable
                    />
                </el-form-item>

                <el-form-item label="Para Pihak">
                    <el-input
                        v-model="form.para_pihak"
                        type="textarea"
                        :rows="3"
                        placeholder="Contoh: Penggugat: Ahmad | Tergugat: Siti"
                    />
                </el-form-item>

                <el-form-item label="Tahun Masuk">
                    <el-input-number
                        v-model="form.tahun_masuk"
                        :min="2000"
                        :max="2100"
                    />
                </el-form-item>

                <el-form-item label="Tanggal Putus">
                    <el-date-picker
                        v-model="form.tanggal_putus"
                        type="date"
                        placeholder="Pilih tanggal putus"
                        format="DD-MM-YYYY"
                        value-format="YYYY-MM-DD"
                    />
                </el-form-item>

                <el-form-item label="Keterangan">
                    <el-select v-model="form.keterangan" placeholder="Pilih keterangan" clearable>
                        <el-option
                            v-for="item in keteranganOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                </el-form-item>

                <el-form-item>
                    <el-button type="primary" @click="handleSubmit" :loading="loading">
                        Simpan Data
                    </el-button>
                    <el-button @click="resetForm">Reset</el-button>
                </el-form-item>
            </el-form>
        </el-card>
    </div>
</template>

<style scoped>
.input-view {
    max-width: 800px;
    margin: 0 auto;
}

.form-card {
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.card-header h2 {
    margin: 0;
    color: #303133;
}
</style>
