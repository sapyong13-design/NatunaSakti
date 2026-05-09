// Test hash navigation
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Load page 1
    await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    const page1Data = await page.evaluate(() => {
      const nums = [];
      document.querySelectorAll('table tr').forEach((row, i) => {
        if (i === 0) return;
        const cols = row.querySelectorAll('td');
        if (cols.length >= 2) {
          const num = cols[1]?.textContent?.trim();
          if (num && /^\d/.test(num)) nums.push(num);
        }
      });
      return nums;
    });
    console.log('[PAGE 1] URL:', page.url());
    console.log('[PAGE 1] Data:', page1Data.slice(0, 3));

    // Go to page 2 using hash
    console.log('\n[GOING TO PAGE 2]');
    await page.goto('https://sipp.pn-natuna.go.id/#page-2', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    const page2Data = await page.evaluate(() => {
      const nums = [];
      document.querySelectorAll('table tr').forEach((row, i) => {
        if (i === 0) return;
        const cols = row.querySelectorAll('td');
        if (cols.length >= 2) {
          const num = cols[1]?.textContent?.trim();
          if (num && /^\d/.test(num)) nums.push(num);
        }
      });
      return nums;
    });
    console.log('[PAGE 2] URL:', page.url());
    console.log('[PAGE 2] Data:', page2Data.slice(0, 3));
    console.log('[PAGE 2] Different from page 1?', JSON.stringify(page1Data) !== JSON.stringify(page2Data));

    // Go to page 3
    console.log('\n[GOING TO PAGE 3]');
    await page.goto('https://sipp.pn-natuna.go.id/#page-3', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    const page3Data = await page.evaluate(() => {
      const nums = [];
      document.querySelectorAll('table tr').forEach((row, i) => {
        if (i === 0) return;
        const cols = row.querySelectorAll('td');
        if (cols.length >= 2) {
          const num = cols[1]?.textContent?.trim();
          if (num && /^\d/.test(num)) nums.push(num);
        }
      });
      return nums;
    });
    console.log('[PAGE 3] URL:', page.url());
    console.log('[PAGE 3] Data:', page3Data.slice(0, 3));
    console.log('[PAGE 3] Different from page 2?', JSON.stringify(page2Data) !== JSON.stringify(page3Data));

    console.log('\nPress Ctrl+C to exit...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } finally {
    await browser.close();
  }
})();
