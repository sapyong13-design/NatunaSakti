// Test JavaScript hash change
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
    await new Promise(r => setTimeout(r, 3000));

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
    console.log('[PAGE 1] Data:', page1Data.slice(0, 3));

    // Try clicking page 2 link directly
    console.log('\n[CLICKING PAGE 2 LINK]');
    await page.evaluate(() => {
      // Find and click the "2" link
      const pagesDiv = document.getElementById('pages');
      const links = Array.from(pagesDiv.querySelectorAll('a'));
      const page2Link = links.find(a => a.textContent.trim() === '2');
      if (page2Link) {
        console.log('Found page 2 link:', page2Link.href);
        page2Link.click();
      }
    });

    await new Promise(r => setTimeout(r, 3000));

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
    console.log('[PAGE 2] Data:', page2Data.slice(0, 3));
    console.log('[PAGE 2] Different?', JSON.stringify(page1Data) !== JSON.stringify(page2Data));

    // Try clicking Next button
    console.log('\n[CLICKING NEXT BUTTON]');
    await page.evaluate(() => {
      const pagesDiv = document.getElementById('pages');
      const nextLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
        a.textContent.trim().toLowerCase() === 'next'
      );
      if (nextLink) {
        console.log('Found next link:', nextLink.href);
        nextLink.click();
      }
    });

    await new Promise(r => setTimeout(r, 3000));

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
    console.log('[PAGE 3] Data:', page3Data.slice(0, 3));
    console.log('[PAGE 3] Different from page 2?', JSON.stringify(page2Data) !== JSON.stringify(page3Data));

    console.log('\nPress Ctrl+C to exit...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } finally {
    await browser.close();
  }
})();
