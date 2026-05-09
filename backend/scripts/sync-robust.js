// Robust sync - refresh browser every 5 pages to avoid context destroyed
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
  console.log('[SYNC] Starting robust sync...');

  const insert = db.prepare(`
    INSERT OR REPLACE INTO perkara
    (nomor_perkara, sipp_tanggal_register, sipp_klasifikasi, para_pihak,
     sipp_status, sipp_lama_proses, jenis_perkara, nama_perkara, tahun_masuk,
     sipp_synced, sipp_last_sync)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Load existing nomor
  const existingRows = db.prepare('SELECT nomor_perkara FROM perkara').all();
  const seenNomor = new Set(existingRows.map(r => r.nomor_perkara));
  console.log(`[SYNC] Found ${seenNomor.size} existing perkara in DB`);

  const maxPages = 228;
  let currentPage = 1;
  let totalSaved = 0;
  let browser, page;

  // Function to refresh browser
  async function refreshBrowser() {
    try {
      if (page) await page.close();
    } catch (_) {}
    try {
      if (browser) await browser.close();
    } catch (_) {}

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    page = await browser.newPage();
  }

  // Function to navigate to specific page
  async function navigateToPage(targetPage) {
    await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    try {
      await page.waitForSelector('table', { timeout: 10000 });
    } catch (_) {
      await sleep(2000);
    }

    if (targetPage > 1) {
      await sleep(2000);
      for (let i = 1; i < targetPage; i++) {
        try {
          const navigated = await page.evaluate((pageNum) => {
            const pagesDiv = document.getElementById('pages');
            if (!pagesDiv) return false;
            const pageLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
              a.textContent.trim() === (pageNum + 1).toString()
            );
            if (!pageLink) return false;
            pageLink.click();
            return true;
          }, i);

          if (!navigated) break;
          await sleep(1500);
        } catch (_) {
          // Continue on error
        }
      }
      await sleep(2000);
    }
  }

  // Initial browser launch
  await refreshBrowser();

  while (currentPage <= maxPages) {
    // Refresh browser every 5 pages
    if ((currentPage - 1) % 5 === 0) {
      console.log(`[SYNC] Refreshing browser at page ${currentPage}...`);
      await refreshBrowser();
      await navigateToPage(currentPage);
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

      // Stop if reached target
      if (dbTotal >= 4557) {
        console.log('[SYNC] Target reached!');
        break;
      }

      // Navigate to next page
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
          console.log('[SYNC] Cannot navigate to next page, stopping');
          break;
        }

        await sleep(2000);
      }

      currentPage++;

    } catch (e) {
      console.log(`[SYNC] Error on page ${currentPage}: ${e.message}`);
      console.log('[SYNC] Refreshing browser and retrying...');

      // Refresh and retry same page
      await refreshBrowser();
      await navigateToPage(currentPage);
      // Don't increment currentPage, retry same page
    }
  }

  const finalCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
  console.log(`\n[SYNC] Done! Total in DB: ${finalCount} perkara`);

  await browser.close();
}

main().catch(console.error);
