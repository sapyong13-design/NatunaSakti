import test from 'node:test'
import assert from 'node:assert/strict'

import { getDashboardAlerts, getDashboardAttentionStats, getOperationalTriageStats, isPerkaraAktif } from './perkaraStats.js'

test('isPerkaraAktif excludes finalized perkara even when first_sidang_soon is true', () => {
    assert.equal(isPerkaraAktif({
        tahun_masuk: 2013,
        sipp_status: 'Minutasi',
        first_sidang_soon: true
    }), false)
})

test('dashboard active count uses active perkara definition, not first_sidang_soon', () => {
    const stats = getDashboardAttentionStats([
        { tahun_masuk: 2026, sipp_status: 'Persidangan', first_sidang_soon: false },
        { tahun_masuk: 2026, sipp_status: 'Pemberitahuan Putusan Banding', first_sidang_soon: false },
        { tahun_masuk: 2026, sipp_status: 'Minutasi', first_sidang_soon: true },
        { tahun_masuk: 2013, sipp_status: 'Minutasi', first_sidang_soon: true },
        { tahun_masuk: 2015, sipp_status: 'Persidangan', first_sidang_soon: false }
    ], { total: 5, sipp_synced: 4 }, 2026)

    assert.equal(stats.find(item => item.key === 'active').value, 2)
    assert.equal(stats.find(item => item.key === 'unsynced').value, 1)
    assert.equal(stats.find(item => item.key === 'completed').value, 1)
})

test('dashboard alerts only show actionable sync problems', () => {
    assert.deepEqual(getDashboardAlerts([], { total: 10, sipp_synced: 10 }), [])

    const alerts = getDashboardAlerts([], { total: 10, sipp_synced: 8 })

    assert.equal(alerts.length, 1)
    assert.equal(alerts[0].key, 'unsynced')
    assert.equal(alerts[0].value, 2)
})

test('getOperationalTriageStats surfaces actionable SLA, hearing, and incomplete counts', () => {
    const triage = getOperationalTriageStats([
        { tahun_masuk: 2026, sipp_status: 'Persidangan', sipp_lama_proses: '165 Hari', sipp_pihak_dipublikasikan: 'Y', next_sidang_tanggal: '2026-11-29' },
        { tahun_masuk: 2025, sipp_status: 'Minutasi', tanggal_putus: null, sipp_pihak_dipublikasikan: 'T' },
        { tahun_masuk: 2026, sipp_status: 'Minutasi', tanggal_putus: '2026-10-01', sipp_pihak_dipublikasikan: null }
    ], { total: 3, sipp_synced: 3 }, '2026-11-27')

    assert.deepEqual(triage.map(item => [item.key, item.value]), [
        ['upcoming_sidang', 1],
        ['overdue_150', 1],
        ['incomplete', 2]
    ])
})
