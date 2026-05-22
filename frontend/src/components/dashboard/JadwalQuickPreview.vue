<script setup>
import { ref, computed, watch } from 'vue'
import { parseDateIndo } from '../../lib/date'
import { getJadwalSidang } from '../../lib/api'
import Icon from '../Icon.vue'

const props = defineProps({
    row: { type: Object, default: null },
    show: { type: Boolean, default: false },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
})

const tooltipRef = ref(null)
const fetchedJadwal = ref([])
const loadingJadwal = ref(false)
const jadwalError = ref('')
let requestToken = 0

const jadwalRows = computed(() => {
    if (props.row?.jadwal?.length) return props.row.jadwal
    return fetchedJadwal.value
})

// Check if today is a holiday (simplified - could be connected to API)
const isHoliday = computed(() => {
    if (!nextJadwal.value) return false
    const date = parseDateIndo(nextJadwal.value.tanggal)
    if (!date) return false
    const day = date.getDay()
    const dayOfMonth = date.getDate()
    const month = date.getMonth()

    // Check Sunday
    if (day === 0) return true

    // Common Indonesian holidays (simplified)
    const holidays = [
        // [month, day] - 0-indexed month
        [0, 1],   // Jan 1 - Tahun Baru
        [2, 28],  // Mar 28 - Hari Raya Nyepi (example)
        [4, 1],   // May 1 - Hari Buruh
        [4, 17],  // May 17 - Hari Kebangkitan Nasional
        [7, 17],  // Aug 17 - Hari Kemerdekaan
        [11, 25], // Dec 25 - Hari Natal
    ]

    return holidays.some(h => h[0] === month && h[1] === dayOfMonth)
})

