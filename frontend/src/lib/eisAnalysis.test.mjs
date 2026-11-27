import test from 'node:test'
import assert from 'node:assert/strict'

import {
    buildLostOpportunities,
    extractSippVersionAlert,
    opportunityKey,
    simulateEisScore
} from './eisAnalysis.js'

const sampleScore = {
    total: 90.48,
    officialTotal: 90.48,
    components: [
        {
            id: 'kinerja',
            maks: 130,
            peroleh: 105,
            konversi: 80.77,
            elements: [
                { label: 'Rilis Versi SIPP', points: 0, denominator: 20 }
            ]
        },
        {
            id: 'kepatuhan',
            maks: 466,
            peroleh: 449.5,
            konversi: 96.46,
            elements: [
                { label: 'Penginputan Minutasi', points: 16.67, denominator: 25 }
            ]
        },
        {
            id: 'kelengkapan',
            maks: 135,
            peroleh: 130,
            konversi: 96.3,
            elements: []
        },
        {
            id: 'kesesuaian',
            maks: 235,
            peroleh: 207.73,
            konversi: 88.4,
            elements: [
                { label: 'Publikasi Pihak', points: 0, denominator: 25 }
            ]
        }
    ]
}

test('buildLostOpportunities ranks indicators by total impact on Implementasi SIPP', () => {
    const list = buildLostOpportunities(sampleScore)
    assert.equal(list[0].label, 'Rilis Versi SIPP')
    assert.equal(list[0].lostPoints, 20)
    assert.equal(list[1].label, 'Publikasi Pihak')
    assert.equal(list[1].lostPoints, 25)
    assert.equal(list[2].label, 'Penginputan Minutasi')
})

test('simulateEisScore computes exact component and total gains', () => {
    const sim = simulateEisScore(sampleScore, [
        opportunityKey('kinerja', 'Rilis Versi SIPP'),
        opportunityKey('kesesuaian', 'Publikasi Pihak')
    ])
    assert.equal(sim.byComponent.kinerja.after, 96.15)
    assert.equal(sim.byComponent.kesesuaian.after, 99.03)
    assert.equal(sim.simulatedTotal, 96.99)
    assert.equal(sim.deltaPp, 6.51)
})

test('extractSippVersionAlert extracts installed vs latest versions when points are 0', () => {
    const alert = extractSippVersionAlert({
        tabs: [
            {
                id: 'kinerja',
                rows: [
                    { label: 'Rilis Versi SIPP', details: [{ values: ['5.7.1', '5.6.5'] }], points: '0.00' }
                ]
            }
        ]
    }, sampleScore)

    assert.equal(alert.active, true)
    assert.equal(alert.latest, '5.7.1')
    assert.equal(alert.installed, '5.6.5')
    assert.equal(alert.lostPoints, 20)
})
