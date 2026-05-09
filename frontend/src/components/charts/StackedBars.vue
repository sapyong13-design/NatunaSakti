<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
    data: { type: Array, required: true },
    width: { type: Number, default: 280 },
    height: { type: Number, default: 100 },
    colorA: { type: String, default: '#C75B4A' },
    colorB: { type: String, default: '#4A7C59' },
    barWidth: { type: Number, default: 32 },
    gap: { type: Number, default: 8 }
})

const emit = defineEmits(['month-click'])

const hoveredIndex = ref(null)

const max = computed(() => Math.max(...props.data.map(d => (d.pidana || 0) + (d.perdata || 0)), 1))

const bars = computed(() => {
    const totalBarsWidth = props.data.length * props.barWidth + (props.data.length - 1) * props.gap
    const startX = Math.max(8, (props.width - totalBarsWidth) / 2)

    return props.data.map((d, i) => {
        const total = (d.pidana || 0) + (d.perdata || 0)
        const totalH = (total / max.value) * props.height
        const pidH = ((d.pidana || 0) / max.value) * props.height
        const perH = ((d.perdata || 0) / max.value) * props.height
        const x = startX + i * (props.barWidth + props.gap)
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

function handleMouseEnter(bar, event) {
    hoveredIndex.value = bar.index
}

function handleMouseLeave() {
    hoveredIndex.value = null
}

function handleClick(bar, event) {
    emit('month-click', bar.originalData)
}
</script>

<template>
    <div class="ns-stacked-bars" :style="{ width: `${width}px` }">
        <svg :width="width" :height="height + 24" style="display: block">
            <defs>
                <linearGradient id="grad-pidana" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" :stop-color="colorA" stop-opacity="1" />
                    <stop offset="100%" :stop-color="colorA" stop-opacity="0.75" />
                </linearGradient>
                <linearGradient id="grad-perdata" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" :stop-color="colorB" stop-opacity="0.95" />
                    <stop offset="100%" :stop-color="colorB" stop-opacity="0.7" />
                </linearGradient>
                <filter id="glow-pidana" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            <g
                v-for="b in bars"
                :key="b.index"
                class="ns-bar-group"
                :class="{ 'is-hovered': hoveredIndex === b.index }"
                @mouseenter="handleMouseEnter(b, $event)"
                @mouseleave="handleMouseLeave"
                @click="handleClick(b, $event)"
            >
                <!-- Pidana bar -->
                <rect
                    :x="b.x"
                    :y="b.y"
                    :width="barWidth"
                    :height="b.pidH"
                    :rx="barWidth / 4"
                    :fill="hoveredIndex === b.index ? 'url(#grad-pidana)' : colorA"
                    :fill-opacity="0.5 + (b.intensity * 0.5)"
                    class="ns-bar-rect ns-bar-pidana"
                />

                <!-- Perdata bar -->
                <rect
                    :x="b.x"
                    :y="b.y + b.pidH"
                    :width="barWidth"
                    :height="b.perH"
                    :rx="barWidth / 4"
                    :fill="hoveredIndex === b.index ? 'url(#grad-perdata)' : colorB"
                    :fill-opacity="0.5 + (b.intensity * 0.5)"
                    class="ns-bar-rect ns-bar-perdata"
                />

                <!-- Month label -->
                <text
                    :x="b.x + barWidth / 2"
                    :y="height + 16"
                    text-anchor="middle"
                    font-size="10"
                    :font-weight="hoveredIndex === b.index || b.isPeak ? '600' : '500'"
                    fill="currentColor"
                    :opacity="hoveredIndex === b.index || b.isPeak ? 1 : 0.6"
                >{{ b.label }}</text>
            </g>

            <!-- Cumulative line (optional visual enhancement) -->
            <polyline
                v-if="bars.length"
                :points="bars.map(b => `${b.x + barWidth / 2},${b.y}`).join(' ')"
                fill="none"
                stroke="var(--accent)"
                stroke-width="1.5"
                stroke-opacity="0.3"
                stroke-dasharray="4 4"
                class="ns-cumulative-line"
            />
        </svg>
    </div>
</template>

<style scoped>
.ns-stacked-bars {
    position: relative;
    display: inline-block;
}

.ns-bar-group {
    cursor: pointer;
}

.ns-bar-rect {
    transition: all 0.2s ease;
}

.ns-bar-group:hover .ns-bar-rect {
    filter: brightness(1.1);
}

.ns-cumulative-line {
    pointer-events: none;
    transition: all 0.3s ease;
}
</style>
