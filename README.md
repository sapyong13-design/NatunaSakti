# NatunaSakti

Sistem informasi manajemen dan monitoring akurasi data kepaniteraan Pengadilan Negeri Natuna Kelas II.

NatunaSakti membantu pengolahan data perkara, sinkronisasi SIPP, pemantauan jadwal sidang, pembuatan laporan bulanan/mingguan, serta pendataan kasir dan dokumen penutupan kas.

## Fitur Utama

### Dashboard

- Ringkasan jumlah perkara berdasarkan jenis perkara.
- Grafik tren pendaftaran perkara.
- Tabel perkara terbaru.
- Navigasi cepat ke data perkara, laporan, dan kasir.

### Data Perkara

- Daftar perkara dengan pencarian dan filter.
- Detail perkara dalam panel samping.
- Informasi pokok perkara, tanggal register, tanggal putus, status, dan para pihak.
- Jadwal sidang per perkara dengan cache lokal.
- Refresh jadwal sidang dari SIPP.
- Sinkronisasi data perkara dari SIPP PN Natuna.

### Laporan Bulanan

Menu laporan bulanan tersedia untuk:

- Pidana
- Perdata
- Perikanan
- Hukum

Logic data bulanan:

- Menampilkan perkara yang didaftarkan pada bulan yang dipilih.
- Menampilkan perkara yang memiliki sidang pada bulan yang dipilih.
- Perkara diberi kategori `Terdaftar`, `Sidang`, atau `Terdaftar & Sidang`.
- Tabel laporan menampilkan nomor perkara, tanggal register, tanggal sidang, status, dan kategori.
- Laporan dapat dibuat dari template DOCX dan/atau dikonversi ke PDF sesuai endpoint yang digunakan.

### Laporan Mingguan

Menu laporan mingguan tersedia untuk:

- Pidana
- Perdata
- Perikanan
- Hukum

Logic data mingguan:

- Berdasarkan rentang tanggal yang dipilih.
- Menampilkan perkara yang didaftarkan dalam periode tersebut.
- Menampilkan perkara yang memiliki sidang dalam periode tersebut.
- Tabel menampilkan tanggal register dan nomor perkara yang sidang.
- Perkara diberi kategori `Terdaftar`, `Sidang`, atau `Terdaftar & Sidang`.

### Kasir

Menu Kasir terdiri dari:

- `Rekap Excel`
- `Pemeriksaan Mendadak`
- `Penutupan Kas`

Fitur kasir:

- Pendataan rekap uang kasir.
- Input transaksi dan saldo per buku.
- Export rekap dalam bentuk Excel.
- Download template pemeriksaan mendadak.
- Generate RTF penutupan kas dari template asli.
- Input nominal penutupan kas dibulatkan ke kelipatan 1000.
- Penutupan kas mengikuti template RTF yang tersimpan di backend, dengan penggantian hari/tanggal dan nominal pada posisi baris yang sesuai.

Template kasir berada di:

```text
backend/templates/kasir/
├── berita-acara-pemeriksaan-mendadak.docx
├── penutupan-kas.rtf
└── penutupan-rekap.xlsx
```

## Stack Teknologi

### Backend

- Node.js
- Express
- SQLite melalui `better-sqlite3`
- Puppeteer untuk scraping SIPP
- PizZip untuk manipulasi template DOCX
- RTF generator untuk penutupan kas

### Frontend

- Vue 3
- Vite
- Vue Router
- jsPDF dan jsPDF AutoTable
- docx
- CSS native dengan komponen Vue scoped

## Struktur Proyek

```text
NatunaSakti/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── data/
│   │   ├── akurasi.db
│   │   └── akurasi-seed.db
│   ├── services/
│   │   ├── laporanService.js
│   │   ├── kasirRtfService.js
│   │   └── sippSyncService.js
│   ├── templates/
│   │   ├── bulanan-perdata.docx
│   │   ├── bulanan-perikanan.docx
│   │   ├── mingguan-perdata.docx
│   │   ├── mingguan-perikanan.docx
│   │   └── kasir/
│   └── scripts/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── data/
│   │   ├── lib/
│   │   ├── router/
│   │   └── views/
│   ├── package.json
│   └── index.html
├── docs/
└── README.md
```

## Cara Menjalankan

### Prasyarat

- Node.js 20+
- npm

### Install dependency

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Jalankan backend

```bash
cd backend
npm run dev
```

Backend berjalan di:

```text
http://localhost:3000
```

### Jalankan frontend

```bash
cd frontend
npm run dev
```

Frontend berjalan di:

```text
http://localhost:5173
```

### Build frontend

```bash
cd frontend
npm run build
```

## API Utama

### Perkara

- `GET /api/perkara`
- `GET /api/perkara/:id`
- `POST /api/perkara`
- `PUT /api/perkara/:id`
- `DELETE /api/perkara/:id`

### SIPP

- `GET /api/perkara/sipp/status`
- `POST /api/perkara/sipp/sync`
- `GET /api/perkara/sipp/jadwal/:nomor`
- `POST /api/perkara/sipp/jadwal/:nomor/refresh`

### Laporan

- `GET /api/laporan/bulanan/:jenis/data`
- `GET /api/laporan/mingguan/:jenis/data`
- `GET /api/laporan/bulanan/:jenis`
- `GET /api/laporan/mingguan/:jenis`

Parameter umum:

- Bulanan: `bulan`, `tahun`, `format`
- Mingguan: `start`, `end`, `format`
- Jenis: `pidana`, `perdata`, `perikanan`, `hukum`

### Kasir

- `GET /api/kasir/templates/:type`
- `POST /api/kasir/generate/penutupan-kas`

Jenis template kasir:

- `pemeriksaan-mendadak`
- `penutupan-kas`
- `penutupan-rekap`

### Trend

- `GET /api/perkara/trend`
- `GET /api/perkara/trend/monthly`
- `GET /api/perkara/trend/yearly`

## Database

Database lokal berada di:

```text
backend/data/akurasi.db
```

Tabel utama:

- `perkara`
- `jadwal_sidang`

`perkara` menyimpan data pokok perkara, termasuk nomor perkara, jenis perkara, tanggal register, tahun masuk, tanggal putus, status, dan data hasil sinkronisasi SIPP.

`jadwal_sidang` menyimpan daftar jadwal sidang per perkara, termasuk tanggal, jam, agenda, ruangan, dan alasan ditunda jika ada.

## Sinkronisasi SIPP

Backend menyediakan sinkronisasi manual dan terjadwal dari SIPP PN Natuna.

Alur umum:

1. Backend mencari perkara di SIPP.
2. Backend membaca detail perkara dan jadwal sidang.
3. Data disimpan atau diperbarui di SQLite.
4. Jadwal sidang dipakai ulang dari cache lokal jika tersedia.

Dokumentasi tambahan tersedia di:

```text
docs/SIPP_SYNC.md
```

## Catatan Pengembangan

- Backend menyimpan banyak route langsung di `backend/server.js`.
- Logic dokumen laporan berada di `backend/services/laporanService.js`.
- Logic generate RTF penutupan kas berada di `backend/services/kasirRtfService.js`.
- Client API frontend berada di `frontend/src/lib/api.js`.
- Sidebar menu berada di `frontend/src/data/sidebarItems.js`.
- Route frontend berada di `frontend/src/router/index.js`.

## Lisensi

Copyright 2026 Pengadilan Negeri Natuna Kelas II.
