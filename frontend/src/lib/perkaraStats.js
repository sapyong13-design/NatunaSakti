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

export function parseLamaProsesDays(row) {
    const match = String(row?.sipp_lama_proses || '').match(/(\d+)\s*hari/i)
    if (match) return Number(match[1])
    return null
}

export function isOverdue150Days(row) {
    if (!isPerkaraAktif(row)) return false
    const days = parseLamaProsesDays(row)
    return days !== null && days > 150
}

export function isSidangWithinDays(row, todayIso, days = 7) {
    if (!isPerkaraAktif(row) || !row?.next_sidang_tanggal || !todayIso) return false
    const next = row.next_sidang_tanggal.slice(0, 10)
    if (next < todayIso) return false
    const endDate = new Date(`${todayIso}T00:00:00Z`)
    endDate.setUTCDate(endDate.getUTCDate() + days)
    const endIso = endDate.toISOString().slice(0, 10)
    return next <= endIso
}

export function isPerkaraIncomplete(row) {
    const status = String(row?.sipp_status || '').toLowerCase()
    if (status === 'minutasi' && !row?.tanggal_putus) return true
    if (Number(row?.tahun_masuk) >= 2023 && !['T', 'Y'].includes(row?.sipp_pihak_dipublikasikan)) return true
    return false
}

export function getOperationalTriageStats(rows, syncStatus, todayIso) {
    const items = []
    const unsynced = Math.max((syncStatus?.total || 0) - (syncStatus?.sipp_synced || 0), 0)
    if (unsynced > 0) {
        items.push({ key: 'unsynced', label: 'Belum sinkron', value: unsynced, tone: 'danger', clickable: false })
    }

    const sidangMingguIni = rows.filter(r => isSidangWithinDays(r, todayIso, 7)).length
    if (sidangMingguIni > 0) {
        items.push({ key: 'upcoming_sidang', label: 'Sidang 7 hari ke depan', value: sidangMingguIni, tone: 'info', clickable: true })
    }

    const overdue = rows.filter(isOverdue150Days).length
    if (overdue > 0) {
        items.push({ key: 'overdue_150', label: 'Aktif > 150 hari', value: overdue, tone: 'warn', clickable: true })
    }

    const incomplete = rows.filter(isPerkaraIncomplete).length
    if (incomplete > 0) {
        items.push({ key: 'incomplete', label: 'Data perlu dilengkapi', value: incomplete, tone: 'warn', clickable: true })
    }

    return items
}
