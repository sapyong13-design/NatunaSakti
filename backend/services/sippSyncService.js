const { execFile } = require('node:child_process');
const path = require('node:path');
const cheerio = require('cheerio');
const { savePutusanCache } = require('../lib/putusanCache');

function plain(value) {
  if (!value) return '';
  return cheerio.load(String(value).replace(/<br\s*\/?\s*>/gi, '\n'), null, false).text().trim();
}

function jenisPerkara(nomor) {
  const upper = nomor.toUpperCase();
  if (upper.includes('PRK')) return 'Perikanan';
  if (upper.includes('/PDT')) return 'Perdata';
  if (upper.includes('/PID')) return 'Pidana';
  return 'Lainnya';
}

function mapPerkara(row, fetchedAt) {
  const nomor = String(row.nomor_perkara || '').trim();
  if (!nomor || nomor.length > 250) throw new Error('Nomor perkara sumber DB tidak valid');
  const jenis = jenisPerkara(nomor);
  const labels = jenis === 'Perdata'
    ? ['Penggugat/Pemohon', 'Tergugat/Termohon', 'Pihak ketiga', 'Pihak keempat']
    : ['Penuntut Umum', 'Terdakwa', 'Pihak ketiga', 'Pihak keempat'];
  const parties = [1, 2, 3, 4].map((n, i) => {
    const name = plain(row[`pihak${n}_text`]);
    return name ? `${labels[i]}: ${name}` : '';
  }).filter(Boolean).join('\n') || plain(row.para_pihak);
  const register = row.tanggal_pendaftaran || null;
  const year = nomor.match(/\/(\d{4})\//)?.[1] || register?.slice(0, 4);
  if (!/^\d{4}$/.test(year || '')) throw new Error('Tahun perkara sumber DB tidak valid');
  return {
    nomor_perkara: nomor,
    nama_perkara: plain(row.jenis_perkara_nama),
    para_pihak: parties,
    tahun_masuk: Number(year),
    jenis_perkara: jenis,
    sipp_tanggal_register: register,
    sipp_klasifikasi: plain(row.jenis_perkara_nama),
    sipp_status: plain(row.proses_terakhir_text || row.tahapan_terakhir_text),
    sipp_lama_proses: null,
    sipp_pihak_dipublikasikan: ['Y', 'T'].includes(row.pihak_dipublikasikan) ? row.pihak_dipublikasikan : null,
    sipp_synced: 1,
    sipp_last_sync: fetchedAt
  };
}

function groupByPerkara(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = String(row.perkara_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

function mapPutusan(perkara, putusan, terdakwa = []) {
  const raw = [];
  const add = (label, value) => { if (value) raw.push({ label, value: plain(value) }); };
  add('Tanggal Putusan', putusan?.tanggal_putusan);
  add('Tanggal Minutasi', putusan?.tanggal_minutasi);
  add('Tanggal BHT', putusan?.tanggal_bht);
  add('Amar Putusan', putusan?.amar_putusan);
  add('Status Putusan', putusan?.status_putusan_nama || putusan?.status_putusan_text);
  for (const row of terdakwa) {
    add('Putusan Terdakwa', row.status_putusan_text);
    add('Keterangan Putusan Terdakwa', row.keterangan_putusan);
  }
  if (perkara.pihak_dipublikasikan === 'Y') add('Pihak dipublikasikan', 'Ya');
  if (perkara.pihak_dipublikasikan === 'T') add('Pihak dipublikasikan', 'Tidak');
  return {
    tanggal_putusan: putusan?.tanggal_putusan || null,
    tanggal_minutasi: putusan?.tanggal_minutasi || null,
    amar_putusan: plain(putusan?.amar_putusan) || null,
    status_putusan: plain(putusan?.status_putusan_nama || putusan?.status_putusan_text) || null,
    raw,
    raw_text: raw.map(row => `${row.label}: ${row.value}`).join('\n')
  };
}

class SIPPSyncService {
  constructor(db) {
    this.db = db;
    const columns = db.prepare('PRAGMA table_info(perkara)').all();
    if (!columns.some(column => column.name === 'sipp_pihak_dipublikasikan')) {
      db.exec('ALTER TABLE perkara ADD COLUMN sipp_pihak_dipublikasikan TEXT');
    }
  }

  isFirstSync() {
    return this.db.prepare('SELECT COUNT(*) AS c FROM perkara').get().c === 0;
  }

  readSource(nomor = null) {
    return new Promise((resolve, reject) => {
      const child = execFile('python', [path.join(__dirname, '../scripts/read-sipp-db.py')], {
        encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 64 * 1024 * 1024
      }, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr.trim() || 'Koneksi DB SIPP gagal; cache lokal tidak diubah'));
        try {
          const snapshot = JSON.parse(stdout);
          for (const key of ['perkara', 'jadwal', 'putusan', 'terdakwa']) {
            if (!Array.isArray(snapshot[key])) throw new Error('Respons DB SIPP tidak valid');
          }
          resolve(snapshot);
        } catch (parseError) { reject(parseError); }
      });
      child.stdin.on('error', () => {}); // Process failure is reported by execFile callback.
      child.stdin.end(JSON.stringify({ nomor }));
    });
  }

  async fetchSIPPData(progressCallback = null) {
    progressCallback?.({ current: 0, total: 0, fetchedCount: 0, status: 'db-read' });
    const source = await this.readSource();
    if (!source.perkara.length) throw new Error('DB SIPP mengembalikan snapshot kosong; cache lokal dipertahankan');
    const fetchedAt = new Date().toISOString();
    const decisions = groupByPerkara(source.putusan);
    const snapshot = { ...source, sourcePerkara: source.perkara, perkara: source.perkara.map(row => mapPerkara(row, fetchedAt)) };
    for (let i = 0; i < snapshot.perkara.length; i++) {
      const row = snapshot.perkara[i];
      const decision = decisions.get(String(source.perkara[i].perkara_id))?.[0];
      row.tanggal_putus = decision?.tanggal_putusan || null;
      const end = decision?.tanggal_minutasi || row.tanggal_putus || fetchedAt.slice(0, 10);
      const days = Math.floor((Date.parse(end) - Date.parse(row.sipp_tanggal_register)) / 86400000);
      row.sipp_lama_proses = Number.isFinite(days) && days >= 0 ? `${days} Hari` : null;
    }
    if (new Set(snapshot.perkara.map(row => row.nomor_perkara)).size !== snapshot.perkara.length) {
      throw new Error('Nomor perkara duplikat pada sumber DB SIPP');
    }
    snapshot.detail_cache = { ok: snapshot.perkara.length * 2, failed: 0, jadwalOk: snapshot.perkara.length,
      putusanOk: snapshot.perkara.length, jadwalFailed: 0, putusanFailed: 0, total: snapshot.perkara.length };
    progressCallback?.({ current: snapshot.perkara.length, total: snapshot.perkara.length,
      fetchedCount: snapshot.perkara.length, status: 'db-read' });
    return snapshot;
  }

  cacheJadwal(nomor, rows, fetchedAt = new Date().toISOString()) {
    this.db.prepare('DELETE FROM jadwal_sidang WHERE nomor_perkara = ?').run(nomor);
    const insert = this.db.prepare(`INSERT INTO jadwal_sidang
      (nomor_perkara, nomor, tanggal, jam, agenda, ruangan, alasan_ditunda, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    if (!rows.length) insert.run(nomor, null, null, null, null, null, null, fetchedAt);
    rows.forEach((row, i) => insert.run(nomor, i + 1, row.tanggal_sidang || null,
      row.jam_sidang || null, plain(row.agenda) || null, plain(row.ruangan) || null,
      plain(row.alasan_ditunda) || null, fetchedAt));
  }

  async saveToDatabase(snapshot) {
    const jadwal = groupByPerkara(snapshot.jadwal);
    const putusan = groupByPerkara(snapshot.putusan);
    const terdakwa = groupByPerkara(snapshot.terdakwa);
    const insert = this.db.prepare(`INSERT INTO perkara
      (nomor_perkara, nama_perkara, para_pihak, tahun_masuk, jenis_perkara,
       sipp_tanggal_register, sipp_klasifikasi, sipp_status, sipp_lama_proses,
       sipp_pihak_dipublikasikan, sipp_synced, sipp_last_sync, tanggal_putus)
      VALUES (@nomor_perkara, @nama_perkara, @para_pihak, @tahun_masuk, @jenis_perkara,
       @sipp_tanggal_register, @sipp_klasifikasi, @sipp_status, @sipp_lama_proses,
       @sipp_pihak_dipublikasikan, @sipp_synced, @sipp_last_sync, @tanggal_putus)
      ON CONFLICT(nomor_perkara) DO UPDATE SET
       nama_perkara=excluded.nama_perkara, para_pihak=excluded.para_pihak,
       tahun_masuk=excluded.tahun_masuk, jenis_perkara=excluded.jenis_perkara,
       sipp_tanggal_register=excluded.sipp_tanggal_register, sipp_klasifikasi=excluded.sipp_klasifikasi,
       sipp_status=excluded.sipp_status, sipp_pihak_dipublikasikan=excluded.sipp_pihak_dipublikasikan,
       sipp_lama_proses=excluded.sipp_lama_proses, tanggal_putus=excluded.tanggal_putus,
       sipp_synced=excluded.sipp_synced, sipp_last_sync=excluded.sipp_last_sync,
       updated_at=CURRENT_TIMESTAMP`);
    this.db.transaction(() => {
      snapshot.perkara.forEach((row, i) => {
        insert.run(row);
        const original = snapshot.sourcePerkara[i];
        const id = String(original.perkara_id);
        this.cacheJadwal(row.nomor_perkara, jadwal.get(id) || [], row.sipp_last_sync);
        savePutusanCache(this.db, row.nomor_perkara, mapPutusan(original, putusan.get(id)?.[0], terdakwa.get(id)));
      });
    })();
    return snapshot.perkara.length;
  }

  async fetchJadwalSidang(nomor) {
    await this.fetchAndCacheJadwal(nomor);
    return this.db.prepare(`SELECT nomor, tanggal, jam, agenda, ruangan, alasan_ditunda AS alasanDitunda
      FROM jadwal_sidang WHERE nomor_perkara = ? AND nomor IS NOT NULL ORDER BY nomor`).all(nomor);
  }

  async fetchAndCacheJadwal(nomor) {
    const source = await this.readSource(nomor);
    if (!source.perkara.length) throw new Error('Perkara tidak ditemukan pada DB SIPP');
    this.db.transaction(() => this.cacheJadwal(nomor, source.jadwal))();
    return source.jadwal.length;
  }

  async fetchPutusan(nomor) {
    const source = await this.readSource(nomor);
    if (!source.perkara.length) throw new Error('Perkara tidak ditemukan pada DB SIPP');
    return mapPutusan(source.perkara[0], source.putusan[0], source.terdakwa);
  }

  async fetchAndCachePutusan(nomor) {
    savePutusanCache(this.db, nomor, await this.fetchPutusan(nomor));
    return 1;
  }
}

module.exports = SIPPSyncService;
