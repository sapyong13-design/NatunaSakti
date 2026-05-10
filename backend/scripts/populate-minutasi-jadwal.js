// Populate tanggal putus (dari register + lama proses) dan jadwal sidang
const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'akurasi.db'));

const monthMap = { jan:0, feb:1, mar:2, apr:3, mei:4, may:4, jun:5, jul:6, agu:7, aug:7, sep:8, okt:9, oct:9, nov:10, des:11, dec:11 };

function parseTanggalSIPP(s) {
  if (!s) return null;
  const parts = s.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const day = parseInt(parts[0]);
  const mon = monthMap[parts[1].toLowerCase().slice(0, 3)];
  const year = parseInt(parts[2]);
  if (mon === undefined || isNaN(day) || isNaN(year)) return null;
  return new Date(year, mon, day);
}

function hitungTanggalPutus(tanggalRegister, lamaProses) {
  const regDate = parseTanggalSIPP(tanggalRegister);
  if (!regDate || !lamaProses) return null;

  // Parse "15 Hari", "1 Hari", etc.
  const match = lamaProses.match(/(\d+)\s*(Hari|hari)/i);
  if (!match) return null;

  const days = parseInt(match[1]);
  const putusDate = new Date(regDate);
  putusDate.setDate(putusDate.getDate() + days);

  // Format ke dd/mm/yyyy
  const d = String(putusDate.getDate()).padStart(2, '0');
  const m = String(putusDate.getMonth() + 1).padStart(2, '0');
  const y = putusDate.getFullYear();
  return `${d}/${m}/${y}`;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  // Hitung tanggal_putus untuk SEMUA perkara yang punya lama_proses
  const perkaraToUpdate = db.prepare(`
    SELECT nomor_perkara, sipp_tanggal_register, sipp_lama_proses
    FROM perkara
    WHERE sipp_lama_proses IS NOT NULL
    AND sipp_lama_proses != ''
    AND tanggal_putus IS NULL
  `).all();

  console.log(`[MINUTASI] Menghitung tanggal putus untuk ${perkaraToUpdate.length} perkara...`);

  const updateMinutasi = db.prepare('UPDATE perkara SET tanggal_putus = ? WHERE nomor_perkara = ?');
  let minutasiUpdated = 0;

  for (const p of perkaraToUpdate) {
    const tanggalPutus = hitungTanggalPutus(p.sipp_tanggal_register, p.sipp_lama_proses);
    if (tanggalPutus) {
      updateMinutasi.run(tanggalPutus, p.nomor_perkara);
      minutasiUpdated++;
      if (minutasiUpdated % 100 === 0) {
        console.log(`[MINUTASI] ${minutasiUpdated}/${perkaraToUpdate.length} processed...`);
      }
    }
  }

  console.log(`[MINUTASI] Selesai! ${minutasiUpdated} tanggal putus diupdate`);

  // Ambil SEMUA perkara untuk jadwal sidang
  const perkara = db.prepare(`
    SELECT nomor_perkara FROM perkara
    ORDER BY created_at DESC
  `).all();

  console.log(`[JADWAL] Populating jadwal sidang for ${perkara.length} perkara...`);

  const delJadwal = db.prepare('DELETE FROM jadwal_sidang WHERE nomor_perkara = ?');
  const insJadwal = db.prepare(`
    INSERT INTO jadwal_sidang
    (nomor_perkara, nomor, tanggal, jam, agenda, ruangan, alasan_ditunda, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let jadwalFound = 0;

  try {
    const page = await browser.newPage();

    for (const p of perkara) {
      try {
        console.log(`[JADWAL] Processing ${p.nomor_perkara}...`);

        // Open SIPP
        await page.goto('https://sipp.pn-natuna.go.id/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('#search-box', { timeout: 10000 }).catch(() => {});

        // Search nomor perkara
        await page.click('#search-box');
        await page.$eval('#search-box', (el) => { el.value = ''; });
        await page.type('#search-box', p.nomor_perkara, { delay: 25 });

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
          page.evaluate(() => {
            const form = document.querySelector('form[action*="search"]');
            if (form) form.submit();
          })
        ]);

        // Get detail URL
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
        }, p.nomor_perkara);

        if (!detilUrl) {
          console.log(`[JADWAL] ${p.nomor_perkara} not found`);
          await sleep(1000);
          continue;
        }

        // Open detail page
        await page.goto(detilUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(2000);

        // Scrape jadwal sidang dari tab #tabs4
        await page.evaluate(() => {
          const tab = document.querySelector('a[href*="#tabs4"]');
          if (tab) tab.click();
        });
        await sleep(2000);

        const jadwal = await page.evaluate(() => {
          const t = document.getElementById('tabs4');
          if (!t) return [];
          const out = [];
          t.querySelectorAll('table tr').forEach((row, i) => {
            if (i === 0) return;
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

        const fetchedAt = new Date().toISOString();
        delJadwal.run(p.nomor_perkara);

        if (jadwal.length === 0) {
          insJadwal.run(p.nomor_perkara, null, null, null, null, null, null, fetchedAt);
        } else {
          for (const e of jadwal) {
            insJadwal.run(
              p.nomor_perkara,
              parseInt(e.nomor) || null,
              e.tanggal || null,
              e.jam || null,
              e.agenda || null,
              e.ruangan || null,
              e.alasanDitunda || null,
              fetchedAt
            );
          }
          jadwalFound += jadwal.length;
          console.log(`[JADWAL] ${p.nomor_perkara} → ${jadwal.length} jadwal`);
        }

      } catch (err) {
        console.error(`[JADWAL] Error ${p.nomor_perkara}:`, err.message);
      }

      await sleep(300);
    }

    console.log(`[JADWAL] Done! Total jadwal: ${jadwalFound}`);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
