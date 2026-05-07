// ============================================
// API CLIENT - Local Backend (SQLite)
// ============================================

const API_BASE = 'http://localhost:3000/api';

// Get all perkara
export const getPerkara = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.jenis_perkara) params.append('jenis_perkara', filters.jenis_perkara);
    if (filters.tahun_masuk) params.append('tahun_masuk', filters.tahun_masuk);

    const response = await fetch(`${API_BASE}/perkara?${params}`);
    if (!response.ok) throw new Error('Failed to fetch data');
    return response.json();
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
