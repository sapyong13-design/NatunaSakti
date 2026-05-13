const fs = require('fs')
const path = require('path')

const TEMPLATE_PATH = path.join(__dirname, '../templates/kasir/penutupan-kas.rtf')

function rtfEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
}

function money(value) {
  const n = Number(value) || 0
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0
  }).format(n) + ',-'
}

function dateParts(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) {
    return { weekday: '', dateText: '', month: '', year: '' }
  }

  return {
    weekday: d.toLocaleDateString('id-ID', { weekday: 'long' }),
    dateText: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    month: d.toLocaleDateString('id-ID', { month: 'long' }),
    year: String(d.getFullYear())
  }
}

function amountRun(value) {
  const text = money(value)
  const padding = ' '.repeat(Math.max(1, 18 - text.length))
  return `Rp. ${padding}${rtfEscape(text)}`
}

const DEFAULT_DENOMINATIONS = [
  { nominal: 100000, unit: 'lembar', type: 'Uang Kertas' },
  { nominal: 50000, unit: 'lembar', type: 'Uang Kertas' },
  { nominal: 20000, unit: 'lembar', type: 'Uang Kertas' },
  { nominal: 10000, unit: 'lembar', type: 'Uang Kertas' },
  { nominal: 5000, unit: 'lembar', type: 'Uang Kertas' },
  { nominal: 2000, unit: 'lembar', type: 'Uang Kertas' },
  { nominal: 1000, unit: 'lembar', type: 'Uang Kertas' },
  { nominal: 500, unit: 'Koin', type: 'Uang Logam' },
  { nominal: 200, unit: 'Koin', type: 'Uang Logam' },
  { nominal: 100, unit: 'Koin', type: 'Uang Logam' }
]

function normalizeKasTunaiRows(rows) {
  const byNominal = new Map(
    (Array.isArray(rows) ? rows : []).map(row => [Number(row.nominal) || 0, Number(row.jumlah) || 0])
  )

  return DEFAULT_DENOMINATIONS.map(item => {
    const jumlah = Math.max(0, Math.floor(byNominal.get(item.nominal) || 0))
    return {
      ...item,
      jumlah,
      total: item.nominal * jumlah
    }
  })
}

function totalKasTunai(payload) {
  return normalizeKasTunaiRows(payload.kasTunaiRows).reduce((sum, row) => sum + row.total, 0)
}

function replaceDateParagraph(rtf, payload) {
  const parts = dateParts(payload.tanggalPemeriksaan)
  const sentence = `Pada hari ${parts.weekday} tanggal ${parts.dateText} telah dilakukan penutupan dengan uraian sebagai berikut:`
  return rtf.replace(
    /Pada hari[\s\S]*?telah dilakukan penutupan dengan uraian sebagai berikut:/,
    rtfEscape(sentence)
  )
}

function replaceMonthYearLabels(rtf, payload) {
  const month = rtfEscape(payload.bulanNama || dateParts(payload.tanggalPemeriksaan).month)
  const year = rtfEscape(String(payload.tahun || dateParts(payload.tanggalPemeriksaan).year))

  return rtf
    .replace(/BULAN \}\{[\s\S]*?PADA PENGADILAN NEGERI/, `BULAN }{\\rtlch\\fcs1 \\af0 \\ltrch\\fcs0 \\b\\fs26 ${month.toUpperCase()} ${year}\\par PADA PENGADILAN NEGERI`)
    .replace(/Saldo awal bulan[\s\S]*?2026/g, match => {
      const prefix = match.match(/Saldo awal bulan/)?.[0] || 'Saldo awal bulan'
      return `${prefix} ${month} ${year}`
    })
}

function findNth(source, text, nth = 1) {
  let position = -1
  let searchFrom = 0

  for (let index = 0; index < nth; index += 1) {
    position = source.indexOf(text, searchFrom)
    if (position === -1) return -1
    searchFrom = position + text.length
  }

  return position
}

function replaceAmountsInRow(rtf, label, nth, amounts) {
  const labelPosition = findNth(rtf, label, nth)
  if (labelPosition === -1) return rtf

  const rowStart = rtf.lastIndexOf('\\trowd', labelPosition)
  const rowEndPosition = rtf.indexOf('\\row', labelPosition)
  if (rowStart === -1 || rowEndPosition === -1) return rtf

  const rowEnd = rowEndPosition + '\\row'.length
  let amountIndex = 0
  const row = rtf.slice(rowStart, rowEnd).replace(/:(?:(?!:)[\s\S])*?,-/g, (match) => {
    if (amountIndex >= amounts.length) return match
    const replacement = `: ${amountRun(amounts[amountIndex])}`
    amountIndex += 1
    return replacement
  })

  return rtf.slice(0, rowStart) + row + rtf.slice(rowEnd)
}

