import test from 'node:test'
import assert from 'node:assert/strict'

import { sortDashboardRows } from './dashboardSort.js'

test('sortDashboardRows sorts newest register date first', () => {
    const rows = [
        { nomor_perkara: '29/Pid.Sus/2026/PN Ntn', sipp_tanggal_register: '05 Mei 2026' },
        { nomor_perkara: '8/Pdt.G/2026/PN Ntn', sipp_tanggal_register: '08 Mei 2026' },
        { nomor_perkara: '31/Pid.Sus/2026/PN Ntn', sipp_tanggal_register: '07 Mei 2026' }
    ]

    assert.deepEqual(sortDashboardRows(rows).map(row => row.nomor_perkara), [
        '8/Pdt.G/2026/PN Ntn',
        '31/Pid.Sus/2026/PN Ntn',
        '29/Pid.Sus/2026/PN Ntn'
    ])
})

test('sortDashboardRows sorts same-register-date rows by numeric case number descending', () => {
    const rows = [
        { nomor_perkara: '30/Pid.Sus/2026/PN Ntn', sipp_tanggal_register: '05 Mei 2026' },
        { nomor_perkara: '8/Pdt.G/2026/PN Ntn', sipp_tanggal_register: '08 Mei 2026' },
        { nomor_perkara: '29/Pid.Sus/2026/PN Ntn', sipp_tanggal_register: '05 Mei 2026' },
        { nomor_perkara: '31/Pid.Sus/2026/PN Ntn', sipp_tanggal_register: '07 Mei 2026' }
    ]

    const sorted = sortDashboardRows(rows)

    assert.deepEqual(sorted.map(row => row.nomor_perkara), [
        '8/Pdt.G/2026/PN Ntn',
        '31/Pid.Sus/2026/PN Ntn',
        '30/Pid.Sus/2026/PN Ntn',
        '29/Pid.Sus/2026/PN Ntn'
    ])
})

test('sortDashboardRows does not mutate the input rows', () => {
    const rows = [
        { nomor_perkara: '30/Pid.Sus/2026/PN Ntn', sipp_tanggal_register: '05 Mei 2026' },
        { nomor_perkara: '29/Pid.Sus/2026/PN Ntn', sipp_tanggal_register: '05 Mei 2026' }
    ]

    sortDashboardRows(rows)

    assert.deepEqual(rows.map(row => row.nomor_perkara), [
        '30/Pid.Sus/2026/PN Ntn',
        '29/Pid.Sus/2026/PN Ntn'
    ])
})
