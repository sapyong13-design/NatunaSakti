<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/shell/PageHeader.vue'
import StatsStrip from '../components/dashboard/StatsStrip.vue'
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
import Toggles from '../components/dashboard/Toggles.vue'
import Icon from '../components/Icon.vue'
import { getPerkara, getSippStatus, getPerkaraTrendMonthly, getPerkaraTrendYearly } from '../lib/api'
import { getDashboardAlerts, isPerkaraAktif } from '../lib/perkaraStats'
import {
    applyPerkaraFilters,
    createDefaultFilters,
    getActiveFilterChips,
    getActiveFilterSummary,
    hasActiveFilters as hasFilters
} from '../lib/dashboardFilters'
import { dashboardStateFromQuery, dashboardStateToQuery } from '../lib/dashboardViewState'

const rows = ref([])
const trendData = ref([])
const syncStatus = ref({ total: 0, sipp_synced: 0, last_sync: null })
const isDark = ref(document.documentElement.dataset.mode === 'dark')
const loading = ref(true)
const loadError = ref('')
const density = ref('default')
const viewMode = ref('table') // table, kanban
const route = useRoute()
const router = useRouter()

// Toast state
const toast = ref({
    show: false,
    type: 'success',
    message: ''
})

const defaultFilters = createDefaultFilters()
const search = ref(defaultFilters.search)
const filterJenis = ref(defaultFilters.jenis)
const filterTahun = ref(defaultFilters.tahun)
const filterStatus = ref(defaultFilters.status)

const selectedRow = ref(null)
const scrollPosition = ref(0)
const syncClusterRef = ref(null)

// Pagination state
const currentPage = ref(1)
const itemsPerPage = 100
let syncingRouteState = false

function applyRouteState() {
    const state = dashboardStateFromQuery(route.query)
    syncingRouteState = true
    search.value = state.search
    filterJenis.value = state.jenis
    filterTahun.value = state.tahun
    filterStatus.value = state.status
    viewMode.value = state.viewMode
    density.value = state.density
    currentPage.value = state.page
    nextTick(() => {
        syncingRouteState = false
    })
}

function syncRouteState() {
    if (syncingRouteState) return
    const query = dashboardStateToQuery({
        search: search.value,
        jenis: filterJenis.value,
        tahun: filterTahun.value,
        status: filterStatus.value,
        viewMode: viewMode.value,
        density: density.value,
        page: currentPage.value
    })
    router.replace({ query })
}

const filtered = computed(() => {
    const result = applyPerkaraFilters(rows.value, {
        search: search.value,
        jenis: filterJenis.value,
        tahun: filterTahun.value,
        status: filterStatus.value
    })

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

const activeFilterSummary = computed(() => getActiveFilterSummary({
    search: search.value,
    jenis: filterJenis.value,
    tahun: filterTahun.value,
    status: filterStatus.value
}))

const activeFilterChips = computed(() => getActiveFilterChips({
    search: search.value,
    jenis: filterJenis.value,
    tahun: filterTahun.value,
    status: filterStatus.value
}))

const hasActiveFilters = computed(() => hasFilters({
    search: search.value,
    jenis: filterJenis.value,
    tahun: filterTahun.value,
    status: filterStatus.value
}))

function resetFilters() {
    const filters = createDefaultFilters()
    search.value = filters.search
    filterJenis.value = filters.jenis
    filterStatus.value = filters.status
    filterTahun.value = filters.tahun
    currentPage.value = 1
}

function removeFilterChip(key) {
    if (key === 'jenis') filterJenis.value = 'Semua'
    if (key === 'tahun') filterTahun.value = ''
    if (key === 'status') filterStatus.value = 'Semua'
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
    aktif: rows.value.filter(isPerkaraAktif).length
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
    if (!completed.length) return { pidana: '-', perdata: '-', perikanan: '-' }

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
        pidana: pidanaCount > 0 ? `${Math.round(pidanaTotal / pidanaCount)} Hari` : '-',
        perdata: perdataCount > 0 ? `${Math.round(perdataTotal / perdataCount)} Hari` : '-',
        perikanan: perikananCount > 0 ? `${Math.round(perikananTotal / perikananCount)} Hari` : '-'
    }
})

