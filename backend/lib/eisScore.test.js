const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreSnapshot, elementScore, partWeights } = require('./eisScore');

const row = (label, points, values, description = '') => ({
    label,
    description,
    points: String(points),
    headers: ['Jumlah', 'Sesuai', 'Tidak'],
    details: values.map((value) => ({ values: value.map(String) }))
});

function snapshot(tabs, konversi, total) {
    return {
        tabs: [
            ...tabs,
            {
                id: 'konversi',
                rows: [
                    ...konversi.map(([label, maks, peroleh, konv]) => ({
                        label, details: [{ values: [String(maks), String(peroleh), String(konv)] }]
                    })),
                    { label: '% Implementasi SIPP', details: [{ values: [String(total)] }] }
                ]
            }
        ]
    };
}

test('poin = bobot × sesuai/jumlah, bagian tanpa data menyumbang 0', () => {
    const result = elementScore(row('Contoh', 60, [[10, 6, 4]], 'Contoh - (Nilai Maksimal 100)'));
    assert.equal(result.points, 60);
    assert.equal(result.denominator, 100);
});

test('poin dibatasi bobot maksimal unsur', () => {
    const result = elementScore({
        label: 'Sinkronisasi',
        description: '(Nilai Maksimal 25)',
        points: '25.00',
        details: [{ values: ['22', '8', '14'] }]
    });
    // 8/22 × 25 = 9.09, tidak melebihi 25
    assert.equal(result.points, 9.09);
    const capped = elementScore({
        label: 'Sinkronisasi',
        description: '(Nilai Maksimal 25)',
        points: '25.00',
        details: [{ values: ['5', '9', '0'] }]
    });
    assert.equal(capped.points, 25);
});

test('bobot banding dan kasasi 7, PK 0 (bukan teks 6/4/4)', () => {
    assert.deepEqual(partWeights({
        label: 'Pengiriman Berkas Banding',
        details: [{ label: 'a (Nilai Maksimal 2)' }, { label: 'b (Nilai Maksimal 2)' }, { label: 'c (Nilai Maksimal 2)' }]
    }).reduce((a, b) => a + b, 0), 7);
    assert.deepEqual(partWeights({
        label: 'Pengiriman Berkas Peninjauan Kembali',
        details: [{ label: 'a (Nilai Maksimal 1)' }, { label: 'b (Nilai Maksimal 1)' }, { label: 'c (Nilai Maksimal 1)' }, { label: 'd (Nilai Maksimal 1)' }]
    }).reduce((a, b) => a + b, 0), 0);
});

test('unsur multi-bagian diprorata pada penyebut', () => {
    const result = elementScore({
        label: 'Pengiriman Berkas Kasasi',
        points: '5.25',
        details: [
            { label: 'a (Nilai Maksimal 1)', values: ['6', '6', '0'] },
            { label: 'b (Nilai Maksimal 1)', values: ['6', '6', '0'] },
            { label: 'c (Nilai Maksimal 1)', values: ['7', '7', '0'] },
            { label: 'd (Nilai Maksimal 1)', values: ['0', '0', '0'] }
        ]
    });
    assert.equal(result.weight, 7);
    assert.equal(result.denominator, 5.25);
    assert.equal(result.points, 5.25);
});

test('unsur wajib tetap masuk penyebut walau tanpa data', () => {
    const result = elementScore({
        label: 'Pelaksanaan Mediasi',
        description: 'Keberhasilan pelaksanaan mediasi - (Nilai Maksimal 5)',
        points: '0',
        details: [{ values: ['0', '0', '0'] }]
    });
    assert.equal(result.denominator, 5);
    assert.equal(result.points, 0);
});

test('unsur non-wajib tanpa data keluar dari penyebut', () => {
    const result = elementScore({
        label: 'Jangka Waktu Pelaksanaan Delegasi Masuk',
        description: 'Delegasi masuk - (Nilai Maksimal 5)',
        points: '0',
        details: [{ values: ['0', '0', '0'] }]
    });
    assert.equal(result.denominator, 0);
});

