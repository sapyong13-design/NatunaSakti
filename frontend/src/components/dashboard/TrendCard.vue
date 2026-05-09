<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import Icon from '../Icon.vue'
import TrendChart from './TrendChart.vue'

const props = defineProps({
    data: { type: Array, required: true },
    year: { type: Number, default: new Date().getFullYear() }
})

const emit = defineEmits(['period-click'])

const period = ref('monthly') // 'weekly' or 'monthly'
const hoveredBar = ref(null)
const chartWidth = ref(550)
const isDark = ref(document.documentElement.dataset.mode === 'dark')

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const totalStats = computed(() => {
    if (!props.data.length) return { total: 0, pidana: 0, perdata: 0, trend: 0 }
    const stats = props.data.reduce((acc, month) => ({
        total: acc.total + (month.pidana || 0) + (month.perdata || 0),
        pidana: acc.pidana + (month.pidana || 0),
        perdata: acc.perdata + (month.perdata || 0)
    }), { total: 0, pidana: 0, perdata: 0 })

    // Calculate trend vs previous period
    const prevTotal = Math.round(stats.total * 0.85) // Simulated
    stats.trend = stats.total - prevTotal

    return stats
})

const yearProgress = computed(() => {
    const monthsWithData = props.data.filter(m => (m.pidana || 0) + (m.perdata || 0) > 0).length
    return Math.round((monthsWithData.length / 12) * 100)
})

const chartData = computed(() => {
    const maxTotal = Math.max(...props.data.map(m => (m.pidana || 0) + (m.perdata || 0)), 1)
    return props.data.map((d, idx) => ({
        ...d,
        label: d.month || monthNames[idx] || '',
        intensity: ((d.pidana || 0) + (d.perdata || 0)) / maxTotal,
        isPeak: (d.pidana || 0) + (d.perdata || 0) === maxTotal
    }))
})

const togglePeriod = () => {
    period.value = period.value === 'monthly' ? 'weekly' : 'monthly'
}

function handleBarClick(bar) {
    emit('period-click', bar)
}

function handleBarHover(bar) {
    hoveredBar.value = bar
}

function handleBarLeave() {
    hoveredBar.value = null
}

onMounted(() => {
    const updateWidth = () => {
        const wrapper = document.querySelector('.ns-trend-chart-wrap')
        if (wrapper) {
            chartWidth.value = Math.max(wrapper.offsetWidth - 20, 350)
        }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)

    const observer = new MutationObserver(() => {
        isDark.value = document.documentElement.dataset.mode === 'dark'
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] })
})
</script>

<template>
    <div class="ns-trend-card" :class="{ 'is-dark': isDark }">
        <!-- Header -->
        <div class="ns-trend-card-header">
            <div class="ns-trend-title">
                <span class="ns-trend-eyebrow">Analitik</span>
                <h3>Trend Pendaftaran</h3>
            </div>

            <!-- Period Toggle -->
            <div class="ns-trend-toggle">
                <button
                    type="button"
                    class="ns-toggle-btn"
                    :class="{ 'is-active': period === 'monthly' }"
                    @click="period = 'monthly'"
                >
                    Bulanan
                </button>
                <button
                    type="button"
                    class="ns-toggle-btn"
                    :class="{ 'is-active': period === 'weekly' }"
                    @click="period = 'weekly'"
                >
                    Mingguan
                </button>
            </div>
        </div>

        <!-- Year Badge -->
        <div class="ns-trend-year-badge">
            <span class="ns-trend-year-text">{{ year }}</span>
            <span class="ns-trend-year-dot"></span>
        </div>

        <!-- Chart Area -->
        <div class="ns-trend-chart-wrap">
            <TrendChart
                :data="chartData"
                :width="chartWidth"
                :height="120"
                :hovered="hoveredBar"
                @bar-click="handleBarClick"
                @bar-hover="handleBarHover"
                @bar-leave="handleBarLeave"
            />
        </div>

        <!-- Stats Footer -->
        <div class="ns-trend-footer">
            <div class="ns-trend-stat">
                <span class="ns-trend-stat-value">{{ totalStats.total }}</span>
                <span class="ns-trend-stat-label">Total</span>
            </div>
            <div class="ns-trend-stat ns-trend-stat-pidana">
                <span class="ns-trend-stat-value">{{ totalStats.pidana }}</span>
                <span class="ns-trend-stat-label">Pidana</span>
            </div>
            <div class="ns-trend-stat ns-trend-stat-perdata">
                <span class="ns-trend-stat-value">{{ totalStats.perdata }}</span>
                <span class="ns-trend-stat-label">Perdata</span>
            </div>
            <div class="ns-trend-stat-spacer"></div>
            <div class="ns-trend-trend" :class="{ 'is-up': totalStats.trend > 0, 'is-down': totalStats.trend < 0 }">
                <Icon :name="totalStats.trend >= 0 ? 'trendUp' : 'trendDown'" :size="12" />
                <span>{{ Math.abs(totalStats.trend) }}% vs lalu</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ns-trend-card {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px 18px;
    transition: all 300ms ease;
}

.ns-trend-card.is-dark {
    background: rgba(45, 55, 60, 0.6);
    border-color: rgba(255, 255, 255, 0.08);
}

.ns-trend-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
}

.ns-trend-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.ns-trend-eyebrow {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text3);
}

.ns-trend-title h3 {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
    margin: 0;
}

.ns-trend-toggle {
    display: flex;
    background: var(--surface2);
    border-radius: 8px;
    padding: 2px;
}

.ns-toggle-btn {
    padding: 5px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text3);
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    transition: all 200ms;
}

.ns-toggle-btn:hover {
    color: var(--text2);
}

.ns-toggle-btn.is-active {
    background: var(--bg2);
    color: var(--text);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ns-trend-year-badge {
    position: absolute;
    top: 16px;
    right: 18px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--accentSoft);
    border-radius: 6px;
}

.ns-trend-year-text {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent);
}

.ns-trend-year-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
    animation: yearPulse 2s ease-in-out infinite;
}

@keyframes yearPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.ns-trend-chart-wrap {
    margin: 16px -18px;
    padding: 0 18px;
    min-height: 120px;
    overflow-x: auto;
    overflow-y: visible;
    /* Allow tooltip to overflow */
}

.ns-trend-chart-wrap .ns-trend-chart {
    overflow: visible;
}

.ns-trend-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
}

.ns-trend-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.ns-trend-stat-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
}

.ns-trend-stat-label {
    font-size: 9px;
    font-weight: 500;
    color: var(--text3);
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.ns-trend-stat-pidana .ns-trend-stat-value {
    color: var(--danger);
}

.ns-trend-stat-perdata .ns-trend-stat-value {
    color: var(--success);
}

.ns-trend-stat-spacer {
    flex: 1;
}

.ns-trend-trend {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 500;
}

.ns-trend-trend.is-up {
    background: var(--successSoft);
    color: var(--success);
}

.ns-trend-trend.is-down {
    background: var(--dangerSoft);
    color: var(--danger);
}
</style>
