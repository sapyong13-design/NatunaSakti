// ============================================
// LAPORAN SERVICE - Berita Acara Akurasi SIPP
// Generates .docx from official PN Natuna templates
// ============================================

const PizZip = require('pizzip')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')
const {
    resolveMonthlyReportPeriod,
    isDatePartsWithinPeriod
} = require('../lib/monthlyReportPeriod')
const { compareRowsByRegisterDate } = require('../lib/reportSort')
const { isHoliday } = require('../lib/holidays')

const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                     'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const HARI_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

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
}

const MINGGU_ROMAN = ['I', 'II', 'III', 'IV', 'V']

// Parse "08 May 2026" → { day: 8, month: 5, year: 2026, sort: 20260508 }
function parseRegisterDate(dateStr) {
    if (!dateStr) return null
    const parts = dateStr.replace(/\./g, '').trim().split(/\s+/)
    if (parts.length < 3) return null
    const day = parseInt(parts[0])
    const monKey = parts[1].toLowerCase()
    const monIdx = MONTH_INDEX[monKey] ?? MONTH_INDEX[monKey.slice(0, 3)]
    const year = parseInt(parts[2])
    if (isNaN(day) || monIdx === undefined || isNaN(year)) return null
    return { day, month: monIdx + 1, year, sort: year * 10000 + (monIdx + 1) * 100 + day }
}

// Parse "Selasa, 27 Jan. 2026" → Date object
function parseJadwalDateFull(dateStr) {
    if (!dateStr) return null
    const cleaned = dateStr.replace(/^[^,]+,\s*/, '').replace(/\./g, '').trim()
    const parts = cleaned.split(/\s+/)
    if (parts.length < 3) return null
    const day = parseInt(parts[0])
    const monKey = parts[1].toLowerCase()
    const monIdx = MONTH_INDEX[monKey] ?? MONTH_INDEX[monKey.slice(0, 3)]
    const year = parseInt(parts[2])
    if (isNaN(day) || monIdx === undefined || isNaN(year)) return null
    return new Date(year, monIdx, day)
}

function parseIsoDateLocal(dateStr) {
    const match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return null
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function formatIsoDateLocal(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function addDays(date, days) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
}

function isWeekend(date) {
    const day = date.getDay()
    return day === 0 || day === 6
}

function isNonWorkingDay(date) {
    return isWeekend(date) || isHoliday(formatIsoDateLocal(date))
}

function nextWorkday(date) {
    let next = new Date(date)
    while (isNonWorkingDay(next)) next = addDays(next, 1)
    return next
}

function previousWorkday(date) {
    let prev = new Date(date)
    while (isNonWorkingDay(prev)) prev = addDays(prev, -1)
    return prev
}

function workWeekEnd(date) {
    return previousWorkday(addDays(date, 5 - date.getDay()))
}

function splitIntoWorkWeeks(startDateStr, endDateStr) {
    const rawStart = parseIsoDateLocal(startDateStr)
    const rawEnd = parseIsoDateLocal(endDateStr)
    if (!rawStart || !rawEnd || rawStart > rawEnd) return []

    const end = previousWorkday(rawEnd)
    let cursor = nextWorkday(rawStart)
    const periods = []

    while (cursor <= end) {
        const weekEnd = workWeekEnd(cursor)
        if (weekEnd < cursor) {
            cursor = nextWorkday(addDays(addDays(cursor, 5 - cursor.getDay()), 1))
            continue
        }
        const periodEnd = weekEnd < end ? weekEnd : end
        periods.push({
            start: formatIsoDateLocal(cursor),
            end: formatIsoDateLocal(periodEnd)
        })
        cursor = nextWorkday(addDays(periodEnd, 1))
    }

    return periods
}

// Parse "Selasa, 27 Jan. 2026" → { month: 1, year: 2026 }
function parseJadwalDate(dateStr) {
    if (!dateStr) return null
    // Strip day name and comma, strip trailing dot from month abbreviation
    const cleaned = dateStr.replace(/^[^,]+,\s*/, '').replace(/\./g, '').trim()
    // Now: "27 Jan 2026"
    const parts = cleaned.split(/\s+/)
    if (parts.length < 3) return null
    const day = parseInt(parts[0])
    const monKey = parts[1].toLowerCase()
    const monIdx = MONTH_INDEX[monKey] ?? MONTH_INDEX[monKey.slice(0, 3)]
    const year = parseInt(parts[2])
    if (isNaN(day) || monIdx === undefined || isNaN(year)) return null
    return { day, month: monIdx + 1, year }
}

function parseSippDateParts(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null

    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
        return {
            day: parseInt(isoMatch[3], 10),
            month: parseInt(isoMatch[2], 10),
            year: parseInt(isoMatch[1], 10)
        }
    }

    const cleaned = dateStr.replace(/^[^,]+,\s*/, '').replace(/\./g, '').trim()
    const parts = cleaned.split(/\s+/)
    if (parts.length < 3) return null
    const day = parseInt(parts[0], 10)
    const monKey = parts[1].toLowerCase()
    const monIdx = MONTH_INDEX[monKey] ?? MONTH_INDEX[monKey.slice(0, 3)]
    const year = parseInt(parts[2], 10)
    if (isNaN(day) || monIdx === undefined || isNaN(year)) return null
    return { day, month: monIdx + 1, year }
}

