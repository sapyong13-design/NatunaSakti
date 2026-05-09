<script setup>
import { ref, computed } from 'vue'
import { HOLIDAY_MAP } from '../lib/holidays.js'

const props = defineProps({
    startDate: { type: String, default: '' },
    endDate:   { type: String, default: '' },
})

const emit = defineEmits(['update:startDate', 'update:endDate', 'done'])

const todayIso = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
})()

const viewYear  = ref(props.startDate ? +props.startDate.slice(0,4) : new Date().getFullYear())
const viewMonth = ref(props.startDate ? +props.startDate.slice(5,7)-1 : new Date().getMonth())

const BULAN_NAMA = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember']
const DOW_LABEL = ['Sen','Sel','Rab','Kam','Jum','Sab','Min']

function toIso(y, m, d) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

const days = computed(() => {
    const y = viewYear.value
    const m = viewMonth.value
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7  // Monday=0
    const lastDate = new Date(y, m+1, 0).getDate()

    const out = Array(firstDow).fill(null)
    for (let d = 1; d <= lastDate; d++) {
        const dow = new Date(y, m, d).getDay()
        const iso = toIso(y, m, d)
        out.push({ iso, day: d, dow, isWeekend: dow===0||dow===6, holiday: HOLIDAY_MAP[iso]||null, isToday: iso===todayIso })
    }
    return out
})

function prevMonth() {
    if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
    else viewMonth.value--
}
function nextMonth() {
    if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
    else viewMonth.value++
}

const hovered = ref('')

function select(day) {
    if (!day) return
    const s = props.startDate
    const e = props.endDate

    if (!s || (s && e)) {
        emit('update:startDate', day.iso)
        emit('update:endDate', '')
    } else if (day.iso >= s) {
        emit('update:endDate', day.iso)
        setTimeout(() => emit('done'), 80)
    } else {
        emit('update:startDate', day.iso)
        emit('update:endDate', '')
    }
}

function cls(day) {
    if (!day) return {}
    const s = props.startDate
    const e = props.endDate
    const rangeEnd = e || hovered.value
    return {
        'cal-weekend':  day.isWeekend,
        'cal-libur':    day.holiday?.tipe === 'libur',
        'cal-cuti':     day.holiday?.tipe === 'cuti',
        'cal-today':    day.isToday,
        'cal-start':    s && day.iso === s,
        'cal-end':      e && day.iso === e,
        'cal-in-range': s && rangeEnd && day.iso > s && day.iso < rangeEnd,
        'cal-picking':  s && !e,
    }
}

