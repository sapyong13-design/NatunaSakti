// Sync menggunakan URL langsung: https://sipp.pn-natuna.go.id/list_perkara/page/X/
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
  const startPage = parseInt(process.argv[2]) || 1;
  const endPage = parseInt(process.argv[3]) || 228;

  console.log(`[SYNC] Syncing from page ${startPage} to ${endPage} using direct URL...`);

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
  let totalSaved = 0;

  for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
    // Refresh browser every 20 pages
    if ((currentPage - startPage) % 20 === 0 && currentPage !== startPage) {
      console.log(`[SYNC] Refreshing browser at page ${currentPage}...`);
      await page.close();
      page = await browser.newPage();
    }

    console.log(`[SYNC] Scraping page ${currentPage}...`);

    try {
      const url = `https://sipp.pn-natuna.go.id/list_perkara/page/${currentPage}/`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for table
      try {
        await page.waitForSelector('table', { timeout: 10000 });
      } catch (_) {
        await sleep(2000);
      }

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

      // Stop if no data on page (might be beyond last page)
      if (pageData.length === 0) {
        console.log(`[SYNC] No data on page ${currentPage}, stopping`);
        break;
      }

      await sleep(1000); // Small delay between pages

    } catch (e) {
      console.log(`[SYNC] Error on page ${currentPage}: ${e.message}`);
      // Continue to next page
    }
  }

  const finalCount = db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
  console.log(`\n[SYNC] Done! Total in DB: ${finalCount} perkara`);

  await browser.close();
}

main().catch(console.error);
