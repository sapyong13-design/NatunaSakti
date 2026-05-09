<script setup>
import Icon from '../Icon.vue'

const props = defineProps({
    rows: { type: Array, default: () => [] }
})

const emit = defineEmits(['refresh'])

const actions = [
    { key: 'refresh', icon: 'refresh', label: 'Refresh' },
    { key: 'export', icon: 'download', label: 'Export CSV' },
]

function handleAction(key) {
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
            @click="handleAction(action.key)"
        >
            <Icon :name="action.icon" :size="14" />
            <span>{{ action.label }}</span>
        </button>
    </div>
</template>

<style scoped>
.ns-quick-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.ns-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms;
}

.ns-action-btn:hover {
    border-color: var(--accent);
    background: var(--surface2);
}

.ns-action-btn:active {
    transform: translateY(1px);
}
</style>
