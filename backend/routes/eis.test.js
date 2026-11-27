const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const createEisRouter = require('./eis');

const labels = ['Verifikasi Dokumen Elektronik Elitigasi', 'Verifikasi Dokumen Elektronik E-Litigasi'];

test('e-Litigasi findings do not substitute SIPP bundels for official entries', async () => {
    const period = '2026-10';
    const officialRows = labels.map(label => ({
        label, headers: ['Jumlah', 'Sesuai', 'Tidak'], details: [{ values: ['24', '19', '5'] }], points: '15.83'
    }));
    const app = express();
    app.use(createEisRouter(null, { get: () => ({ snapshot: { period, tabs: [{ id: 'kesesuaian', rows: officialRows }] } }) }));
    const server = await new Promise(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    try {
        const base = `http://127.0.0.1:${server.address().port}`;
        for (const label of labels) {
            const params = new URLSearchParams({ period, label });
            const response = await fetch(`${base}/findings?${params}`);
            assert.equal(response.status, 200);
            const result = await response.json();
            assert.equal(result.status, 'unavailable');
            assert.deepEqual(result.findings, []);
            assert.equal(result.context, undefined);
        }
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('GET /trend returns cached monthly scores and GET /mis-status parses MIS table payload', async () => {
    const { parseMisTableRows } = require('../services/misSyncStatus');
    const parsed = parseMisTableRows({
        remote_status: 'ok',
        data: [
            ['1', 'perkara', '2,194', '2,194', '26/11/2026', '26/11/2026'],
            ['2', 'perkara_saksi', '150', '145', '26/11/2026', '26/11/2026'],
            ['3', 'perkara_putusan_pemberitahuan_putusan', '6,399', '5,350', '26/11/2026', '26/11/2026']
        ]
    });
    assert.deepEqual(parsed.summary, { total: 3, ok: 1, behind: 1, excess: 0, knownBug: 1 });

    const sampleSnapshot = (period, total) => ({
        period,
        fetchedAt: `${period}-27T03:00:00.000Z`,
        tabs: [
            { id: 'kinerja', rows: [] },
            { id: 'kepatuhan', rows: [] },
            { id: 'kelengkapan', rows: [] },
            { id: 'kesesuaian', rows: [] },
            {
                id: 'konversi',
                rows: [
                    { label: 'Kinerja', details: [{ values: ['130', '105', '80.77'] }], points: '80.77' },
                    { label: 'Kepatuhan', details: [{ values: ['466', '449.5', '96.46'] }], points: '96.46' },
                    { label: 'Kelengkapan', details: [{ values: ['135', '130', '96.30'] }], points: '96.30' },
                    { label: 'Kesesuaian', details: [{ values: ['235', '207.73', '88.40'] }], points: '88.40' },
                    { label: '% Implementasi SIPP', details: [{ values: [String(total)] }], points: String(total) }
                ]
            }
        ]
    });
    const app = express();
    app.use(createEisRouter(
        null,
        {
            get: () => ({ snapshot: null }),
            list: () => [{ period: '2026-10', snapshot: sampleSnapshot('2026-10', 92.12) }, { period: '2026-11', snapshot: sampleSnapshot('2026-11', 90.48) }]
        },
        { misReader: async () => parsed }
    ));
    const server = await new Promise(resolve => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    try {
        const base = `http://127.0.0.1:${server.address().port}`;
        const trendRes = await fetch(`${base}/trend`);
        assert.equal(trendRes.status, 200);
        const trend = await trendRes.json();
        assert.equal(trend.items.length, 2);
        assert.equal(trend.items[1].total, 90.48);

        const misRes = await fetch(`${base}/mis-status`);
        assert.equal(misRes.status, 200);
        const mis = await misRes.json();
        assert.equal(mis.summary.behind, 1);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
