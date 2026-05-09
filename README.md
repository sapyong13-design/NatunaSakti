# NatunaSakti — Sistem Akurasi Kepaniteraan PN Natuna

> **Sistem Informasi Manajemen & Monitoring Akurasi Data Kepaniteraan**
>
> Pengadilan Negeri Natuna Kelas II

Aplikasi web berbasis dashboard untuk manajemen dan monitoring akurasi data kepaniteraan. Terintegrasi langsung dengan **SIPP** (Sistem Informasi Penelusuran Perkara) PN Natuna untuk sinkronisasi data otomatis — **scraping 4557 perkara** dengan cache **jadwal sidang** untuk 1170+ perkara.

## 📋 Gambaran Singkat

NatunaSakti membantu kepaniteraan PN Natuna dalam:
- **Monitoring** perkara aktif secara real-time
- **Generate laporan** resmi (DOCX/PDF) otomatis terisi data
- **Tracking jadwal sidang** per perkara dengan refresh manual
- **Analisis trend** pendaftaran perkara per minggu/bulan/tahun
- **Validasi akurasi** data antara database lokal dan SIPP

---

## ✨ Fitur Lengkap

### Dashboard Utama
| Komponen | Deskripsi |
|----------|-----------|
| **Stats Strip** | 4 kartu statistik: Total Perkara, Pidana, Perdata, Perikanan |
| **Trend Chart** | Grafik garis pendaftaran 8 minggu terakhir per jenis perkara |
| **Recent Table** | Tabel 15 perkara terbaru dengan status & jadwal sidang quick-view |

### Data Perkara
- **Pencarian**: Cari berdasarkan nomor perkara atau nama pihak
- **Filter**: Filter per jenis perkara (Pidana/Perdata/Perikanan) dan tahun masuk
- **Detail Panel**: Slide-out panel dengan informasi lengkap:
  - Informasi perkara (klasifikasi, tanggal register, tahun masuk, tanggal putus)
  - **Jadwal Sidang Timeline** dengan grouping bulanan
  - Progress bar sidang (completed/total)
  - Status badge (Dijadwalkan/Lewat/Selesai/Ditunda)
- **Sync SIPP**: Tombol sync otomatis dari SIPP PN Natuna
- **Refresh Jadwal**: Fetch jadwal sidang terbaru dari SIPP (bypass cache)

### Laporan Bulanan
- Generate **DOCX** dari template resmi Kepaniteraan PN Natuna
- Mendukung **Perdata**, **Perikanan**, dan **Pidana**
- Output bisa DOCX atau PDF (via konversi)
- Isi otomatis:
  - **Baris a (Perkara)**: Nomor perkara yang register di bulan tersebut
  - **Baris b (Berita Acara Sidang)**: Perkara dengan minimal 1 sidang
  - Tanggal, hari, bulan, tahun otomatis
  - Pejabat penanda tangan (sesuai template)

### Laporan Mingguan
- Generate **PDF** laporan mingguan per rentang tanggal
- Dokumen otomatis terisi data perkara dalam periode tersebut

### Sinkronisasi SIPP
- **Otomatis**: Cron job tiap jam untuk sync incremental (200 perkara terbaru)
- **Manual**: Tombol "Sync SIPP" di halaman Data
- **Jadwal Sidang Cache**:
  - Auto-populate 100 perkara terbaru pada startup
  - Refresh manual per perkara via tombol "Refresh Jadwal"
  - Saat ini: **3220 jadwal rows** dari **1170 perkara** tercache

---

## 🛠️ Stack Teknologi

### Frontend
| Teknologi | Versi | Penggunaan |
|-----------|-------|------------|
| **Vue.js** | 3.5 | Composition API, `<script setup>` |
| **Vite** | 6.x | Build tool & dev server |
| **Vue Router** | 4.x | Routing (Dashboard, Bulanan, Mingguan, Data) |
| **CSS** | Native | Scoped CSS dengan CSS variables untuk theming |

### Backend
| Teknologi | Versi | Penggunaan |
|-----------|-------|------------|
| **Node.js** | 20+ | Runtime environment |
| **Express** | 4.x | REST API server |
| **SQLite** | 3.x | Local database via `better-sqlite3` |
| **Puppeteer** | 23.x | Headless browser untuk SIPP scraping |

