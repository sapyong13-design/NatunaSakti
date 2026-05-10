const axios = require('axios');
const cheerio = require('cheerio');

async function testFetch() {
    try {
        console.log('Testing SIPP fetch...');
        const response = await axios.get('https://sipp.pn-natuna.go.id/', {
            timeout: 10000,
            responseType: 'text'
        });
        console.log('Response length:', response.data.length);
        console.log('First 200 chars:', response.data.substring(0, 200));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testFetch();
