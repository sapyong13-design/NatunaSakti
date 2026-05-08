// ============================================
// LAPORAN SERVICE - Berita Acara Akurasi SIPP
// Generates .docx from official PN Natuna templates
// ============================================

const PizZip = require('pizzip')
const fs = require('fs')
const path = require('path')

const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                     'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const HARI_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

// English 3-letter month abbreviations as stored by SIPP scraper
const MONTH_ABBREV_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Parse "08 May 2026" → { day: 8, month: 5, year: 2026, sort: 20260508 }
function parseRegisterDate(dateStr) {
    if (!dateStr) return null
    const parts = dateStr.trim().split(/\s+/)
    if (parts.length < 3) return null
    const day = parseInt(parts[0])
    const monIdx = MONTH_ABBREV_EN.indexOf(parts[1])
    const year = parseInt(parts[2])
    if (isNaN(day) || monIdx === -1 || isNaN(year)) return null
    return { day, month: monIdx + 1, year, sort: year * 10000 + (monIdx + 1) * 100 + day }
}

// Parse "Selasa, 27 Jan. 2026" → { month: 1, year: 2026 }
function parseJadwalDate(dateStr) {
    if (!dateStr) return null
    // Strip day name and comma, strip trailing dot from month abbreviation
    const cleaned = dateStr.replace(/^[^,]+,\s*/, '').replace(/\./g, '').trim()
    // Now: "27 Jan 2026"
    const parts = cleaned.split(/\s+/)
    if (parts.length < 3) return null
    const monIdx = MONTH_ABBREV_EN.indexOf(parts[1])
    const year = parseInt(parts[2])
    if (monIdx === -1 || isNaN(year)) return null
    return { month: monIdx + 1, year }
}

const TEMPLATE_DIR = path.join(__dirname, '../templates')

const TEMPLATE_MAP = {
    'Perdata':   'bulanan-perdata.docx',
    'Perikanan': 'bulanan-perikanan.docx',
    'Pidana':    'bulanan-perdata.docx',
    'Hukum':     'bulanan-perdata.docx',
}

// Row labels per jenis for the NOMOR PERKARA column
// Used to substitute row 1 label when using Perdata template for other jenis
const JENIS_ROW1_LABEL = {
    'Perdata':   'Perkara Perdata',
    'Perikanan': 'Perkara Perikanan',
    'Pidana':    'Perkara Pidana',
    'Hukum':     'Perkara Hukum',
}

function getLastWorkingDay(bulan, tahun) {
    const d = new Date(tahun, bulan, 0)
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
    return d
}

function escapeXml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function replaceFirst(str, search, replacement) {
    const idx = str.indexOf(search)
    if (idx === -1) return str
    return str.substring(0, idx) + replacement + str.substring(idx + search.length)
}

// Get all <w:tr> positions in a document XML string
function getTableRows(xml) {
    const rows = []
    let pos = 0
    while (pos < xml.length) {
        const start = xml.indexOf('<w:tr ', pos)
        if (start === -1) break
        const end = xml.indexOf('</w:tr>', start) + 7
        rows.push({ start, end, xml: xml.substring(start, end) })
        pos = end
    }
    return rows
}

// Get all <w:tc> elements from a row XML (flat, no nesting assumed)
function getRowCells(rowXml) {
    const cells = []
    let pos = 0
    while (pos < rowXml.length) {
        const start = rowXml.indexOf('<w:tc>', pos)
        if (start === -1) break
        const end = rowXml.indexOf('</w:tc>', start) + 7
        cells.push({ start, end, xml: rowXml.substring(start, end) })
        pos = end
    }
    return cells
}

// Get concatenated text from a cell (strips XML tags)
function getCellText(cellXml) {
    const parts = []
    let pos = 0
    while (pos < cellXml.length) {
        const wt = cellXml.indexOf('<w:t', pos)
        if (wt === -1) break
        // Skip <w:tc>, <w:tcPr>, <w:tcW> etc. — only match <w:t> or <w:t attr>
        const nextChar = cellXml[wt + 4]
        if (nextChar !== '>' && nextChar !== ' ') { pos = wt + 4; continue }
        const tagClose = cellXml.indexOf('>', wt) + 1
        const textEnd = cellXml.indexOf('</w:t>', tagClose)
        if (textEnd === -1) break
        parts.push(cellXml.substring(tagClose, textEnd))
        pos = textEnd + 6
    }
    return parts.join('').trim()
}

// Standard paragraph for a nomor perkara entry (matches template formatting)
function buildNomorParagraph(nomor) {
    const esc = escapeXml(nomor)
    return `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:leader="dot" w:pos="3119"/><w:tab w:val="left" w:pos="3686"/><w:tab w:val="left" w:leader="dot" w:pos="5245"/></w:tabs><w:ind w:left="-11" w:firstLine="0"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${esc}</w:t></w:r></w:p>`
}

