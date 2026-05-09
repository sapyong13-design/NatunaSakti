// Direct sync to database - bypass API
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
  console.log('[SYNC] Starting direct sync to database...');

  // Check existing data
  const existingCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
  console.log(`[SYNC] Existing perkara in DB: ${existingCount}`);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO perkara
    (nomor_perkara, sipp_tanggal_register, sipp_klasifikasi, para_pihak,
     sipp_status, sipp_lama_proses, jenis_perkara, nama_perkara, tahun_masuk,
     sipp_synced, sipp_last_sync)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('table', { timeout: 10000 });
    await sleep(2000);

    // Load existing nomor from DB to avoid duplicates
    const existingRows = db.prepare('SELECT nomor_perkara FROM perkara').all();
    const seenNomor = new Set(existingRows.map(r => r.nomor_perkara));
    console.log(`[SYNC] Found ${seenNomor.size} existing perkara in DB`);

    let currentPage = 1;
    const maxPages = 228; // All pages
    let totalSaved = 0;

    while (currentPage <= maxPages) {
      console.log(`[SYNC] Scraping page ${currentPage}...`);

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

      console.log(`[SYNC] Page ${currentPage}: ${pageData.length} rows, ${newInPage} new, ${totalSaved} total saved`);

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
          console.log('[SYNC] Cannot navigate to next page');
          break;
        }

        await sleep(2000);
      }

      currentPage++;
    }

    console.log(`\n[SYNC] Complete! Total saved: ${totalSaved} perkara`);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
