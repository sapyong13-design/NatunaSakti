<script setup>
import { ref, computed } from 'vue'
import Icon from '../Icon.vue'
import { parseDateIndo, formatDateIndo } from '../../lib/date'

const props = defineProps({
    rows: { type: Array, required: true }
})

const emit = defineEmits(['perkaraClick'])

const selectedMonth = ref(null)

// Get all unique months from jadwal
const timelineMonths = computed(() => {
    const months = []
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

    props.rows.forEach(row => {
        if (row.sipp_tanggal_register) {
            const date = parseDateIndo(row.sipp_tanggal_register)
            if (date) {
                const monthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
                if (!months.find(m => m.name === monthYear)) {
                    months.push({
                        name: monthYear,
                        month: date.getMonth(),
                        year: date.getFullYear(),
                        count: 1
                    })
                } else {
                    const m = months.find(m => m.name === monthYear)
                    if (m) m.count++
                }
            }
        }
    })

    return months.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
    })
})

// Get perkara count per month (simplified - using register date)
const getMonthData = (month) => {
    return props.rows.filter(row => {
        const date = parseDateIndo(row.sipp_tanggal_register)
        if (!date) return false
        return date.getMonth() === month.month && date.getFullYear() === month.year
    })
}

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
</script>

<template>
    <div class="ns-timeline-viz">
        <div class="ns-timeline-scroll">
            <div
                v-for="month in timelineMonths"
                :key="month.name"
                class="ns-timeline-month"
                :class="{ active: selectedMonth === month.name }"
                @click="selectedMonth = selectedMonth === month.name ? null : month.name"
            >
                <div class="ns-timeline-month-name">{{ month.name }}</div>
                <div class="ns-timeline-month-count">{{ month.count }} perkara</div>
                <div v-if="selectedMonth === month.name" class="ns-timeline-month-detail">
                    <div
                        v-for="row in getMonthData(month)"
                        :key="row.id || row.nomor_perkara"
                        class="ns-timeline-perkara-item"
                        @click.stop="emit('perkaraClick', row)"
                    >
                        <span class="ns-timeline-nomor">{{ row.nomor_perkara }}</span>
                        <span class="ns-timeline-status">{{ row.sipp_status }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ns-timeline-viz {
    margin-bottom: 16px;
}

.ns-timeline-scroll {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding: 8px 4px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
}

.ns-timeline-scroll::-webkit-scrollbar {
    height: 6px;
}

.ns-timeline-scroll::-webkit-scrollbar-track {
    background: transparent;
}

.ns-timeline-scroll::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
}

.ns-timeline-month {
    flex: 0 0 auto;
    min-width: 140px;
    padding: 14px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 200ms ease;
    scroll-snap-align: start;
}

.ns-timeline-month:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}

.ns-timeline-month.active {
    border-color: var(--accent);
    background: linear-gradient(135deg, rgba(8, 145, 178, 0.08), transparent);
    box-shadow: 0 4px 16px rgba(8, 145, 178, 0.15);
}

.ns-timeline-month-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
}

.ns-timeline-month-count {
    font-size: 11px;
    color: var(--text-3);
    font-family: "JetBrains Mono", monospace;
}

.ns-timeline-month-detail {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ns-timeline-perkara-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: var(--surface-2);
    border-radius: 8px;
    font-size: 11px;
    cursor: pointer;
    transition: background 100ms ease;
}

.ns-timeline-perkara-item:hover {
    background: var(--accent-soft);
}

.ns-timeline-nomor {
    font-family: "JetBrains Mono", monospace;
    font-weight: 500;
    color: var(--text);
}

.ns-timeline-status {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--surface);
    border-radius: 4px;
    color: var(--text-2);
}

[data-mode="light"] .ns-timeline-month {
    background: #ffffff;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-timeline-month {
    background: #1e2129;
    border-color: #2d3748;
}
</style>
