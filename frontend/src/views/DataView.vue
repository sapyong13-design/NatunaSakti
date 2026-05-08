<script setup>
import { ref, computed, onMounted } from 'vue'
import PageHeader from '../components/shell/PageHeader.vue'
import StatsStrip from '../components/dashboard/StatsStrip.vue'
import TrendCard from '../components/dashboard/TrendCard.vue'
import MiniStatCard from '../components/dashboard/MiniStatCard.vue'
import ToolbarFilters from '../components/dashboard/ToolbarFilters.vue'
import SyncCluster from '../components/dashboard/SyncCluster.vue'
import PerkaraTable from '../components/dashboard/PerkaraTable.vue'
import DetailPanel from '../components/dashboard/DetailPanel.vue'
import { getPerkara, getSippStatus, getPerkaraTrend } from '../lib/api'

const rows = ref([])
const trendData = ref([])
const syncStatus = ref({ total: 0, sipp_synced: 0, last_sync: null })

const search = ref('')
const filterJenis = ref('Semua')
const filterTahun = ref(String(new Date().getFullYear()))

const selectedRow = ref(null)

const filtered = computed(() => {
    return rows.value.filter(r => {
        if (filterJenis.value !== 'Semua' && r.jenis_perkara !== filterJenis.value) return false
        if (filterTahun.value && String(r.tahun_masuk) !== filterTahun.value) return false
        if (search.value) {
            const q = search.value.toLowerCase()
            const nomor = (r.nomor_perkara || '').toLowerCase()
            const pihak = (r.para_pihak || '').toLowerCase()
            if (!nomor.includes(q) && !pihak.includes(q)) return false
        }
        return true
    })
})

const stats = computed(() => ({
    total: rows.value.length,
    pidana: rows.value.filter(r => r.jenis_perkara === 'Pidana').length,
    perdata: rows.value.filter(r => r.jenis_perkara === 'Perdata').length,
    aktif: rows.value.filter(r => !r.tanggal_putus).length
}))

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

const avgDays = computed(() => {
    const closed = rows.value.filter(r => r.tanggal_putus)
    if (!closed.length) return '—'
    let total = 0
    let count = 0
    for (const r of closed) {
        const reg = parseTanggal(r.sipp_tanggal_register)
        const put = parseTanggal(r.tanggal_putus) || new Date(r.tanggal_putus)
        if (!reg || !put || isNaN(put.getTime())) continue
        const days = Math.floor((put - reg) / (24 * 60 * 60 * 1000))
        if (days >= 0) {
            total += days
            count++
        }
    }
    return count > 0 ? Math.round(total / count) : '—'
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

async function loadAll() {
    try {
        const [perkaraRes, statusRes, trendRes] = await Promise.all([
            getPerkara({ limit: 1000 }),
            getSippStatus(),
            getPerkaraTrend(8)
        ])
        rows.value = Array.isArray(perkaraRes) ? perkaraRes : (perkaraRes.data || [])
        syncStatus.value = statusRes
        trendData.value = trendRes
    } catch (err) {
        console.error('Load failed:', err.message)
    }
}

function onRowDeleted(nomor) {
    rows.value = rows.value.filter(r => r.nomor_perkara !== nomor)
    selectedRow.value = null
}

onMounted(loadAll)
</script>

<template>
    <div>
        <PageHeader
            eyebrow="Dashboard"
            title="Data Perkara"
            sub="Daftar perkara aktif disinkronkan dengan SIPP"
        >
            <StatsStrip :stats="stats" />
        </PageHeader>

        <div class="ns-c-cards-row">
            <TrendCard :data="trendData" />
            <div class="ns-c-side-cards">
                <MiniStatCard
                    label="Rata-rata penyelesaian"
                    :value="avgDays"
                    unit="hari"
                    delta-text=""
                    delta-trend="flat"
                    delta-icon="activity"
                />
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
                :jenis-options="jenisOptions"
                :tahun-options="tahunOptions"
            />
            <SyncCluster :count="filtered.length" :total="rows.length" @synced="loadAll" />
        </div>

        <PerkaraTable :rows="filtered" @row-click="selectedRow = $event" />

        <DetailPanel
            :row="selectedRow"
            :open="!!selectedRow"
            @close="selectedRow = null"
            @deleted="onRowDeleted"
        />
    </div>
</template>
