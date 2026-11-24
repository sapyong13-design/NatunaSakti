const { execFile } = require('node:child_process');
const path = require('node:path');

const reader = path.join(__dirname, '../scripts/read-sipp-db.py');
const day = 86_400_000;
const labels = new Map([
    ['Pendaftaran Perkara', ['registration']],
    ['Pencatatan Barang Bukti', ['evidence']],
    ['Penetapan Hakim', ['judge-appoint']],
    ['Penetapan Panitera Pengganti', ['clerk-appoint']],
    ['Penetapan Jurusita/Jurusita Pengganti', ['bailiff-appoint']],
    ['Penetapan Hari Sidang Pertama', ['hearing-appoint']],
    ['Penginputan Tuntutan', ['charge-input']],
    ['Penginputan Putusan Akhir', ['decision-input']],
    ['Penginputan Minutasi', ['minutasi-input']],
    ['Pelaksanaan Minutasi', ['minutasi-run']],
    ['Penginputan Permohonan Banding', ['banding-input']],
    ['Penginputan Permohonan Kasasi', ['kasasi-input']],
    ['Penginputan Permohonan Peninjauan Kembali', ['pk-input']],
    ['Pengiriman Berkas Banding', ['banding-notice', 'banding-inzage', 'banding-send']],
    ['Pengiriman Berkas Kasasi', ['kasasi-notice', 'kasasi-memory', 'kasasi-deliver', 'kasasi-send']],
    ['Pengiriman Berkas Peninjauan Kembali', ['pk-notice', 'pk-memory', 'pk-counter', 'pk-send']],
    ['Pemberitahuan Putusan/Penentapan', ['decision-notice']],
    ['Penginputan Penetapan Majelis/Hakim', ['judge-input']],
    ['Penginputan Penunjukan Panitera Pengganti', ['clerk-input']],
    ['Penginputan Penetapan Hari Sidang', ['hearing-input']],
    ['Penginputan Penetapan Jurusita/Jurusita Pengganti', ['bailiff-input']],
    ['Penginputan Data Pelaksanaan Delegasi', ['delegation-input']],
    ['Kepatuhan Penundaan Jadwal Sidang', ['adjournment-input']],
    ['Penginputan Penetapan Perpanjangan Penahanan', ['detention-input']],
    ['Unggah Putusan Akhir', ['decision-upload']],
    ['Tanda Tangan Elektronik Salinan Putusan Perkara Perdata', ['tte-civil']],
    ['Tanda Tangan Elektronik Salinan Putusan Perkara Pidana', ['tte-criminal']]
].map(([label, keys]) => [normalize(label), keys]));

function normalize(text) {
    return text.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');
}

const fitLabels = new Map([
    ['E-Document Dakwaan/Petitum', 'dakwaan'],
    ['E-Document Tuntutan', 'tuntutan-doc'],
    ['E-Document Putusan Akhir/Penetapan', 'putusan-doc'],
    ['Data Lapor Mediasi', 'lapor-mediasi'],
    ['Data Diversi', 'lapor-diversi'],
    ['Data Nilai Sengketa', 'nilai-sengketa'],
    ['Dokumen Elektronik Relaas Panggilan Sidang Pertama', 'relaas-pertama'],
    ['Dokumen Elektronik Rencana Persidangan (Court Callendar)', 'court-calendar'],
    ['Dokumen Elektronik Rencana Persidangan (Court Calendar)', 'court-calendar'],
    ['Dokumen Elektronik Putusan Anonimisasi', 'putusan-anonim'],
    ['Agenda Sidang Terakhir', 'agenda-terakhir'],
    ['Tanggal Putusan dan Tanggal Sidang Terakhir', 'putusan-sidang-terakhir'],
    ['Publikasi Pihak', 'publikasi-pihak'],
    ['Pelaksanaan BHT', 'bht'],
    ['Penahanan', 'penahanan'],
    ['Sisa Biaya Perkara Tk Pertama', 'sisa-biaya'],
    ['Sisa Biaya Perkara Tingkat Pertama', 'sisa-biaya'],
    ['Verifikasi Dokumen Elektronik Elitigasi', 'elitigasi'],
    ['Verifikasi Dokumen Elektronik E-Litigasi', 'elitigasi'],
    ['Pengarsipan Perkara', 'arsip']
].map(([label, key]) => [normalize(label), key]));

const siteLevel = new Set([
    'pelaksanaan sinkronisasi sipp web', 'sinkronisasi sipp web',
    'pelaksanaan sinkronisasi sipp ke data center mari', 'sinkronisasi sipp ke data center mari'
].map(normalize));

function complianceKey(label, index) {
    return labels.get(normalize(label))?.[index];
}

function localAudit(tab, label, index = 0) {
    if (tab === 'kepatuhan') {
        const key = complianceKey(label, index);
        return key ? { key } : null;
    }
    if (tab !== 'kelengkapan' && tab !== 'kesesuaian') return null;
    if (siteLevel.has(normalize(label))) {
        return { notCaseBased: 'Penilaian tingkat satuan kerja terhadap sinkronisasi, bukan perkara. Angka resmi tidak dihitung ulang dari data perkara.' };
    }
    const key = fitLabels.get(normalize(label));
    return key ? { key } : null;
}

