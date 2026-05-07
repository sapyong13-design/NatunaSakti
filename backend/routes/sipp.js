// ============================================
// SIPP ROUTES
// ============================================

const express = require('express');
const router = express.Router();

// GET /api/perkara/sipp/status - Get sync status
router.get('/status', (req, res) => {
    try {
        const db = req.app.get('db');
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

// POST /api/perkara/sipp/sync - Trigger manual sync
router.post('/sync', async (req, res) => {
    try {
        const sippService = req.app.get('sippService');
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

module.exports = router;
