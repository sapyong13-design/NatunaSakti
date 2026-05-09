<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { formatDate, isToday, MONTH_NAMES_FULL, DAY_NAMES } from '@/lib/dateUtils'

const props = defineProps({
    modelValue: { type: Object, default: () => ({ start: null, end: null }) },
    placeholder: { type: String, default: 'Pilih rentang tanggal' },
    minDate: { type: [Date, String], default: null },
    maxDate: { type: [Date, String], default: null },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    clearable: { type: Boolean, default: true },
    firstDayOfWeek: { type: Number, default: 1 },
    monthNames: { type: Array, default: () => MONTH_NAMES_FULL },
    dayNames: { type: Array, default: () => DAY_NAMES },
    // Quick select options
    quickSelect: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue',('open'),('close')])

const isOpen = ref(false)
const viewMonth = ref(new Date().getMonth())
const viewYear = ref(new Date().getFullYear())
const hoveredDate = ref(null)
const inputRef = ref(null)
const pickerRef = ref(null)

// Quick select presets
const presets = [
    { label: 'Hari Ini', days: 0 },
    { label: '7 Hari Terakhir', days: 7 },
    { label: '30 Hari Terakhir', days: 30 },
    { label: 'Bulan Ini', days: 'month' },
    { label: 'Tahun Ini', days: 'year' }
]

// Parse dates
const startDate = computed(() => {
    if (!props.modelValue?.start) return null
    return props.modelValue.start instanceof Date ? props.modelValue.start : new Date(props.modelValue.start)
})

const endDate = computed(() => {
    if (!props.modelValue?.end) return null
    return props.modelValue.end instanceof Date ? props.modelValue.end : new Date(props.modelValue.end)
})

// Format display value
const displayValue = computed(() => {
    if (!startDate.value && !endDate.value) return ''
    if (startDate.value && !endDate.value) {
        return formatDate(startDate.value)
    }
    if (startDate.value && endDate.value) {
        return `${formatDate(startDate.value)} - ${formatDate(endDate.value)}`
    }
    return ''
})

// Get calendar days
const calendarDays = computed(() => {
    const days = []
    const firstDay = new Date(viewYear.value, viewMonth.value, 1)
    const lastDay = new Date(viewYear.value, viewMonth.value + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const prevMonthLastDay = new Date(viewYear.value, viewMonth.value, 0).getDate()
    const paddingStart = (startingDayOfWeek - props.firstDayOfWeek + 7) % 7

    for (let i = paddingStart - 1; i >= 0; i--) {
        days.push({
            day: prevMonthLastDay - i,
            month: viewMonth.value - 1,
            year: viewYear.value,
            isPadding: true
        })
    }

    for (let i = 1; i <= daysInMonth; i++) {
        days.push({
            day: i,
            month: viewMonth.value,
            year: viewYear.value,
            date: new Date(viewYear.value, viewMonth.value, i),
            isPadding: false
        })
    }

    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
        days.push({
            day: i,
            month: viewMonth.value + 1,
            year: viewYear.value,
            isPadding: true
        })
    }

    return days
})

const weekDays = computed(() => {
    const days = [...props.dayNames]
    if (props.firstDayOfWeek > 0) {
        return [...days.slice(props.firstDayOfWeek), ...days.slice(0, props.firstDayOfWeek)]
    }
    return days
})

// Check date disabled
const isDateDisabled = (day) => {
    if (day.isPadding) return true

    const testDate = new Date(day.year, day.month, day.day)

    if (props.minDate) {
        const min = props.minDate instanceof Date ? props.minDate : new Date(props.minDate)
        if (testDate < min) return true
    }

    if (props.maxDate) {
        const max = props.maxDate instanceof Date ? props.maxDate : new Date(props.maxDate)
        if (testDate > max) return true
    }

    return false
}

// Get date selection state
const getDateState = (day) => {
    if (day.isPadding || !day.date) return null

    const date = day.date
    const isStart = startDate.value && date.getTime() === startDate.value.getTime()
    const isEnd = endDate.value && date.getTime() === endDate.value.getTime()

    if (isStart) return 'start'
    if (isEnd) return 'end'

    if (startDate.value && endDate.value) {
        if (date > startDate.value && date < endDate.value) return 'in-range'
    }

    if (startDate.value && !endDate.value && hoveredDate.value) {
        if (date > startDate.value && date < hoveredDate.value) return 'in-range-hover'
    }

    return null
}

const isDateToday = (day) => {
    if (day.isPadding) return false
    return isToday(new Date(day.year, day.month, day.day))
}

// Handle date click
function handleDateClick(dayData) {
    if (dayData.isPadding || isDateDisabled(dayData)) return

    const clickedDate = new Date(dayData.year, dayData.month, dayData.day)

    if (!startDate.value || (startDate.value && endDate.value)) {
        // Start new range
        emit('update:modelValue', { start: clickedDate, end: null })
    } else if (clickedDate < startDate.value) {
        // Clicked before start, swap
        emit('update:modelValue', { start: clickedDate, end: startDate.value })
    } else {
        // Complete range
        emit('update:modelValue', { start: startDate.value, end: clickedDate })
    }
}

// Handle date hover
function handleDateHover(dayData) {
    if (dayData.isPadding || !dayData.date) return
    hoveredDate.value = dayData.date
}

// Quick select preset
function applyPreset(preset) {
    const today = new Date()
    let start, end

    if (preset.days === 0) {
        start = new Date(today.setHours(0, 0, 0, 0))
        end = new Date(today.setHours(23, 59, 59, 999))
    } else if (preset.days === 'month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    } else if (preset.days === 'year') {
        start = new Date(today.getFullYear(), 0, 1)
        end = new Date(today.getFullYear(), 11, 31)
    } else {
        end = new Date(today.setHours(23, 59, 59, 999))
        start = new Date(today)
        start.setDate(start.getDate() - preset.days)
        start.setHours(0, 0, 0, 0)
    }

    emit('update:modelValue', { start, end })
    close()
}

// Navigation
function prevMonth() {
    if (viewMonth.value === 0) {
        viewMonth.value = 11
        viewYear.value--
    } else {
        viewMonth.value--
    }
}

function nextMonth() {
    if (viewMonth.value === 11) {
        viewMonth.value = 0
        viewYear.value++
    } else {
        viewMonth.value++
    }
}

function goToToday() {
    const today = new Date()
    viewMonth.value = today.getMonth()
    viewYear.value = today.getFullYear()
}

// Toggle
function toggle() {
    if (props.disabled || props.readonly) return
    isOpen.value ? close() : open()
}

function open() {
    isOpen.value = true
    emit('open')
    if (startDate.value) {
        viewMonth.value = startDate.value.getMonth()
        viewYear.value = startDate.value.getFullYear()
    }
}

function close() {
    isOpen.value = false
    emit('close')
    hoveredDate.value = null
}

// Clear
function clear(e) {
    e.stopPropagation()
    emit('update:modelValue', { start: null, end: null })
}

// Outside click
function handleClickOutside(e) {
    if (pickerRef.value && !pickerRef.value.contains(e.target)) {
        close()
    }
}

// Keyboard
function handleKeydown(e) {
    if (props.disabled || props.readonly) return

    switch (e.key) {
        case 'Enter':
        case ' ':
            e.preventDefault()
            toggle()
            break
        case 'Escape':
            close()
            break
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
})

// Sync view
watch(startDate, (newVal) => {
    if (newVal) {
        viewMonth.value = newVal.getMonth()
        viewYear.value = newVal.getFullYear()
    }
})

defineExpose({ open, close, focus: () => inputRef.value?.focus() })
</script>

<template>
    <div ref="pickerRef" class="ns-daterangepicker" :class="{ 'is-open': isOpen, 'is-disabled': disabled }">
        <!-- Input Trigger -->
        <div class="ns-daterange-input-wrapper" @click="toggle">
            <input
                ref="inputRef"
                type="text"
                class="ns-daterange-input"
                :value="displayValue"
                :placeholder="placeholder"
                :disabled="disabled"
                :readonly="readonly"
                @focus="() => !disabled && !readonly && (isOpen = true)"
                @keydown="handleKeydown"
            >

            <span class="ns-daterange-icon">📅</span>

            <button
                v-if="clearable && (startDate || endDate)"
                class="ns-daterange-clear"
                @click="clear"
                tabindex="-1"
            >✕</button>
        </div>

        <!-- Picker Dropdown -->
        <Transition name="ns-picker-dropdown">
            <div v-if="isOpen" class="ns-picker-dropdown ns-range-dropdown">
                <!-- Quick Select -->
                <div v-if="quickSelect" class="ns-quick-select">
                    <button
                        v-for="preset in presets"
                        :key="preset.label"
                        type="button"
                        class="ns-quick-preset"
                        @click="applyPreset(preset)"
                    >
                        {{ preset.label }}
                    </button>
                </div>

                <!-- Header -->
                <div class="ns-picker-header">
                    <button class="ns-picker-nav" @click="prevMonth" type="button">
                        <span class="ns-picker-nav-icon">‹</span>
                    </button>

                    <div class="ns-picker-title">
                        <span class="ns-picker-month">{{ monthNames[viewMonth] }}</span>
                        <span class="ns-picker-year">{{ viewYear }}</span>
                    </div>

                    <button class="ns-picker-nav" @click="nextMonth" type="button">
                        <span class="ns-picker-nav-icon">›</span>
                    </button>
                </div>

                <!-- Today Button -->
                <div class="ns-picker-actions">
                    <button class="ns-picker-today" @click="goToToday" type="button">Hari Ini</button>
                </div>

                <!-- Week Days -->
                <div class="ns-picker-weekdays">
                    <span v-for="day in weekDays" :key="day" class="ns-picker-weekday">{{ day }}</span>
                </div>

                <!-- Calendar Days -->
                <div class="ns-picker-days">
                    <button
                        v-for="(dayData, index) in calendarDays"
                        :key="index"
                        type="button"
                        class="ns-picker-day"
                        :class="{
                            'is-padding': dayData.isPadding,
                            'is-today': isDateToday(dayData),
                            'is-selected-start': getDateState(dayData) === 'start',
                            'is-selected-end': getDateState(dayData) === 'end',
                            'is-in-range': getDateState(dayData) === 'in-range',
                            'is-in-range-hover': getDateState(dayData) === 'in-range-hover',
                            'is-disabled': isDateDisabled(dayData)
                        }"
                        :disabled="isDateDisabled(dayData)"
                        @click="handleDateClick(dayData)"
                        @mouseenter="handleDateHover(dayData)"
                        @mouseleave="hoveredDate = null"
                    >
                        {{ dayData.day }}
                    </button>
                </div>

                <!-- Range Info -->
                <div v-if="startDate || endDate" class="ns-range-info">
                    <span v-if="startDate && !endDate" class="ns-range-hint">Pilih tanggal akhir...</span>
                    <span v-else-if="startDate && endDate" class="ns-range-result">
                        {{ formatDate(startDate) }} - {{ formatDate(endDate) }}
                    </span>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.ns-daterangepicker {
    position: relative;
    display: inline-block;
    width: 100%;
}

.ns-daterange-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.ns-daterange-input {
    width: 100%;
    height: 40px;
    padding: 0 40px 0 12px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text);
    cursor: pointer;
    transition: all 0.15s ease;
}

