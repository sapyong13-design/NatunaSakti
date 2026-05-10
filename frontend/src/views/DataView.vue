<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import PageHeader from '../components/shell/PageHeader.vue'
import StatsStrip from '../components/dashboard/StatsStrip.vue'
import QuickStatsCards from '../components/dashboard/QuickStatsCards.vue'
import TrendCard from '../components/dashboard/TrendCard.vue'
import MiniStatCard from '../components/dashboard/MiniStatCard.vue'
import ToolbarFilters from '../components/dashboard/ToolbarFilters.vue'
import SyncCluster from '../components/dashboard/SyncCluster.vue'
import QuickActions from '../components/dashboard/QuickActions.vue'
import PerkaraTable from '../components/dashboard/PerkaraTable.vue'
import KanbanBoard from '../components/dashboard/KanbanBoard.vue'
import DetailPanel from '../components/dashboard/DetailPanel.vue'
import Toast from '../components/dashboard/Toast.vue'
import Skeleton from '../components/base/Skeleton.vue'
import EmptyState from '../components/base/EmptyState.vue'
import FilterChip from '../components/base/FilterChip.vue'
import Sparkline from '../components/base/Sparkline.vue'
import Toggles from '../components/dashboard/Toggles.vue'
import Icon from '../components/Icon.vue'
import { getPerkara, getSippStatus, getPerkaraTrendMonthly, getPerkaraTrendYearly } from '../lib/api'

const rows = ref([])
const trendData = ref([])
const syncStatus = ref({ total: 0, sipp_synced: 0, last_sync: null })
const isDark = ref(document.documentElement.dataset.mode === 'dark')
const loading = ref(true)
const density = ref('default')
const compareMode = ref(false)
const viewMode = ref('table') // table, kanban

// Quick filter states
const quickFilter = ref('all') // all, thisYear

// Toast state
const toast = ref({
    show: false,
    type: 'success',
    message: ''
})

const search = ref('')
const filterJenis = ref('Semua')
const filterTahun = ref(String(new Date().getFullYear()))
const filterStatus = ref('Semua')
const selectedTrendYear = ref(2026)

const selectedRow = ref(null)
const scrollPosition = ref(0)

// Pagination state
const currentPage = ref(1)
const itemsPerPage = 100

const filtered = computed(() => {
    let result = rows.value.filter(r => {
        if (filterJenis.value !== 'Semua' && r.jenis_perkara !== filterJenis.value) return false
        if (filterTahun.value && String(r.tahun_masuk) !== filterTahun.value) return false
        if (filterStatus.value === 'Bersidang' && r.sipp_status === 'Minutasi') return false
        if (filterStatus.value === 'Minutasi' && r.sipp_status !== 'Minutasi') return false
        if (search.value) {
            const q = search.value.toLowerCase()
            const nomor = (r.nomor_perkara || '').toLowerCase()
            const pihak = (r.para_pihak || '').toLowerCase()
            if (!nomor.includes(q) && !pihak.includes(q)) return false
        }
        return true
    })

    // Apply quick filter
    if (quickFilter.value === 'thisYear') {
        const currentYear = new Date().getFullYear()
        result = result.filter(r => r.tahun_masuk === currentYear)
    }

    // Sort by tanggal register (newest first)
    result.sort((a, b) => {
        const dateA = parseTanggal(a.sipp_tanggal_register)
        const dateB = parseTanggal(b.sipp_tanggal_register)
        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1
        return dateB - dateA // newest first
    })

    return result
})

// Pagination
const totalPages = computed(() => Math.ceil(filtered.value.length / itemsPerPage))
const paginatedRows = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filtered.value.slice(start, end)
})

const pageNumbers = computed(() => {
    const pages = []
    const maxVisible = 5
    let startPage = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
    let endPage = Math.min(totalPages.value, startPage + maxVisible - 1)

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
    }
    return pages
})

function goToPage(page) {
    if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }
}

// Quick filter counts
const quickFilterCounts = computed(() => {
    const currentYear = new Date().getFullYear()
    const thisYearCount = rows.value.filter(r => r.tahun_masuk === currentYear).length

    return {
        all: rows.value.length,
        thisYear: thisYearCount
    }
})

