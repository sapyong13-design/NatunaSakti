// ============================================
// SIPP SYNC SERVICE
// Fetch dan sync data perkara dari SIPP PN Natuna
// ============================================

const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

class SIPPSyncService {
  constructor(db) {
    this.db = db;
    this.sippUrl = 'https://sipp.pn-natuna.go.id/';
  }

  /**
   * Fetch HTML dari website SIPP menggunakan Puppeteer (untuk pagination JavaScript)
   */
  async fetchSIPPData(progressCallback = null) {
    console.log('[SIPP] Fetching data from', this.sippUrl, 'using Puppeteer...');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    try {
      const page = await browser.newPage();
      await page.goto(this.sippUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      const perkaraList = [];
      let currentPage = 1;
      const maxPages = 10; // Up to 200 perkara (20 per page)

      while (currentPage <= maxPages) {
        console.log(`[SIPP] Scraping page ${currentPage}...`);

        // Navigate directly to the page hash for more reliable pagination
        if (currentPage > 1) {
          await page.goto(`${this.sippUrl}#page-${currentPage}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(r => setTimeout(r, 1000)); // Wait for AJAX
        }

        // Get data from current page
        const pageData = await page.evaluate(() => {
          const data = [];
          const rows = document.querySelectorAll('table tr');

          rows.forEach((row, i) => {
            if (i === 0) return; // Skip header

            const cols = row.querySelectorAll('td');
            if (cols.length < 7) return;

            const nomorPerkara = cols[1]?.textContent?.trim();
            // Must be valid nomor perkara (starts with digit)
            if (!nomorPerkara || !/^\d/.test(nomorPerkara)) return;

            data.push({
              nomor_perkara: nomorPerkara,
              sipp_tanggal_register: cols[2]?.textContent?.trim() || '',
              sipp_klasifikasi: cols[3]?.textContent?.trim() || '',
              para_pihak: cols[4]?.textContent?.trim() || '',
              sipp_status: cols[5]?.textContent?.trim() || '',
              sipp_lama_proses: cols[6]?.textContent?.trim() || ''
            });
          });

          return data;
        });

        if (pageData.length === 0) {
          console.log(`[SIPP] No more data on page ${currentPage}`);
          break;
        }

        // Process each perkara
        for (const item of pageData) {
          const jenis = this.detectJenisPerkara(item.nomor_perkara);
          perkaraList.push({
            ...item,
            jenis_perkara: jenis,
            nama_perkara: item.sipp_klasifikasi,
            tahun_masuk: this.extractTahun(item.nomor_perkara),
            sipp_synced: 1,
            sipp_last_sync: new Date().toISOString()
          });
        }

        console.log(`[SIPP] Page ${currentPage}: ${pageData.length} perkara (total: ${perkaraList.length})`);

        // Report progress
        if (progressCallback) {
          progressCallback({
            current: perkaraList.length,
            page: currentPage
          });
        }

        currentPage++;
      }

      await page.close();
      console.log(`[SIPP] Total fetched: ${perkaraList.length} perkara`);
      return perkaraList;

    } finally {
      await browser.close();
    }
  }

  /**
   * Fetch dengan retry logic
   */
  async fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(url, {
          timeout: 30000,
          responseType: 'text'
        });

        // Return object with text() method for compatibility
        return {
          text: () => Promise.resolve(response.data),
          ok: true
        };
      } catch (error) {
        if (i < maxRetries - 1) {
          const backoff = 5000 * (i + 1);
          console.log(`[SIPP] Retry ${i + 1}/${maxRetries} in ${backoff}ms:`, error.message);
          await new Promise(r => setTimeout(r, backoff));
        } else {
          throw new Error(`SIPP fetch failed after ${maxRetries} retries: ${error.message}`);
        }
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Parse tabel perkara dari HTML SIPP
   */
  parsePerkaraTable(html) {
    const $ = cheerio.load(html);
    const perkaraList = [];

    $('table tr').each((i, row) => {
      // Skip header row
      if (i === 0) return;

      const cols = $(row).find('td');
      if (cols.length < 7) return;

      const nomorPerkara = $(cols[1]).text().trim();
      if (!nomorPerkara || nomorPerkara === '') return;

      const jenis = this.detectJenisPerkara(nomorPerkara);

      perkaraList.push({
        nomor_perkara: nomorPerkara,
        sipp_tanggal_register: $(cols[2]).text().trim(),
        sipp_klasifikasi: $(cols[3]).text().trim(),
        para_pihak: $(cols[4]).text().trim(),
        sipp_status: $(cols[5]).text().trim(),
        sipp_lama_proses: $(cols[6]).text().trim(),
        jenis_perkara: jenis,
        nama_perkara: $(cols[3]).text().trim(), // fallback from klasifikasi
        tahun_masuk: this.extractTahun(nomorPerkara),
        sipp_synced: 1,
        sipp_last_sync: new Date().toISOString()
      });
    });

    console.log(`[SIPP] Parsed ${perkaraList.length} perkara`);
    return perkaraList;
  }

  /**
   * Fetch jadwal sidang untuk satu perkara.
   *
   * Flow:
   *   1. Submit SIPP search form for the nomor perkara
   *   2. Grab the `show_detil` URL from the matching row
   *   3. Open detail page, click the Jadwal Sidang tab (#tabs4)
   *   4. Wait for the AJAX-loaded table inside #tabs4 and scrape it
   */
  async fetchJadwalSidang(nomorPerkara) {
    console.log('[SIPP] Fetching jadwal for:', nomorPerkara);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();

      // 1. Open SIPP and submit the search form
      await page.goto(this.sippUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#search-box', { timeout: 10000 });
      await page.click('#search-box');
      await page.type('#search-box', nomorPerkara, { delay: 25 });

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        page.evaluate(() => {
          const form = document.querySelector('form[action*="search"]');
          if (form) form.submit();
        })
      ]);

      // 2. Find the detail URL for the matching row
      const detilUrl = await page.evaluate((nomor) => {
        const rows = document.querySelectorAll('table tr');
        for (const row of rows) {
          const cols = row.querySelectorAll('td');
          if (cols.length >= 2 && cols[1].textContent.trim() === nomor) {
            const a = row.querySelector('a[href*="show_detil"]');
            return a ? a.href : null;
          }
        }
        return null;
      }, nomorPerkara);

      if (!detilUrl) {
        console.log('[SIPP] Perkara not found in search results:', nomorPerkara);
        return [];
      }

      // 3. Open detail page and click the Jadwal Sidang tab
      await page.goto(detilUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('a[href*="#tabs4"]', { timeout: 10000 });
      await page.evaluate(() => {
        const tab = document.querySelector('a[href*="#tabs4"]');
        if (tab) tab.click();
      });

      // 4. Wait for AJAX content inside #tabs4, then scrape
      await page.waitForFunction(
        () => {
          const t = document.getElementById('tabs4');
          return t && t.querySelector('table tr td');
        },
        { timeout: 15000 }
      ).catch(() => null);

      const jadwal = await page.evaluate(() => {
        const t = document.getElementById('tabs4');
        if (!t) return [];
        const out = [];
        t.querySelectorAll('table tr').forEach((row, i) => {
          if (i === 0) return; // header
          const cols = row.querySelectorAll('td');
          if (cols.length < 5) return;
          out.push({
            nomor: cols[0]?.textContent?.trim() || '',
            tanggal: cols[1]?.textContent?.trim() || '',
            jam: cols[2]?.textContent?.trim() || '',
            agenda: cols[3]?.textContent?.trim() || '',
            ruangan: cols[4]?.textContent?.trim().replace(/\s+/g, ' ') || '',
            alasanDitunda: cols[5]?.textContent?.trim() || ''
          });
        });
        return out;
      });

      console.log('[SIPP] Found', jadwal.length, 'sidang schedules');
      return jadwal;

    } catch (error) {
      console.error('[SIPP] Error fetching jadwal:', error.message);
      return [];
    } finally {
      await browser.close();
    }
  }

  /**
   * Deteksi jenis perkara dari nomor perkara
   * Contoh: 4/Pdt.P/2026/PN Ntn -> Perdata
   *          22/Pid.B/2026/PN Ntn -> Pidana
   */
  detectJenisPerkara(nomorPerkara) {
    const upper = nomorPerkara.toUpperCase();

    // Check PRK first because Pid.Sus-PRK contains both /PID and PRK
    if (upper.includes('PRK')) return 'Perikanan';
    if (upper.includes('/PDT')) return 'Perdata';
    if (upper.includes('/PID')) return 'Pidana';

    return 'Lainnya';
  }

  /**
   * Extract tahun dari nomor perkara
   * Contoh: 4/Pdt.P/2026/PN Ntn -> 2026
   */
  extractTahun(nomorPerkara) {
    const match = nomorPerkara.match(/\/(\d{4})\//);
    return match ? parseInt(match[1]) : new Date().getFullYear();
  }

  /**
   * Simpan data perkara ke database
   */
  async saveToDatabase(perkaraList) {
    if (perkaraList.length === 0) {
      console.log('[SIPP] No data to save');
      return 0;
    }

    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO perkara
      (nomor_perkara, sipp_tanggal_register, sipp_klasifikasi, para_pihak,
       sipp_status, sipp_lama_proses, jenis_perkara, nama_perkara, tahun_masuk,
       sipp_synced, sipp_last_sync)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((perkara) => {
      try {
        insert.run(
          perkara.nomor_perkara,
          perkara.sipp_tanggal_register,
          perkara.sipp_klasifikasi,
          perkara.para_pihak,
          perkara.sipp_status,
          perkara.sipp_lama_proses,
          perkara.jenis_perkara,
          perkara.nama_perkara,
          perkara.tahun_masuk,
          perkara.sipp_synced,
          perkara.sipp_last_sync
        );
      } catch (error) {
        console.error('[SIPP] Error inserting:', perkara.nomor_perkara, error.message);
      }
    });

    perkaraList.forEach(transaction);
    return perkaraList.length;
  }
}

module.exports = SIPPSyncService;
