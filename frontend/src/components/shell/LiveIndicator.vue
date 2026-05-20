<script setup>
defineProps({
    syncing: { type: Boolean, default: false },
    lastSync: { type: String, default: '--' }
})
</script>

<template>
    <div class="ns-live" :class="{ 'is-syncing': syncing }">
        <span class="ns-live-pulse" />
        <span class="ns-live-label">{{ syncing ? 'Syncing…' : 'Sync OK' }}</span>
        <span class="ns-live-sep">·</span>
        <span class="ns-live-time">{{ lastSync }}</span>
    </div>
</template>