### Libraries
- **PizZip**: Manipulasi DOCX template (XML-based)
- **jsPDF + autoTable**: PDF generation untuk laporan mingguan
- **Cheerio**: HTML parsing (fallback untuk SIPP)

---

## 📁 Struktur Proyek

```
natunasakti/
├── backend/                          # Express API Server
│   ├── server.js                     # Main server, all routes, cron jobs
│   ├── package.json                  # Backend dependencies
│   ├── services/
│   │   ├── laporanService.js         # DOCX/PDF generation logic
│   │   └── sippSyncService.js        # SIPP scraping & sync service
│   ├── routes/
│   │   └── sipp.js                   # SIPP-specific routes
│   ├── templates/
│   │   ├── bulanan-pidana.docx       # Template Kepaniteraan Pidana
│   │   ├── bulanan-perdata.docx      # Template Kepaniteraan Perdata
│   │   └── bulanan-perikanan.docx    # Template Kepaniteraan Perikanan
│   ├── scripts/
│   │   ├── populate-jadwal.js        # Script cache jadwal (100 perkara)
│   │   └── ...                       # Utility scripts
│   └── data/
│       ├── akurasi.db                # Live database (2.56 MB, with jadwal cache)
│       └── akurasi-seed.db           # Seed database (GitHub, for fresh install)
│
├── frontend/                         # Vue.js Frontend
│   ├── src/
│   │   ├── views/                    # Halaman utama
│   │   │   ├── Dashboard.vue         # Dashboard utama
│   │   │   ├── DataView.vue          # Halaman Data Perkara
│   │   │   ├── ReportBulanan.vue     # Generate laporan bulanan
│   │   │   └── ReportMingguan.vue    # Generate laporan mingguan
│   │   ├── components/
│   │   │   ├── dashboard/            # Dashboard components
│   │   │   │   ├── DetailPanel.vue   # Slide-out detail panel dengan jadwal sidang
│   │   │   │   ├── PerkaraTable.vue  # Tabel perkara dengan row click
│   │   │   │   ├── StatsStrip.vue    # 4 kartu statistik
│   │   │   │   ├── TrendCard.vue    # Grafik trend pendaftaran
│   │   │   │   ├── TrendChart.vue   # Line chart SVG
│   │   │   │   ├── ToolbarFilters.vue # Filter jenis/tahun
│   │   │   │   └── MiniStatCard.vue # Kartu stat mini
│   │   │   ├── report/
│   │   │   │   ├── ReportTable.vue   # Tabel perkara untuk laporan
│   │   │   │   └── StatusBadge.vue   # Status badge component
│   │   │   └── shell/
│   │   │       ├── Sidebar.vue       # Navigation sidebar
│   │   │       └── TopBar.vue       # Top bar dengan breadcrumbs
│   │   ├── lib/
│   │   │   ├── api.js               # API client (fetch, retry logic)
│   │   │   ├── date.js              # Indonesian date utilities
│   │   │   ├── export.js            # PDF export (jsPDF)
│   │   │   └── pihak.js             # Parse para pihak
│   │   ├── router/                  # Vue Router configuration
│   │   ├── assets/styles/
│   │   │   └── design-tokens.css   # Global CSS variables & theming
│   │   ├── App.vue                  # Root component
│   │   └── main.js                  # Entry point
│   ├── package.json                 # Frontend dependencies
│   └── index.html                   # HTML template
│
└── README.md                         # This file
```

---

## 🚀 Cara Menjalankan

### Prasyarat
- **Node.js** 20+ 
- **npm** atau **yarn**

### 1. Clone Repository

```bash
git clone <repository-url>
cd natunasakti
```

### 2. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Jalankan Backend

```bash
cd backend
node server.js
```

Server berjalan di `http://localhost:3000`

### 4. Jalankan Frontend

```bash
cd frontend
npm run dev
```

Frontend berjalan di `http://localhost:5173`

### 5. Buka Browser

Navigate ke `http://localhost:5173`

---

## 🗄️ Database

### Schema

