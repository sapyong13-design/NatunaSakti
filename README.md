# Akurasi Kepaniteraan - PN Natuna

Aplikasi manajemen akurasi kepaniteraan untuk Pengadilan Negeri Natuna Kelas IB.

## Fitur

- **Input Perkara** - Tambah data perkara baru
- **Laporan Bulanan** - Generate PDF laporan bulanan sesuai format PN Natuna
- **Laporan Mingguan** - Generate PDF laporan mingguan/per tanggal
- **Data Perkara** - Kelola semua data perkara (cari, filter, hapus)

## Stack Teknologi

- **Frontend**: Vue.js 3 + Vite + Element Plus
- **Backend**: Node.js + Express
- **Database**: SQLite (local file-based)
- **PDF**: jsPDF + autoTable

## Cara Menjalankan

### 1. Install Backend

```bash
cd backend
npm install
npm start
```

Backend akan jalan di `http://localhost:3000`

### 2. Install Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend akan jalan di `http://localhost:5173`

### 3. Buka Browser

Buka `http://localhost:5173` dan aplikasi siap digunakan!

## Struktur Folder

```
akurasi-kepaniteraan/
├── backend/
│   ├── server.js          # Express server + SQLite
│   ├── data/              # Folder database (auto-created)
│   │   └── akurasi.db     # SQLite database file
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── views/         # Vue components (Bulanan, Mingguan, Input, Data)
│   │   ├── lib/           # API client & PDF generator
│   │   ├── router/        # Vue Router config
│   │   └── App.vue        # Main layout
│   └── package.json
│
└── README.md
```

## Database

Data tersimpan di file SQLite: `backend/data/akurasi.db`

**Backup**: Copy file `akurasi.db` untuk backup data.

**Restore**: Replace file `akurasi.db` dengan file backup.

## Migrasi ke Supabase (Opsional)

Kalau mau deploy online:

1. Ganti API calls di `frontend/src/lib/api.js` → Supabase client
2. Atau gunakan `frontend/src/lib/supabase.js` yang sudah disiapkan
3. Setup Supabase project dan jalankan SQL schema

## License

© 2026 Pengadilan Negeri Natuna Kelas IB
