export function isPerkaraAktif(row) {
    if (Number(row?.tahun_masuk) < 2016) return false

    const status = row?.sipp_status || ''
    if (status === 'Minutasi' || status === 'Putusan') return false

    return true
}

export function getDashboardAttentionStats(rows, syncStatus, currentYear = new Date().getFullYear()) {
    const active = rows.filter(isPerkaraAktif).length
    const unsynced = Math.max((syncStatus?.total || 0) - (syncStatus?.sipp_synced || 0), 0)
    const completedThisYear = rows.filter(r => {
        const status = (r.sipp_status || '').toLowerCase()
        return status.includes('minutasi') && Number(r.tahun_masuk) === currentYear
    }).length

    return [
        {
            key: 'active',
            label: 'Aktif',
            value: active,
            tone: 'warn'
        },
        {
            key: 'unsynced',
            label: 'Belum sinkron',
            value: unsynced,
            tone: unsynced > 0 ? 'danger' : 'safe'
        },
        {
            key: 'completed',
            label: 'Minutasi tahun ini',
            value: completedThisYear,
            tone: 'safe'
        }
    ]
}

export function getDashboardAlerts(rows, syncStatus) {
    const stats = getDashboardAttentionStats(rows, syncStatus)
    return stats.filter(item => item.key === 'unsynced' && item.value > 0)
}