test('unsur non-numerik bernilai penuh bila nilai sama', () => {
    const same = elementScore({
        label: 'Rilis Versi SIPP',
        description: 'Versi SIPP yang terpasang - (Nilai Maksimal 20)',
        points: '20.00',
        details: [{ values: ['7.0.6', '7.0.6'] }]
    });
    assert.equal(same.points, 20);
    const different = elementScore({
        label: 'Rilis Versi SIPP',
        description: 'Versi SIPP yang terpasang - (Nilai Maksimal 20)',
        points: '0',
        details: [{ values: ['7.0.6', '7.0.5'] }]
    });
    assert.equal(different.points, 0);
});

test('skor total = rata-rata konversi komponen', () => {
    const snap = snapshot(
        [
            { id: 'kinerja', rows: [row('A', 80, [[10, 10, 0]], '(Nilai Maksimal 80)')] },
            { id: 'kepatuhan', rows: [row('B', 50, [[10, 10, 0]], '(Nilai Maksimal 50)')] },
            { id: 'kelengkapan', rows: [row('C', 25, [[10, 10, 0]], '(Nilai Maksimal 25)')] },
            { id: 'kesesuaian', rows: [row('D', 20, [[10, 10, 0]], '(Nilai Maksimal 20)')] }
        ],
        [['kinerja', 80, 80, 100], ['kepatuhan', 50, 50, 100], ['kelengkapan', 25, 25, 100], ['kesesuaian', 20, 20, 100]],
        100
    );
    const result = scoreSnapshot(snap);
    assert.equal(result.total, 100);
    assert.equal(result.components.length, 4);
});

test('peta keselarasan menandai sub-bagian yang belum cocok dan membiarkan yang cocok', () => {
    const { rowParity } = require('./eisParity');
    const kasasi = rowParity('kepatuhan', {
        label: 'Pengiriman Berkas Kasasi',
        details: [{ values: ['2', '2', '0'] }, { values: ['3', '0', '3'] }, { values: ['3', '0', '0'] }, { values: ['0', '0', '0'] }]
    });
    assert.equal(kasasi.aligned, true);
    const banding = rowParity('kepatuhan', {
        label: 'Pengiriman Berkas Banding',
        details: [{ values: ['5', '5', '0'] }, { values: ['1', '1', '0'] }, { values: ['1', '1', '0'] }]
    });
    assert.equal(banding.aligned, true);
    const unggah = rowParity('kepatuhan', { label: 'Unggah Putusan Akhir', details: [{ values: ['11', '11', '0'] }] });
    assert.equal(unggah.aligned, false);
    assert.equal(unggah.tier, 'diff');
    assert.equal(rowParity('kinerja', { label: 'Pelaksanaan Mediasi', details: [{ values: ['0', '0', '0'] }] }).aligned, true);
    const penahanan = rowParity('kesesuaian', { label: 'Penahanan', details: [{ values: ['4', '4', '0'] }] });
    assert.equal(penahanan.aligned, false);
    assert.equal(penahanan.tier, 'warn');
    assert.equal(rowParity('kesesuaian', { label: 'Pelaksanaan Sinkronisasi SIPP WEB', details: [{ values: ['20', '24', '0'] }] }).aligned, true);
    assert.equal(rowParity('kesesuaian', { label: 'Pelaksanaan Sinkronisasi SIPP ke Data Center MARI', details: [{ values: ['20', '57', '0'] }] }).aligned, true);
    const cc = rowParity('kelengkapan', { label: 'Dokumen Elektronik Rencana Persidangan (Court Callendar)', details: [{ values: ['10', '10', '0'] }] });
    assert.equal(cc.aligned, false);
    assert.equal(cc.tier, 'warn');
    const tunda = rowParity('kepatuhan', { label: 'Kepatuhan Penundaan Jadwal Sidang', details: [{ values: ['37', '37', '0'] }] });
    assert.equal(tunda.aligned, false);
    assert.equal(tunda.tier, 'warn');
});
