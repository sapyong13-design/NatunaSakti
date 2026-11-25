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
    ['Pengarsipan Perkara', 'arsip']
].map(([label, key]) => [normalize(label), key]));

const kinerjaLabels = new Map([
    ['Penyelesaian Perkara Tepat Waktu', 'timely-decision'],
    ['Rilis Versi SIPP', 'sipp-version'],
    ['Kesesuaian Kode Satker Nomor Perkara', 'satker-code'],
    ['Jangka Waktu Pelaksanaan Delegasi Masuk', 'delegation-arrival'],
    ['Pelaksanaan Mediasi', 'mediation-result']
].map(([label, key]) => [normalize(label), key]));

const siteLevel = new Set([
    'pelaksanaan sinkronisasi sipp web', 'sinkronisasi sipp web',
    'pelaksanaan sinkronisasi sipp ke data center mari', 'sinkronisasi sipp ke data center mari'
].map(normalize));

function complianceKey(label, index) {
    return labels.get(normalize(label))?.[index];
}

function localAudit(tab, label, index = 0) {
    if (tab === 'kinerja') {
        const key = kinerjaLabels.get(normalize(label));
        return key ? { key } : null;
    }
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
function docExt(docPath) {
    const text = typeof docPath === 'string' ? docPath.trim() : '';
    const match = /\.([a-z0-9]{2,5})$/i.exec(text);
    return match ? `.${match[1].toLowerCase()}` : null;
}


function assessCompliance(mode, row) {
    // Mode tanpa acuan tanggal: diputuskan sebelum pemeriksaan tanggal.
    if (mode === 'evidence') return ['unknown', 'Bukti lokal tersedia untuk ditinjau; status tidak dapat dipastikan dari kolom ini.'];
    if (mode === 'presence') {
        if (row.present === 1) return ['matched', 'Memenuhi syarat yang diperiksa dari data lokal.'];
        if (row.present === 0) return ['review', 'Perlu dicek: data lokal belum memenuhi syarat yang diperiksa.'];
        return ['unknown', 'Ketersediaan catatan tidak dapat diperiksa.'];
    }
    if (mode === 'code') {
        const expected = row.code_expected;
        const actual = typeof row.code_actual === 'string' ? row.code_actual.trim() : '';
        if (!expected) return ['unknown', 'Kode satker resmi tidak tersedia dari EIS untuk periode ini.'];
        if (!actual) return ['unknown', 'Nomor perkara tidak memuat kode satker.'];
        return [actual === expected ? 'matched' : 'review', `Kode pada nomor: ${actual} · kode EIS: ${expected}.`];
    }
    if (mode === 'mediation') {
        const hasil = typeof row.hasil_mediasi === 'string' ? row.hasil_mediasi.trim().toUpperCase() : '';
        const agreed = typeof row.mediasi_berhasil === 'string' && !row.mediasi_berhasil.startsWith('0000');
        if (['Y', 'Y1', 'Y2'].includes(hasil) || agreed) return ['matched', `Hasil mediasi ${hasil || 'berhasil'}.`];
        if (hasil === 'T') return ['review', 'Mediasi selesai tanpa kesepakatan (kode T).'];
        if (!hasil) return ['unknown', 'Hasil mediasi belum diisi di SIPP.'];
        return ['unknown', `Kode hasil mediasi ${hasil} belum dipetakan.`];
    }
    if (mode === 'version') {
        const installed = row.value == null ? '' : String(row.value).trim();
        const expected = row.version_expected;
        const latest = row.version_latest;
        if (!installed) return ['unknown', 'Versi SIPP terpasang tidak tercatat di basis data satker.'];
        if (!expected) return ['unknown', `Versi terpasang ${installed}; versi yang dinilai EIS tidak tersedia.`];
        const note = `Versi terpasang ${installed} · EIS ${expected}${latest ? ` · terbaru ${latest}` : ''}.`;
        return [installed === expected ? 'matched' : 'review', note];
    }

    if (mode === 'date24_or_present') {
        const start = parseLocalTimestamp(row.event_at);
        const end = parseLocalTimestamp(row.comparison_at);
        if (!start) return ['unknown', 'Tanggal acuan tidak tercatat.'];
        if (!end) return ['matched', 'Tanggal penetapan tercatat; waktu input tidak tersimpan di SIPP dan tidak dinilai EIS.'];
        const elapsed = (end.date - start.date) / day;
        if (elapsed < 0) return ['unknown', 'Waktu input lebih awal dari tanggal acuan.'];
        return [elapsed <= 1 ? 'matched' : 'review', `Tercatat ${elapsed} hari setelah tanggal acuan.`];
    }

    // Mode berbasis tanggal.
    const start = parseLocalTimestamp(row.event_at), end = parseLocalTimestamp(row.comparison_at);
    if (!start || !end) return ['unknown', 'Tanggal atau waktu pembanding belum lengkap.'];
    if (end.date < start.date) {
        if (mode === 'date24_early') return ['matched', 'Diinput atau diunggah sebelum tanggal acuan (dihitung sesuai di EIS).'];
        return ['unknown', 'Urutan tanggal tidak konsisten.'];
    }
    if (start.precise && end.precise && end.time < start.time) {
        if (mode === 'date24_early') return ['matched', 'Tercatat sebelum waktu acuan (dihitung sesuai di EIS).'];
        return ['unknown', 'Urutan tanggal tidak konsisten.'];
    }
    if (mode === 'months') {
        const limit = Number(row.limit_months);
        if (!Number.isInteger(limit) || limit < 0) return ['unknown', 'Batas bulan tidak diketahui untuk indikator ini.'];
        const from = new Date(start.date);
        const deadline = Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + limit, from.getUTCDate());
        const elapsedDays = (end.date - start.date) / day;
        return [end.date > deadline ? 'review' : 'matched', `${elapsedDays} hari · batas ${limit} bulan kalender.`];
    }
    if (mode === 'businessdays') {
        const limit = Number(row.limit_days);
        if (!Number.isInteger(limit) || limit < 0) return ['unknown', 'Batas hari kerja tidak diketahui.'];
        let count = 0;
        for (let cursor = start.date + day; cursor <= end.date; cursor += day) {
            const weekday = new Date(cursor).getUTCDay();
            if (weekday !== 0 && weekday !== 6) count++;
        }
        return [count > limit ? 'review' : 'matched', `${count} hari kerja · batas ${limit} hari kerja (libur nasional tidak dihitung).`];
    }
    if (mode === 'days') {
        const limit = Number(row.limit_days);
        if (row.limit_days == null || !Number.isInteger(Number(row.limit_days)) || Number(row.limit_days) < 0) return ['unknown', 'Batas hari tidak diketahui untuk peristiwa ini.'];
        const elapsed = (end.date - start.date) / day;
        return [elapsed > limit ? 'review' : 'matched', `${elapsed} hari kalender · batas ${limit} hari.`];
    }
    // Batas 1x24 jam diukur pada tanggal: selisih hari kalender <= 1 dianggap tepat waktu.
    // Jam pada SIPP sering tidak tersimpan, sehingga rentang jam tidak dipakai sebagai penentu.
    const elapsedDays = (end.date - start.date) / day;
    if (elapsedDays <= 1) return ['matched', `Tercatat ${elapsedDays} hari setelah tanggal acuan (batas 1×24 jam).`];
    return ['review', `${elapsedDays} hari setelah tanggal acuan; melewati batas 1×24 jam.`];
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
                if (!Array.isArray(data.rows) || typeof data.basis !== 'string' || !['days', 'date24', 'date24_early', 'presence', 'evidence', 'months', 'businessdays', 'code', 'mediation', 'version', 'date24_or_present'].includes(data.mode)) {
                    throw new TypeError('Invalid compliance response');
                }
                resolve(data);
            } catch (e) { reject(e); }
        });
    });
}