const stats = computed(() => ({
    total: rows.value.length,
    pidana: rows.value.filter(r => r.jenis_perkara === 'Pidana').length,
    perdata: rows.value.filter(r => r.jenis_perkara === 'Perdata').length,
    perikanan: rows.value.filter(r => r.jenis_perkara === 'Perikanan').length,
    aktif: rows.value.filter(r => {
        // Tahun < 2016 = tidak aktif
        if (r.tahun_masuk < 2016) return false
        // Status Minutasi/Putusan = tidak aktif
        if (r.sipp_status === 'Minutasi' || r.sipp_status === 'Putusan') return false
        return true
    }).length
}))

// Quick stats for cards
const quickStats = computed(() => ({
    total: rows.value.length,
    bersidang: rows.value.filter(r => r.sipp_status === 'Persidangan' || r.sipp_status === 'PERSIDANGAN').length,
    minutasi: rows.value.filter(r => r.sipp_status === 'Minutasi' || r.sipp_status === 'MINUTASI').length
}))

// Perkara with upcoming sidang (today/tomorrow) or actively in court
const upcomingPerkaraNumbers = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return rows.value
        .filter(r => {
            // Highlight if actively in court
            if (r.sipp_status === 'Persidangan' || r.sipp_status === 'PERSIDANGAN') return true

            // Or if registered within last 7 days
            const regDate = parseTanggal(r.sipp_tanggal_register)
            if (regDate) {
                const daysSinceReg = Math.floor((today - regDate) / (1000 * 60 * 60 * 24))
                if (daysSinceReg <= 7 && daysSinceReg >= 0) return true
            }

            return false
        })
        .map(r => r.nomor_perkara)
})

const monthMap = { jan:0, feb:1, mar:2, apr:3, mei:4, jun:5, jul:6, agu:7, sep:8, okt:9, nov:10, des:11, may:4, aug:7, oct:9, dec:11 }

function parseTanggal(s) {
    if (!s) return null
    const parts = s.trim().split(/\s+/)
    if (parts.length < 3) return null
    const day = parseInt(parts[0])
    const mon = monthMap[parts[1].toLowerCase().slice(0, 3)]
    const year = parseInt(parts[2])
    if (mon === undefined || isNaN(day) || isNaN(year)) return null
    return new Date(year, mon, day)
}

const avgDaysByType = computed(() => {
    // Filter by sipp_status === 'Minutasi' dan 3 tahun terakhir
    const currentYear = new Date().getFullYear()
    const completed = rows.value.filter(r => r.sipp_status === 'Minutasi' && r.tahun_masuk >= currentYear - 2)
    if (!completed.length) return { pidana: '—', perdata: '—', perikanan: '—' }

    let pidanaTotal = 0, pidanaCount = 0
    let perdataTotal = 0, perdataCount = 0
    let perikananTotal = 0, perikananCount = 0

    for (const r of completed) {
        // Parse sipp_lama_proses (e.g., "15 Hari", "1 Hari")
        const lamaProses = r.sipp_lama_proses || ''
        const match = lamaProses.match(/(\d+)\s*(Hari|hari)/)
        if (match) {
            const days = parseInt(match[1])
            if (r.jenis_perkara === 'Pidana') {
                pidanaTotal += days
                pidanaCount++
            } else if (r.jenis_perkara === 'Perdata') {
                perdataTotal += days
                perdataCount++
            } else if (r.jenis_perkara === 'Perikanan') {
                perikananTotal += days
                perikananCount++
            }
        }
    }

    return {
        pidana: pidanaCount > 0 ? `${Math.round(pidanaTotal / pidanaCount)} Hari` : '—',
        perdata: perdataCount > 0 ? `${Math.round(perdataTotal / perdataCount)} Hari` : '—',
        perikanan: perikananCount > 0 ? `${Math.round(perikananTotal / perikananCount)} Hari` : '—'
    }
})

const syncRate = computed(() => {
    if (!syncStatus.value.total) return '—'
    return ((syncStatus.value.sipp_synced / syncStatus.value.total) * 100).toFixed(1)
})

const tahunOptions = computed(() => {
    const set = new Set(rows.value.map(r => r.tahun_masuk).filter(Boolean))
    return Array.from(set).sort((a, b) => b - a)
})

const jenisOptions = ['Semua', 'Pidana', 'Perdata', 'Perikanan', 'Hukum']
const monthNames = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des']

const availableTrendYears = computed(() => {
    const set = new Set(rows.value.map(r => r.tahun_masuk).filter(Boolean))
    return Array.from(set).sort((a, b) => b - a)
})

