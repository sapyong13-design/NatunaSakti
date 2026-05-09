// Test full sync dengan page click
const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('[TEST] Starting full sync test...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();

    // Load first page
    console.log('[TEST] Loading page 1...');
    await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('table', { timeout: 10000 });
    await sleep(2000);

    const allPerkara = new Set();
    let currentPage = 1;
    const maxPages = 5; // Test 5 pages dulu

    while (currentPage <= maxPages) {
      console.log(`[TEST] Scraping page ${currentPage}...`);

      const pageData = await page.evaluate(() => {
        const data = [];
        const rows = document.querySelectorAll('table tr');

        rows.forEach((row, i) => {
          if (i === 0) return;
          const cols = row.querySelectorAll('td');
          if (cols.length < 7) return;

          const nomor = cols[1]?.textContent?.trim();
          if (!nomor || !/^\d/.test(nomor)) return;

          data.push(nomor);
        });

        return data;
      });

      // Add unique
      let newInPage = 0;
      for (const nomor of pageData) {
        if (!allPerkara.has(nomor)) {
          allPerkara.add(nomor);
          newInPage++;
        }
      }

      console.log(`[TEST] Page ${currentPage}: ${pageData.length} rows, ${newInPage} new, ${allPerkara.size} total unique`);

      // Try to go to next page
      if (currentPage < maxPages) {
        const navigated = await page.evaluate((pageNum) => {
          const pagesDiv = document.getElementById('pages');
          if (!pagesDiv) return false;

          const pageLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
            a.textContent.trim() === (pageNum + 1).toString()
          );

          if (!pageLink) return false;

          pageLink.click();
          return true;
        }, currentPage);

        if (!navigated) {
          console.log('[TEST] Cannot navigate to next page');
          break;
        }

        await sleep(2000);
      }

      currentPage++;
    }

    console.log(`\n[TEST] Complete! Total unique perkara: ${allPerkara.size}`);

  } finally {
    await browser.close();
  }
})();
