const VALID_TYPES = new Set(['bulanan', 'mingguan']);

function ensureReportHistorySchema(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS laporan_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipe TEXT NOT NULL,
            jenis TEXT NOT NULL,
            periode_label TEXT NOT NULL,
            bulan INTEGER,
            tahun INTEGER,
            start_date TEXT,
            end_date TEXT,
            format TEXT NOT NULL,
            filename TEXT NOT NULL,
            generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_laporan_history_tipe ON laporan_history(tipe);
        CREATE INDEX IF NOT EXISTS idx_laporan_history_jenis ON laporan_history(jenis);
        CREATE INDEX IF NOT EXISTS idx_laporan_history_generated ON laporan_history(generated_at);
    `);
}

function normalizeHistoryPayload(payload) {
    const tipe = String(payload.tipe || '').toLowerCase();
    if (!VALID_TYPES.has(tipe)) throw new Error('tipe laporan tidak valid');

    const jenis = String(payload.jenis || '').trim();
    const periodeLabel = String(payload.periode_label || '').trim();
    const format = String(payload.format || '').toLowerCase().trim();
    const filename = String(payload.filename || '').trim();

    if (!jenis) throw new Error('jenis laporan wajib diisi');
    if (!periodeLabel) throw new Error('periode laporan wajib diisi');
    if (!format) throw new Error('format laporan wajib diisi');
    if (!filename) throw new Error('nama file laporan wajib diisi');

    return {
        tipe,
        jenis,
        periode_label: periodeLabel,
        bulan: payload.bulan == null ? null : Number(payload.bulan),
        tahun: payload.tahun == null ? null : Number(payload.tahun),
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
        format,
        filename
    };
}

function createReportHistory(db, payload) {
    const item = normalizeHistoryPayload(payload);
    const result = db.prepare(`
        INSERT INTO laporan_history (
            tipe, jenis, periode_label, bulan, tahun, start_date, end_date, format, filename
        )
        VALUES (@tipe, @jenis, @periode_label, @bulan, @tahun, @start_date, @end_date, @format, @filename)
    `).run(item);

    return db.prepare('SELECT * FROM laporan_history WHERE id = ?').get(result.lastInsertRowid);
}

function listReportHistory(db, filters = {}) {
    const where = [];
    const params = {};

    if (filters.tipe) {
        where.push('tipe = @tipe');
        params.tipe = String(filters.tipe).toLowerCase();
    }
    if (filters.jenis) {
        where.push('jenis = @jenis');
        params.jenis = String(filters.jenis).trim();
    }

    const sql = `
        SELECT * FROM laporan_history
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY datetime(generated_at) DESC, id DESC
        LIMIT 100
    `;
    return db.prepare(sql).all(params);
}

function deleteReportHistory(db, id) {
    const result = db.prepare('DELETE FROM laporan_history WHERE id = ?').run(id);
    return result.changes > 0;
}

module.exports = {
    ensureReportHistorySchema,
    createReportHistory,
    listReportHistory,
    deleteReportHistory
};
