const PizZip = require('pizzip')

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function numberValue(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function inlineCell(ref, value, style = 0) {
  return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t>${xmlEscape(value)}</t></is></c>`
}

function numberCell(ref, value, style = 0) {
  return `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${numberValue(value)}</v></c>`
}

function formulaCell(ref, formula, style = 0) {
  return `<c r="${ref}"${style ? ` s="${style}"` : ''}><f>${xmlEscape(formula)}</f></c>`
}

function rowXml(rowNumber, cells) {
  return `<row r="${rowNumber}">${cells.join('')}</row>`
}

function sheetXml(rows, widths = []) {
  const cols = widths.length
    ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${cols}
  <sheetData>${rows.join('')}</sheetData>
</worksheet>`
}

function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    no: index + 1,
    tanggal: row.tanggal || '',
    buku: row.buku || 'Buku Induk Keuangan Perkara',
    kategori: row.kategori || row.uraian || '',
    nomorPerkara: row.nomorPerkara || '',
    uraian: row.uraian || row.kategori || '',
    penerimaan: numberValue(row.penerimaan),
    pengeluaran: numberValue(row.pengeluaran),
    ket: row.ket || ''
  }))
}

function buildSheet1(rows) {
  const header = rowXml(1, [
    inlineCell('A1', 'No', 1),
    inlineCell('B1', 'Tanggal', 1),
    inlineCell('C1', 'Buku', 1),
    inlineCell('D1', 'Kategori', 1),
    inlineCell('E1', 'Nomor Perkara', 1),
    inlineCell('F1', 'Uraian', 1),
    inlineCell('G1', 'Penerimaan', 1),
    inlineCell('H1', 'Pengeluaran', 1),
    inlineCell('I1', 'Ket', 1)
  ])

  const body = rows.map((row, index) => {
    const r = index + 2
    return rowXml(r, [
      numberCell(`A${r}`, row.no),
      inlineCell(`B${r}`, row.tanggal),
      inlineCell(`C${r}`, row.buku),
      inlineCell(`D${r}`, row.kategori),
      inlineCell(`E${r}`, row.nomorPerkara || '-'),
      inlineCell(`F${r}`, row.uraian),
      numberCell(`G${r}`, row.penerimaan, 2),
      numberCell(`H${r}`, row.pengeluaran, 2),
      inlineCell(`I${r}`, row.ket || '-')
    ])
  })

  return sheetXml([header, ...body], [6, 14, 34, 22, 22, 32, 15, 15, 18])
}

function buildSheet2(rows) {
  const header = rowXml(1, [
    inlineCell('A1', 'No', 1),
    inlineCell('B1', 'Uraian Laporan', 1),
    inlineCell('C1', 'Penerimaan', 1),
    inlineCell('D1', 'Pengeluaran', 1),
    inlineCell('E1', 'Saldo', 1)
  ])

  const body = rows.map((row, index) => {
    const r = index + 2
    return rowXml(r, [
      numberCell(`A${r}`, row.no),
      inlineCell(`B${r}`, row.uraian || row.kategori),
      numberCell(`C${r}`, row.penerimaan, 2),
      numberCell(`D${r}`, row.pengeluaran, 2),
      formulaCell(`E${r}`, `C${r}-D${r}`, 2)
    ])
  })

  return sheetXml([header, ...body], [6, 40, 15, 15, 15])
}

function buildSheet3(rows) {
  const categories = [
    'PNBP',
    'Biaya Pendaftaran',
    'Materai',
    'Biaya Panggilan',
    'Lain-lain'
  ]
  const lastRow = Math.max(rows.length + 1, 2)
  const header = rowXml(1, [
    inlineCell('A1', 'Kategori', 1),
    inlineCell('B1', 'Total Penerimaan', 1),
    inlineCell('C1', 'Total Pengeluaran', 1),
    inlineCell('D1', 'Saldo', 1)
  ])
  const body = categories.map((category, index) => {
    const r = index + 2
    return rowXml(r, [
      inlineCell(`A${r}`, category),
      formulaCell(`B${r}`, `SUMIF('Sheet 1 Input'!D$2:D$${lastRow},A${r},'Sheet 1 Input'!G$2:G$${lastRow})`, 2),
      formulaCell(`C${r}`, `SUMIF('Sheet 1 Input'!D$2:D$${lastRow},A${r},'Sheet 1 Input'!H$2:H$${lastRow})`, 2),
      formulaCell(`D${r}`, `B${r}-C${r}`, 2)
    ])
  })
  const totalRowNumber = categories.length + 3
  const total = rowXml(totalRowNumber, [
    inlineCell(`A${totalRowNumber}`, 'TOTAL', 1),
    formulaCell(`B${totalRowNumber}`, `SUM(B2:B${categories.length + 1})`, 2),
    formulaCell(`C${totalRowNumber}`, `SUM(C2:C${categories.length + 1})`, 2),
    formulaCell(`D${totalRowNumber}`, `SUM(D2:D${categories.length + 1})`, 2)
  ])

  return sheetXml([header, ...body, total], [24, 18, 18, 18])
}

function generateRekapExcelXlsx(payload = {}) {
  const rows = normalizeRows(payload.rows)
  const zip = new PizZip()

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`)
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet 1 Input" sheetId="1" r:id="rId1"/>
    <sheet name="Sheet 2 Laporan" sheetId="2" r:id="rId2"/>
    <sheet name="Sheet 3 Rekap" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`)
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`)
  zip.file('xl/worksheets/sheet1.xml', buildSheet1(rows))
  zip.file('xl/worksheets/sheet2.xml', buildSheet2(rows))
  zip.file('xl/worksheets/sheet3.xml', buildSheet3(rows))

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

module.exports = { generateRekapExcelXlsx }
