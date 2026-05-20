<script setup>
import { ref, computed } from 'vue'
import { HOLIDAY_MAP } from '../lib/holidays.js'

const props = defineProps({
    startDate: { type: String, default: '' },
    endDate:   { type: String, default: '' },
    mode:      { type: String, default: 'range' },
    minDate:   { type: String, default: '' },
    maxDate:   { type: String, default: '' },
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
        const isDisabled = (props.minDate && iso < props.minDate) || (props.maxDate && iso > props.maxDate)
        out.push({ iso, day: d, dow, isWeekend: dow===0||dow===6, holiday: HOLIDAY_MAP[iso]||null, isToday: iso===todayIso, isDisabled })
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
    if (!day || day.isDisabled) return

    if (props.mode === 'single') {
        emit('update:endDate', day.iso)
        setTimeout(() => emit('done'), 80)
        return
    }

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
        'cal-disabled': day.isDisabled,
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
            <template v-if="mode === 'single'">Pilih tanggal akhir periode</template>
            <template v-else-if="!startDate">Klik tanggal awal</template>
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
                 :style="{ animationDelay: day ? (idx * 15) + 'ms' : '0ms' }"
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
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.14);
    padding: 14px;
    user-select: none;
    font-size: 13px;
    position: relative;
    overflow: hidden;
    /* Notary Stamp Reveal Animation */
    animation: notaryStampReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}

/* 1. Notary Stamp Reveal Animation */
@keyframes notaryStampReveal {
    0% {
        opacity: 0;
        transform: scale(0.92) rotate(-1deg);
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    60% {
        transform: scale(1.02) rotate(0.3deg);
    }
    100% {
        opacity: 1;
        transform: scale(1) rotate(0deg);
        box-shadow: 0 8px 32px rgba(0,0,0,0.14);
    }
}

/* 2. Gold Leaf Corner Accents - smaller, less intrusive */
.ns-cal::before,
.ns-cal::after {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    pointer-events: none;
    opacity: 0.5;
}

.ns-cal::before {
    top: 0;
    left: 0;
    border-top: 1.5px solid var(--accent);
    border-left: 1.5px solid var(--accent);
    border-top-left-radius: 12px;
}

.ns-cal::after {
    bottom: 0;
    right: 0;
    border-bottom: 1.5px solid var(--accent);
    border-right: 1.5px solid var(--accent);
    border-bottom-right-radius: 12px;
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
.ns-cal-nav-title {
    font-weight: 700;
    font-size: 14px;
    color: var(--text);
    letter-spacing: 0.01em;
}

/* Hint bar */
.ns-cal-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text);
    margin-bottom: 10px;
    min-height: 24px;
}
.ns-cal-range-label { color: var(--accent); font-weight: 700; font-size: 12px; }
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

/* Day-of-week header - readable */
.ns-cal-dow {
    text-align: center;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
    padding: 5px 0 6px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}
.ns-cal-dow-weekend { color: #dc2626; }

/* Day cell */
.ns-cal-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 36px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    gap: 2px;
    /* Staggered reveal animation for days */
    animation: dayFadeIn 0.3s ease-out backwards;
}
.ns-cal-cell:hover:not(.ns-cal-cell-empty):not(.cal-disabled) {
    background: rgba(139, 69, 19, 0.08);
    transform: scale(1.02);
}
.ns-cal-cell-empty { pointer-events: none; }
.cal-disabled {
    cursor: not-allowed;
    opacity: 0.34;
}

/* Staggered animation delays - applied via inline style in template */
@keyframes dayFadeIn {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.ns-cal-num {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    line-height: 1;
}

/* Weekend → red text */
.cal-weekend .ns-cal-num { color: #ef4444; }

/* Today → prominent ring */
.cal-today {
    box-shadow: inset 0 0 0 2px var(--accent);
    background: rgba(139, 69, 19, 0.05);
}
.cal-today .ns-cal-num {
    color: var(--accent);
    font-weight: 700;
}

/* Start/end → filled accent circle */
/* 3. Wax Seal Effect for selected dates */
.cal-start,
.cal-end {
    background: var(--accent) !important;
    border-radius: 8px;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.2),
                inset 0 -1px 2px rgba(255,255,255,0.1),
                0 0 0 1px rgba(212, 165, 116, 0.3);
    position: relative;
}
.cal-start::after,
.cal-end::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 10px;
    border: 1px solid var(--accent);
    opacity: 0.4;
    pointer-events: none;
}
.cal-start .ns-cal-num,
.cal-end .ns-cal-num {
    color: #fff !important;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

/* In-range → solid background (same as start/end) */
.cal-in-range {
    background: var(--accent) !important;
    border-radius: 0;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.15);
}
.cal-in-range .ns-cal-num {
    color: #fff !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
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
    font-size: 11px;
    color: var(--text);
}
.ns-cal-leg {
    display: flex;
    align-items: center;
    gap: 5px;
}
.ns-cal-leg-weekend { color: #dc2626; font-weight: 600; }

/* Dark mode - clean, readable */
[data-mode="dark"] .ns-cal {
    background: #1e2129;
    border-color: #374151;
}
[data-mode="dark"] .ns-cal-nav-title {
    color: #f3f4f6;
}
[data-mode="dark"] .ns-cal-dow {
    color: #d1d5db;
}
[data-mode="dark"] .ns-cal-dow-weekend {
    color: #f87171;
}
[data-mode="dark"] .ns-cal-num {
    color: #e5e7eb;
}
[data-mode="dark"] .ns-cal-hint {
    color: #d1d5db;
}
[data-mode="dark"] .cal-weekend .ns-cal-num {
    color: #f87171;
}
[data-mode="dark"] .ns-cal-legend {
    color: #9ca3af;
    border-top-color: #374151;
}
</style>
