import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDateIndo } from './date.js'

test('parseDateIndo parses SIPP dates with abbreviated dotted months', () => {
    const date = parseDateIndo('Kamis, 14 Agu. 2025')

    assert.ok(date)
    assert.equal(date.getFullYear(), 2025)
    assert.equal(date.getMonth(), 7)
    assert.equal(date.getDate(), 14)
})

test('parseDateIndo parses Indonesian full month dates from jadwal sidang', () => {
    const date = parseDateIndo('Senin, 04 Mei 2026')

    assert.ok(date)
    assert.equal(date.getFullYear(), 2026)
    assert.equal(date.getMonth(), 4)
    assert.equal(date.getDate(), 4)
})
