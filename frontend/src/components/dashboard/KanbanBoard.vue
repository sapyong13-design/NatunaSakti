<script setup>
import { ref, computed } from 'vue'
import Icon from '../Icon.vue'
import { pihakUtama } from '../../lib/pihak'

const props = defineProps({
    rows: { type: Array, required: true }
})

const emit = defineEmits(['rowClick'])

const columns = [
    { key: 'proses', label: 'Proses', color: '#6366f1' },
    { key: 'bersidang', label: 'Bersidang', color: '#f59e0b' },
    { key: 'minutasi', label: 'Minutasi', color: '#10b981' }
]

function getStatusCategory(row) {
    const status = (row.sipp_status || '').toLowerCase()
    if (status.includes('minutasi')) return 'minutasi'
    if (status.includes('persidangan') || status.includes('sidang')) return 'bersidang'
    return 'proses'
}

function getRowsByStatus(status) {
    return props.rows.filter(row => getStatusCategory(row) === status)
}

function jenisColor(jenis) {
    if (jenis === 'Pidana') return '#C75B4A'
    if (jenis === 'Perdata') return '#4A7C59'
    if (jenis === 'Perikanan') return '#0ea5e9'
    return '#9ca3af'
}
</script>

<template>
    <div class="ns-kanban-board">
        <div
            v-for="column in columns"
            :key="column.key"
            class="ns-kanban-column"
            :style="{ '--column-color': column.color }"
        >
            <div class="ns-kanban-header">
                <span class="ns-kanban-dot" :style="{ background: column.color }"></span>
                <span class="ns-kanban-title">{{ column.label }}</span>
                <span class="ns-kanban-count">{{ getRowsByStatus(column.key).length }}</span>
            </div>
            <div class="ns-kanban-cards">
                <div
                    v-for="row in getRowsByStatus(column.key)"
                    :key="row.id || row.nomor_perkara"
                    class="ns-kanban-card"
                    @click="emit('rowClick', row)"
                >
                    <div class="ns-kanban-card-header">
                        <span
                            class="ns-kanban-jenis"
                            :style="{ color: jenisColor(row.jenis_perkara) }"
                        >
                            {{ row.jenis_perkara }}
                        </span>
                        <span class="ns-kanban-lama">{{ row.sipp_lama_proses || '—' }}</span>
                    </div>
                    <div class="ns-kanban-nomor">{{ row.nomor_perkara }}</div>
                    <div class="ns-kanban-nama">{{ pihakUtama(row.para_pihak) }}</div>
                </div>
                <div v-if="!getRowsByStatus(column.key).length" class="ns-kanban-empty">
                    <Icon name="folder" :size="24" />
                    <span>Tidak ada perkara</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ns-kanban-board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    min-height: 400px;
}

.ns-kanban-column {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.ns-kanban-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-weight: 600;
    font-size: 13px;
}

.ns-kanban-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.ns-kanban-title {
    flex: 1;
    color: var(--text);
}

.ns-kanban-count {
    padding: 2px 8px;
    background: var(--surface-2);
    border-radius: 12px;
    font-size: 11px;
    color: var(--text-2);
    font-family: "JetBrains Mono", monospace;
}

.ns-kanban-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 200px;
}

.ns-kanban-card {
    padding: 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
}

.ns-kanban-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--column-color);
}

[data-mode="dark"] .ns-kanban-card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.ns-kanban-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.ns-kanban-jenis {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.ns-kanban-lama {
    font-size: 11px;
    color: var(--text-3);
    font-family: "JetBrains Mono", monospace;
}

.ns-kanban-nomor {
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 6px;
}

.ns-kanban-nama {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.ns-kanban-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    color: var(--text-3);
    font-size: 12px;
    gap: 8px;
}

[data-mode="light"] .ns-kanban-header,
[data-mode="light"] .ns-kanban-card {
    background: #ffffff;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-kanban-header,
[data-mode="dark"] .ns-kanban-card {
    background: #1e2129;
    border-color: #2d3748;
}

@media (max-width: 1024px) {
    .ns-kanban-board {
        grid-template-columns: 1fr;
    }
}
</style>