function fmtDisplay(iso) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d} ${BULAN_NAMA[+m-1].slice(0,3)} ${y}`
}
</script>

<template>
    <div class="ns-cal">
        <!-- Navigation -->
        <div class="ns-cal-nav-row">
            <button class="ns-cal-nav-btn" @click="prevMonth">‹</button>
            <span class="ns-cal-nav-title">{{ BULAN_NAMA[viewMonth] }} {{ viewYear }}</span>
            <button class="ns-cal-nav-btn" @click="nextMonth">›</button>
        </div>

        <!-- Selection hint -->
        <div class="ns-cal-hint">
            <template v-if="!startDate">Klik tanggal awal</template>
            <template v-else-if="!endDate">Klik tanggal akhir</template>
            <template v-else>
                <span class="ns-cal-range-label">{{ fmtDisplay(startDate) }} – {{ fmtDisplay(endDate) }}</span>
                <button class="ns-cal-reset" @click="$emit('update:startDate',''); $emit('update:endDate','')">×</button>
            </template>
        </div>

        <!-- Grid -->
        <div class="ns-cal-grid">
            <!-- Day-of-week headers -->
            <div v-for="(lbl, i) in DOW_LABEL" :key="lbl"
                 class="ns-cal-dow"
                 :class="{ 'ns-cal-dow-weekend': i >= 5 }">{{ lbl }}</div>

            <!-- Day cells -->
            <div v-for="(day, idx) in days" :key="idx"
                 class="ns-cal-cell"
                 :class="[cls(day), { 'ns-cal-cell-empty': !day }]"
                 :title="day?.holiday?.nama || ''"
                 @click="select(day)"
                 @mouseenter="day && (hovered = day.iso)"
                 @mouseleave="hovered = ''">
                <template v-if="day">
                    <span class="ns-cal-num">{{ day.day }}</span>
                    <span v-if="day.holiday" class="ns-cal-dot"
                          :class="day.holiday.tipe === 'cuti' ? 'ns-cal-dot-cuti' : 'ns-cal-dot-libur'" />
                </template>
            </div>
        </div>

        <!-- Legend -->
        <div class="ns-cal-legend">
            <span class="ns-cal-leg"><span class="ns-cal-dot ns-cal-dot-libur"></span>Hari Libur</span>
            <span class="ns-cal-leg"><span class="ns-cal-dot ns-cal-dot-cuti"></span>Cuti Bersama</span>
            <span class="ns-cal-leg ns-cal-leg-weekend">Sab/Min</span>
        </div>
    </div>
</template>

<style scoped>
.ns-cal {
    width: 296px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.14);
    padding: 14px;
    user-select: none;
    font-size: 12.5px;
}

/* Navigation */
.ns-cal-nav-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}
.ns-cal-nav-btn {
    all: unset;
    cursor: pointer;
    width: 28px; height: 28px;
    display: grid; place-items: center;
    border-radius: 8px;
    font-size: 18px;
    color: var(--text-2);
    transition: background 120ms;
}
.ns-cal-nav-btn:hover { background: var(--surface-2); color: var(--text); }
.ns-cal-nav-title { font-weight: 600; font-size: 13px; color: var(--text); }

/* Hint bar */
.ns-cal-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--text-3);
    margin-bottom: 10px;
    min-height: 22px;
}
.ns-cal-range-label { color: var(--accent); font-weight: 600; font-size: 12px; }
.ns-cal-reset {
    all: unset;
    cursor: pointer;
    width: 18px; height: 18px;
    display: grid; place-items: center;
    border-radius: 50%;
    font-size: 14px;
    color: var(--text-3);
    line-height: 1;
}
.ns-cal-reset:hover { background: var(--surface-2); color: var(--text); }

/* Grid */
.ns-cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
}

/* Day-of-week header */
.ns-cal-dow {
    text-align: center;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-3);
    padding: 4px 0 6px;
    letter-spacing: 0.02em;
}
.ns-cal-dow-weekend { color: #ef4444; }

/* Day cell */
.ns-cal-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 34px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 100ms;
    gap: 2px;
}
.ns-cal-cell:hover:not(.ns-cal-cell-empty) { background: var(--surface-2); }
.ns-cal-cell-empty { pointer-events: none; }

.ns-cal-num {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text);
    line-height: 1;
}

/* Weekend → red text */
.cal-weekend .ns-cal-num { color: #ef4444; }

/* Today → subtle ring */
.cal-today { box-shadow: inset 0 0 0 1.5px var(--accent); }
.cal-today .ns-cal-num { color: var(--accent); font-weight: 700; }

/* Start/end → filled accent circle */
.cal-start,
.cal-end {
    background: var(--accent) !important;
    border-radius: 8px;
}
.cal-start .ns-cal-num,
.cal-end .ns-cal-num { color: #fff !important; font-weight: 700; }

/* In-range → light tint */
.cal-in-range {
    background: var(--accent-soft);
    border-radius: 0;
}
.cal-start { border-radius: 8px 0 0 8px !important; }
.cal-end   { border-radius: 0 8px 8px 0 !important; }

/* If start = end (same day), full radius */
.cal-start.cal-end { border-radius: 8px !important; }

/* Libur/Cuti → dot below number */
.ns-cal-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    flex-shrink: 0;
}
.ns-cal-dot-libur { background: #ef4444; }
.ns-cal-dot-cuti  { background: #f97316; }

/* On selected cells, dots stay white-ish */
.cal-start .ns-cal-dot-libur,
.cal-end   .ns-cal-dot-libur { background: rgba(255,255,255,0.7); }
.cal-start .ns-cal-dot-cuti,
.cal-end   .ns-cal-dot-cuti  { background: rgba(255,255,255,0.7); }

/* Legend */
.ns-cal-legend {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 10px;
    margin-top: 8px;
    border-top: 1px solid var(--border);
    font-size: 10.5px;
    color: var(--text-3);
}
.ns-cal-leg {
    display: flex;
    align-items: center;
    gap: 4px;
}
.ns-cal-leg-weekend { color: #ef4444; font-weight: 600; }
</style>
