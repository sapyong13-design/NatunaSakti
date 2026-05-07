// ============================================
// SUPABASE CLIENT CONFIGURATION
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase configuration. Please check .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Table name
const TABLE_NAME = 'perkara';

// Get all perkara
export const getPerkara = async (filters = {}) => {
    let query = supabase.from(TABLE_NAME).select('*').order('created_at', { ascending: false });

    if (filters.jenis_perkara) {
        query = query.eq('jenis_perkara', filters.jenis_perkara);
    }

    if (filters.tahun_masuk) {
        query = query.eq('tahun_masuk', filters.tahun_masuk);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
};

// Get perkara by ID
export const getPerkaraById = async (id) => {
    const { data, error } = await supabase.from(TABLE_NAME).select('*').eq('id', id).single();

    if (error) throw error;
    return data;
};

// Create new perkara
export const createPerkara = async (perkara) => {
    const { data, error } = await supabase.from(TABLE_NAME).insert([perkara]).select();

    if (error) throw error;
    return data[0];
};

// Update perkara
export const updatePerkara = async (id, perkara) => {
    const { data, error } = await supabase.from(TABLE_NAME).update(perkara).eq('id', id).select();

    if (error) throw error;
    return data[0];
};

// Delete perkara
export const deletePerkara = async (id) => {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);

    if (error) throw error;
    return true;
};

// Get perkara by date range (untuk laporan mingguan)
export const getPerkaraByDateRange = async (startDate, endDate, filters = {}) => {
    let query = supabase
        .from(TABLE_NAME)
        .select('*')
        .gte('tanggal_putus', startDate)
        .lte('tanggal_putus', endDate)
        .order('tanggal_putus', { ascending: true });

    if (filters.jenis_perkara) {
        query = query.eq('jenis_perkara', filters.jenis_perkara);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
};

// Get perkara by month (untuk laporan bulanan)
export const getPerkaraByMonth = async (month, year, filters = {}) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    return getPerkaraByDateRange(startDate, endDate, filters);
};
