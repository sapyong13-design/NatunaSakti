const puppeteer = require('puppeteer');

async function testFullPagination() {
    console.log('Testing full pagination...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'networkidle2' });
        await page.waitForSelector('table');

        let allData = [];
        let maxPages = 3; // Test 3 pages only

        for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
            console.log(`Fetching page ${currentPage}...`);

            // Get data
            const pageData = await page.evaluate(() => {
                const data = [];
                document.querySelectorAll('table tr').forEach((row, i) => {
                    if (i === 0) return;
                    const cols = row.querySelectorAll('td');
                    if (cols.length >= 2) {
                        data.push({
                            col1: cols[0]?.textContent?.trim(),
                            col2: cols[1]?.textContent?.trim()
                        });
                    }
                });
                return data;
            });

            console.log(`  Page ${currentPage}: ${pageData.length} rows`);
            if (pageData.length > 0) {
                console.log(`  First row: ${JSON.stringify(pageData[0])}`);
            }

            allData = allData.concat(pageData);

            // Try to click next
            if (currentPage < maxPages) {
                const nextLink = await page.$(`a[href="#page-${currentPage + 1}"]`);
                if (nextLink) {
                    console.log(`  Clicking page ${currentPage + 1}...`);
                    await nextLink.click();
                    await new Promise(r => setTimeout(r, 3000));
                } else {
                    console.log('  No next link found');
                    break;
                }
            }
        }

        console.log(`\nTotal rows: ${allData.length}`);
        console.log('Unique perkara:', new Set(allData.map(d => d.col2)).size);

    } finally {
        await browser.close();
    }
}

testFullPagination().catch(console.error);
