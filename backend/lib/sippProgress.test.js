const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createInitialSyncProgress,
  applyFetchProgress,
  completeSyncProgress
} = require('./sippProgress');

test('initial incremental progress uses page total as measured work', () => {
  const progress = createInitialSyncProgress({ isFirstSync: false });

  assert.equal(progress.inProgress, true);
  assert.equal(progress.phase, 'fetching');
  assert.equal(progress.current, 0);
  assert.equal(progress.total, 10);
  assert.equal(progress.page, 0);
  assert.equal(progress.maxPages, 10);
  assert.equal(progress.unit, 'halaman');
  assert.match(progress.message, /halaman 1 dari 10/i);
});

test('fetch progress advances by processed SIPP page and keeps perkara count as metadata', () => {
  const current = createInitialSyncProgress({ isFirstSync: false });
  const next = applyFetchProgress(current, {
    page: 3,
    maxPages: 10,
    fetchedCount: 58,
    status: 'page-complete'
  });

  assert.equal(next.current, 3);
  assert.equal(next.total, 10);
  assert.equal(next.page, 3);
  assert.equal(next.maxPages, 10);
  assert.equal(next.fetchedCount, 58);
  assert.match(next.message, /halaman 3 dari 10/i);
  assert.match(next.message, /58 perkara/i);
});

test('complete progress reports all pages processed while preserving fetched count', () => {
  const current = applyFetchProgress(createInitialSyncProgress({ isFirstSync: false }), {
    page: 10,
    maxPages: 10,
    fetchedCount: 197,
    status: 'page-complete'
  });

  const complete = completeSyncProgress(current, {
    savedCount: 197,
    dbCount: 1200
  });

  assert.equal(complete.inProgress, false);
  assert.equal(complete.phase, 'complete');
  assert.equal(complete.current, 10);
  assert.equal(complete.total, 10);
  assert.equal(complete.fetchedCount, 197);
  assert.equal(complete.savedCount, 197);
  assert.match(complete.message, /10 dari 10 halaman/i);
});