function datePartsToDate(parts) {
    if (!parts) return null
    const date = new Date(parts.year, parts.month - 1, parts.day)
    if (
        date.getFullYear() !== parts.year ||
        date.getMonth() !== parts.month - 1 ||
        date.getDate() !== parts.day
    ) {
        return null
    }
    return date
}

function isTilangPerkara(row) {
    const text = [
        row.nomor_perkara,
        row.nama_perkara,
        row.sipp_klasifikasi
    ].filter(Boolean).join(' ')

    return /tilang|lalu\s+lintas|pid\.?\s*c/i.test(text)
}

function isPerkaraDisamarkan(row) {
    const text = [
        row.nama_perkara,
        row.para_pihak
    ].filter(Boolean).join(' ')

    return /\bdisamarkan\b/i.test(text)
}

function isPerdataEksekusi(row) {
    const text = [
        row.nomor_perkara,
        row.nama_perkara,
        row.sipp_klasifikasi
    ].filter(Boolean).join(' ')

    return /\beksekusi\b|pdt\.?\s*(eks|eksusi)|\/eks/i.test(text)
}

function isDispensasiIzinNikah(row) {
    const text = [
        row.nomor_perkara,
        row.nama_perkara,
        row.sipp_klasifikasi
    ].filter(Boolean).join(' ')

    return /\bdispensasi\b|\bijin\s+nikah\b|\bizin\s+nikah\b|\bizin\s+kawin\b|\bijin\s+kawin\b/i.test(text)
}

function sortByRegisterDate(a, b) {
    return compareRowsByRegisterDate(a, b)
}

function mergeNomorListsByRegister(perkaraMap, ...lists) {
    return [...new Set(lists.flat())]
        .sort((a, b) => sortByRegisterDate(perkaraMap.get(a), perkaraMap.get(b)))
}

