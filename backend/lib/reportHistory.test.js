const assert = require('assert');
const Database = require('better-sqlite3');
const {
    ensureReportHistorySchema,
    createReportHistory,
    listReportHistory,
    deleteReportHistory
} = require('./reportHistory');

const db = new Database(':memory:');
ensureReportHistorySchema(db);

const created = createReportHistory(db, {
    tipe: 'bulanan',
    jenis: 'Perdata',
    periode_label: 'Mei 2026',
    bulan: 5,
    tahun: 2026,
    format: 'docx',
    filename: 'Akurasi_Perdata_Mei_2026.docx'
});

assert.ok(created.id, 'created history has id');
assert.strictEqual(created.tipe, 'bulanan');
assert.strictEqual(created.periode_label, 'Mei 2026');
assert.strictEqual(created.filename, 'Akurasi_Perdata_Mei_2026.docx');
assert.ok(created.generated_at, 'created history has generated_at');

const weekly = createReportHistory(db, {
    tipe: 'mingguan',
    jenis: 'Pidana',
    periode_label: '01-05-2026 s.d. 07-05-2026',
    start_date: '2026-05-01',
    end_date: '2026-05-07',
    format: 'pdf',
    filename: 'Akurasi_Pidana_01-05-2026_sd_07-05-2026.pdf'
});

const all = listReportHistory(db, {});
assert.strictEqual(all.length, 2, 'lists all histories newest first');
assert.strictEqual(all[0].id, weekly.id);

const monthlyOnly = listReportHistory(db, { tipe: 'bulanan', jenis: 'Perdata' });
assert.strictEqual(monthlyOnly.length, 1, 'filters monthly history by type and jenis');
assert.strictEqual(monthlyOnly[0].id, created.id);

assert.strictEqual(deleteReportHistory(db, created.id), true, 'deletes existing history');
assert.strictEqual(deleteReportHistory(db, created.id), false, 'delete returns false for missing history');
assert.strictEqual(listReportHistory(db, {}).length, 1, 'deleted history is removed');

assert.throws(() => createReportHistory(db, {
    tipe: 'harian',
    jenis: 'Perdata',
    periode_label: 'Mei 2026',
    format: 'docx',
    filename: 'x.docx'
}), /tipe laporan tidak valid/);

db.close();
console.log('reportHistory tests passed');
