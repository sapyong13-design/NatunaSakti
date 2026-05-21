// Indonesian Date Formatting Utility

const INDONESIAN_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const INDONESIAN_MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

const INDONESIAN_DAYS = [
    'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
]

const INDONESIAN_DAYS_SHORT = [
    'Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'
]

/**
 * Format date to Indonesian: "dd MonthName yyyy"
 * Example: "08 Mei 2026"
 */
export function formatDateIndo(date) {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return date

    const day = String(d.getDate()).padStart(2, '0')
    const month = INDONESIAN_MONTHS[d.getMonth()]
    const year = d.getFullYear()

    return `${day} ${month} ${year}`
}

/**
 * Format date to Indonesian with day: "DayName, dd MonthName yyyy"
 * Example: "Rabu, 08 Mei 2026"
 */
export function formatDateIndoLong(date) {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return date

    const dayName = INDONESIAN_DAYS[d.getDay()]
    const day = String(d.getDate()).padStart(2, '0')
    const month = INDONESIAN_MONTHS[d.getMonth()]
    const year = d.getFullYear()

    return `${dayName}, ${day} ${month} ${year}`
}

/**
 * Format date to Indonesian short: "dd Mon yyyy"
 * Example: "08 Mei 2026" (same as formatDateIndo, just with short month name if needed)
 */
export function formatDateIndoShort(date) {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return date

    const day = String(d.getDate()).padStart(2, '0')
    const month = INDONESIAN_MONTHS_SHORT[d.getMonth()]
    const year = d.getFullYear()

    return `${day} ${month} ${year}`
}

/**
 * Parse Indonesian date string "DayName, dd MonthName yyyy" to Date object
 * Example: "Rabu, 08 Mei 2026" -> Date object
 */
export function parseDateIndo(dateStr) {
    if (!dateStr) return null

    const months = {}
    INDONESIAN_MONTHS.forEach((name, index) => {
        months[name.toLowerCase()] = index
    })
    INDONESIAN_MONTHS_SHORT.forEach((name, index) => {
        months[name.toLowerCase()] = index
    })

    // Try format "DayName, dd MonthName yyyy" or "dd MonthName yyyy"
    const normalized = String(dateStr)
        .replace(/\./g, '')
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()

    const match = normalized.match(/(\d+)\s+([a-z]+)\s+(\d{4})/)
    if (match) {
        const day = parseInt(match[1])
        const monthName = match[2]
        const year = parseInt(match[3])
        const month = months[monthName]

        if (month !== undefined) {
            return new Date(year, month, day)
        }
    }

    // Fallback to standard date parsing
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
}

/**
 * Get month name in Indonesian
 */
export function getMonthIndo(monthIndex) {
    return INDONESIAN_MONTHS[monthIndex] || ''
}

/**
 * Get day name in Indonesian
 */
export function getDayIndo(dayIndex) {
    return INDONESIAN_DAYS[dayIndex] || ''
}