// Get next upcoming jadwal (today or future)
const nextJadwal = computed(() => {
    if (!jadwalRows.value.length) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcoming = jadwalRows.value
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

watch(
    () => [props.show, props.row?.nomor_perkara],
    async ([show, nomorPerkara]) => {
        const token = ++requestToken
        fetchedJadwal.value = []
        jadwalError.value = ''

        if (!show || !nomorPerkara || props.row?.jadwal?.length) return

        loadingJadwal.value = true
        try {
            const result = await getJadwalSidang(nomorPerkara)
            if (token !== requestToken) return
            fetchedJadwal.value = Array.isArray(result?.jadwal) ? result.jadwal : []
        } catch (err) {
            if (token !== requestToken) return
            jadwalError.value = err?.message || 'Gagal mengambil jadwal sidang'
        } finally {
            if (token === requestToken) loadingJadwal.value = false
        }
    }
)

// Check if jadwal is today
const isToday = computed(() => {
    if (!nextJadwal.value) return false
    const jadwalDate = parseDateIndo(nextJadwal.value.tanggal)
    if (!jadwalDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return jadwalDate.getTime() === today.getTime()
})

// Check if jadwal is within 24 hours (for countdown)
const isWithin24Hours = computed(() => {
    if (!nextJadwal.value) return false
    const jadwalDate = parseDateIndo(nextJadwal.value.tanggal)
    if (!jadwalDate) return false
    const now = new Date()
    const hoursUntil = (jadwalDate - now) / (1000 * 60 * 60)
    return hoursUntil > 0 && hoursUntil <= 24
})

// Calculate countdown hours
const countdownHours = computed(() => {
    if (!nextJadwal.value || !isWithin24Hours.value) return null
    const jadwalDate = parseDateIndo(nextJadwal.value.tanggal)
    if (!jadwalDate) return null
    const now = new Date()
    const hoursUntil = Math.ceil((jadwalDate - now) / (1000 * 60 * 60))
    return hoursUntil
})

// Time urgency color for countdown
const urgencyColor = computed(() => {
    if (!countdownHours.value) return null
    if (countdownHours.value <= 2) return '#ef4444'
    if (countdownHours.value <= 6) return '#f59e0b'
    return '#10b981'
})

const jadwalStatus = computed(() => {
    if (!nextJadwal.value) return null

    const status = nextJadwal.value.status?.toLowerCase() || ''
    if (status.includes('selesai')) return { label: 'Selesai', color: '#10b981', icon: 'check', variant: 'completed' }
    if (status.includes('tunda')) return { label: 'Ditunda', color: '#f59e0b', icon: 'clock', variant: 'missed' }
    return { label: 'Dijadwalkan', color: '#0891b2', icon: 'gavel', variant: 'upcoming' }
})

function getJadwalDate(jadwal) {
    if (!jadwal) return ''
    const date = parseDateIndo(jadwal.tanggal)
    if (!date) return jadwal.tanggal

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

// Get day and date for custom calendar icon
const calendarData = computed(() => {
    if (!nextJadwal.value) return null
    const date = parseDateIndo(nextJadwal.value.tanggal)
    if (!date) return null
    const days = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB']
    return {
        day: days[date.getDay()],
        date: date.getDate(),
        month: date.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase()
    }
})

const jadwalCount = computed(() => jadwalRows.value.length)

// Position tooltip to stay within viewport
const tooltipStyle = computed(() => {
    const style = { left: `${props.x}px`, top: `${props.y + 10}px` }

    if (typeof window !== 'undefined') {
        const tooltipWidth = 340
        const tooltipHeight = 200

        if (props.x + tooltipWidth > window.innerWidth) {
            style.left = `${Math.max(12, props.x - tooltipWidth)}px`
        }
        if (props.y + 10 + tooltipHeight > window.innerHeight) {
            style.top = `${Math.max(12, props.y - tooltipHeight - 10)}px`
        }
    }

    return style
})

// Get border color based on status
const statusBorderColor = computed(() => {
    if (!jadwalStatus.value) return 'var(--border)'
    const status = jadwalStatus.value.variant
    if (status === 'upcoming') return 'var(--accent)' // Mahogany/Gold for upcoming
    if (status === 'completed') return '#9ca3af' // Muted gray for completed
    if (status === 'missed') return '#ef4444' // Coral red for missed
    return 'var(--border)'
})

// Format waktu
function formatWaktu(waktu) {
    if (!waktu) return '-'
    return waktu.slice(0, 5) // HH:MM
}

function getWaktu(jadwal) {
    return jadwal?.waktu || jadwal?.jam || ''
}

function getRuang(jadwal) {
    return jadwal?.ruang || jadwal?.ruangan || ''
}

// Get para pihak truncated for preview
const paraPihakPreview = computed(() => {
    if (!props.row?.para_pihak) return null
    const text = props.row.para_pihak
    if (text.length <= 40) return text
    return text.substring(0, 40) + '…'
})

</script>

<template>
    <Teleport to="body">
        <Transition name="ns-jadwal-preview">
            <div
                v-if="show && row"
                ref="tooltipRef"
                class="ns-jadwal-preview"
                :class="{
                    'is-today': isToday,
                    'is-holiday': isHoliday,
                    [`status-${jadwalStatus?.variant}`]: jadwalStatus
                }"
                :style="{
                    ...tooltipStyle,
                    '--status-border': statusBorderColor,
                    '--urgency-color': urgencyColor
                }"
            >
                <div v-if="nextJadwal" class="ns-jadwal-preview-content">
                    <div class="ns-jadwal-preview-header">
                        <div class="ns-jadwal-status-indicator">
                            <Icon :name="jadwalStatus?.icon || 'gavel'" :size="12" class="ns-status-icon" />
                        </div>
                        <div class="ns-jadwal-title-stack">
                            <span class="ns-jadwal-preview-title">Jadwal Sidang</span>
                            <span class="ns-jadwal-case-number">{{ row?.nomor_perkara || '' }}</span>
                        </div>
                        <div class="ns-jadwal-status-stack">
                            <span class="ns-jadwal-preview-status" :style="{ color: jadwalStatus?.color }">
                                {{ jadwalStatus?.label }}
                            </span>
                            <span class="ns-jadwal-count">{{ jadwalCount }} jadwal</span>
                        </div>
                    </div>

                    <div class="ns-jadwal-preview-body">
                        <div class="ns-jadwal-date-box">
                            <div v-if="calendarData" class="ns-calendar-icon">
                                <span class="ns-calendar-day">{{ calendarData.day }}</span>
                                <span class="ns-calendar-date">{{ calendarData.date }}</span>
                                <span class="ns-calendar-month">{{ calendarData.month }}</span>
                            </div>
                        </div>

                        <div class="ns-jadwal-details">
                            <div class="ns-jadwal-full-date">{{ getJadwalDate(nextJadwal) }}</div>
                            <div class="ns-jadwal-meta-row">
                                <span class="ns-jadwal-time-box">{{ formatWaktu(getWaktu(nextJadwal)) }}</span>
                                <span v-if="getRuang(nextJadwal)" class="ns-jadwal-room-box">
                                    <Icon name="location" :size="10" />
                                    {{ getRuang(nextJadwal) }}
                                </span>
                            </div>

                            <div v-if="nextJadwal.agenda" class="ns-jadwal-agenda">
                                {{ nextJadwal.agenda }}
                            </div>

                            <div v-if="isWithin24Hours && countdownHours" class="ns-jadwal-countdown">
                                <div class="ns-countdown-bar" :style="{ background: `linear-gradient(90deg, ${urgencyColor}, ${urgencyColor}33)` }"></div>
                                <span class="ns-countdown-text">
                                    <Icon name="clock" :size="10" />
                                    {{ countdownHours }} jam lagi
                                </span>
                            </div>

                            <!-- Holiday warning -->
                            <div v-if="isHoliday" class="ns-jadwal-holiday-warning">
                                <Icon name="alert" :size="10" />
                                <span>Hari Libur</span>
                            </div>
                        </div>
                    </div>

                    <div v-if="paraPihakPreview" class="ns-jadwal-pihak" :title="row.para_pihak">
                        {{ paraPihakPreview }}
                    </div>
                </div>

                <!-- Empty state -->
                <div v-else-if="loadingJadwal" class="ns-jadwal-preview-empty">
                    <Icon name="sync" :size="20" />
                    <span>Mengambil jadwal sidang...</span>
                </div>

                <div v-else class="ns-jadwal-preview-empty">
                    <Icon name="calendar" :size="20" />
                    <span>{{ jadwalError || 'Tidak ada jadwal sidang' }}</span>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-jadwal-preview {
    position: fixed;
    width: min(380px, calc(100vw - 24px));
    min-width: min(320px, calc(100vw - 24px));
    max-width: calc(100vw - 24px);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    border-left: 4px solid var(--status-border, var(--accent));
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.18);
    z-index: var(--z-dropdown, 1200);
    overflow: hidden;
    pointer-events: none;
}

.ns-jadwal-preview-content {
    padding: 14px;
    position: relative;
}

.ns-jadwal-preview-header {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 10px;
}

.ns-jadwal-status-indicator {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    flex: 0 0 26px;
    display: grid;
    place-items: center;
    background: var(--accentSoft);
    color: var(--accent);
}

.ns-status-icon {
    animation: none;
}

.ns-jadwal-title-stack,
.ns-jadwal-status-stack {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}

.ns-jadwal-title-stack {
    flex: 1;
}

.ns-jadwal-status-stack {
    align-items: flex-end;
    text-align: right;
    flex: 0 0 auto;
}

.ns-jadwal-preview-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0;
}