async function getLocalCompliance(db, key, period, asOf, expect) {
    const sync = asOf || db.prepare('SELECT MAX(sipp_last_sync) AS at FROM perkara WHERE sipp_synced = 1').get()?.at;
    const cutoff = /^\d{4}-\d{2}-\d{2}/.test(String(sync ?? '')) ? String(sync).slice(0, 10) : null;
    const data = await readCompliance(key, period, cutoff);
    const localCase = db.prepare('SELECT id FROM perkara WHERE nomor_perkara = ? AND sipp_synced = 1');
    const counts = { matched: 0, review: 0, unknown: 0 };
    let nonPdfCount = 0;
    const snapshotDay = expect?.snapshotAt ? String(expect.snapshotAt).slice(0, 10) : null;
    const rows = data.rows.map(row => {
        const merged = expect && typeof expect === 'object' ? { ...row, ...expect } : row;
        // Snapshot EIS diambil pada waktu tertentu: peristiwa sesudahnya belum masuk angka resmi.
        const laterThanSnapshot = snapshotDay && typeof row.comparison_at === 'string'
            && row.comparison_at.slice(0, 10) >= snapshotDay;
        const [state, baseNote] = laterThanSnapshot
            ? ['unknown', `Tanggal peristiwa sama atau setelah snapshot EIS diambil (${snapshotDay}); belum pasti masuk angka resmi.`]
            : assessCompliance(data.mode, merged);
        const trimmedPath = typeof row.doc_path === 'string' ? row.doc_path.trim() : '';
        const ext = docExt(trimmedPath);
        const docName = trimmedPath ? path.posix.basename(trimmedPath.replaceAll('\\', '/')) : null;
        const nonPdf = state === 'matched' && ext && ext !== '.pdf' ? ext : null;
        if (nonPdf) nonPdfCount++;
        const note = nonPdf ? `Unggahan tercatat di SIPP, tetapi format bukan PDF (${nonPdf}).` : baseNote;
        counts[state]++;
        return {
            nomorPerkara: row.nomor_perkara ?? (data.mode === 'version' ? 'Tingkat satuan kerja' : null),
            eventAt: row.event_at || null, comparisonAt: row.comparison_at || null,
            eventLabel: row.event_label ?? 'Tanggal acuan', comparisonLabel: row.comparison_label ?? 'Tanggal pembanding',
            present: row.present ?? null, flagText: row.flag_text ?? null,
            docExt: ext, docName, nonPdf, docPath: nonPdf ? trimmedPath : null,
            state, note
        };
    });
    return {
        status: 'partial', findings: [],
        reason: cutoff ? `${data.basis} Data dibatasi sampai ${cutoff} sesuai sinkron terakhir.` : data.basis,
        context: { kind: 'compliance', basis: data.basis, cutoff, rows, counts, nonPdfCount, checkedAt: new Date().toISOString() }
    };
}

module.exports = { complianceKey, localAudit, assessCompliance, docExt, getLocalCompliance };
