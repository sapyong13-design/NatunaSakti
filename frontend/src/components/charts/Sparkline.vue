<script setup>
import { computed } from 'vue'

const props = defineProps({
    data: { type: Array, required: true },
    color: { type: String, default: '#10b981' },
    width: { type: Number, default: 200 },
    height: { type: Number, default: 60 },
    fill: { type: Boolean, default: true }
})

const gradId = 'spark-' + Math.random().toString(36).slice(2, 9)

const computed_ = computed(() => {
    const max = Math.max(...props.data)
    const min = Math.min(...props.data)
    const range = max - min || 1
    const step = props.width / Math.max(1, props.data.length - 1)
    const points = props.data.map((v, i) => [
        i * step,
        props.height - ((v - min) / range) * (props.height - 8) - 4
    ])
    const path = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
        .join(' ')
    const areaPath = `${path} L ${props.width} ${props.height} L 0 ${props.height} Z`
    const last = points[points.length - 1] || [0, 0]
    return { points, path, areaPath, last }
})
</script>

<template>
    <svg :width="width" :height="height" style="display: block">
        <defs>
            <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
                <stop offset="100%" :stop-color="color" stop-opacity="0" />
            </linearGradient>
        </defs>
        <path v-if="fill" :d="computed_.areaPath" :fill="`url(#${gradId})`" />
        <path
            :d="computed_.path"
            fill="none"
            :stroke="color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
        <g v-if="computed_.points.length">
            <circle :cx="computed_.last[0]" :cy="computed_.last[1]" r="6" :fill="color" fill-opacity="0.2" />
            <circle :cx="computed_.last[0]" :cy="computed_.last[1]" r="3" :fill="color" />
        </g>
    </svg>
</template>
