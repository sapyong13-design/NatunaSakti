const puppeteer = require('puppeteer');

async function testTiming() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'networkidle2' });
        await page.waitForSelector('table');

        // Page 1
        const page1Data = await page.evaluate(() => {
            const data = [];
            document.querySelectorAll('table tr').forEach((row, i) => {
                if (i === 0) return;
                const cols = row.querySelectorAll('td');
                const nomor = cols[1]?.textContent?.trim();
                if (nomor) data.push({ nomor, row: i });
            });
            return data;
        });
        console.log('Page 1 - First 5:', page1Data.slice(0, 5).map(d => d.nomor));
        console.log('Page 1 - Last 5:', page1Data.slice(-5).map(d => d.nomor));

        // Wait extra time before clicking
        await new Promise(r => setTimeout(r, 2000));

        // Click page 2
        const nextLink = await page.$('a[href="#page-2"]');
        if (nextLink) {
            console.log('Clicking page 2...');
            await nextLink.click();

            // Wait longer for AJAX
            await new Promise(r => setTimeout(r, 5000));

            // Page 2
            const page2Data = await page.evaluate(() => {
                const data = [];
                document.querySelectorAll('table tr').forEach((row, i) => {
                    if (i === 0) return;
                    const cols = row.querySelectorAll('td');
                    const nomor = cols[1]?.textContent?.trim();
                    if (nomor) data.push({ nomor, row: i });
                });
                return data;
            });
            console.log('Page 2 - First 5:', page2Data.slice(0, 5).map(d => d.nomor));
            console.log('Page 2 - Last 5:', page2Data.slice(-5).map(d => d.nomor));

            // Check overlap
            const page1Set = new Set(page1Data.map(d => d.nomor));
            const page2Set = new Set(page2Data.map(d => d.nomor));
            const overlap = [...page1Set].filter(x => page2Set.has(x));
            console.log('Overlap between page 1 and 2:', overlap.length, overlap);
        }

    } finally {
        await browser.close();
    }
}

testTiming().catch(console.error);
