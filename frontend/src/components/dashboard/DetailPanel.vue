<script setup>
import { ref, watch, computed } from 'vue'
import Icon from '../Icon.vue'
import { getJadwalSidang, refreshJadwal, deletePerkara } from '../../lib/api'
import { pihakUtama } from '../../lib/pihak'
import { parseDateIndo, formatDateIndo } from '../../lib/date'

const props = defineProps({
    row: { type: Object, default: null },
    open: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'deleted'])

const jadwal = ref([])
const isDark = computed(() => document.documentElement.dataset.mode === 'dark')
const loadingJadwal = ref(false)
const refreshing = ref(false)
const deleting = ref(false)

// Get month from Indonesian date string
function getMonthFromIndoDate(dateStr) {
    if (!dateStr) return null
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    for (const month of months) {
        if (dateStr.includes(month)) return month
    }
    return null
}

// Format date to Indonesian
function formatDate(date) {
    return formatDateIndo(date)
}

// Group jadwal by month - hanya yang punya tanggal valid
const groupedJadwal = computed(() => {
    const groups = {}
    jadwal.value.forEach((j, i) => {
        const month = getMonthFromIndoDate(j.tanggal)
        if (!month) return // Skip jadwal tanpa tanggal valid
        if (!groups[month]) groups[month] = []
        groups[month].push({ ...j, originalIndex: i })
    })
    return groups
})

// Jadwal tanpa tanggal valid (pisah)
const jadwalTanpaTanggal = computed(() => {
    return jadwal.value.filter((j, i) => !getMonthFromIndoDate(j.tanggal))
})

// Get the last jadwal index (for Minutasi "Selesai" badge)
const lastJadwalIndex = computed(() => {
    return jadwal.value.length > 0 ? jadwal.value.length - 1 : -1
})

// Check if this is the last jadwal
function isLastJadwal(originalIndex) {
    return originalIndex === lastJadwalIndex.value
}

// Check if a jadwal object is the last one (for jadwal tanpa tanggal)
function isLastJadwalItem(jadwalItem) {
    if (lastJadwalIndex.value < 0) return false
    const lastJadwal = jadwal.value[lastJadwalIndex.value]
    // Compare by reference or by unique properties
    return lastJadwal === jadwalItem ||
           (lastJadwal.tanggal === jadwalItem.tanggal &&
            lastJadwal.agenda === jadwalItem.agenda &&
            lastJadwal.ruangan === jadwalItem.ruangan)
}

// Get jenis sidang color
function getJenisColor(jenis) {
    const colors = {
        'Pembacaan Putusan': '#10b981',
        'Pemeriksaan Saksi': '#3b82f6',
        'Pembuktian': '#f59e0b',
        'Konsolidasi': '#8b5cf6',
        'Tanggapan Terdakwa': '#ef4444',
        'Tuntutan': '#ec4899',
        'Pledoi': '#06b6d4',
        'Replik': '#84cc16'
    }
    return colors[jenis] || '#9ca3af'
}

// Get jenis perkara gradient for header
function getJenisPerkaraGradient(jenis) {
    const gradients = {
        'Pidana': 'linear-gradient(135deg, #C75B4A 0%, #a84838 100%)',
        'Perdata': 'linear-gradient(135deg, #4A7C59 0%, #3a6349 100%)',
        'Perikanan': 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
    }
    return gradients[jenis] || 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
}

function getJenisPerkaraTextColor(jenis) {
    return '#ffffff'
}

// Calculate progress
const jadwalProgress = computed(() => {
    if (!jadwal.value.length) return { completed: 0, total: 0, percentage: 0 }
    const isMinutasi = props.row?.sipp_status === 'Minutasi'
    if (isMinutasi) return { completed: jadwal.value.length, total: jadwal.value.length, percentage: 100 }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const completed = jadwal.value.filter(j => {
        const date = parseDateIndo(j.tanggal)
        return date && date < today
    }).length
    return {
        completed,
        total: jadwal.value.length,
        percentage: Math.round((completed / jadwal.value.length) * 100)
    }
})

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

