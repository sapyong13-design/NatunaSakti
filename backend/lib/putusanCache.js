function ensurePutusanSchema(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS putusan_perkara (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nomor_perkara TEXT NOT NULL UNIQUE,
            tanggal_putusan TEXT,
            amar_putusan TEXT,
            status_putusan TEXT,
            tanggal_minutasi TEXT,
            majelis_hakim TEXT,
            panitera_pengganti TEXT,
            raw_text TEXT,
            raw_json TEXT,
            fetched_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_putusan_nomor ON putusan_perkara(nomor_perkara);
    `);
}

function normalizePutusanPayload(putusan) {
    const p = putusan || {};
    return {
        tanggal_putusan: p.tanggal_putusan || null,
        amar_putusan: p.amar_putusan || null,
        status_putusan: p.status_putusan || null,
        tanggal_minutasi: p.tanggal_minutasi || null,
        majelis_hakim: p.majelis_hakim || null,
        panitera_pengganti: p.panitera_pengganti || null,
        raw_text: p.raw_text || '',
        raw: Array.isArray(p.raw) ? p.raw : []
    };
}

function savePutusanCache(db, nomorPerkara, putusan) {
    const payload = normalizePutusanPayload(putusan);
    const fetchedAt = new Date().toISOString();
    const stmt = db.prepare(`
        INSERT INTO putusan_perkara
        (nomor_perkara, tanggal_putusan, amar_putusan, status_putusan, tanggal_minutasi,
         majelis_hakim, panitera_pengganti, raw_text, raw_json, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(nomor_perkara) DO UPDATE SET
            tanggal_putusan = excluded.tanggal_putusan,
            amar_putusan = excluded.amar_putusan,
            status_putusan = excluded.status_putusan,
            tanggal_minutasi = excluded.tanggal_minutasi,
            majelis_hakim = excluded.majelis_hakim,
            panitera_pengganti = excluded.panitera_pengganti,
            raw_text = excluded.raw_text,
            raw_json = excluded.raw_json,
            fetched_at = excluded.fetched_at
    `);

    stmt.run(
        nomorPerkara,
        payload.tanggal_putusan,
        payload.amar_putusan,
        payload.status_putusan,
        payload.tanggal_minutasi,
        payload.majelis_hakim,
        payload.panitera_pengganti,
        payload.raw_text,
        JSON.stringify(payload.raw),
        fetchedAt
    );

    return getPutusanCache(db, nomorPerkara);
}

function getPutusanCache(db, nomorPerkara) {
    const row = db.prepare(`
        SELECT nomor_perkara, tanggal_putusan, amar_putusan, status_putusan,
               tanggal_minutasi, majelis_hakim, panitera_pengganti,
               raw_text, raw_json, fetched_at
        FROM putusan_perkara
        WHERE nomor_perkara = ?
    `).get(nomorPerkara);

    if (!row) return null;

    let raw = [];
    try {
        raw = row.raw_json ? JSON.parse(row.raw_json) : [];
    } catch (_) {
        raw = [];
    }

    return {
        ...row,
        raw
    };
}

module.exports = {
    ensurePutusanSchema,
    savePutusanCache,
    getPutusanCache
};
