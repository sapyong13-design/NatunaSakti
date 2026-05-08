<script setup>
defineProps({
    rows: { type: Array, required: true },
    loading: { type: Boolean, default: false }
})

function formatDate(s) {
    if (!s) return '-'
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}-${mm}-${d.getFullYear()}`
}
</script>

<template>
    <div class="ns-table-card">
        <div class="ns-table-head">
            <div style="width: 50px;">No</div>
            <div style="flex: 1; min-width: 140px;">Nama Perkara</div>
            <div style="flex: 1; min-width: 180px;">Nomor Perkara</div>
            <div style="flex: 1; min-width: 180px;">Para Pihak</div>
            <div style="width: 100px;">Tahun</div>
            <div style="width: 110px;">Tgl Putus</div>
            <div style="width: 80px;">Ket</div>
        </div>
        <div class="ns-table-body" style="max-height: 520px; overflow-y: auto;">
            <div v-if="loading" class="ns-empty">Memuat...</div>
            <div v-else-if="!rows.length" class="ns-empty">Tidak ada perkara di periode ini</div>
            <div v-for="(row, idx) in rows" :key="row.id" class="ns-tr">
                <div style="width: 50px; color: var(--text-3); font-size: 12px;">{{ idx + 1 }}</div>
                <div style="flex: 1; min-width: 140px;">{{ row.nama_perkara }}</div>
                <div style="flex: 1; min-width: 180px;" class="ns-mono">{{ row.nomor_perkara }}</div>
                <div style="flex: 1; min-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="row.para_pihak">{{ row.para_pihak }}</div>
                <div style="width: 100px; font-size: 12px;">{{ row.tahun_masuk }}</div>
                <div style="width: 110px; font-size: 12px;">{{ formatDate(row.tanggal_putus) }}</div>
                <div style="width: 80px; font-size: 12px; color: var(--text-2);">{{ row.keterangan || '-' }}</div>
            </div>
        </div>
    </div>
</template>