// Check if jadwal is upcoming, past, or completed
function getJadwalStatus(jadwalItem, isMinutasi) {
    if (!jadwalItem.tanggal) return 'unknown'
    // Parse Indonesian date format using utility
    const jadwalDate = parseDateIndo(jadwalItem.tanggal)
    if (!jadwalDate) return 'unknown'

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return jadwalDate >= today ? 'upcoming' : 'past'
}

watch(() => props.row, (newRow) => {
    if (newRow) loadJadwal(newRow.nomor_perkara)
})
</script>

<template>
    <Teleport to="body">
        <Transition name="ns-backdrop">
            <div v-if="open" class="ns-detail-backdrop" @click="emit('close')" />
        </Transition>
        <Transition name="ns-panel">
            <aside v-if="open && row" class="ns-detail-panel">
                <header class="ns-detail-head" :style="{ background: getJenisPerkaraGradient(row.jenis_perkara) }">
                    <div>
                        <div class="ns-detail-eyebrow">{{ row.jenis_perkara }}</div>
                        <h2 class="ns-detail-title ns-mono">{{ row.nomor_perkara }}</h2>
                        <div class="ns-detail-pihak">{{ pihakUtama(row.para_pihak) }}</div>
                    </div>
                    <button class="ns-icon-btn ns-icon-btn-light" type="button" @click="emit('close')" aria-label="Close">
                        <Icon name="close" :size="18" class="close-icon" />
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
                                <div class="ns-detail-field-value">{{ formatDate(row.sipp_tanggal_register) }}</div>
                            </div>
                            <div class="ns-detail-field">
                                <div class="ns-detail-field-label">Tahun Masuk</div>
                                <div class="ns-detail-field-value">{{ row.tahun_masuk }}</div>
                            </div>
                            <div class="ns-detail-field">
                                <div class="ns-detail-field-label">Tanggal Putus</div>
                                <div class="ns-detail-field-value">{{ formatDate(row.tanggal_putus) }}</div>
                            </div>
                        </div>
                    </div>

                    <div class="ns-detail-section ns-jadwal-section">
                        <div class="ns-detail-section-title">Jadwal Sidang</div>

                        <!-- Progress Bar -->
                        <div v-if="jadwal.length > 0" class="ns-jadwal-progress-wrap">
                            <div class="ns-jadwal-progress-info">
                                <span class="ns-progress-label">Progres Sidang</span>
                                <span class="ns-progress-value">{{ jadwalProgress.completed }} dari {{ jadwalProgress.total }} selesai ({{ jadwalProgress.percentage }}%)</span>
                            </div>
                            <div class="ns-jadwal-progress-bar">
                                <div class="ns-jadwal-progress-fill" :style="{ width: `${jadwalProgress.percentage}%` }"></div>
                            </div>
                        </div>

                        <!-- Loading Skeleton -->
                        <div v-if="loadingJadwal" class="ns-jadwal-loading">
                            <div v-for="i in 3" :key="i" class="ns-jadwal-skeleton">
                                <div class="ns-jadwal-skeleton-date"></div>
                                <div class="ns-jadwal-skeleton-time"></div>
                                <div class="ns-jadwal-skeleton-content"></div>
                                <div class="ns-jadwal-skeleton-content-sm"></div>
                            </div>
                        </div>

                        <!-- Empty State -->
                        <div v-else-if="!jadwal.length" class="ns-jadwal-empty">
                            <div class="ns-jadwal-empty-icon">
                                <Icon name="calendar" :size="36" />
                            </div>
                            <p>Tidak ada jadwal sidang</p>
                            <span>Klik "Refresh Jadwal" untuk memuat data terbaru dari SIPP</span>
                        </div>

                        <!-- Jadwal Timeline with Month Grouping -->
                        <div v-else class="ns-jadwal-timeline">
                            <template v-for="(group, month) in groupedJadwal" :key="month">
                                <!-- Month Header -->
                                <div class="ns-jadwal-month-header">{{ month }}</div>

                                <div
                                    v-for="(j, i) in group"
                                    :key="j.originalIndex"
                                    class="ns-jadwal-card"
                                    :class="{
                                        'is-upcoming': getJadwalStatus(j, false) === 'upcoming' && row.sipp_status !== 'Minutasi',
                                        'is-past': getJadwalStatus(j, false) === 'past' && row.sipp_status !== 'Minutasi',
                                        'is-completed': row.sipp_status === 'Minutasi' && isLastJadwal(j.originalIndex) && (!j.alasanDitunda || j.alasanDitunda === '0'),
                                        'is-postponed': j.alasanDitunda && j.alasanDitunda !== '0'
                                    }"
                                    :style="{
                                        animationDelay: `${j.originalIndex * 50}ms`
                                    }"
                                >
                                    <!-- Badges -->
                                    <div class="ns-jadwal-badges">
                                        <!-- Selesai Badge HANYA untuk jadwal terakhir saat Minutasi -->
                                        <div v-if="row.sipp_status === 'Minutasi' && isLastJadwal(j.originalIndex) && (!j.alasanDitunda || j.alasanDitunda === '0')" class="ns-jadwal-completed-badge">
                                            <Icon name="check" :size="9" />
                                            Selesai
                                        </div>

                                        <!-- Postponed Badge (tetap tampil meskipun Minutasi) -->
                                        <div v-if="j.alasanDitunda && j.alasanDitunda !== '0'" class="ns-jadwal-postponed-badge">
                                            <Icon name="gavel" :size="11" />
                                            Ditunda
                                        </div>

                                        <!-- Scheduled Badge untuk Upcoming (bukan Minutasi) -->
                                        <div v-else-if="getJadwalStatus(j, false) === 'upcoming' && row.sipp_status !== 'Minutasi'" class="ns-jadwal-scheduled-badge">
                                            <Icon name="clock" :size="11" />
                                            Dijadwalkan
                                        </div>

                                        <!-- Past Badge untuk jadwal yang sudah lewat (bukan Minutasi) -->
                                        <div v-else-if="getJadwalStatus(j, false) === 'past' && row.sipp_status !== 'Minutasi'" class="ns-jadwal-past-badge">
                                            Lewat
                                        </div>
                                    </div>

                                    <!-- Date & Time Row -->
                                    <div class="ns-jadwal-datetime-row">
                                        <div class="ns-jadwal-date">
                                            <Icon name="calendar" :size="13" />
                                            {{ j.tanggal || 'TBD' }}
                                        </div>
                                        <div v-if="j.jam" class="ns-jadwal-time">
                                            <Icon name="clock" :size="11" />
                                            {{ j.jam }}
                                        </div>
                                    </div>

                                    <!-- Agenda -->
                                    <div class="ns-jadwal-agenda">{{ j.agenda || '—' }}</div>

                                    <!-- Ruangan -->
                                    <div v-if="j.ruangan" class="ns-jadwal-room">
                                        <Icon name="location" :size="11" />
                                        {{ j.ruangan }}
                                    </div>

                                    <!-- Alasan Ditunda -->
                                    <div v-if="j.alasanDitunda && j.alasanDitunda !== '0'" class="ns-jadwal-postponed">
                                        <Icon name="alert" :size="11" />
                                        Ditunda: {{ j.alasanDitunda }}
                                    </div>
                                </div>
                            </template>

                            <!-- Jadwal tanpa tanggal valid -->
                            <template v-if="jadwalTanpaTanggal.length > 0">
                                <div
                                    v-for="(j, i) in jadwalTanpaTanggal"
                                    :key="'no-date-' + i"
                                    class="ns-jadwal-card"
                                    :class="{
                                        'is-postponed': j.alasanDitunda && j.alasanDitunda !== '0'
                                    }"
                                >
                                    <!-- Badges -->
                                    <div class="ns-jadwal-badges">
                                        <!-- Postponed Badge (prioritas) -->
                                        <div v-if="j.alasanDitunda && j.alasanDitunda !== '0'" class="ns-jadwal-postponed-badge">
                                            <Icon name="gavel" :size="11" />
                                            Ditunda
                                        </div>
                                        <!-- Selesai Badge hanya untuk item terakhir saat Minutasi -->
                                        <div v-else-if="row.sipp_status === 'Minutasi' && isLastJadwalItem(j) && (!j.alasanDitunda || j.alasanDitunda === '0')" class="ns-jadwal-completed-badge">
                                            <Icon name="check" :size="9" />
                                            Selesai
                                        </div>
                                    </div>

                                    <!-- Agenda -->
                                    <div class="ns-jadwal-agenda">{{ j.agenda || 'Jadwal sidang' }}</div>

                                    <!-- Ruangan -->
                                    <div v-if="j.ruangan" class="ns-jadwal-room">
                                        <Icon name="location" :size="11" />
                                        {{ j.ruangan }}
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>

                <div class="ns-detail-actions">
                    <button class="ns-btn ns-btn-ghost" type="button" :disabled="refreshing" @click="handleRefreshJadwal">
                        <Icon :name="refreshing ? 'sync' : 'refresh'" :size="14" :class="{ 'ns-spin': refreshing, 'refresh-icon': !refreshing }" />
                        {{ refreshing ? 'Refreshing...' : 'Refresh Jadwal' }}
                    </button>
                    <button class="ns-btn ns-btn-danger" type="button" :disabled="deleting" @click="handleDelete">
                        <Icon name="trash" :size="14" />
                        {{ deleting ? 'Deleting...' : 'Delete' }}
                    </button>
                </div>
            </aside>
        </Transition>
    </Teleport>
