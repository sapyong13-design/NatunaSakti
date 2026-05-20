const assert = require('assert');
const Database = require('better-sqlite3');
const {
    ensurePutusanSchema,
    savePutusanCache,
    getPutusanCache
} = require('./putusanCache');

const db = new Database(':memory:');
ensurePutusanSchema(db);

savePutusanCache(db, '1/Pid.B/2026/PN Ntn', {
    tanggal_putusan: 'Rabu, 20 Mei 2026',
    amar_putusan: 'Menyatakan terdakwa bersalah',
    status_putusan: 'Putus',
    tanggal_minutasi: 'Jumat, 22 Mei 2026',
    majelis_hakim: 'Hakim A',
    panitera_pengganti: 'Panitera B',
    raw_text: 'Putusan lengkap',
    raw: [{ label: 'Tanggal Putusan', value: 'Rabu, 20 Mei 2026' }]
});

const cached = getPutusanCache(db, '1/Pid.B/2026/PN Ntn');
assert.ok(cached, 'cache exists');
assert.strictEqual(cached.nomor_perkara, '1/Pid.B/2026/PN Ntn');
assert.strictEqual(cached.tanggal_putusan, 'Rabu, 20 Mei 2026');
assert.strictEqual(cached.amar_putusan, 'Menyatakan terdakwa bersalah');
assert.deepStrictEqual(cached.raw, [{ label: 'Tanggal Putusan', value: 'Rabu, 20 Mei 2026' }]);
assert.ok(cached.fetched_at, 'cache has fetched_at');

savePutusanCache(db, '2/Pid.B/2026/PN Ntn', null);
const empty = getPutusanCache(db, '2/Pid.B/2026/PN Ntn');
assert.ok(empty, 'empty cache sentinel exists');
assert.strictEqual(empty.tanggal_putusan, null);
assert.deepStrictEqual(empty.raw, []);

db.close();
console.log('putusanCache tests passed');
