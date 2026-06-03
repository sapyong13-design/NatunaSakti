const BULAN_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
const MINGGU_ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const { isHoliday } = require('./holidays');

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

function parseDateLocal(value) {
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(value);
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function formatIsoDateLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function isNonWorkingDay(date) {
    const day = date.getDay();
    return day === 0 || day === 6 || isHoliday(formatIsoDateLocal(date));
}

function nextWorkday(date) {
    let next = new Date(date);
    while (isNonWorkingDay(next)) next = addDays(next, 1);
    return next;
}

function previousWorkday(date) {
    let prev = new Date(date);
    while (isNonWorkingDay(prev)) prev = addDays(prev, -1);
    return prev;
}

function workWeekEnd(date) {
    return previousWorkday(addDays(date, 5 - date.getDay()));
}

function getWeeklyRomanFromWorkDate(date) {
    const target = parseDateLocal(date);
    const monthStart = new Date(target.getFullYear(), target.getMonth(), 1);
    const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0);
    let cursor = nextWorkday(monthStart);
    let week = 0;

    while (cursor <= monthEnd && week < MINGGU_ROMAN.length) {
        const end = workWeekEnd(cursor);
        if (end >= cursor) {
            week++;
            if (target >= cursor && target <= end) return MINGGU_ROMAN[week - 1];
        }
        cursor = nextWorkday(addDays(addDays(cursor, 5 - cursor.getDay()), 1));
    }

    return getWeeklyRomanFromStart(target);
}

function buildWeeklyReportFilename({ jenis, start, end, tahun, extension }) {
    const startDate = parseDateLocal(start);
    const bulan = startDate.getMonth() + 1;
    const base = buildMonthlyReportBase({ jenis, bulan, tahun });
    const ext = normalizeExtension(extension);
    if (!ext) throw new Error('Extension wajib diisi');
    const startRoman = getWeeklyRomanFromWorkDate(startDate);
    const endRoman = end ? getWeeklyRomanFromWorkDate(end) : startRoman;
    const mingguLabel = startRoman === endRoman ? startRoman : `${startRoman}-${endRoman}`;
    return `${base} MINGGU ${mingguLabel}.${ext}`;
}

module.exports = {
    buildMonthlyReportFilename,
    buildWeeklyReportFilename
};
