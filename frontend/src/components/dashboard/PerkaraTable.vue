<script setup>
import { ref, onUnmounted } from 'vue'
import { pihakUtama } from '../../lib/pihak'
import { formatDateIndo } from '../../lib/date'
import StatusBadge from './StatusBadge.vue'
import ContextualActionMenu from './ContextualActionMenu.vue'
import JadwalQuickPreview from './JadwalQuickPreview.vue'
import EnhancedTooltip from './EnhancedTooltip.vue'

const props = defineProps({
    rows: { type: Array, required: true },
    startIndex: { type: Number, default: 0 },
    upcomingPerkaraNumbers: { type: Array, default: () => [] }
})

const emit = defineEmits(['rowClick', 'menuAction'])

// Context menu state
const contextMenu = ref({
    show: false,
    x: 0,
    y: 0,
    row: null
})

// Jadwal preview state
const jadwalPreview = ref({
    show: false,
    x: 0,
    y: 0,
    row: null
})

// Enhanced tooltip state
const enhancedTooltip = ref({
    show: false,
    x: 0,
    y: 0,
    row: null
})

let previewTimeout = null
let tooltipTimeout = null

function handleContextMenu(e, row) {
    e.preventDefault()
    contextMenu.value = {
        show: true,
        x: e.clientX,
        y: e.clientY,
        row
    }
}

function handleMenuAction({ key, row }) {
    emit('menuAction', { key, row })
}

function handleMouseEnter(e, row) {
    // Clear existing timeout
    if (previewTimeout) {
        clearTimeout(previewTimeout)
    }

    // Show preview after 300ms delay
    previewTimeout = setTimeout(() => {
        const rect = e.target.getBoundingClientRect()
        jadwalPreview.value = {
            show: true,
            x: rect.left,
            y: rect.bottom + 4,
            row
        }
    }, 300)
}

function handleMouseLeave() {
    if (previewTimeout) {
        clearTimeout(previewTimeout)
    }
    jadwalPreview.value.show = false
}

function handleTooltipMouseEnter(e, row) {
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
    }

    tooltipTimeout = setTimeout(() => {
        const rect = e.target.getBoundingClientRect()
        enhancedTooltip.value = {
            show: true,
            x: rect.left,
            y: rect.bottom + 4,
            row
        }
    }, 200)
}

function handleTooltipMouseLeave() {
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
    }
    enhancedTooltip.value.show = false
}

onUnmounted(() => {
    if (previewTimeout) {
        clearTimeout(previewTimeout)
    }
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
    }
})

function isUpcoming(row) {
    return props.upcomingPerkaraNumbers?.includes(row.nomor_perkara)
}

function jenisColor(jenis) {
    if (jenis === 'Pidana') return '#C75B4A'
    if (jenis === 'Perdata') return '#4A7C59'
    if (jenis === 'Perikanan') return '#0ea5e9'
    return '#9ca3af'
}

function jenisBg(jenis) {
    if (jenis === 'Pidana') return 'rgba(199, 91, 74, 0.12)'
    if (jenis === 'Perdata') return 'rgba(74, 124, 89, 0.12)'
    if (jenis === 'Perikanan') return 'rgba(14, 165, 233, 0.12)'
    return 'rgba(156, 163, 175, 0.12)'
}

function formatDate(s) {
    return formatDateIndo(s)
}

// Parse lama_proses (e.g., "15 Hari", "1 Hari") to get days
function parseLamaProses(lama) {
    if (!lama) return 0
    const match = lama.match(/(\d+)\s*(Hari|hari)/)
    return match ? parseInt(match[1]) : 0
}

// Get progress color based on days
function getLamaColor(days) {
    if (days <= 30) return '#10b981'  // Green - fresh
    if (days <= 90) return '#f59e0b'  // Yellow - moderate
    if (days <= 180) return '#f97316' // Orange - long
    return '#ef4444'                   // Red - very long
}

// Get progress width (max 365 days = 100%)
function getLamaProgress(days) {
    return Math.min((days / 365) * 100, 100)
}
</script>

