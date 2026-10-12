const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createInitialSyncProgress,
  applyFetchProgress,
  startSaveProgress,
  completeSyncProgress,
  failSyncProgress
} = require('./sippProgress');

test('initial progress waits for database perkara count', () => {
  const progress = createInitialSyncProgress();

  assert.equal(progress.inProgress, true);
  assert.equal(progress.phase, 'fetching');
  assert.equal(progress.current, 0);
  assert.equal(progress.total, 0);
  assert.equal(progress.fetchedCount, 0);
  assert.equal(progress.unit, 'perkara');
  assert.equal(progress.error, null);
});

test('database read progress advances by perkara', () => {
  const next = applyFetchProgress(createInitialSyncProgress(), {
    current: 58,
    total: 1200,
    fetchedCount: 58,
    status: 'db-read'
  });

  assert.equal(next.inProgress, true);
  assert.equal(next.phase, 'fetching');
  assert.equal(next.current, 58);
  assert.equal(next.total, 1200);
  assert.equal(next.fetchedCount, 58);
  assert.equal(next.unit, 'perkara');
});

test('saving stays in progress until snapshot and detail caches are saved', () => {
  const fetched = applyFetchProgress(createInitialSyncProgress(), {
    current: 1200,
    total: 1200,
    fetchedCount: 1200,
    status: 'db-read'
  });
  const saving = startSaveProgress(fetched);

  assert.equal(saving.inProgress, true);
  assert.equal(saving.phase, 'saving');
  assert.equal(saving.current, 1200);
  assert.equal(saving.total, 1200);
  assert.equal(saving.fetchedCount, 1200);
  assert.equal(saving.unit, 'perkara');

  const complete = completeSyncProgress(saving, {
    savedCount: 1200,
    dbCount: 1250
  });

  assert.equal(complete.inProgress, false);
  assert.equal(complete.phase, 'complete');
  assert.equal(complete.current, 1200);
  assert.equal(complete.total, 1200);
  assert.equal(complete.fetchedCount, 1200);
  assert.equal(complete.savedCount, 1200);
  assert.equal(complete.dbCount, 1250);
  assert.equal(complete.unit, 'perkara');
  assert.equal(complete.error, null);
});

test('empty database snapshot completes with zero perkara', () => {
  const complete = completeSyncProgress(startSaveProgress(createInitialSyncProgress()), {
    savedCount: 0,
    dbCount: 0
  });

  assert.equal(complete.inProgress, false);
  assert.equal(complete.phase, 'complete');
  assert.equal(complete.current, 0);
  assert.equal(complete.total, 0);
  assert.equal(complete.fetchedCount, 0);
  assert.equal(complete.savedCount, 0);
});

test('failed database read retains progress and exposes error without claiming completion', () => {
  const current = applyFetchProgress(createInitialSyncProgress(), {
    current: 58,
    total: 1200,
    fetchedCount: 58,
    status: 'db-read'
  });
  const failed = failSyncProgress(current, new Error('SSH tunnel unavailable'));

  assert.equal(failed.inProgress, false);
  assert.equal(failed.phase, 'error');
  assert.equal(failed.current, 58);
  assert.equal(failed.total, 1200);
  assert.equal(failed.fetchedCount, 58);
  assert.equal(failed.error, 'SSH tunnel unavailable');
  assert.equal(failed.savedCount, undefined);
});
