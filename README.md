# NatunaSakti — Sistem Akurasi Kepaniteraan PN Natuna

Aplikasi manajemen dan monitoring akurasi data kepaniteraan untuk Pengadilan Negeri Natuna Kelas IB. Terintegrasi langsung dengan SIPP (Sistem Informasi Penelusuran Perkara) untuk sinkronisasi data otomatis.

## Fitur

| Fitur | Keterangan |
|---|---|
| **Dashboard** | Ringkasan perkara aktif, statistik per jenis, dan trend pendaftaran mingguan |
| **Data Perkara** | Kelola seluruh perkara — cari, filter per jenis/tahun, lihat detail & jadwal sidang |
| **Input Perkara** | Tambah perkara baru ke database lokal |
| **Laporan Bulanan** | Generate dokumen **DOCX** dari template resmi PN Natuna — otomatis terisi data perkara per bulan |
| **Laporan Mingguan** | Generate **PDF** laporan mingguan per rentang tanggal |
| **SIPP Sync** | Sinkronisasi otomatis dari SIPP PN Natuna setiap jam — status, jadwal sidang, dan klasifikasi perkara |
| **Jadwal Sidang** | Cache jadwal sidang per perkara dengan refresh manual |

## Stack Teknologi

- **Frontend**: Vue.js 3 + Vite (Vue Router, Composition API)
- **Backend**: Node.js + Express
- **Database**: SQLite via `better-sqlite3` (local file-based, zero setup)
- **DOCX**: PizZip — manipulasi langsung XML template Word resmi PN Natuna
- **PDF**: jsPDF + autoTable
- **SIPP Scraping**: Puppeteer (headless Chromium)

## Cara Menjalankan

### 1. Backend

```bash
cd backend
npm install
node server.js
```

Backend jalan di `http://localhost:3000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend jalan di `http://localhost:5173`

### 3. Buka Browser

Buka `http://localhost:5173`

## Struktur Folder

```
natunasakti/
├── backend/
│   ├── server.js                  # Express server, semua API route
│   ├── services/
│   │   ├── laporanService.js      # Generate DOCX laporan bulanan
│   │   └── sippSyncService.js     # Scraping & sync data dari SIPP
│   ├── routes/
│   │   └── sipp.js                # Route SIPP (jadwal, refresh)
│   ├── templates/
│   │   ├── bulanan-perdata.docx   # Template resmi Kepaniteraan Perdata
│   │   └── bulanan-perikanan.docx # Template resmi Kepaniteraan Perikanan
│   ├── data/
│   │   └── akurasi.db             # SQLite database (auto-created)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── views/                 # Halaman utama (Dashboard, Bulanan, Mingguan, Data, Input)
│   │   ├── components/            # Komponen UI (shell, report, dashboard)
│   │   ├── lib/
│   │   │   ├── api.js             # API client ke backend
│   │   │   └── export.js          # PDF generator (jsPDF)
│   │   ├── router/                # Vue Router
│   │   └── assets/styles/         # Design tokens & global CSS
│   └── package.json
│
└── README.md
```

## Laporan Bulanan DOCX

Dokumen dihasilkan otomatis dari template Word resmi PN Natuna (`templates/`). Setiap generate akan mengisi:

- **Baris a (Perkara)** — nomor perkara yang **register** di bulan tersebut, diurutkan dari tanggal paling awal
- **Baris b (Berita Acara Sidang)** — perkara yang punya **minimal 1 sidang** di bulan tersebut
- Jika kosong → tampil tanda `–` rata tengah
- Tanggal, hari, bulan, tahun, dan nama pejabat penanda tangan diisi otomatis

## Database

Data tersimpan di `backend/data/akurasi.db`

- **Backup**: copy file `akurasi.db`
- **Restore**: replace file `akurasi.db` dengan file backup

## SIPP Sync

Sinkronisasi berjalan otomatis setiap jam. Untuk sync manual, gunakan tombol **Sync SIPP** di halaman Data Perkara. Data yang disync meliputi:

- Nomor & jenis perkara
- Tanggal register
- Status & klasifikasi
- Jadwal sidang (di-cache per perkara)

---

© 2026 Pengadilan Negeri Natuna Kelas IB
