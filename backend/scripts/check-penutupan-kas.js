const assert = require('assert')
const { generatePenutupanKasRtf } = require('../services/kasirRtfService')

const payload = {
  bulanNama: 'Mei',
  tahun: 2026,
  tanggalPemeriksaan: '2026-05-13',
  tanggalBank: '2026-05-12',
  saldoBank: 4444000,
  materai: 10000,
  penjelasan: 'SELISIH TEST KHUSUS',
  kasTunaiRows: [
    { nominal: 100000, jumlah: 6 },
    { nominal: 50000, jumlah: 1 },
    { nominal: 20000, jumlah: 2 },
    { nominal: 10000, jumlah: 3 },
    { nominal: 5000, jumlah: 4 },
    { nominal: 2000, jumlah: 5 },
    { nominal: 1000, jumlah: 6 },
    { nominal: 500, jumlah: 7 },
    { nominal: 200, jumlah: 8 },
    { nominal: 100, jumlah: 9 }
  ],
  bukuRows: [
    { saldoLalu: 1111000, penerimaan: 2222000, pengeluaran: 333000 },
    { saldoLalu: 444000, penerimaan: 555000, pengeluaran: 66000 },
    { saldoLalu: 777000, penerimaan: 888000, pengeluaran: 99000 }
  ]
}

const rtf = generatePenutupanKasRtf(payload).toString('utf8')

function count(text) {
  return rtf.split(text).length - 1
}

const expectedKasTunai = 762000
const expectedPembukuan = 5499000
const expectedSaldoKas = expectedKasTunai + payload.saldoBank + payload.materai

assert(count('MEI 2026') >= 1, 'judul bulan/tahun harus terganti')
assert(count('13 Mei 2026') >= 1, 'tanggal pemeriksaan harus terganti')
assert(count('SELISIH TEST KHUSUS') >= 2, 'penjelasan harus masuk ke halaman utama dan lampiran')
assert(count('Tidak Ada Selisih') === 0, 'template penjelasan lama harus terganti semua')
assert(count('762.000,-') >= 2, 'total kas tunai harus masuk ke ringkasan dan lampiran')
assert(count('5.499.000,-') >= 1, 'saldo pembukuan harus dihitung dari rincian buku')
assert(count('5.216.000,-') >= 1, 'saldo kas harus menghitung kas tunai + bank + materai')
assert(count('283.000,-') >= 1, 'selisih harus dihitung dari pembukuan - kas')
assert(count('100.000,-') >= 1, 'pecahan 100.000 harus muncul di lampiran')
assert(count('6 lembar') >= 1, 'jumlah lembar pecahan harus masuk')
assert(count('100,-') >= 1, 'pecahan kelipatan 100 harus didukung')
assert(count('9 Koin') >= 1, 'jumlah koin pecahan 100 harus masuk')

console.log('[check-penutupan-kas] passed')
