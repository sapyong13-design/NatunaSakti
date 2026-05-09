// Test SIPP pagination
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('table', { timeout: 10000 });

    // Wait a bit more for DataTables to initialize
    await new Promise(r => setTimeout(r, 3000));

    // Check table data
    const page1Data = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tr');
      return {
        totalRows: rows.length,
        hasData: rows.length > 1
      };
    });
    console.log('[PAGE 1] Total rows:', page1Data.totalRows);

    // Look for pagination elements
    const paginationInfo = await page.evaluate(() => {
      const info = {
        dataTablesNext: !!document.querySelector('a[data-dt-idx="next"]'),
        paginateButtonNext: !!document.querySelector('.paginate_button.next'),
        bootstrapNext: !!document.querySelector('.pagination .next'),
        ulPaginationLast: !!document.querySelector('ul.pagination li:last-child a'),
        allPagination: document.querySelectorAll('.paginate_button, .pagination a, [data-dt-idx]').length
      };
      return info;
    });
    console.log('[PAGINATION]', JSON.stringify(paginationInfo, null, 2));

    // Get first few perkara numbers
    const perkaraNumbers = await page.evaluate(() => {
      const nums = [];
      document.querySelectorAll('table tr').forEach((row, i) => {
        if (i === 0) return;
        const cols = row.querySelectorAll('td');
        if (cols.length >= 2) {
          const num = cols[1]?.textContent?.trim();
          if (num && /^\d/.test(num)) nums.push(num);
        }
      });
      return nums.slice(0, 5);
    });
    console.log('[PERKARA]', perkaraNumbers);

    // Try clicking next
    console.log('\n[TRYING NEXT CLICK]');
    const clicked = await page.evaluate(() => {
      const nextButtons = [
        document.querySelector('a[data-dt-idx="next"]'),
        document.querySelector('.paginate_button.next'),
      ].filter(Boolean);

      console.log('Found buttons:', nextButtons.length);
      if (nextButtons.length > 0) {
        const btn = nextButtons[0];
        console.log('Button classes:', btn.className);
        console.log('Button disabled:', btn.classList.contains('disabled'));
        if (!btn.classList.contains('disabled')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    console.log('Clicked:', clicked);

    if (clicked) {
      await new Promise(r => setTimeout(r, 3000));
      const page2Numbers = await page.evaluate(() => {
        const nums = [];
        document.querySelectorAll('table tr').forEach((row, i) => {
          if (i === 0) return;
          const cols = row.querySelectorAll('td');
          if (cols.length >= 2) {
            const num = cols[1]?.textContent?.trim();
            if (num && /^\d/.test(num)) nums.push(num);
          }
        });
        return nums.slice(0, 5);
      });
      console.log('[PAGE 2] Perkara:', page2Numbers);
    }

    console.log('\nPress Ctrl+C to exit...');
    // Keep browser open for manual inspection
    await new Promise(resolve => setTimeout(resolve, 30000));

  } finally {
    await browser.close();
  }
})();