.ns-daterange-input:hover {
    border-color: var(--accent);
}

.ns-daterange-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.15);
}

.ns-daterange-input:disabled,
.ns-daterange-input:read-only {
    background: var(--surface-2);
    cursor: not-allowed;
    opacity: 0.7;
}

.ns-daterange-icon {
    position: absolute;
    right: 12px;
    font-size: 16px;
    opacity: 0.5;
    pointer-events: none;
}

.ns-daterange-clear {
    position: absolute;
    right: 32px;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    background: var(--surface-3);
    border: none;
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-3);
    cursor: pointer;
    transition: all 0.15s ease;
}

.ns-daterange-clear:hover {
    background: var(--danger);
    color: white;
}

.ns-picker-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 100;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    padding: 16px;
}

.ns-range-dropdown {
    min-width: 320px;
}

/* Quick Select */
.ns-quick-select {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
}

.ns-quick-preset {
    padding: 4px 10px;
    font-size: 11px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-2);
    cursor: pointer;
    transition: all 0.15s ease;
}

.ns-quick-preset:hover {
    background: var(--surface-3);
    border-color: var(--accent);
    color: var(--accent);
}

/* Header */
.ns-picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.ns-picker-nav {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    background: var(--surface-2);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.ns-picker-nav:hover {
    background: var(--surface-3);
}

.ns-picker-nav-icon {
    font-size: 18px;
    color: var(--text);
}

.ns-picker-title {
    text-align: center;
}

.ns-picker-month {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
}

.ns-picker-year {
    font-size: 12px;
    color: var(--text-3);
    margin-left: 4px;
}

.ns-picker-actions {
    display: flex;
    justify-content: center;
    margin-bottom: 8px;
}

.ns-picker-today {
    padding: 4px 12px;
    font-size: 11px;
    background: var(--surface-2);
    border: none;
    border-radius: 6px;
    color: var(--accent);
    cursor: pointer;
    transition: all 0.15s ease;
}

.ns-picker-today:hover {
    background: var(--surface-3);
}

.ns-picker-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin-bottom: 4px;
}

