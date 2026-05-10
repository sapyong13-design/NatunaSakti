const puppeteer = require('puppeteer');

async function testPagination() {
    console.log('Testing pagination click...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'networkidle2' });
        await page.waitForSelector('table');

        // Page 1
        let data = await page.evaluate(() => {
            return document.querySelectorAll('table tr').length;
        });
        console.log('Page 1 rows:', data);

        // Click page 2
        console.log('Clicking page 2 link...');
        await page.click('a[href="#page-2"]');

        // Wait for AJAX
        await new Promise(r => setTimeout(r, 3000));

        // Page 2
        data = await page.evaluate(() => {
            return document.querySelectorAll('table tr').length;
        });
        console.log('Page 2 rows:', data);

        // Get some data from page 2
        const page2Data = await page.evaluate(() => {
            const firstRow = document.querySelectorAll('table tr')[1];
            if (firstRow) {
                const cols = firstRow.querySelectorAll('td');
                return {
                    col1: cols[0]?.textContent,
                    col2: cols[1]?.textContent
                };
            }
            return null;
        });
        console.log('Page 2 first row:', page2Data);

    } finally {
        await browser.close();
    }
}

testPagination().catch(console.error);
