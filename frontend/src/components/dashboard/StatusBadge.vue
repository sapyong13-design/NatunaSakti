<script setup>
import { computed } from 'vue'

const props = defineProps({
    status: { type: String, required: true },
    size: { type: String, default: 'md' } // sm, md
})

const statusConfig = {
    'Minutasi': { variant: 'success', label: 'Minutasi', pulse: false },
    'minutasi': { variant: 'success', label: 'Minutasi', pulse: false },
    'MINUTASI': { variant: 'success', label: 'Minutasi', pulse: false },
    'Persidangan': { variant: 'warning', label: 'Bersidang', pulse: true },
    'PERSIDANGAN': { variant: 'warning', label: 'Bersidang', pulse: true },
    'Sedang Sidang': { variant: 'warning', label: 'Sedang Sidang', pulse: true },
    'sidang': { variant: 'warning', label: 'Sidang', pulse: false },
    'Proses': { variant: 'info', label: 'Proses', pulse: false },
    'proses': { variant: 'info', label: 'Proses', pulse: false },
    'Test': { variant: 'danger', label: 'Test', pulse: false },
    'test': { variant: 'danger', label: 'Test', pulse: false },
}

const config = computed(() => {
    return statusConfig[props.status] || { variant: 'default', label: props.status }
})
</script>

<template>
    <span class="ns-status-badge" :class="[`ns-status-${config.variant}`, `ns-status-${size}`, { 'has-pulse': config.pulse }]">
        <span v-if="config.pulse" class="ns-status-pulse"></span>
        <span class="ns-status-dot"></span>
        {{ config.label }}
    </span>
</template>

<style scoped>
.ns-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    position: relative;
}

/* Pulse animation for active status */
.ns-status-badge.has-pulse {
    position: relative;
}

.ns-status-pulse {
    position: absolute;
    left: 6px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--warn, #f59e0b);
    animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

@keyframes pulse-ring {
    0% {
        transform: scale(0.8);
        opacity: 0.8;
    }
    50% {
        transform: scale(2);
        opacity: 0.3;
    }
    100% {
        transform: scale(0.8);
        opacity: 0.8;
    }
}

.ns-status-badge.has-pulse .ns-status-dot {
    position: relative;
    z-index: 1;
}

.ns-status-badge.ns-status-sm {
    padding: 3px 8px;
    font-size: 10px;
}

.ns-status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
}

.ns-status-success {
    background: var(--success-soft, rgba(74,124,89,0.12));
    color: var(--success, #4A7C59);
}

.ns-status-success .ns-status-dot {
    background: var(--success, #4A7C59);
}

.ns-status-warning {
    background: var(--warn-soft, rgba(184,134,11,0.12));
    color: var(--warn, #B8860B);
}

.ns-status-warning .ns-status-dot {
    background: var(--warn, #B8860B);
}

.ns-status-danger {
    background: var(--danger-soft, rgba(199,91,74,0.12));
    color: var(--danger, #C75B4A);
}

.ns-status-danger .ns-status-dot {
    background: var(--danger, #C75B4A);
}

.ns-status-info {
    background: var(--accent-soft, rgba(13,92,92,0.1));
    color: var(--accent, #0D5C5C);
}

.ns-status-info .ns-status-dot {
    background: var(--accent, #0D5C5C);
}

.ns-status-default {
    background: var(--surface2);
    color: var(--text2);
}

.ns-status-default .ns-status-dot {
    background: var(--text3);
}
</style>
