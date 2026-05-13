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
const syncClusterRef = ref(null)

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

const activeFilterSummary = computed(() => {
    const parts = []
    if (filterJenis.value !== 'Semua') parts.push(filterJenis.value)
    if (filterTahun.value) parts.push(`Tahun ${filterTahun.value}`)
    if (filterStatus.value !== 'Semua') {
        parts.push(filterStatus.value === 'Bersidang' ? 'Sedang Bersidang' : filterStatus.value)
    }
    if (quickFilter.value === 'thisYear') parts.push('Tahun Ini')
    if (search.value.trim()) parts.push(`Cari "${search.value.trim()}"`)
    return parts.length ? parts.join(' · ') : 'Semua perkara'
})

const activeFilterChips = computed(() => {
    const chips = []
    if (filterJenis.value !== 'Semua') chips.push({ key: 'jenis', label: filterJenis.value })
    if (filterTahun.value) chips.push({ key: 'tahun', label: `Tahun ${filterTahun.value}` })
    if (filterStatus.value !== 'Semua') {
        chips.push({
            key: 'status',
            label: filterStatus.value === 'Bersidang' ? 'Sedang Bersidang' : filterStatus.value
        })
    }
    if (quickFilter.value === 'thisYear') chips.push({ key: 'quick', label: 'Tahun Ini' })
    if (search.value.trim()) chips.push({ key: 'search', label: `Cari "${search.value.trim()}"` })
    return chips
})

const hasActiveFilters = computed(() => {
    return Boolean(
        search.value.trim() ||
        filterJenis.value !== 'Semua' ||
        filterStatus.value !== 'Semua' ||
        quickFilter.value !== 'all'
    )
})

function resetFilters() {
    search.value = ''
    filterJenis.value = 'Semua'
    filterStatus.value = 'Semua'
    quickFilter.value = 'all'
    filterTahun.value = String(new Date().getFullYear())
    currentPage.value = 1
}

function removeFilterChip(key) {
    if (key === 'jenis') filterJenis.value = 'Semua'
    if (key === 'tahun') filterTahun.value = ''
    if (key === 'status') filterStatus.value = 'Semua'
    if (key === 'quick') quickFilter.value = 'all'
    if (key === 'search') search.value = ''
    currentPage.value = 1
}

function handleEmptyAction(action) {
    if (action.key === 'sync') triggerSippSync()
    if (action.key === 'reset') resetFilters()
}

function triggerSippSync() {
    syncClusterRef.value?.sync()
}

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

