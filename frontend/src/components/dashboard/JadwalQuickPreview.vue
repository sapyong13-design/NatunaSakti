<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { parseDateIndo } from '../../lib/date'
import Icon from '../Icon.vue'

const props = defineProps({
    row: { type: Object, default: null },
    show: { type: Boolean, default: false },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
})

const emit = defineEmits(['close'])

const tooltipRef = ref(null)

// Get next upcoming jadwal (today or future)
const nextJadwal = computed(() => {
    if (!props.row?.jadwal?.length) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcoming = props.row.jadwal
        .filter(j => {
            const jadwalDate = parseDateIndo(j.tanggal)
            return jadwalDate && jadwalDate >= today
        })
        .sort((a, b) => {
            const dateA = parseDateIndo(a.tanggal)
            const dateB = parseDateIndo(b.tanggal)
            return dateA - dateB
        })

    return upcoming[0] || null
})

const jadwalStatus = computed(() => {
    if (!nextJadwal.value) return null

    const status = nextJadwal.value.status?.toLowerCase() || ''
    if (status.includes('selesai')) return { label: 'Selesai', color: '#10b981', icon: 'check' }
    if (status.includes('tunda')) return { label: 'Ditunda', color: '#f59e0b', icon: 'clock' }
    return { label: 'Dijadwalkan', color: '#0891b2', icon: 'calendar' }
})

function getJadwalDate(jadwal) {
    if (!jadwal) return ''
    const date = parseDateIndo(jadwal.tanggal)
    if (!date) return jadwal.tanggal

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

// Position tooltip to stay within viewport
const tooltipStyle = computed(() => {
    const style = { left: `${props.x}px`, top: `${props.y + 10}px` }

    if (typeof window !== 'undefined') {
        const tooltipWidth = 280
        const tooltipHeight = 150

        if (props.x + tooltipWidth > window.innerWidth) {
            style.left = `${props.x - tooltipWidth}px`
        }
        if (props.y + 10 + tooltipHeight > window.innerHeight) {
            style.top = `${props.y - tooltipHeight - 10}px`
        }
    }

    return style
})

// Format waktu
function formatWaktu(waktu) {
    if (!waktu) return '—'
    return waktu.slice(0, 5) // HH:MM
}
</script>

<template>
    <Teleport to="body">
        <Transition name="ns-jadwal-preview">
            <div
                v-if="show && row"
                ref="tooltipRef"
                class="ns-jadwal-preview"
                :style="tooltipStyle"
            >
                <div v-if="nextJadwal" class="ns-jadwal-preview-content">
                    <div class="ns-jadwal-preview-header">
                        <Icon :name="jadwalStatus?.icon || 'calendar'" :size="14" />
                        <span class="ns-jadwal-preview-title">Sidang Berikutnya</span>
                        <span class="ns-jadwal-preview-status" :style="{ color: jadwalStatus?.color }">
                            {{ jadwalStatus?.label }}
                        </span>
                    </div>

                    <div class="ns-jadwal-preview-body">
                        <div class="ns-jadwal-preview-row">
                            <span class="ns-jadwal-preview-label">Tanggal</span>
                            <span class="ns-jadwal-preview-value">{{ getJadwalDate(nextJadwal) }}</span>
                        </div>
                        <div class="ns-jadwal-preview-row">
                            <span class="ns-jadwal-preview-label">Waktu</span>
                            <span class="ns-jadwal-preview-value">{{ formatWaktu(nextJadwal.waktu) }}</span>
                        </div>
                        <div v-if="nextJadwal.ruang" class="ns-jadwal-preview-row">
                            <span class="ns-jadwal-preview-label">Ruang</span>
                            <span class="ns-jadwal-preview-value">{{ nextJadwal.ruang }}</span>
                        </div>
                        <div v-if="nextJadwal.agenda" class="ns-jadwal-preview-row">
                            <span class="ns-jadwal-preview-label">Agenda</span>
                            <span class="ns-jadwal-preview-value">{{ nextJadwal.agenda }}</span>
                        </div>
                    </div>
                </div>
                <div v-else class="ns-jadwal-preview-empty">
                    <Icon name="calendar" :size="16" />
                    <span>Tidak ada jadwal sidang</span>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-jadwal-preview {
    position: fixed;
    min-width: 260px;
    max-width: 320px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    overflow: hidden;
    pointer-events: none;
}

.ns-jadwal-preview-content {
    padding: 12px;
}

.ns-jadwal-preview-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 10px;
}

.ns-jadwal-preview-header svg {
    color: var(--accent);
}

.ns-jadwal-preview-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    flex: 1;
}

.ns-jadwal-preview-status {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
}

.ns-jadwal-preview-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.ns-jadwal-preview-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
}

.ns-jadwal-preview-label {
    font-size: 11px;
    color: var(--text-3);
    font-weight: 500;
}

.ns-jadwal-preview-value {
    font-size: 11px;
    font-weight: 500;
    color: var(--text);
    text-align: right;
}

.ns-jadwal-preview-empty {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    font-size: 11px;
    color: var(--text-3);
}

.ns-jadwal-preview-empty svg {
    opacity: 0.5;
}

[data-mode="light"] .ns-jadwal-preview {
    background: #ffffff;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-jadwal-preview {
    background: #1e2129;
    border-color: #2d3748;
}

.ns-jadwal-preview-enter-active,
.ns-jadwal-preview-leave-active {
    transition: all 150ms ease;
}

.ns-jadwal-preview-enter-from,
.ns-jadwal-preview-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
</style>