const syncRate = computed(() => {
    if (!syncStatus.value.total) return '-'
    return ((syncStatus.value.sipp_synced / syncStatus.value.total) * 100).toFixed(1)
})

const attentionStats = computed(() => getDashboardAlerts(rows.value, syncStatus.value))

const tahunOptions = computed(() => {
    const set = new Set(rows.value.map(r => r.tahun_masuk).filter(Boolean))
    return Array.from(set).sort((a, b) => b - a)
})

const jenisOptions = ['Semua', 'Pidana', 'Perdata', 'Perikanan', 'Hukum']
const monthNames = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des']

async function loadTrendData() {
    try {
        if (filterTahun.value) {
            trendData.value = await getPerkaraTrendMonthly(Number(filterTahun.value))
        } else {
            trendData.value = await getPerkaraTrendYearly()
        }
    } catch (err) {
        console.error('Failed to load trend:', err.message)
    }
}

// Reset page when filters change
watch([search, filterJenis, filterTahun, filterStatus], () => {
    currentPage.value = 1
})

watch([search, filterJenis, filterTahun, filterStatus, viewMode, density, currentPage], syncRouteState)
watch(() => route.query, applyRouteState)

watch(filterTahun, () => {
    loadTrendData()
})

async function loadAll() {
    loading.value = true
    loadError.value = ''
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
        loadError.value = err.message || 'Gagal memuat data perkara'
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
    applyRouteState()
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

        <div class="ns-c-cards-row">
            <div class="ns-c-trend-wrapper">
                <TrendCard
                    :data="trendData"
                    :mode="filterTahun ? 'monthly' : 'yearly'"
                    :year="Number(filterTahun) || new Date().getFullYear()"
                    @period-click="onMonthClick"
                />
            </div>
            <div class="ns-c-side-cards">
                <div class="ns-c-avg-card" :class="{ 'is-dark': isDark }">
                    <div class="ns-stat-label">Rata-rata 3 tahun</div>
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
                    <div class="ns-c-avg-sub">Minutasi</div>
                </div>
                <MiniStatCard
                    label="Sync"
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
            <div class="ns-toolbar-action-row">
                <div class="ns-view-toggle" aria-label="Mode tampilan">
                    <button
                        class="ns-view-btn"
                        :class="{ active: viewMode === 'table' }"
                        aria-label="Tampilkan tabel"
                        @click="viewMode = 'table'"
                        title="Tabel"
                    >
                        <Icon name="table" :size="15" />
                    </button>
                    <button
                        class="ns-view-btn"
                        :class="{ active: viewMode === 'kanban' }"
                        aria-label="Tampilkan kanban"
                        @click="viewMode = 'kanban'"
                        title="Kanban"
                    >
                        <Icon name="layoutGrid" :size="15" />
                    </button>
                </div>
                <Toggles type="density" v-model="density" />
                <SyncCluster ref="syncClusterRef" :count="filtered.length" :total="rows.length" @synced="loadAll" />
                <QuickActions :rows="filtered" @refresh="handleRefresh" />
            </div>
        </div>

        <div v-if="hasActiveFilters" class="ns-filter-summary" aria-live="polite">
            <div class="ns-filter-summary-main">
                <span class="ns-filter-summary-label">Filter</span>
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
                        <span aria-hidden="true">x</span>
                    </button>
                </div>
            </div>
            <div class="ns-filter-summary-meta">
                <span>{{ filtered.length }} dari {{ rows.length }}</span>
                <button
                    type="button"
                    class="ns-filter-summary-reset"
                    @click="resetFilters"
                >
                    Reset
                </button>
            </div>
        </div>

        <div v-if="attentionStats.length" class="ns-attention-strip" aria-label="Peringatan dashboard">
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

        <div v-if="loadError" class="ns-dashboard-error" role="alert">
            <div class="ns-dashboard-error-icon">
                <Icon name="alert" :size="18" />
            </div>
            <div class="ns-dashboard-error-copy">
                <strong>Data belum bisa dimuat</strong>
                <span>{{ loadError }}</span>
            </div>
            <button type="button" class="ns-dashboard-error-action" @click="loadAll">
                Coba lagi
            </button>
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
                        aria-label="Halaman sebelumnya"
                        @click="goToPage(currentPage - 1)"
                    >
                        &laquo; Sebelumnya
                    </button>

                    <button
                        v-if="pageNumbers[0] > 1"
                        class="ns-pagination-btn"
                        aria-label="Halaman 1"
                        @click="goToPage(1)"
                    >
                        1
                    </button>
                    <span v-if="pageNumbers[0] > 2" class="ns-pagination-ellipsis">…</span>

                    <button
                        v-for="page in pageNumbers"
                        :key="page"
                        class="ns-pagination-btn"
                        :class="{ 'is-active': page === currentPage }"
                        :aria-label="`Halaman ${page}`"
                        :aria-current="page === currentPage ? 'page' : undefined"
                        @click="goToPage(page)"
                    >
                        {{ page }}
                    </button>

                    <span v-if="pageNumbers[pageNumbers.length - 1] < totalPages - 1" class="ns-pagination-ellipsis">…</span>
                    <button
                        v-if="pageNumbers[pageNumbers.length - 1] < totalPages"
                        class="ns-pagination-btn"
                        :aria-label="`Halaman ${totalPages}`"
                        @click="goToPage(totalPages)"
                    >
                        {{ totalPages }}
                    </button>

                    <button
                        class="ns-pagination-btn"
                        :disabled="currentPage === totalPages"
                        aria-label="Halaman berikutnya"
                        @click="goToPage(currentPage + 1)"
                    >
                        Berikutnya &raquo;
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
    margin-bottom: 12px;
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

.ns-c-avg-card {
    flex-shrink: 0;
    background: var(--bg, #fff);
    border-radius: 10px;
    padding: 12px 16px 16px;
    border: 1px solid var(--border);
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

.ns-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
}

.ns-toolbar-action-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex: 0 0 auto;
    min-width: max-content;
}

@media (max-width: 1100px) {
    .ns-toolbar {
        align-items: stretch;
        flex-direction: column;
    }

    .ns-toolbar-action-row {
        justify-content: flex-start;
        min-width: 0;
        flex-wrap: wrap;
    }
}

.ns-filter-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0 0 12px;
    padding: 8px 10px;
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
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

.ns-dashboard-error {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding: 12px;
    background: color-mix(in srgb, var(--danger, #C75B4A) 10%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--danger, #C75B4A) 32%, var(--border));
    border-radius: 10px;
}

.ns-dashboard-error-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    color: var(--danger, #C75B4A);
    background: color-mix(in srgb, var(--danger, #C75B4A) 12%, transparent);
}

.ns-dashboard-error-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.ns-dashboard-error-copy strong {
    color: var(--text);
    font-size: 13px;
}

.ns-dashboard-error-copy span {
    color: var(--text-2);
    font-size: 12px;
    overflow-wrap: anywhere;
}

.ns-dashboard-error-action {
    min-height: 34px;
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}

.ns-dashboard-error-action:hover {
    border-color: var(--danger, #C75B4A);
    color: var(--danger, #C75B4A);
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
    flex-shrink: 0;
}

.ns-view-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease, box-shadow 150ms ease;
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

    .ns-dashboard-error {
        grid-template-columns: auto minmax(0, 1fr);
    }

    .ns-dashboard-error-action {
        grid-column: 1 / -1;
        width: 100%;
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
    transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
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
