const express = require('express');
const app = express();

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/perkara', (req, res) => res.json([]));
app.get('/api/perkara/range', (req, res) => res.json([]));

app.get('/api/immediate-test', (req, res) => res.json({ message: 'Test works!' }));
app.get('/api/perkara/sipp/status', (req, res) => res.json({ total: 0 }));

app.get('/api/perkara/:id', (req, res) => res.json({ id: req.params.id }));

app.listen(3003, () => console.log('Test server on 3003'));