function normalizeReportLabel(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function pickReportRowList(noText, labelText, lists) {
    const label = normalizeReportLabel(labelText)
    if (!label || label === '-') return null

    if (noText === '1' && /perkara/.test(label)) return lists.register
    if (/tilan\s*g|tilang/.test(label)) return lists.tilang
    if (/berita acara sidang/.test(label)) return lists.sidang
    if (/denda|uang\s+(pengganti|ganti)/.test(label)) return lists.denda
    if (/anonimisasi/.test(label)) return lists.anonimisasi
    if (/eksekusi/.test(label)) return lists.eksekusi
    if (/dispensasi|\bijin\s+nikah\b|\bizin\s+nikah\b/.test(label)) return lists.dispensasiNikah

    return null
}

const TEMPLATE_DIR = path.join(__dirname, '../templates')

const TEMPLATE_MAP = {
    'Perdata':   'bulanan-perdata.docx',
    'Perikanan': 'bulanan-perikanan.docx',
    'Pidana':    'bulanan-pidana.docx',
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

function getTemplateJenis(templateFile, fallback = 'Perdata') {
    const lower = templateFile.toLowerCase()
    if (lower.includes('pidana')) return 'Pidana'
    if (lower.includes('perikanan')) return 'Perikanan'
    if (lower.includes('perdata')) return 'Perdata'
    return fallback
}

function replaceYearValues(xml, tahun) {
    const yearStr = String(tahun)
    const yearPrefix = yearStr.slice(0, 3)
    const yearSuffix = yearStr.slice(3)

    xml = xml.replaceAll(`<w:t>2026</w:t>`, `<w:t>${yearStr}</w:t>`)
    xml = xml.replaceAll(`<w:t>TAHUN 202</w:t>`, `<w:t>TAHUN ${yearPrefix}</w:t>`)
    xml = xml.replaceAll(`<w:t>202</w:t>`, `<w:t>${yearPrefix}</w:t>`)

    const runPattern = /<w:t[^>]*>(.*?)<\/w:t>/g
    const replacements = []
    let previousText = ''
    let match
    while ((match = runPattern.exec(xml)) !== null) {
        const value = match[1]
        if (value === '6' && (previousText === yearPrefix || previousText === `TAHUN ${yearPrefix}`)) {
            replacements.push({ start: match.index, end: runPattern.lastIndex, text: match[0].replace('>6</w:t>', `>${yearSuffix}</w:t>`) })
        }
        previousText = value
    }

    for (let i = replacements.length - 1; i >= 0; i -= 1) {
        const replacement = replacements[i]
        xml = xml.substring(0, replacement.start) + replacement.text + xml.substring(replacement.end)
    }

    return xml
}

function replaceDateAfterTanggal(xml, tanggal) {
    const tanggalPos = xml.indexOf('tanggal </w:t>')
    if (tanggalPos === -1) return xml

    const after = tanggalPos + 'tanggal </w:t>'.length
    const firstOpen = xml.indexOf('<w:t>', after)
    if (firstOpen === -1) return xml

    const firstClose = xml.indexOf('>', firstOpen) + 1
    const firstEnd = xml.indexOf('</w:t>', firstOpen)
    if (firstEnd === -1) return xml

    const firstValue = xml.substring(firstClose, firstEnd).trim()
    if (!/^\d{1,2}$/.test(firstValue)) return xml

    const secondOpen = xml.indexOf('<w:t>', firstEnd)
    const secondClose = secondOpen === -1 ? -1 : xml.indexOf('>', secondOpen) + 1
    const secondEnd = secondOpen === -1 ? -1 : xml.indexOf('</w:t>', secondOpen)
    const secondValue = secondEnd === -1 ? '' : xml.substring(secondClose, secondEnd).trim()

    if (/^\d$/.test(firstValue) && /^\d$/.test(secondValue)) {
        return xml.substring(0, firstClose) + tanggal + xml.substring(firstEnd, secondClose) + xml.substring(secondEnd)
    }

    return xml.substring(0, firstClose) + tanggal + xml.substring(firstEnd)
}

function enforceFixedTableLayout(xml) {
    return xml.replace(/<w:tblPr>([\s\S]*?)<\/w:tblPr>/g, (match, content) => {
        if (content.includes('<w:tblLayout')) {
            return `<w:tblPr>${content.replace(/<w:tblLayout[^>]*\/>/, '<w:tblLayout w:type="fixed"/>')}</w:tblPr>`
        }
        return `<w:tblPr><w:tblLayout w:type="fixed"/>${content}</w:tblPr>`
    })
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
    const paragraphs = nomorList.length === 1 && nomorList[0] === '-'
        ? [buildCenteredParagraph('-')]
        : nomorList.map(buildNomorParagraph)
    return cellXml.substring(0, firstPEnd) +
           paragraphs.join('') +
           '</w:tc>'
}

// Replace a cell's content with given text (centered)
function replaceCellContent(cellXml, text) {
    const tcprEnd = cellXml.indexOf('</w:tcPr>')
    if (tcprEnd === -1) {
        return '<w:tc>' + buildCenteredParagraph(text) + '</w:tc>'
    }
    return cellXml.substring(0, tcprEnd + 9) + buildCenteredParagraph(text) + '</w:tc>'
}

function replaceMonitoringRow(rowXml, cells, nomorList) {
    const hasData = nomorList.length > 0
    let newRowXml = hasData
        ? rowXml
        : rowXml.replace(/<w:trHeight[^>]*\/>/g, '')
    const displayList = hasData ? nomorList : ['-']

    newRowXml = replaceFirst(newRowXml, cells[1].xml, replacePerkaraCell(cells[1].xml, displayList))

    for (let i = 2; i < cells.length; i += 1) {
        let value = '-'
        if (hasData && i === 2) value = '✓'
        if (hasData && i === 4) value = 'Sudah di Proses'
        newRowXml = replaceFirst(newRowXml, cells[i].xml, replaceCellContent(cells[i].xml, value))
    }

    return newRowXml
}

function parseRawJson(rawJson) {
    try {
        const parsed = rawJson ? JSON.parse(rawJson) : []
        return Array.isArray(parsed) ? parsed : []
    } catch (_) {
        return []
    }
}

function putusanSearchText(row) {
    const rawRows = parseRawJson(row.raw_json)
    const rawText = rawRows
        .map(item => `${item?.label || ''} ${item?.value || ''}`)
        .join(' ')

    return [
        row.status_putusan,
        row.amar_putusan,
        row.raw_text,
        rawText
    ].filter(Boolean).join(' ')
}

function firstParsedDateParts(...values) {
    for (const value of values) {
        const parsed = parseSippDateParts(value)
        if (parsed) return parsed
    }
    return null
}

function hasDenda(row) {
    return /\bdenda\b/i.test(putusanSearchText(row))
}

function isDisamarkan(row) {
    const rawRows = parseRawJson(row.raw_json)
    for (const item of rawRows) {
        const label = String(item?.label || '')
        const value = String(item?.value || '').trim()
        if (/pihak dipublikasikan|dipublikasikan|disamarkan/i.test(label)) {
            if (/^tidak$/i.test(value)) return true
            if (/^ya$/i.test(value)) return false
        }
    }

    const text = putusanSearchText(row).toLowerCase()
    if (text.includes('tidak disamarkan')) return false
    return text.includes('disamarkan') || text.includes('anonimisasi')
}

function getPutusanReportLists(db, jenis, isInPeriod) {
    const rows = db.prepare(`
        SELECT p.nomor_perkara, p.sipp_tanggal_register, p.sipp_status,
               pp.tanggal_putusan, pp.tanggal_minutasi, pp.status_putusan,
               pp.amar_putusan, pp.raw_text, pp.raw_json
        FROM perkara p
        INNER JOIN putusan_perkara pp ON pp.nomor_perkara = p.nomor_perkara
        WHERE p.jenis_perkara = ?
    `).all(jenis)

    const isRowInPeriod = (row, primaryDate) => {
        const searchText = putusanSearchText(row)
        const parsed = primaryDate === 'minutasi'
            ? firstParsedDateParts(row.tanggal_minutasi, row.tanggal_putusan, searchText)
            : firstParsedDateParts(row.tanggal_putusan, row.tanggal_minutasi, searchText)
        return isInPeriod(parsed)
    }

    const byRegisterDate = (a, b) => {
        return compareRowsByRegisterDate(a, b)
    }

    return {
        denda: rows
            .filter(row => isRowInPeriod(row, 'putusan') && hasDenda(row))
            .sort(byRegisterDate)
            .map(row => row.nomor_perkara),
        anonimisasi: rows
            .filter(row => isRowInPeriod(row, 'minutasi') && (jenis === 'Pidana' || row.sipp_status === 'Minutasi') && isDisamarkan(row))
            .sort(byRegisterDate)
            .map(row => row.nomor_perkara)
    }
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
    // Replace year, including DOCX runs split as "202" + "6"
    xml = replaceYearValues(xml, tahun)

    // Replace day of week name
    for (const h of HARI_NAMES) {
        xml = xml.replace(`<w:t>${h}</w:t>`, `<w:t>${hari}</w:t>`)
    }

    // Replace date number, including DOCX runs split as "3" + "0"
    xml = replaceDateAfterTanggal(xml, String(tanggal))

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
function generateLaporanBulanan(db, jenis, bulan, tahun, options = {}) {
    const bulanNama = BULAN_NAMES[bulan - 1]
    if (!bulanNama) throw new Error(`Bulan tidak valid: ${bulan}`)

    const period = resolveMonthlyReportPeriod(bulan, tahun, options.end)
    const hari = period.dayName
    const tanggal = period.endDay

    // Row 1: perkara yang register di bulan ini, sort by tanggal register asc
    const allPerkara = db.prepare(`
        SELECT nomor_perkara, nama_perkara, para_pihak, sipp_tanggal_register, sipp_klasifikasi FROM perkara
        WHERE jenis_perkara = ?
    `).all(jenis)

    const nomorList1 = allPerkara
        .filter(p => {
            const d = parseRegisterDate(p.sipp_tanggal_register)
            return isDatePartsWithinPeriod(d, period)
        })
        .sort(sortByRegisterDate)
        .map(p => p.nomor_perkara)

    const nomorListTilang = allPerkara
        .filter(p => isTilangPerkara(p) && isDatePartsWithinPeriod(parseRegisterDate(p.sipp_tanggal_register), period))
        .sort(sortByRegisterDate)
        .map(p => p.nomor_perkara)

    const nomorListEksekusi = allPerkara
        .filter(p => isPerdataEksekusi(p) && isDatePartsWithinPeriod(parseRegisterDate(p.sipp_tanggal_register), period))
        .sort(sortByRegisterDate)
        .map(p => p.nomor_perkara)

    const nomorListDispensasiNikah = allPerkara
        .filter(p => isDispensasiIzinNikah(p) && isDatePartsWithinPeriod(parseRegisterDate(p.sipp_tanggal_register), period))
        .sort(sortByRegisterDate)
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
        if (isDatePartsWithinPeriod(d, period)) {
            seen2.add(j.nomor_perkara)
            nomorList2.push(j.nomor_perkara)
        }
    }
    nomorList2.sort((a, b) => sortByRegisterDate(perkaraMap.get(a), perkaraMap.get(b)))

    const putusanLists = getPutusanReportLists(db, jenis, d => isDatePartsWithinPeriod(d, period))
    const nomorListAnonimisasi = mergeNomorListsByRegister(
        perkaraMap,
        putusanLists.anonimisasi,
        nomorList1.filter(nomor => isPerkaraDisamarkan(perkaraMap.get(nomor))),
        ...(jenis === 'Pidana' ? [] : [nomorList2.filter(nomor => isPerkaraDisamarkan(perkaraMap.get(nomor)))])
    )
    const nomorListBeritaAcara = jenis === 'Perdata'
        ? mergeNomorListsByRegister(perkaraMap, nomorList2, nomorListAnonimisasi)
        : nomorList2

    // Load template
    const templateFile = TEMPLATE_MAP[jenis] || 'bulanan-perdata.docx'
    const templatePath = path.join(TEMPLATE_DIR, templateFile)
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template tidak ditemukan: ${templateFile}`)
    }

    const templateBuf = fs.readFileSync(templatePath)
    const zip = new PizZip(templateBuf)
    let xml = zip.files['word/document.xml'].asText()
    xml = enforceFixedTableLayout(xml)

    // Determine which jenis name is in the template (to do substitutions)
    const templateJenis = getTemplateJenis(templateFile)

    // Replace jenis references if using a different template
    xml = replaceJenisReferences(xml, templateJenis, jenis)

    // Replace simple values (month, year, day, date)
    xml = replaceSimpleValues(xml, { bulanNama, tahun, hari, tanggal })

    // Update table data rows: NO=1 → perkara register bulan ini, NO=2 → punya sidang bulan ini
    const rows = getTableRows(xml)
    const modifications = []
    const reportLists = {
        register: nomorList1,
        sidang: nomorListBeritaAcara,
        tilang: nomorListTilang,
        denda: putusanLists.denda,
        anonimisasi: nomorListAnonimisasi,
        eksekusi: nomorListEksekusi,
        dispensasiNikah: nomorListDispensasiNikah
    }

    for (const row of rows) {
        const cells = getRowCells(row.xml)
        if (cells.length < 2) continue

        const noText = getCellText(cells[0].xml)
        const mappedNomorList = pickReportRowList(noText, getCellText(cells[1].xml), reportLists)
        if (mappedNomorList) {
            const newRowXml = replaceMonitoringRow(row.xml, cells, mappedNomorList)
            modifications.push({ start: row.start, end: row.end, newXml: newRowXml })
            continue
        }
        if (noText !== '1' && noText !== '2') continue

        const nomorList = noText === '1' ? nomorList1 : nomorList2

        // If no perkara, leave row as-is — template already has correct "-" format
        if (nomorList.length === 0) continue

        let newRowXml = row.xml

        // Replace NOMOR PERKARA cell (index 1)
        const origCell1 = cells[1].xml
        const newCell1 = replacePerkaraCell(origCell1, nomorList)
        newRowXml = replaceFirst(newRowXml, origCell1, newCell1)

        // Replace SESUAI cell (index 2) with ✓
        const sesuaiIdx = cells.length >= 6 ? 2 : 1
        if (cells[sesuaiIdx]) {
            newRowXml = replaceFirst(newRowXml, cells[sesuaiIdx].xml, replaceCellContent(cells[sesuaiIdx].xml, '✓'))
        }

        // Replace TINDAK LANJUT cell (index 4) with "Sudah di Proses"
        const tlIdx = cells.length >= 6 ? 4 : 3
        if (cells[tlIdx]) {
            newRowXml = replaceFirst(newRowXml, cells[tlIdx].xml, replaceCellContent(cells[tlIdx].xml, 'Sudah di Proses'))
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

// Convert DOCX buffer → PDF buffer via Microsoft Word COM (Windows only)
function convertDocxToPdf(docxBuffer) {
    const tmpDocx = path.join(os.tmpdir(), `laporan_${Date.now()}.docx`)
    const tmpPdf  = tmpDocx.replace('.docx', '.pdf')
    try {
        fs.writeFileSync(tmpDocx, docxBuffer)
        const ps = `
            $w = New-Object -ComObject Word.Application
            $w.Visible = $false
            $w.DisplayAlerts = 0
            $d = $w.Documents.Open('${tmpDocx.replace(/\\/g, '\\\\')}')
            $d.SaveAs([ref]'${tmpPdf.replace(/\\/g, '\\\\')}', [ref]17)
            $d.Close($false)
            $w.Quit()
        `
        execSync(`powershell -NonInteractive -Command "${ps.replace(/\n\s*/g, '; ')}"`, { timeout: 30000 })
        return fs.readFileSync(tmpPdf)
    } finally {
        if (fs.existsSync(tmpDocx)) fs.unlinkSync(tmpDocx)
        if (fs.existsSync(tmpPdf))  fs.unlinkSync(tmpPdf)
    }
}

// ============================================================
// LAPORAN MINGGUAN
// ============================================================

const TEMPLATE_MAP_MINGGUAN = {
    'Perikanan': 'mingguan-perikanan.docx',
    'Pidana':    'mingguan-pidana.docx',
    'Perdata':   'mingguan-perdata.docx',
    'Hukum':     'mingguan-perdata.docx',
}

function replaceJenisReferencesMingguanPerikanan(xml, toJenis) {
    if (toJenis === 'Perikanan') return xml

    // Handle split text runs: "KEPANITERAAN MUDA P" + "ERIKANAN"
    xml = xml.replace('<w:t>KEPANITERAAN MUDA P</w:t>', `<w:t>KEPANITERAAN MUDA ${toJenis.toUpperCase()}</w:t>`)
    xml = xml.replace('<w:t>ERIKANAN</w:t>', '<w:t></w:t>')

    // "Pada Kepaniteraan Muda P" + "erikanan"
    xml = xml.replace('<w:t>Pada Kepaniteraan Muda P</w:t>', `<w:t>Pada Kepaniteraan Muda ${toJenis}</w:t>`)

    // "Panitera Muda P" + "erikanan" — replace "erikanan" suffix with correct suffix
    // "P" run stays, replace "erikanan" with remainder of new jenis name lowercased
    const suffix = toJenis.slice(1).toLowerCase()  // e.g. "idana", "erdata", "ukum"
    xml = xml.replace('<w:t>erikanan</w:t>', `<w:t>${suffix}</w:t>`)

    // Kepaniteraan Muda Perikanan in body (single run if present)
    xml = xml.replaceAll(`<w:t>Kepaniteraan Muda Perikanan</w:t>`, `<w:t>Kepaniteraan Muda ${toJenis}</w:t>`)
    xml = xml.replaceAll(`<w:t>Panitera Muda Perikanan</w:t>`, `<w:t>Panitera Muda ${toJenis}</w:t>`)

    return xml
}

function replaceJenisReferencesMingguanPerdata(xml, toJenis) {
    if (toJenis === 'Perdata') return xml
    const upper = toJenis.toUpperCase()

    // Title line: " PADA KEPANITERAAN MUDA PERDATA"
    xml = xml.replace(
        '<w:t xml:space="preserve"> PADA KEPANITERAAN MUDA PERDATA</w:t>',
        `<w:t xml:space="preserve"> PADA KEPANITERAAN MUDA ${upper}</w:t>`
    )
    // Signature table: "KEPANITERAAN MUDA PERDATA"
    xml = xml.replaceAll('<w:t>KEPANITERAAN MUDA PERDATA</w:t>', `<w:t>KEPANITERAAN MUDA ${upper}</w:t>`)
    // Body sentence: "Kepaniteraan Muda Perdata"
    xml = xml.replaceAll('Kepaniteraan Muda Perdata', `Kepaniteraan Muda ${toJenis}`)
    // Row label (split run) + signature: <w:t>Perdata</w:t>
    xml = xml.replaceAll('<w:t>Perdata</w:t>', `<w:t>${toJenis}</w:t>`)

    return xml
}

function generateLaporanMingguan(db, jenis, startDateStr, endDateStr) {
    const start = new Date(startDateStr)
    const end   = new Date(endDateStr)

    const bulan     = start.getMonth() + 1
    const tahun     = start.getFullYear()
    const bulanNama = BULAN_NAMES[bulan - 1]
    const mingguKe  = Math.min(5, Math.ceil(start.getDate() / 7))
    const mingguRoman = MINGGU_ROMAN[mingguKe - 1]

    const hari    = HARI_NAMES[end.getDay()]
    const tanggal = String(end.getDate()).padStart(2, '0')

    // Row 1: perkara registered within the week
    const allPerkara = db.prepare(
        'SELECT nomor_perkara, nama_perkara, para_pihak, sipp_tanggal_register, sipp_klasifikasi FROM perkara WHERE jenis_perkara = ?'
    ).all(jenis)

    const nomorList1 = allPerkara
        .filter(p => {
            const d = parseRegisterDate(p.sipp_tanggal_register)
            if (!d) return false
            const dt = new Date(d.year, d.month - 1, d.day)
            return dt >= start && dt <= end
        })
        .sort(sortByRegisterDate)
        .map(p => p.nomor_perkara)

    const nomorListTilang = allPerkara
        .filter(p => {
            const d = parseRegisterDate(p.sipp_tanggal_register)
            if (!d) return false
            const dt = new Date(d.year, d.month - 1, d.day)
            return isTilangPerkara(p) && dt >= start && dt <= end
        })
        .sort(sortByRegisterDate)
        .map(p => p.nomor_perkara)

    const nomorListEksekusi = allPerkara
        .filter(p => {
            const d = parseRegisterDate(p.sipp_tanggal_register)
            if (!d) return false
            const dt = new Date(d.year, d.month - 1, d.day)
            return isPerdataEksekusi(p) && dt >= start && dt <= end
        })
        .sort(sortByRegisterDate)
        .map(p => p.nomor_perkara)

    const nomorListDispensasiNikah = allPerkara
        .filter(p => {
            const d = parseRegisterDate(p.sipp_tanggal_register)
            if (!d) return false
            const dt = new Date(d.year, d.month - 1, d.day)
            return isDispensasiIzinNikah(p) && dt >= start && dt <= end
        })
        .sort(sortByRegisterDate)
        .map(p => p.nomor_perkara)

    // Row 2: perkara with sidang within the week
    const perkaraMap = new Map(allPerkara.map(p => [p.nomor_perkara, p]))
    const allJadwal  = db.prepare(
        'SELECT nomor_perkara, tanggal FROM jadwal_sidang WHERE nomor IS NOT NULL AND tanggal IS NOT NULL'
    ).all()

    const seen2 = new Set()
    const nomorList2 = []
    for (const j of allJadwal) {
        if (seen2.has(j.nomor_perkara)) continue
        if (!perkaraMap.has(j.nomor_perkara)) continue
        const dt = parseJadwalDateFull(j.tanggal)
        if (dt && dt >= start && dt <= end) {
            seen2.add(j.nomor_perkara)
            nomorList2.push(j.nomor_perkara)
        }
    }
    nomorList2.sort((a, b) => sortByRegisterDate(perkaraMap.get(a), perkaraMap.get(b)))

    const putusanLists = getPutusanReportLists(db, jenis, parts => {
        const date = datePartsToDate(parts)
        return date && date >= start && date <= end
    })
    const nomorListAnonimisasi = mergeNomorListsByRegister(
        perkaraMap,
        putusanLists.anonimisasi,
        nomorList1.filter(nomor => isPerkaraDisamarkan(perkaraMap.get(nomor))),
        ...(jenis === 'Pidana' ? [] : [nomorList2.filter(nomor => isPerkaraDisamarkan(perkaraMap.get(nomor)))])
    )
    const nomorListBeritaAcara = jenis === 'Perdata'
        ? mergeNomorListsByRegister(perkaraMap, nomorList2, nomorListAnonimisasi)
        : nomorList2

    // Load template
    const templateFile = TEMPLATE_MAP_MINGGUAN[jenis] || 'mingguan-perikanan.docx'
    const templatePath = path.join(TEMPLATE_DIR, templateFile)
    if (!fs.existsSync(templatePath)) throw new Error(`Template tidak ditemukan: ${templateFile}`)

    const zip = new PizZip(fs.readFileSync(templatePath))
    let xml = zip.files['word/document.xml'].asText()
    xml = enforceFixedTableLayout(xml)

    const templateJenis = getTemplateJenis(templateFile, 'Perikanan')
    const isPerdata = templateJenis === 'Perdata'

    // Replace jenis references (template-specific)
    if (isPerdata) {
        xml = replaceJenisReferencesMingguanPerdata(xml, jenis)
    } else {
        xml = replaceJenisReferencesMingguanPerikanan(xml, jenis)
    }

    // Replace month name
    for (const b of BULAN_NAMES) {
        xml = xml.replaceAll(`<w:t>${b.toUpperCase()}</w:t>`, `<w:t>${bulanNama.toUpperCase()}</w:t>`)
        xml = xml.replaceAll(`<w:t>${b}</w:t>`, `<w:t>${bulanNama}</w:t>`)
    }

    // Replace MINGGU KE (template-specific split pattern)
    if (isPerdata) {
        // Perdata template: " MINGGU KE I" (run 1) + "II" (run 2) = "III"
        // Strategy: put full roman in run 1, clear run 2
        xml = xml.replace(
            '<w:t xml:space="preserve"> MINGGU KE I</w:t>',
            `<w:t xml:space="preserve"> MINGGU KE ${mingguRoman}</w:t>`
        )
        xml = xml.replace('<w:t>II</w:t>', '<w:t></w:t>')
    } else if (templateJenis === 'Pidana') {
        // Pidana template splits "MINGGU KE III" as "MINGGU KE I" + "II".
        xml = xml.replace('<w:t>MINGGU KE I</w:t>', `<w:t>MINGGU KE ${mingguRoman}</w:t>`)
        xml = xml.replace('<w:t>II</w:t>', '<w:t></w:t>')
    } else {
        // Perikanan template: "MINGGU KE III" as single run (various roman numerals)
        for (const r of MINGGU_ROMAN) {
            xml = xml.replaceAll(`<w:t>MINGGU KE ${r}</w:t>`, `<w:t>MINGGU KE ${mingguRoman}</w:t>`)
        }
    }

    // Replace year (handles both single-run "2026" and split "202"+"6" patterns)
    xml = replaceYearValues(xml, tahun)

    // Replace day of week
    for (const h of HARI_NAMES) {
        xml = xml.replace(`<w:t>${h}</w:t>`, `<w:t>${hari}</w:t>`)
    }

    // Replace date number after "tanggal ", including split DOCX runs.
    xml = replaceDateAfterTanggal(xml, tanggal)

    // Update data rows (same logic as bulanan)
    const rows = getTableRows(xml)
    const modifications = []
    const reportLists = {
        register: nomorList1,
        sidang: nomorListBeritaAcara,
        tilang: nomorListTilang,
        denda: putusanLists.denda,
        anonimisasi: nomorListAnonimisasi,
        eksekusi: nomorListEksekusi,
        dispensasiNikah: nomorListDispensasiNikah
    }

    for (const row of rows) {
        const cells = getRowCells(row.xml)
        if (cells.length < 2) continue

        const noText    = getCellText(cells[0].xml)
        const mappedNomorList = pickReportRowList(noText, getCellText(cells[1].xml), reportLists)
        if (mappedNomorList) {
            const newRowXml = replaceMonitoringRow(row.xml, cells, mappedNomorList)
            modifications.push({ start: row.start, end: row.end, newXml: newRowXml })
            continue
        }
        if (noText !== '1' && noText !== '2') continue

        const nomorList = noText === '1' ? nomorList1 : nomorList2
        if (nomorList.length === 0) continue

        let newRowXml = row.xml

        // NOMOR PERKARA cell (index 1)
        newRowXml = replaceFirst(newRowXml, cells[1].xml, replacePerkaraCell(cells[1].xml, nomorList))

        // SESUAI cell (index 2)
        if (cells[2]) newRowXml = replaceFirst(newRowXml, cells[2].xml, replaceCellContent(cells[2].xml, '✓'))

        // TINDAK LANJUT cell (index 4)
        if (cells[4]) newRowXml = replaceFirst(newRowXml, cells[4].xml, replaceCellContent(cells[4].xml, 'Sudah di Proses'))

        modifications.push({ start: row.start, end: row.end, newXml: newRowXml })
    }

    modifications.sort((a, b) => b.start - a.start)
    for (const mod of modifications) {
        xml = xml.substring(0, mod.start) + mod.newXml + xml.substring(mod.end)
    }

    zip.file('word/document.xml', xml)
    return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

function splitDocumentBody(xml) {
    const bodyStartTag = '<w:body>'
    const bodyEndTag = '</w:body>'
    const bodyStart = xml.indexOf(bodyStartTag)
    const bodyEnd = xml.lastIndexOf(bodyEndTag)
    if (bodyStart === -1 || bodyEnd === -1) {
        throw new Error('Struktur DOCX tidak valid: body tidak ditemukan')
    }

    const prefix = xml.slice(0, bodyStart + bodyStartTag.length)
    const body = xml.slice(bodyStart + bodyStartTag.length, bodyEnd)
    const suffix = xml.slice(bodyEnd)
    const sectStart = body.lastIndexOf('<w:sectPr')

    if (sectStart === -1) {
        return { prefix, content: body, sectPr: '', suffix }
    }

    return {
        prefix,
        content: body.slice(0, sectStart),
        sectPr: body.slice(sectStart),
        suffix
    }
}

function pageBreakXml() {
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
}

function mergeWeeklyDocxBuffers(buffers) {
    if (buffers.length === 0) {
        throw new Error('Tidak ada periode minggu kerja dalam rentang yang dipilih')
    }
    if (buffers.length === 1) return buffers[0]

    const baseZip = new PizZip(buffers[0])
    const first = splitDocumentBody(baseZip.files['word/document.xml'].asText())
    const contents = [first.content]

    for (const buffer of buffers.slice(1)) {
        const zip = new PizZip(buffer)
        const body = splitDocumentBody(zip.files['word/document.xml'].asText())
        contents.push(pageBreakXml(), body.content)
    }

    baseZip.file('word/document.xml', `${first.prefix}${contents.join('')}${first.sectPr}${first.suffix}`)
    return baseZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}

function generateLaporanMingguanGabungan(db, jenis, startDateStr, endDateStr) {
    const periods = splitIntoWorkWeeks(startDateStr, endDateStr)
    const buffers = periods.map(period => generateLaporanMingguan(db, jenis, period.start, period.end))
    return mergeWeeklyDocxBuffers(buffers)
}

module.exports = {
    generateLaporanBulanan,
    generateLaporanMingguan,
    generateLaporanMingguanGabungan,
    convertDocxToPdf
}
