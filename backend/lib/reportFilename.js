const BULAN_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const MINGGU_ROMAN = ['I', 'II', 'III', 'IV', 'V'];

function normalizeExtension(extension) {
    return String(extension || '').replace(/^\./, '').toLowerCase();
}

function normalizeJenis(jenis) {
    return String(jenis || '').trim().toUpperCase();
}

function buildMonthlyReportBase({ jenis, bulan, tahun }) {
    const bulanNumber = Number(bulan);
    const bulanNama = BULAN_NAMES[bulanNumber - 1];
    if (!bulanNama) throw new Error(`Bulan tidak valid: ${bulan}`);
    return `${bulanNumber}. AKURASI ${normalizeJenis(jenis)} ${bulanNama.toUpperCase()} ${tahun}`;
}

function buildMonthlyReportFilename({ jenis, bulan, tahun, extension }) {
    const ext = normalizeExtension(extension);
    if (!ext) throw new Error('Extension wajib diisi');
    return `${buildMonthlyReportBase({ jenis, bulan, tahun })}.${ext}`;
}

function getWeeklyRomanFromStart(start) {
    const startDate = start instanceof Date ? start : new Date(start);
    const mingguKe = Math.min(5, Math.ceil(startDate.getDate() / 7));
    return MINGGU_ROMAN[mingguKe - 1];
}

function buildWeeklyReportFilename({ jenis, start, tahun, extension }) {
    const startDate = start instanceof Date ? start : new Date(start);
    const bulan = startDate.getMonth() + 1;
    const base = buildMonthlyReportBase({ jenis, bulan, tahun });
    const ext = normalizeExtension(extension);
    if (!ext) throw new Error('Extension wajib diisi');
    return `${base} MINGGU ${getWeeklyRomanFromStart(startDate)}.${ext}`;
}

module.exports = {
    buildMonthlyReportFilename,
    buildWeeklyReportFilename
};
