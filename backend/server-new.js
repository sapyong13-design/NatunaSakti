// ============================================
// BACKEND SERVER - Akurasi Kepaniteraan
// Pengadilan Negeri Natuna Kelas IB
// Database: SQLite (local)
// ============================================

console.log('[SERVER-FILE-LOAD] Timestamp:', Date.now(), 'File:', __filename);

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const SIPPSyncService = require('./services/sippSyncService');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup SQLite Database
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'akurasi.db');
const db = new Database(dbPath);

// Setup Database Schema
function setupDatabase() {
    // Cek apakah tabel perkara ada
    const tableExists = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='perkara'
    `).get();

    if (!tableExists) {
        // Tabel baru, buat dengan schema lengkap
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
        // Tabel sudah ada, cek dan tambahkan kolom yang hilang
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

        // Create index if not exists
        try {
            db.exec('CREATE INDEX IF NOT EXISTS idx_sipp_synced ON perkara(sipp_synced)');
        } catch (error) {
            // Index might already exist
        }
    }
}

setupDatabase();

// Initialize SIPP Sync Service
const sippService = new SIPPSyncService(db);
console.log('[SIPP] Service initialized');

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

// Get all perkara
app.get('/api/perkara', (req, res) => {
    try {
        const { jenis_perkara, tahun_masuk } = req.query;

        let query = 'SELECT * FROM perkara ORDER BY created_at DESC';
        const params = [];

        if (jenis_perkara || tahun_masuk) {
            const conditions = [];
            if (jenis_perkara) {
                conditions.push('jenis_perkara = ?');
                params.push(jenis_perkara);
            }
            if (tahun_masuk) {
                conditions.push('tahun_masuk = ?');
                params.push(tahun_masuk);
            }
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const stmt = db.prepare(query);
        const data = stmt.all(...params);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test route BEFORE range - inline
app.get('/api/new-test-route', (req, res) => res.json({ok: true, test: 'before-range'}));

// Get perkara by date range (untuk laporan)
app.get('/api/perkara/range', (req, res) => {
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

// Test route immediately after range
app.get('/api/immediate-test', (req, res) => {
    console.log('[TEST-ROUTE] CALLED!!!');
    res.json({ message: 'Immediate test works!', timestamp: Date.now() });
});

// ========================
// SIPP SYNC ROUTES
// ========================
// NOTE: Must be before /api/perkara/:id to avoid route conflicts

// Sync status endpoint
app.get('/api/perkara/sipp/status', (req, res) => {
    console.log('[SIPP-STATUS-ROUTE] CALLED!!!');
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

// Manual sync endpoint
/*
app.post('/api/perkara/sipp/sync', async (req, res) => {
    try {
        console.log('[SIPP] Manual sync triggered');
        const data = await sippService.fetchSIPPData();
        const count = await sippService.saveToDatabase(data);
        res.json({
            success: true,
            synced: count,
            timestamp: new Date().toISOString(),
            message: `Synced ${count} perkara from SIPP`
        });
    } catch (error) {
        console.error('[SIPP] Sync error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
*/

console.log('[DEBUG] SIPP routes registered!');

// Get perkara by ID
app.get('/api/perkara/:id', (req, res) => {
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

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database: ${dbPath}`);
});