**Tabel `perkara`**
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| id | INTEGER | Primary key (auto-increment) |
| nomor_perkara | TEXT | Nomor perkara (UNIQUE) |
| jenis_perkara | TEXT | Pidana / Perdata / Perikanan |
| nama_perkara | TEXT | Klasifikasi perkara |
| para_pihak | TEXT | Nama para pihak |
| tahun_masuk | INTEGER | Tahun perkara masuk |
| tanggal_putus | TEXT | Tanggal minutasi |
| sipp_* | * | Data dari SIPP (status, tanggal register, dll) |

**Tabel `jadwal_sidang`**
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| id | INTEGER | Primary key |
| nomor_perkara | TEXT | Nomor perkara |
| nomor | INTEGER | Nomor urut sidang |
| tanggal | TEXT | Tanggal sidang (Indonesian format) |
| jam | TEXT | Jam sidang |
| agenda | TEXT | Agenda sidang |
| ruangan | TEXT | Ruangan sidang |
| alasan_ditunda | TEXT | Alasan penundaan (jika ada) |

### Backup & Restore

```bash
# Backup
cp backend/data/akurasi.db backup/akurasi-$(date +%Y%m%d).db

# Restore
cp backup/akurasi-20250110.db backend/data/akurasi.db
```

---

## 🔄 SIPP Sync Details

### Scraping Flow

1. **Puppeteer** buka `https://sipp.pn-natuna.go.id/`
2. **Submit search form** dengan nomor perkara
3. **Extract detail URL** dari hasil pencarian
4. **Navigate to detail page**, klik tab "Jadwal Sidang"
5. **Scrape table** dengan semua sidang
6. **Parse & cache** ke database `jadwal_sidang`

### Cache Strategy

| Scenario | Behavior |
|----------|----------|
| **Perkara 2026** | Cek cache dulu → kalo ada, pakai cache → kalo kosong, live scrape |
| **Perkara < 2026** | Live scrape langsung (cache miss) |
| **Refresh Jadwal** | Force live scrape, update cache |

### Auto-Sync

- **Frequency**: Tiap jam (cron `0 * * * *`)
- **Scope**: 200 perkara terbaru (incremental)
- **Jadwal Cache**: 100 perkara terbaru tiap jam

---

## 📊 Database Stats

Per **Januari 2026**:

| Metric | Value |
|--------|-------|
| Total Perkara | 4,557 |
| Total Jadwal Ter-cache | 3,220 rows |
| Perkara dengan Jadwal | 1,170 (~26%) |
| Database Size | 2.56 MB |

---

## 🎨 Desain & UI

### Design System
- **Font**: Plus Jakarta Sans (Google Fonts)
- **Colors**: CSS variables untuk light/dark mode
- **Components**: Scoped CSS dengan BEM-ish naming (`ns-*` prefix)

### Responsive
- Desktop-first layout
- Mobile-friendly sidebar

---

## 📝 API Endpoints

### Perkara
- `GET /api/perkara` - List semua perkara (with filter & pagination)
- `GET /api/perkara/:id` - Detail perkara
- `POST /api/perkara` - Tambah perkara baru
- `PUT /api/perkara/:id` - Update perkara
- `DELETE /api/perkara/:id` - Hapus perkara

### SIPP
- `GET /api/perkara/sipp/status` - Cek status sync
- `POST /api/perkara/sipp/sync` - Trigger manual sync
- `GET /api/perkara/sipp/jadwal/:nomor` - Ambil jadwal (cache/live)
- `POST /api/perkara/sipp/jadwal/:nomor/refresh` - Force refresh jadwal

### Laporan
- `GET /api/laporan/bulanan/:jenis` - Generate DOCX laporan bulanan
- `GET /api/laporan/mingguan/:jenis` - Generate PDF laporan mingguan

### Trend
- `GET /api/perkara/trend` - Trend mingguan (N weeks)
- `GET /api/perkara/trend/monthly` - Trend bulanan (per year)
- `GET /api/perkara/trend/yearly` - Trend tahunan (all years)

---

## 🏛️ Tentang PN Natuna

**Pengadilan Negeri Natuna Kelas II**

Alamat: Jl. Raya Ranai-Dansai, Kabupaten Natuna, Kepulauan Riau

Website: [sipp.pn-natuna.go.id](https://sipp.pn-natuna.go.id/)

---

## 📄 Lisensi

© 2026 Pengadilan Negeri Natuna Kelas II

---

## 👥 Kontributor

Dibuat untuk Kepaniteraan PN Natuna
