const axios = require('axios');
const cheerio = require('cheerio');

async function findPaginationLinks() {
    try {
        const response = await axios.get('https://sipp.pn-natuna.go.id/', {
            timeout: 10000,
            responseType: 'text'
        });

        const $ = cheerio.load(response.data);

        console.log('=== Pagination Links ===');

        // Check pagination elements
        $('.pagination, .paging, [class*="page"], [id*="page"]').each((i, elem) => {
            console.log(`Element ${i}:`, $(elem).html());
        });

        // Check all links
        console.log('\n=== All Links ===');
        $('a').each((i, link) => {
            const href = $(link).attr('href');
            const text = $(link).text().trim();
            if (href && (href.includes('page') || href.includes('hal') || text.match(/\d+/))) {
                console.log(`Link ${i}: "${text}" -> ${href}`);
            }
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

findPaginationLinks();
