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

// Position tooltip to stay within viewport
const tooltipStyle = computed(() => {
    const style = { left: `${props.x}px`, top: `${props.y + 10}px` }

    if (typeof window !== 'undefined') {
        const tooltipWidth = 340
        const tooltipHeight = 200

        if (props.x + tooltipWidth > window.innerWidth) {
            style.left = `${props.x - tooltipWidth}px`
        }
        if (props.y + 10 + tooltipHeight > window.innerHeight) {
            style.top = `${props.y - tooltipHeight - 10}px`
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
    if (!waktu) return '—'
    return waktu.slice(0, 5) // HH:MM
}

// Get para pihak truncated for preview
const paraPihakPreview = computed(() => {
    if (!props.row?.para_pihak) return null
    const text = props.row.para_pihak
    if (text.length <= 40) return text
    return text.substring(0, 40) + '...'
})

function handleViewFullJadwal() {
    emit('close')
    // Could emit an event to show full jadwal modal
    console.log('View full jadwal for:', props.row?.nomor_perkara)
}
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
                <!-- Gold Wax Seal Decoration -->
                <div class="ns-jadwal-wax-seal">
                    <span class="ns-wax-seal-text">PN</span>
                </div>

                <!-- Damask Pattern Overlay -->
                <div class="ns-jadwal-pattern"></div>

                <div v-if="nextJadwal" class="ns-jadwal-preview-content">
                    <!-- Header with status -->
                    <div class="ns-jadwal-preview-header">
                        <div class="ns-jadwal-status-indicator">
                            <Icon :name="jadwalStatus?.icon || 'gavel'" :size="12" class="ns-status-icon" />
                        </div>
                        <span class="ns-jadwal-preview-title">Jadwal Sidang</span>
                        <span class="ns-jadwal-preview-status" :style="{ color: jadwalStatus?.color }">
                            {{ jadwalStatus?.label }}
                        </span>
                    </div>

                    <!-- Body with asymmetrical layout -->
                    <div class="ns-jadwal-preview-body">
                        <!-- Left column: Calendar icon with date -->
                        <div class="ns-jadwal-date-box">
                            <div v-if="calendarData" class="ns-calendar-icon">
                                <span class="ns-calendar-day">{{ calendarData.day }}</span>
                                <span class="ns-calendar-date">{{ calendarData.date }}</span>
                            </div>
                        </div>

                        <!-- Right column: Details -->
                        <div class="ns-jadwal-details">
                            <!-- Case number with engraved treatment -->
                            <div class="ns-jadwal-case-number">
                                {{ row?.nomor_perkara || '' }}
                            </div>

                            <!-- Time and Room in monospace boxes -->
                            <div class="ns-jadwal-meta-row">
                                <span class="ns-jadwal-time-box">{{ formatWaktu(nextJadwal.waktu) }}</span>
                                <span v-if="nextJadwal.ruang" class="ns-jadwal-room-box">
                                    <Icon name="location" :size="10" />
                                    {{ nextJadwal.ruang }}
                                </span>
                            </div>

                            <!-- Agenda with italic serif -->
                            <div v-if="nextJadwal.agenda" class="ns-jadwal-agenda">
                                {{ nextJadwal.agenda }}
                            </div>

                            <!-- Countdown for urgent -->
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

                            <!-- Para pihak preview -->
                            <div v-if="paraPihakPreview" class="ns-jadwal-pihak" :title="row.para_pihak">
                                {{ paraPihakPreview }}
                            </div>
                        </div>
                    </div>

                    <!-- Footer with detail link -->
                    <div class="ns-jadwal-preview-footer">
                        <button class="ns-jadwal-detail-link" @click="handleViewFullJadwal">
                            <span>Lihat jadwal lengkap</span>
                            <Icon name="arrowRight" :size="11" />
                        </button>
                    </div>
                </div>

                <!-- Empty state -->
                <div v-else class="ns-jadwal-preview-empty">
                    <Icon name="calendar" :size="20" />
                    <span>Tidak ada jadwal sidang</span>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
/* Main container with embossed paper texture */
.ns-jadwal-preview {
    position: fixed;
    min-width: 300px;
    max-width: 360px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    border-left: 4px solid var(--status-border, var(--accent));
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.7),
        inset 0 -1px 0 rgba(0, 0, 0, 0.05),
        0 12px 48px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    overflow: hidden;
    pointer-events: auto;
    cursor: pointer;
    transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 200ms ease;
    position: relative;
}

/* Damask pattern overlay - very subtle legal motif */
.ns-jadwal-pattern {
    position: absolute;
    inset: 0;
    opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0c-2 8-8 14-16 16 8 2 14 8 16 16 2-8 8-14 16-16-8-2-14-8-16-16zm0 60c2-8 8-14 16-16-8-2-14-8-16-16-2 8-8 14-16 16 8 2 14 8 16 16z' fill='%234a1c1b' fill-opacity='1'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
}

[data-mode="dark"] .ns-jadwal-pattern {
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0c-2 8-8 14-16 16 8 2 14 8 16 16 2-8 8-14 16-16-8-2-14-8-16-16zm0 60c2-8 8-14 16-16-8-2-14-8-16-16-2 8-8 14-16 16 8 2 14 8 16 16z' fill='%23d4b896' fill-opacity='1'/%3E%3C/svg%3E");
}

/* Gold wax seal decoration */
.ns-jadwal-wax-seal {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #e5c07b, #b8943f, #8b6f3e);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    display: grid;
    place-items: center;
    z-index: 10;
    border: 2px solid rgba(184, 148, 63, 0.3);
}

.ns-wax-seal-text {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 11px;
    font-weight: 700;
    color: #4a1c1b;
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.3);
}

.ns-jadwal-preview-content {
    padding: 16px;
    position: relative;
    z-index: 1;
}

/* Header with status indicator */
.ns-jadwal-preview-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
}

