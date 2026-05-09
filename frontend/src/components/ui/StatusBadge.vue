<script setup>
import { computed } from 'vue'

const props = defineProps({
    status: { type: String, default: '' },
    size: { type: String, default: 'md' }, // sm, md, lg
    dot: { type: Boolean, default: false }
})

const config = {
    // SIPP statuses
    'Daftar': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: 'Terdaftar' },
    'Proses Sidang': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'Sidang' },
    'Putus': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Putus' },
    'Minutasi': { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', label: 'Minutasi' },
    'Inkrah': { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', label: 'Inkrah' },
    'Eksekusi': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Eksekusi' },
    'Selesai': { color: '#059669', bg: 'rgba(5, 150, 105, 0.15)', label: 'Selesai' },

    // Generic statuses
    'Aktif': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Aktif' },
    'Pending': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'Pending' },
    'Batal': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Batal' },
    'Tunda': { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)', label: 'Tunda' }
}

const statusConfig = computed(() => {
    return config[props.status] || {
        color: '#6b7280',
        bg: 'rgba(107, 114, 128, 0.15)',
        label: props.status || '—'
    }
})

const sizeClasses = computed(() => {
    const sizes = {
        sm: 'ns-status-badge-sm',
        md: 'ns-status-badge-md',
        lg: 'ns-status-badge-lg'
    }
    return sizes[props.size] || sizes.md
})
</script>

<template>
    <span
        class="ns-status-badge"
        :class="sizeClasses"
        :style="{
            '--status-color': statusConfig.color,
            '--status-bg': statusConfig.bg
        }"
    >
        <span v-if="dot" class="ns-status-dot" />
        <span class="ns-status-label">{{ statusConfig.label }}</span>
    </span>
</template>

<style scoped>
.ns-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--status-bg);
    color: var(--status-color);
    font-size: 12px;
    font-weight: 500;
}

.ns-status-badge-sm {
    padding: 2px 8px;
    font-size: 11px;
}

.ns-status-badge-md {
    padding: 4px 10px;
    font-size: 12px;
}

.ns-status-badge-lg {
    padding: 6px 12px;
    font-size: 13px;
}

.ns-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--status-color);
    box-shadow: 0 0 6px var(--status-color);
    animation: ns-pulse-dot 2s ease-in-out infinite;
}

@keyframes ns-pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
</style>
