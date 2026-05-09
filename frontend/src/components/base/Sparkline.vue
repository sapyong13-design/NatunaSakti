<script setup>
import { computed } from 'vue'

const props = defineProps({
    data: { type: Array, default: () => [] },
    width: { type: Number, default: 80 },
    height: { type: Number, default: 32 },
    showArea: { type: Boolean, default: false }
})

const trend = computed(() => {
    if (props.data.length < 2) return 'neutral'
    const first = props.data[0]
    const last = props.data[props.data.length - 1]
    return last > first ? 'up' : last < first ? 'down' : 'neutral'
})

const points = computed(() => {
    if (!props.data.length) return ''
    const max = Math.max(...props.data, 1)
    const min = Math.min(...props.data, 0)
    const range = max - min || 1

    return props.data.map((val, i) => {
        const x = (i / (props.data.length - 1)) * props.width
        const y = props.height - ((val - min) / range) * props.height
        return `${x},${y}`
    }).join(' ')
})

const areaPoints = computed(() => {
    if (!props.data.length) return ''
    return `0,${props.height} ${points.value} ${props.width},${props.height}`
})
</script>

<template>
    <div class="ns-sparkline-wrap" :class="[`ns-sparkline-${trend}`]">
        <svg :width="width" :height="height" class="ns-sparkline">
            <defs>
                <linearGradient :id="`grad-${trend}`" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="currentColor" stop-opacity="0.3" />
                    <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
                </linearGradient>
            </defs>
            <polygon
                v-if="showArea"
                :points="areaPoints"
                :fill="`url(#grad-${trend})`"
            />
            <polyline
                :points="points"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    </div>
</template>

<style scoped>
.ns-sparkline-wrap {
    display: inline-block;
}

.ns-sparkline.is-up {
    color: var(--success);
}

.ns-sparkline.is-down {
    color: var(--danger);
}

.ns-sparkline.is-neutral {
    color: var(--text3);
}
</style>