.ns-picker-weekday {
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-3);
    padding: 8px 0;
}

.ns-picker-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
}

.ns-picker-day {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    font-size: 13px;
    color: var(--text);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.1s ease;
}

.ns-picker-day.is-padding {
    color: var(--text-3);
    opacity: 0.4;
}

.ns-picker-day.is-today {
    font-weight: 600;
    color: var(--accent);
}

.ns-picker-day.is-selected-start,
.ns-picker-day.is-selected-end {
    background: var(--accent);
    color: white;
}

.ns-picker-day.is-selected-start {
    border-radius: 6px 0 0 6px;
}

.ns-picker-day.is-selected-end {
    border-radius: 0 6px 6px 0;
}

.ns-picker-day.is-in-range,
.ns-picker-day.is-in-range-hover {
    background: rgba(var(--accent-rgb), 0.15);
    border-radius: 0;
}

.ns-picker-day:not(.is-disabled):not(.is-padding):hover {
    background: var(--surface-3);
}

.ns-picker-day.is-disabled {
    cursor: not-allowed;
    opacity: 0.4;
}

/* Range Info */
.ns-range-info {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    text-align: center;
}

.ns-range-hint {
    font-size: 12px;
    color: var(--text-3);
}

.ns-range-result {
    font-size: 13px;
    font-weight: 500;
    color: var(--accent);
}

/* Dropdown transition */
.ns-picker-dropdown-enter-active,
.ns-picker-dropdown-leave-active {
    transition: all 0.2s ease;
}

.ns-picker-dropdown-enter-from,
.ns-picker-dropdown-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}
</style>
