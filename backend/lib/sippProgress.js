const SYNC_PAGE_TOTALS = {
  full: 150,
  incremental: 10
};

function getPageTotal(isFirstSync) {
  return isFirstSync ? SYNC_PAGE_TOTALS.full : SYNC_PAGE_TOTALS.incremental;
}

function createInitialSyncProgress({ isFirstSync }) {
  const maxPages = getPageTotal(isFirstSync);

  return {
    inProgress: true,
    phase: 'fetching',
    current: 0,
    total: maxPages,
    page: 0,
    maxPages,
    fetchedCount: 0,
    unit: 'halaman',
    message: `Memproses halaman 1 dari ${maxPages}`,
    error: null,
    isFirstSync
  };
}

function applyFetchProgress(currentProgress, progress) {
  const maxPages = progress.maxPages || currentProgress.maxPages || currentProgress.total || getPageTotal(currentProgress.isFirstSync);
  const page = Math.min(Number(progress.page || 0), maxPages);
  const fetchedCount = Number(progress.fetchedCount ?? progress.current ?? currentProgress.fetchedCount ?? 0);
  const isStarting = progress.status === 'page-start';
  const verb = isStarting ? 'Memproses' : 'Selesai memproses';

  return {
    ...currentProgress,
    inProgress: true,
    phase: 'fetching',
    current: page,
    total: maxPages,
    page,
    maxPages,
    fetchedCount,
    unit: 'halaman',
    message: `${verb} halaman ${page} dari ${maxPages} (${fetchedCount} perkara terbaca)`,
    error: null
  };
}

function startSaveProgress(currentProgress) {
  return {
    ...currentProgress,
    inProgress: true,
    phase: 'saving',
    message: `Menyimpan ${currentProgress.fetchedCount || 0} perkara ke database...`
  };
}

function startDetailCacheProgress(currentProgress, { total = 0 } = {}) {
  return {
    ...currentProgress,
    inProgress: true,
    phase: 'caching-details',
    current: 0,
    total,
    unit: 'perkara',
    detailCache: {
      jadwalOk: 0,
      jadwalFailed: 0,
      putusanOk: 0,
      putusanFailed: 0,
      failed: 0
    },
    message: total > 0
      ? `Memperbarui cache jadwal dan putusan untuk ${total} perkara terbaru...`
      : 'Memperbarui cache jadwal dan putusan...'
  };
}

function applyDetailCacheProgress(currentProgress, progress = {}) {
  const total = Number(progress.total ?? currentProgress.total ?? 0);
  const current = Math.min(Number(progress.current ?? 0), total || Number(progress.current ?? 0));
  const detailCache = {
    jadwalOk: Number(progress.jadwalOk ?? currentProgress.detailCache?.jadwalOk ?? 0),
    jadwalFailed: Number(progress.jadwalFailed ?? currentProgress.detailCache?.jadwalFailed ?? 0),
    putusanOk: Number(progress.putusanOk ?? currentProgress.detailCache?.putusanOk ?? 0),
    putusanFailed: Number(progress.putusanFailed ?? currentProgress.detailCache?.putusanFailed ?? 0),
    failed: Number(progress.failed ?? currentProgress.detailCache?.failed ?? 0)
  };
  const suffix = progress.nomorPerkara ? `: ${progress.nomorPerkara}` : '';

  return {
    ...currentProgress,
    inProgress: true,
    phase: 'caching-details',
    current,
    total,
    unit: 'perkara',
    detailCache,
    message: `Memperbarui cache jadwal dan putusan ${current} dari ${total} perkara${suffix}`,
    error: null
  };
}

function completeSyncProgress(currentProgress, { savedCount, dbCount }) {
  const total = currentProgress.total || currentProgress.maxPages || 1;
  const fetchedCount = currentProgress.fetchedCount ?? savedCount ?? 0;

  return {
    ...currentProgress,
    inProgress: false,
    phase: 'complete',
    current: total,
    total,
    page: total,
    maxPages: total,
    fetchedCount,
    savedCount,
    dbCount,
    unit: 'halaman',
    message: `Selesai memproses ${total} dari ${total} halaman SIPP (${savedCount} perkara disimpan)`,
    error: null
  };
}

function failSyncProgress(currentProgress, error) {
  return {
    ...currentProgress,
    inProgress: false,
    phase: 'error',
    error: error.message,
    message: `Error: ${error.message}`
  };
}

module.exports = {
  SYNC_PAGE_TOTALS,
  createInitialSyncProgress,
  applyFetchProgress,
  startSaveProgress,
  startDetailCacheProgress,
  applyDetailCacheProgress,
  completeSyncProgress,
  failSyncProgress
};
