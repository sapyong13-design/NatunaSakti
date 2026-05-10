const puppeteer = require('puppeteer');

async function checkUniques() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'networkidle2' });
        await page.waitForSelector('table');

        const allData = [];
        const maxPages = 3;

        for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
            const pageData = await page.evaluate(() => {
                const data = [];
                document.querySelectorAll('table tr').forEach((row, i) => {
                    if (i === 0) return;
                    const cols = row.querySelectorAll('td');
                    const nomor = cols[1]?.textContent?.trim();
                    if (nomor) {
                        data.push({ nomor_perkara: nomor });
                    }
                });
                return data;
            });

            allData.push(...pageData);

            if (currentPage < maxPages) {
                const nextLink = await page.$(`a[href="#page-${currentPage + 1}"]`);
                if (nextLink) {
                    await nextLink.click();
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
        }

        const uniqueNomor = new Set(allData.map(d => d.nomor_perkara));
        console.log(`Total fetched: ${allData.length}`);
        console.log(`Unique nomor_perkara: ${uniqueNomor.size}`);

        // Show first 10
        console.log('First 10:', Array.from(uniqueNomor).slice(0, 10));

        // Check for duplicates
        const duplicates = allData.filter((item, index) =>
            allData.findIndex(d => d.nomor_perkara === item.nomor_perkara) !== index
        );
        console.log('Duplicates found:', duplicates.length);

    } finally {
        await browser.close();
    }
}

checkUniques().catch(console.error);
