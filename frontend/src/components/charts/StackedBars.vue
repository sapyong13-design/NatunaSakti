<script setup>
import { computed } from 'vue'

const props = defineProps({
    data: { type: Array, required: true },
    width: { type: Number, default: 280 },
    height: { type: Number, default: 100 },
    colorA: { type: String, default: '#10b981' },
    colorB: { type: String, default: '#34d399' }
})

const bars = computed(() => {
    const max = Math.max(...props.data.map(d => d.pidana + d.perdata))
    const barW = (props.width - 16) / props.data.length
    return props.data.map((d, i) => {
        const total = d.pidana + d.perdata
        const totalH = (total / max) * props.height
        const pidH = (d.pidana / max) * props.height
        const perH = (d.perdata / max) * props.height
        const x = 8 + i * barW
        const y = props.height - totalH
        return { x, y, barW, pidH, perH, week: d.week }
    })
})
</script>

<template>
    <svg :width="width" :height="height + 20" style="display: block">
        <g v-for="(b, i) in bars" :key="i">
            <rect :x="b.x + 3" :y="b.y" :width="b.barW - 6" :height="b.pidH" rx="3" :fill="colorA" />
            <rect :x="b.x + 3" :y="b.y + b.pidH" :width="b.barW - 6" :height="b.perH" rx="3" :fill="colorB" opacity="0.85" />
            <text
                :x="b.x + b.barW / 2"
                :y="height + 14"
                text-anchor="middle"
                font-size="9"
                fill="currentColor"
                opacity="0.6"
            >{{ b.week }}</text>
        </g>
    </svg>
</template>
