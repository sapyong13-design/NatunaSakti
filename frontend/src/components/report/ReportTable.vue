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
                    <tr v-if="loading" aria-live="polite">
                        <td colspan="10" class="ns-loading">
                            <span class="ns-spinner"></span>
                            <span>Memuat data laporan…</span>
                        </td>
                    </tr>
                    <tr v-else-if="!rows.length">
                        <td colspan="10" class="ns-empty">
                            <div class="ns-empty-icon">Data</div>
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
                            <span class="ns-nomor" :title="row.nomor_perkara">{{ row.nomor_perkara }}</span>
                        </td>
                        <td class="ns-col-nama">
                            <span class="ns-nama" :title="pihakUtama(row.para_pihak)">{{ pihakUtama(row.para_pihak) }}</span>
                        </td>
                        <td class="ns-col-jenis-detail">
                            <span class="ns-jenis-detail" :title="row.nama_perkara">{{ row.nama_perkara }}</span>
                        </td>
                        <td class="ns-col-tahun">{{ row.tahun_masuk }}</td>
                        <td class="ns-col-register">{{ formatDate(row.sipp_tanggal_register) }}</td>
                        <td class="ns-col-sidang">{{ getSidangDates(row) }}</td>
                        <td class="ns-col-putus">{{ formatDate(row.tanggal_putus) }}</td>
                        <td class="ns-col-ket">
                            <span class="ns-kategori-pill" :class="getKategoriClass(row)" :title="getKategori(row)">
                                {{ getKategori(row) }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="ns-table-footer">
            <span class="ns-table-count">{{ rows.length }} perkara</span>
            <span class="ns-table-hint">Geser tabel untuk melihat kolom tambahan</span>
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
    scrollbar-gutter: stable;
    -webkit-overflow-scrolling: touch;
}

.ns-report-table {
    width: 100%;
    min-width: 980px;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 12.5px;
}

.ns-report-table thead {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky, 40);
}

.ns-report-table th {
    text-align: left;
    padding: 12px 10px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-3);
    background: #f8fafc;
    border-bottom: 1px solid var(--border);
    white-space: normal;
    line-height: 1.25;
    overflow: hidden;
    overflow-wrap: anywhere;
    word-break: break-word;
}

[data-mode="dark"] .ns-report-table th {
    background: #111827;
}

.ns-report-table td {
    padding: 12px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    vertical-align: top;
    min-width: 0;
    overflow: hidden;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.ns-report-table tbody tr:last-child td {
    border-bottom: none;
}

.ns-report-table tbody tr {
    transition: background-color 120ms ease;
}

.ns-report-table tbody tr:hover {
    background: var(--surface-2);
}

/* Kept as a class hook, but full-width report tables do not need frozen columns. */
.ns-sticky-col {
    background: var(--surface);
    transition: background-color 120ms ease;
    box-shadow: 1px 0 0 var(--border), 8px 0 14px -14px rgba(0, 0, 0, 0.35);
}

.ns-report-table thead .ns-sticky-col {
    background: #f8fafc;
}

[data-mode="dark"] .ns-report-table thead .ns-sticky-col {
    background: #111827;
}

.ns-col-no {
    width: 54px;
    text-align: center;
}

.ns-col-jenis {
    width: 96px;
}

.ns-col-nomor {
    width: 190px;
}

.ns-col-nama {
    width: 180px;
}

.ns-col-jenis-detail {
    width: 190px;
}

.ns-col-tahun {
    width: 72px;
    text-align: center;
}

.ns-col-register {
    width: 118px;
}

.ns-col-sidang {
    width: 140px;
    white-space: normal;
    line-height: 1.5;
}

.ns-col-putus {
    width: 118px;
}

.ns-col-ket {
    width: 130px;
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
    max-width: 100%;
    min-width: 0;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    background: var(--jenis-bg);
    color: var(--jenis-color);
    white-space: nowrap;
}

.ns-kategori-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    min-width: 0;
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 11.5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
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
    display: block;
    font-family: "JetBrains Mono", monospace;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text);
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow-wrap: anywhere;
}

.ns-nama {
    display: -webkit-box;
    font-weight: 500;
    line-height: 1.4;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
}

.ns-jenis-detail {
    display: -webkit-box;
    font-size: 12.5px;
    color: var(--text-2);
    line-height: 1.4;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.ns-col-tahun,
.ns-col-register,
.ns-col-sidang,
.ns-col-putus,
.ns-col-ket {
    font-family: "JetBrains Mono", monospace;
    font-size: 11.5px;
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
    font-size: 12px;
    margin-bottom: 8px;
    opacity: 0.5;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.ns-empty::after {
    content: "Ubah periode atau pastikan data SIPP sudah tersinkron.";
    display: block;
    margin-top: 6px;
    color: var(--text-3);
    font-size: 12px;
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

@media (max-width: 1280px) {
    .ns-report-table th,
    .ns-report-table td {
        padding: 10px 8px;
    }

    .ns-report-table {
        font-size: 11.5px;
    }

    .ns-nomor,
    .ns-col-tahun,
    .ns-col-register,
    .ns-col-sidang,
    .ns-col-putus,
    .ns-col-ket,
    .ns-jenis-detail {
        font-size: 11px;
    }

    .ns-jenis-pill,
    .ns-kategori-pill {
        font-size: 10.5px;
        padding: 3px 6px;
    }
}

@media (max-width: 900px) {
    .ns-report-table th,
    .ns-report-table td {
        padding: 8px 6px;
    }

    .ns-report-table {
        font-size: 11px;
    }

    .ns-report-table th {
        font-size: 10px;
    }

    .ns-table-footer {
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
    }
}

@media (max-width: 480px) {
    .ns-report-table th,
    .ns-report-table td {
        padding: 6px 3px;
    }

    .ns-report-table {
        min-width: 760px;
        font-size: 10.5px;
    }

    .ns-col-jenis-detail,
    .ns-col-putus {
        display: none;
    }

    .ns-report-table th {
        font-size: 10px;
        letter-spacing: 0;
    }

    .ns-nomor,
    .ns-col-tahun,
    .ns-col-register,
    .ns-col-sidang,
    .ns-col-putus,
    .ns-col-ket,
    .ns-jenis-detail {
        font-size: 10px;
    }

    .ns-jenis-pill,
    .ns-kategori-pill {
        font-size: 10px;
        padding: 3px 5px;
    }
}
</style>
