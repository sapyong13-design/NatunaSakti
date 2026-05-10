const axios = require('axios');
const cheerio = require('cheerio');

async function checkSIPPStructure() {
    try {
        const response = await axios.get('https://sipp.pn-natuna.go.id/', {
            timeout: 10000,
            responseType: 'text'
        });

        const $ = cheerio.load(response.data);

        console.log('=== SIPP Structure Analysis ===');
        console.log('HTML length:', response.data.length);

        // Check all tables
        const tables = $('table');
        console.log('Number of tables:', tables.length);

        tables.each((i, table) => {
            const rows = $(table).find('tr');
            console.log(`Table ${i}: ${rows.length} rows`);

            // Check for pagination links
            const pageLinks = $(table).find('a[href*="page"], a[class*="page"], .pagination a');
            if (pageLinks.length > 0) {
                console.log(`  Found ${pageLinks.length} pagination links`);
            }
        });

        // Check for any pagination elements
        const pagination = $('.pagination, .paging, [class*="page"], [id*="page"]');
        console.log('Pagination elements found:', pagination.length);

        // Count total data rows
        let totalRows = 0;
        $('table tbody tr, table tr').each((i, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 5) {
                totalRows++;
            }
        });

        console.log('Total data rows found:', totalRows);

        // Look for "Show all" or similar links
        $('a').each((i, link) => {
            const text = $(link).text().trim().toLowerCase();
            if (text.includes('show') || text.includes('all') || text.includes('semua') || text.includes('tampil')) {
                console.log('Found link:', text, $(link).attr('href'));
            }
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkSIPPStructure();
