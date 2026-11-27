const express = require('express');
const { currentEisPeriod, parseEisPeriod } = require('../lib/eisPeriod');
const { getEisFindings } = require('../lib/eisFindings');
const { getMonthlySippAudit } = require('../services/eisSippAudit');
const { localAudit, getLocalCompliance } = require('../services/eisCompliance');
const { scoreSnapshot } = require('../lib/eisScore');
const { fetchMisSyncStatus } = require('../services/misSyncStatus');

const monthlyAudits = new Map([
    ['Pencatatan Saksi', 'witness'],
    ['Dokumen Elektronik Berita Acara Sidang', 'bas']
]);

// Nilai pembanding diambil dari snapshot EIS periode ini: kode satker yang
// ditampilkan, versi SIPP yang dinilai, dan versi terbaru menurut Badilum.
function officialExpectation(snapshot, tab) {
    const rows = snapshot?.tabs.find(item => item.id === tab)?.rows ?? [];
    const values = label => rows.find(row => row.label === label)?.details?.[0]?.values ?? [];
    const expectation = {};
    const code = values('Kesesuaian Kode Satker Nomor Perkara')[0];
    if (code) expectation.code_expected = String(code).trim();
    const versions = values('Rilis Versi SIPP');
    if (versions.length >= 2) {
        expectation.version_latest = String(versions[0]).trim();
        expectation.version_expected = String(versions[1]).trim();
    }
    return expectation;
}

module.exports = function createEisRouter(db, official, { misReader = fetchMisSyncStatus } = {}) {
    const router = express.Router();
    router.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const current = currentEisPeriod();
        const period = req.query.period ?? current;
        try {
            parseEisPeriod(period);
            if (period > current) throw new RangeError('future');
        } catch {
            return res.status(400).json({ error: 'Periode harus berupa satu bulan yang sudah dimulai (YYYY-MM).' });
        }
        req.eisPeriod = period;
        next();
    });

    router.get('/', (req, res) => res.json(official.get(req.eisPeriod)));

    router.get('/trend', (req, res) => {
        const rows = typeof official.list === 'function' ? official.list() : [];
        const items = rows.slice(-12).map(({ period, snapshot }) => {
            const score = scoreSnapshot(snapshot);
            const components = Object.fromEntries(
                score.components.map(c => [c.id, c.official?.konversi ?? c.konversi ?? null])
            );
            return {
                period,
                fetchedAt: snapshot?.fetchedAt ?? null,
                total: score.officialTotal ?? score.total ?? null,
                components
            };
        });
        res.json({ items });
    });

    router.get('/mis-status', async (req, res) => {
        res.json(await misReader());
    });

    router.get('/score', (req, res) => {
        const { snapshot } = official.get(req.eisPeriod);
        if (!snapshot) return res.status(404).json({ error: 'Snapshot EIS periode ini belum tersedia.' });
        res.json({ period: req.eisPeriod, ...scoreSnapshot(snapshot) });
    });

    router.post('/refresh', async (req, res, next) => {
        try {
            res.json(await official.refresh(req.eisPeriod, { force: true }));
        } catch (error) {
            next(error);
        }
    });

    router.get('/findings', async (req, res, next) => {
        const { label, index = '0' } = req.query;
        if (typeof label !== 'string' || !label.trim() || label.length > 240 ||
            typeof index !== 'string' || !/^[0-9]$/.test(index)) {
            return res.status(400).json({ error: 'Indikator atau rincian EIS tidak valid.' });
        }
        const snapshot = official.get(req.eisPeriod).snapshot;
        const tab = snapshot?.tabs.find(item => item.id !== 'konversi' && item.rows.some(row => row.label === label));
        const row = tab?.rows.find(item => item.label === label);
        const item = row?.details[Number(index)];
        const mismatch = row?.headers.findIndex(header => header.trim().toLowerCase() === 'tidak');
        const hasLocalRule = ['kinerja', 'kepatuhan', 'kelengkapan', 'kesesuaian'].includes(tab?.id)
            && Boolean(localAudit(tab.id, label, Number(index)));
        if (!item || (!(mismatch >= 0) && !hasLocalRule)) {
            return res.status(404).json({ error: 'Indikator ketidaksesuaian tidak ditemukan pada snapshot EIS periode ini.' });
        }
        const kind = monthlyAudits.get(label);
        if (kind && index === '0') {
            try {
                return res.json(await getMonthlySippAudit(db, kind, req.eisPeriod));
            } catch (error) {
                if (error.code === 'SIPP_AUDIT_READ') {
                    const fallback = getEisFindings(db, req.eisPeriod, label);
                    return res.json({ ...fallback, reason: 'SIPP lokal tidak dapat dibaca saat ini. Daftar pembanding dari cache bukan bukti pencatatan saksi atau unggahan BAS.' });
                }
                return next(error);
            }
        }
        if (['kinerja', 'kepatuhan', 'kelengkapan', 'kesesuaian'].includes(tab.id)) {
            const audit = localAudit(tab.id, label, Number(index));
            if (!audit) return res.json(getEisFindings(db, req.eisPeriod, label));
            if (audit.notCaseBased) return res.json({ status: 'not_case_based', reason: audit.notCaseBased, findings: [] });
            const asOf = typeof req.query.asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf) ? req.query.asOf : undefined;
            if (req.query.asOf !== undefined && !asOf) return res.status(400).json({ error: 'Tanggal sinkron tidak valid.' });
            try {
                return res.json(await getLocalCompliance(db, audit.key, req.eisPeriod, asOf, { ...officialExpectation(snapshot, tab.id), snapshotAt: snapshot.fetchedAt ?? null }));
            } catch (error) {
                if (error.code === 'SIPP_AUDIT_READ') return res.json({ status: 'unavailable', reason: error.message, findings: [] });
                return next(error);
            }
        }
        res.json(getEisFindings(db, req.eisPeriod, label));
    });

    router.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        console.error('[EIS] Local API error:', error.name);
        res.status(500).json({ error: 'Monitoring EIS tidak dapat diproses.' });
    });
    return router;
};
