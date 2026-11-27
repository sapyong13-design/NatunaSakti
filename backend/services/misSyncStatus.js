const DEFAULT_MIS_URL = (process.env.MIS_BASE_URL || 'http://192.168.1.2/mis').replace(/\/+$/, '');
const KNOWN_BUG_TABLES = new Set(['perkara_putusan_pemberitahuan_putusan']);

const normalize = (value) => String(value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');

const INDICATOR_MIS_TABLES = new Map([
    ['pendaftaran perkara', ['perkara', 'perkara_pihak1', 'perkara_pihak2']],
    ['publikasi pihak', ['perkara', 'perkara_pihak1', 'perkara_pihak2']],
    ['kesesuaian kode satker nomor perkara', ['perkara']],
    ['pencatatan barang bukti', ['perkara_barang_bukti']],
    ['penetapan hakim', ['perkara_hakim_pn']],
    ['penginputan penetapan majelis/hakim', ['perkara_hakim_pn']],
    ['penetapan panitera pengganti', ['perkara_panitera_pn']],
    ['penginputan penunjukan panitera pengganti', ['perkara_panitera_pn']],
    ['penetapan jurusita/jurusita pengganti', ['perkara_jurusita']],
    ['penginputan penetapan jurusita/jurusita pengganti', ['perkara_jurusita']],
    ['penetapan hari sidang pertama', ['perkara_penetapan_hari_sidang']],
    ['penginputan penetapan hari sidang', ['perkara_penetapan_hari_sidang']],
    ['penginputan tuntutan', ['perkara_penuntutan']],
    ['e-document tuntutan', ['perkara_penuntutan']],
    ['penginputan putusan akhir', ['perkara_putusan', 'perkara_putusan_terdakwa']],
    ['e-document putusan akhir/penetapan', ['perkara_putusan', 'dirput_dokumen']],
    ['unggah putusan akhir', ['perkara_putusan', 'dirput_dokumen']],
    ['pelaksanaan bht', ['perkara_putusan']],
    ['tanggal putusan dan tanggal sidang terakhir', ['perkara_putusan', 'perkara_jadwal_sidang']],
    ['penginputan minutasi', ['perkara_proses', 'perkara_putusan']],
    ['pelaksanaan minutasi', ['perkara_proses', 'perkara_putusan']],
    ['penginputan permohonan banding', ['perkara_banding']],
    ['pengiriman berkas banding', ['perkara_banding', 'perkara_banding_detil']],
    ['penginputan permohonan kasasi', ['perkara_kasasi']],
    ['pengiriman berkas kasasi', ['perkara_kasasi', 'perkara_kasasi_detil']],
    ['penginputan permohonan peninjauan kembali', ['perkara_pk']],
    ['pengiriman berkas peninjauan kembali', ['perkara_pk', 'perkara_pk_detil']],
    ['pemberitahuan putusan/penentapan', ['perkara_putusan_pemberitahuan_putusan']],
    ['jangka waktu pelaksanaan delegasi masuk', ['delegasi_masuk', 'delegasi_proses_masuk']],
    ['penginputan data pelaksanaan delegasi', ['delegasi_masuk', 'delegasi_proses_masuk', 'delegasi_masuk_riwayat']],
    ['kepatuhan penundaan jadwal sidang', ['perkara_jadwal_sidang']],
    ['dokumen elektronik berita acara sidang', ['perkara_jadwal_sidang']],
    ['agenda sidang terakhir', ['perkara_jadwal_sidang']],
    ['penginputan penetapan perpanjangan penahanan', ['penahanan_terdakwa']],
    ['penahanan', ['penahanan_terdakwa']],
    ['tanda tangan elektronik salinan putusan perkara perdata', ['dirput_dokumen', 'perkara_putusan']],
    ['tanda tangan elektronik salinan putusan perkara pidana', ['dirput_dokumen', 'perkara_putusan']],
    ['dokumen elektronik putusan anonimisasi', ['dirput_dokumen', 'perkara_putusan']],
    ['pencatatan saksi', ['perkara_keterangan_saksi', 'perkara_jadwal_sidang']],
    ['pelaksanaan mediasi', ['perkara_mediasi', 'perkara_jadwal_mediasi']],
    ['data lapor mediasi', ['perkara_mediasi', 'perkara_jadwal_mediasi']],
    ['data diversi', ['perkara_diversi', 'diversi_register']],
    ['dokumen elektronik relaas panggilan sidang pertama', ['perkara_pelaksanaan_relaas']],
    ['dokumen elektronik rencana persidangan (court callendar)', ['perkara_court_calendar', 'perkara_edoc_calendar']],
    ['dokumen elektronik rencana persidangan (court calendar)', ['perkara_court_calendar', 'perkara_edoc_calendar']],
    ['sisa biaya perkara tk pertama', ['perkara_biaya']],
    ['sisa biaya perkara tingkat pertama', ['perkara_biaya']],
    ['pengarsipan perkara', ['arsip', 'arsip_pinjam']],
    ['rilis versi sipp', ['sys_config']],
    ['verifikasi dokumen elektronik elitigasi', ['perkara_efiling', 'perkara_efiling_id']]
]);

function stripHtml(html) {
    return String(html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseIntFormatted(html) {
    const digits = stripHtml(html).replace(/[^\d]/g, '');
    return digits ? Number.parseInt(digits, 10) : 0;
}

function parseMisTableRows(payload) {
    if (!payload || !Array.isArray(payload.data)) {
        throw new Error('Respons Sinkronisasi/data MIS tidak valid.');
    }

    const tables = payload.data.map((row) => {
        const tabel = stripHtml(row[1]);
        const lokal = parseIntFormatted(row[2]);
        const badilum = parseIntFormatted(row[3]);
        const diff = lokal - badilum;
        const knownBug = KNOWN_BUG_TABLES.has(tabel);
        let state = 'ok';
        if (knownBug && diff !== 0) state = 'known_bug';
        else if (diff > 0) state = 'behind';
        else if (diff < 0) state = 'excess';

        return {
            no: parseIntFormatted(row[0]),
            tabel,
            lokal,
            badilum,
            diff,
            state,
            knownBug,
            mulai: stripHtml(row[4]),
            selesai: stripHtml(row[5])
        };
    });

    const summary = {
        total: tables.length,
        ok: tables.filter((t) => t.state === 'ok').length,
        behind: tables.filter((t) => t.state === 'behind').length,
        excess: tables.filter((t) => t.state === 'excess').length,
        knownBug: tables.filter((t) => t.state === 'known_bug').length
    };

    const indicatorMap = Object.fromEntries(
        Array.from(INDICATOR_MIS_TABLES.entries())
    );

    return {
        status: 'ready',
        checkedAt: new Date().toISOString(),
        remoteStatus: String(payload.remote_status || 'unknown'),
        summary,
        tables,
        indicatorMap
    };
}

async function fetchMisSyncStatus({ baseUrl = DEFAULT_MIS_URL, timeoutMs = 8000 } = {}) {
    const url = `${baseUrl}/Sinkronisasi/data`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': `${baseUrl}/sinkronisasi`
            },
            body: 'draw=1',
            signal: AbortSignal.timeout(timeoutMs)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} dari server MIS`);
        }
        const payload = await response.json();
        return parseMisTableRows(payload);
    } catch (error) {
        return {
            status: 'unavailable',
            checkedAt: new Date().toISOString(),
            remoteStatus: 'unreachable',
            error: error?.name === 'TimeoutError'
                ? 'Permintaan ke MIS lokal melebihi batas waktu.'
                : (error?.message || 'Gagal membaca status MIS lokal.'),
            summary: null,
            tables: [],
            indicatorMap: Object.fromEntries(Array.from(INDICATOR_MIS_TABLES.entries()))
        };
    }
}

module.exports = {
    fetchMisSyncStatus,
    parseMisTableRows,
    INDICATOR_MIS_TABLES,
    KNOWN_BUG_TABLES,
    normalize
};
