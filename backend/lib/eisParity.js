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

    // Kepatuhan (19)
    ['kepatuhan|penetapan hari sidang pertama|0', diff('Selisih filter 1–2 perkara di Agu & Okt (10, 10, 13 vs 8, 10, 12)')],
    ['kepatuhan|penginputan minutasi|0', diff('Sep selisih 1 perkara (proses_id=220 tak tercatat di SIPP)')],
    ['kepatuhan|pengiriman berkas banding|0', diff('Okt selisih 1 kasus (4/4/0 vs EIS 5/5/0)')],
    ['kepatuhan|pengiriman berkas banding|1', diff('Bagian inzage masih mode evidence (0/0/0 vs EIS 1, 4, 1)')],
    ['kepatuhan|pengiriman berkas banding|2', diff('Okt batas 30/14 hari beda (1/0/1 vs EIS 1/1/0)')],
    ['kepatuhan|pengiriman berkas kasasi|0', diff('Sep beda batas hari (2/0/2 vs EIS 2/2/0)')],
    ['kepatuhan|pengiriman berkas kasasi|2', diff('Okt 0/0/0 vs EIS 3/0/0 (EIS tampilkan 3 tanpa sesuai/tidak)')],
    ['kepatuhan|pengiriman berkas peninjauan kembali|0', diff('Kosong (//) di EIS pada Agu–Okt')],
    ['kepatuhan|pengiriman berkas peninjauan kembali|1', diff('Kosong (//) di EIS pada Agu–Okt')],
    ['kepatuhan|pengiriman berkas peninjauan kembali|2', diff('Kosong (//) di EIS pada Agu–Okt')],
    ['kepatuhan|pengiriman berkas peninjauan kembali|3', diff('Kosong (//) di EIS pada Agu–Okt')],
    ['kepatuhan|pemberitahuan putusan/penentapan|0', diff('Sep & Okt proses_id=218 lokal lebih banyak (6 vs 3, 11 vs 10)')],
    ['kepatuhan|penginputan penetapan majelis/hakim|0', diff('Agu & Sep lebih banyak (20, 16, 17 vs EIS 14, 14, 17)')],
    ['kepatuhan|penginputan penunjukan panitera pengganti|0', diff('Populasi tak cocok tabel penugasan maupun penetapan (13, 18, 22 vs 6, 10, 19)')],
    ['kepatuhan|penginputan penetapan hari sidang|0', diff('Sep selisih 1 perkara (10 vs EIS 11)')],
    ['kepatuhan|kepatuhan penundaan jadwal sidang|0', diff('7/10 bln cocok (Jan–Mei, Agu, Okt); Jun, Jul, Sep selisih 2–5 (38/36, 67/62, 44/42)')],
    ['kepatuhan|unggah putusan akhir|0', diff('6/10 bln cocok (Jan, Mar–Jun, Agu); Feb, Jul, Sep, Okt selisih 1–5 berkas')],
    ['kepatuhan|tanda tangan elektronik salinan putusan perkara pidana|0', diff('Jumlah 3/3 cocok, tapi Sesuai/Tidak Okt (3/2) tak bisa dicek (salinan NULL)')]
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
