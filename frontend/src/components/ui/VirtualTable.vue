<script setup>
import { ref, computed, watch } from 'vue'
import VirtualScroller from './VirtualScroller.vue'

const props = defineProps({
    columns: {
        type: Array,
        required: true,
        validator: (cols) => cols.every(c => c.key && c.label)
    },
    data: { type: Array, default: () => [] },
    rowHeight: { type: Number, default: 48 },
    height: { type: Number, default: 500 },
    stickyHeader: { type: Boolean, default: true },
    stickyColumns: { type: Array, default: () => [] }, // Column keys to stick
    striped: { type: Boolean, default: false },
    hoverable: { type: Boolean, default: true },
    selectable: { type: Boolean, default: false },
    rowKey: { type: String, default: 'id' },
    emptyMessage: { type: String, default: 'Tidak ada data' }
})

const emit = defineEmits(['row-click', 'selection-change',('visible-change')])

const selectedRows = ref(new Set())
const scrollerRef = ref(null)

// Calculate column widths
const columnWidths = computed(() => {
    return props.columns.map(col => col.width || 'auto')
})

// Check if column is sticky
const isColumnSticky = (key) => props.stickyColumns.includes(key)

// Get sticky offset for column
const getStickyOffset = (key) => {
    let offset = 0
    for (const col of props.stickyColumns) {
        if (col === key) break
        const colDef = props.columns.find(c => c.key === col)
        if (colDef?.width) offset += parseInt(colDef.width)
    }
    return offset
}

// Handle row click
function handleRowClick(row, index) {
    emit('row-click', row, index)

    if (props.selectable) {
        toggleSelection(row)
    }
}

// Toggle row selection
function toggleSelection(row) {
    const key = row[props.rowKey]
    const newSelection = new Set(selectedRows.value)

    if (newSelection.has(key)) {
        newSelection.delete(key)
    } else {
        newSelection.add(key)
    }

    selectedRows.value = newSelection
    emit('selection-change', Array.from(newSelection))
}

// Check if row is selected
const isRowSelected = (row) => {
    return selectedRows.value.has(row[props.rowKey])
}

// Toggle all selection
const toggleAll = () => {
    if (selectedRows.value.size === props.data.length) {
        selectedRows.value.clear()
    } else {
        selectedRows.value = new Set(props.data.map(row => row[props.rowKey]))
    }
    emit('selection-change', Array.from(selectedRows.value))
}

// Check if all selected
const isAllSelected = computed(() => {
    return props.data.length > 0 && selectedRows.value.size === props.data.length
})

// Check if some selected
const isSomeSelected = computed(() => {
    return selectedRows.value.size > 0 && !isAllSelected.value
})

// Clear selection
const clearSelection = () => {
    selectedRows.value.clear()
    emit('selection-change', [])
}

// Scroll methods
const scrollToRow = (index) => scrollerRef.value?.scrollToItem(index)
const scrollToTop = () => scrollerRef.value?.scrollToTop()
const scrollToBottom = () => scrollerRef.value?.scrollToBottom()

// Expose methods
defineExpose({
    scrollToRow,
    scrollToTop,
    scrollToBottom,
    toggleAll,
    clearSelection,
    selectedRows: computed(() => Array.from(selectedRows.value))
})

// Clear selection when data changes
watch(() => props.data, () => {
    selectedRows.value.clear()
})
</script>

<template>
    <div class="ns-virtual-table-container" :style="{ height: `${height}px` }">
        <!-- Header -->
        <div v-if="stickyHeader" class="ns-virtual-table-header" :class="{ 'has-sticky': stickyColumns.length > 0 }">
            <div
                v-for="col in columns"
                :key="col.key"
                class="ns-virtual-table-header-cell"
                :class="{ 'is-sticky': isColumnSticky(col.key) }"
                :style="{
                    width: col.width || 'auto',
                    minWidth: col.minWidth || '80px',
                    left: isColumnSticky(col.key) ? `${getStickyOffset(col.key)}px` : 'auto'
                }"
            >
                <slot :name="`header-${col.key}`" :column="col">
                    <span class="ns-virtual-table-header-label">{{ col.label }}</span>
                </slot>
            </div>
        </div>

        <!-- Virtual Scroller Body -->
        <VirtualScroller
            ref="scrollerRef"
            :items="data"
            :item-height="rowHeight"
            :container-height="height - (stickyHeader ? rowHeight : 0)"
            :buffer="3"
            @visible-change="(range) => emit('visible-change', range)"
        >
            <template #item="{ item: row, index }">
                <div
                    class="ns-virtual-table-row"
                    :class="{
                        'is-striped': striped && index % 2 === 1,
                        'is-hoverable': hoverable,
                        'is-selected': isRowSelected(row)
                    }"
                    @click="handleRowClick(row, index)"
                >
                    <div
                        v-for="col in columns"
                        :key="col.key"
                        class="ns-virtual-table-cell"
                        :class="{ 'is-sticky': isColumnSticky(col.key) }"
                        :style="{
                            width: col.width || 'auto',
                            minWidth: col.minWidth || '80px',
                            left: isColumnSticky(col.key) ? `${getStickyOffset(col.key)}px` : 'auto'
                        }"
                    >
                        <!-- Checkbox column for selection -->
                        <template v-if="col.key === '_select' && selectable">
                            <label class="ns-checkbox">
                                <input
                                    type="checkbox"
                                    :checked="isRowSelected(row)"
                                    @click.stop
                                    @change="toggleSelection(row)"
                                >
                                <span class="ns-checkbox-indicator"></span>
                            </label>
                        </template>

                        <!-- Regular column -->
                        <slot
                            v-else
                            :name="`cell-${col.key}`"
                            :row="row"
                            :value="row[col.key]"
                            :column="col"
                            :index="index"
                        >
                            <span class="ns-virtual-table-cell-text">
                                {{ col.format ? col.format(row[col.key], row) : row[col.key] }}
                            </span>
                        </slot>
                    </div>
                </div>
            </template>
        </VirtualScroller>

        <!-- Empty State -->
        <div v-if="data.length === 0" class="ns-virtual-table-empty">
            <slot name="empty">
                <div class="ns-empty-state">
                    <div class="ns-empty-icon">📋</div>
                    <p class="ns-empty-text">{{ emptyMessage }}</p>
                </div>
            </slot>
        </div>

        <!-- Footer controls -->
        <div v-if="selectable && data.length > 0" class="ns-virtual-table-footer">
            <div class="ns-table-controls">
                <label class="ns-checkbox ns-checkbox-small">
                    <input
                        type="checkbox"
                        :checked="isAllSelected"
                        :indeterminate="isSomeSelected"
                        @change="toggleAll"
                    >
                    <span class="ns-checkbox-indicator"></span>
                </label>
                <span class="ns-selection-info">
                    {{ selectedRows.size }} dari {{ data.length }} dipilih
                </span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ns-virtual-table-container {
    position: relative;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-2);
}

