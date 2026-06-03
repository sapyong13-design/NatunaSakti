// ============================================
// API CLIENT - Local Backend (SQLite)
// With retry logic and error recovery
// ============================================

const API_BASE = 'http://localhost:3000/api';

// Retry configuration
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const BACKOFF_MULTIPLIER = 2;

/**
 * Sleep utility for retry delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry(url, options = {}, maxRetries = DEFAULT_MAX_RETRIES) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // Don't retry on 4xx errors (client errors)
            if (response.status >= 400 && response.status < 500) {
                const error = await response.json().catch(() => ({ error: 'Request failed' }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            // Retry on 5xx or network errors
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return response;
        } catch (error) {
            lastError = error;

            // Don't retry if this is the last attempt
            if (attempt < maxRetries) {
                const delay = DEFAULT_RETRY_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt);
                console.log(`Retrying... attempt ${attempt + 1}/${maxRetries} in ${delay}ms`);
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

export function getFilenameFromContentDisposition(header, fallback) {
    const value = String(header || '')
    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match) return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ''))

    const match = value.match(/filename="?([^";]+)"?/i)
    return match ? match[1].trim() : fallback
}

// ========================
// CORE API FUNCTIONS
// ========================

// Get all perkara (paginated)
export const getPerkara = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.jenis_perkara) params.append('jenis_perkara', filters.jenis_perkara);
    if (filters.tahun_masuk) params.append('tahun_masuk', filters.tahun_masuk);
    if (filters.bulan_masuk) params.append('bulan_masuk', filters.bulan_masuk);
    params.append('page', filters.page || 1);
    params.append('limit', filters.limit || 100);

    const response = await fetchWithRetry(`${API_BASE}/perkara?${params}`);
    const result = await response.json();
    return result.data || result;
};

// Get perkara by ID
export const getPerkaraById = async (id) => {
    const response = await fetchWithRetry(`${API_BASE}/perkara/${id}`);
    return response.json();
};

// Create new perkara
export const createPerkara = async (perkara) => {
    const response = await fetchWithRetry(`${API_BASE}/perkara`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perkara)
    });
    return response.json();
};

// Update perkara
export const updatePerkara = async (id, perkara) => {
    const response = await fetchWithRetry(`${API_BASE}/perkara/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perkara)
    });
    return response.json();
};

// Delete perkara
export const deletePerkara = async (id) => {
    const response = await fetchWithRetry(`${API_BASE}/perkara/${id}`, {
        method: 'DELETE'
    });
    return true;
};

// ========================
// DATE RANGE QUERIES
// ========================

// Get perkara by date range (untuk laporan mingguan)
export const getPerkaraByDateRange = async (startDate, endDate, filters = {}) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    if (filters.jenis_perkara) params.append('jenis_perkara', filters.jenis_perkara);

    const response = await fetchWithRetry(`${API_BASE}/perkara/range?${params}`);
    return response.json();
};

// Get perkara by month (untuk laporan bulanan)
export const getPerkaraByMonth = async (month, year, filters = {}) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    return getPerkaraByDateRange(startDate, endDate, filters);
};

// ========================
// SIPP SYNC API
// ========================

// Get SIPP sync status
export const getSippStatus = async () => {
    try {
        const response = await fetchWithRetry(`${API_BASE}/perkara/sipp/status`);
        return response.json();
    } catch (error) {
        console.error('Failed to fetch SIPP status:', error);
        return { total: 0, sipp_synced: 0, last_sync: null };
    }
};

// Trigger manual SIPP sync
export const syncSippData = async () => {
    const response = await fetchWithRetry(`${API_BASE}/perkara/sipp/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
};

// Get jadwal sidang for a perkara
export const getJadwalSidang = async (nomorPerkara) => {
    const encoded = encodeURIComponent(nomorPerkara);
    const response = await fetchWithRetry(`${API_BASE}/perkara/sipp/jadwal/${encoded}`);
    return response.json();
};

// Get putusan for a perkara
export const getPutusanPerkara = async (nomorPerkara) => {
    const encoded = encodeURIComponent(nomorPerkara);
    const response = await fetchWithRetry(`${API_BASE}/perkara/sipp/putusan/${encoded}`);
    return response.json();
};

// Subscribe to sync progress via SSE
export const subscribeSyncProgress = (onProgress) => {
    const eventSource = new EventSource(`${API_BASE}/perkara/sipp/progress`);

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onProgress(data);
    };

    eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
    };

    return eventSource;
};

// Get trend data for last N weeks
export const getPerkaraTrend = async (weeks = 8) => {
    try {
        const response = await fetchWithRetry(`${API_BASE}/perkara/trend?weeks=${weeks}`);
        return response.json();
    } catch (error) {
        console.error('Failed to fetch trend:', error);
        return [];
    }
};

// Get monthly trend data for a specific year
export const getPerkaraTrendMonthly = async (year = new Date().getFullYear()) => {
    try {
        const response = await fetchWithRetry(`${API_BASE}/perkara/trend/monthly?year=${year}`);
        return response.json();
    } catch (error) {
        console.error('Failed to fetch monthly trend:', error);
        return [];
    }
};

// Get yearly trend data (all years)
export const getPerkaraTrendYearly = async () => {
    try {
        const response = await fetchWithRetry(`${API_BASE}/perkara/trend/yearly`);
        return response.json();
    } catch (error) {
        console.error('Failed to fetch yearly trend:', error);
        return [];
    }
};

// ========================
// REPORTS DATA FETCH
// ========================

// Get perkara for monthly report (registered OR having sidang in the month)
export const getPerkaraLaporanBulanan = async (jenis, bulan, tahun, end = '') => {
    const params = new URLSearchParams({ bulan, tahun });
    if (end) params.set('end', end);
    const response = await fetchWithRetry(`${API_BASE}/laporan/bulanan/${jenis}/data?${params}`);
    const result = await response.json();
    return result.data || result;
};

// Get perkara for weekly report (registered OR having sidang in the date range)
export const getPerkaraLaporanMingguan = async (jenis, start, end) => {
    const params = new URLSearchParams({ start, end });
    const response = await fetchWithRetry(`${API_BASE}/laporan/mingguan/${jenis}/data?${params}`);
    const result = await response.json();
    return result.data || result;
};

// ========================
// REPORTS EXPORT
// ========================

// Download Laporan Bulanan as .docx or .pdf (generated from official template)
export const downloadLaporanBulanan = async (jenis, bulan, tahun, format = 'docx', onProgress, end = '') => {
    const params = new URLSearchParams({ bulan, tahun, format });
    if (end) params.set('end', end);

    if (onProgress) onProgress({ step: 10, message: 'Mengambil data laporan…' });

    const response = await fetchWithRetry(`${API_BASE}/laporan/bulanan/${jenis}?${params}`);

    if (onProgress) onProgress({ step: 50, message: 'Membuat dokumen…' });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Gagal membuat laporan' }));
        throw new Error(err.error || 'Gagal membuat laporan');
    }

    if (onProgress) onProgress({ step: 90, message: 'Menyelesaikan file…' });

    const fallback = `${bulan}. AKURASI ${String(jenis).toUpperCase()} ${new Date(tahun, bulan - 1, 1).toLocaleDateString('id-ID', { month: 'long' }).toUpperCase()} ${tahun}.${format === 'pdf' ? 'pdf' : 'docx'}`;
    const filename = getFilenameFromContentDisposition(response.headers.get('Content-Disposition'), fallback);
    const blob = await response.blob();
    return { blob, filename };
};

// Download Laporan Mingguan as .docx or .pdf
export const downloadLaporanMingguan = async (jenis, start, end, format = 'docx', onProgress) => {
    const params = new URLSearchParams({ start, end, format });

    if (onProgress) onProgress({ step: 10, message: 'Mengambil data laporan…' });

    const response = await fetchWithRetry(`${API_BASE}/laporan/mingguan/${jenis}?${params}`);

    if (onProgress) onProgress({ step: 50, message: 'Membuat dokumen…' });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Gagal membuat laporan' }));
        throw new Error(err.error || 'Gagal membuat laporan');
    }

    if (onProgress) onProgress({ step: 90, message: 'Menyelesaikan file…' });

    const fallback = `AKURASI_${jenis}_${start}_sd_${end}.${format === 'pdf' ? 'pdf' : 'docx'}`;
    const filename = getFilenameFromContentDisposition(response.headers.get('Content-Disposition'), fallback);
    const blob = await response.blob();
    return { blob, filename };
}

export const getLaporanHistory = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.tipe) params.append('tipe', filters.tipe);
    if (filters.jenis) params.append('jenis', filters.jenis);
    const response = await fetchWithRetry(`${API_BASE}/laporan/history?${params}`);
    const result = await response.json();
    return result.data || result;
}

export const deleteLaporanHistory = async (id) => {
    await fetchWithRetry(`${API_BASE}/laporan/history/${id}`, {
        method: 'DELETE'
    });
    return true;
}

export const downloadKasirTemplate = async (type) => {
    const response = await fetchWithRetry(`${API_BASE}/kasir/templates/${type}`);
    return response.blob();
}

export const generatePenutupanKasRtf = async (payload) => {
    const response = await fetchWithRetry(`${API_BASE}/kasir/generate/penutupan-kas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return response.blob();
}

export const generatePenutupanRekapXlsx = async (payload) => {
    const response = await fetchWithRetry(`${API_BASE}/kasir/generate/penutupan-rekap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return response.blob();
}

// Force refresh jadwal sidang (bypass cache, re-scrape SIPP)
export const refreshJadwal = async (nomorPerkara) => {
    const encoded = encodeURIComponent(nomorPerkara);
    const response = await fetchWithRetry(`${API_BASE}/perkara/sipp/jadwal/${encoded}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
};

// Force refresh putusan (bypass cache, re-scrape SIPP)
export const refreshPutusan = async (nomorPerkara) => {
    const encoded = encodeURIComponent(nomorPerkara);
    const response = await fetchWithRetry(`${API_BASE}/perkara/sipp/putusan/${encoded}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
};

// ========================
// HEALTH CHECK
// ========================

// Check if backend is alive
export const healthCheck = async () => {
    try {
        const response = await fetch(`${API_BASE}/health`);
        return response.ok;
    } catch {
        return false;
    }
};

// Get API version/info
export const getApiInfo = async () => {
    try {
        const response = await fetch(API_BASE);
        return response.json();
    } catch {
        return null;
    }
};
