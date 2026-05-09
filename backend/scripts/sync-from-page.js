// Resume sync from specific page
const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'akurasi.db'));

// Get start page from command line
const startPage = parseInt(process.argv[2]) || 1;
const maxPages = 228;

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
  console.log(`[SYNC] Starting sync from page ${startPage}...`);

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

  let currentPage = startPage;
  let totalSaved = 0;
  let browser = null;
  let page = null;

  try {
    while (currentPage <= maxPages) {
      // Refresh browser every 50 pages to avoid context destroy
      if (currentPage === startPage || (currentPage - 1) % 50 === 0) {
        if (page) {
          console.log(`[SYNC] Refreshing browser at page ${currentPage}...`);
          await page.close();
        }
        if (browser) {
          await browser.close();
        }

        browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        page = await browser.newPage();

        // Navigate to current page
        if (currentPage > 1) {
          console.log(`[SYNC] Navigating to page ${currentPage}...`);
          await page.goto(`https://sipp.pn-natuna.go.id/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
          await sleep(2000);

          // Navigate through pages
          for (let i = 1; i < currentPage; i++) {
            try {
              await page.evaluate((pageNum) => {
                const pagesDiv = document.getElementById('pages');
                if (!pagesDiv) return false;

                const pageLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
                  a.textContent.trim() === (pageNum + 1).toString()
                );

                if (!pageLink) return false;
                pageLink.click();
                return true;
              }, i);
              await sleep(1500);
            } catch (e) {
              // Skip navigation errors
            }
          }
          await sleep(2000);
        } else {
          await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForSelector('table', { timeout: 10000 });
          await sleep(2000);
        }
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

        // Navigate to next page
        if (currentPage < maxPages) {
          // Use direct click instead of hash
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

          await sleep(2500); // Wait longer for page load
        }

        currentPage++;
      } catch (e) {
        console.log(`[SYNC] Error on page ${currentPage}: ${e.message}`);
        console.log(`[SYNC] Refreshing browser and continuing...`);

        // Close and recreate browser to clear error state
        try {
          if (page) await page.close();
        } catch (_) {}
        try {
          if (browser) await browser.close();
        } catch (_) {}

        // Recreate browser
        browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        page = await browser.newPage();

        // Navigate to next page
        if (currentPage < maxPages) {
          currentPage++; // Move to next page before navigating
          console.log(`[SYNC] Navigating to page ${currentPage}...`);
          await page.goto(`https://sipp.pn-natuna.go.id/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
          await sleep(2000);

          // Navigate through pages
          for (let i = 1; i < currentPage; i++) {
            try {
              await page.evaluate((pageNum) => {
                const pagesDiv = document.getElementById('pages');
                if (!pagesDiv) return false;

                const pageLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
                  a.textContent.trim() === (pageNum + 1).toString()
                );

                if (!pageLink) return false;
                pageLink.click();
                return true;
              }, i);
              await sleep(1000);
            } catch (e) {
              // Skip navigation errors
            }
          }
          await sleep(2000);
        } else {
          break; // No more pages
        }
      }
    }

    const finalCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
    console.log(`\n[SYNC] Done! Total in DB: ${finalCount} perkara`);

  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

main().catch(console.error);
