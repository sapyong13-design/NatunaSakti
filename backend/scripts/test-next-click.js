// Test klik Next di pagination SIPP
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('table', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 3000));

    // Page 1 data
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
    console.log('[PAGE 1] Perkara:', page1Data.slice(0, 3), '...');

    // Cek tombol Next
    const nextInfo = await page.evaluate(() => {
      const pagesDiv = document.getElementById('pages') ||
                      document.querySelector('.simple-pagination');

      if (!pagesDiv) return { error: 'No pages div' };

      const allLinks = Array.from(pagesDiv.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim(),
        href: a.href,
        class: a.className,
        onclick: a.onclick ? 'has onclick' : 'no onclick'
      }));

      const nextLinks = allLinks.filter(a =>
        a.text.toLowerCase() === 'next'
      );

      return {
        totalLinks: allLinks.length,
        allLinks,
        nextLinks
      };
    });
    console.log('\n[PAGINATION INFO]');
    console.log('Total links:', nextInfo.totalLinks);
    console.log('\nAll links:');
    nextInfo.allLinks.forEach(l => console.log(JSON.stringify(l)));

    // Coba klik Next
    if (nextInfo.nextLinks.length > 0) {
      console.log('\n[CLICKING NEXT]');

      // Dapatkan URL saat ini
      const urlBefore = page.url();
      console.log('URL before:', urlBefore);

      // Coba klik dan tunggu navigation
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {
            console.log('No navigation detected');
          }),
          page.evaluate(() => {
            const pagesDiv = document.getElementById('pages');
            const nextLinks = Array.from(pagesDiv.querySelectorAll('a')).filter(a =>
              a.textContent.trim().toLowerCase() === 'next'
            );
            if (nextLinks.length > 0) nextLinks[0].click();
          })
        ]);

        const urlAfter = page.url();
        console.log('URL after:', urlAfter);

        await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));

        // Page 2 data
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

        console.log('\n[PAGE 2] Perkara:', page2Data.slice(0, 3), '...');
        console.log('Page 1 == Page 2?', JSON.stringify(page1Data) === JSON.stringify(page2Data));
      } catch (e) {
        console.error('Error clicking next:', e.message);
      }
    }

    console.log('\nPress Ctrl+C to exit...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } finally {
    await browser.close();
  }
})();