async function loadTrendData() {
    try {
        if (quickFilter.value === 'thisYear') {
            trendData.value = await getPerkaraTrendMonthly(selectedTrendYear.value)
        } else {
            trendData.value = await getPerkaraTrendYearly()
        }
    } catch (err) {
        console.error('Failed to load trend:', err.message)
    }
}

// Watch quickFilter changes to reload trend data
watch(quickFilter, () => {
    loadTrendData()
})

// Reset page when filters change
watch([search, filterJenis, filterTahun, filterStatus], () => {
    currentPage.value = 1
})

async function loadAll() {
    loading.value = true
    try {
        const [perkaraRes, statusRes] = await Promise.all([
            getPerkara({ limit: 5000 }),
            getSippStatus()
        ])
        rows.value = Array.isArray(perkaraRes) ? perkaraRes : (perkaraRes.data || [])
        syncStatus.value = statusRes
        // Load trend data based on current quickFilter
        await loadTrendData()
    } catch (err) {
        console.error('Load failed:', err.message)
    } finally {
        loading.value = false
    }
}

function onRowDeleted(nomor) {
    rows.value = rows.value.filter(r => r.nomor_perkara !== nomor)
    selectedRow.value = null
}

function onMonthClick(month) {
    // Filter table to show data for selected month
    const monthNum = monthNames.indexOf(month.month?.slice(0, 3).toLowerCase()) + 1
    if (monthNum > 0) {
        search.value = ''
        console.log('Filter by month:', month)
    }
}

function showToast(type, message) {
    toast.value = { show: true, type, message }
}

function handleRefresh() {
    loadAll()
    showToast('success', 'Data diperbarui')
    // Trigger notification check
    window.dispatchEvent(new CustomEvent('sipp-synced'))
}

// Save scroll position before opening detail panel
function handleRowClick(row) {
    scrollPosition.value = window.pageYOffset || document.documentElement.scrollTop
    selectedRow.value = row
}

// Watch for detail panel close to restore scroll position
watch(selectedRow, (newVal, oldVal) => {
    if (oldVal && !newVal) {
        // Detail panel was just closed
        nextTick(() => {
            window.scrollTo({
                top: scrollPosition.value,
                behavior: 'instant'
            })
        })
    }
})

onMounted(() => {
    loadAll()
    const observer = new MutationObserver(() => {
        isDark.value = document.documentElement.dataset.mode === 'dark'
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] })
})
</script>

