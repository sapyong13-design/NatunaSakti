<script setup>
defineProps({
    syncing: { type: Boolean, default: false },
    status: { type: String, default: 'ok' }, // 'ok' | 'warn' | 'error'
    label: { type: String, default: 'Sync OK' },
    lastSync: { type: String, default: '--' },
    title: { type: String, default: '' }
})
</script>

<template>
    <div class="ns-live" :class="{ 'is-syncing': syncing, [`is-${status}`]: !syncing }" :title="title || undefined">
        <span class="ns-live-pulse"><span class="ns-pulse-dot" /></span>
        <span class="ns-live-label">{{ syncing ? 'Syncing…' : label }}</span>
        <span class="ns-live-sep">·</span>
        <span class="ns-live-time">{{ lastSync }}</span>
    </div>
</template>

<style scoped>
.ns-live.is-warn {
    border-color: rgba(245, 158, 11, 0.35);
}
.ns-live.is-warn .ns-pulse-dot {
    background: var(--warning, #f59e0b);
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.45);
}
.ns-live.is-error {
    border-color: rgba(239, 68, 68, 0.35);
}
.ns-live.is-error .ns-pulse-dot {
    background: var(--danger, #ef4444);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.45);
}
</style>
