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
   * Cek apakah ini sync pertama kali (database kosong)
   */
  isFirstSync() {
    const count = this.db.prepare('SELECT COUNT(*) as c FROM perkara').get().c;
    return count === 0;
  }

  /**
   * Fetch HTML dari website SIPP menggunakan Puppeteer (untuk pagination JavaScript)
   * - First sync: sync SEMUA perkara (~4557 total)
   * - Subsequent sync: hanya 200 perkara terbaru (10 halaman)
   */
  async fetchSIPPData(progressCallback = null) {
    const firstSync = this.isFirstSync();
    const maxPages = firstSync ? 150 : 10; // First sync: 150 pages (avoid context destroy), subsequent: 10 pages

    console.log(`[SIPP] Fetching data from ${this.sippUrl} (${firstSync ? 'FIRST SYNC - ALL DATA' : 'incremental - 200 newest'})...`);

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
      const seenNomor = new Set(); // Track unique perkara to avoid duplicates
      let currentPage = 1;
      let consecutiveEmptyPages = 0;
      const maxEmptyPages = 3; // Stop after 3 consecutive empty pages

      while (currentPage <= maxPages && consecutiveEmptyPages < maxEmptyPages) {
        console.log(`[SIPP] Scraping page ${currentPage}...`);

        // Navigate to specific page by clicking the page number link
        if (currentPage > 1) {
          try {
            const navigated = await page.evaluate((pageNum) => {
              const pagesDiv = document.getElementById('pages');
              if (!pagesDiv) return false;

              // Find the link with the page number
              const pageLink = Array.from(pagesDiv.querySelectorAll('a')).find(a =>
                a.textContent.trim() === pageNum.toString()
              );

              if (!pageLink) return false;

              pageLink.click();
              return true;
            }, currentPage);

            if (!navigated) {
              console.log(`[SIPP] Page ${currentPage} link not found, stopping`);
              break;
            }

            // Wait for table to reload
            await new Promise(r => setTimeout(r, 2000));
          } catch (e) {
            console.log(`[SIPP] Navigation error: ${e.message}, stopping`);
            break;
          }
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
          consecutiveEmptyPages++;
          console.log(`[SIPP] No data on page ${currentPage} (${consecutiveEmptyPages}/${maxEmptyPages} empty)`);
          currentPage++;
          continue;
        }

        consecutiveEmptyPages = 0; // Reset empty page counter

        // Process each perkara and track unique ones
        let newInPage = 0;
        for (const item of pageData) {
          if (seenNomor.has(item.nomor_perkara)) {
            continue; // Skip duplicates
          }
          seenNomor.add(item.nomor_perkara);
          newInPage++;

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

        console.log(`[SIPP] Page ${currentPage}: ${pageData.length} rows, ${newInPage} new, ${perkaraList.length} unique total`);

        // Report progress
        if (progressCallback) {
          progressCallback({
            current: perkaraList.length,
            page: currentPage,
            total: seenNomor.size
          });
        }

        // Save batch every 50 pages to prevent data loss on error
        if (currentPage % 50 === 0) {
          console.log(`[SIPP] Saving batch at page ${currentPage} (${perkaraList.length} perkara)...`);
          // Create a temporary callback to save current batch
          if (progressCallback) {
            progressCallback({
              current: perkaraList.length,
              page: currentPage,
              total: seenNomor.size,
              saveBatch: true  // Signal to save current batch
            });
          }
        }

        // For first sync, stop if we've collected ~4500+ (SIPP has ~4557 total)
        if (firstSync && perkaraList.length >= 4600) {
          console.log(`[SIPP] First sync collected ${perkaraList.length} perkara (expected ~4557), stopping`);
          break;
        }

        // Stop if we're getting all duplicates
        if (newInPage === 0 && consecutiveEmptyPages === 0) {
          console.log(`[SIPP] All duplicates on page ${currentPage}, stopping`);
          break;
        }

        currentPage++;
      }

      await page.close();
      console.log(`[SIPP] Total fetched: ${perkaraList.length} unique perkara`);
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
   * Fetch jadwal sidang untuk satu perkara (single-call: launch browser sendiri).
   */
  async fetchJadwalSidang(nomorPerkara) {
    console.log('[SIPP] Fetching jadwal for:', nomorPerkara);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      return await this._fetchJadwalFromPage(page, nomorPerkara);
    } catch (error) {
      console.error('[SIPP] Error fetching jadwal:', error.message);
      return [];
    } finally {
      await browser.close();
    }
  }

  /**
   * Fetch tanggal minutasi dari detail page perkara
   */
  async _fetchTanggalMinutasi(page, nomorPerkara) {
    await page.goto(this.sippUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#search-box', { timeout: 10000 });
    await page.click('#search-box');
    await page.$eval('#search-box', (el) => { el.value = ''; });
    await page.type('#search-box', nomorPerkara, { delay: 25 });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      page.evaluate(() => {
        const form = document.querySelector('form[action*="search"]');
        if (form) form.submit();
      })
    ]);

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

    if (!detilUrl) return null;

    await page.goto(detilUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Scrap tanggal minutasi dari tab atau detail
    const minutasi = await page.evaluate(() => {
      // Cari di tabs - biasanya di "Putusan" atau tab lain
      const tabs = document.querySelectorAll('[id^="tabs"]');
      for (const tab of tabs) {
        const text = tab.textContent;
        // Cari pola tanggal minutasi/putusan
        const match = text.match(/minutasi|putus(?:an)?|tanggal.*:\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+\w+\s+\d{4})/i);
        if (match) {
          // Coba extract tanggal yang valid
          const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dateMatch) return dateMatch[1];
        }
      }

      // Cari di seluruh halaman
      const pageText = document.body.textContent;
      const minutasiMatch = pageText.match(/tanggal\s+minutasi\s*[:=]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (minutasiMatch) return minutasiMatch[1];

      const putusanMatch = pageText.match(/tanggal\s+putus\s*[:=]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (putusanMatch) return putusanMatch[1];

      return null;
    });

    return minutasi;
  }

  /**
   * Core scrape logic — terima Page yang sudah ready. Dipanggil oleh
   * fetchJadwalSidang (single) dan cacheJadwalCurrentYear (batch).
   *
   * Flow:
   *   1. Submit SIPP search form for the nomor perkara
   *   2. Grab the `show_detil` URL from the matching row
   *   3. Open detail page, click the Jadwal Sidang tab (#tabs4)
   *   4. Wait for the AJAX-loaded table inside #tabs4 and scrape it
   */
  async _fetchJadwalFromPage(page, nomorPerkara) {
    // 1. Open SIPP and submit the search form
    await page.goto(this.sippUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#search-box', { timeout: 10000 });
    await page.click('#search-box');
    // Clear input first (in case batch reuses page after a previous search)
    await page.$eval('#search-box', (el) => { el.value = ''; });
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

    console.log('[SIPP] Found', jadwal.length, 'sidang schedules for', nomorPerkara);
    return jadwal;
  }

  /**
   * Fetch jadwal sidang dan persist ke tabel jadwal_sidang.
   * Strategi: DELETE existing + INSERT new dalam satu transaction.
   *
   * @param {string} nomorPerkara
   * @param {import('puppeteer').Page} page - reused page instance
   * @returns {Promise<number>} jumlah jadwal yang ke-cache
   */
  async fetchAndCacheJadwal(nomorPerkara, page) {
    const jadwal = await this._fetchJadwalFromPage(page, nomorPerkara);
    const fetchedAt = new Date().toISOString();

    const del = this.db.prepare('DELETE FROM jadwal_sidang WHERE nomor_perkara = ?');
    const ins = this.db.prepare(`
      INSERT INTO jadwal_sidang
      (nomor_perkara, nomor, tanggal, jam, agenda, ruangan, alasan_ditunda, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((entries) => {
      del.run(nomorPerkara);
      if (entries.length === 0) {
        // Sentinel: marks "we fetched, found 0 jadwal". Distinguishes
        // "no cache yet" from "cached and confirmed empty" — keeps the
        // endpoint from thrashing puppeteer for perkara not yet sched.
        ins.run(nomorPerkara, null, null, null, null, null, null, fetchedAt);
      } else {
        for (const e of entries) {
          ins.run(
            nomorPerkara,
            parseInt(e.nomor) || null,
            e.tanggal || null,
            e.jam || null,
            e.agenda || null,
            e.ruangan || null,
            e.alasanDitunda || null,
            fetchedAt
          );
        }
      }
    });

    tx(jadwal);
    return jadwal.length;
  }

  /**
   * Cache jadwal sidang untuk 100 perkara terbaru.
   * 1 browser instance dipakai ulang untuk seluruh batch.
   *
   * Concurrency-guarded: kalau call kedua masuk saat batch sebelumnya masih
   * jalan (misal startup populate overlap dengan cron jam :00), call kedua
   * langsung return dengan `skipped: true` tanpa launch browser baru.
   *
   * @returns {Promise<{ok: number, failed: number, total: number, skipped?: boolean}>}
   */
  async cacheJadwalCurrentYear() {
    if (this.cachePopulateInProgress) {
      console.log('[CACHE] populate already in progress, skipping');
      return { ok: 0, failed: 0, total: 0, skipped: true };
    }
    this.cachePopulateInProgress = true;

    try {
      // Ambil 100 perkara terbaru (berdasarkan created_at DESC)
      const perkara = this.db.prepare(`
        SELECT nomor_perkara FROM perkara
        ORDER BY created_at DESC
        LIMIT 100
      `).all();

      console.log(`[CACHE] Caching jadwal for ${perkara.length} newest perkara`);

      if (perkara.length === 0) {
        return { ok: 0, failed: 0, total: 0 };
      }

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      let ok = 0;
      let failed = 0;
      try {
        const page = await browser.newPage();
        for (const p of perkara) {
          try {
            const n = await this.fetchAndCacheJadwal(p.nomor_perkara, page);
            ok++;
            console.log(`[CACHE] ${ok + failed}/${perkara.length}: ${p.nomor_perkara} -> ${n} jadwal`);
          } catch (err) {
            failed++;
            console.error(`[CACHE] failed ${p.nomor_perkara}:`, err.message);
            // Reset page state so a wedged page (crashed frame, dangling
            // navigation) doesn't cascade into the next iteration.
            try { await page.goto('about:blank'); } catch (_) { /* ignore */ }
          }
          await new Promise(r => setTimeout(r, 200)); // throttle SIPP
        }
      } finally {
        await browser.close();
      }

      console.log(`[CACHE] done: ok=${ok}, failed=${failed}, total=${perkara.length}`);
      return { ok, failed, total: perkara.length };
    } finally {
      this.cachePopulateInProgress = false;
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
