// ============================================
// BACKEND SERVER - Akurasi Kepaniteraan
// Pengadilan Negeri Natuna Kelas IB
// Database: SQLite (local)
// ============================================

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

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

// Create table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS perkara (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_perkara TEXT NOT NULL,
        nomor_perkara TEXT UNIQUE NOT NULL,
        para_pihak TEXT NOT NULL,
        tahun_masuk INTEGER NOT NULL,
        tanggal_putus TEXT,
        keterangan TEXT,
        jenis_perkara TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tahun_masuk ON perkara(tahun_masuk);
    CREATE INDEX IF NOT EXISTS idx_jenis_perkara ON perkara(jenis_perkara);
    CREATE INDEX IF NOT EXISTS idx_tanggal_putus ON perkara(tanggal_putus);
`);

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

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database: ${dbPath}`);
});
