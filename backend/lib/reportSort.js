const MONTH_INDEX = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, maret: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    agu: 7, agustus: 7, aug: 7, august: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9, oct: 9, october: 9,
    nov: 10, november: 10,
    des: 11, desember: 11, dec: 11, december: 11
};

function parseRegisterDateSort(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        return year * 10000 + month * 100 + day;
    }

    const cleaned = dateStr
        .replace(/^[^,]+,\s*/, '')
        .replace(/\./g, '')
        .trim();
    const parts = cleaned.split(/\s+/);
    if (parts.length < 3) return null;

    const day = parseInt(parts[0], 10);
    const monKey = parts[1].toLowerCase();
    const mon = MONTH_INDEX[monKey] ?? MONTH_INDEX[monKey.slice(0, 3)];
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || mon === undefined || isNaN(year)) return null;

    return year * 10000 + (mon + 1) * 100 + day;
}

function compareRowsByRegisterDate(a, b) {
    const da = parseRegisterDateSort(a?.sipp_tanggal_register);
    const db = parseRegisterDateSort(b?.sipp_tanggal_register);
    if (da === null && db === null) return compareCaseNumbers(a, b);
    if (da === null) return 1;
    if (db === null) return -1;
    return (da - db) || compareCaseNumbers(a, b);
}

function parseCaseNumber(row) {
    const match = String(row?.nomor_perkara || '').match(/^\s*(\d+)/);
    if (!match) return null;
    return parseInt(match[1], 10);
}

function compareCaseNumbers(a, b) {
    const na = parseCaseNumber(a);
    const nb = parseCaseNumber(b);
    if (na === null && nb === null) {
        return String(a?.nomor_perkara || '').localeCompare(String(b?.nomor_perkara || ''));
    }
    if (na === null) return 1;
    if (nb === null) return -1;
    return (na - nb) || String(a?.nomor_perkara || '').localeCompare(String(b?.nomor_perkara || ''));
}

function sortRowsByRegisterDate(rows) {
    return [...rows].sort(compareRowsByRegisterDate);
}

module.exports = {
    parseRegisterDateSort,
    compareRowsByRegisterDate,
    compareCaseNumbers,
    sortRowsByRegisterDate
};
