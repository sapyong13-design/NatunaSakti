function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim()
}

function cleanLabel(value) {
    return cleanText(value).replace(/[:：]+$/g, '')
}

function addField(fields, label, value) {
    const cleanValue = cleanText(value)
    if (!cleanValue) return
    if (fields.some(([existingLabel]) => existingLabel === label)) return
    fields.push([label, cleanValue])
}

function isHeaderValue(value) {
    return /^(Tanggal Putusan|Amar Putusan|Tanggal Minutasi|Keterangan|No Nama Tanggal Putusan Putusan)$/i.test(cleanText(value))
}

function extractIndonesianDate(text) {
    return cleanText(text).match(/(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu),\s+\d{1,2}\s+\w+\.?\s+\d{4}/i)?.[0] || ''
}

function extractDecisionText(text) {
    const clean = cleanText(text)
    const date = extractIndonesianDate(clean)
    if (!date) return ''
    return clean.slice(clean.indexOf(date) + date.length).trim()
}

function extractPrisonTerm(decision) {
    const match = cleanText(decision).match(/\(([^)]*(?:tahun|bulan|hari)[^)]*)\)/i)
    return match ? cleanText(match[1]) : ''
}

function extractFine(decision) {
    const match = cleanText(decision).match(/denda\s*(?:sejumlah|sebesar)?\s*([^;.()]+(?:rupiah|,-|,-)?)/i)
    return match ? cleanText(match[1]) : ''
}

function normalizeDecisionStatus(decision) {
    let status = cleanText(decision)
    status = status.replace(/\([^)]*\)/g, '').trim()
    status = status.replace(/\s{2,}/g, ' ')
    return status
}

function publicationValue(value) {
    const v = cleanText(value)
    if (/^ya$/i.test(v)) return 'Ya (tidak disamarkan)'
    if (/^tidak$/i.test(v)) return 'Tidak (disamarkan)'
    return v
}

function findDecisionRow(rawRows) {
    return rawRows.find(row => /^\d+$/.test(cleanLabel(row?.label)) && extractIndonesianDate(row?.value))
}

export function buildPutusanDisplay(putusan) {
    const rawRows = Array.isArray(putusan?.raw) ? putusan.raw : []
    const summary = []

    const selaDateRow = rawRows.find(row => /tanggal putusan sela/i.test(cleanLabel(row?.label)))
    const decisionRow = findDecisionRow(rawRows)
    const decisionText = decisionRow ? extractDecisionText(decisionRow.value) : ''
    const decisionDate = decisionRow ? extractIndonesianDate(decisionRow.value) : ''

    if (selaDateRow?.value) {
        addField(summary, 'Tanggal Putusan Sela', selaDateRow.value)
        addField(summary, 'Status Putusan', 'Putusan Sela')
    } else if (decisionDate) {
        addField(summary, 'Tanggal Putusan', decisionDate)
    } else if (putusan?.tanggal_putusan && !isHeaderValue(putusan.tanggal_putusan)) {
        addField(summary, 'Tanggal Putusan', putusan.tanggal_putusan)
    }

    if (decisionText) {
        addField(summary, 'Status Putusan', normalizeDecisionStatus(decisionText))
        addField(summary, 'Lama Penjara', extractPrisonTerm(decisionText))
        addField(summary, 'Denda', extractFine(decisionText))
    } else if (putusan?.status_putusan && !isHeaderValue(putusan.status_putusan)) {
        const fallbackDecision = extractDecisionText(putusan.status_putusan) || putusan.status_putusan
        addField(summary, 'Status Putusan', normalizeDecisionStatus(fallbackDecision))
        addField(summary, 'Lama Penjara', extractPrisonTerm(fallbackDecision))
        addField(summary, 'Denda', extractFine(fallbackDecision))
    }

    const publicationRow = rawRows.find(row => /pihak dipublikasikan|disamarkan/i.test(cleanLabel(row?.label)))
    if (publicationRow) addField(summary, 'Publikasi Pihak', publicationValue(publicationRow.value))

    const hasData = summary.length > 0
    return { hasData, summary, amar: '', sections: [], detailCount: 0 }
}
