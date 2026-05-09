// Populate jadwal sidang untuk 100 perkara terbaru
const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'akurasi.db'));

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchJadwalFromPage(page, nomorPerkara, sippUrl) {
  // 1. Open SIPP and submit the search form
  await page.goto(sippUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
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

  // 2. Find the detail URL
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
    console.log(`[JADWAL] Perkara not found: ${nomorPerkara}`);
    return [];
  }

  // 3. Open detail page and click Jadwal Sidang tab
  await page.goto(detilUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('a[href*="#tabs4"]', { timeout: 10000 });
  await page.evaluate(() => {
    const tab = document.querySelector('a[href*="#tabs4"]');
    if (tab) tab.click();
  });

  // 4. Wait for AJAX content
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

  return jadwal;
}

async function main() {
  const perkara = db.prepare(`
    SELECT nomor_perkara FROM perkara
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  console.log(`[JADWAL] Populating jadwal for ${perkara.length} perkara...`);

  const del = db.prepare('DELETE FROM jadwal_sidang WHERE nomor_perkara = ?');
  const ins = db.prepare(`
    INSERT INTO jadwal_sidang
    (nomor_perkara, nomor, tanggal, jam, agenda, ruangan, alasan_ditunda, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

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
        const jadwal = await fetchJadwalFromPage(page, p.nomor_perkara, 'https://sipp.pn-natuna.go.id/');
        const fetchedAt = new Date().toISOString();

        del.run(p.nomor_perkara);

        if (jadwal.length === 0) {
          ins.run(p.nomor_perkara, null, null, null, null, null, null, fetchedAt);
        } else {
          for (const e of jadwal) {
            ins.run(
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
        }

        ok++;
        console.log(`[JADWAL] ${ok + failed}/${perkara.length}: ${p.nomor_perkara} -> ${jadwal.length} jadwal`);
      } catch (err) {
        failed++;
        console.error(`[JADWAL] failed ${p.nomor_perkara}:`, err.message);
        try { await page.goto('about:blank'); } catch (_) {}
      }
      await sleep(200);
    }

    console.log(`[JADWAL] Done: ok=${ok}, failed=${failed}`);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
