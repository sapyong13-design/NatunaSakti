# SIPP Sync - Dokumentasi Fitur

## Overview

Fitur SIPP Sync mengambil data perkara secara otomatis dari website SIPP Pengadilan Negeri Natuna (https://sipp.pn-natuna.go.id/) dan menyimpannya ke database lokal.

## Fitur

### 1. Auto-Sync (Cron Job)
- **Jadwal**: Setiap jam (menit 0)
- **Otomatis**: Berjalan di background tanpa perlu intervensi
- **Logging**: Setiap sync dicatat ke console

### 2. Manual Sync
- **Endpoint**: `POST /api/perkara/sipp/sync`
- **Frontend**: Tombol "Sync SIPP" di halaman Data
- **Feedback**: Progress indicator dan notifikasi

### 3. Status Sync
- **Endpoint**: `GET /api/perkara/sipp/status`
- **Info**:
  - `total`: Jumlah seluruh perkara
  - `sipp_synced`: Jumlah perkara dari SIPP
  - `last_sync`: Timestamp sync terakhir

## Kolom Database

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `sipp_synced` | INTEGER | 1 = dari SIPP, 0/NULL = manual |
| `sipp_status` | TEXT | Status perkara di SIPP |
| `sipp_lama_proses` | TEXT | Lama proses perkara |
| `sipp_tanggal_register` | TEXT | Tanggal register di SIPP |
| `sipp_klasifikasi` | TEXT | Klasifikasi perkara |
| `sipp_last_sync` | TEXT | Timestamp sync terakhir |

## Deteksi Jenis Perkara

Sistem otomatis mendeteksi jenis perkara dari nomor perkara:

| Prefix | Jenis |
|--------|-------|
| `/Pdt` | Perdata |
| `/Pid` | Pidana |
| Lainnya | Lainnya |

Contoh:
- `4/Pdt.P/2026/PN Ntn` → Perdata
- `22/Pid.B/2026/PN Ntn` → Pidana

## File Terkait

- **Backend**:
  - `backend/services/sippSyncService.js` - Service untuk fetch dan parse SIPP
  - `backend/routes/sipp.js` - Routes SIPP endpoints
  - `backend/server.js` - Konfigurasi cron job

- **Frontend**:
  - `frontend/src/lib/api.js` - API functions untuk SIPP
  - `frontend/src/views/DataView.vue` - UI dengan tombol sync

## Troubleshooting

### Sync gagal
1. Cek koneksi internet ke https://sipp.pn-natuna.go.id/
2. Cek console log backend untuk error detail
3. Pastikan website SIPP dapat diakses

### Data tidak muncul
1. Cek database: `backend/data/akurasi.db`
2. Verify sync status: `/api/perkara/sipp/status`
3. Refresh halaman Data di frontend

## Dependencies

- `axios` - HTTP client untuk fetch SIPP
- `cheerio` - HTML parser
- `node-cron` - Job scheduler
- `better-sqlite3` - Database
