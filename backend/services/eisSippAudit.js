const { execFile } = require('node:child_process');
const path = require('node:path');
const { currentEisDay } = require('../lib/eisPeriod');

const readerPath = path.join(__dirname, '../scripts/read-sipp-db.py');
const witnessChecks = [
    ['Nama', row => !!row.nama?.trim()],
    ['Jenis saksi', row => !!String(row.jenis_saksi ?? '').trim() && String(row.jenis_saksi).trim() !== '0'],
    ['Urutan', row => !!row.has_order],
    ['Pihak yang mengajukan', row => !!row.has_side],
    ['Jenis pihak', row => !!row.has_party_type],
    ['Relasi data pihak', row => !!row.has_party],
    ['Alamat terisi', row => !!row.has_address]
];

function readMonthlyAudit(kind, period) {
    return new Promise((resolve, reject) => {
        execFile('python', [readerPath, '--eis-audit', kind, period], {
            encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024
        }, (error, stdout) => {
            if (error) return reject(Object.assign(new Error('Pembacaan audit SIPP lokal gagal.'), { code: 'SIPP_AUDIT_READ' }));
            try {
                const rows = JSON.parse(stdout);
                if (kind === 'witness' ? !Array.isArray(rows?.entries) || !Array.isArray(rows?.hearings) : !Array.isArray(rows)) {
                    throw new TypeError('Invalid audit response');
                }
                resolve(rows);
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
}

async function getMonthlySippAudit(db, kind, period, read = readMonthlyAudit, now = new Date()) {
    const source = await read(kind, period);
    const today = currentEisDay(now);
    const local = db.prepare('SELECT id FROM perkara WHERE nomor_perkara = ? AND sipp_synced = 1');
    const caseLink = row => ({ sourceId: row.id, id: local.get(row.nomor_perkara)?.id ?? null, nomorPerkara: row.nomor_perkara });
    const rows = (kind === 'witness' ? source.entries : source).map(row => {
        const common = caseLink(row);
        if (kind === 'witness') {
            const missing = witnessChecks.filter(([, check]) => !check(row)).map(([label]) => label);
            return { ...common, nama: row.nama, jenisSaksi: row.jenis_saksi, tanggalInput: row.diinput_tanggal,
                missing, qaCount: Number(row.qa_count), qaComplete: Number(row.qa_complete) };
        }
        const tanggal = row.tanggal_sidang.slice(0, 10);
        const trimmedPath = typeof row.doc_path === 'string' ? row.doc_path.trim() : '';
        const extMatch = /\.([a-z0-9]{2,5})$/i.exec(trimmedPath);
        const docExt = extMatch ? `.${extMatch[1].toLowerCase()}` : null;
        const docName = trimmedPath ? path.posix.basename(trimmedPath.replaceAll('\\', '/')) : null;
        const nonPdf = row.upload_state === 'registered' && docExt && docExt !== '.pdf' ? docExt : null;
        return { ...common, tanggal, agenda: row.agenda, uploadState: row.upload_state, docExt, docName, nonPdf,
            scheduleState: tanggal > today ? 'future' : tanggal === today ? 'today' : 'past',
            hasTemplateContent: !!row.has_template_content, hasHearingDetail: !!row.has_hearing_detail,
            hasTemplateQa: !!row.has_template_qa, hasTemplateClosing: !!row.has_template_closing };
    });
    const summary = kind === 'witness' ? {
        total: rows.length, cases: new Set(rows.map(row => row.nomorPerkara)).size,
        incomplete: rows.filter(row => row.missing.length).length,
        noQa: rows.filter(row => row.qaCount === 0).length,
        incompleteQa: rows.filter(row => row.qaCount > row.qaComplete).length
    } : {
        total: rows.length, registered: rows.filter(row => row.uploadState === 'registered').length,
        nonPdf: rows.filter(row => row.nonPdf).length,
        empty: rows.filter(row => row.uploadState === 'empty').length,
        unknown: rows.filter(row => row.uploadState === 'unknown').length,
        content: rows.filter(row => row.hasTemplateContent || row.hasHearingDetail || row.hasTemplateQa || row.hasTemplateClosing).length
    };
    const hearings = kind === 'witness' ? source.hearings.map(row => ({
        ...caseLink(row), tanggal: row.tanggal_sidang.slice(0, 10), agenda: row.agenda,
        witnessCount: Number(row.witness_count), recorded: Number(row.named_count) > 0,
        upcoming: row.tanggal_sidang.slice(0, 10) > today
    })) : null;
    const cohort = hearings && {
        rows: hearings.sort((a, b) => Number(a.recorded) - Number(b.recorded)), total: hearings.length,
        recorded: hearings.filter(row => row.recorded).length
    };
    return {
        status: 'partial', findings: [],
        reason: kind === 'witness'
            ? 'Pembanding lokal memakai jadwal dengan agenda yang menyebut saksi dan memeriksa apakah perkaranya punya catatan saksi bernama. Ini bukan daftar resmi Badilum.'
            : 'Berdasarkan tanggal sidang. Unggahan tercatat jika SIPP lokal menyimpan rujukan berkas BAS; keberadaan fisik berkas dan penerimaan oleh MIS tidak diperiksa.',
        context: { kind, rows, summary, cohort, checkedAt: new Date().toISOString() }
    };
}

module.exports = { getMonthlySippAudit };