<template>
    <div class="ns-dashboard-view">
        <!-- Grain texture overlay -->
        <div class="ns-grain-overlay"></div>

        <PageHeader
            eyebrow="Dashboard"
            title="Data Perkara"
            sub="Daftar perkara aktif disinkronkan dengan SIPP"
        >
            <StatsStrip :stats="stats" />
        </PageHeader>

        <!-- Quick Stats Cards -->
        <QuickStatsCards :stats="quickStats" />

        <!-- Quick Filter Chips -->
        <div class="ns-quick-filters">
            <FilterChip
                label="Semua"
                :count="quickFilterCounts.all"
                :active="quickFilter === 'all'"
                @click="quickFilter = 'all'"
            />
            <FilterChip
                label="Tahun Ini"
                :count="quickFilterCounts.thisYear"
                :active="quickFilter === 'thisYear'"
                @click="quickFilter = 'thisYear'"
            />
        </div>

        <div class="ns-c-cards-row">
            <div class="ns-c-trend-wrapper">
                <select
                    v-show="quickFilter === 'thisYear'"
                    v-model="selectedTrendYear"
                    @change="loadTrendData"
                    class="ns-year-select"
                >
                    <option v-for="year in availableTrendYears" :key="year" :value="year">
                        Tahun {{ year }}
                    </option>
                </select>
                <TrendCard
                    :data="trendData"
                    :mode="quickFilter === 'thisYear' ? 'monthly' : 'yearly'"
                    :year="selectedTrendYear"
                    @period-click="onMonthClick"
                />
            </div>
            <div class="ns-c-side-cards">
                <div class="ns-c-avg-card" :class="{ 'is-dark': isDark }">
                    <div class="ns-stat-label">Rata-rata penyelesaian 3 tahun terakhir</div>
                    <div class="ns-c-avg-boxes">
                        <div class="ns-c-avg-box ns-c-avg-pidana">
                            <span class="ns-c-avg-value">{{ avgDaysByType.pidana }}</span>
                            <span class="ns-c-avg-type">Pidana</span>
                        </div>
                        <div class="ns-c-avg-box ns-c-avg-perdata">
                            <span class="ns-c-avg-value">{{ avgDaysByType.perdata }}</span>
                            <span class="ns-c-avg-type">Perdata</span>
                        </div>
                        <div class="ns-c-avg-box ns-c-avg-perikanan">
                            <span class="ns-c-avg-value">{{ avgDaysByType.perikanan }}</span>
                            <span class="ns-c-avg-type">Perikanan</span>
                        </div>
                    </div>
                    <div class="ns-c-avg-sub">Status: Minutasi</div>
                </div>
                <MiniStatCard
                    label="Sync rate"
                    :value="syncRate"
                    unit="%"
                    delta-text="Stabil"
                    delta-trend="up"
                    delta-icon="activity"
                />
            </div>
        </div>

        <div class="ns-toolbar">
            <ToolbarFilters
                v-model:search="search"
                v-model:jenis="filterJenis"
                v-model:tahun="filterTahun"
                v-model:status="filterStatus"
                :jenis-options="jenisOptions"
                :tahun-options="tahunOptions"
            />
            <div class="ns-toolbar-right">
                <!-- View Mode Toggle -->
                <div class="ns-view-toggle">
                    <button
                        class="ns-view-btn"
                        :class="{ active: viewMode === 'table' }"
                        @click="viewMode = 'table'"
                        title="Tabel View"
                    >
                        <Icon name="menu" :size="14" />
                    </button>
                    <button
                        class="ns-view-btn"
                        :class="{ active: viewMode === 'kanban' }"
                        @click="viewMode = 'kanban'"
                        title="Kanban View"
                    >
                        <Icon name="filter" :size="14" />
                    </button>
                </div>
                <Toggles type="density" v-model="density" />
                <SyncCluster :count="filtered.length" :total="rows.length" @synced="loadAll" />
                <QuickActions :rows="filtered" @refresh="handleRefresh" />
            </div>
        </div>

        <!-- Table with Skeleton Loading -->
        <Skeleton v-if="loading" type="table" />
        <EmptyState
            v-else-if="!filtered.length"
            icon="document"
            title="Tidak ada perkara"
            :description="search || filterJenis !== 'Semua' ? 'Coba sesuaikan filter pencarian Anda' : 'Belum ada data perkara yang tersedia'"
        />
        <template v-else>
            <!-- Table View -->
            <PerkaraTable
                v-if="viewMode === 'table'"
                :rows="paginatedRows"
                :start-index="(currentPage - 1) * itemsPerPage"
                :upcoming-perkara-numbers="upcomingPerkaraNumbers"
                @row-click="handleRowClick"
            />

            <!-- Kanban View -->
            <KanbanBoard
                v-else
                :rows="filtered"
                @row-click="handleRowClick"
            />

            <!-- Pagination (only for table view) -->
            <div v-if="viewMode === 'table' && totalPages > 1" class="ns-pagination">
                <span class="ns-pagination-info">
                    Menampilkan {{ ((currentPage - 1) * itemsPerPage) + 1 }}-{{ Math.min(currentPage * itemsPerPage, filtered.length) }} dari {{ filtered.length }} perkara
                </span>

                <div class="ns-pagination-controls">
                    <button
                        class="ns-pagination-btn"
                        :disabled="currentPage === 1"
                        @click="goToPage(currentPage - 1)"
                    >
                        &laquo; Prev
                    </button>

                    <button
                        v-if="pageNumbers[0] > 1"
                        class="ns-pagination-btn"
                        @click="goToPage(1)"
                    >
                        1
                    </button>
                    <span v-if="pageNumbers[0] > 2" class="ns-pagination-ellipsis">...</span>

                    <button
                        v-for="page in pageNumbers"
                        :key="page"
                        class="ns-pagination-btn"
                        :class="{ 'is-active': page === currentPage }"
                        @click="goToPage(page)"
                    >
                        {{ page }}
                    </button>

                    <span v-if="pageNumbers[pageNumbers.length - 1] < totalPages - 1" class="ns-pagination-ellipsis">...</span>
                    <button
                        v-if="pageNumbers[pageNumbers.length - 1] < totalPages"
                        class="ns-pagination-btn"
                        @click="goToPage(totalPages)"
                    >
                        {{ totalPages }}
                    </button>

                    <button
                        class="ns-pagination-btn"
                        :disabled="currentPage === totalPages"
                        @click="goToPage(currentPage + 1)"
                    >
                        Next &raquo;
                    </button>
                </div>
            </div>
        </template>

        <DetailPanel
            :row="selectedRow"
            :open="!!selectedRow"
            @close="selectedRow = null"
            @deleted="onRowDeleted"
        />

        <Toast
            :show="toast.show"
            :type="toast.type"
            :message="toast.message"
            @close="toast.show = false"
        />
    </div>
