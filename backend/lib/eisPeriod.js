const jakartaCalendar = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});

function currentEisDay(now = new Date()) {
    const parts = Object.fromEntries(jakartaCalendar.formatToParts(new Date(now)).map(({ type, value }) => [type, value]));
    return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
}

function currentEisPeriod(now) {
    return currentEisDay(now).slice(0, 7);
}
function parseEisPeriod(period) {
    if (typeof period !== 'string' || period.length !== 7 || !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period) || period.startsWith('0000')) {
        throw new RangeError('Periode EIS harus berbentuk YYYY-MM.');
    }
    const [year, month] = period.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const lastDay = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    return { year, month, start: `${period}-01`, end: `${period}-${lastDay}` };
}

module.exports = { currentEisDay, currentEisPeriod, parseEisPeriod };