.ns-jadwal-status-indicator {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accentSoft);
    color: var(--accent);
}

.ns-status-icon {
    animation: gavelTap 2s ease-in-out infinite;
}

@keyframes gavelTap {
    0%, 100% { transform: rotate(0deg); }
    10% { transform: rotate(-15deg); }
    20% { transform: rotate(0deg); }
}

.ns-jadwal-preview-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    flex: 1;
    letter-spacing: 0.02em;
}

.ns-jadwal-preview-status {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

/* Body with asymmetrical layout */
.ns-jadwal-preview-body {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 14px;
}

/* Calendar icon with highlighted date */
.ns-jadwal-date-box {
    display: flex;
    align-items: flex-start;
}

.ns-calendar-icon {
    width: 56px;
    height: 62px;
    border: 1px solid var(--border);
    border-radius: 8px;
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
    height: 18px;
    background: var(--accent);
    border-radius: 8px 8px 0 0;
}

.ns-calendar-day {
    font-size: 7px;
    font-weight: 600;
    color: var(--text3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 4px;
}

.ns-calendar-date {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
}

/* Details column */
.ns-jadwal-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* Case number with engraved treatment */
.ns-jadwal-case-number {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    color: var(--text);
    letter-spacing: -0.02em;
    padding: 4px 8px;
    background: var(--surface2);
    border-radius: 4px;
    border: 1px solid var(--border);
    text-shadow:
        0 1px 1px rgba(74, 28, 27, 0.15),
        0 0 0 1px rgba(74, 28, 27, 0.05);
}

/* Meta row with time and room */
.ns-jadwal-meta-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.ns-jadwal-time-box,
.ns-jadwal-room-box {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
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
    background: var(--warnSoft);
    border-color: var(--warn);
    color: var(--warn);
}

/* Agenda with italic serif */
.ns-jadwal-agenda {
    font-family: 'Playfair Display', Georgia, serif;
    font-style: italic;
    font-size: 12px;
    color: var(--text2);
    line-height: 1.4;
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
    font-size: 10px;
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
    font-size: 9px;
    font-weight: 600;
    color: var(--danger, #C75B4A);
    align-self: flex-start;
}

/* Para pihak preview */
.ns-jadwal-pihak {
    font-size: 10px;
    color: var(--text3);
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Footer with detail link */
.ns-jadwal-preview-footer {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
}

.ns-jadwal-detail-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    color: var(--text3);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 1px dotted var(--accent);
    padding-bottom: 2px;
    transition: all 180ms ease;
}

.ns-jadwal-detail-link:hover {
    color: var(--accent);
    border-bottom-style: solid;
}

.ns-jadwal-detail-link svg {
    transition: transform 180ms ease;
}

.ns-jadwal-detail-link:hover svg {
    transform: translateX(3px);
}

/* Empty state */
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
    font-size: 11px;
    color: var(--text3);
}

/* Mode-specific styles */
[data-mode="light"] .ns-jadwal-preview {
    background: linear-gradient(135deg, #ffffff 0%, #faf8f5 100%);
    border-color: rgba(74, 28, 27, 0.15);
}

[data-mode="dark"] .ns-jadwal-preview {
    background: linear-gradient(135deg, #242020 0%, #1a1816 100%);
    border-color: rgba(212, 184, 150, 0.15);
}

/* Today pulse effect */
.ns-jadwal-preview.is-today {
    animation: todayPulse 2s ease-in-out infinite;
}

@keyframes todayPulse {
    0%, 100% {
        box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.7),
            inset 0 -1px 0 rgba(0, 0, 0, 0.05),
            0 12px 48px rgba(0, 0, 0, 0.15),
            0 0 0 0 rgba(245, 158, 11, 0.3);
    }
    50% {
        box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.7),
            inset 0 -1px 0 rgba(0, 0, 0, 0.05),
            0 12px 48px rgba(0, 0, 0, 0.15),
            0 0 0 8px rgba(245, 158, 11, 0);
    }
}

/* Hover lift effect */
.ns-jadwal-preview:hover {
    transform: translateY(-4px);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.7),
        inset 0 -1px 0 rgba(0, 0, 0, 0.05),
        0 16px 56px rgba(0, 0, 0, 0.2);
}

/* Ripple effect on click */
.ns-jadwal-preview:active::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(circle at var(--click-x, 50%) var(--click-y, 50%), rgba(74, 28, 27, 0.1), transparent 60%);
    animation: rippleEffect 600ms ease-out forwards;
}

@keyframes rippleEffect {
    from { opacity: 1; transform: scale(0.8); }
    to { opacity: 0; transform: scale(1.5); }
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
