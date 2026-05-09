/**
 * Date Utilities - Standardized date formatting
 * All dates use DD-MM-YYYY format as standard
 */

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

const MONTH_NAMES_FULL = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const DAY_NAMES_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/**
 * Format date to DD-MM-YYYY
 * @param {string|Date} date - Date input
 * @returns {string} Formatted date or '–' if invalid
 */
export function formatDate(date) {
    if (!date) return '–'
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return '–'
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}-${mm}-${yyyy}`
}

/**
 * Format date to DD MMM YYYY (e.g., 15 Jan 2026)
 * @param {string|Date} date - Date input
 * @returns {string} Formatted date or '–' if invalid
 */
export function formatDateShort(date) {
    if (!date) return '–'
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return '–'
    const dd = String(d.getDate()).padStart(2, '0')
    const mmm = MONTH_NAMES[d.getMonth()]
    const yyyy = d.getFullYear()
    return `${dd} ${mmm} ${yyyy}`
}

/**
 * Format date to full Indonesian format (e.g., 15 Januari 2026)
 * @param {string|Date} date - Date input
 * @returns {string} Formatted date or '–' if invalid
 */
export function formatDateFull(date) {
    if (!date) return '–'
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return '–'
    const dd = d.getDate()
    const mmmm = MONTH_NAMES_FULL[d.getMonth()]
    const yyyy = d.getFullYear()
    return `${dd} ${mmmm} ${yyyy}`
}

/**
 * Format date with day name (e.g., Senin, 15 Jan 2026)
 * @param {string|Date} date - Date input
 * @returns {string} Formatted date or '–' if invalid
 */
export function formatDateWithDay(date) {
    if (!date) return '–'
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return '–'
    const day = DAY_NAMES_FULL[d.getDay()]
    const dd = d.getDate()
    const mmm = MONTH_NAMES[d.getMonth()]
    const yyyy = d.getFullYear()
    return `${day}, ${dd} ${mmm} ${yyyy}`
}

/**
 * Format time to HH:MM
 * @param {string|Date} date - Date input
 * @returns {string} Formatted time or '–' if invalid
 */
export function formatTime(date) {
    if (!date) return '–'
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return '–'
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
}

/**
 * Format date and time (e.g., 15-01-2026 14:30)
 * @param {string|Date} date - Date input
 * @returns {string} Formatted datetime or '–' if invalid
 */
export function formatDateTime(date) {
    if (!date) return '–'
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return '–'
    return `${formatDate(d)} ${formatTime(d)}`
}

/**
 * Get relative time (e.g., "2 jam lalu", "kemarin", "3 hari lalu")
 * @param {string|Date} date - Date input
 * @returns {string} Relative time or formatted date if > 7 days
 */
export function formatRelativeTime(date) {
    if (!date) return '–'
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return '–'

    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'baru saja'
    if (diffMins < 60) return `${diffMins} menit lalu`
    if (diffHours < 24) return `${diffHours} jam lalu`
    if (diffDays === 1) return 'kemarin'
    if (diffDays < 7) return `${diffDays} hari lalu`

    return formatDateShort(d)
}

/**
 * Parse Indonesian date string to Date object
 * Handles formats like "15 Jan 2026", "15-01-2026"
 * @param {string} str - Date string
 * @returns {Date|null} Parsed Date or null if invalid
 */
export function parseIndonesianDate(str) {
    if (!str) return null

    // Try DD-MM-YYYY format
    const dashMatch = str.match(/(\d{2})-(\d{2})-(\d{4})/)
    if (dashMatch) {
        return new Date(dashMatch[3], dashMatch[2] - 1, dashMatch[1])
    }

    // Try DD MMM YYYY format
    const monthMap = {}
    MONTH_NAMES.forEach((m, i) => monthMap[m.toLowerCase()] = i)
    MONTH_NAMES_FULL.forEach((m, i) => monthMap[m.toLowerCase()] = i)

    const parts = str.trim().split(/\s+/)
    if (parts.length >= 3) {
        const day = parseInt(parts[0])
        const month = monthMap[parts[1].toLowerCase()]
        const year = parseInt(parts[2])
        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
            return new Date(year, month, day)
        }
    }

    // Fallback to native parsing
    const d = new Date(str)
    return isNaN(d.getTime()) ? null : d
}

/**
 * Check if date is today
 * @param {string|Date} date - Date input
 * @returns {boolean}
 */
export function isToday(date) {
    if (!date) return false
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return false
    const today = new Date()
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear()
}

/**
 * Check if date is within last N days
 * @param {string|Date} date - Date input
 * @param {number} days - Number of days
 * @returns {boolean}
 */
export function isWithinDays(date, days) {
    if (!date) return false
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return false
    const now = new Date()
    const diffDays = (now - d) / 86400000
    return diffDays >= 0 && diffDays <= days
}

/**
 * Get date range for a period
 * @param {string} period - 'today', 'week', 'month', 'year'
 * @returns {{start: Date, end: Date}}
 */
export function getDateRange(period) {
    const now = new Date()
    const start = new Date(now)
    const end = new Date(now)

    switch (period) {
        case 'today':
            start.setHours(0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)
            break
        case 'week':
            start.setDate(now.getDate() - 7)
            break
        case 'month':
            start.setDate(now.getDate() - 30)
            break
        case 'year':
            start.setFullYear(now.getFullYear() - 1)
            break
    }

    return { start, end }
}

// Export all as default for convenience
export default {
    formatDate,
    formatDateShort,
    formatDateFull,
    formatDateWithDay,
    formatTime,
    formatDateTime,
    formatRelativeTime,
    parseIndonesianDate,
    isToday,
    isWithinDays,
    getDateRange,
    MONTH_NAMES,
    MONTH_NAMES_FULL,
    DAY_NAMES,
    DAY_NAMES_FULL
}
