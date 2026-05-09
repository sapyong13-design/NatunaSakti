<script setup>
import { computed } from 'vue'

const props = defineProps({
    status: { type: String, required: true },
    size: { type: String, default: 'md' } // sm, md
})

const statusConfig = {
    'Minutasi': { variant: 'success', label: 'Minutasi' },
    'minutasi': { variant: 'success', label: 'Minutasi' },
    'Sedang Sidang': { variant: 'warning', label: 'Sedang Sidang' },
    'sidang': { variant: 'warning', label: 'Sidang' },
    'Proses': { variant: 'info', label: 'Proses' },
    'proses': { variant: 'info', label: 'Proses' },
    'Test': { variant: 'danger', label: 'Test' },
    'test': { variant: 'danger', label: 'Test' },
}

const config = computed(() => {
    return statusConfig[props.status] || { variant: 'default', label: props.status }
})
</script>

<template>
    <span class="ns-status-badge" :class="[`ns-status-${config.variant}`, `ns-status-${size}`]">
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
