const assert = require('node:assert/strict');
const { test } = require('node:test');
const Database = require('better-sqlite3');
const SIPPSyncService = require('./sippSyncService');
const { ensurePutusanSchema, getPutusanCache } = require('../lib/putusanCache');

function database() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE perkara (
    id INTEGER PRIMARY KEY, nomor_perkara TEXT UNIQUE NOT NULL, nama_perkara TEXT,
    para_pihak TEXT, tahun_masuk INTEGER, jenis_perkara TEXT, sipp_tanggal_register TEXT,
    sipp_klasifikasi TEXT, sipp_status TEXT, sipp_lama_proses TEXT, sipp_synced INTEGER,
    sipp_last_sync TEXT, updated_at TEXT, keterangan TEXT, tanggal_putus TEXT);
    CREATE TABLE jadwal_sidang (id INTEGER PRIMARY KEY, nomor_perkara TEXT, nomor INTEGER,
    tanggal TEXT, jam TEXT, agenda TEXT, ruangan TEXT, alasan_ditunda TEXT, fetched_at TEXT);`);
  ensurePutusanSchema(db);
  return db;
}

function source(flag = 'T', name = 'Nama lengkap sumber') {
  return { perkara: [{ perkara_id: 1, nomor_perkara: '1/Pid.B/2026/PN Ntn',
    jenis_perkara_nama: 'Penipuan', tanggal_pendaftaran: '2026-01-01',
    pihak1_text: 'Jaksa', pihak2_text: name, pihak_dipublikasikan: flag,
    proses_terakhir_text: 'Minutasi' }],
    jadwal: [{ perkara_id: 1, tanggal_sidang: '2026-01-02', agenda: 'Pembuktian' }],
    putusan: [{ perkara_id: 1, tanggal_putusan: '2026-01-03', tanggal_minutasi: '2026-01-04' }],
    terdakwa: [] };
}

test('full sync keeps real names and independent publication flags; upsert preserves identity/manual fields', async () => {
  const db = database();
  try {
    const service = new SIPPSyncService(db);
    service.readSource = async () => source();
    await service.saveToDatabase(await service.fetchSIPPData());
    const first = db.prepare('SELECT * FROM perkara').get();
    assert.match(first.para_pihak, /Nama lengkap sumber/);
    assert.equal(first.sipp_pihak_dipublikasikan, 'T');
    assert.equal(first.tanggal_putus, '2026-01-03');
    assert.equal(first.sipp_lama_proses, '3 Hari');
    assert.deepEqual(getPutusanCache(db, first.nomor_perkara).raw.find(r => r.label === 'Pihak dipublikasikan'),
      { label: 'Pihak dipublikasikan', value: 'Tidak' });
    db.prepare("UPDATE perkara SET keterangan='catatan lokal'").run();
    service.readSource = async () => source('Y', 'Nama diperbarui');
    await service.saveToDatabase(await service.fetchSIPPData());
    const second = db.prepare('SELECT * FROM perkara').get();
    assert.equal(second.id, first.id);
    assert.equal(second.keterangan, 'catatan lokal');
    assert.match(second.para_pihak, /Nama diperbarui/);
    assert.equal(second.sipp_pihak_dipublikasikan, 'Y');
    service.readSource = async () => source('');
    await service.saveToDatabase(await service.fetchSIPPData());
    assert.equal(db.prepare('SELECT sipp_pihak_dipublikasikan FROM perkara').get().sipp_pihak_dipublikasikan, null);
    assert.equal(getPutusanCache(db, first.nomor_perkara).raw.some(r => r.label === 'Pihak dipublikasikan'), false);
    service.readSource = async () => {
      const snapshot = source();
      snapshot.perkara[0].nomor_perkara = '8/PID.SUS/PN.RNI';
      return snapshot;
    };
    const historical = await service.fetchSIPPData();
    assert.equal(historical.perkara[0].tahun_masuk, 2026);
    assert.equal(historical.perkara[0].nomor_perkara, '8/PID.SUS/PN.RNI');
  } finally { db.close(); }
});

test('failed detail write rolls back names and schedule cache; failed source read leaves cache untouched', async () => {
  const db = database();
  try {
    const service = new SIPPSyncService(db);
    service.readSource = async () => source();
    await service.saveToDatabase(await service.fetchSIPPData());
    db.exec("CREATE TRIGGER reject_putusan BEFORE UPDATE ON putusan_perkara BEGIN SELECT RAISE(ABORT,'forced failure'); END");
    service.readSource = async () => ({ ...source('Y', 'Must roll back'), jadwal: [] });
    await assert.rejects(service.saveToDatabase(await service.fetchSIPPData()), /forced failure/);
    assert.match(db.prepare('SELECT para_pihak FROM perkara').get().para_pihak, /Nama lengkap sumber/);
    assert.equal(db.prepare('SELECT agenda FROM jadwal_sidang').get().agenda, 'Pembuktian');
    service.readSource = async () => { throw new Error('DB unavailable'); };
    await assert.rejects(service.fetchSIPPData(), /DB unavailable/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM perkara').get().n, 1);
  } finally { db.close(); }
});