</template>

<style scoped>
.ns-backdrop-enter-active,
.ns-backdrop-leave-active {
    transition: opacity 200ms ease;
}
.ns-backdrop-enter-from,
.ns-backdrop-leave-to {
    opacity: 0;
}
.ns-panel-enter-active,
.ns-panel-leave-active {
    transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}
.ns-panel-enter-from,
.ns-panel-leave-to {
    transform: translateX(100%);
}

/* Staggered content animations */
.ns-detail-panel > * {
    animation: slideInUp 0.4s ease-out backwards;
}

.ns-detail-head {
    animation-delay: 0ms;
}

.ns-detail-body {
    animation-delay: 60ms;
}

.ns-detail-actions {
    animation-delay: 120ms;
}

@keyframes slideInUp {
    from {
        opacity: 0;
        transform: translateY(12px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Progress Bar Styles */
.ns-jadwal-progress-wrap {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--surface-2);
    border-radius: 10px;
    border: 1px solid var(--border);
}

[data-mode="light"] .ns-jadwal-progress-wrap {
    background: #f9fafb;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-jadwal-progress-wrap {
    background: #1a1d23;
    border-color: #2d3748;
}

.ns-jadwal-progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.ns-progress-label {
    font-size: 11px;
    font-weight: 600;
    color: #1f2937;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

[data-mode="dark"] .ns-progress-label {
    color: #e5e7eb;
}

.ns-progress-value {
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
    font-family: "JetBrains Mono", monospace;
}

[data-mode="dark"] .ns-progress-value {
    color: #9ca3af;
}

.ns-jadwal-progress-bar {
    position: relative;
    height: 8px;
    background: var(--surface);
    border-radius: 10px;
    overflow: hidden;
}

[data-mode="light"] .ns-jadwal-progress-bar {
    background: #e5e7eb;
}

[data-mode="dark"] .ns-jadwal-progress-bar {
    background: #2d3748;
}

.ns-jadwal-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #0891b2, #0ea5e9);
    border-radius: 10px;
    transition: width 0.6s cubic-bezier(0.32, 0.72, 0, 1);
    position: relative;
}

.ns-jadwal-progress-fill::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    animation: progressShimmer 2s ease-in-out infinite;
}

@keyframes progressShimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

/* Jadwal Sidang Timeline dengan Vertical Line - Optimized */
.ns-jadwal-timeline {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    /* CSS containment for better performance */
    contain: layout style;
}

/* Vertical Timeline Line - REMOVED */
.ns-jadwal-timeline::before {
    display: none;
}

[data-mode="dark"] .ns-jadwal-timeline::before {
    display: none;
}

/* Month Header Styles */
.ns-jadwal-month-header {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0 4px 0;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 700;
    color: #0891b2;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    background: var(--surface-2);
    border-radius: 6px;
}

.ns-jadwal-month-header::before {
    content: '';
    position: absolute;
    left: -10px;
    width: 10px;
    height: 10px;
    background: #0891b2;
    border-radius: 50%;
    box-shadow: 0 0 0 4px var(--surface);
}

[data-mode="light"] .ns-jadwal-month-header::before {
    background: #0891b2;
    box-shadow: 0 0 0 4px #ffffff;
}

[data-mode="dark"] .ns-jadwal-month-header::before {
    background: #22d3ee;
    box-shadow: 0 0 0 4px #1a1d23;
}

/* Jadwal Card - Optimized for performance */
.ns-jadwal-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px 14px 40px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    border-left: 3px solid var(--border);
    /* CSS containment - isolates repaints */
    contain: layout style paint;
    /* Simplified animation */
    animation: fadeInSlide 0.15s ease-out backwards;
}

