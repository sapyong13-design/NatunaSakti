const HARI_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function toIsoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(value) {
    if (!value || typeof value !== 'string') return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

function resolveMonthlyReportPeriod(bulan, tahun, endIso = '') {
    const month = Number(bulan);
    const year = Number(tahun);
    if (!month || month < 1 || month > 12) throw new Error('bulan harus 1-12');
    if (!year || year < 2020 || year > 2100) throw new Error('tahun tidak valid');

    const startDate = new Date(year, month - 1, 1);
    const endDate = endIso ? parseIsoDate(endIso) : new Date(year, month, 0);

    if (!endDate) throw new Error('tanggal akhir tidak valid');
    if (endDate.getFullYear() !== year || endDate.getMonth() !== month - 1) {
        throw new Error('tanggal akhir harus berada di bulan dan tahun laporan');
    }
    if (!endIso) {
        while (endDate.getDay() === 0 || endDate.getDay() === 6) endDate.setDate(endDate.getDate() - 1);
    }

    return {
        startDate,
        endDate,
        startIso: toIsoDate(startDate),
        endIso: toIsoDate(endDate),
        endDay: endDate.getDate(),
        dayName: HARI_NAMES[endDate.getDay()]
    };
}

function isDatePartsWithinPeriod(parts, period) {
    if (!parts || !period) return false;
    const month = parts.month ?? (parts.mon != null ? parts.mon + 1 : null);
    const year = parts.year;
    const day = parts.day;
    if (!day || !month || !year) return false;

    const date = new Date(year, month - 1, day);
    return date >= period.startDate && date <= period.endDate;
}

module.exports = {
    resolveMonthlyReportPeriod,
    isDatePartsWithinPeriod,
    toIsoDate
};
