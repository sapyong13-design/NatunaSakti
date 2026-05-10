const puppeteer = require('puppeteer');

async function checkTables() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'networkidle2' });
        await page.waitForSelector('table');

        const tablesInfo = await page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            return tables.map((table, i) => {
                const rows = Array.from(table.querySelectorAll('tr'));
                return {
                    index: i,
                    totalRows: rows.length,
                    dataRows: rows.filter(r => r.querySelectorAll('td').length >= 5).length,
                    hasClass: table.className,
                    firstData: rows[1]?.querySelectorAll('td')[1]?.textContent
                };
            });
        });

        console.log('Tables found:', JSON.stringify(tablesInfo, null, 2));

    } finally {
        await browser.close();
    }
}

checkTables().catch(console.error);
