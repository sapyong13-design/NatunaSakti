const express = require('express');
const app = express();

app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => res.json({root: true}));
app.get('/api/health', (req, res) => res.json({status: 'ok'}));
app.get('/api/test', (req, res) => res.json({test: true}));
app.get('/api/perkara', (req, res) => res.json([]));

app.get('/api/perkara/range', (req, res) => {
    console.log('[RANGE] Called!');
    res.json([]);
});

app.get('/api/perkara/sipp/status', (req, res) => {
    console.log('[SIPP-STATUS] Called!');
    res.json({total: 0});
});

app.get('/api/perkara/:id', (req, res) => {
    console.log('[PERKARA-ID] Called with id:', req.params.id);
    res.json({id: req.params.id});
});

app.listen(3006, () => {
    console.log('Test server on port 3006');

    // Test all routes
    setTimeout(async () => {
        const testRoutes = [
            '/',
            '/api/health',
            '/api/test',
            '/api/perkara',
            '/api/perkara/range',
            '/api/perkara/sipp/status',
            '/api/perkara/123'
        ];

        console.log('\n=== TESTING ROUTES ===');
        for (const route of testRoutes) {
            try {
                const res = await fetch(`http://localhost:3006${route}`);
                console.log(`${route}: ${res.status}`);
            } catch (e) {
                console.log(`${route}: ERROR - ${e.message}`);
            }
        }

        process.exit(0);
    }, 500);
});
