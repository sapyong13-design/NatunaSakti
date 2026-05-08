<script setup>
import Icon from '../Icon.vue'

defineProps({
    label: { type: String, required: true },
    value: { type: [Number, String], required: true },
    unit: { type: String, default: '' },
    deltaText: { type: String, default: '' },
    deltaTrend: { type: String, default: 'flat' },
    deltaIcon: { type: String, default: 'activity' }
})
</script>

<template>
    <div class="ns-c-mini-card">
        <div class="ns-stat-label">{{ label }}</div>
        <div class="ns-c-mini-value">
            {{ value }}<span v-if="unit" class="ns-c-mini-unit">{{ unit }}</span>
        </div>
        <div
            v-if="deltaText"
            class="ns-stat-delta"
            :class="{ 'is-up': deltaTrend === 'up', 'is-down': deltaTrend === 'down' }"
            style="align-self: flex-start"
        >
            <Icon :name="deltaIcon" :size="11" />
            {{ deltaText }}
        </div>
    </div>
</template>
