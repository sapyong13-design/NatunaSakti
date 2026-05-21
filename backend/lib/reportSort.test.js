const assert = require('assert');
const test = require('node:test');
const { sortRowsByRegisterDate } = require('./reportSort');

test('sortRowsByRegisterDate sorts report rows by real register date ascending', () => {
    const rows = [
        { nomor_perkara: '10/Pid.B/2026/PN Ntn', sipp_tanggal_register: '10 Mei 2026' },
        { nomor_perkara: '02/Pid.B/2026/PN Ntn', sipp_tanggal_register: '02 Mei 2026' },
        { nomor_perkara: '08/Pid.B/2026/PN Ntn', sipp_tanggal_register: '2026-05-08' },
        { nomor_perkara: '01/Pid.B/2026/PN Ntn', sipp_tanggal_register: 'Rabu, 01 May 2026' },
        { nomor_perkara: 'empty/Pid.B/2026/PN Ntn', sipp_tanggal_register: '' }
    ];

    const sorted = sortRowsByRegisterDate(rows);

    assert.deepStrictEqual(sorted.map(row => row.nomor_perkara), [
        '01/Pid.B/2026/PN Ntn',
        '02/Pid.B/2026/PN Ntn',
        '08/Pid.B/2026/PN Ntn',
        '10/Pid.B/2026/PN Ntn',
        'empty/Pid.B/2026/PN Ntn'
    ]);
    assert.deepStrictEqual(rows.map(row => row.nomor_perkara), [
        '10/Pid.B/2026/PN Ntn',
        '02/Pid.B/2026/PN Ntn',
        '08/Pid.B/2026/PN Ntn',
        '01/Pid.B/2026/PN Ntn',
        'empty/Pid.B/2026/PN Ntn'
    ]);
});

test('sortRowsByRegisterDate sorts same-date rows by numeric case number ascending', () => {
    const rows = [
        { nomor_perkara: '24/Pid.Sus/2026/PN Ntn', sipp_tanggal_register: '05 Mei 2026' },
        { nomor_perkara: '23/Pid.B/2026/PN Ntn', sipp_tanggal_register: '05 Mei 2026' },
        { nomor_perkara: '25/Pid.B/2026/PN Ntn', sipp_tanggal_register: '05 Mei 2026' },
        { nomor_perkara: '26/Pid.Sus/2026/PN Ntn', sipp_tanggal_register: '05 Mei 2026' }
    ];

    assert.deepStrictEqual(sortRowsByRegisterDate(rows).map(row => row.nomor_perkara), [
        '23/Pid.B/2026/PN Ntn',
        '24/Pid.Sus/2026/PN Ntn',
        '25/Pid.B/2026/PN Ntn',
        '26/Pid.Sus/2026/PN Ntn'
    ]);
});
