const HOLIDAYS_2026 = [
    { tanggal: '2026-01-01', nama: 'Tahun Baru 2026 Masehi', tipe: 'libur' },
    { tanggal: '2026-01-16', nama: 'Isra Mikraj Nabi Muhammad saw.', tipe: 'libur' },
    { tanggal: '2026-02-16', nama: 'Cuti Bersama Tahun Baru Imlek', tipe: 'cuti' },
    { tanggal: '2026-02-17', nama: 'Tahun Baru Imlek 2577 Kongzili', tipe: 'libur' },
    { tanggal: '2026-03-18', nama: 'Cuti Bersama Hari Suci Nyepi', tipe: 'cuti' },
    { tanggal: '2026-03-19', nama: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', tipe: 'libur' },
    { tanggal: '2026-03-20', nama: 'Cuti Bersama Idulfitri', tipe: 'cuti' },
    { tanggal: '2026-03-21', nama: 'Idulfitri 1447 H', tipe: 'libur' },
    { tanggal: '2026-03-22', nama: 'Idulfitri 1447 H', tipe: 'libur' },
    { tanggal: '2026-03-23', nama: 'Cuti Bersama Idulfitri', tipe: 'cuti' },
    { tanggal: '2026-03-24', nama: 'Cuti Bersama Idulfitri', tipe: 'cuti' },
    { tanggal: '2026-04-03', nama: 'Wafat Yesus Kristus', tipe: 'libur' },
    { tanggal: '2026-04-05', nama: 'Kebangkitan Yesus Kristus (Paskah)', tipe: 'libur' },
    { tanggal: '2026-05-01', nama: 'Hari Buruh Internasional', tipe: 'libur' },
    { tanggal: '2026-05-14', nama: 'Kenaikan Yesus Kristus', tipe: 'libur' },
    { tanggal: '2026-05-15', nama: 'Cuti Bersama Kenaikan Yesus Kristus', tipe: 'cuti' },
    { tanggal: '2026-05-27', nama: 'Iduladha 1447 H', tipe: 'libur' },
    { tanggal: '2026-05-28', nama: 'Cuti Bersama Iduladha', tipe: 'cuti' },
    { tanggal: '2026-05-31', nama: 'Hari Raya Waisak 2570 BE', tipe: 'libur' },
    { tanggal: '2026-06-01', nama: 'Hari Lahir Pancasila', tipe: 'libur' },
    { tanggal: '2026-06-16', nama: '1 Muharam Tahun Baru Islam 1448 H', tipe: 'libur' },
    { tanggal: '2026-08-17', nama: 'Proklamasi Kemerdekaan', tipe: 'libur' },
    { tanggal: '2026-08-25', nama: 'Maulid Nabi Muhammad saw.', tipe: 'libur' },
    { tanggal: '2026-12-24', nama: 'Cuti Bersama Kelahiran Yesus Kristus', tipe: 'cuti' },
    { tanggal: '2026-12-25', nama: 'Kelahiran Yesus Kristus', tipe: 'libur' }
]

const HOLIDAY_MAP = Object.fromEntries(HOLIDAYS_2026.map(holiday => [holiday.tanggal, holiday]))

function isHoliday(isoDate) {
    return Boolean(HOLIDAY_MAP[isoDate])
}

module.exports = { HOLIDAYS_2026, HOLIDAY_MAP, isHoliday }
