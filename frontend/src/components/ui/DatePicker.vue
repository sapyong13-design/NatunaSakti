<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { formatDate, parseIndonesianDate, isToday, MONTH_NAMES_FULL, DAY_NAMES } from '@/lib/dateUtils'

const props = defineProps({
    modelValue: { type: [Date, String, null], default: null },
    placeholder: { type: String, default: 'Pilih tanggal' },
    minDate: { type: [Date, String], default: null },
    maxDate: { type: [Date, String], default: null },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    clearable: { type: Boolean, default: true },
    firstDayOfWeek: { type: Number, default: 1 }, // 0 = Sunday, 1 = Monday
    monthNames: { type: Array, default: () => MONTH_NAMES_FULL },
    dayNames: { type: Array, default: () => DAY_NAMES }
})

const emit = defineEmits(['update:modelValue',('open'),('close')])

const isOpen = ref(false)
const viewMonth = ref(new Date().getMonth())
const viewYear = ref(new Date().getFullYear())
const inputRef = ref(null)
const pickerRef = ref(null)
let clickOutsideHandler = null

// Parse input value to Date
const parsedValue = computed(() => {
    if (!props.modelValue) return null
    return props.modelValue instanceof Date ? props.modelValue : new Date(props.modelValue)
})

// Format date for display
const displayValue = computed(() => {
    if (!parsedValue.value) return ''
    return formatDate(parsedValue.value)
})

// Get days for current month view
const calendarDays = computed(() => {
    const days = []
    const firstDay = new Date(viewYear.value, viewMonth.value, 1)
    const lastDay = new Date(viewYear.value, viewMonth.value + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    // Padding from previous month
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

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({
            day: i,
            month: viewMonth.value,
            year: viewYear.value,
            date: new Date(viewYear.value, viewMonth.value, i),
            isPadding: false
        })
    }

    // Padding to fill 6 rows (42 days)
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

// Get week days header
const weekDays = computed(() => {
    const days = [...props.dayNames]
    if (props.firstDayOfWeek > 0) {
        return [...days.slice(props.firstDayOfWeek), ...days.slice(0, props.firstDayOfWeek)]
    }
    return days
})

// Check if date is disabled
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

// Check if date is selected
const isDateSelected = (day) => {
    if (!parsedValue.value || day.isPadding) return false
    return day.day === parsedValue.value.getDate() &&
           day.month === parsedValue.value.getMonth() &&
           day.year === parsedValue.value.getFullYear()
}

// Check if date is today
const isDateToday = (day) => {
    if (day.isPadding) return false
    return isToday(new Date(day.year, day.month, day.day))
}

// Handle date click
function handleDateClick(dayData) {
    if (dayData.isPadding || isDateDisabled(dayData)) return

    const selectedDate = new Date(dayData.year, dayData.month, dayData.day)
    emit('update:modelValue', selectedDate)
    close()
}

// Navigate months
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

// Toggle picker
function toggle() {
    if (props.disabled || props.readonly) return
    isOpen.value ? close() : open()
}

function open() {
    isOpen.value = true
    emit('open')
    if (parsedValue.value) {
        viewMonth.value = parsedValue.value.getMonth()
        viewYear.value = parsedValue.value.getFullYear()
    }
}

function close() {
    isOpen.value = false
    emit('close')
}

// Clear value
function clear(e) {
    e.stopPropagation()
    emit('update:modelValue', null)
}

// Handle input focus
function handleFocus() {
    if (!props.disabled && !props.readonly) {
        isOpen.value = true
    }
}

// Click outside to close
function handleClickOutside(e) {
    if (pickerRef.value && !pickerRef.value.contains(e.target)) {
        close()
    }
}

// Keyboard navigation
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

// Sync view with selected date
watch(parsedValue, (newVal) => {
    if (newVal) {
        viewMonth.value = newVal.getMonth()
        viewYear.value = newVal.getFullYear()
    }
})

// Expose methods
defineExpose({ open, close, focus: () => inputRef.value?.focus() })
</script>

<template>
    <div ref="pickerRef" class="ns-datepicker" :class="{ 'is-open': isOpen, 'is-disabled': disabled }">
        <!-- Input Trigger -->
        <div class="ns-datepicker-input-wrapper" @click="toggle">
            <input
                ref="inputRef"
                type="text"
                class="ns-datepicker-input"
                :value="displayValue"
                :placeholder="placeholder"
                :disabled="disabled"
                :readonly="readonly"
                @focus="handleFocus"
                @keydown="handleKeydown"
            >

            <span class="ns-datepicker-icon">📅</span>

            <button
                v-if="clearable && modelValue"
                class="ns-datepicker-clear"
                @click="clear"
                tabindex="-1"
            >✕</button>
        </div>

        <!-- Picker Dropdown -->
        <Transition name="ns-picker-dropdown">
            <div v-if="isOpen" class="ns-picker-dropdown">
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
                            'is-selected': isDateSelected(dayData),
                            'is-disabled': isDateDisabled(dayData)
                        }"
                        :disabled="isDateDisabled(dayData)"
                        @click="handleDateClick(dayData)"
                    >
                        {{ dayData.day }}
                    </button>
                </div>

                <!-- Footer -->
                <div v-if="$slots.footer" class="ns-picker-footer">
                    <slot name="footer" />
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.ns-datepicker {
    position: relative;
    display: inline-block;
    width: 100%;
}

.ns-datepicker-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.ns-datepicker-input {
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

.ns-datepicker-input:hover {
    border-color: var(--accent);
}

.ns-datepicker-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.15);
}

.ns-datepicker-input:disabled,
.ns-datepicker-input:read-only {
    background: var(--surface-2);
    cursor: not-allowed;
    opacity: 0.7;
}

.ns-datepicker-icon {
    position: absolute;
    right: 12px;
    font-size: 16px;
    opacity: 0.5;
    pointer-events: none;
}

.ns-datepicker-clear {
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

.ns-datepicker-clear:hover {
    background: var(--danger);
    color: white;
}

/* Dropdown */
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

.ns-picker-day.is-selected {
    background: var(--accent);
    color: white;
}

.ns-picker-day:not(.is-disabled):not(.is-padding):hover {
    background: var(--surface-3);
}

.ns-picker-day.is-disabled {
    cursor: not-allowed;
    opacity: 0.4;
}

.ns-picker-footer {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
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