[data-mode="light"] .ns-jadwal-card {
    background: #ffffff;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-jadwal-card {
    background: #1e2129;
    border-color: #2d3748;
}

/* Timeline Dot - Optimized */
.ns-jadwal-card::after {
    content: '';
    position: absolute;
    left: 19px;
    top: 18px;
    width: 8px;
    height: 8px;
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: 50%;
    /* GPU acceleration */
    transform: translateZ(0);
    will-change: transform, background-color, border-color;
    transition: transform 150ms ease, background-color 150ms ease, border-color 150ms ease;
    z-index: 1;
}

[data-mode="light"] .ns-jadwal-card::after {
    background: #ffffff;
    border-color: #d1d5db;
}

[data-mode="dark"] .ns-jadwal-card::after {
    background: #1e2129;
    border-color: #4a5568;
}

/* Simplified hover effect - no shadow for performance */
.ns-jadwal-card:hover {
    border-left-width: 4px;
}

.ns-jadwal-card:hover::after {
    background: var(--accent);
    border-color: var(--accent);
    transform: scale(1.1);
}

.ns-jadwal-card.is-upcoming::after {
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(8, 145, 178, 0.1);
}

.ns-jadwal-card.is-completed::after {
    background: #10b981;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
    transform: scale(1.1) translateZ(0);
}

