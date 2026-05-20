import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPutusanDisplay } from './putusanDisplay.js'

test('sela putusan is presented as compact status and date only', () => {
    const display = buildPutusanDisplay({
        tanggal_putusan: 'Senin, 10 Nov. 2025',
        amar_putusan: 'MENGADILI: Menyatakan keberatan tidak diterima;',
        raw: [
            { label: 'Tanggal Putusan Sela', value: 'Senin, 10 Nov. 2025' },
            { label: 'Amar Putusan Sela', value: 'MENGADILI: Menyatakan keberatan tidak diterima;' },
            { label: 'Pemberitahuan Putusan Sela Kepada Penuntut Umum', value: 'Senin, 10 Nov. 2025' }
        ]
    })

    assert.equal(display.hasData, true)
    assert.deepEqual(display.summary, [
        ['Tanggal Putusan Sela', 'Senin, 10 Nov. 2025'],
        ['Status Putusan', 'Putusan Sela']
    ])
    assert.equal(display.amar, '')
    assert.deepEqual(display.sections, [])
})

test('final pidana decision extracts date, punishment, and prison term', () => {
    const display = buildPutusanDisplay({
        tanggal_putusan: 'Tanggal Putusan',
        amar_putusan: 'Amar Putusan',
        status_putusan: 'No Nama Tanggal Putusan Putusan 1 WITAN Senin, 24 Nov. 2025 Pidana Penjara',
        raw: [
            { label: '', value: 'Tanggal Putusan' },
            { label: 'No', value: 'Nama Tanggal Putusan Putusan' },
            { label: '1', value: 'WITAN TEGUH KARUNIA Als YUS Senin, 24 Nov. 2025 Pidana Penjara Waktu Tertentu (3 Tahun 10 Bulan )' },
            { label: '', value: 'Amar Putusan' },
            { label: 'Penuntut Umum 1', value: 'DENNY, S.H Senin, 24 Nov. 2025' }
        ]
    })

    assert.deepEqual(display.summary, [
        ['Tanggal Putusan', 'Senin, 24 Nov. 2025'],
        ['Status Putusan', 'Pidana Penjara Waktu Tertentu'],
        ['Lama Penjara', '3 Tahun 10 Bulan']
    ])
    assert.equal(display.amar, '')
    assert.deepEqual(display.sections, [])
})

test('publication status is shown as disamarkan information', () => {
    const display = buildPutusanDisplay({
        raw: [
            { label: 'Pihak Dipublikasikan', value: 'Ya' }
        ]
    })

    assert.equal(display.hasData, true)
    assert.deepEqual(display.summary, [['Publikasi Pihak', 'Ya (tidak disamarkan)']])
})