// Perkara yang sedang bersidang (highlight kuning)
const upcomingPerkaraNumbers = computed(() => {
    return rows.value
        .filter(r => {
            // Highlight if actively in court (status contains "sidang")
            const status = (r.sipp_status || '').toLowerCase()
            return status.includes('sidang') || r.first_sidang_soon
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

const attentionStats = computed(() => {
    const active = rows.value.filter(r => {
        const status = (r.sipp_status || '').toLowerCase()
        return status.includes('sidang') || r.first_sidang_soon
    }).length
    const unsynced = Math.max((syncStatus.value.total || 0) - (syncStatus.value.sipp_synced || 0), 0)
    const completedThisYear = rows.value.filter(r => {
        const status = (r.sipp_status || '').toLowerCase()
        return status.includes('minutasi') && Number(r.tahun_masuk) === new Date().getFullYear()
    }).length

    return [
        {
            key: 'active',
            label: 'Sedang berjalan',
            value: active,
            tone: 'warn'
        },
        {
            key: 'unsynced',
            label: 'Belum sinkron',
            value: unsynced,
            tone: unsynced > 0 ? 'danger' : 'safe'
        },
        {
            key: 'completed',
            label: 'Minutasi tahun ini',
            value: completedThisYear,
            tone: 'safe'
        }
    ]
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

// Handle context menu actions
function handleMenuAction({ key, row }) {
    switch (key) {
        case 'detail':
            handleRowClick(row)
            break
        case 'refresh':
            showToast('success', `Refresh jadwal ${row.nomor_perkara}`)
            // TODO: Implement jadwal refresh
            break
        case 'copy':
            navigator.clipboard.writeText(row.nomor_perkara)
            showToast('success', 'Nomor perkara disalin')
            break
        case 'sipp':
            const sippUrl = `https://sipp.badilum.net/natuna/perkara/${row.nomor_perkara.replace(/\//g, '-')}`
            window.open(sippUrl, '_blank')
            break
    }
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
        <PageHeader
            eyebrow="Dashboard"
            title="Data Perkara"
            sub="Daftar perkara aktif disinkronkan dengan SIPP"
        >
            <StatsStrip :stats="stats" />
        </PageHeader>

        <!-- Quick Stats Cards -->
        <div v-if="loading" class="ns-stats-skeleton">
            <div v-for="i in 3" :key="i" class="ns-stat-skeleton-card">
                <div class="ns-stat-skeleton-icon"></div>
                <div class="ns-stat-skeleton-content">
                    <div class="ns-stat-skeleton-value"></div>
                    <div class="ns-stat-skeleton-label"></div>
                </div>
            </div>
        </div>
        <QuickStatsCards v-else :stats="quickStats" />

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
                        aria-label="Tampilkan tabel"
                        @click="viewMode = 'table'"
                        title="Tabel View"
                    >
                        <Icon name="menu" :size="14" />
                    </button>
                    <button
                        class="ns-view-btn"
                        :class="{ active: viewMode === 'kanban' }"
                        aria-label="Tampilkan kanban"
                        @click="viewMode = 'kanban'"
                        title="Kanban View"
                    >
                        <Icon name="filter" :size="14" />
                    </button>
                </div>
                <Toggles type="density" v-model="density" />
                <SyncCluster ref="syncClusterRef" :count="filtered.length" :total="rows.length" @synced="loadAll" />
                <QuickActions :rows="filtered" @refresh="handleRefresh" />
            </div>
        </div>

        <div class="ns-filter-summary" aria-live="polite">
            <div class="ns-filter-summary-main">
                <span class="ns-filter-summary-label">Tampilan</span>
                <strong>{{ activeFilterSummary }}</strong>
                <div v-if="activeFilterChips.length" class="ns-filter-chip-list">
                    <button
                        v-for="chip in activeFilterChips"
                        :key="chip.key"
                        type="button"
                        class="ns-filter-summary-chip"
                        :aria-label="`Hapus filter ${chip.label}`"
                        @click="removeFilterChip(chip.key)"
                    >
                        {{ chip.label }}
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
            </div>
            <div class="ns-filter-summary-meta">
                <span>{{ filtered.length }} dari {{ rows.length }} perkara</span>
                <button
                    v-if="hasActiveFilters"
                    type="button"
                    class="ns-filter-summary-reset"
                    @click="resetFilters"
                >
                    Reset
                </button>
            </div>
        </div>

        <div class="ns-attention-strip" aria-label="Ringkasan perkara perlu perhatian">
            <div
                v-for="item in attentionStats"
                :key="item.key"
                class="ns-attention-item"
                :class="`is-${item.tone}`"
            >
                <span class="ns-attention-dot"></span>
                <span class="ns-attention-label">{{ item.label }}</span>
                <strong class="ns-attention-value">{{ item.value }}</strong>
            </div>
        </div>

        <!-- Table with Skeleton Loading -->
        <div v-if="loading" class="ns-table-skeleton-panel" aria-label="Memuat tabel perkara">
            <div class="ns-table-skeleton-head"></div>
            <div v-for="i in 8" :key="i" class="ns-table-skeleton-row">
                <span v-for="j in 8" :key="j"></span>
            </div>
        </div>
        <EmptyState
            v-else-if="!filtered.length"
            icon="document"
            title="Tidak ada perkara"
            :description="search || filterJenis !== 'Semua' ? 'Coba sesuaikan filter pencarian Anda' : 'Belum ada data perkara yang tersedia'"
            :actions="[
                { key: 'sync', label: 'Sync dari SIPP', icon: 'refresh', class: 'primary' },
                { key: 'reset', label: 'Reset Filter', icon: 'filter' }
            ]"
            @action="handleEmptyAction"
        />
        <template v-else>
            <!-- Table View -->
            <PerkaraTable
                v-if="viewMode === 'table'"
                :rows="paginatedRows"
                :start-index="(currentPage - 1) * itemsPerPage"
                :upcoming-perkara-numbers="upcomingPerkaraNumbers"
                :density="density"
                @row-click="handleRowClick"
                @menu-action="handleMenuAction"
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
/* Cards Row Layout */
.ns-c-cards-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: start;
    margin-bottom: 28px;
}

.ns-c-trend-wrapper {
    position: relative;
    overflow-x: auto;
    overflow-y: visible;
    min-width: 0;
}

.ns-c-side-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 220px;
    flex-shrink: 0;
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

.ns-filter-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: -4px 0 12px;
    padding: 10px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
}

.ns-filter-summary-main {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
    font-size: 13px;
}

.ns-filter-summary-label {
    color: var(--text-3);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.ns-filter-summary-main strong {
    min-width: 0;
    color: var(--text);
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ns-filter-chip-list {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
}

.ns-filter-summary-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 220px;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-2);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.ns-filter-summary-chip:hover {
    background: var(--accentSoft);
    border-color: var(--accent);
    color: var(--accent);
}

.ns-filter-summary-chip:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.ns-filter-summary-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    color: var(--text-2);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
}

.ns-filter-summary-reset {
    padding: 5px 9px;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--surface-2);
    color: var(--text);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.ns-filter-summary-reset:hover {
    background: var(--accentSoft);
    border-color: var(--accent);
    color: var(--accent);
}

.ns-filter-summary-reset:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.ns-attention-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
}

.ns-attention-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
}

.ns-attention-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--text-3);
}

