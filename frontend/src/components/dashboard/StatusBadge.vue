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
    if (statusConfig[props.status]) return statusConfig[props.status]

    const status = props.status || ''
    const lower = status.toLowerCase()
    if (lower.includes('sidang')) return { variant: 'warning', label: 'Sidang', pulse: true }
    if (lower.includes('banding') || lower.includes('kasasi') || lower.includes('keberatan')) {
        return { variant: 'info', label: 'Upaya Hukum', pulse: false }
    }
    if (lower.includes('eksekusi')) return { variant: 'info', label: 'Eksekusi', pulse: false }
    if (lower.includes('damai')) return { variant: 'success', label: 'Damai', pulse: false }
    if (lower.includes('cabut')) return { variant: 'danger', label: 'Cabut', pulse: false }
    if (lower.includes('putusan')) return { variant: 'info', label: 'Putusan', pulse: false }
    if (lower.includes('daftar') || lower.includes('distribusi')) return { variant: 'default', label: 'Terdaftar', pulse: false }
    return { variant: 'default', label: status || 'Aktif' }
})
</script>

<template>
    <span class="ns-status-badge" :class="[`ns-status-${config.variant}`, `ns-status-${size}`, { 'has-pulse': config.pulse }]">
        <span v-if="config.pulse" class="ns-status-pulse"></span>
        <span class="ns-status-dot"></span>
        <span class="ns-status-label">{{ config.label }}</span>
    </span>
</template>

<style scoped>
.ns-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border-radius: 7px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    position: relative;
    overflow: hidden;
    transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
}

.ns-status-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Gradient overlay for all badges */
.ns-status-badge::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0.5;
    border-radius: inherit;
    pointer-events: none;
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
    padding: 4px 9px;
    font-size: 10px;
    max-width: 116px;
}

.ns-status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    position: relative;
    z-index: 1;
}

.ns-status-badge span:not(.ns-status-pulse):not(.ns-status-dot) {
    position: relative;
    z-index: 1;
}

.ns-status-success {
    background: linear-gradient(135deg, rgba(74,124,89,0.15) 0%, rgba(74,124,89,0.08) 100%);
    color: var(--success, #4A7C59);
    border: 1px solid rgba(74,124,89,0.2);
}

.ns-status-success::before {
    background: linear-gradient(90deg, transparent, rgba(74,124,89,0.2), transparent);
}

.ns-status-success .ns-status-dot {
    background: var(--success, #4A7C59);
    box-shadow: 0 0 6px rgba(74,124,89,0.4);
}

.ns-status-warning {
    background: linear-gradient(135deg, rgba(184,134,11,0.15) 0%, rgba(184,134,11,0.08) 100%);
    color: var(--warn, #B8860B);
    border: 1px solid rgba(184,134,11,0.2);
}

.ns-status-warning::before {
    background: linear-gradient(90deg, transparent, rgba(184,134,11,0.2), transparent);
}

.ns-status-warning .ns-status-dot {
    background: var(--warn, #B8860B);
    box-shadow: 0 0 6px rgba(184,134,11,0.4);
}

.ns-status-danger {
    background: linear-gradient(135deg, rgba(199,91,74,0.15) 0%, rgba(199,91,74,0.08) 100%);
    color: var(--danger, #C75B4A);
    border: 1px solid rgba(199,91,74,0.2);
}

.ns-status-danger::before {
    background: linear-gradient(90deg, transparent, rgba(199,91,74,0.2), transparent);
}

.ns-status-danger .ns-status-dot {
    background: var(--danger, #C75B4A);
    box-shadow: 0 0 6px rgba(199,91,74,0.4);
}

.ns-status-info {
    background: linear-gradient(135deg, rgba(74,28,27,0.12) 0%, rgba(74,28,27,0.06) 100%);
    color: var(--accent, #4A1C1B);
    border: 1px solid rgba(74,28,27,0.15);
}

.ns-status-info::before {
    background: linear-gradient(90deg, transparent, rgba(74,28,27,0.15), transparent);
}

.ns-status-info .ns-status-dot {
    background: var(--accent, #4A1C1B);
    box-shadow: 0 0 6px rgba(74,28,27,0.3);
}

.ns-status-default {
    background: linear-gradient(135deg, var(--surface2) 0%, var(--surface3) 100%);
    color: var(--text2);
    border: 1px solid var(--border);
}

.ns-status-default .ns-status-dot {
    background: var(--text3);
}
</style>
