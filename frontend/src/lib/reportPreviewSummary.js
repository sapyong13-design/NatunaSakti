export function isTilangRow(row) {
    const text = [row?.nomor_perkara, row?.nama_perkara, row?.sipp_klasifikasi].filter(Boolean).join(' ')
    return /tilang|lalu\s+lintas|pid\.?\s*c/i.test(text)
}

export function isPerdataEksekusiRow(row) {
    const text = [row?.nomor_perkara, row?.nama_perkara, row?.sipp_klasifikasi].filter(Boolean).join(' ')
    return /\beksekusi\b|pdt\.?\s*(eks|eksusi)|\/eks/i.test(text)
}

export function isDispensasiNikahRow(row) {
    const text = [row?.nomor_perkara, row?.nama_perkara, row?.sipp_klasifikasi].filter(Boolean).join(' ')
    return /\bdispensasi\b|\bijin\s+nikah\b|\bizin\s+nikah\b|\bizin\s+kawin\b|\bijin\s+kawin\b/i.test(text)
}

export function isReportRowIncomplete(row) {
    const missingAnon = !['T', 'Y'].includes(row?.sipp_pihak_dipublikasikan)
    const missingPutus = row?.sipp_status === 'Minutasi' && !row?.tanggal_putus
    return missingAnon || missingPutus
}

export function buildReportPreviewSummary(rows, jenisCanonical) {
    const registered = rows.filter(r => r.laporan_terdaftar_bulan_ini || r.laporan_terdaftar_periode_ini).length
    const hearing = rows.filter(r => r.laporan_sidang_bulan_ini || r.laporan_sidang_periode_ini).length
    const minutasi = rows.filter(r => r.sipp_status === 'Minutasi').length
    const missingAnon = rows.filter(r => !['T', 'Y'].includes(r.sipp_pihak_dipublikasikan)).length
    const missingPutus = rows.filter(r => r.sipp_status === 'Minutasi' && !r.tanggal_putus).length
    const incomplete = rows.filter(isReportRowIncomplete).length

    const sections = []
    if (jenisCanonical === 'Pidana') {
        const tilang = rows.filter(isTilangRow).length
        const anonMinutasi = rows.filter(r => r.sipp_status === 'Minutasi' && r.sipp_pihak_dipublikasikan === 'T').length
        sections.push(
            { key: 'registered', label: 'Bag. A Masuk', value: registered },
            { key: 'tilang', label: 'Bag. B Tilang', value: tilang },
            { key: 'anonMinutasi', label: 'Bag. D Minutasi Anon.', value: anonMinutasi },
            { key: 'hearing', label: 'Bag. E Sidang', value: hearing }
        )
    } else if (jenisCanonical === 'Perdata') {
        sections.push(
            { key: 'registered', label: 'Terdaftar', value: registered },
            { key: 'hearing', label: 'Sidang', value: hearing },
            { key: 'eksekusi', label: 'Eksekusi', value: rows.filter(isPerdataEksekusiRow).length },
            { key: 'dispensasi', label: 'Dispensasi/Izin Nikah', value: rows.filter(isDispensasiNikahRow).length }
        )
    } else {
        sections.push(
            { key: 'registered', label: 'Terdaftar', value: registered },
            { key: 'hearing', label: 'Sidang', value: hearing },
            { key: 'minutasi', label: 'Minutasi', value: minutasi }
        )
    }

    return {
        total: rows.length,
        registered,
        hearing,
        minutasi,
        missingAnon,
        missingPutus,
        incomplete,
        sections
    }
}
