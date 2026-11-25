const { parseEisPeriod } = require('./eisPeriod');

// Rule source: Badilum circular 478/DJU/TI.1.1/III/2024, annex II.
// These checks use local event fields, not MIS eligibility rules or scoring.

const SOURCE_NOTE = 'Pemeriksaan cache SIPP lokal; bukan daftar perkara resmi EIS/MIS.';
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().trim()
    .replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');
const field = (label, value) => ({ label, value });
const result = (status, reason) => ({ status, reason, findings: [] });

// Compare civil dates, not UTC timestamps or elapsed 24-hour intervals. The source
// stores event dates, not the original time of entry, upload, or signature.
function dateOnly(value) {
    const match = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(String(value ?? '').trim());
    if (!match || match[1].startsWith('0000')) return null;
    const time = Date.parse(match[1]);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === match[1] ? match[1] : null;
}

function plusMonths(date, months) {
    const time = new Date(date);
    const day = time.getUTCDate();
    time.setUTCDate(1);
    time.setUTCMonth(time.getUTCMonth() + months + 1, 0);
    time.setUTCDate(Math.min(day, time.getUTCDate()));
    return time.toISOString().slice(0, 10);
}

function courtTrack(row) {
    const name = normalize(row.jenis_perkara);
    if (name === 'perdata') return 'perdata';
    if (name === 'pidana' || name === 'perikanan') return 'pidana';
    return null;
}

function evidence(reason, ...fields) {
    return { reason, fields };
}

const rules = new Map();
function register(labels, rule) {
    for (const label of labels) rules.set(normalize(label), rule);
}
function unavailable(labels, missing) {
    register(labels, { missing });
}

register(['Pelaksanaan BHT'], {
    bht: true,
    caveat: 'Tanggal putusan pada bulan terpilih. Tanggal BHT berasal dari detail putusan (raw_json/raw_text). Tanpa riwayat pemberitahuan, upaya hukum, dan aturan pemilihan perkara MIS, kolom kosong hanya kandidat untuk ditinjau, bukan kegagalan.',
    check(row, putus) {
        const state = readBht(row, putus);
        if (state === 'present') return true;
        if (state !== 'absent') return null;
        const minutasi = dateOnly(row.tanggal_minutasi);
        return {
            candidate: true,
            ...evidence('Tanggal BHT tidak tercatat di detail putusan lokal; verifikasi apakah perkara sudah berkekuatan hukum tetap.',
                field('Tanggal Putusan', putus), field('Tanggal BHT', 'Tidak tercatat di cache'),
                ...(minutasi ? [field('Tanggal Minutasi', minutasi)] : []))
        };
    }
});

function readBht(row, putus) {
    // Only a decision-detail record for this judgment is evidence of a missing field.
    if (dateOnly(row.detail_putus) !== putus) return 'unknown';
    let raw;
    try { raw = JSON.parse(row.raw_json); } catch { raw = null; }
    const validRaw = Array.isArray(raw) && raw.length > 0 && raw.every(item => item && typeof item.label === 'string');
    const values = validRaw ? raw.filter(item => normalize(item.label) === 'tanggal bht').map(item => item.value) : [];
    if (!values.length) {
        for (const line of String(row.raw_text ?? '').split(/\r?\n/)) {
            const pair = /^\s*tanggal\s+bht\s*:\s*(.*)$/i.exec(line);
            if (pair) values.push(pair[1]);
        }
    }
    let absent = false;
    const days = new Set();
    for (const value of values) {
        const text = String(value ?? '').trim();
        if (/^(?:-|0000-00-00(?:[ T]00:00:00)?|)$/i.test(text)) {
            absent = true;
        } else {
            const date = dateOnly(text);
            if (!date || date < putus) return 'unknown';
            days.add(date);
        }
    }
    if (days.size === 1 && !absent) return 'present';
    if (!days.size && (absent || validRaw)) return 'absent';
    return 'unknown';
}

register(['Penyelesaian Perkara Tepat Waktu'], {
    schedule: true,
    caveat: 'Tanggal putusan pada bulan terpilih, batas lima bulan kalender. Untuk perdata, tanggal jadwal pertama hanya proksi: cache tidak mengonfirmasi sidang benar-benar terlaksana atau pengecualian EIS.',
    check(row, putus, schedule) {
        const track = courtTrack(row);
        const civil = track === 'perdata';
        const from = civil ? schedule?.first : dateOnly(row.sipp_tanggal_register);
        if (!track || !from || from > putus || (civil && schedule.invalid)) return null;
        const deadline = plusMonths(from, 5);
        if (putus <= deadline) return true;
        return {
            ...evidence(civil ? 'Lebih dari lima bulan dari jadwal pertama yang tercatat; konfirmasi tanggal sidang pertama.'
                : 'Lebih dari lima bulan dari tanggal pendaftaran sampai tanggal putusan.',
            field(civil ? 'Tanggal Jadwal Pertama' : 'Tanggal Pendaftaran', from),
            field('Tanggal Putusan', putus), field('Batas 5 Bulan', deadline)),
            candidate: civil
        };
    }
});