[data-mode="dark"] .ns-jadwal-card.is-completed::after {
    background: #10b981;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
}

.ns-jadwal-card.is-postponed::after {
    background: var(--warn);
    border-color: var(--warn);
}

@keyframes fadeInSlide {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

/* Card States */
.ns-jadwal-card.is-upcoming {
    border-left-color: var(--accent);
    background: linear-gradient(135deg,
        rgba(8, 145, 178, 0.06) 0%,
        rgba(8, 145, 178, 0.02) 50%,
        transparent 100%);
}

[data-mode="dark"] .ns-jadwal-card.is-upcoming {
    background: linear-gradient(135deg,
        rgba(8, 145, 178, 0.12) 0%,
        rgba(8, 145, 178, 0.04) 50%,
        transparent 100%);
}

/* Ensure completed card styling is applied with high priority */
.ns-jadwal-card.is-completed {
    border-left: 5px solid #10b981 !important;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.12) 50%, rgba(16, 185, 129, 0.05) 100%) !important;
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.4), 0 4px 16px rgba(16, 185, 129, 0.2) !important;
}

[data-mode="dark"] .ns-jadwal-card.is-completed {
    border-left: 5px solid #10b981 !important;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(16, 185, 129, 0.18) 50%, rgba(16, 185, 129, 0.08) 100%) !important;
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.5), 0 4px 20px rgba(16, 185, 129, 0.3) !important;
}