function replaceAmountsInTemplate(rtf, payload) {
  const rows = Array.isArray(payload.bukuRows) ? payload.bukuRows : []
  const saldoPembukuan = rows.reduce((sum, row) => {
    return sum + (Number(row.saldoLalu) || 0) + (Number(row.penerimaan) || 0) - (Number(row.pengeluaran) || 0)
  }, 0)
  const kasTunai = totalKasTunai(payload) || rows.reduce((sum, row) => sum + (Number(row.kas) || 0), 0)
  const saldoBank = Number(payload.saldoBank) || 0
  const materai = Number(payload.materai) || 0
  const saldoKas = kasTunai + saldoBank + materai
  const selisih = saldoPembukuan - saldoKas

  rows.slice(0, 3).forEach((row, index) => {
    const saldoLalu = Number(row.saldoLalu) || 0
    const penerimaan = Number(row.penerimaan) || 0
    const pengeluaran = Number(row.pengeluaran) || 0
    rtf = replaceAmountsInRow(rtf, 'Saldo awal bulan', index + 1, [
      saldoLalu,
      penerimaan,
      pengeluaran,
      saldoLalu + penerimaan - pengeluaran
    ])
  })

  rtf = replaceAmountsInRow(rtf, 'Saldo Pembukuan', 1, [saldoPembukuan])
  rtf = replaceAmountsInRow(rtf, 'Menurut Kas', 1, [kasTunai, saldoBank, materai])
  rtf = replaceAmountsInRow(rtf, 'Menurut Kas', 2, [kasTunai, saldoBank, materai])
  rtf = replaceAmountsInRow(rtf, 'Saldo Kas', 1, [saldoKas])
  rtf = replaceAmountsInRow(rtf, 'Saldo Kas', 2, [saldoKas])
  rtf = replaceAmountsInRow(rtf, 'Selisih (IV-V)', 1, [selisih])
  rtf = replaceAmountsInRow(rtf, 'Selisih (saldo pembukuan - saldo kas)', 1, [selisih])
  rtf = replaceAmountsInRow(rtf, 'Selisih kurang', 1, [Math.max(0, -selisih)])

  return rtf
}

function kasTunaiLine(row, index) {
  const letter = String.fromCharCode(97 + index)
  return `${letter}. ${row.type} Rp ${money(row.nominal)} sebanyak ${row.jumlah || '-'} ${row.unit} : Rp ${money(row.total)}`
}

function replaceKasTunaiLampiran(rtf, payload) {
  const rows = normalizeKasTunaiRows(payload.kasTunaiRows)
  const kasTunai = rows.reduce((sum, row) => sum + row.total, 0)
  const materai = Number(payload.materai) || 0
  const materaiCount = materai > 0 ? Math.floor(materai / 10000) : 0
  const lines = [
    `Kas Tunai : Rp ${money(kasTunai)}`,
    '',
    'Terdiri dari perincian',
    ...rows.map(kasTunaiLine),
    `+ Rp ${money(kasTunai)}`,
    '',
    `Materai Rp. 10.000,- ${materaiCount} lembar : Rp ${money(materai)}`,
    ''
  ]
  const replacement = lines.map(line => rtfEscape(line)).join('\\par ')
  const start = rtf.indexOf('Kas Tunai\\tab')
  const end = rtf.indexOf('Penjelasan :', start)

  if (start === -1 || end === -1) return rtf
  return rtf.slice(0, start) + replacement + rtf.slice(end)
}

function replaceExplanations(rtf, payload) {
  const explanation = rtfEscape(payload.penjelasan || 'Tidak Ada Selisih')
  return rtf.replace(/Tidak Ada Selisih/g, explanation)
}

function generatePenutupanKasRtf(payload = {}) {
  let rtf = fs.readFileSync(TEMPLATE_PATH, 'utf8')
  rtf = replaceMonthYearLabels(rtf, payload)
  rtf = replaceDateParagraph(rtf, payload)
  rtf = replaceAmountsInTemplate(rtf, payload)
  rtf = replaceKasTunaiLampiran(rtf, payload)
  rtf = replaceExplanations(rtf, payload)
  return Buffer.from(rtf, 'utf8')
}

module.exports = { generatePenutupanKasRtf }