<template>
    <div class="ns-perkara-table-wrap">
        <div class="ns-table-scroll">
            <table class="ns-data-table">
                <thead>
                    <tr>
                        <th class="ns-sticky ns-col-no">No</th>
                        <th class="ns-sticky ns-col-jenis">Jenis</th>
                        <th class="ns-sticky ns-col-nomor">Nomor Perkara</th>
                        <th class="ns-col-nama">Nama</th>
                        <th class="ns-col-klasifikasi">Jenis Perkara</th>
                        <th class="ns-col-register">Tgl Register</th>
                        <th class="ns-col-status">Status</th>
                        <th class="ns-col-lama">Lama</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="!rows.length">
                        <td colspan="8" class="ns-empty-cell">
                            <div class="ns-empty-state">
                                <div class="ns-empty-icon">📋</div>
                                <div class="ns-empty-text">Tidak ada perkara</div>
                                <div class="ns-empty-hint">Coba sesuaikan filter atau sync data dari SIPP</div>
                            </div>
                        </td>
                    </tr>
                    <tr
                        v-else
                        v-for="(row, idx) in rows"
                        :key="row.id || row.nomor_perkara"
                        class="ns-data-row"
                        :class="{ 'is-upcoming-row': isUpcoming(row) }"
                        @click="emit('rowClick', row)"
                        @contextmenu="handleContextMenu($event, row)"
                    >
                        <td class="ns-sticky ns-col-no">{{ idx + 1 + props.startIndex }}</td>
                        <td class="ns-sticky ns-col-jenis">
                            <span
                                class="ns-jenis-badge"
                                :style="{
                                    '--jenis-color': jenisColor(row.jenis_perkara),
                                    '--jenis-bg': jenisBg(row.jenis_perkara)
                                }"
                            >
                                {{ row.jenis_perkara }}
                            </span>
                        </td>
                        <td class="ns-sticky ns-col-nomor">
                            <span
                                class="ns-nomor-text"
                                @mouseenter="handleMouseEnter($event, row)"
                                @mouseleave="handleMouseLeave"
                            >{{ row.nomor_perkara }}</span>
                        </td>
                        <td class="ns-col-nama">
                            <span
                                class="ns-nama-text"
                                @mouseenter="handleTooltipMouseEnter($event, row)"
                                @mouseleave="handleTooltipMouseLeave"
                            >{{ pihakUtama(row.para_pihak) }}</span>
                        </td>
                        <td class="ns-col-klasifikasi">
                            <span class="ns-klasifikasi-text">{{ row.sipp_klasifikasi || row.nama_perkara || '—' }}</span>
                        </td>
                        <td class="ns-col-register">{{ formatDate(row.sipp_tanggal_register) }}</td>
                        <td class="ns-col-status">
                            <StatusBadge v-if="row.sipp_status" :status="row.sipp_status" size="sm" />
                            <span v-else class="ns-status-text">—</span>
                        </td>
                        <td class="ns-col-lama">
                            <div class="ns-lama-cell">
                                <span class="ns-lama-text">{{ row.sipp_lama_proses || '—' }}</span>
                                <div
                                    v-if="row.sipp_lama_proses"
                                    class="ns-lama-bar"
                                    :style="{
                                        width: getLamaProgress(parseLamaProses(row.sipp_lama_proses)) + '%',
                                        background: getLamaColor(parseLamaProses(row.sipp_lama_proses))
                                    }"
                                ></div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="ns-table-footer">
            <span class="ns-row-count">{{ rows.length }} perkara</span>
            <span class="ns-scroll-hint">← Scroll untuk lihat semua kolom →</span>
        </div>

        <ContextualActionMenu
            :show="contextMenu.show"
            :x="contextMenu.x"
            :y="contextMenu.y"
            :row="contextMenu.row"
            @close="contextMenu.show = false"
            @action="handleMenuAction"
        />

        <JadwalQuickPreview
            :show="jadwalPreview.show"
            :x="jadwalPreview.x"
            :y="jadwalPreview.y"
            :row="jadwalPreview.row"
            @close="jadwalPreview.show = false"
        />

        <EnhancedTooltip
            :show="enhancedTooltip.show"
            :x="enhancedTooltip.x"
            :y="enhancedTooltip.y"
            :row="enhancedTooltip.row"
            @close="enhancedTooltip.show = false"
        />
    </div>
</template>

<style scoped>
.ns-perkara-table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
}

.ns-table-scroll {
    overflow-x: auto;
    max-width: 100%;
}

.ns-table-scroll::-webkit-scrollbar {
    height: 8px;
}

.ns-table-scroll::-webkit-scrollbar-track {
    background: transparent;
}

.ns-table-scroll::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
}

.ns-table-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--text-3);
}

.ns-data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    min-width: 900px;
}

.ns-data-table thead {
    position: sticky;
    top: 0;
    z-index: 10;
}

.ns-data-table th {
    text-align: left;
    padding: 14px 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
    background: var(--bg-2);
    border-bottom: 1px solid var(--border);
}

.ns-data-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
}

.ns-data-table tbody tr:last-child td {
    border-bottom: none;
}

