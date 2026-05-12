<script setup>
import { pihakUtama } from '../../lib/pihak'
import { formatDateIndo } from '../../lib/date'

defineProps({
    rows: { type: Array, required: true },
    loading: { type: Boolean, default: false }
})

function formatDate(s) {
    return formatDateIndo(s)
}

function getJenisColor(jenis) {
    const colors = {
        'Pidana': '#ef4444',
        'Perdata': '#10b981',
        'Perikanan': '#3b82f6',
        'Hukum': '#f59e0b'
    }
    return colors[jenis] || '#9ca3af'
}

function getJenisBg(jenis) {
    const colors = {
        'Pidana': 'rgba(239, 68, 68, 0.12)',
        'Perdata': 'rgba(16, 185, 129, 0.12)',
        'Perikanan': 'rgba(59, 130, 246, 0.12)',
        'Hukum': 'rgba(245, 158, 11, 0.12)'
    }
    return colors[jenis] || 'rgba(156, 163, 175, 0.12)'
}

function getKategori(row) {
    return row.laporan_kategori || row.keterangan || '-'
}

function getKategoriClass(row) {
    const kategori = getKategori(row).toLowerCase()
    if (kategori.includes('terdaftar') && kategori.includes('sidang')) return 'is-both'
    if (kategori.includes('terdaftar')) return 'is-registered'
    if (kategori.includes('sidang')) return 'is-hearing'
    return ''
}

function getSidangDates(row) {
    if (Array.isArray(row.laporan_tanggal_sidang) && row.laporan_tanggal_sidang.length) {
        return row.laporan_tanggal_sidang.join(', ')
    }
    return '-'
}
</script>

<template>
    <div class="ns-report-table-wrap">
        <div class="ns-report-table-scroll">
            <table class="ns-report-table">
                <thead>
                    <tr>
                        <th class="ns-sticky-col ns-col-no">No</th>
                        <th class="ns-sticky-col ns-col-jenis">Jenis</th>
                        <th class="ns-sticky-col ns-col-nomor">Nomor Perkara</th>
                        <th class="ns-col-nama">Nama</th>
                        <th class="ns-col-jenis-detail">Jenis Perkara</th>
                        <th class="ns-col-tahun">Tahun</th>
                        <th class="ns-col-register">Tgl Register</th>
                        <th class="ns-col-sidang">Tgl Sidang</th>
                        <th class="ns-col-putus">Tgl Minutasi</th>
                        <th class="ns-col-ket">Kategori</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="10" class="ns-loading">
                            <span class="ns-spinner"></span>
                            <span>Memuat data...</span>
                        </td>
                    </tr>
                    <tr v-else-if="!rows.length">
                        <td colspan="10" class="ns-empty">
                            <div class="ns-empty-icon">📋</div>
                            <div>Tidak ada perkara di periode ini</div>
                        </td>
                    </tr>
                    <tr v-else v-for="(row, idx) in rows" :key="row.id" class="ns-row">
                        <td class="ns-sticky-col ns-col-no">{{ idx + 1 }}</td>
                        <td class="ns-sticky-col ns-col-jenis">
                            <span
                                class="ns-jenis-pill"
                                :style="{
                                    '--jenis-color': getJenisColor(row.jenis_perkara),
                                    '--jenis-bg': getJenisBg(row.jenis_perkara)
                                }"
                            >
                                {{ row.jenis_perkara }}
                            </span>
                        </td>
                        <td class="ns-sticky-col ns-col-nomor">
                            <span class="ns-nomor">{{ row.nomor_perkara }}</span>
                        </td>
                        <td class="ns-col-nama">
                            <span class="ns-nama">{{ pihakUtama(row.para_pihak) }}</span>
                        </td>
                        <td class="ns-col-jenis-detail">
                            <span class="ns-jenis-detail">{{ row.nama_perkara }}</span>
                        </td>
                        <td class="ns-col-tahun">{{ row.tahun_masuk }}</td>
                        <td class="ns-col-register">{{ formatDate(row.sipp_tanggal_register) }}</td>
                        <td class="ns-col-sidang">{{ getSidangDates(row) }}</td>
                        <td class="ns-col-putus">{{ formatDate(row.tanggal_putus) }}</td>
                        <td class="ns-col-ket">
                            <span class="ns-kategori-pill" :class="getKategoriClass(row)">
                                {{ getKategori(row) }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="ns-table-footer">
            <span class="ns-table-count">{{ rows.length }} perkara</span>
            <span class="ns-table-hint">→ Scroll horizontal untuk lihat semua kolom</span>
        </div>
    </div>
</template>

<style scoped>
.ns-report-table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
}

