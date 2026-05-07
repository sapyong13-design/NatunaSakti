// ============================================
// SIPP SYNC SERVICE
// Fetch dan sync data perkara dari SIPP PN Natuna
// ============================================

const fetch = require('node-fetch');
const cheerio = require('cheerio');

class SIPPSyncService {
  constructor(db) {
    this.db = db;
    this.sippUrl = 'https://sipp.pn-natuna.go.id/';
  }

  /**
   * Fetch HTML dari website SIPP
   */
  async fetchSIPPData() {
    console.log('[SIPP] Fetching data from', this.sippUrl);
    const response = await this.fetchWithRetry(this.sippUrl);
    const html = await response.text();
    return this.parsePerkaraTable(html);
  }

  /**
   * Fetch dengan retry logic
   */
  async fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(url, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) return response;

        if (i < maxRetries - 1) {
          const backoff = 5000 * (i + 1);
          console.log(`[SIPP] Retry ${i + 1}/${maxRetries} in ${backoff}ms`);
          await new Promise(r => setTimeout(r, backoff));
        }
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
   * Deteksi jenis perkara dari nomor perkara
   * Contoh: 4/Pdt.P/2026/PN Ntn -> Perdata
   *          22/Pid.B/2026/PN Ntn -> Pidana
   */
  detectJenisPerkara(nomorPerkara) {
    const upper = nomorPerkara.toUpperCase();

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