.ns-data-row {
    cursor: pointer;
    transition: background 120ms ease, box-shadow 120ms ease;
}

.ns-data-row:hover {
    background: var(--surface-2);
}

.ns-data-row:hover .ns-sticky {
    background: var(--surface-2);
}

[data-mode="light"] .ns-data-row:hover .ns-sticky {
    background: rgba(255, 255, 255, 0.92);
}

[data-mode="dark"] .ns-data-row:hover .ns-sticky {
    background: rgba(26, 24, 22, 0.92);
}

/* Priority highlighting for upcoming sidang */
.ns-data-row.is-upcoming-row {
    position: relative;
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.02));
}

.ns-data-row.is-upcoming-row .ns-col-no {
    border-left: 3px solid #f59e0b;
}

.ns-data-row.is-upcoming-row:hover {
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04));
}

[data-mode="dark"] .ns-data-row.is-upcoming-row {
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.03));
}

[data-mode="dark"] .ns-data-row.is-upcoming-row:hover {
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.05));
}

/* Sticky columns with glassmorphism */
.ns-sticky {
    position: sticky;
    left: 0;
    background: var(--surface);
    z-index: 1;
    transition: background 120ms ease;
    /* Glassmorphism effect */
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-right: 1px solid var(--border);
}

[data-mode="light"] .ns-sticky {
    background: rgba(255, 255, 255, 0.85);
    box-shadow: 2px 0 8px rgba(74, 28, 27, 0.06);
}

[data-mode="dark"] .ns-sticky {
    background: rgba(26, 24, 22, 0.85);
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
}

.ns-data-table thead .ns-sticky {
    z-index: 11;
    background: var(--bg-2);
}

[data-mode="light"] .ns-data-table thead .ns-sticky {
    background: rgba(250, 248, 245, 0.95);
}

[data-mode="dark"] .ns-data-table thead .ns-sticky {
    background: rgba(38, 32, 32, 0.95);
}

.ns-col-no {
    left: 0;
    width: 50px;
    text-align: center;
    padding-left: 12px;
}

.ns-col-jenis {
    left: 50px;
    width: 100px;
}

.ns-col-nomor {
    left: 150px;
    width: 180px;
}

.ns-col-nama {
    min-width: 160px;
    max-width: 220px;
}

.ns-col-klasifikasi {
    min-width: 140px;
    max-width: 200px;
}

.ns-klasifikasi-text {
    display: block;
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.4;
}

.ns-col-register {
    width: 110px;
    white-space: nowrap;
}

.ns-col-status {
    width: 140px;
}

.ns-col-lama {
    width: 120px;
}

.ns-lama-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.ns-lama-text {
    font-size: 12px;
}

.ns-lama-bar {
    height: 3px;
    border-radius: 2px;
    transition: width 300ms ease;
}

/* Cell content */
.ns-col-no {
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
}

.ns-jenis-badge {
    display: inline-flex;
    align-items: center;
    padding: 5px 11px;
    border-radius: 7px;
    font-size: 11px;
    font-weight: 600;
    background: var(--jenis-bg);
    color: var(--jenis-color);
    transition: all 180ms ease;
}

.ns-jenis-badge:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px var(--jenis-color);
}

.ns-nomor-text {
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
}

.ns-nama-text {
    display: block;
    font-weight: 500;
    line-height: 1.4;
}

.ns-col-register,
.ns-col-status,
.ns-col-lama {
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
}

/* Focus states for accessibility */
.ns-data-row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    background: var(--accentSoft);
}

.ns-data-row:focus-visible .ns-sticky {
    background: var(--accentSoft);
}

[data-mode="light"] .ns-data-row:focus-visible .ns-sticky {
    background: rgba(74, 28, 27, 0.08);
}

[data-mode="dark"] .ns-data-row:focus-visible .ns-sticky {
    background: rgba(201, 169, 98, 0.12);
}

.ns-status-text {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--surface-2);
    font-size: 11px;
}

/* Empty state */
.ns-empty-cell {
    padding: 0 !important;
}

.ns-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
    text-align: center;
}

.ns-empty-icon {
    font-size: 40px;
    margin-bottom: 12px;
    opacity: 0.5;
}

.ns-empty-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
    margin-bottom: 4px;
}

.ns-empty-hint {
    font-size: 12px;
    color: var(--text-3);
}

/* Footer */
.ns-table-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--surface-2);
    border-top: 1px solid var(--border);
    font-size: 11px;
}

.ns-row-count {
    font-weight: 500;
    color: var(--text);
}

.ns-scroll-hint {
    color: var(--text-3);
}
</style>
