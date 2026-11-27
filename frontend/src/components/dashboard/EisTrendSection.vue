<script setup>
import { computed } from 'vue'

const props = defineProps({
    items: { type: Array, default: () => [] },
    activePeriod: { type: String, default: '' }
})

const emit = defineEmits(['select-period'])

const monthShort = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'short' })
const fmtScore = value => value == null ? '—' : `${Number(value).toFixed(2).replace('.', ',')}%`

function shortLabel(period) {
    if (!/^\d{4}-\d{2}$/.test(period || '')) return period
    return monthShort.format(new Date(`${period}-01T00:00:00Z`)).replace('.', '')
}

const chart = computed(() => {
    const valid = props.items.filter(item => typeof item.total === 'number')
    if (!valid.length) return null
    const values = valid.map(item => item.total)
    const min = Math.max(0, Math.floor(Math.min(...values) - 2))
    const max = Math.min(100, Math.ceil(Math.max(...values) + 1))
    const span = Math.max(1, max - min)
    const width = Math.max(320, valid.length * 54)
    const height = 84
    const padX = 24
    const padY = 12
    const stepX = valid.length > 1 ? (width - padX * 2) / (valid.length - 1) : 0

    const points = valid.map((item, idx) => {
        const x = valid.length > 1 ? padX + idx * stepX : width / 2
        const y = padY + ((max - item.total) / span) * (height - padY * 2)
        return { ...item, x, y, label: shortLabel(item.period) }
    })

    const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    return { width, height, min, max, points, polyline }
})
</script>

<template>
    <div v-if="items.length" class="eis-trend-wrap">
        <div v-if="chart" class="eis-trend-chart-box">
            <svg :viewBox="`0 0 ${chart.width} ${chart.height + 24}`" class="eis-trend-svg" role="img" aria-label="Grafik tren skor Implementasi SIPP bulanan">
                <polyline
                    v-if="chart.points.length > 1"
                    :points="chart.polyline"
                    pathLength="100"
                    class="eis-trend-line"
                    fill="none"
                    stroke="var(--accent)"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
                <g
                    v-for="pt in chart.points"
                    :key="pt.period"
                    class="eis-trend-pt"
                    :class="{ 'is-active': pt.period === activePeriod }"
                    tabindex="0"
                    role="button"
                    :aria-label="`Pilih periode ${pt.period}: ${fmtScore(pt.total)}`"
                    @click="emit('select-period', pt.period)"
                    @keydown.enter.prevent="emit('select-period', pt.period)"
                    @keydown.space.prevent="emit('select-period', pt.period)"
                >
                    <circle :cx="pt.x" :cy="pt.y" :r="pt.period === activePeriod ? 5.5 : 3.8" />
                    <text :x="pt.x" :y="pt.y - 8" text-anchor="middle" class="eis-trend-val">{{ Number(pt.total).toFixed(1).replace('.', ',') }}</text>
                    <text :x="pt.x" :y="chart.height + 16" text-anchor="middle" class="eis-trend-lbl">{{ pt.label }}</text>
                </g>
            </svg>
        </div>

        <div class="eis-table-scroll">
            <table class="eis-trend-table">
                <thead>
                    <tr>
                        <th scope="col">Bulan</th>
                        <th scope="col">Implementasi SIPP</th>
                        <th scope="col">Kinerja</th>
                        <th scope="col">Kepatuhan</th>
                        <th scope="col">Kelengkapan</th>
                        <th scope="col">Kesesuaian</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="item in items"
                        :key="item.period"
                        :class="{ 'is-active': item.period === activePeriod }"
                    >
                        <th scope="row">
                            <button type="button" class="eis-trend-link" @click="emit('select-period', item.period)">
                                {{ item.period }}
                            </button>
                        </th>
                        <td><strong>{{ fmtScore(item.total) }}</strong></td>
                        <td>{{ fmtScore(item.components?.kinerja) }}</td>
                        <td>{{ fmtScore(item.components?.kepatuhan) }}</td>
                        <td>{{ fmtScore(item.components?.kelengkapan) }}</td>
                        <td>{{ fmtScore(item.components?.kesesuaian) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.eis-trend-wrap { display: grid; gap: .75rem; }
.eis-trend-chart-box { overflow-x: auto; padding: .55rem .75rem; border: 1px solid var(--border); border-radius: 10px; background: var(--bg3); }
.eis-trend-svg { width: 100%; min-width: 340px; height: 118px; display: block; }
.eis-trend-line { stroke-dasharray: 100; stroke-dashoffset: 0; animation: eis-draw-line 650ms cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes eis-draw-line { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
.eis-trend-pt { cursor: pointer; }
.eis-trend-pt circle { fill: var(--bg2); stroke: var(--accent); stroke-width: 2.2; transition: r 150ms ease, fill 150ms ease; }
.eis-trend-pt:hover circle { r: 5.5; }
.eis-trend-pt.is-active circle { fill: var(--accent); stroke: var(--bg2); }
.eis-trend-val { font-size: 9.5px; font-weight: 700; fill: var(--text-2); font-variant-numeric: tabular-nums; }
.eis-trend-pt.is-active .eis-trend-val { fill: var(--accent); font-weight: 800; }
.eis-trend-lbl { font-size: 10px; fill: var(--text-2); font-weight: 600; }
.eis-trend-pt.is-active .eis-trend-lbl { fill: var(--accent); font-weight: 800; }
.eis-trend-table { width: 100%; border-collapse: collapse; font-size: .82rem; font-variant-numeric: tabular-nums; }
.eis-trend-table th, .eis-trend-table td { padding: .48rem .6rem; border-bottom: 1px solid var(--border); text-align: end; }
.eis-trend-table th:first-child, .eis-trend-table td:first-child { text-align: start; }
.eis-trend-table tbody tr { transition: background-color 140ms ease; }
.eis-trend-table tbody tr:hover { background: var(--surface-2); }
.eis-trend-table tr.is-active { background: var(--accent-soft); }
.eis-trend-link { border: 0; padding: 0; background: none; color: var(--accent); font: inherit; font-weight: 700; cursor: pointer; text-decoration: underline; text-underline-offset: .16em; }
@media (prefers-reduced-motion: reduce) {
    .eis-trend-line { animation: none; stroke-dasharray: none; }
    .eis-trend-pt circle, .eis-trend-table tbody tr { transition-duration: 1ms; }
}
</style>
