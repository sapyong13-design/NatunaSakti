const puppeteer = require('puppeteer');

async function check(width) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.ns-dashboard-view', { timeout: 15000 });

  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const wrap = document.querySelector('.ns-table-scroll');
    const firstBar = document.querySelector('.ns-bar-group');
    return {
      viewportWidth: doc.clientWidth,
      documentScrollWidth: doc.scrollWidth,
      tableWrapClientWidth: wrap?.clientWidth ?? null,
      tableWrapScrollWidth: wrap?.scrollWidth ?? null,
      hasTrendLegend: Boolean(document.querySelector('.ns-trend-legend')),
      hasFilterChipsContainer: Boolean(document.querySelector('.ns-filter-chip-list')),
      hasAttentionStrip: Boolean(document.querySelector('.ns-attention-strip')),
      hasGrainOverlay: Boolean(document.querySelector('.ns-grain-overlay')),
      tableButtonLabel: document.querySelector('.ns-view-btn')?.getAttribute('aria-label') || null,
      barAriaLabel: firstBar?.getAttribute('aria-label') || null,
      hasHorizontalOverflow:
        doc.scrollWidth > doc.clientWidth ||
        ((wrap?.scrollWidth ?? 0) > (wrap?.clientWidth ?? 0) + 1),
    };
  });

  await browser.close();
  return result;
}

(async () => {
  const results = [];
  for (const width of [1366, 900, 390]) {
    results.push(await check(width));
  }
  console.log(JSON.stringify(results, null, 2));

  const failures = results.filter((item) =>
    item.hasHorizontalOverflow ||
    !item.hasTrendLegend ||
    !item.hasFilterChipsContainer ||
    !item.hasAttentionStrip ||
    item.hasGrainOverlay ||
    item.tableButtonLabel !== 'Tampilkan tabel' ||
    !item.barAriaLabel
  );

  if (failures.length) {
    console.error('Dashboard runtime checks failed');
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
