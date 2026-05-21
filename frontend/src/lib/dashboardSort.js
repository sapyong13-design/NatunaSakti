import { parseDateIndo } from './date.js'

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

export function sortDashboardRows(rows) {
    return [...rows].sort(compareDashboardRows)
}
