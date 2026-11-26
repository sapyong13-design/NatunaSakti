// Peta status keselarasan lokal vs EIS resmi (hasil uji 3 bulan Agu–Okt 2026).
// Bagian yang belum 3/3 cocok ditandai agar bisa dicicil perbaikannya satu per satu.

const normalize = (value) => String(value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');

// Kunci: `${tab}|${normalizedLabel}|${partIndex}` -> { tier: 'diff' | 'warn', note }.
const diff = (note) => ({ tier: 'diff', note });
const warn = (note) => ({ tier: 'warn', note });

const UNALIGNED = new Map([
    // Kelengkapan (1 mendekati/kuning)
    ['kelengkapan|dokumen elektronik rencana persidangan (court callendar)|0', warn('8/11 bln cocok (Jan–Apr, Jun–Agu, Nov); Mei, Sep, Okt selisih 1–2 (total EIS 114 > 111 perkara SIPP)')],
    ['kelengkapan|dokumen elektronik rencana persidangan (court calendar)|0', warn('8/11 bln cocok (Jan–Apr, Jun–Agu, Nov); Mei, Sep, Okt selisih 1–2 (total EIS 114 > 111 perkara SIPP)')],

    // Kesesuaian (2: 1 mendekati/kuning, 1 belum sama/merah; Sinkronisasi SIPP Web & Data Center MARI tak terlacak di SIPP)
    ['kesesuaian|penahanan|0', warn('Jumlah ≥ EIS (6/11 bln cocok); 0 Tidak lokal masih bisa berbeda dari EIS (Mar, Mei, Jul, Agu ada 1–2 Tidak)')],
    ['kesesuaian|verifikasi dokumen elektronik elitigasi|0', diff('Belum ada aturan lokal (verifikasi di e-Court/MIS)')],

    // Kepatuhan (4: 1 mendekati/kuning, 3 belum sama/merah)
    ['kepatuhan|penginputan minutasi|0', diff('9/10 bln Jan–Okt cocok (semua Tidak cocok); Sep 6 vs EIS 7 (34/Pid.B proses_id=220 tak ada di SIPP)')],
    ['kepatuhan|kepatuhan penundaan jadwal sidang|0', warn('7/11 bln cocok (Jan–Mei, Agu, Okt) & 4/4 Tidak EIS tertangkap; Jun, Jul, Sep, Nov lokal lebih 1–5 baris')],
    ['kepatuhan|unggah putusan akhir|0', diff('6/11 bln cocok (Jan, Mar–Jun, Agu); Feb (6 vs 8/7/1), Jul, Sep, Okt, Nov selisih 1–5 berkas dari MIS')],
    ['kepatuhan|tanda tangan elektronik salinan putusan perkara pidana|0', diff('Jul–Nov Jumlah cocok, tapi Mar (4/3/1) & Okt (5/3/2) serta batch TTE Feb–Jun ada di e-Berpadu/MIS (salinan SIPP NULL)')]
]);

function partParity(tabId, label, index = 0) {
    const entry = UNALIGNED.get(`${normalize(tabId)}|${normalize(label)}|${index}`) ?? null;
    return { index, aligned: !entry, tier: entry?.tier ?? 'ok', note: entry?.note ?? null };
}

function rowParity(tabId, row) {
    const count = Math.max(1, Array.isArray(row?.details) ? row.details.length : 1);
    const parts = Array.from({ length: count }, (_, index) => partParity(tabId, row?.label, index));
    const unaligned = parts.filter((part) => !part.aligned);
    const tier = unaligned.some((part) => part.tier === 'diff') ? 'diff' : unaligned.length ? 'warn' : 'ok';
    return {
        aligned: unaligned.length === 0,
        tier,
        unalignedCount: unaligned.length,
        warnCount: unaligned.filter((part) => part.tier === 'warn').length,
        totalParts: parts.length,
        note: unaligned[0]?.note ?? null,
        parts
    };
}

module.exports = { partParity, rowParity, UNALIGNED };
