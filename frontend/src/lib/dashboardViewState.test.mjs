import test from 'node:test'
import assert from 'node:assert/strict'

import {
    dashboardStateFromQuery,
    dashboardStateToQuery,
    normalizeDashboardState
} from './dashboardViewState.js'

test('normalizes dashboard query values into supported UI state', () => {
    assert.deepEqual(dashboardStateFromQuery({
        q: '  pidana khusus  ',
        jenis: 'Pidana',
        tahun: '2026',
        status: 'Bersidang',
        view: 'kanban',
        density: 'compact',
        page: '3'
    }), {
        search: 'pidana khusus',
        jenis: 'Pidana',
        tahun: '2026',
        status: 'Bersidang',
        viewMode: 'kanban',
        density: 'compact',
        page: 3
    })
})

test('falls back to defaults for unsupported dashboard query values', () => {
    assert.deepEqual(dashboardStateFromQuery({
        jenis: 'Rahasia',
        tahun: 'dua ribu',
        status: 'Selesai',
        view: 'grid',
        density: 'tiny',
        page: '-4'
    }), normalizeDashboardState())
})

test('serializes only non-default dashboard state to query params', () => {
    assert.deepEqual(dashboardStateToQuery({
        search: 'banding',
        jenis: 'Semua',
        tahun: '',
        status: 'Minutasi',
        viewMode: 'table',
        density: 'spacious',
        page: 2
    }), {
        q: 'banding',
        status: 'Minutasi',
        density: 'spacious',
        page: '2'
    })
})
