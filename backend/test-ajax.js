const axios = require('axios');

async function testAjaxEndpoints() {
    const baseUrl = 'https://sipp.pn-natuna.go.id/';

    // Common AJAX endpoint patterns
    const testEndpoints = [
        '/api/perkara',
        '/api/data',
        '/api/getPerkara',
        '/getPerkara',
        '/perkara/page',
        '/data/perkara',
        '/sipp/api/perkara',
    ];

    // Test with different parameters
    const params = [
        { page: 1 },
        { page: 2 },
        { halaman: 2 },
        { limit: 100 },
        { start: 0, length: 100 },
    ];

    for (const endpoint of testEndpoints) {
        for (const param of params) {
            const url = baseUrl + endpoint.replace(/^\//, '');
            try {
                console.log(`Testing: ${url} with params`, param);
                const response = await axios.get(url, {
                    params: param,
                    timeout: 10000,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (response.data && typeof response.data === 'object') {
                    console.log(`  -> SUCCESS! Response type: ${Array.isArray(response.data) ? 'array' : typeof response.data}`);
                    if (response.data.data) console.log(`  -> data.data length: ${response.data.data.length}`);
                    if (Array.isArray(response.data)) console.log(`  -> Array length: ${response.data.length}`);
                    console.log(`  -> First 200 chars:`, JSON.stringify(response.data).substring(0, 200));
                }
            } catch (error) {
                // Ignore 404
                if (error.response?.status !== 404) {
                    console.log(`  -> Error: ${error.message}`);
                }
            }
        }
    }
}

testAjaxEndpoints();
