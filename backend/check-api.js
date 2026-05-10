const axios = require('axios');
const cheerio = require('cheerio');

async function checkForAPI() {
    try {
        const response = await axios.get('https://sipp.pn-natuna.go.id/', {
            timeout: 10000,
            responseType: 'text'
        });

        const $ = cheerio.load(response.data);

        console.log('=== Checking for API/Data Source ===\n');

        // Check script tags for AJAX calls
        $('script').each((i, script) => {
            const src = $(script).attr('src');
            const content = $(script).html() || '';

            if (src) {
                console.log(`Script ${i}: ${src}`);
            }

            // Look for AJAX/fetch calls
            if (content.includes('ajax') || content.includes('fetch') || content.includes('load')) {
                console.log(`  -> Contains AJAX/fetch code`);
            }
        });

        // Check for data attributes or JSON embedded
        console.log('\n=== Checking for embedded data ===');
        $('div[id], table[id]').each((i, elem) => {
            const id = $(elem).attr('id');
            if (id && (id.includes('data') || id.includes('table') || id.includes('perkara'))) {
                console.log(`Element with ID: ${id}`);
            }
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkForAPI();
