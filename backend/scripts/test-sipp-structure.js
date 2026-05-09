// Cek struktur SIPP secara lengkap
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('table', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 5000)); // Tunggu JavaScript selesai load

    // Cek struktur div utama
    const structure = await page.evaluate(() => {
      const info = {
        bodyContent: document.body.innerHTML.substring(0, 1000),
        allDivs: Array.from(document.querySelectorAll('div')).map(d => ({
          id: d.id,
          class: d.className,
          text: d.textContent?.substring(0, 50)
        })).slice(0, 20),
        allAnchors: Array.from(document.querySelectorAll('a')).map(a => ({
          href: a.href,
          text: a.textContent?.trim(),
          class: a.className,
          id: a.id
        })).filter(a => a.text).slice(0, 15),
        allTables: document.querySelectorAll('table').length,
        firstTableRows: document.querySelectorAll('table tr').length
      };
      return info;
    });

    console.log('[STRUCTURE]');
    console.log('Tables:', structure.allTables);
    console.log('First table rows:', structure.firstTableRows);
    console.log('\n[DIVS]');
    structure.allDivs.forEach(d => console.log(JSON.stringify(d)));

    console.log('\n[ANCHORS]');
    structure.allAnchors.forEach(a => console.log(JSON.stringify(a)));

    console.log('\n[BODY PREVIEW]');
    console.log(structure.bodyContent);

    // Cek apakah ada infinite scroll atau load more
    const scrollInfo = await page.evaluate(() => {
      const bodyHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight;
      return {
        bodyHeight,
        viewportHeight,
        needsScroll: bodyHeight > viewportHeight
      };
    });
    console.log('\n[SCROLL]', JSON.stringify(scrollInfo, null, 2));

    console.log('\nPress Ctrl+C to exit...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } finally {
    await browser.close();
  }
})();
