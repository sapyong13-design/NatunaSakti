const axios = require('axios');
const cheerio = require('cheerio');

async function testPagination() {
    const baseUrl = 'https://sipp.pn-natuna.go.id/';

    // Test different pagination formats
    const testUrls = [
        baseUrl,
        `${baseUrl}?page=2`,
        `${baseUrl}?halaman=2`,
        `${baseUrl}?p=2`,
        `${baseUrl}page/2`,
        `${baseUrl}halaman/2`,
    ];

    for (const url of testUrls) {
        try {
            console.log(`Testing: ${url}`);
            const response = await axios.get(url, { timeout: 10000 });
            const $ = cheerio.load(response.data);

            let dataRows = 0;
            $('table tr').each((i, row) => {
                const cols = $(row).find('td');
                if (cols.length >= 5) dataRows++;
            });

            console.log(`  -> ${dataRows} data rows`);

            // Check for pagination buttons
            const pagButtons = $('.pagination a, .paging a').length;
            if (pagButtons > 0) {
                console.log(`  -> Found ${pagButtons} pagination buttons`);
            }
        } catch (error) {
            console.log(`  -> Error: ${error.message}`);
        }
    }
}

testPagination();