.ns-jadwal-card.is-past {
    border-left-color: var(--text-3);
    opacity: 0.75;
}

.ns-jadwal-card.is-postponed {
    border-left-color: var(--warn);
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.04), transparent);
}

[data-mode="dark"] .ns-jadwal-card.is-postponed {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), transparent);
}

/* Badges Container */
.ns-jadwal-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

/* Badges */
.ns-jadwal-scheduled-badge,
.ns-jadwal-completed-badge,
.ns-jadwal-postponed-badge,
.ns-jadwal-past-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.ns-jadwal-scheduled-badge {
    background: linear-gradient(135deg, #0891b2, #0ea5e9);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(8, 145, 178, 0.3);
}

.ns-jadwal-completed-badge {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
    border: 1px solid #059669;
}

/* Ensure completed badge overrides other styles */
.ns-jadwal-badges .ns-jadwal-completed-badge {
    background: linear-gradient(135deg, #10b981, #059669) !important;
    color: #ffffff !important;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.5) !important;
}

.ns-jadwal-postponed-badge {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.ns-jadwal-past-badge {
    background: var(--surface-2);
    color: #9ca3af;
    border: 1px solid var(--border);
}

[data-mode="light"] .ns-jadwal-past-badge {
    background: #f3f4f6;
    color: #9ca3af;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-jadwal-past-badge {
    background: #2d3748;
    color: #9ca3af;
    border-color: #4a5568;
}

/* Date & Time Row */
.ns-jadwal-datetime-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}

.ns-jadwal-date {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #1f2937;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

[data-mode="dark"] .ns-jadwal-date {
    color: #e5e7eb;
}

.ns-jadwal-time {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(8, 145, 178, 0.12);
    color: #0891b2;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
}

[data-mode="dark"] .ns-jadwal-time {
    background: rgba(8, 145, 178, 0.2);
    color: #22d3ee;
}

.ns-jadwal-agenda {
    font-size: 13px;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.4;
}

[data-mode="dark"] .ns-jadwal-agenda {
    color: #f3f4f6;
}

.ns-jadwal-room {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    font-size: 12px;
    color: #6b7280;
    background: #f3f4f6;
    border-radius: 6px;
}

[data-mode="dark"] .ns-jadwal-room {
    color: #9ca3af;
    background: #2d3748;
}

.ns-jadwal-postponed {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(245, 158, 11, 0.12);
    color: #d97706;
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
}

[data-mode="dark"] .ns-jadwal-postponed {
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
    border-color: rgba(245, 158, 11, 0.35);
}

/* Loading Skeleton */
.ns-jadwal-loading {
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
}

.ns-jadwal-skeleton {
    position: relative;
    padding: 14px 16px 14px 40px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
}

[data-mode="light"] .ns-jadwal-skeleton {
    background: #ffffff;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-jadwal-skeleton {
    background: #1e2129;
    border-color: #2d3748;
}

.ns-jadwal-skeleton::before {
    content: '';
    position: absolute;
    left: 19px;
    top: 18px;
    width: 8px;
    height: 8px;
    background: #e5e7eb;
    border: 2px solid #d1d5db;
    border-radius: 50%;
}

[data-mode="dark"] .ns-jadwal-skeleton::before {
    background: #2d3748;
    border-color: #4a5568;
}

.ns-jadwal-skeleton-date {
    width: 120px;
    height: 14px;
    background: linear-gradient(
        90deg,
        #e5e7eb 0%,
        #f3f4f6 40%,
        #e5e7eb 100%
    );
    background-size: 200% 100%;
    border-radius: 4px;
    animation: shimmer 1.8s ease-in-out infinite;
}

[data-mode="dark"] .ns-jadwal-skeleton-date {
    background: linear-gradient(
        90deg,
        #2d3748 0%,
        #4a5568 40%,
        #2d3748 100%
    );
}

.ns-jadwal-skeleton-time {
    width: 80px;
    height: 12px;
    margin-top: 8px;
    background: linear-gradient(
        90deg,
        #e5e7eb 0%,
        #f3f4f6 40%,
        #e5e7eb 100%
    );
    background-size: 200% 100%;
    border-radius: 4px;
    animation: shimmer 1.8s ease-in-out infinite 0.3s;
}

[data-mode="dark"] .ns-jadwal-skeleton-time {
    background: linear-gradient(
        90deg,
        #2d3748 0%,
        #4a5568 40%,
        #2d3748 100%
    );
}

.ns-jadwal-skeleton-content {
    width: 70%;
    height: 14px;
    margin-top: 10px;
    background: linear-gradient(
        90deg,
        #e5e7eb 0%,
        #f3f4f6 40%,
        #e5e7eb 100%
    );
    background-size: 200% 100%;
    border-radius: 4px;
    animation: shimmer 1.8s ease-in-out infinite 0.5s;
}

[data-mode="dark"] .ns-jadwal-skeleton-content {
    background: linear-gradient(
        90deg,
        #2d3748 0%,
        #4a5568 40%,
        #2d3748 100%
    );
}

.ns-jadwal-skeleton-content-sm {
    width: 50%;
    height: 12px;
    margin-top: 8px;
    background: linear-gradient(
        90deg,
        #e5e7eb 0%,
        #f3f4f6 40%,
        #e5e7eb 100%
    );
    background-size: 200% 100%;
    border-radius: 4px;
    animation: shimmer 1.8s ease-in-out infinite 0.7s;
}

[data-mode="dark"] .ns-jadwal-skeleton-content-sm {
    background: linear-gradient(
        90deg,
        #2d3748 0%,
        #4a5568 40%,
        #2d3748 100%
    );
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* Empty State */
.ns-jadwal-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    text-align: center;
    background: var(--surface-2);
    border: 2px dashed var(--border);
    border-radius: 16px;
}

[data-mode="light"] .ns-jadwal-empty {
    background: #f9fafb;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-jadwal-empty {
    background: #1a1d23;
    border-color: #2d3748;
}

.ns-jadwal-empty-icon {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    background: var(--surface);
    border-radius: 14px;
    margin-bottom: 16px;
    color: #9ca3af;
}

[data-mode="light"] .ns-jadwal-empty-icon {
    background: #ffffff;
    color: #9ca3af;
}

[data-mode="dark"] .ns-jadwal-empty-icon {
    background: #1e2129;
    color: #6b7280;
}

.ns-jadwal-empty p {
    margin: 0 0 6px;
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
}

[data-mode="dark"] .ns-jadwal-empty p {
    color: #e5e7eb;
}

.ns-jadwal-empty span {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.5;
}

[data-mode="dark"] .ns-jadwal-empty span {
    color: #9ca3af;
}

/* Micro-interaction pada Buttons */
.ns-icon-btn:active {
    transform: scale(0.92);
}

.ns-icon-btn-light:active {
    transform: scale(0.92);
}

.ns-icon-btn:hover :deep(.refresh-icon) {
    transform: rotate(180deg);
}

.ns-icon-btn:hover :deep(.close-icon) {
    transform: rotate(90deg);
}

.ns-icon-btn-light:hover :deep(.close-icon) {
    transform: rotate(90deg);
}

.ns-icon-btn :deep(.refresh-icon),
.ns-icon-btn :deep(.close-icon),
.ns-icon-btn-light :deep(.close-icon) {
    transition: transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ns-spin {
    animation: smoothSpin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes smoothSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* Detail Panel Styles - Dark Mode Fixes */
.ns-detail-panel {
    background: var(--surface);
    color: var(--text);
    /* GPU acceleration for smooth animations */
    will-change: transform;
    backface-visibility: hidden;
    -webkit-font-smoothing: antialiased;
}

[data-mode="light"] .ns-detail-panel {
    background: #ffffff;
}

[data-mode="dark"] .ns-detail-panel {
    background: #1a1d23;
}

.ns-detail-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid transparent;
}

.ns-detail-head > div {
    flex: 1;
    min-width: 0;
}

.ns-detail-eyebrow {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 6px;
}

.ns-detail-title {
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 8px;
}

.ns-detail-pihak {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.95);
    line-height: 1.5;
}

/* Light icon button for colored header */
.ns-icon-btn-light {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.15);
    border: none;
}

.ns-icon-btn-light:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.25);
}

