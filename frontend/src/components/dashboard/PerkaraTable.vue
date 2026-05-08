<script setup>
import { pihakUtama } from '../../lib/pihak'

defineProps({
    rows: { type: Array, required: true }
})

const emit = defineEmits(['rowClick'])

function jenisColor(jenis) {
    if (jenis === 'Pidana') return '#ef4444'
    if (jenis === 'Perdata') return '#10b981'
    if (jenis === 'Perikanan') return '#3b82f6'
    return '#9ca3af'
}
</script>

<template>
    <div class="ns-table-card">
        <div class="ns-table-head">
            <div style="width: 50px;">No</div>
            <div style="width: 90px;">Jenis</div>
            <div style="flex: 1; min-width: 180px;">Nomor Perkara</div>
            <div style="flex: 1; min-width: 150px;">Para Pihak</div>
            <div style="width: 110px;">Register</div>
            <div style="width: 130px;">Status</div>
            <div style="width: 90px;">Lama</div>
        </div>
        <div class="ns-table-body" style="max-height: 480px; overflow-y: auto;">
            <div
                v-for="(row, idx) in rows"
                :key="row.id || row.nomor_perkara"
                class="ns-tr"
                style="cursor: pointer;"
                @click="emit('rowClick', row)"
            >
                <div style="width: 50px; color: var(--text-3); font-size: 12px;">{{ idx + 1 }}</div>
                <div style="width: 90px;">
                    <span :style="{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: jenisColor(row.jenis_perkara) + '22', color: jenisColor(row.jenis_perkara), fontSize: '11px', fontWeight: 600 }">
                        {{ row.jenis_perkara }}
                    </span>
                </div>
                <div style="flex: 1; min-width: 180px;" class="ns-mono">{{ row.nomor_perkara }}</div>
                <div style="flex: 1; min-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="row.para_pihak">{{ pihakUtama(row.para_pihak) }}</div>
                <div style="width: 110px; font-size: 12px; color: var(--text-2);">{{ row.sipp_tanggal_register || '—' }}</div>
                <div style="width: 130px; font-size: 12px;">{{ row.sipp_status || '—' }}</div>
                <div style="width: 90px; font-size: 12px; color: var(--text-2);">{{ row.sipp_lama_proses || '—' }}</div>
            </div>
            <div v-if="!rows.length" class="ns-empty">Tidak ada perkara</div>
        </div>
    </div>
</template>