.ns-attention-item.is-warn .ns-attention-dot {
    background: #f59e0b;
}

.ns-attention-item.is-danger .ns-attention-dot {
    background: #ef4444;
}

.ns-attention-item.is-safe .ns-attention-dot {
    background: #10b981;
}

.ns-attention-label {
    min-width: 0;
    color: var(--text-2);
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ns-attention-value {
    color: var(--text);
    font-family: "JetBrains Mono", monospace;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
}

.ns-table-skeleton-panel {
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
}

.ns-table-skeleton-head,
.ns-table-skeleton-row {
    display: grid;
    grid-template-columns: 5% 9% 20% 19% 17% 10% 11% 9%;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
}

.ns-table-skeleton-head {
    min-height: 44px;
    background: var(--bg-2);
}

.ns-table-skeleton-head::before,
.ns-table-skeleton-row span {
    content: '';
    display: block;
    height: 12px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}

.ns-table-skeleton-head::before {
    grid-column: 1 / -1;
    width: 34%;
}

.ns-table-skeleton-row:last-child {
    border-bottom: none;
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

.ns-dashboard-view {
    position: relative;
}

/* Quick Filters */
.ns-quick-filters {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}

/* Stats Skeleton Loading */
.ns-stats-skeleton {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
}

.ns-stat-skeleton-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    animation: skeletonPulse 1.5s ease-in-out infinite;
}

.ns-stat-skeleton-card:nth-child(2) {
    animation-delay: 0.2s;
}

.ns-stat-skeleton-card:nth-child(3) {
    animation-delay: 0.4s;
}

.ns-stat-skeleton-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}

.ns-stat-skeleton-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
}

.ns-stat-skeleton-value {
    width: 40px;
    height: 22px;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}

.ns-stat-skeleton-label {
    width: 80px;
    height: 11px;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}

@keyframes skeletonPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

@media (max-width: 768px) {
    .ns-stats-skeleton {
        grid-template-columns: 1fr;
    }

    .ns-filter-summary {
        align-items: flex-start;
        flex-direction: column;
    }

    .ns-filter-summary-main,
    .ns-filter-summary-meta {
        width: 100%;
    }

    .ns-filter-summary-main strong {
        white-space: normal;
    }

    .ns-filter-chip-list {
        width: 100%;
    }

    .ns-attention-strip {
        grid-template-columns: 1fr;
    }

    .ns-attention-label {
        white-space: normal;
    }

    .ns-table-skeleton-head,
    .ns-table-skeleton-row {
        gap: 4px;
        padding: 10px 6px;
    }
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

/* Responsive */
@media (max-width: 1024px) {
    .ns-c-cards-row {
        grid-template-columns: 1fr;
    }

    .ns-c-side-cards {
        width: 100%;
        flex-direction: row;
        flex-wrap: wrap;
    }

    .ns-c-avg-card {
        flex: 1;
        min-width: 200px;
    }
}
</style>