.ns-detail-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px 22px;
    position: relative;
    /* Smooth scroll optimizations */
    -webkit-overflow-scrolling: touch;
    /* Enable GPU acceleration for smoother scrolling */
    transform: translateZ(0);
}

/* Custom scrollbar for webkit browsers */
.ns-detail-body::-webkit-scrollbar {
    width: 6px;
}

.ns-detail-body::-webkit-scrollbar-track {
    background: transparent;
}

.ns-detail-body::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
}

.ns-detail-body::-webkit-scrollbar-thumb:hover {
    background: var(--text-3);
}

/* Sticky Jadwal Sidang Section */
.ns-jadwal-section {
    position: sticky !important;
    top: 0 !important;
    z-index: 10 !important;
    background: var(--surface);
    padding: 16px;
    margin: -16px -22px 16px -22px;
    border-bottom: 1px solid var(--border);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
}

[data-mode="light"] .ns-jadwal-section {
    background: rgba(255, 255, 255, 0.98);
    border-bottom-color: #e5e7eb;
}

[data-mode="dark"] .ns-jadwal-section {
    background: rgba(26, 29, 35, 0.98);
    border-bottom-color: #2d3748;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.ns-detail-status-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--surface-2);
    border-radius: 10px;
    margin-bottom: 20px;
}

