<script setup>
import { ref, computed } from 'vue'
import { parseDateIndo } from '../../lib/date'

const props = defineProps({
    rows: { type: Array, required: true }
})

// Get sidang density per day
const heatmapData = computed(() => {
    const data = {}
    const today = new Date()

    // Initialize last 90 days
    for (let i = 89; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const key = date.toISOString().split('T')[0]
        data[key] = { date, count: 0, items: [] }
    }

    // Count perkara per register date
    props.rows.forEach(row => {
        if (row.sipp_tanggal_register) {
            const date = parseDateIndo(row.sipp_tanggal_register)
            if (date) {
                const key = date.toISOString().split('T')[0]
                if (data[key]) {
                    data[key].count++
                    data[key].items.push(row)
                }
            }
        }
    })

    return Object.values(data).sort((a, b) => a.date - b.date)
})

// Get color intensity based on count
function getColor(count) {
    if (count === 0) return 'rgba(156, 163, 175, 0.1)'
    if (count <= 2) return 'rgba(8, 145, 178, 0.3)'
    if (count <= 4) return 'rgba(8, 145, 178, 0.5)'
    if (count <= 6) return 'rgba(8, 145, 178, 0.7)'
    return 'rgba(8, 145, 178, 0.9)'
}

function getMonthName(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    return months[date.getMonth()]
}

// Group by week for display
const weeks = computed(() => {
    const result = []
    let currentWeek = []

    heatmapData.value.forEach((day, index) => {
        currentWeek.push(day)
        if (currentWeek.length === 7 || index === heatmapData.value.length - 1) {
            result.push([...currentWeek])
            currentWeek = []
        }
    })

    return result
})

// Get unique months
const months = computed(() => {
    const unique = new Map()
    heatmapData.value.forEach(day => {
        const key = `${day.date.getFullYear()}-${day.date.getMonth()}`
        if (!unique.has(key)) {
            unique.set(key, { name: getMonthName(day.date), year: day.date.getFullYear(), firstDay: day })
        }
    })
    return Array.from(unique.values())
})
</script>

<template>
    <div class="ns-heatmap-calendar">
        <div class="ns-heatmap-header">
            <span class="ns-heatmap-title">Kepadatan Pendaftaran</span>
            <span class="ns-heatmap-legend">
                <span class="ns-heatmap-legend-item" style="background: rgba(156, 163, 175, 0.1)"></span>
                <span class="ns-heatmap-legend-item" style="background: rgba(8, 145, 178, 0.3)"></span>
                <span class="ns-heatmap-legend-item" style="background: rgba(8, 145, 178, 0.5)"></span>
                <span class="ns-heatmap-legend-item" style="background: rgba(8, 145, 178, 0.7)"></span>
                <span class="ns-heatmap-legend-item" style="background: rgba(8, 145, 178, 0.9)"></span>
            </span>
        </div>

        <div class="ns-heatmap-months">
            <span v-for="month in months" :key="month.name + month.year" class="ns-heatmap-month-label">
                {{ month.name }} {{ month.year }}
            </span>
        </div>

        <div class="ns-heatmap-grid">
            <div v-for="(week, wIndex) in weeks" :key="wIndex" class="ns-heatmap-week">
                <div
                    v-for="(day, dIndex) in week"
                    :key="dIndex"
                    class="ns-heatmap-day"
                    :style="{ background: getColor(day.count) }"
                    :title="`${day.date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}: ${day.count} perkara`"
                >
                    <span v-if="day.count > 0" class="ns-heatmap-day-count">{{ day.count }}</span>
                </div>
            </div>
        </div>

        <div class="ns-heatmap-footer">
            <span class="ns-heatmap-info">90 hari terakhir</span>
        </div>
    </div>
</template>

<style scoped>
.ns-heatmap-calendar {
    padding: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 16px;
}

.ns-heatmap-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.ns-heatmap-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.ns-heatmap-legend {
    display: flex;
    gap: 4px;
}

.ns-heatmap-legend-item {
    width: 12px;
    height: 12px;
    border-radius: 2px;
}

.ns-heatmap-months {
    display: flex;
    gap: 24px;
    margin-bottom: 8px;
    padding-left: 28px;
}

.ns-heatmap-month-label {
    font-size: 10px;
    color: var(--text-3);
    font-weight: 500;
    text-transform: uppercase;
}

.ns-heatmap-grid {
    display: flex;
    gap: 3px;
}

.ns-heatmap-week {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.ns-heatmap-day {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    position: relative;
    cursor: pointer;
    transition: transform 100ms ease;
}

.ns-heatmap-day:hover {
    transform: scale(1.2);
    z-index: 1;
}

.ns-heatmap-day-count {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    font-size: 8px;
    font-weight: 600;
    color: var(--accent);
    pointer-events: none;
}

.ns-heatmap-footer {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
}

.ns-heatmap-info {
    font-size: 10px;
    color: var(--text-3);
}

[data-mode="light"] .ns-heatmap-calendar {
    background: #ffffff;
    border-color: #e5e7eb;
}

[data-mode="dark"] .ns-heatmap-calendar {
    background: #1e2129;
    border-color: #2d3748;
}
</style>