.ns-jadwal-preview-status {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0;
}

.ns-jadwal-count {
    font-size: 10.5px;
    color: var(--text3);
    white-space: nowrap;
}

.ns-jadwal-preview-body {
    display: grid;
    grid-template-columns: 58px 1fr;
    gap: 12px;
    align-items: start;
}

.ns-jadwal-date-box {
    display: flex;
    align-items: flex-start;
}

.ns-calendar-icon {
    width: 54px;
    height: 68px;
    border: 1px solid var(--border);
    border-radius: 9px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--accentSoft) 0%, var(--surface) 100%);
    position: relative;
    overflow: hidden;
}

.ns-calendar-icon::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 17px;
    background: var(--accent);
    border-radius: 9px 9px 0 0;
}

.ns-calendar-day {
    font-size: 10px;
    font-weight: 700;
    color: var(--surface);
    text-transform: uppercase;
    letter-spacing: 0;
    position: relative;
    z-index: 1;
    margin-bottom: 7px;
}

.ns-calendar-date {
    font-size: 22px;
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
}

.ns-calendar-month {
    margin-top: 3px;
    font-size: 9.5px;
    font-weight: 700;
    color: var(--text3);
    letter-spacing: 0;
}

.ns-jadwal-details {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
}

.ns-jadwal-case-number {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text2);
    letter-spacing: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ns-jadwal-full-date {
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
}