// Standard paragraph for centered text (TINDAK LANJUT column)
function buildCenteredParagraph(text) {
    const esc = escapeXml(text)
    return `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:leader="dot" w:pos="3119"/><w:tab w:val="left" w:pos="3686"/><w:tab w:val="left" w:leader="dot" w:pos="5245"/></w:tabs><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${esc}</w:t></w:r></w:p>`
}

// Replace NOMOR PERKARA cell: keep label paragraph, replace rest with DB data
function replacePerkaraCell(cellXml, nomorList) {
    const firstPEnd = cellXml.indexOf('</w:p>') + 6
    if (firstPEnd < 6) return cellXml

    if (nomorList.length > 0) {
        return cellXml.substring(0, firstPEnd) +
               nomorList.map(buildNomorParagraph).join('') +
               '</w:tc>'
    }

    // Kosong: tampilkan "-" center di bawah label
    return cellXml.substring(0, firstPEnd) + buildCenteredParagraph('-') + '</w:tc>'
}

// Replace TINDAK LANJUT cell: set "Sudah di Proses" or "-" based on data presence
function replaceTindakLanjutCell(cellXml, hasPerkara) {
    const newText = hasPerkara ? 'Sudah di Proses' : '-'
    const tcprEnd = cellXml.indexOf('</w:tcPr>')
    if (tcprEnd === -1) {
        return '<w:tc>' + buildCenteredParagraph(newText) + '</w:tc>'
    }
    return cellXml.substring(0, tcprEnd + 9) + buildCenteredParagraph(newText) + '</w:tc>'
}

// Replace simple text values (month, year, day, date)
function replaceSimpleValues(xml, { bulanNama, tahun, hari, tanggal }) {
    // Replace month uppercase (title)
    for (const b of BULAN_NAMES) {
        xml = xml.replaceAll(`<w:t>${b.toUpperCase()}</w:t>`, `<w:t>${bulanNama.toUpperCase()}</w:t>`)
    }
    // Replace month proper-case (body)
    for (const b of BULAN_NAMES) {
        xml = xml.replaceAll(`<w:t>${b}</w:t>`, `<w:t>${bulanNama}</w:t>`)
    }
    // Replace year
    xml = xml.replaceAll(`<w:t>2026</w:t>`, `<w:t>${tahun}</w:t>`)

    // Replace day of week name
    for (const h of HARI_NAMES) {
        xml = xml.replace(`<w:t>${h}</w:t>`, `<w:t>${hari}</w:t>`)
    }

    // Replace date number: find "tanggal " text run then replace next number run
    const tanggalIdx = xml.indexOf('>tanggal </w:t>')
    if (tanggalIdx !== -1) {
        const afterTanggal = tanggalIdx + 15
        const nextWtOpen = xml.indexOf('<w:t>', afterTanggal)
        const nextWtClose = xml.indexOf('>', nextWtOpen) + 1
        const nextWtEnd = xml.indexOf('</w:t>', nextWtOpen)
        if (nextWtOpen !== -1 && nextWtEnd !== -1) {
            const existingDay = xml.substring(nextWtClose, nextWtEnd).trim()
            if (/^\d{1,2}$/.test(existingDay)) {
                xml = xml.substring(0, nextWtClose) + tanggal + xml.substring(nextWtEnd)
            }
        }
    }

    return xml
}

// Replace jenis references when using a different template (e.g., Perdata → Pidana)
function replaceJenisReferences(xml, fromJenis, toJenis) {
    if (fromJenis === toJenis) return xml

    // Header and title references
    xml = xml.replaceAll(
        `<w:t>KEPANITERAAN MUDA ${fromJenis.toUpperCase()}</w:t>`,
        `<w:t>KEPANITERAAN MUDA ${toJenis.toUpperCase()}</w:t>`
    )
    xml = xml.replaceAll(
        `<w:t>Kepaniteraan Muda ${fromJenis}</w:t>`,
        `<w:t>Kepaniteraan Muda ${toJenis}</w:t>`
    )
    xml = xml.replaceAll(
        `<w:t>Panitera Muda ${fromJenis}</w:t>`,
        `<w:t>Panitera Muda ${toJenis}</w:t>`
    )
    // Table row 1 label: "Perkara Perdata" → "Perkara Pidana"
    // Note: In Perikanan template the name is split across runs, but Perdata template has it clean
    xml = xml.replaceAll(
        `<w:t>Perkara ${fromJenis}</w:t>`,
        `<w:t>Perkara ${toJenis}</w:t>`
    )
    // Body text "Pada Kepaniteraan Muda Perdata"
    xml = xml.replaceAll(
        `<w:t> Pada Kepaniteraan Muda ${fromJenis}</w:t>`,
        `<w:t> Pada Kepaniteraan Muda ${toJenis}</w:t>`
    )
    xml = xml.replaceAll(
        `Kepaniteraan Muda ${fromJenis}`,
        `Kepaniteraan Muda ${toJenis}`
    )

    return xml
}

