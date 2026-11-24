const assert = require('node:assert/strict');
const { test } = require('node:test');
const Database = require('better-sqlite3');
const { currentEisPeriod, parseEisPeriod } = require('./eisPeriod');
const { getEisFindings } = require('./eisFindings');
const { createOfficialEis } = require('../services/eisOfficial');

test('uses Jakarta month rollover and inclusive leap-month boundaries', () => {
    assert.equal(currentEisPeriod(new Date('2026-11-30T16:59:59Z')), '2026-11');
    assert.equal(currentEisPeriod(new Date('2026-11-30T17:00:00Z')), '2026-12');
    assert.deepEqual(parseEisPeriod('2024-02'), { year: 2024, month: 2, start: '2024-02-01', end: '2024-02-29' });
    assert.throws(() => parseEisPeriod(['2026-11']), RangeError);
});

test('BHT audit lists missing records as candidates and excludes wrong month, stale detail and manual cases', () => {
    const db = new Database(':memory:');
    try {
        db.exec(`CREATE TABLE perkara (id INTEGER, nomor_perkara TEXT, tanggal_putus TEXT, sipp_synced INTEGER);
            CREATE TABLE putusan_perkara (nomor_perkara TEXT, tanggal_putusan TEXT, fetched_at TEXT, raw_json TEXT);
            INSERT INTO perkara VALUES (1,'sample-a','2026-11-30',1),(2,'sample-b','2026-11-01',1),
              (3,'sample-c','2026-12-01',1),(4,'sample-d','2026-11-01',1),(5,'sample-e','2026-11-03',0);
            INSERT INTO putusan_perkara VALUES
              ('sample-a','2026-11-30','2026-12-01','[{"label":"Tanggal Putusan","value":"2026-11-30"}]'),
              ('sample-b','2026-11-01','2026-12-01','[{"label":"Tanggal BHT","value":"2026-11-16"}]'),
              ('sample-c','2026-12-01','2026-12-01','[]'),
              ('sample-d','2026-11-02','2026-12-01','[]'),
              ('sample-e','2026-11-03','2026-12-01','[]');`);
        const audit = getEisFindings(db, '2026-11', 'Pelaksanaan BHT');
        assert.equal(audit.status, 'partial');
        assert.deepEqual(audit.findings.map(x => x.id), [1]);
        assert.equal(audit.evaluated, 1);
        assert.equal(audit.unknown, 2);
        assert.equal(getEisFindings(db, '2026-11', 'Pencatatan Saksi').status, 'unavailable');
    } finally {
        db.close();
    }
});

test('preserves last good EIS snapshot when Badilum fails and limits automatic refresh to a Jakarta day', async () => {
    const db = new Database(':memory:');
    try {
        let now = new Date('2026-11-23T16:59:59Z');
        let calls = 0;
        const tabs = ['kinerja', 'kepatuhan', 'kelengkapan', 'kesesuaian', 'konversi'].map(id => ({
            id, rows: [{ label: 'Contoh', description: '', headers: ['Jumlah'], details: [{ values: ['1'] }], points: '1' }]
        }));
        const options = {
            clock: () => now,
            reader: async () => ++calls === 1 ? { status: 'ready', tabs } : { status: 'unavailable' }
        };
        const official = createOfficialEis(db, options);
        const [first, joined] = await Promise.all([official.refresh('2026-11'), official.refresh('2026-11')]);
        assert.equal(first.status, 'ready');
        assert.deepEqual(first, joined);
        assert.equal(calls, 1);
        const restarted = createOfficialEis(db, options);
        assert.equal((await restarted.refresh('2026-11')).status, 'ready');
        assert.equal(calls, 1);
        now = new Date('2026-11-23T17:00:00Z');
        const afterMidnight = await restarted.refresh('2026-11');
        assert.equal(afterMidnight.status, 'unavailable');
        assert.deepEqual(afterMidnight.snapshot, first.snapshot);
        assert.equal(calls, 2);
    } finally {
        db.close();
    }
});
