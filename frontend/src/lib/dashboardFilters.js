export function createDefaultFilters() {
    return {
        search: '',
        jenis: 'Semua',
        tahun: '',
        status: 'Semua'
    }
}

export function applyPerkaraFilters(rows, filters) {
    const search = (filters.search || '').trim().toLowerCase()

    return rows.filter(row => {
        if (filters.jenis !== 'Semua' && row.jenis_perkara !== filters.jenis) return false
        if (filters.tahun && String(row.tahun_masuk) !== String(filters.tahun)) return false
        if (filters.status === 'Bersidang' && row.sipp_status === 'Minutasi') return false
        if (filters.status === 'Minutasi' && row.sipp_status !== 'Minutasi') return false

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
    if (filters.status !== 'Semua') {
        parts.push(filters.status === 'Bersidang' ? 'Sedang Bersidang' : filters.status)
    }
    if ((filters.search || '').trim()) parts.push(`Cari "${filters.search.trim()}"`)

    return parts.length ? parts.join(' / ') : 'Semua perkara'
}

export function getActiveFilterChips(filters) {
    const chips = []
    if (filters.jenis !== 'Semua') chips.push({ key: 'jenis', label: filters.jenis })
    if (filters.tahun) chips.push({ key: 'tahun', label: `Tahun ${filters.tahun}` })
    if (filters.status !== 'Semua') {
        chips.push({
            key: 'status',
            label: filters.status === 'Bersidang' ? 'Sedang Bersidang' : filters.status
        })
    }
    if ((filters.search || '').trim()) chips.push({ key: 'search', label: `Cari "${filters.search.trim()}"` })
    return chips
}

export function hasActiveFilters(filters) {
    return getActiveFilterChips(filters).length > 0
}
