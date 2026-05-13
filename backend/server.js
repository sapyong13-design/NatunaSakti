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
const { generateLaporanBulanan, generateLaporanMingguan, convertDocxToPdf } = require('./services/laporanService');
const { generatePenutupanKasRtf } = require('./services/kasirRtfService');
const { generateRekapExcelXlsx } = require('./services/kasirExcelService');

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
const seedDbPath = path.join(dataDir, 'akurasi-seed.db');

// If database doesn't exist but seed exists, copy from seed
if (!fs.existsSync(dbPath) && fs.existsSync(seedDbPath)) {
    console.log('[Database] No database found, copying from seed...');
    fs.copyFileSync(seedDbPath, dbPath);
    console.log('[Database] Seed database copied. Ready for incremental sync (200 newest).');
}
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

// Test route for laporan data
app.get('/api/laporan-test', (req, res) => {
    console.log('[LAPORAN-TEST] Called!');
    res.json({ ok: true, message: 'Laporan test route works!' });
});

app.get('/api/kasir/templates/:type', (req, res) => {
    const templates = {
        'pemeriksaan-mendadak': {
            file: 'berita-acara-pemeriksaan-mendadak.docx',
            filename: 'BERITA_ACARA_PEMERIKSAAN_MENDADAK.docx',
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        },
        'penutupan-kas': {
            file: 'penutupan-kas.rtf',
            filename: 'PENUTUPAN_KAS_TEMPLATE.rtf',
            contentType: 'application/rtf'
        },
        'penutupan-rekap': {
            file: 'penutupan-rekap.xlsx',
            filename: 'PENUTUPAN_REKAP.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
    };

    const tpl = templates[req.params.type];
    if (!tpl) return res.status(404).json({ error: 'Template tidak ditemukan' });

    if (tpl.generate) {
        res.setHeader('Content-Type', tpl.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${tpl.filename}"`);
        return res.send(tpl.generate());
    }

    const templatePath = path.join(__dirname, 'templates', 'kasir', tpl.file);
    if (!fs.existsSync(templatePath)) return res.status(404).json({ error: 'File template tidak ditemukan' });

    res.setHeader('Content-Type', tpl.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${tpl.filename}"`);
    res.sendFile(templatePath);
});

app.post('/api/kasir/generate/penutupan-kas', (req, res) => {
    try {
        const rtf = generatePenutupanKasRtf(req.body || {});
        const bulan = (req.body?.bulanNama || 'PENUTUPAN_KAS').toString().replace(/[^\w-]+/g, '_');
        const tahun = req.body?.tahun || new Date().getFullYear();
        res.setHeader('Content-Type', 'application/rtf');
        res.setHeader('Content-Disposition', `attachment; filename="PENUTUPAN_KAS_${bulan}_${tahun}.rtf"`);
        res.send(rtf);
    } catch (error) {
        console.error('[KASIR-PENUTUPAN] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/kasir/generate/penutupan-rekap', (req, res) => {
    try {
        const workbook = generateRekapExcelXlsx(req.body || {});
        const bulan = (req.body?.bulanNama || 'REKAP').toString().replace(/[^\w-]+/g, '_');
        const tahun = req.body?.tahun || new Date().getFullYear();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="REKAP_KASIR_${bulan}_${tahun}.xlsx"`);
        res.send(workbook);
    } catch (error) {
        console.error('[KASIR-REKAP] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ========================
// LAPORAN DATA ROUTES (must come before general routes)
// ========================

// Get perkara data for monthly report (JSON, not file export)
// Returns perkara that registered OR had sidang in the specified month/year
app.get('/api/laporan/bulanan/:jenis/data', (req, res) => {
    console.log('[LAPORAN-DATA] Called!', req.params, req.query);
    try {
        const { jenis } = req.params;
        const bulan = parseInt(req.query.bulan);
        const tahun = parseInt(req.query.tahun);

        if (!bulan || bulan < 1 || bulan > 12)
            return res.status(400).json({ error: 'bulan harus 1-12' });
        if (!tahun || tahun < 2020 || tahun > 2100)
            return res.status(400).json({ error: 'tahun tidak valid' });

        const jenisCapital = jenis.charAt(0).toUpperCase() + jenis.slice(1).toLowerCase();

        const monthMap = {
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
        };

        function parseAnySippDate(s) {
            if (!s || typeof s !== 'string') return null;

            const isoMatch = s.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
                return {
                    day: parseInt(isoMatch[3]),
                    mon: parseInt(isoMatch[2]) - 1,
                    year: parseInt(isoMatch[1])
                };
            }

            const cleaned = s
                .replace(/^[^,]+,\s*/, '')
                .replace(/\./g, '')
                .trim();
            const parts = cleaned.split(/\s+/);
            if (parts.length < 3) return null;

            const day = parseInt(parts[0]);
            const monKey = parts[1].toLowerCase();
            const mon = monthMap[monKey] ?? monthMap[monKey.slice(0, 3)];
            const year = parseInt(parts[2]);
            if (isNaN(day) || mon === undefined || isNaN(year)) return null;
            return { day, mon, year };
        }

        // 1. Perkara yang terdaftar di bulan ini (via sipp_tanggal_register)
        const registeredRows = db.prepare(`
            SELECT * FROM perkara
            WHERE jenis_perkara = ?
            AND sipp_tanggal_register IS NOT NULL
            AND sipp_tanggal_register != ''
        `).all(jenisCapital);

        const registeredInMonth = new Set();
        for (const row of registeredRows) {
            const parsed = parseAnySippDate(row.sipp_tanggal_register);
            if (parsed && parsed.mon + 1 === bulan && parsed.year === tahun) {
                registeredInMonth.add(row.id);
            }
        }

        // 2. Perkara yang punya jadwal sidang di bulan ini
        const sidangRows = db.prepare(`
            SELECT DISTINCT p.*, j.tanggal as sidang_tanggal
            FROM perkara p
            INNER JOIN jadwal_sidang j ON j.nomor_perkara = p.nomor_perkara
            WHERE p.jenis_perkara = ?
            AND j.tanggal IS NOT NULL
            AND j.tanggal != ''
        `).all(jenisCapital);

        const withSidangInMonth = new Set();
        for (const row of sidangRows) {
            const parsed = parseAnySippDate(row.sidang_tanggal);
            if (parsed && parsed.mon + 1 === bulan && parsed.year === tahun) {
                withSidangInMonth.add(row.id);
            }
        }

        // 3. Merge: perkara yang daftar di bulan itu ATAU sidang di bulan itu
        const allIds = new Set([...registeredInMonth, ...withSidangInMonth]);
        const result = [];
        for (const id of allIds) {
            const row = db.prepare('SELECT * FROM perkara WHERE id = ?').get(id);
            if (row) {
                const registered = registeredInMonth.has(id);
                const sidang = withSidangInMonth.has(id);
                result.push({
                    ...row,
                    laporan_terdaftar_bulan_ini: registered,
                    laporan_sidang_bulan_ini: sidang,
                    laporan_kategori: registered && sidang
                        ? 'Terdaftar & Sidang'
                        : registered
                            ? 'Terdaftar'
                            : 'Sidang'
                });
            }
        }

        // Sort by sipp_tanggal_register
        result.sort((a, b) => {
            if (!a.sipp_tanggal_register) return 1;
            if (!b.sipp_tanggal_register) return -1;
            return a.sipp_tanggal_register.localeCompare(b.sipp_tanggal_register);
        });

        console.log('[LAPORAN-DATA] Returning', result.length, 'perkara');
        res.json({ data: result });
    } catch (err) {
        console.error('[LAPORAN-DATA] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get perkara data for weekly report (JSON, not file export)
// Returns perkara that registered OR had sidang in the selected date range.
app.get('/api/laporan/mingguan/:jenis/data', (req, res) => {
    console.log('[LAPORAN-MINGGUAN-DATA] Called!', req.params, req.query);
    try {
        const { jenis } = req.params;
        const { start, end } = req.query;

        if (!start || !end) return res.status(400).json({ error: 'start dan end wajib diisi' });

        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'rentang tanggal tidak valid' });
        }
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const jenisCapital = jenis.charAt(0).toUpperCase() + jenis.slice(1).toLowerCase();

        const monthMap = {
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
        };

        function parseAnySippDate(s) {
            if (!s || typeof s !== 'string') return null;

            const isoMatch = s.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));

            const cleaned = s
                .replace(/^[^,]+,\s*/, '')
                .replace(/\./g, '')
                .trim();
            const parts = cleaned.split(/\s+/);
            if (parts.length < 3) return null;

            const day = parseInt(parts[0]);
            const monKey = parts[1].toLowerCase();
            const mon = monthMap[monKey] ?? monthMap[monKey.slice(0, 3)];
            const year = parseInt(parts[2]);
            if (isNaN(day) || mon === undefined || isNaN(year)) return null;
            return new Date(year, mon, day);
        }

        function isInRange(date) {
            return date && date >= startDate && date <= endDate;
        }

        const perkaraRows = db.prepare(`
            SELECT * FROM perkara
            WHERE jenis_perkara = ?
        `).all(jenisCapital);

        const registeredInRange = new Set();
        const perkaraById = new Map();
        const perkaraByNomor = new Map();
        for (const row of perkaraRows) {
            perkaraById.set(row.id, row);
            perkaraByNomor.set(row.nomor_perkara, row);
            if (isInRange(parseAnySippDate(row.sipp_tanggal_register))) {
                registeredInRange.add(row.id);
            }
        }

        const sidangById = new Map();
        const sidangRows = db.prepare(`
            SELECT p.id, j.tanggal
            FROM perkara p
            INNER JOIN jadwal_sidang j ON j.nomor_perkara = p.nomor_perkara
            WHERE p.jenis_perkara = ?
            AND j.nomor IS NOT NULL
            AND j.tanggal IS NOT NULL
            AND j.tanggal != ''
            ORDER BY j.id
        `).all(jenisCapital);

        for (const row of sidangRows) {
            if (!isInRange(parseAnySippDate(row.tanggal))) continue;
            if (!sidangById.has(row.id)) sidangById.set(row.id, []);
            sidangById.get(row.id).push(row.tanggal);
        }

        const allIds = new Set([...registeredInRange, ...sidangById.keys()]);
        const result = [];
        for (const id of allIds) {
            const row = perkaraById.get(id);
            if (!row) continue;

            const registered = registeredInRange.has(id);
            const sidangDates = sidangById.get(id) || [];
            const sidang = sidangDates.length > 0;
            result.push({
                ...row,
                laporan_terdaftar_periode_ini: registered,
                laporan_sidang_periode_ini: sidang,
                laporan_tanggal_sidang: sidangDates,
                laporan_kategori: registered && sidang
                    ? 'Terdaftar & Sidang'
                    : registered
                        ? 'Terdaftar'
                        : 'Sidang'
            });
        }

        result.sort((a, b) => {
            const da = parseAnySippDate(a.sipp_tanggal_register);
            const db_ = parseAnySippDate(b.sipp_tanggal_register);
            if (!da && !db_) return 0;
            if (!da) return 1;
            if (!db_) return -1;
            return da - db_;
        });

        console.log('[LAPORAN-MINGGUAN-DATA] Returning', result.length, 'perkara');
        res.json({ data: result });
    } catch (err) {
        console.error('[LAPORAN-MINGGUAN-DATA] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ========================
// END LAPORAN DATA ROUTES
// ========================

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
        let data = stmt.all(...params);

        // Add first_sidang_soon flag for perkara with upcoming first sidang
        data = data.map(perkara => {
            // Check if this perkara has an upcoming first sidang
            const jadwalCheck = db.prepare(`
                SELECT nomor, COUNT(*) as count
                FROM jadwal_sidang
                WHERE nomor_perkara = ? AND nomor IS NOT NULL
            `).get(perkara.nomor_perkara);

            const isFirstSidang = jadwalCheck && jadwalCheck.count > 0 && jadwalCheck.nomor === 1;

            return {
                ...perkara,
                first_sidang_soon: isFirstSidang ? true : false
            };
        });

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

    // Prevent multiple syncs running simultaneously
    if (syncProgress.inProgress) {
        console.log('[SIPP-SYNC] Sync already in progress, rejecting request');
        return res.status(429).json({
            success: false,
            error: 'Sync already in progress',
            current: syncProgress.current,
            message: syncProgress.message
        });
    }

    try {
        // Check if first sync
        const oldCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
        const isFirstSync = oldCount === 0;

        syncProgress = {
            inProgress: true,
            current: 0,
            total: isFirstSync ? 9999 : 200, // First sync: unlimited, incremental: 200
            page: 0,
            message: isFirstSync ? 'First sync: mengambil SEMUA data...' : 'Sync incremental: 200 perkara terbaru...',
            error: null,
            isFirstSync
        };

        console.log(`[SIPP-SYNC] ${isFirstSync ? 'FIRST SYNC' : 'INCREMENTAL SYNC'} - Starting fetch...`);
        syncProgress.message = isFirstSync ? 'Mengambil semua data dari SIPP...' : 'Mengambil 200 perkara terbaru...';

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
            mode: isFirstSync ? 'full' : 'incremental',
            timestamp: new Date().toISOString(),
            message: isFirstSync
                ? `First sync complete: ${dbCount.c} total perkara di database`
                : `Synced ${count} perkara from SIPP (${dbCount.c} total in DB)`
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
            // Cache existence check: any row (real or sentinel) means we
            // already fetched this perkara. Real entries have nomor IS NOT NULL;
            // sentinel rows have all-null data and just mark "fetched, was empty".
            const hasCacheEntry = db.prepare(
                'SELECT 1 FROM jadwal_sidang WHERE nomor_perkara = ? LIMIT 1'
            ).get(nomorPerkara);

            if (hasCacheEntry) {
                const cached = db.prepare(`
                    SELECT nomor, tanggal, jam, agenda, ruangan,
                           alasan_ditunda AS alasanDitunda
                    FROM jadwal_sidang
                    WHERE nomor_perkara = ? AND nomor IS NOT NULL
                    ORDER BY id
                `).all(nomorPerkara);

                return res.json({
                    nomor_perkara: nomorPerkara,
                    jadwal: cached,
                    cached: true
                });
            }
            // 2026 tapi belum pernah ke-cache (populasi awal belum selesai) → fall through ke live
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

// Force refresh jadwal sidang for a perkara (bypass cache, re-fetch from SIPP)
app.post('/api/perkara/sipp/jadwal/:nomor/refresh', async (req, res) => {
    const nomorPerkara = decodeURIComponent(req.params.nomor);
    console.log('[SIPP-JADWAL-REFRESH] Called for:', nomorPerkara);
    const puppeteer = require('puppeteer');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await sippService.fetchAndCacheJadwal(nomorPerkara, page);

        const cached = db.prepare(`
            SELECT nomor, tanggal, jam, agenda, ruangan,
                   alasan_ditunda AS alasanDitunda
            FROM jadwal_sidang
            WHERE nomor_perkara = ? AND nomor IS NOT NULL
            ORDER BY id
        `).all(nomorPerkara);

        res.json({
            nomor_perkara: nomorPerkara,
            jadwal: cached,
            cached: true,
            refreshed: true
        });
    } catch (error) {
        console.error('[SIPP-JADWAL-REFRESH] error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

// Trend pendaftaran per minggu (last N weeks, max 52)
app.get('/api/perkara/trend', (req, res) => {
    try {
        const weeks = Math.max(1, Math.min(52, parseInt(req.query.weeks) || 8));
        const rows = db.prepare(`
            SELECT jenis_perkara, sipp_tanggal_register
            FROM perkara
            WHERE sipp_tanggal_register IS NOT NULL AND sipp_tanggal_register != ''
        `).all();

        const monthMap = {
            jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, jun: 5,
            jul: 6, agu: 7, sep: 8, okt: 9, nov: 10, des: 11
        };

        function parseTanggal(s) {
            const parts = s.trim().split(/\s+/);
            if (parts.length < 3) return null;
            const day = parseInt(parts[0]);
            const monKey = parts[1].toLowerCase().slice(0, 3);
            const enMap = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
            const mon = monthMap[monKey] ?? enMap[monKey];
            const year = parseInt(parts[2]);
            if (mon === undefined || isNaN(day) || isNaN(year)) return null;
            return new Date(year, mon, day);
        }

        const now = new Date();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const buckets = Array.from({ length: weeks }, () => ({ pidana: 0, perdata: 0 }));

        for (const r of rows) {
            const d = parseTanggal(r.sipp_tanggal_register);
            if (!d) continue;
            const diff = now - d;
            if (diff < 0) continue;
            const weekIdx = Math.floor(diff / weekMs);
            if (weekIdx >= weeks) continue;
            const bucketIdx = weeks - 1 - weekIdx;
            if (r.jenis_perkara === 'Pidana') buckets[bucketIdx].pidana++;
            else if (r.jenis_perkara === 'Perdata') buckets[bucketIdx].perdata++;
        }

        const result = buckets.map((b, i) => ({
            week: `W${i + 1}`,
            pidana: b.pidana,
            perdata: b.perdata
        }));
        res.json(result);
    } catch (error) {
        console.error('[TREND] error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Trend pendaftaran per bulan (monthly trend for a specific year)
app.get('/api/perkara/trend/monthly', (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const rows = db.prepare(`
            SELECT jenis_perkara, sipp_tanggal_register
            FROM perkara
            WHERE sipp_tanggal_register IS NOT NULL AND sipp_tanggal_register != ''
        `).all();

        const monthMap = {
            jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, jun: 5,
            jul: 6, agu: 7, sep: 8, okt: 9, nov: 10, des: 11
        };

        function parseTanggal(s) {
            const parts = s.trim().split(/\s+/);
            if (parts.length < 3) return null;
            const day = parseInt(parts[0]);
            const monKey = parts[1].toLowerCase().slice(0, 3);
            const enMap = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
            const mon = monthMap[monKey] ?? enMap[monKey];
            const yr = parseInt(parts[2]);
            if (mon === undefined || isNaN(day) || isNaN(yr)) return null;
            return new Date(yr, mon, day);
        }

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const buckets = Array.from({ length: 12 }, () => ({ pidana: 0, perdata: 0, perikanan: 0 }));

        for (const r of rows) {
            const d = parseTanggal(r.sipp_tanggal_register);
            if (!d) continue;
            if (d.getFullYear() !== year) continue;
            const monthIdx = d.getMonth();
            if (monthIdx < 0 || monthIdx > 11) continue;
            if (r.jenis_perkara === 'Pidana') buckets[monthIdx].pidana++;
            else if (r.jenis_perkara === 'Perdata') buckets[monthIdx].perdata++;
            else if (r.jenis_perkara === 'Perikanan') buckets[monthIdx].perikanan++;
        }

        const result = buckets.map((b, i) => ({
            month: monthNames[i],
            pidana: b.pidana,
            perdata: b.perdata,
            perikanan: b.perikanan
        }));
        res.json(result);
    } catch (error) {
        console.error('[TREND-MONTHLY] error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Trend pendaftaran per tahun (yearly trend for all years)
app.get('/api/perkara/trend/yearly', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT jenis_perkara, tahun_masuk
            FROM perkara
            WHERE tahun_masuk IS NOT NULL
        `).all();

        // Get all unique years, sorted
        const yearSet = new Set();
        for (const r of rows) {
            if (r.tahun_masuk) yearSet.add(r.tahun_masuk);
        }
        const years = Array.from(yearSet).sort((a, b) => a - b);

        // Initialize buckets for each year
        const buckets = {};
        for (const yr of years) {
            buckets[yr] = { pidana: 0, perdata: 0, perikanan: 0 };
        }

        // Fill buckets
        for (const r of rows) {
            const yr = r.tahun_masuk;
            if (!buckets[yr]) continue;
            if (r.jenis_perkara === 'Pidana') buckets[yr].pidana++;
            else if (r.jenis_perkara === 'Perdata') buckets[yr].perdata++;
            else if (r.jenis_perkara === 'Perikanan') buckets[yr].perikanan++;
        }

        const result = years.map(yr => ({
            year: String(yr),
            pidana: buckets[yr].pidana,
            perdata: buckets[yr].perdata,
            perikanan: buckets[yr].perikanan
        }));
        res.json(result);
    } catch (error) {
        console.error('[TREND-YEARLY] error:', error.message);
        res.status(500).json({ error: error.message });
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

// ========================
// LAPORAN EXPORT ROUTES
// ========================

app.get('/api/laporan/bulanan/:jenis', (req, res) => {
    try {
        const { jenis } = req.params;
        const bulan  = parseInt(req.query.bulan);
        const tahun  = parseInt(req.query.tahun);
        const format = (req.query.format || 'docx').toLowerCase();

        if (!bulan || bulan < 1 || bulan > 12)
            return res.status(400).json({ error: 'bulan harus 1-12' });
        if (!tahun || tahun < 2020 || tahun > 2100)
            return res.status(400).json({ error: 'tahun tidak valid' });

        const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni',
                             'Juli','Agustus','September','Oktober','November','Desember'];
        const bulanNama    = BULAN_NAMES[bulan - 1];
        const jenisCapital = jenis.charAt(0).toUpperCase() + jenis.slice(1).toLowerCase();

        const docxBuf = generateLaporanBulanan(db, jenisCapital, bulan, tahun);

        if (format === 'pdf') {
            const pdfBuf  = convertDocxToPdf(docxBuf);
            const filename = `Akurasi_${jenisCapital}_${bulanNama}_${tahun}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(pdfBuf);
        }

        const filename = `Akurasi_${jenisCapital}_${bulanNama}_${tahun}.docx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(docxBuf);
    } catch (err) {
        console.error('[LAPORAN] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/laporan/mingguan/:jenis', (req, res) => {
    try {
        const { jenis }  = req.params
        const { start, end, format = 'docx' } = req.query

        if (!start || !end) return res.status(400).json({ error: 'start dan end wajib diisi' })

        const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni',
                             'Juli','Agustus','September','Oktober','November','Desember']
        const jenisCapital = jenis.charAt(0).toUpperCase() + jenis.slice(1).toLowerCase()
        const startDate    = new Date(start)
        const bulanNama    = BULAN_NAMES[startDate.getMonth()]
        const tahun        = startDate.getFullYear()
        const mingguKe     = Math.min(5, Math.ceil(startDate.getDate() / 7))
        const MINGGU_ROMAN = ['I','II','III','IV','V']

        const docxBuf  = generateLaporanMingguan(db, jenisCapital, start, end)
        const filename = `Akurasi_${jenisCapital}_${bulanNama}_MingguKe${MINGGU_ROMAN[mingguKe-1]}_${tahun}`

        if (format === 'pdf') {
            const pdfBuf = convertDocxToPdf(docxBuf)
            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`)
            return res.send(pdfBuf)
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.docx"`)
        res.send(docxBuf)
    } catch (err) {
        console.error('[LAPORAN-MINGGUAN] Error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

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
        const oldCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
        const isFirstSync = oldCount === 0;
        console.log(`[CRON] Starting ${isFirstSync ? 'FIRST' : 'INCREMENTAL'} SIPP sync...`);

        const data = await sippService.fetchSIPPData();
        const count = await sippService.saveToDatabase(data);
        const newCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;

        console.log(`[CRON] Sync completed: ${count} perkara fetched, ${newCount - oldCount} new, ${newCount} total`);

        // Refresh jadwal cache untuk 100 perkara terbaru
        console.log('[CRON] Refreshing jadwal cache (100 newest perkara)...');
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

    // Initial populate jadwal cache untuk 100 perkara terbaru (fire-and-forget, jangan blok startup)
    const cachedCount = db.prepare('SELECT COUNT(*) AS n FROM jadwal_sidang').get().n;
    if (cachedCount === 0) {
        console.log('[CACHE] empty on startup, populating jadwal cache for 100 newest perkara...');
        sippService.cacheJadwalCurrentYear()
            .then(r => console.log('[CACHE] startup populate done:', r))
            .catch(e => console.error('[CACHE] startup populate error:', e.message));
    } else {
        console.log(`[CACHE] ${cachedCount} jadwal rows already cached, skipping initial populate`);
    }
});
