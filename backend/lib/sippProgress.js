function createInitialSyncProgress() {
  return {
    inProgress: true,
    phase: 'fetching',
    current: 0,
    total: 0,
    fetchedCount: 0,
    unit: 'perkara',
    message: 'Membaca seluruh perkara, jadwal, dan putusan dari database SIPP...',
    error: null
  };
}

function applyFetchProgress(currentProgress, progress) {
  const total = Number(progress.total ?? currentProgress.total ?? 0);
  const current = Math.min(Number(progress.current ?? 0), total);
  const fetchedCount = Number(progress.fetchedCount ?? current);

  return {
    ...currentProgress,
    inProgress: true,
    phase: 'fetching',
    current,
    total,
    fetchedCount,
    unit: 'perkara',
    message: `Membaca database SIPP: ${current} dari ${total} perkara`,
    error: null
  };
}

function startSaveProgress(currentProgress) {
  return {
    ...currentProgress,
    inProgress: true,
    phase: 'saving',
    message: `Menyimpan ${currentProgress.fetchedCount} perkara beserta seluruh jadwal dan putusan...`
  };
}

function completeSyncProgress(currentProgress, { savedCount, dbCount }) {
  const fetchedCount = currentProgress.fetchedCount;

  return {
    ...currentProgress,
    inProgress: false,
    phase: 'complete',
    current: fetchedCount,
    total: fetchedCount,
    fetchedCount,
    savedCount,
    dbCount,
    unit: 'perkara',
    message: `Sinkronisasi penuh database SIPP selesai (${savedCount} perkara beserta jadwal dan putusan disimpan)`,
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
  createInitialSyncProgress,
  applyFetchProgress,
  startSaveProgress,
  completeSyncProgress,
  failSyncProgress
};
