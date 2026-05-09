<script setup>
import { computed, ref } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    data: { type: Array, required: true },
    width: { type: Number, default: 400 },
    height: { type: Number, default: 120 },
    hovered: { type: Object, default: null }
})

const emit = defineEmits(['barClick', 'barHover', 'barLeave'])

const chartRef = ref(null)

const tooltipStyle = computed(() => {
    if (!props.hovered || !chartRef.value) return {}
    const rect = chartRef.value.getBoundingClientRect()
    return {
        left: `${rect.left + props.hovered.x + barWidth / 2}px`,
        top: `${rect.top - 10}px`,
        transform: 'translateX(-50%)'
    }
})

const barWidth = 24
const barGap = 8

const max = computed(() => Math.max(...props.data.map(d => (d.pidana || 0) + (d.perdata || 0)), 1))

const bars = computed(() => {
    const totalBarsWidth = props.data.length * barWidth + (props.data.length - 1) * barGap
    const startX = Math.max(12, (props.width - totalBarsWidth) / 2)

    return props.data.map((d, i) => {
        const total = (d.pidana || 0) + (d.perdata || 0)
        const totalH = (total / max.value) * props.height
        const pidH = ((d.pidana || 0) / max.value) * props.height
        const perH = ((d.perdata || 0) / max.value) * props.height
        const x = startX + i * (barWidth + barGap)
        const y = props.height - totalH

        return {
            x, y, pidH, perH, total,
            pidana: d.pidana || 0,
            perdata: d.perdata || 0,
            label: d.label || d.month,
            isPeak: d.isPeak || false,
            intensity: d.intensity || 1,
            index: i,
            originalData: d
        }
    })
})

const peakBar = computed(() => bars.value.find(b => b.isPeak))

function handleClick(bar, e) {
    emit('barClick', bar.originalData)
}

function handleHover(bar, e) {
    emit('barHover', bar)
}

function handleLeave() {
    emit('barLeave')
}
</script>

<template>
    <div ref="chartRef" class="ns-trend-chart" :style="{ width: `${width}px` }">
        <svg :width="width" :height="height + 30" style="display: block">
            <defs>
                <!-- Gradients -->
                <linearGradient id="gradPidana" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="var(--danger)" stop-opacity="0.9" />
                    <stop offset="100%" stop-color="var(--danger)" stop-opacity="0.6" />
                </linearGradient>
                <linearGradient id="gradPerdata" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="var(--success)" stop-opacity="0.9" />
                    <stop offset="100%" stop-color="var(--success)" stop-opacity="0.6" />
                </linearGradient>
                <linearGradient id="gradPeak" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3" />
                    <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
                </linearGradient>
            </defs>

            <!-- Peak indicator background -->
            <rect
                v-if="peakBar"
                :x="peakBar.x - 4"
                :y="0"
                :width="barWidth + 8"
                :height="height"
                fill="url(#gradPeak)"
                rx="8"
            />

            <!-- Bars -->
            <g
                v-for="b in bars"
                :key="b.index"
                class="ns-bar-group"
                :class="{ 'is-hovered': hovered?.index === b.index, 'is-peak': b.isPeak }"
                @mouseenter="handleHover(b, $event)"
                @mouseleave="handleLeave"
                @click="handleClick(b, $event)"
            >
                <!-- Pidana bar -->
                <rect
                    :x="b.x"
                    :y="b.y"
                    :width="barWidth"
                    :height="b.pidH"
                    :rx="barWidth / 3"
                    fill="var(--danger)"
                    :fill-opacity="0.5 + (b.intensity * 0.4)"
                    class="ns-bar-rect ns-bar-pidana"
                    :class="{ 'is-hovered': hovered?.index === b.index }"
                />

                <!-- Perdata bar -->
                <rect
                    :x="b.x"
                    :y="b.y + b.pidH"
                    :width="barWidth"
                    :height="b.perH"
                    :rx="barWidth / 3"
                    fill="var(--success)"
                    :fill-opacity="0.5 + (b.intensity * 0.4)"
                    class="ns-bar-rect ns-bar-perdata"
                    :class="{ 'is-hovered': hovered?.index === b.index }"
                />

                <!-- Peak crown -->
                <g v-if="b.isPeak && hovered?.index !== b.index" class="ns-peak-crown">
                    <Icon name="crown" :size="12" />
                </g>

                <!-- Month label -->
                <text
                    :x="b.x + barWidth / 2"
                    :y="height + 16"
                    text-anchor="middle"
                    :font-size="hovered?.index === b.index || b.isPeak ? '11' : '10'"
                    :font-weight="hovered?.index === b.index || b.isPeak ? '600' : '500'"
                    fill="currentColor"
                    :opacity="hovered?.index === b.index || b.isPeak ? 1 : 0.6"
                >{{ b.label }}</text>
            </g>

            <!-- Trend line -->
            <polyline
                v-if="bars.length"
                :points="bars.map(b => `${b.x + barWidth / 2},${b.y}`).join(' ')"
                fill="none"
                stroke="var(--accent)"
                stroke-width="1.5"
                stroke-opacity="0.25"
                stroke-dasharray="4 3"
                class="ns-trend-line"
            />
        </svg>

        <!-- Hover Tooltip -->
        <Teleport to="body">
            <Transition name="ns-tooltip">
                <div v-if="hovered" class="ns-chart-tooltip" :style="tooltipStyle">
                <div class="ns-tooltip-header">{{ hovered.label }}</div>
                <div class="ns-tooltip-row">
                    <span class="ns-tooltip-dot ns-tooltip-pidana"></span>
                    <span>Pidana:</span>
                    <strong>{{ hovered.pidana }}</strong>
                </div>
                <div class="ns-tooltip-row">
                    <span class="ns-tooltip-dot ns-tooltip-perdata"></span>
                    <span>Perdata:</span>
                    <strong>{{ hovered.perdata }}</strong>
                </div>
                <div class="ns-tooltip-total">
                    Total: <strong>{{ hovered.pidana + hovered.perdata }}</strong>
                </div>
            </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.ns-trend-chart {
    position: relative;
    display: inline-block;
}

.ns-bar-group {
    cursor: pointer;
}

.ns-bar-rect {
    transition: all 250ms cubic-bezier(0.32, 0.72, 0, 1);
}

.ns-bar-pidana.is-hovered {
    fill: url(#gradPidana);
}

.ns-bar-perdata.is-hovered {
    fill: url(#gradPerdata);
}

.ns-bar-group:hover .ns-bar-rect {
    filter: brightness(1.15);
    transform: scaleY(1.02);
}

.ns-bar-group.is-peak .ns-bar-rect {
    filter: brightness(1.05);
}

.ns-peak-crown {
    position: absolute;
    top: -18px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--warn);
}

.ns-trend-line {
    pointer-events: none;
    transition: all 300ms ease;
}

.ns-chart-tooltip {
    position: fixed;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    min-width: 140px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    pointer-events: none;
    z-index: 1000;
}

.ns-tooltip-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
}

.ns-tooltip-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text2);
}

.ns-tooltip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
}

.ns-tooltip-pidana {
    background: var(--danger);
}

.ns-tooltip-perdata {
    background: var(--success);
}

.ns-tooltip-total {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--border);
    font-size: 10px;
    color: var(--text3);
}

.ns-tooltip-enter-active,
.ns-tooltip-leave-active {
    transition: all 200ms ease;
}

.ns-tooltip-enter-from,
.ns-tooltip-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
}
</style>