// Main export function
function generateLaporanBulanan(db, jenis, bulan, tahun) {
    const bulanNama = BULAN_NAMES[bulan - 1]
    if (!bulanNama) throw new Error(`Bulan tidak valid: ${bulan}`)

    const lastDay = getLastWorkingDay(bulan, tahun)
    const hari = HARI_NAMES[lastDay.getDay()]
    const tanggal = lastDay.getDate()

    // Row 1: perkara yang register di bulan ini, sort by tanggal register asc
    const allPerkara = db.prepare(`
        SELECT nomor_perkara, sipp_tanggal_register FROM perkara
        WHERE jenis_perkara = ?
    `).all(jenis)

    const nomorList1 = allPerkara
        .filter(p => {
            const d = parseRegisterDate(p.sipp_tanggal_register)
            return d && d.month === bulan && d.year === tahun
        })
        .sort((a, b) => {
            const da = parseRegisterDate(a.sipp_tanggal_register)
            const db_ = parseRegisterDate(b.sipp_tanggal_register)
            return (da?.sort ?? 0) - (db_?.sort ?? 0)
        })
        .map(p => p.nomor_perkara)

    // Row 2: perkara yang punya minimal 1 sidang di bulan ini, sort by tanggal register asc
    const perkaraMap = new Map(allPerkara.map(p => [p.nomor_perkara, p]))
    const allJadwal = db.prepare(`
        SELECT nomor_perkara, tanggal FROM jadwal_sidang
        WHERE nomor IS NOT NULL AND tanggal IS NOT NULL
    `).all()

    const seen2 = new Set()
    const nomorList2 = []
    for (const j of allJadwal) {
        if (seen2.has(j.nomor_perkara)) continue
        if (!perkaraMap.has(j.nomor_perkara)) continue
        const d = parseJadwalDate(j.tanggal)
        if (d && d.month === bulan && d.year === tahun) {
            seen2.add(j.nomor_perkara)
            nomorList2.push(j.nomor_perkara)
        }
    }
    nomorList2.sort((a, b) => {
        const da = parseRegisterDate(perkaraMap.get(a)?.sipp_tanggal_register)
        const db_ = parseRegisterDate(perkaraMap.get(b)?.sipp_tanggal_register)
        return (da?.sort ?? 0) - (db_?.sort ?? 0)
    })

    // Load template
    const templateFile = TEMPLATE_MAP[jenis] || 'bulanan-perdata.docx'
    const templatePath = path.join(TEMPLATE_DIR, templateFile)
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template tidak ditemukan: ${templateFile}`)
    }

    const templateBuf = fs.readFileSync(templatePath)
    const zip = new PizZip(templateBuf)
    let xml = zip.files['word/document.xml'].asText()

    // Determine which jenis name is in the template (to do substitutions)
    const templateJenis = templateFile.includes('perikanan') ? 'Perikanan' : 'Perdata'

    // Replace jenis references if using a different template
    xml = replaceJenisReferences(xml, templateJenis, jenis)

    // Replace simple values (month, year, day, date)
    xml = replaceSimpleValues(xml, { bulanNama, tahun, hari, tanggal })

    // Replace signature section
    xml = xml.replaceAll('<w:t>Ketua Pengadilan Negeri Natuna</w:t>',
                         '<w:t>Wakil Ketua Pengadilan Negeri Natuna</w:t>')
    xml = xml.replaceAll('<w:t>Lodewyk Ivandrie Simanjuntak</w:t>',
                         '<w:t>Joko Ciptanto</w:t>')

    // Update table data rows: NO=1 → perkara register bulan ini, NO=2 → punya sidang bulan ini
    const rows = getTableRows(xml)
    const modifications = []

    for (const row of rows) {
        const cells = getRowCells(row.xml)
        if (cells.length < 2) continue

        const noText = getCellText(cells[0].xml)
        if (noText !== '1' && noText !== '2') continue

        const nomorList = noText === '1' ? nomorList1 : nomorList2
        const hasPerkara = nomorList.length > 0
        let newRowXml = row.xml

        // Replace NOMOR PERKARA cell (index 1)
        const origCell1 = cells[1].xml
        const newCell1 = replacePerkaraCell(origCell1, nomorList)
        newRowXml = replaceFirst(newRowXml, origCell1, newCell1)

        // Replace TINDAK LANJUT cell (index 4 for 6-column table, index 3 for 5-column)
        const tlIdx = cells.length >= 6 ? 4 : 3
        if (cells[tlIdx]) {
            const origTl = cells[tlIdx].xml
            const newTl = replaceTindakLanjutCell(origTl, hasPerkara)
            newRowXml = replaceFirst(newRowXml, origTl, newTl)
        }

        modifications.push({ start: row.start, end: row.end, newXml: newRowXml })
    }

    // Apply modifications in reverse order (to preserve positions)
    modifications.sort((a, b) => b.start - a.start)
    for (const mod of modifications) {
        xml = xml.substring(0, mod.start) + mod.newXml + xml.substring(mod.end)
    }

    // Write back and return buffer
    zip.file('word/document.xml', xml)
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

module.exports = { generateLaporanBulanan }