register(['Tanggal Putusan dan Tanggal Sidang Terakhir'], {
    schedule: true,
    basis: 'Tanggal putusan pada bulan terpilih, dibandingkan dengan tanggal jadwal terbaru di cache; jadwal bukan berita acara pelaksanaan sidang.',
    check(row, putus, schedule) {
        if (!schedule?.last || schedule.invalid) return null;
        if (schedule.last === putus) return true;
        return evidence('Tanggal putusan berbeda dari tanggal pada jadwal sidang terakhir di cache.',
            field('Tanggal Putusan', putus), field('Tanggal Jadwal Sidang Terakhir', schedule.last));
    }
});

register(['Agenda Sidang Terakhir'], {
    schedule: true,
    caveat: 'Tanggal putusan pada bulan terpilih. Agenda menggunakan teks jadwal lokal, bukan kode agenda/status resmi; agenda yang ambigu tidak dinilai.',
    check(row, putus, schedule) {
        if (!schedule?.last || schedule.invalid || schedule.agendas.size !== 1) return null;
        const [agenda] = schedule.agendas;
        if (/\b(?:putusan|penetapan)\s+sela\b/.test(agenda)) return null;
        if (/^(?:(?:sidang|agenda)\s+)?(?:(?:pembacaan|pengucapan)\s+)?(?:putusan|penetapan)(?:\s+(?:akhir|hakim))?[.!]?$/.test(agenda)) return true;
        const stage = /^(pemeriksaan saksi|pembuktian|tuntutan|kesimpulan|mediasi)(?:\s|[.!]|$)/.exec(agenda)?.[1];
        if (!stage || /\b(?:putusan|penetapan)\b/.test(agenda)) return null;
        // Return only a recognized category, not potentially sensitive free text.
        return { candidate: true, ...evidence('Agenda terakhir yang tercatat adalah tahap sebelum putusan; verifikasi jadwal dan kode agenda SIPP.',
            field('Tanggal Putusan', putus), field('Tanggal Jadwal Sidang Terakhir', schedule.last), field('Kategori Agenda', stage)) };
    }
});

// The public circular identifies the indicator, not the MIS implementation.
unavailable(['Kesesuaian Kode Satker Nomor Perkara'], 'Perlu kode satker resmi EIS yang berlaku per periode: SK 2478/2022 mencantumkan PN Ranai (Ran), sebelum perubahan nama menjadi PN Natuna. Nomor lokal saja tidak menetapkan kode yang diharapkan MIS.');
unavailable(['Jangka Waktu Pelaksanaan Delegasi Masuk'], 'Perlu nomor relasi perkara, tanggal penerimaan serta pelaksanaan delegasi masuk, dan kalender hari kerja/libur.');
unavailable(['Pelaksanaan Mediasi'], 'Perlu cakupan perkara wajib mediasi dan hasil mediasi terstruktur (berhasil/sebagian/tidak berhasil).');
unavailable(['E-Document Dakwaan/Petitum', 'E-Document Tuntutan', 'E-Document Putusan Akhir/Penetapan', 'Dokumen Elektronik Relaas Panggilan Sidang Pertama', 'Dokumen Elektronik Rencana Persidangan (Court Callendar)', 'Dokumen Elektronik Rencana Persidangan (Court Calendar)', 'Dokumen Elektronik Putusan Anonimisasi'], 'Perlu cakupan wajib per perkara dan metadata keberadaan, jenis, serta versi dokumen yang sesuai; cache bukan register dokumen.');
unavailable(['Data Lapor Mediasi', 'Data Diversi'], 'Perlu tanggal lapor mediasi/diversi, tanggal pembanding dan cakupan proses; status perkara bukan catatan laporan.');
unavailable(['Data Nilai Sengketa'], 'Perlu nilai sengketa terstruktur dan penanda perkara gugatan sederhana yang dinilai.');
unavailable(['Publikasi Pihak'], 'Cache dapat memuat flag publikasi, tetapi tidak memuat dasar anonimisasi per perkara sesuai SK KMA 2-144/2022 atau keadaan publikasi yang terverifikasi.');
unavailable(['Penahanan'], 'Perlu interval penahanan per terdakwa, termasuk perpanjangan, penangguhan atau pengalihan, untuk dibandingkan dengan tanggal putus.');
unavailable(['Sisa Biaya Perkara Tk Pertama', 'Sisa Biaya Perkara Tingkat Pertama'], 'Perlu saldo panjar, kewajiban pengembalian, dan transaksi pengembalian biaya tingkat pertama.');
unavailable(['Verifikasi Dokumen Elektronik Elitigasi', 'Verifikasi Dokumen Elektronik E-Litigasi'], 'Daftar entri yang dinilai Badilum dan aturan Sesuai/Tidak belum diketahui. Bundel SIPP tidak memuat tanggal verifikasi dan hitungan menurut tanggal input tidak cocok dengan EIS pada bulan yang diuji. Karena itu bundel tidak ditampilkan sebagai rincian penilaian.');
unavailable(['Pengarsipan Perkara'], 'Perlu tanggal serah/arsip, tanggal awal menurut SOP Kepaniteraan dan definisi pengecualian.');
for (const [labels, reason] of [
    [['Rilis Versi SIPP'], 'Penilaian tingkat satker terhadap versi SIPP yang terpasang, bukan perkara.'],
    [['Pelaksanaan Sinkronisasi SIPP Web', 'Sinkronisasi SIPP Web'], 'Penilaian tingkat satker terhadap sinkronisasi SIPP Web, bukan perkara.'],
    [['Pelaksanaan Sinkronisasi SIPP ke Data Center MARI', 'Sinkronisasi SIPP ke Data Center MARI'], 'Penilaian tingkat satker terhadap sinkronisasi ke Data Center MARI, bukan perkara.']
]) register(labels, { notCaseBased: reason });

