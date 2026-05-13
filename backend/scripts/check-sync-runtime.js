const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  const syncResponses = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/perkara/sipp/sync')) {
      syncResponses.push({ url, status: response.status() });
    }
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.ns-sync-btn', { timeout: 15000 });
  await page.click('.ns-sync-btn');
  await page.waitForSelector('.ns-sync-progress-bar', { timeout: 10000 });
  await page.waitForFunction(() => {
    const detail = document.querySelector('.ns-sync-detail')?.textContent || '';
    const message = document.querySelector('.ns-sync-message')?.textContent || '';
    return !message.includes('Memulai') || !detail.includes('0/200');
  }, { timeout: 45000 }).catch(() => {});

  const result = await page.evaluate(() => {
    const status = document.querySelector('.ns-sync-status');
    const detail = document.querySelector('.ns-sync-detail')?.textContent?.trim() || '';
    const message = document.querySelector('.ns-sync-message')?.textContent?.trim() || '';
    const bar = document.querySelector('.ns-sync-progress-bar span');
    return {
      isSyncing: status?.classList.contains('is-syncing') || false,
      isComplete: status?.classList.contains('is-complete') || false,
      label: document.querySelector('.ns-sync-label')?.textContent?.trim() || '',
      detail,
      message,
      barWidth: bar?.style.width || '',
      hasProgressBar: Boolean(document.querySelector('.ns-sync-progress-bar')),
    };
  });

  await browser.close();

  const passed =
    syncResponses.some((response) => [200, 204, 409].includes(response.status)) &&
    result.hasProgressBar &&
    Boolean(result.detail) &&
    Boolean(result.message) &&
    (result.message !== 'Memulai...' || result.detail !== '0/200 perkara · 0%') &&
    (result.isSyncing || result.isComplete);

  console.log(JSON.stringify({ syncResponses, result, passed }, null, 2));

  if (!passed) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
