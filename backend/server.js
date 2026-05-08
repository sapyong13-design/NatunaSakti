// ============================================
// BACKEND SERVER - Akurasi Kepaniteraan
// Minimal working version
// ============================================

console.log('[SERVER-FILE-LOAD] Timestamp:', Date.now(), 'File:', __filename);

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const SIPPSyncService = require('./services/sippSyncService');
const sippRoutes = require('./routes/sipp');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// Setup SQLite Database
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'akurasi.db');
const db = new Database(dbPath);

// Setup Database Schema
function setupDatabase() {
    const tableExists = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='perkara'
    `).get();

    if (!tableExists) {
        db.exec(`
            CREATE TABLE perkara (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nama_perkara TEXT NOT NULL,
                nomor_perkara TEXT UNIQUE NOT NULL,
                para_pihak TEXT NOT NULL,
                tahun_masuk INTEGER NOT NULL,
                tanggal_putus TEXT,
                keterangan TEXT,
                jenis_perkara TEXT NOT NULL,
                sipp_synced INTEGER DEFAULT 0,
                sipp_status TEXT,
                sipp_lama_proses TEXT,
                sipp_tanggal_register TEXT,
                sipp_klasifikasi TEXT,
                sipp_last_sync TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX idx_tahun_masuk ON perkara(tahun_masuk);
            CREATE INDEX idx_jenis_perkara ON perkara(jenis_perkara);
            CREATE INDEX idx_tanggal_putus ON perkara(tanggal_putus);
            CREATE INDEX idx_sipp_synced ON perkara(sipp_synced);
        `);
        console.log('[Database] Created new table with SIPP columns');
    } else {
        const existingColumns = db.prepare("PRAGMA table_info(perkara)").all();
        const existingColumnNames = existingColumns.map(col => col.name);

        const sippColumns = {
            sipp_synced: 'INTEGER DEFAULT 0',
            sipp_status: 'TEXT',
            sipp_lama_proses: 'TEXT',
            sipp_tanggal_register: 'TEXT',
            sipp_klasifikasi: 'TEXT',
            sipp_last_sync: 'TEXT'
        };

        for (const [col, colDef] of Object.entries(sippColumns)) {
            if (!existingColumnNames.includes(col)) {
                try {
                    db.exec(`ALTER TABLE perkara ADD COLUMN ${col} ${colDef}`);
                    console.log(`[Migration] Added column: ${col}`);
                } catch (error) {
                    if (!error.message.includes('duplicate column')) {
                        console.log(`[Migration] Warning for ${col}:`, error.message);
                    }
                }
            }
        }

        try {
            db.exec('CREATE INDEX IF NOT EXISTS idx_sipp_synced ON perkara(sipp_synced)');
        } catch (error) {
            // Index might already exist
        }
    }

    // jadwal_sidang cache (per design: 2026-05-07-jadwal-sidang-cache-design.md)
    db.exec(`
        CREATE TABLE IF NOT EXISTS jadwal_sidang (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nomor_perkara TEXT NOT NULL,
            nomor INTEGER,
            tanggal TEXT,
            jam TEXT,
            agenda TEXT,
            ruangan TEXT,
            alasan_ditunda TEXT,
            fetched_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_jadwal_nomor ON jadwal_sidang(nomor_perkara);
    `);
}

setupDatabase();

// Initialize SIPP Sync Service
const sippService = new SIPPSyncService(db);
console.log('[SIPP] Service initialized');

// Make db and sippService available to routes
app.set('db', db);
app.set('sippService', sippService);

// Sync progress state (in-memory for SSE clients)
let syncProgress = {
    inProgress: false,
    current: 0,
    total: 0,
    page: 0,
    message: '',
    error: null
};

console.log('Database connected:', dbPath);

// ========================
// ROUTES
// ========================

app.get('/', (req, res) => {
    res.json({
        message: 'API Akurasi Kepaniteraan - PN Natuna',
        version: '1.0.0',
        database: 'SQLite (local)'
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test route
app.get('/api/test', (req, res) => {
    console.log('[TEST] Called!');
    res.json({ ok: true, message: 'Test route works!' });
});

// Get all perkara
app.get('/api/perkara', (req, res) => {
    try {
        const { jenis_perkara, tahun_masuk, page = 1, limit = 50 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = 'SELECT * FROM perkara';
        let countQuery = 'SELECT COUNT(*) as total FROM perkara';
        const params = [];
        const countParams = [];

        if (jenis_perkara || tahun_masuk) {
            const conditions = [];
            if (jenis_perkara) {
                conditions.push('jenis_perkara = ?');
                params.push(jenis_perkara);
                countParams.push(jenis_perkara);
            }
            if (tahun_masuk) {
                conditions.push('tahun_masuk = ?');
                params.push(tahun_masuk);
                countParams.push(tahun_masuk);
            }
            query += ' WHERE ' + conditions.join(' AND ');
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const stmt = db.prepare(query);
        const data = stmt.all(...params);

        const countStmt = db.prepare(countQuery);
        const countResult = countStmt.get(...countParams);
        const total = countResult.total;

        res.json({
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get perkara by date range
app.get('/api/perkara/range', (req, res) => {
    console.log('[RANGE] Called!');
    try {
        const { start_date, end_date, jenis_perkara } = req.query;

        let query = 'SELECT * FROM perkara WHERE tanggal_putus IS NOT NULL';
        const params = [];

        if (start_date && end_date) {
            query += ' AND date(tanggal_putus) BETWEEN date(?) AND date(?)';
            params.push(start_date, end_date);
        }

        if (jenis_perkara) {
            query += ' AND jenis_perkara = ?';
            params.push(jenis_perkara);
        }

        query += ' ORDER BY tanggal_putus ASC';

        const stmt = db.prepare(query);
        const data = stmt.all(...params);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test route for debugging
app.get('/api/immediate-test', (req, res) => {
    console.log('[IMMEDIATE-TEST] Called!');
    res.json({ message: 'Immediate test works!', timestamp: Date.now() });
});

// SIPP Router - MUST come before /api/perkara/:id
app.use('/api/perkara/sipp', sippRoutes);

// Inline SIPP status endpoint
app.get('/api/perkara/sipp/status', (req, res) => {
    console.log('[SIPP-STATUS] Called!');
    try {
        const stmt = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN sipp_synced = 1 THEN 1 ELSE 0 END) as sipp_synced,
                MAX(sipp_last_sync) as last_sync
            FROM perkara
        `);
        const stats = stmt.get();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SSE endpoint for sync progress
app.get('/api/perkara/sipp/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send current progress immediately
    res.write(`data: ${JSON.stringify(syncProgress)}\n\n`);

    // Keep connection open and send updates
    const interval = setInterval(() => {
        res.write(`data: ${JSON.stringify(syncProgress)}\n\n`);
    }, 500);

    req.on('close', () => {
        clearInterval(interval);
    });
});

// Manual sync endpoint
app.post('/api/perkara/sipp/sync', async (req, res) => {
    console.log('[SIPP-SYNC] Called!');
    try {
        syncProgress = {
            inProgress: true,
            current: 0,
            total: 200, // Target (10 pages × 20)
            page: 0,
            message: 'Memulai sync...',
            error: null
        };

        // Get old count
        const oldCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;

        console.log('[SIPP-SYNC] Starting fetch...');
        syncProgress.message = 'Mengambil data dari SIPP...';

        const data = await sippService.fetchSIPPData((progress) => {
            // Progress callback during fetch
            syncProgress.current = progress.current;
            syncProgress.page = progress.page;
            syncProgress.message = `Fetching halaman ${progress.page}... (${progress.current} perkara)`;
            console.log(`[SIPP-SYNC] ${syncProgress.message}`);
        });

        console.log(`[SIPP-SYNC] Fetched ${data.length} items`);
        syncProgress.message = 'Menyimpan ke database...';

        console.log('[SIPP-SYNC] Starting save...');
        const count = await sippService.saveToDatabase(data);
        console.log(`[SIPP-SYNC] Saved count: ${count}`);

        // Get actual DB count
        const dbCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get();
        console.log(`[SIPP-SYNC] Actual DB count: ${dbCount.c}`);

        syncProgress.inProgress = false;
        syncProgress.message = `Selesai! ${count} perkara di-sync`;
        syncProgress.current = count;

        res.json({
            success: true,
            fetched: count,
            total_in_db: dbCount.c,
            new_items: dbCount.c - oldCount,
            timestamp: new Date().toISOString(),
            message: `Synced ${count} perkara from SIPP (${dbCount.c} total in DB)`
        });
    } catch (error) {
        console.error('[SIPP] Sync error:', error.message);
        syncProgress.inProgress = false;
        syncProgress.error = error.message;
        syncProgress.message = 'Error: ' + error.message;
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get jadwal sidang for a perkara
app.get('/api/perkara/sipp/jadwal/:nomor', async (req, res) => {
    console.log('[SIPP-JADWAL] Called for:', req.params.nomor);
    try {
        const nomorPerkara = decodeURIComponent(req.params.nomor);
        const currentYear = new Date().getFullYear();

        // Cek tahun perkara
        const row = db.prepare(
            'SELECT tahun_masuk FROM perkara WHERE nomor_perkara = ?'
        ).get(nomorPerkara);

        if (row?.tahun_masuk === currentYear) {
            // Cache hit path: baca dari DB, instant
            const cached = db.prepare(`
                SELECT nomor, tanggal, jam, agenda, ruangan,
                       alasan_ditunda AS alasanDitunda
                FROM jadwal_sidang
                WHERE nomor_perkara = ?
                ORDER BY id
            `).all(nomorPerkara);

            if (cached.length > 0) {
                return res.json({
                    nomor_perkara: nomorPerkara,
                    jadwal: cached,
                    cached: true
                });
            }
            // 2026 tapi cache miss (mungkin populasi awal belum selesai) → fall through ke live
        }

        // Non-current-year atau cache miss → live scrape
        const jadwal = await sippService.fetchJadwalSidang(nomorPerkara);
        res.json({
            nomor_perkara: nomorPerkara,
            jadwal,
            cached: false
        });
    } catch (error) {
        console.error('[SIPP] Jadwal error:', error.message);
        res.status(500).json({
            error: error.message
        });
    }
});

// Get perkara by ID - MUST be last
app.get('/api/perkara/:id', (req, res) => {
    console.log('[PERKARA-ID] Called with id:', req.params.id);
    try {
        const stmt = db.prepare('SELECT * FROM perkara WHERE id = ?');
        const data = stmt.get(req.params.id);
        if (!data) {
            return res.status(404).json({ error: 'Perkara not found' });
        }
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create perkara
app.post('/api/perkara', (req, res) => {
    try {
        const { nama_perkara, nomor_perkara, para_pihak, tahun_masuk, tanggal_putus, keterangan, jenis_perkara } = req.body;

        const stmt = db.prepare(`
            INSERT INTO perkara (nama_perkara, nomor_perkara, para_pihak, tahun_masuk, tanggal_putus, keterangan, jenis_perkara)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(nama_perkara, nomor_perkara, para_pihak, tahun_masuk, tanggal_putus || null, keterangan || null, jenis_perkara);

        const newPerkara = db.prepare('SELECT * FROM perkara WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newPerkara);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ error: 'Nomor perkara sudah ada' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Update perkara
app.put('/api/perkara/:id', (req, res) => {
    try {
        const { nama_perkara, nomor_perkara, para_pihak, tahun_masuk, tanggal_putus, keterangan, jenis_perkara } = req.body;

        const stmt = db.prepare(`
            UPDATE perkara
            SET nama_perkara = ?, nomor_perkara = ?, para_pihak = ?, tahun_masuk = ?,
                tanggal_putus = ?, keterangan = ?, jenis_perkara = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        const result = stmt.run(nama_perkara, nomor_perkara, para_pihak, tahun_masuk, tanggal_putus || null, keterangan || null, jenis_perkara, req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Perkara not found' });
        }

        const updatedPerkara = db.prepare('SELECT * FROM perkara WHERE id = ?').get(req.params.id);
        res.json(updatedPerkara);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete perkara
app.delete('/api/perkara/:id', (req, res) => {
    try {
        const stmt = db.prepare('DELETE FROM perkara WHERE id = ?');
        const result = stmt.run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Perkara not found' });
        }

        res.json({ message: 'Perkara deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handler (should be last)
app.use((err, req, res, next) => {
    console.error('[ERROR] Unhandled error:', err);
    res.status(500).json({ error: err.message });
});

// 404 handler
app.use((req, res) => {
    console.log('[404] Route not found:', req.method, req.url);
    res.status(404).json({ error: 'Not found', path: req.url });
});

// ========================
// AUTO-SYNC CRON JOB
// ========================
// Run every hour: 0 * * * *
console.log('[CRON] Setting up SIPP sync schedule (every hour)');

const syncTask = cron.schedule('0 * * * *', async () => {
    try {
        console.log('[CRON] Starting scheduled SIPP sync...');
        const data = await sippService.fetchSIPPData();
        const count = await sippService.saveToDatabase(data);
        console.log(`[CRON] Sync completed: ${count} perkara updated`);

        // Refresh jadwal cache untuk perkara tahun berjalan
        console.log('[CRON] Refreshing jadwal cache...');
        const cacheResult = await sippService.cacheJadwalCurrentYear();
        console.log('[CRON] Jadwal cache refreshed:', cacheResult);
    } catch (error) {
        console.error('[CRON] Sync error:', error.message);
    }
}, {
    scheduled: false // Don't start immediately
});

// Start the cron job
syncTask.start();
console.log('[CRON] Auto-sync enabled (runs every hour at minute 0)');

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database: ${dbPath}`);

    // Initial populate jadwal cache kalau kosong (fire-and-forget, jangan blok startup)
    const cachedCount = db.prepare('SELECT COUNT(*) AS n FROM jadwal_sidang').get().n;
    if (cachedCount === 0) {
        console.log('[CACHE] empty on startup, populating jadwal cache for current year...');
        sippService.cacheJadwalCurrentYear()
            .then(r => console.log('[CACHE] startup populate done:', r))
            .catch(e => console.error('[CACHE] startup populate error:', e.message));
    } else {
        console.log(`[CACHE] ${cachedCount} jadwal rows already cached, skipping initial populate`);
    }
});