function getRule(label) {
    const rule = rules.get(normalize(label));
    if (rule) return rule;
    return { missing: 'Indikator belum dapat dihubungkan dengan aturan dan kolom cache lokal yang terverifikasi.' };
}

function columns(db, table) {
    return new Set(db.prepare('SELECT name FROM pragma_table_info(?)').all(table).map(row => row.name));
}

function readSchedules(db, rows, withAgenda) {
    const schedules = new Map();
    // Bound each statement's parameter count; read only schedules for the selected cases.
    for (let i = 0; i < rows.length; i += 200) {
        const ids = rows.slice(i, i + 200).map(row => row.nomor_perkara);
        const params = ids.map(() => '?').join(',');
        const sql = `SELECT nomor_perkara, tanggal${withAgenda ? ', agenda' : ''}
            FROM jadwal_sidang WHERE nomor IS NOT NULL AND nomor_perkara IN (${params})`;
        for (const row of db.prepare(sql).iterate(...ids)) {
            if (!schedules.has(row.nomor_perkara)) {
                schedules.set(row.nomor_perkara, { first: null, last: null, invalid: false, agendas: new Set() });
            }
            const s = schedules.get(row.nomor_perkara);
            const date = dateOnly(row.tanggal);
            if (!date) { s.invalid = true; continue; }
            if (!s.first || date < s.first) s.first = date;
            if (!s.last || date > s.last) {
                s.last = date;
                s.agendas.clear();
            }
            if (withAgenda && date === s.last) s.agendas.add(normalize(row.agenda));
        }
    }
    return schedules;
}

function getMonthlyHearingContext(db, start, end, witness) {
    const jadwal = columns(db, 'jadwal_sidang');
    const perkara = columns(db, 'perkara');
    if (!['id', 'nomor_perkara', 'nomor', 'tanggal', 'agenda'].every(name => jadwal.has(name)) ||
        !['id', 'nomor_perkara', 'sipp_synced'].every(name => perkara.has(name))) return null;

    const rows = db.prepare(`SELECT j.id AS hearingId, p.id, p.nomor_perkara AS nomorPerkara,
        j.tanggal, j.agenda FROM jadwal_sidang j JOIN perkara p ON p.nomor_perkara = j.nomor_perkara
        WHERE p.sipp_synced = 1 AND j.nomor IS NOT NULL AND substr(trim(j.tanggal), 1, 10) BETWEEN ? AND ?
        ORDER BY j.tanggal, p.nomor_perkara, j.nomor, j.id`).all(start, end);
    return {
        kind: witness ? 'witness_schedule' : 'bas_schedule',
        rows: rows.flatMap(row => {
            const tanggal = dateOnly(row.tanggal);
            if (!tanggal || (witness && !/\bsaksi\b/.test(normalize(row.agenda)))) return [];
            return [{ ...row, tanggal }];
        })
    };
}