/* Header */
.ns-virtual-table-header {
    display: flex;
    height: 48px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    position: relative;
    z-index: 20;
}

.ns-virtual-table-header.has-sticky {
    overflow-x: hidden;
}

.ns-virtual-table-header-cell {
    display: flex;
    align-items: center;
    padding: 0 16px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-3);
    border-right: 1px solid var(--border);
    flex-shrink: 0;
}

.ns-virtual-table-header-cell:last-child {
    border-right: none;
}

.ns-virtual-table-header-cell.is-sticky {
    position: sticky;
    background: var(--surface-2);
    z-index: 21;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
}

.ns-virtual-table-header-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Row */
.ns-virtual-table-row {
    display: flex;
    height: 100%;
    border-bottom: 1px solid var(--border);
    transition: background-color 0.15s ease;
}

.ns-virtual-table-row:last-child {
    border-bottom: none;
}

.ns-virtual-table-row.is-striped {
    background: var(--surface-1);
}

.ns-virtual-table-row.is-hoverable:hover {
    background: var(--surface-2);
}

.ns-virtual-table-row.is-selected {
    background: rgba(var(--accent-rgb), 0.1);
}

.ns-virtual-table-row.is-selected:hover {
    background: rgba(var(--accent-rgb), 0.15);
}

/* Cell */
.ns-virtual-table-cell {
    display: flex;
    align-items: center;
    padding: 0 16px;
    font-size: 13px;
    color: var(--text-2);
    border-right: 1px solid var(--border);
    flex-shrink: 0;
    overflow: hidden;
}

.ns-virtual-table-cell:last-child {
    border-right: none;
}

.ns-virtual-table-cell.is-sticky {
    position: sticky;
    background: inherit;
    z-index: 10;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
}

.ns-virtual-table-cell-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
}

/* Checkbox */
.ns-checkbox {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
}

.ns-checkbox input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}

.ns-checkbox-indicator {
    width: 18px;
    height: 18px;
    border: 2px solid var(--border);
    border-radius: 4px;
    background: var(--bg-2);
    position: relative;
    transition: all 0.15s ease;
}

.ns-checkbox:hover .ns-checkbox-indicator {
    border-color: var(--accent);
}

.ns-checkbox input[type="checkbox"]:checked + .ns-checkbox-indicator {
    background: var(--accent);
    border-color: var(--accent);
}

.ns-checkbox input[type="checkbox"]:checked + .ns-checkbox-indicator::after {
    content: '';
    position: absolute;
    left: 5px;
    top: 2px;
    width: 4px;
    height: 8px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}

.ns-checkbox input[type="checkbox"]:indeterminate + .ns-checkbox-indicator::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 7px;
    width: 6px;
    height: 2px;
    background: white;
}

.ns-checkbox-small .ns-checkbox-indicator {
    width: 16px;
    height: 16px;
}

/* Empty State */
.ns-virtual-table-empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.ns-empty-state {
    text-align: center;
    padding: 48px 24px;
}

.ns-empty-icon {
    font-size: 48px;
    opacity: 0.5;
    margin-bottom: 16px;
}

.ns-empty-text {
    font-size: 14px;
    color: var(--text-3);
    margin: 0;
}

/* Footer */
.ns-virtual-table-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--surface-2);
    border-top: 1px solid var(--border);
}

.ns-table-controls {
    display: flex;
    align-items: center;
    gap: 12px;
}

.ns-selection-info {
    font-size: 12px;
    color: var(--text-3);
}
</style>
