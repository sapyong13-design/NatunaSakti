const puppeteer = require('puppeteer');

async function testPuppeteer() {
    console.log('Launching Puppeteer...');
    const browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for table
        await page.waitForSelector('table', { timeout: 10000 });

        // Get initial data
        const initialData = await page.evaluate(() => {
            const rows = document.querySelectorAll('table tr');
            let count = 0;
            rows.forEach((row, i) => {
                if (i > 0) { // Skip header
                    const cols = row.querySelectorAll('td');
                    if (cols.length >= 5) count++;
                }
            });
            return { count, totalRows: rows.length };
        });

        console.log('Initial page:', initialData);

        // Look for pagination elements
        const paginationInfo = await page.evaluate(() => {
            // Check for various pagination selectors
            const selectors = [
                '.pagination',
                '.paging',
                '#selector',
                '#selector_bottom'
            ];

            const result = {};
            selectors.forEach(sel => {
                const elem = document.querySelector(sel);
                if (elem) {
                    result[sel] = {
                        html: elem.innerHTML.substring(0, 200),
                        linkCount: elem.querySelectorAll('a').length
                    };
                }
            });

            // Get all links in pagination area
            const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.textContent.trim(),
                href: a.getAttribute('href'),
                onclick: a.getAttribute('onclick')
            })).filter(l => l.text && (l.text.match(/\d+/) || ['next', 'prev', 'lanjut', 'selanjutnya', 'sebelumnya'].some(w => l.text.toLowerCase().includes(w))));

            return { pagination: result, links: allLinks };
        });

        console.log('Pagination info:', JSON.stringify(paginationInfo, null, 2));

        // Wait for user to see (optional)
        await new Promise(r => setTimeout(r, 5000));

    } finally {
        await browser.close();
    }
}

testPuppeteer().catch(console.error);
