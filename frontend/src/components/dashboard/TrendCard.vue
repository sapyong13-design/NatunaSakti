<script setup>
import { computed } from 'vue'
import Icon from '../Icon.vue'
import StackedBars from '../charts/StackedBars.vue'

const props = defineProps({
    data: { type: Array, required: true }
})

const delta = computed(() => {
    if (!props.data.length) return { text: '—', trend: 'flat', icon: 'activity' }
    const first = props.data[0]
    const last = props.data[props.data.length - 1]
    const firstTotal = first.pidana + first.perdata
    const lastTotal = last.pidana + last.perdata
    if (firstTotal === 0) return { text: '—', trend: 'flat', icon: 'activity' }
    const pct = ((lastTotal - firstTotal) / firstTotal) * 100
    const sign = pct >= 0 ? '+' : ''
    return {
        text: `${sign}${pct.toFixed(1)}%`,
        trend: pct >= 0 ? 'up' : 'down',
        icon: pct >= 0 ? 'trendUp' : 'trendDown'
    }
})

const weeksLabel = computed(() => `${props.data.length} Minggu`)
</script>

<template>
    <div class="ns-c-big-card">
        <div class="ns-stat-row">
            <div>
                <div class="ns-stat-label">Trend Pendaftaran {{ weeksLabel }}</div>
                <div class="ns-c-big-card-sub">Pidana vs Perdata</div>
            </div>
            <span
                class="ns-stat-delta"
                :class="{ 'is-up': delta.trend === 'up', 'is-down': delta.trend === 'down' }"
            >
                <Icon :name="delta.icon" :size="11" /> {{ delta.text }}
            </span>
        </div>
        <div class="ns-c-bigchart">
            <StackedBars :data="data" :width="420" :height="120" color-a="#ef4444" color-b="#10b981" />
        </div>
        <div class="ns-c-bigchart-legend">
            <span><span class="ns-legend-dot" style="background:#ef4444" /> Pidana</span>
            <span><span class="ns-legend-dot" style="background:#10b981" /> Perdata</span>
        </div>
    </div>
</template>
