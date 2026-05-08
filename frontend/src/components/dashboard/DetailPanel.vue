<script setup>
import { ref, watch } from 'vue'
import Icon from '../Icon.vue'
import { getJadwalSidang, refreshJadwal, deletePerkara } from '../../lib/api'

const props = defineProps({
    row: { type: Object, default: null },
    open: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'deleted'])

const jadwal = ref([])
const loadingJadwal = ref(false)
const refreshing = ref(false)
const deleting = ref(false)

async function loadJadwal(nomor) {
    loadingJadwal.value = true
    jadwal.value = []
    try {
        const res = await getJadwalSidang(nomor)
        jadwal.value = res.jadwal || []
    } catch (err) {
        console.error('Load jadwal failed:', err.message)
    } finally {
        loadingJadwal.value = false
    }
}

async function handleRefreshJadwal() {
    if (!props.row) return
    refreshing.value = true
    try {
        const res = await refreshJadwal(props.row.nomor_perkara)
        jadwal.value = res.jadwal || []
    } catch (err) {
        console.error('Refresh jadwal failed:', err.message)
        alert('Gagal refresh jadwal: ' + err.message)
    } finally {
        refreshing.value = false
    }
}

async function handleDelete() {
    if (!props.row) return
    if (!window.confirm(`Hapus perkara ${props.row.nomor_perkara}?`)) return
    deleting.value = true
    try {
        await deletePerkara(props.row.id)
        emit('deleted', props.row.nomor_perkara)
        emit('close')
    } catch (err) {
        console.error('Delete failed:', err.message)
        alert('Gagal hapus: ' + err.message)
    } finally {
        deleting.value = false
    }
}

watch(() => props.row, (newRow) => {
    if (newRow) loadJadwal(newRow.nomor_perkara)
})
</script>

<template>
    <Teleport to="body">
        <div v-if="open" class="ns-detail-backdrop" @click="emit('close')" />
        <aside v-if="open && row" class="ns-detail-panel">
            <header class="ns-detail-head">
                <div>
                    <div class="ns-detail-eyebrow">{{ row.jenis_perkara }}</div>
                    <h2 class="ns-detail-title ns-mono">{{ row.nomor_perkara }}</h2>
                    <div class="ns-detail-pihak">{{ row.para_pihak }}</div>
                </div>
                <button class="ns-icon-btn" type="button" @click="emit('close')" aria-label="Close">
                    <Icon name="close" :size="18" />
                </button>
            </header>

            <div class="ns-detail-body">
                <div class="ns-detail-status-card">
                    <span class="ns-detail-status-pulse" />
                    <div>
                        <div>{{ row.sipp_status || 'Status tidak diketahui' }}</div>
                        <div class="ns-detail-status-sub">Lama proses: {{ row.sipp_lama_proses || '—' }}</div>
                    </div>
                </div>

                <div class="ns-detail-section">
                    <div class="ns-detail-section-title">Informasi Perkara</div>
                    <div class="ns-detail-grid">
                        <div class="ns-detail-field">
                            <div class="ns-detail-field-label">Klasifikasi</div>
                            <div class="ns-detail-field-value">{{ row.sipp_klasifikasi || '—' }}</div>
                        </div>
                        <div class="ns-detail-field">
                            <div class="ns-detail-field-label">Tanggal Register</div>
                            <div class="ns-detail-field-value">{{ row.sipp_tanggal_register || '—' }}</div>
                        </div>
                        <div class="ns-detail-field">
                            <div class="ns-detail-field-label">Tahun Masuk</div>
                            <div class="ns-detail-field-value">{{ row.tahun_masuk }}</div>
                        </div>
                        <div class="ns-detail-field">
                            <div class="ns-detail-field-label">Tanggal Putus</div>
                            <div class="ns-detail-field-value">{{ row.tanggal_putus || '—' }}</div>
                        </div>
                    </div>
                </div>

                <div class="ns-detail-section">
                    <div class="ns-detail-section-title">Jadwal Sidang</div>
                    <div v-if="loadingJadwal" style="padding: 16px; color: var(--text-3); font-size: 13px;">Memuat...</div>
                    <div v-else-if="!jadwal.length" class="ns-empty">Tidak ada jadwal sidang</div>
                    <div v-else style="display: flex; flex-direction: column; gap: 10px;">
                        <div v-for="(j, i) in jadwal" :key="i" class="ns-detail-agenda">
                            <div style="font-weight: 600;">{{ j.tanggal }}<span v-if="j.jam" style="color: var(--text-3); font-weight: 400; margin-left: 8px;">{{ j.jam }}</span></div>
                            <div style="margin-top: 4px;">{{ j.agenda }}</div>
                            <div v-if="j.ruangan" class="ns-detail-status-sub">{{ j.ruangan }}</div>
                            <div v-if="j.alasanDitunda && j.alasanDitunda !== '0'" style="margin-top: 4px; font-size: 11.5px; color: var(--warn);">Ditunda: {{ j.alasanDitunda }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="ns-detail-actions">
                <button class="ns-btn ns-btn-ghost" type="button" :disabled="refreshing" @click="handleRefreshJadwal">
                    <Icon name="refresh" :size="14" />
                    {{ refreshing ? 'Refreshing...' : 'Refresh Jadwal' }}
                </button>
                <button class="ns-btn ns-btn-danger" type="button" :disabled="deleting" @click="handleDelete">
                    <Icon name="trash" :size="14" />
                    {{ deleting ? 'Deleting...' : 'Delete' }}
                </button>
            </div>
        </aside>
    </Teleport>
</template>