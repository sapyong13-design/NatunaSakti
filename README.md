# NatunaSakti

NatunaSakti adalah aplikasi kerja internal untuk membantu Pengadilan Negeri Natuna memantau data perkara, jadwal sidang, putusan, laporan akurasi SIPP, dan administrasi kasir.

Aplikasi ini dibuat agar pekerjaan yang sebelumnya perlu dicek satu per satu dapat dikumpulkan dalam satu tempat. Pengguna dapat melihat data perkara, memperbarui data dari SIPP, membuka detail jadwal sidang dan putusan, lalu membuat laporan bulanan atau mingguan dari template yang sudah disiapkan.

## Untuk Apa Aplikasi Ini?

NatunaSakti membantu petugas kepaniteraan dan administrasi untuk:

- melihat daftar perkara yang tersimpan;
- menyinkronkan data perkara dari SIPP PN Natuna;
- memantau jadwal sidang setiap perkara;
- melihat ringkasan putusan, seperti tanggal putusan, status putusan, denda, lama penjara, dan apakah data pihak disamarkan;
- membuat laporan akurasi SIPP bulanan dan mingguan;
- menyimpan riwayat laporan yang pernah dibuat;
- mengelola rekap kasir dan dokumen penutupan kas.

## Fitur Utama

### Dashboard Perkara

Dashboard menampilkan ringkasan perkara dalam bentuk yang mudah dipantau. Pengguna dapat mencari perkara, memfilter berdasarkan jenis atau status, melihat statistik, dan membuka detail perkara tanpa berpindah halaman.

Pada detail perkara tersedia:

- informasi pokok perkara;
- jadwal sidang;
- status sidang;
- tab putusan;
- tombol refresh jadwal dan putusan dari SIPP.

### Sinkronisasi SIPP

Aplikasi dapat mengambil data perkara dari SIPP PN Natuna. Saat sinkronisasi berjalan, aplikasi juga memperbarui data pendukung seperti jadwal sidang dan putusan untuk perkara terbaru.

Data yang sudah berhasil diambil akan disimpan di database lokal agar lebih cepat dibuka kembali.

### Laporan Bulanan

Laporan bulanan dibuat berdasarkan bulan dan tahun yang dipilih. Pengguna juga dapat menentukan tanggal akhir laporan, misalnya jika akhir bulan jatuh pada hari libur atau cuti bersama.

Jenis laporan yang tersedia:

- Pidana
- Perdata
- Perikanan
- Hukum

Untuk laporan Pidana, bagian laporan diisi dengan aturan berikut:

- bagian A: perkara pidana yang masuk pada periode laporan;
- bagian B: perkara tilang;
- bagian C: perkara yang putusannya memuat denda;
- bagian D: perkara minutasi yang datanya disamarkan;
- bagian E: perkara pidana yang memiliki sidang pada periode laporan.

Jika suatu bagian tidak memiliki data, aplikasi tetap mengisi tanda `-` agar format laporan tetap rapi.

### Laporan Mingguan

Laporan mingguan dibuat berdasarkan rentang tanggal yang dipilih. Aturan pengisian laporan mengikuti kebutuhan laporan mingguan, termasuk pengisian bagian Pidana seperti pada laporan bulanan.

Laporan dapat dibuat dalam format:

- DOCX
- PDF

### Riwayat Laporan

Setiap laporan yang dibuat dapat disimpan dalam riwayat. Fitur ini memudahkan pengguna melihat laporan yang pernah dibuat sebelumnya tanpa harus mengingat tanggal atau periode secara manual.

### Kasir

Menu Kasir membantu pengelolaan data kasir dan dokumen pendukung, antara lain:

- rekap kasir;
- pemeriksaan mendadak;
- penutupan kas;
- export rekap;
- pembuatan dokumen dari template yang tersedia.

## Alur Penggunaan Singkat

1. Buka aplikasi NatunaSakti.
2. Masuk ke menu Data Perkara.
3. Klik sinkronisasi SIPP jika ingin memperbarui data.
4. Buka detail perkara untuk melihat jadwal sidang dan putusan.
5. Masuk ke menu Laporan Bulanan atau Laporan Mingguan.
6. Pilih jenis perkara dan periode laporan.
7. Generate laporan dalam format DOCX atau PDF.
8. Cek riwayat laporan jika ingin melihat hasil yang pernah dibuat.

## Cara Menjalankan Aplikasi

### Menjalankan Backend

```bash
cd backend
npm install
npm run dev
```

Backend berjalan di:

```text
http://localhost:3000
```

### Menjalankan Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di:

```text
http://localhost:5173
```

## Data yang Disimpan

Aplikasi menyimpan data secara lokal di:

```text
backend/data/akurasi.db
```

Data yang disimpan meliputi:

- data perkara;
- jadwal sidang;
- data putusan;
- riwayat laporan;
- data pendukung kasir.

## Catatan Teknis Singkat

Bagian backend menangani pengambilan data dari SIPP, penyimpanan database, pembuatan laporan, dan dokumen kasir.

Bagian frontend adalah tampilan aplikasi yang digunakan oleh pengguna sehari-hari.

Teknologi utama yang digunakan:

- Node.js dan Express untuk backend;
- SQLite untuk database lokal;
- Vue untuk tampilan aplikasi;
- template DOCX/RTF/XLSX untuk pembuatan dokumen.

## Lisensi

Copyright 2026 Pengadilan Negeri Natuna Kelas II.
