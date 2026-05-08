// ============================================
// API CLIENT - Local Backend (SQLite)
// ============================================

const API_BASE = 'http://localhost:3000/api';

// Get all perkara (paginated)
export const getPerkara = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.jenis_perkara) params.append('jenis_perkara', filters.jenis_perkara);
    if (filters.tahun_masuk) params.append('tahun_masuk', filters.tahun_masuk);
    params.append('page', filters.page || 1);
    params.append('limit', filters.limit || 100);

    const response = await fetch(`${API_BASE}/perkara?${params}`);
    if (!response.ok) throw new Error('Failed to fetch data');
    const result = await response.json();
    // Return data array from paginated response
    return result.data || result;
};

// Get perkara by ID
export const getPerkaraById = async (id) => {
    const response = await fetch(`${API_BASE}/perkara/${id}`);
    if (!response.ok) throw new Error('Failed to fetch data');
    return response.json();
};

// Create new perkara
export const createPerkara = async (perkara) => {
    const response = await fetch(`${API_BASE}/perkara`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perkara)
    });
    if (!response.ok) throw new Error('Failed to create data');
    return response.json();
};

// Update perkara
export const updatePerkara = async (id, perkara) => {
    const response = await fetch(`${API_BASE}/perkara/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perkara)
    });
    if (!response.ok) throw new Error('Failed to update data');
    return response.json();
};

// Delete perkara
export const deletePerkara = async (id) => {
    const response = await fetch(`${API_BASE}/perkara/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete data');
    return true;
};

// Get perkara by date range (untuk laporan mingguan)
export const getPerkaraByDateRange = async (startDate, endDate, filters = {}) => {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    if (filters.jenis_perkara) params.append('jenis_perkara', filters.jenis_perkara);

    const response = await fetch(`${API_BASE}/perkara/range?${params}`);
    if (!response.ok) throw new Error('Failed to fetch data');
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
    const response = await fetch(`${API_BASE}/perkara/sipp/status`);
    if (!response.ok) throw new Error('Failed to fetch SIPP status');
    return response.json();
};

// Trigger manual SIPP sync
export const syncSippData = async () => {
    const response = await fetch(`${API_BASE}/perkara/sipp/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to sync SIPP data');
    return response.json();
};

// Get jadwal sidang for a perkara
export const getJadwalSidang = async (nomorPerkara) => {
    const encoded = encodeURIComponent(nomorPerkara);
    const response = await fetch(`${API_BASE}/perkara/sipp/jadwal/${encoded}`);
    if (!response.ok) throw new Error('Failed to fetch jadwal sidang');
    return response.json();
};

// Subscribe to sync progress via SSE
export const subscribeSyncProgress = (onProgress) => {
    const eventSource = new EventSource(`${API_BASE}/perkara/sipp/progress`);

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onProgress(data);
    };

    return eventSource;
};

// Get trend data for last N weeks
export const getPerkaraTrend = async (weeks = 8) => {
    const response = await fetch(`${API_BASE}/perkara/trend?weeks=${weeks}`);
    if (!response.ok) throw new Error('Failed to fetch trend');
    return response.json();
};

// Download Laporan Bulanan as .docx or .pdf (generated from official template)
export const downloadLaporanBulanan = async (jenis, bulan, tahun, format = 'docx') => {
    const params = new URLSearchParams({ bulan, tahun, format });
    const response = await fetch(`${API_BASE}/laporan/bulanan/${jenis}?${params}`);
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Gagal membuat laporan' }));
        throw new Error(err.error || 'Gagal membuat laporan');
    }
    return response.blob();
};

// Force refresh jadwal sidang (bypass cache, re-scrape SIPP)
export const refreshJadwal = async (nomorPerkara) => {
    const encoded = encodeURIComponent(nomorPerkara);
    const response = await fetch(`${API_BASE}/perkara/sipp/jadwal/${encoded}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to refresh jadwal');
    return response.json();
};