</template>

<style scoped>
.ns-c-trend-wrapper {
    position: relative;
    overflow-x: auto;
    overflow-y: visible;
}

.ns-year-select {
    position: absolute;
    top: 12px;
    right: 16px;
    z-index: 20;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg2);
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms;
}

.ns-year-select:hover {
    border-color: var(--accent);
    background: var(--surface);
}

.ns-c-avg-card {
    flex-shrink: 0;
    background: var(--bg, #fff);
    border-radius: 16px;
    padding: 12px 16px 16px;
    border: 1px solid var(--border);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.ns-c-avg-card.is-dark {
    background: var(--bg-dark, #1a1d23);
    border: 1px solid var(--border);
}

.ns-c-avg-boxes {
    display: flex;
    gap: 10px;
    margin-top: 4px;
}

.ns-c-avg-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    border-radius: 10px;
}

.ns-c-avg-pidana {
    background: var(--danger-soft, rgba(199, 91, 74, 0.12));
}

.ns-c-avg-pidana .ns-c-avg-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--danger, #C75B4A);
}

.ns-c-avg-pidana .ns-c-avg-type {
    font-size: 10px;
    color: var(--text2);
    margin-top: 2px;
}

.ns-c-avg-perdata {
    background: var(--success-soft, rgba(74, 124, 89, 0.12));
}

.ns-c-avg-perdata .ns-c-avg-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--success, #4A7C59);
}

.ns-c-avg-perdata .ns-c-avg-type {
    font-size: 10px;
    color: var(--text2);
    margin-top: 2px;
}

.ns-c-avg-perikanan {
    background: rgba(14, 165, 233, 0.12);
}

.ns-c-avg-perikanan .ns-c-avg-value {
    font-size: 20px;
    font-weight: 700;
    color: #0ea5e9;
}

.ns-c-avg-perikanan .ns-c-avg-type {
    font-size: 10px;
    color: var(--text2);
    margin-top: 2px;
}

.ns-c-avg-sub {
    margin-top: 10px;
    font-size: 9px;
    color: var(--text3);
    font-weight: 500;
    text-align: center;
}

.ns-toolbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
}

/* View Mode Toggle */
.ns-view-toggle {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 2px;
}

.ns-view-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition: all 150ms ease;
}

.ns-view-btn:hover {
    color: var(--text);
    background: var(--surface-2);
}

.ns-view-btn.active {
    color: var(--accent);
    background: var(--accent-soft);
}

[data-mode="light"] .ns-view-toggle {
    background: #f3f4f6;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-view-toggle {
    background: #1e2129;
    border-color: #2d3748;
}

/* Grain texture overlay */
.ns-dashboard-view {
    position: relative;
}

.ns-grain-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}

/* Quick Filters */
.ns-quick-filters {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}

.ns-quick-filters :deep(.ns-filter-chip) {
    animation: ns-stagger-fade-in 0.3s ease-out backwards;
}

.ns-quick-filters :deep(.ns-filter-chip:nth-child(1)) { animation-delay: 0.05s; }
.ns-quick-filters :deep(.ns-filter-chip:nth-child(2)) { animation-delay: 0.1s; }
.ns-quick-filters :deep(.ns-filter-chip:nth-child(3)) { animation-delay: 0.15s; }
.ns-quick-filters :deep(.ns-filter-chip:nth-child(4)) { animation-delay: 0.2s; }

@keyframes ns-stagger-fade-in {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Pagination */
.ns-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-top: 16px;
}

.ns-pagination-info {
    font-size: 13px;
    color: var(--text2);
}

.ns-pagination-controls {
    display: flex;
    align-items: center;
    gap: 4px;
}

.ns-pagination-btn {
    min-width: 36px;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms;
}

.ns-pagination-btn:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accentSoft);
    color: var(--accent);
}

.ns-pagination-btn.is-active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
}

.ns-pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.ns-pagination-ellipsis {
    padding: 0 4px;
    color: var(--text3);
    font-size: 13px;
}
</style>