[data-mode="light"] .ns-detail-status-card {
    background: #f9fafb;
}

[data-mode="dark"] .ns-detail-status-card {
    background: #1e2129;
}

.ns-detail-status-card > div {
    font-size: 13px;
    color: #1f2937;
    font-weight: 500;
}

[data-mode="dark"] .ns-detail-status-card > div {
    color: #e5e7eb;
}

.ns-detail-status-sub {
    font-size: 12px;
    color: #6b7280;
    margin-top: 2px;
}

[data-mode="dark"] .ns-detail-status-sub {
    color: #9ca3af;
}

.ns-detail-section {
    margin-bottom: 24px;
}

.ns-detail-section-title {
    font-size: 13px;
    font-weight: 700;
    color: #1f2937;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 12px;
}

[data-mode="dark"] .ns-detail-section-title {
    color: #e5e7eb;
}

.ns-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.ns-detail-field {
    padding: 10px 12px;
    background: var(--surface-2);
    border-radius: 8px;
}

[data-mode="light"] .ns-detail-field {
    background: #f9fafb;
}

[data-mode="dark"] .ns-detail-field {
    background: #1e2129;
}

.ns-detail-field-label {
    font-size: 10px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
}

[data-mode="dark"] .ns-detail-field-label {
    color: #9ca3af;
}

.ns-detail-field-value {
    font-size: 13px;
    font-weight: 500;
    color: #1f2937;
}

[data-mode="dark"] .ns-detail-field-value {
    color: #e5e7eb;
}

.ns-detail-actions {
    position: sticky;
    bottom: 0;
    display: flex;
    gap: 10px;
    padding: 16px 0;
    margin: 16px 0 0 0;
    border-top: 1px solid var(--border);
    background: transparent;
    z-index: 5;
}

.ns-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: #6b7280;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
}

[data-mode="dark"] .ns-icon-btn {
    color: #9ca3af;
}

.ns-icon-btn:hover {
    color: #1f2937;
    background: #f3f4f6;
}

[data-mode="dark"] .ns-icon-btn:hover {
    color: #f3f4f6;
    background: #2d3748;
}

/* Button Styles */
.ns-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
}

.ns-btn-ghost {
    color: #4b5563;
    background: #f3f4f6;
}

[data-mode="dark"] .ns-btn-ghost {
    color: #d1d5db;
    background: #2d3748;
}

.ns-btn-danger {
    color: #ffffff;
    background: #ef4444;
}

.ns-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>