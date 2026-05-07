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
   * Fetch jadwal sidang untuk satu perkara
   */
  async fetchJadwalSidang(nomorPerkara) {
    console.log('[SIPP] Fetching jadwal for:', nomorPerkara);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();

      // Search for the perkara
      await page.goto(this.sippUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('table', { timeout: 10000 });

      // Search the perkara in the table
      const found = await page.evaluate((nomor) => {
        const rows = document.querySelectorAll('table tr');
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].querySelectorAll('td');
          if (cols.length >= 2) {
            const nomorPerkara = cols[1]?.textContent?.trim();
            if (nomorPerkara === nomor) {
              // Click the detail link
              const link = cols[0]?.querySelector('a');
              if (link) {
                link.click();
                return true;
              }
            }
          }
        }
        return false;
      }, nomorPerkara);

      if (!found) {
        await browser.close();
        return [];
      }

      // Wait for detail page to load
      await new Promise(r => setTimeout(r, 3000));

      // Get jadwal sidang from detail page
      const jadwal = await page.evaluate(() => {
        const sidangList = [];
        const tables = document.querySelectorAll('table');

        tables.forEach(table => {
          const headers = table.querySelectorAll('th');
          let isJadwalTable = false;

          headers.forEach(h => {
            if (h.textContent.includes('jadwal') || h.textContent.includes('sidang')) {
              isJadwalTable = true;
            }
          });

          if (isJadwalTable) {
            const rows = table.querySelectorAll('tr');
            rows.forEach((row, i) => {
              if (i === 0) return; // Skip header

              const cols = row.querySelectorAll('td');
              if (cols.length >= 3) {
                const nomor = cols[0]?.textContent?.trim() || '';
                const tanggal = cols[1]?.textContent?.trim() || '';
                const agenda = cols[2]?.textContent?.trim() || '';
                const ruangan = cols.length > 3 ? cols[3]?.textContent?.trim() : '';
                const alasanDitunda = cols.length > 4 ? cols[4]?.textContent?.trim() : '';

                if (nomor || tanggal || agenda) {
                  sidangList.push({ nomor, tanggal, agenda, ruangan, alasanDitunda });
                }
              }
            });
          }
        });

        return sidangList;
      });

      await browser.close();
      console.log('[SIPP] Found', jadwal.length, 'sidang schedules');
      return jadwal;

    } catch (error) {
      console.error('[SIPP] Error fetching jadwal:', error.message);
      await browser.close();
      return [];
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
