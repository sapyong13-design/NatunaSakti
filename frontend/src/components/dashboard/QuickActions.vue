<script setup>
import { ref } from 'vue'
import Icon from '../Icon.vue'

const props = defineProps({
    rows: { type: Array, default: () => [] }
})

const emit = defineEmits(['refresh'])

const rippleStates = ref({})

const actions = [
    { key: 'refresh', icon: 'refresh', label: 'Refresh' },
    { key: 'export', icon: 'download', label: 'Export CSV' },
]

function handleAction(key, event) {
    // Create ripple effect
    if (event) {
        const button = event.currentTarget
        const rect = button.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top

        const rippleId = `${key}-${Date.now()}`
        rippleStates.value[rippleId] = { x, y, active: true }

        setTimeout(() => {
            delete rippleStates.value[rippleId]
        }, 600)
    }

    if (key === 'export') {
        exportToCSV()
    } else {
        emit(key)
    }
}

function exportToCSV() {
    if (!props.rows.length) {
        alert('Tidak ada data untuk diexport')
        return
    }

    // CSV headers
    const headers = ['Nomor Perkara', 'Jenis', 'Para Pihak', 'Tgl Register', 'Status', 'Lama Proses']

    // CSV rows
    const csvRows = props.rows.map(row => [
        `"${row.nomor_perkara || ''}"`,
        `"${row.jenis_perkara || ''}"`,
        `"${(row.para_pihak || '').replace(/"/g, '""')}"`,
        `"${row.sipp_tanggal_register || ''}"`,
        `"${row.sipp_status || ''}"`,
        `"${row.sipp_lama_proses || ''}"`
    ])

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...csvRows.map(row => row.join(','))
    ].join('\n')

    // Create blob and download
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `perkara_export_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
</script>

<template>
    <div class="ns-quick-actions">
        <button
            v-for="action in actions"
            :key="action.key"
            type="button"
            class="ns-action-btn"
            :aria-label="action.label"
            :title="action.label"
            @click="(e) => handleAction(action.key, e)"
        >
            <Icon :name="action.icon" :size="14" />
            <!-- Ripple elements -->
            <template v-for="(ripple, id) in rippleStates" :key="id">
                <span
                    v-if="id.startsWith(action.key)"
                    class="ns-ripple"
                    :style="{ left: ripple.x + 'px', top: ripple.y + 'px' }"
                ></span>
            </template>
        </button>
    </div>
</template>

<style scoped>
.ns-quick-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.ns-action-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    font-size: 12px;
    cursor: pointer;
    transition: all 180ms ease;
    overflow: hidden;
    will-change: transform, box-shadow;
}

.ns-action-btn:hover {
    border-color: var(--accent);
    background: var(--accentSoft);
    color: var(--accent);
    box-shadow: 0 2px 8px var(--accentGlow);
}

.ns-action-btn:active {
    transform: translateY(0);
}

.ns-action-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

/* Ripple effect */
.ns-ripple {
    position: absolute;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.2;
    transform: translate(-50%, -50%);
    animation: rippleEffect 0.6s ease-out forwards;
    pointer-events: none;
}

@keyframes rippleEffect {
    to {
        width: 200px;
        height: 200px;
        opacity: 0;
    }
}
</style>
