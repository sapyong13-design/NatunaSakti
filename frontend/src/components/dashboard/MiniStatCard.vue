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

<style scoped>
.ns-c-mini-card {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 16px;
    padding: 14px 18px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
}

.ns-app[data-mode="dark"] .ns-c-mini-card {
    background: rgba(45, 55, 60, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
}

.ns-stat-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text3);
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.ns-c-mini-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
}

.ns-c-mini-unit {
    font-size: 14px;
    font-weight: 500;
    color: var(--text2);
    margin-left: 2px;
}

.ns-stat-delta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 500;
    color: var(--text3);
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--surface2);
}

.ns-stat-delta.is-up {
    background: var(--successSoft);
    color: var(--success);
}

.ns-stat-delta.is-down {
    background: var(--dangerSoft);
    color: var(--danger);
}
</style>
