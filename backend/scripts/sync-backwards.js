// Sync backwards - klik page number langsung (228, 227, ...)
const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'akurasi.db'));

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function detectJenisPerkara(nomorPerkara) {
  const upper = nomorPerkara.toUpperCase();
  if (upper.includes('PRK')) return 'Perikanan';
  if (upper.includes('/PDT')) return 'Perdata';
  if (upper.includes('/PID')) return 'Pidana';
  return 'Lainnya';
}

function extractTahun(nomorPerkara) {
  const match = nomorPerkara.match(/\/(\d{4})\//);
  return match ? parseInt(match[1]) : new Date().getFullYear();
}

async function main() {
  const startPage = parseInt(process.argv[2]) || 228;
  const endPage = parseInt(process.argv[3]) || 1;

  console.log(`[SYNC] Syncing backwards from page ${startPage} to ${endPage}...`);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO perkara
    (nomor_perkara, sipp_tanggal_register, sipp_klasifikasi, para_pihak,
     sipp_status, sipp_lama_proses, jenis_perkara, nama_perkara, tahun_masuk,
     sipp_synced, sipp_last_sync)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const existingRows = db.prepare('SELECT nomor_perkara FROM perkara').all();
  const seenNomor = new Set(existingRows.map(r => r.nomor_perkara));
  console.log(`[SYNC] Found ${seenNomor.size} existing perkara in DB`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let page = await browser.newPage();
  await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  try {
    await page.waitForSelector('table', { timeout: 10000 });
  } catch (_) {
    await sleep(2000);
  }

  // Navigate to start page first
  console.log(`[SYNC] Navigating to page ${startPage}...`);

  // Click Last first to get to end, then navigate backwards with page numbers
  await page.evaluate(() => {
    const pagesDiv = document.getElementById('pages');
    const lastLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
      a.textContent.trim() === 'Last'
    );
    if (lastLink) lastLink.click();
  });
  await sleep(3000);

  // Now navigate backwards using page numbers (not Prev button)
  for (let p = 228; p > startPage; p--) {
    await page.evaluate((pageNum) => {
      const pagesDiv = document.getElementById('pages');
      const pageLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
        a.textContent.trim() === pageNum.toString()
      );
      if (pageLink) pageLink.click();
    }, p);
    await sleep(1500);
  }
  await sleep(2000);

  let currentPage = startPage;
  let totalSaved = 0;

  while (currentPage >= endPage) {
    // Refresh browser every 10 pages
    if ((startPage - currentPage) % 10 === 0 && currentPage !== startPage) {
      console.log(`[SYNC] Refreshing browser at page ${currentPage}...`);

      // Save current position
      const targetPage = currentPage;

      await page.close();
      page = await browser.newPage();
      await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2000);

      // Navigate back to target page
      await page.evaluate(() => {
        const pagesDiv = document.getElementById('pages');
        const lastLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
          a.textContent.trim() === 'Last'
        );
        if (lastLink) lastLink.click();
      });
      await sleep(3000);

      for (let p = 228; p > targetPage; p--) {
        await page.evaluate((pageNum) => {
          const pagesDiv = document.getElementById('pages');
          const pageLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
            a.textContent.trim() === pageNum.toString()
          );
          if (pageLink) pageLink.click();
        }, p);
        await sleep(1500);
      }
      await sleep(2000);
    }

    console.log(`[SYNC] Scraping page ${currentPage}...`);

    try {
      const pageData = await page.evaluate(() => {
        const data = [];
        const rows = document.querySelectorAll('table tr');

        rows.forEach((row, i) => {
          if (i === 0) return;
          const cols = row.querySelectorAll('td');
          if (cols.length < 7) return;

          const nomor = cols[1]?.textContent?.trim();
          if (!nomor || !/^\d/.test(nomor)) return;

          data.push({
            nomor_perkara: nomor,
            sipp_tanggal_register: cols[2]?.textContent?.trim() || '',
            sipp_klasifikasi: cols[3]?.textContent?.trim() || '',
            para_pihak: cols[4]?.textContent?.trim() || '',
            sipp_status: cols[5]?.textContent?.trim() || '',
            sipp_lama_proses: cols[6]?.textContent?.trim() || ''
          });
        });

        return data;
      });

      let newInPage = 0;
      for (const item of pageData) {
        if (seenNomor.has(item.nomor_perkara)) continue;

        seenNomor.add(item.nomor_perkara);
        newInPage++;

        const jenis = detectJenisPerkara(item.nomor_perkara);
        insert.run(
          item.nomor_perkara,
          item.sipp_tanggal_register,
          item.sipp_klasifikasi,
          item.para_pihak,
          item.sipp_status,
          item.sipp_lama_proses,
          jenis,
          item.sipp_klasifikasi,
          extractTahun(item.nomor_perkara),
          1,
          new Date().toISOString()
        );
        totalSaved++;
      }

      const dbTotal = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
      console.log(`[SYNC] Page ${currentPage}: ${pageData.length} rows, ${newInPage} new, ${dbTotal} total in DB`);

      if (dbTotal >= 4557) {
        console.log('[SYNC] Target reached!');
        break;
      }

      // Navigate to previous page using page number
      if (currentPage > endPage) {
        const prevPage = currentPage - 1;
        const navigated = await page.evaluate((targetPage) => {
          const pagesDiv = document.getElementById('pages');
          const pageLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
            a.textContent.trim() === targetPage.toString()
          );
          if (!pageLink) return false;
          pageLink.click();
          return true;
        }, prevPage);

        if (!navigated) {
          console.log('[SYNC] Cannot navigate to previous page, stopping');
          break;
        }

        await sleep(2000);
      }

      currentPage--;

    } catch (e) {
      console.log(`[SYNC] Error on page ${currentPage}: ${e.message}`);
      console.log('[SYNC] Refreshing browser and retrying...');

      await page.close();
      page = await browser.newPage();
      await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2000);

      // Navigate back to current page
      await page.evaluate(() => {
        const pagesDiv = document.getElementById('pages');
        const lastLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
          a.textContent.trim() === 'Last'
        );
        if (lastLink) lastLink.click();
      });
      await sleep(3000);

      for (let p = 228; p >= currentPage; p--) {
        await page.evaluate((pageNum) => {
          const pagesDiv = document.getElementById('pages');
          const pageLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
            a.textContent.trim() === pageNum.toString()
          );
          if (pageLink) pageLink.click();
        }, p);
        await sleep(1500);
      }
      await sleep(2000);
    }
  }

  const finalCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
  console.log(`\n[SYNC] Done! Total in DB: ${finalCount} perkara`);

  await browser.close();
}

main().catch(console.error);