function getEisFindings(db, period, label) {
    const { start, end } = parseEisPeriod(period);
    const rule = getRule(label);
    const key = normalize(label);
    const witness = key === 'pencatatan saksi';
    if (witness || key === 'dokumen elektronik berita acara sidang') {
        const context = getMonthlyHearingContext(db, start, end, witness);
        const reason = witness
            ? 'Sinkron NatunaSakti belum membaca catatan saksi, waktu input pertama, dan kelengkapan kolomnya. Agenda yang menyebut saksi bukan daftar saksi yang sudah diinput.'
            : 'Sinkron NatunaSakti belum membaca metadata unggahan BAS per sidang. Status unggah belum dapat diverifikasi; jadwal bukan bukti sidang terlaksana atau BAS sudah diunggah.';
        return { ...result('unavailable', reason), ...(context && { context }) };
    }
    if (rule.notCaseBased) return result('not_case_based', rule.notCaseBased);
    if (rule.missing) return result('unavailable', rule.missing);

    const cases = columns(db, 'perkara');
    if (!['id', 'nomor_perkara', 'tanggal_putus', 'sipp_synced'].every(name => cases.has(name))) {
        return result('unavailable', 'Cache perkara SIPP lokal tidak tersedia.');
    }
    const details = columns(db, 'putusan_perkara');
    const scheduleColumns = rule.schedule ? columns(db, 'jadwal_sidang') : new Set();
    const hasDetail = ['nomor_perkara', 'tanggal_putusan'].every(name => details.has(name));
    const hasSchedule = ['nomor_perkara', 'nomor', 'tanggal'].every(name => scheduleColumns.has(name));
    const withAgenda = hasSchedule && scheduleColumns.has('agenda');
    const detail = (name, alias = name) => `${hasDetail && details.has(name) ? `d.${name}` : 'NULL'} AS ${alias}`;
    const optional = name => cases.has(name) ? `p.${name}` : `NULL AS ${name}`;
    const scope = hasDetail
        ? `(substr(trim(p.tanggal_putus), 1, 10) BETWEEN ? AND ? OR substr(trim(d.tanggal_putusan), 1, 10) BETWEEN ? AND ?)`
        : 'substr(trim(p.tanggal_putus), 1, 10) BETWEEN ? AND ?';
    const rows = db.prepare(`SELECT p.id, p.nomor_perkara, p.tanggal_putus,
        ${optional('jenis_perkara')}, ${optional('sipp_tanggal_register')},
        ${detail('tanggal_putusan', 'detail_putus')}${rule.bht ? `, ${detail('tanggal_minutasi')}` : ''}
        ${rule.bht ? `, ${detail('raw_json')}, ${detail('raw_text')}` : ''}
        FROM perkara p ${hasDetail ? 'LEFT JOIN putusan_perkara d ON d.nomor_perkara = p.nomor_perkara' : ''}
        WHERE p.sipp_synced = 1 AND ${scope} ORDER BY p.id`).all(...(hasDetail ? [start, end, start, end] : [start, end]));
    const schedules = hasSchedule ? readSchedules(db, rows, withAgenda) : new Map();
    const sync = cases.has('sipp_last_sync') ? db.prepare('SELECT MAX(sipp_last_sync) AS at FROM perkara WHERE sipp_synced = 1').get()?.at : null;
    const syncTime = Date.parse(sync);
    const syncInfo = Number.isFinite(syncTime) ? { localSyncedAt: new Date(syncTime).toISOString() } : {};
    const findings = [];
    let evaluated = 0;
    let unknown = 0;
    for (const row of rows) {
        const main = dateOnly(row.tanggal_putus);
        const detailed = dateOnly(row.detail_putus);
        const putus = main || detailed;
        if (!putus || putus < start || putus > end || (main && detailed && main !== detailed)) {
            unknown++;
            continue;
        }
        const entry = rule.check(row, putus, schedules.get(row.nomor_perkara));
        if (!entry || entry.candidate) unknown++;
        else evaluated++;
        if (entry && entry !== true) {
            findings.push({ id: row.id, nomorPerkara: row.nomor_perkara, reason: entry.reason, fields: entry.fields });
        }
    }
    const reason = [SOURCE_NOTE, rule.caveat || rule.basis || 'Dasar periode: tanggal putusan pada bulan terpilih.',
        !rows.length ? 'Tidak ada perkara tersinkron dengan tanggal putusan pada periode ini; bukan konfirmasi angka resmi nol.'
            : !evaluated && !findings.length ? 'Data pendukung tidak cukup untuk menilai perkara pada periode ini.' : ''].filter(Boolean).join(' ');
    const status = !rows.length || (!evaluated && !findings.length) ? 'unavailable'
        : unknown || rule.caveat ? 'partial' : 'checked';
    return { status, reason, findings, evaluated, unknown, ...syncInfo };
}

module.exports = { getEisFindings };
