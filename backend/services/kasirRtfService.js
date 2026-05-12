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
  const kasBuku = rows.reduce((sum, row) => sum + (Number(row.kas) || 0), 0)
  const saldoBank = Number(payload.saldoBank) || 0
  const materai = Number(payload.materai) || 0
  const saldoKas = kasBuku + saldoBank + materai

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
  rtf = replaceAmountsInRow(rtf, 'Menurut Kas', 1, [kasBuku, saldoBank, materai])
  rtf = replaceAmountsInRow(rtf, 'Saldo Kas', 1, [saldoKas])
  rtf = replaceAmountsInRow(rtf, 'Selisih (IV-V)', 1, [saldoPembukuan - saldoKas])

  return rtf
}

function generatePenutupanKasRtf(payload = {}) {
  let rtf = fs.readFileSync(TEMPLATE_PATH, 'utf8')
  rtf = replaceMonthYearLabels(rtf, payload)
  rtf = replaceDateParagraph(rtf, payload)
  rtf = replaceAmountsInTemplate(rtf, payload)
  return Buffer.from(rtf, 'utf8')
}

module.exports = { generatePenutupanKasRtf }
