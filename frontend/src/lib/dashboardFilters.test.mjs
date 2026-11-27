import test from 'node:test'
import assert from 'node:assert/strict'

import {
    applyPerkaraFilters,
    createDefaultFilters,
    getActiveFilterChips,
    getActiveFilterSummary
} from './dashboardFilters.js'

const rows = [
    { nomor_perkara: '1/Pid/2025', para_pihak: 'A', jenis_perkara: 'Pidana', tahun_masuk: 2025, sipp_status: 'Minutasi' },
    { nomor_perkara: '2/Pdt/2026', para_pihak: 'B', jenis_perkara: 'Perdata', tahun_masuk: 2026, sipp_status: 'Persidangan' },
    { nomor_perkara: '3/Pid/2026', para_pihak: 'C', jenis_perkara: 'Pidana', tahun_masuk: 2026, sipp_status: 'Pemberitahuan Putusan Banding' }
]

test('default filters show all years', () => {
    const filters = createDefaultFilters()

    assert.equal(filters.tahun, '')
    assert.equal(applyPerkaraFilters(rows, filters).length, 3)
    assert.equal(getActiveFilterSummary(filters), 'Semua perkara')
    assert.deepEqual(getActiveFilterChips(filters), [])
})

test('year filter is the single source of truth for current-year data', () => {
    const filters = { ...createDefaultFilters(), tahun: '2026' }
    const result = applyPerkaraFilters(rows, filters)

    assert.deepEqual(result.map(row => row.nomor_perkara), ['2/Pdt/2026', '3/Pid/2026'])
    assert.equal(getActiveFilterSummary(filters), 'Tahun 2026')
    assert.deepEqual(getActiveFilterChips(filters), [{ key: 'tahun', label: 'Tahun 2026' }])
})

test('status bersidang excludes finalized minutasi rows', () => {
    const filters = { ...createDefaultFilters(), status: 'Bersidang' }
    const result = applyPerkaraFilters(rows, filters)

    assert.deepEqual(result.map(row => row.nomor_perkara), ['2/Pdt/2026', '3/Pid/2026'])
})

test('bulan and triage filters narrow rows and build active filter chips', () => {
    const sample = [
        { nomor_perkara: '1/Pid/2026', para_pihak: 'A', jenis_perkara: 'Pidana', tahun_masuk: 2026, sipp_tanggal_register: '2026-05-05', sipp_status: 'Persidangan', sipp_lama_proses: '180 Hari', sipp_pihak_dipublikasikan: 'Y' },
        { nomor_perkara: '2/Pdt/2026', para_pihak: 'B', jenis_perkara: 'Perdata', tahun_masuk: 2026, sipp_tanggal_register: '2026-06-10', sipp_status: 'Minutasi', tanggal_putus: '2026-07-01', sipp_pihak_dipublikasikan: 'T' }
    ]
    const filters = { ...createDefaultFilters(), bulan: '5', triage: 'overdue_150' }
    const result = applyPerkaraFilters(sample, filters, '2026-11-27')

    assert.deepEqual(result.map(row => row.nomor_perkara), ['1/Pid/2026'])
    assert.deepEqual(getActiveFilterChips(filters), [
        { key: 'bulan', label: 'Mei' },
        { key: 'triage', label: 'Aktif > 150 hari' }
    ])
})
