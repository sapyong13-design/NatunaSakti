const test = require('node:test');
const assert = require('node:assert');
const {
    buildMonthlyReportFilename,
    buildWeeklyReportFilename
} = require('./reportFilename');

test('format nama file laporan bulanan memakai nomor bulan dan uppercase', () => {
    assert.strictEqual(
        buildMonthlyReportFilename({ jenis: 'Perdata', bulan: 2, tahun: 2026, extension: 'docx' }),
        '2. AKURASI PERDATA FEBRUARI 2026.docx'
    );
});

test('format nama file laporan mingguan memakai nomor bulan dan minggu roman', () => {
    assert.strictEqual(
        buildWeeklyReportFilename({ jenis: 'Perdata', start: '2026-02-03', tahun: 2026, extension: 'pdf' }),
        '2. AKURASI PERDATA FEBRUARI 2026 MINGGU I.pdf'
    );
});

test('format nama file laporan mingguan range gabungan memakai roman awal dan akhir', () => {
    assert.strictEqual(
        buildWeeklyReportFilename({
            jenis: 'Perikanan',
            start: '2026-05-04',
            end: '2026-05-29',
            tahun: 2026,
            extension: 'docx'
        }),
        '5. AKURASI PERIKANAN MEI 2026 MINGGU I-IV.docx'
    );
});

test('format nama file berlaku untuk semua jenis perkara', () => {
    assert.strictEqual(
        buildMonthlyReportFilename({ jenis: 'Pidana', bulan: 4, tahun: 2026, extension: 'docx' }),
        '4. AKURASI PIDANA APRIL 2026.docx'
    );
    assert.strictEqual(
        buildMonthlyReportFilename({ jenis: 'Perikanan', bulan: 5, tahun: 2026, extension: 'docx' }),
        '5. AKURASI PERIKANAN MEI 2026.docx'
    );
    assert.strictEqual(
        buildMonthlyReportFilename({ jenis: 'Hukum', bulan: 6, tahun: 2026, extension: 'docx' }),
        '6. AKURASI HUKUM JUNI 2026.docx'
    );
});
