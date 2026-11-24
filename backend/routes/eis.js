const express = require('express');
const { currentEisPeriod, parseEisPeriod } = require('../lib/eisPeriod');
const { getEisFindings } = require('../lib/eisFindings');
const { getMonthlySippAudit } = require('../services/eisSippAudit');
const { localAudit, getLocalCompliance } = require('../services/eisCompliance');

const monthlyAudits = new Map([
    ['Pencatatan Saksi', 'witness'],
    ['Dokumen Elektronik Berita Acara Sidang', 'bas']
]);

module.exports = function createEisRouter(db, official) {
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
        if (!item || !(mismatch >= 0)) {
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
        if (['kepatuhan', 'kelengkapan', 'kesesuaian'].includes(tab.id)) {
            const audit = localAudit(tab.id, label, Number(index));
            if (!audit) return res.json({ status: 'unavailable', reason: 'Indikator ini belum dipetakan ke sumber SIPP lokal.', findings: [] });
            if (audit.notCaseBased) return res.json({ status: 'not_case_based', reason: audit.notCaseBased, findings: [] });
            const asOf = typeof req.query.asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf) ? req.query.asOf : undefined;
            if (req.query.asOf !== undefined && !asOf) return res.status(400).json({ error: 'Tanggal sinkron tidak valid.' });
            try {
                return res.json(await getLocalCompliance(db, audit.key, req.eisPeriod, asOf));
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