.ns-jadwal-meta-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.ns-jadwal-time-box,
.ns-jadwal-room-box {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 7px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    font-weight: 600;
    border-radius: 6px;
    border: 1px solid var(--border);
}

.ns-jadwal-time-box {
    background: var(--accentSoft);
    border-color: var(--accent);
    color: var(--accent);
}

.ns-jadwal-room-box {
    max-width: 190px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--surface2);
    border-color: var(--border);
    color: var(--text2);
}

.ns-jadwal-agenda {
    font-family: inherit;
    font-style: normal;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text2);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* Countdown bar for urgency */
.ns-jadwal-countdown {
    position: relative;
    padding: 6px 10px;
    background: var(--surface2);
    border-radius: 6px;
    overflow: hidden;
}

.ns-countdown-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    opacity: 0.3;
}

.ns-countdown-text {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--urgency-color, var(--accent));
    text-transform: uppercase;
}

/* Holiday warning */
.ns-jadwal-holiday-warning {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: linear-gradient(135deg, rgba(199, 91, 74, 0.15) 0%, rgba(199, 91, 74, 0.08) 100%);
    border: 1px solid rgba(199, 91, 74, 0.3);
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--danger, #C75B4A);
    align-self: flex-start;
}

/* Para pihak preview */
.ns-jadwal-pihak {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text3);
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ns-jadwal-preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px;
    text-align: center;
}

.ns-jadwal-preview-empty svg {
    opacity: 0.3;
}

.ns-jadwal-preview-empty span {
    font-size: 12px;
    color: var(--text3);
}

/* Mode-specific styles */
[data-mode="light"] .ns-jadwal-preview {
    background: #ffffff;
    border-color: rgba(74, 28, 27, 0.15);
}

[data-mode="dark"] .ns-jadwal-preview {
    background: #242020;
    border-color: rgba(212, 184, 150, 0.15);
}

/* Today pulse effect */
.ns-jadwal-preview.is-today {
    animation: todayPulse 2s ease-in-out infinite;
}

@keyframes todayPulse {
    0%, 100% {
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.18), 0 0 0 0 rgba(245, 158, 11, 0.3);
    }
    50% {
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.18), 0 0 0 8px rgba(245, 158, 11, 0);
    }
}

.ns-jadwal-preview:hover {
    transform: translateY(-2px);
    box-shadow: 0 22px 52px rgba(0, 0, 0, 0.22);
}

/* Status variant colors */
.ns-jadwal-preview.status-upcoming {
    border-left-color: var(--accent);
}

.ns-jadwal-preview.status-completed {
    border-left-color: #9ca3af;
}

.ns-jadwal-preview.status-missed {
    border-left-color: #ef4444;
}

.ns-jadwal-preview.status-missed .ns-jadwal-status-indicator {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
}

.ns-jadwal-preview.status-completed .ns-jadwal-status-indicator {
    background: rgba(156, 163, 175, 0.15);
    color: #9ca3af;
}

.ns-jadwal-preview.status-completed .ns-status-icon {
    animation: none;
}

/* Entrance animation - pull document effect */
.ns-jadwal-preview-enter-active {
    transition: all 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ns-jadwal-preview-leave-active {
    transition: all 180ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ns-jadwal-preview-enter-from {
    opacity: 0;
    transform: translateY(20px) rotateX(10deg);
}

.ns-jadwal-preview-leave-to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
}

/* Responsive */
@media (max-width: 480px) {
    .ns-jadwal-preview {
        max-width: 280px;
    }

    .ns-jadwal-preview-body {
        grid-template-columns: 1fr;
        gap: 10px;
    }

    .ns-jadwal-date-box {
        justify-content: center;
    }
}
</style>
