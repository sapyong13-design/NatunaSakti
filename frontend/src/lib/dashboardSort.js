import { parseDateIndo } from './date.js'
import { parseLamaProsesDays } from './perkaraStats.js'

function getRegisterTime(row) {
    const date = parseDateIndo(row?.sipp_tanggal_register)
    return date ? date.getTime() : null
}

function getCaseNumber(row) {
    const match = String(row?.nomor_perkara || '').match(/^\s*(\d+)/)
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

export function compareDashboardRows(a, b) {
    const timeA = getRegisterTime(a)
    const timeB = getRegisterTime(b)

    if (timeA !== null && timeB !== null && timeA !== timeB) {
        return timeB - timeA
    }

    if (timeA === null && timeB !== null) return 1
    if (timeA !== null && timeB === null) return -1

    const numberDiff = getCaseNumber(b) - getCaseNumber(a)
    if (numberDiff !== 0) return numberDiff

    return String(a?.nomor_perkara || '').localeCompare(String(b?.nomor_perkara || ''))
}

export function sortDashboardRows(rows, options = {}) {
    const { sortBy = 'register', sortDir = 'desc' } = options
    if (sortBy === 'register' && sortDir === 'desc') {
        return [...rows].sort(compareDashboardRows)
    }

    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
        if (sortBy === 'register') {
            const timeA = getRegisterTime(a)
            const timeB = getRegisterTime(b)
            if (timeA !== null && timeB !== null && timeA !== timeB) return (timeA - timeB) * dir
            if (timeA === null && timeB !== null) return 1
            if (timeA !== null && timeB === null) return -1
        } else if (sortBy === 'hari') {
            const daysA = parseLamaProsesDays(a)
            const daysB = parseLamaProsesDays(b)
            if (daysA !== null && daysB !== null && daysA !== daysB) return (daysA - daysB) * dir
            if (daysA === null && daysB !== null) return 1
            if (daysA !== null && daysB === null) return -1
        } else if (sortBy === 'status') {
            const statA = String(a?.sipp_status || '')
            const statB = String(b?.sipp_status || '')
            const cmp = statA.localeCompare(statB, 'id')
            if (cmp !== 0) return cmp * dir
        } else if (sortBy === 'nomor') {
            const numDiff = getCaseNumber(a) - getCaseNumber(b)
            if (numDiff !== 0) return numDiff * dir
            const cmp = String(a?.nomor_perkara || '').localeCompare(String(b?.nomor_perkara || ''), 'id')
            if (cmp !== 0) return cmp * dir
        }

        return compareDashboardRows(a, b)
    })
}
