const assert = require('assert')
const PizZip = require('pizzip')
const { generateRekapExcelXlsx } = require('../services/kasirExcelService')

const workbook = generateRekapExcelXlsx({
  bulanNama: 'Mei',
  tahun: 2026,
  rows: [
    { tanggal: '2026-05-13', buku: 'Buku Induk Keuangan Perkara', kategori: 'PNBP', uraian: 'PNBP', penerimaan: 30000, pengeluaran: 0 },
    { tanggal: '2026-05-13', buku: 'Buku Induk Keuangan Perkara', kategori: 'Biaya Pendaftaran', uraian: 'Biaya Pendaftaran', penerimaan: 50000, pengeluaran: 0 },
    { tanggal: '2026-05-13', buku: 'Buku Induk Keuangan Perkara', kategori: 'Materai', uraian: 'Materai', penerimaan: 10000, pengeluaran: 0 },
    { tanggal: '2026-05-13', buku: 'Buku Induk Keuangan Perkara', kategori: 'Biaya Panggilan', uraian: 'Biaya Panggilan custom', penerimaan: 123000, pengeluaran: 0 }
  ]
})

assert(Buffer.isBuffer(workbook), 'workbook harus berupa Buffer')
assert.strictEqual(workbook.slice(0, 2).toString('utf8'), 'PK', 'output harus xlsx zip')

const zip = new PizZip(workbook)
const workbookXml = zip.file('xl/workbook.xml').asText()
const sheet1 = zip.file('xl/worksheets/sheet1.xml').asText()
const sheet2 = zip.file('xl/worksheets/sheet2.xml').asText()
const sheet3 = zip.file('xl/worksheets/sheet3.xml').asText()

assert(workbookXml.includes('Sheet 1 Input'), 'workbook harus punya Sheet 1 Input')
assert(workbookXml.includes('Sheet 2 Laporan'), 'workbook harus punya Sheet 2 Laporan')
assert(workbookXml.includes('Sheet 3 Rekap'), 'workbook harus punya Sheet 3 Rekap')
assert(sheet1.includes('PNBP'), 'sheet 1 harus memuat kategori PNBP')
assert(sheet1.includes('<v>30000</v>'), 'sheet 1 harus memuat PNBP 30000')
assert(sheet1.includes('Biaya Pendaftaran'), 'sheet 1 harus memuat biaya pendaftaran')
assert(sheet1.includes('<v>50000</v>'), 'sheet 1 harus memuat biaya pendaftaran 50000')
assert(sheet1.includes('Materai'), 'sheet 1 harus memuat materai')
assert(sheet1.includes('<v>10000</v>'), 'sheet 1 harus memuat materai 10000')
assert(sheet1.includes('Biaya Panggilan custom'), 'sheet 1 harus memuat biaya panggilan custom')
assert(sheet2.includes('Biaya Panggilan custom'), 'sheet 2 harus mengikuti sheet 1')
assert(sheet3.includes('SUMIF'), 'sheet 3 harus memakai formula hitung sendiri')
assert(sheet3.includes('PNBP'), 'sheet 3 harus punya rekap PNBP')

console.log('[check-rekap-excel] passed')