.ns-report-table-scroll {
    overflow-x: auto;
    max-width: 100%;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
}

.ns-report-table-scroll::-webkit-scrollbar {
    height: 8px;
}

.ns-report-table-scroll::-webkit-scrollbar-track {
    background: transparent;
}

.ns-report-table-scroll::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
}

.ns-report-table-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--text-3);
}

.ns-report-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    min-width: 1200px;
}

.ns-report-table thead {
    position: sticky;
    top: 0;
    z-index: 10;
}

.ns-report-table th {
    text-align: left;
    padding: 14px 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
    background: var(--bg-2);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
}

.ns-report-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    vertical-align: middle;
}

.ns-report-table tbody tr:last-child td {
    border-bottom: none;
}

.ns-report-table tbody tr {
    transition: background 120ms ease;
}

.ns-report-table tbody tr:hover {
    background: var(--surface-2);
}

.ns-report-table tbody tr:hover .ns-sticky-col {
    background: var(--surface-2);
}

/* Sticky columns */
.ns-sticky-col {
    position: sticky;
    left: 0;
    background: var(--surface);
    z-index: 1;
    transition: background 120ms ease;
}

.ns-report-table thead .ns-sticky-col {
    z-index: 11;
    background: var(--bg-2);
}

.ns-col-no {
    left: 0;
    width: 50px;
    text-align: center;
}

.ns-col-jenis {
    left: 50px;
    width: 100px;
}

.ns-col-nomor {
    left: 150px;
    width: 180px;
}

.ns-col-nama {
    min-width: 160px;
    max-width: 220px;
}

.ns-col-jenis-detail {
    min-width: 160px;
    max-width: 240px;
}

.ns-col-tahun {
    width: 80px;
    text-align: center;
}

.ns-col-register {
    width: 110px;
    white-space: nowrap;
}

.ns-col-sidang {
    min-width: 180px;
    max-width: 260px;
    white-space: normal;
    line-height: 1.5;
}

.ns-col-putus {
    width: 110px;
    white-space: nowrap;
}

.ns-col-ket {
    width: 150px;
    text-align: center;
}

/* Typography & content */
.ns-col-no {
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
}

.ns-jenis-pill {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    background: var(--jenis-bg);
    color: var(--jenis-color);
}

.ns-kategori-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 84px;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
}

.ns-kategori-pill.is-registered {
    background: rgba(16, 185, 129, 0.12);
    color: #059669;
}

.ns-kategori-pill.is-hearing {
    background: rgba(59, 130, 246, 0.12);
    color: #2563eb;
}

.ns-kategori-pill.is-both {
    background: rgba(245, 158, 11, 0.14);
    color: #b45309;
}

.ns-nomor {
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
    letter-spacing: -0.01em;
}

.ns-nama {
    display: block;
    font-weight: 500;
    line-height: 1.4;
}

.ns-jenis-detail {
    display: block;
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.4;
}

.ns-col-tahun,
.ns-col-register,
.ns-col-sidang,
.ns-col-putus,
.ns-col-ket {
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    color: var(--text-2);
}

/* States */
.ns-loading,
.ns-empty {
    text-align: center;
    padding: 48px 24px;
    color: var(--text-3);
}

.ns-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

.ns-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.ns-empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
    opacity: 0.5;
}

/* Footer */
.ns-table-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--surface-2);
    border-top: 1px solid var(--border);
    font-size: 11px;
}

.ns-table-count {
    font-weight: 500;
    color: var(--text);
}

.ns-table-hint {
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: 4px;
}
</style>
