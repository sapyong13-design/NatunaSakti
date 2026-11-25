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
