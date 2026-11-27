import { parseDateIndo } from './date.js'
import { isOverdue150Days, isPerkaraIncomplete, isSidangWithinDays } from './perkaraStats.js'

const MONTH_LABELS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const TRIAGE_LABELS = {
    upcoming_sidang: 'Sidang 7 hari ke depan',
    overdue_150: 'Aktif > 150 hari',
    incomplete: 'Data perlu dilengkapi'
}

export function createDefaultFilters() {
    return {
        search: '',
        jenis: 'Semua',
        tahun: '',
        bulan: '',
        status: 'Semua',
        triage: ''
    }
}

export function applyPerkaraFilters(rows, filters, todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
    const search = (filters.search || '').trim().toLowerCase()
    const bulanNum = Number(filters.bulan)

    return rows.filter(row => {
        if (filters.jenis !== 'Semua' && row.jenis_perkara !== filters.jenis) return false
        if (filters.tahun && String(row.tahun_masuk) !== String(filters.tahun)) return false
        if (bulanNum >= 1 && bulanNum <= 12) {
            const regDate = parseDateIndo(row.sipp_tanggal_register)
            if (!regDate || regDate.getMonth() + 1 !== bulanNum) return false
        }
        if (filters.status === 'Bersidang' && row.sipp_status === 'Minutasi') return false
        if (filters.status === 'Minutasi' && row.sipp_status !== 'Minutasi') return false
        if (filters.triage === 'upcoming_sidang' && !isSidangWithinDays(row, todayIso, 7)) return false
        if (filters.triage === 'overdue_150' && !isOverdue150Days(row)) return false
        if (filters.triage === 'incomplete' && !isPerkaraIncomplete(row)) return false

        if (search) {
            const nomor = (row.nomor_perkara || '').toLowerCase()
            const pihak = (row.para_pihak || '').toLowerCase()
            if (!nomor.includes(search) && !pihak.includes(search)) return false
        }

        return true
    })
}

export function getActiveFilterSummary(filters) {
    const parts = []
    if (filters.jenis !== 'Semua') parts.push(filters.jenis)
    if (filters.tahun) parts.push(`Tahun ${filters.tahun}`)
    const bulanNum = Number(filters.bulan)
    if (bulanNum >= 1 && bulanNum <= 12) parts.push(MONTH_LABELS[bulanNum - 1])
    if (filters.status !== 'Semua') {
        parts.push(filters.status === 'Bersidang' ? 'Sedang Bersidang' : filters.status)
    }
    if (filters.triage && TRIAGE_LABELS[filters.triage]) parts.push(TRIAGE_LABELS[filters.triage])
    if ((filters.search || '').trim()) parts.push(`Cari "${filters.search.trim()}"`)

    return parts.length ? parts.join(' / ') : 'Semua perkara'
}

export function getActiveFilterChips(filters) {
    const chips = []
    if (filters.jenis !== 'Semua') chips.push({ key: 'jenis', label: filters.jenis })
    if (filters.tahun) chips.push({ key: 'tahun', label: `Tahun ${filters.tahun}` })
    const bulanNum = Number(filters.bulan)
    if (bulanNum >= 1 && bulanNum <= 12) chips.push({ key: 'bulan', label: MONTH_LABELS[bulanNum - 1] })
    if (filters.status !== 'Semua') {
        chips.push({
            key: 'status',
            label: filters.status === 'Bersidang' ? 'Sedang Bersidang' : filters.status
        })
    }
    if (filters.triage && TRIAGE_LABELS[filters.triage]) {
        chips.push({ key: 'triage', label: TRIAGE_LABELS[filters.triage] })
    }
    if ((filters.search || '').trim()) chips.push({ key: 'search', label: `Cari "${filters.search.trim()}"` })
    return chips
}

export function hasActiveFilters(filters) {
    return getActiveFilterChips(filters).length > 0
}
