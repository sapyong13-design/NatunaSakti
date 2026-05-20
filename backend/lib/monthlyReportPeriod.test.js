const assert = require('assert');
const {
    resolveMonthlyReportPeriod,
    isDatePartsWithinPeriod
} = require('./monthlyReportPeriod');

const defaultMay = resolveMonthlyReportPeriod(5, 2026);
assert.strictEqual(defaultMay.startIso, '2026-05-01');
assert.strictEqual(defaultMay.endIso, '2026-05-29');
assert.strictEqual(defaultMay.endDay, 29);

const cutoffMay = resolveMonthlyReportPeriod(5, 2026, '2026-05-28');
assert.strictEqual(cutoffMay.startIso, '2026-05-01');
assert.strictEqual(cutoffMay.endIso, '2026-05-28');
assert.strictEqual(cutoffMay.endDay, 28);
assert.strictEqual(cutoffMay.dayName, 'Kamis');

assert.strictEqual(isDatePartsWithinPeriod({ day: 28, month: 5, year: 2026 }, cutoffMay), true);
assert.strictEqual(isDatePartsWithinPeriod({ day: 29, month: 5, year: 2026 }, cutoffMay), false);
assert.strictEqual(isDatePartsWithinPeriod({ day: 1, month: 6, year: 2026 }, cutoffMay), false);

assert.throws(
    () => resolveMonthlyReportPeriod(5, 2026, '2026-06-01'),
    /tanggal akhir harus berada di bulan dan tahun laporan/
);

console.log('monthlyReportPeriod tests passed');