function parseLocalTimestamp(value) {
    const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?))?$/.exec(value);
    if (!match || match[1].startsWith('0000')) return null;
    const date = Date.parse(`${match[1]}T00:00:00Z`);
    if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== match[1]) return null;
    const time = match[2] ? Date.parse(`${match[1]}T${match[2]}Z`) : date;
    return Number.isFinite(time) ? { date, time, precise: !!match[2] } : null;
}

function assessCompliance(mode, row) {
    if (mode === 'evidence') return ['unknown', 'Bukti lokal tersedia untuk ditinjau; status tidak dapat dipastikan dari kolom ini.'];
    if (mode === 'presence') {
        if (row.present === 1) return ['matched', 'Memenuhi syarat yang diperiksa dari data lokal.'];
        if (row.present === 0) return ['review', 'Perlu dicek: data lokal belum memenuhi syarat yang diperiksa.'];
        return ['unknown', 'Ketersediaan catatan tidak dapat diperiksa.'];
    }
    const start = parseLocalTimestamp(row.event_at), end = parseLocalTimestamp(row.comparison_at);
    if (!start || !end) return ['unknown', 'Tanggal atau waktu pembanding belum lengkap.'];
    if (end.date < start.date || (start.precise && end.precise && end.time < start.time)) {
        return ['unknown', 'Urutan tanggal tidak konsisten.'];
    }
    if (mode === 'days') {
        const limit = Number(row.limit_days);
        if (row.limit_days == null || !Number.isInteger(Number(row.limit_days)) || Number(row.limit_days) < 0) return ['unknown', 'Batas hari tidak diketahui untuk peristiwa ini.'];
        const elapsed = (end.date - start.date) / day;
        return [elapsed > limit ? 'review' : 'matched', `${elapsed} hari kalender · batas ${limit} hari.`];
    }
    const earliestElapsed = end.time - (start.time + (start.precise ? 0 : day - 1));
    const latestElapsed = end.time + (end.precise ? 0 : day - 1) - start.time;
    if (earliestElapsed > day) return ['review', 'Melewati 1×24 jam dari tanggal acuan.'];
    if (latestElapsed <= day) return ['matched', 'Tercatat dalam 1×24 jam.'];
    return ['unknown', 'Jam tidak lengkap untuk membedakan tepat waktu dari terlambat.'];
}

function readCompliance(key, period, cutoff) {
    const args = [reader, '--eis-compliance', key, period];
    if (cutoff) args.push(cutoff);
    return new Promise((resolve, reject) => {
        execFile('python', args, {
            encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024
        }, (error, stdout) => {
            if (error) return reject(Object.assign(new Error('Pemeriksaan Kepatuhan di SIPP lokal gagal.'), { code: 'SIPP_AUDIT_READ' }));
            try {
                const data = JSON.parse(stdout);
                if (!Array.isArray(data.rows) || typeof data.basis !== 'string' || !['days', 'date24', 'presence', 'evidence'].includes(data.mode)) {
                    throw new TypeError('Invalid compliance response');
                }
                resolve(data);
            } catch (e) { reject(e); }
        });
    });
}

async function getLocalCompliance(db, key, period, asOf) {
    const sync = asOf || db.prepare('SELECT MAX(sipp_last_sync) AS at FROM perkara WHERE sipp_synced = 1').get()?.at;
    const cutoff = /^\d{4}-\d{2}-\d{2}/.test(String(sync ?? '')) ? String(sync).slice(0, 10) : null;
    const data = await readCompliance(key, period, cutoff);
    const localCase = db.prepare('SELECT id FROM perkara WHERE nomor_perkara = ? AND sipp_synced = 1');
    const counts = { matched: 0, review: 0, unknown: 0 };
    const rows = data.rows.map(row => {
        const docs = row.total_docs != null
            ? { present: Number(row.verified_docs) === Number(row.total_docs) ? 1 : 0 } : {};
        const [state, note] = assessCompliance(data.mode, { ...row, ...docs });
        counts[state]++;
        return {
            nomorPerkara: row.nomor_perkara, id: localCase.get(row.nomor_perkara)?.id ?? null,
            eventAt: row.event_at || null, comparisonAt: row.comparison_at || null,
            eventLabel: row.event_label ?? 'Tanggal acuan', comparisonLabel: row.comparison_label ?? 'Tanggal pembanding',
            present: row.present ?? null, flagText: row.flag_text ?? null,
            verifiedDocs: row.verified_docs == null ? null : Number(row.verified_docs),
            totalDocs: row.total_docs == null ? null : Number(row.total_docs),
            state, note
        };
    });
    return {
        status: 'partial', findings: [],
        reason: cutoff ? `${data.basis} Data dibatasi sampai ${cutoff} sesuai sinkron terakhir.` : data.basis,
        context: { kind: 'compliance', basis: data.basis, cutoff, rows, counts, checkedAt: new Date().toISOString() }
    };
}

module.exports = { complianceKey, localAudit, assessCompliance, getLocalCompliance };
