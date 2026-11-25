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

Register perkara memakai delapan kolom terpisah: nomor urut, nomor/jenis perkara, nama pihak, klasifikasi, tanggal register singkat, status, hari proses, dan checklist anonimisasi. Baris utama tetap ringkas; tombol **Semua pihak** membuka rincian nama lengkap per peran dalam baris lebar di bawahnya, tanpa mengganti nama atau membuka panel detail. Klik nomor untuk detail perkara. Header tetap terlihat saat tabel digulir; layar kecil mengubah setiap baris menjadi susunan berlabel tanpa gulir horizontal. Mode rapat/lega tetap tersedia.

Pada detail perkara tersedia:

- informasi pokok perkara;
- jadwal sidang;
- status sidang;
- tab putusan;
- tombol refresh jadwal dan putusan dari SIPP.

### Sinkronisasi SIPP

Aplikasi membaca seluruh data perkara, jadwal sidang, dan putusan dari database SIPP lokal melalui SSH tunnel dengan akun khusus read-only. Nama pihak ditampilkan sesuai sumber DB; checklist Anonimisasi mengikuti flag publikasi terpisah, tanpa mengganti nama. Sinkron tidak menulis ke database SIPP dan tidak memakai scraping publik.

Hasil sinkron disimpan atomik di database lokal. Jika sumber tidak terjangkau, cache sebelumnya dipertahankan. Persyaratan akses dan batas keamanan tersedia di [docs/SIPP_SYNC.md](docs/SIPP_SYNC.md).

### Monitoring EIS

Menu **Monitoring EIS** menampilkan penilaian resmi [EIS Badilum PN v3](https://evaluasi.badilum.mahkamahagung.go.id/evaluasi3) untuk PN Natuna, PT Kepulauan Riau, seluruh kategori dan kelas. Satu periode selalu satu bulan, default bulan berjalan (WIB). Backend mengambil data resmi sekali per hari saat berjalan; tombol **Muat Ulang** juga bisa mengambil periode lampau. Jika pengambilan gagal, snapshot terakhir periode yang sama tetap tersedia.

Di tab **Kinerja**, **Kepatuhan**, **Kelengkapan**, dan **Kesesuaian**, klik angka **Tidak** untuk melihat pemeriksaan cache SIPP lokal dan membuka detail perkara. Tab **Konversi** menampilkan nilai resmi. Temuan lokal bukan daftar perkara resmi EIS; indikator tanpa data pendukung yang cukup ditandai belum dapat diperiksa, bukan nol. Modul EIS hanya membaca situs resmi untuk angka agregat dan tidak mengirim data perkara lokal ke situs tersebut. Sinkronisasi database SIPP melalui SSH tetap terpisah.

Untuk **Pencatatan Saksi** dan **Dokumen Elektronik Berita Acara Sidang (BAS)**, rincian membaca langsung SIPP lokal lewat SSH. Daftar saksi memakai tanggal input awal dan memisahkan kelengkapan kolom inti dari catatan tanya-jawab; bila `Jumlah` sama dengan EIS dan seluruh perkara sudah bersaksi di lokal sementara `Sesuai` EIS lebih rendah, drawer memberi keterangan bahwa data menunggu sinkronisasi ke web EIS. Daftar BAS memakai tanggal sidang, menampilkan nama berkas, status format (`PDF` vs non-PDF), isian terstruktur, dan rujukan unggahan secara terpisah, serta menandai jadwal hari ini dan mendatang. Rujukan unggahan tidak membuktikan keberadaan fisik berkas atau penerimaan oleh MIS. Jika koneksi gagal, daftar jadwal cache tetap ditampilkan sebagai pembanding, tanpa menebak status.

Penghitung **Jumlah / Sesuai / Tidak** di dialog selalu berasal dari snapshot resmi Badilum. Untuk saksi, pembanding lokal memakai jadwal pada bulan terpilih yang agendanya menyebut saksi dan mengecek apakah perkara tersebut punya catatan saksi bernama. Angka bisa cocok tanpa membuktikan identitas perkara resmi. Daftar semua entri yang diinput bulan itu tersedia terpisah dan tidak dihitung sebagai jumlah EIS.

Filter **Ada ‘Tidak’** menampilkan indikator yang mempunyai angka ketidaksesuaian di snapshot resmi, dan filter **Belum sama** menampilkan indikator/sub-bagian yang masih bertier **Mendekati** (kuning) atau **Belum sama** (merah) pada peta keselarasan `backend/lib/eisParity.js` (selisih hitung ulang juga diringkas pada tab **Konversi** lewat `GET /api/eis/score`). Daftar lokal saksi dan BAS memisahkan **Perlu dicek** (tanggal sudah lewat dan bukti lokal belum tercatat atau tidak dikenali), **Sudah lewat**, **Hari ini**, dan **Mendatang**. Pengelompokan ini bukan kriteria Badilum: waktu pengambilan snapshot bukan batas waktu data yang dinilai EIS, dan tanggal lewat tidak membuktikan sidang terlaksana.

**Kepatuhan** memiliki pembanding SIPP lokal untuk 27 indikator (35 rincian termasuk subindikator banding, kasasi, dan PK). Rincian tetap bisa dibuka ketika angka resmi nol atau kosong. NatunaSakti membaca data bulan terpilih saat dialog dibuka dan memisahkan **Perlu dicek**, **Memenuhi cek lokal**, dan **Belum bisa dinilai**. Setiap catatan menunjukkan tanggal acuan dan pembanding. Pembacaan dibatasi sampai tanggal sinkron SIPP terakhir (`MAX(sipp_last_sync)`, bisa diganti dengan parameter `asOf=YYYY-MM-DD`), sehingga kejadian setelah sinkron tidak ikut terhitung. Aturan 1×24 jam tidak menebak jam yang hilang; penerbitan salinan tidak dianggap bukti TTE. Unggah putusan dan penundaan sidang menggunakan log tindakan SIPP yang bisa dihubungkan ke perkara, bukan timestamp perubahan umum. Pembanding lokal tidak mengubah angka resmi dan tidak membuktikan identitas temuan MIS.

**Kelengkapan** dan **Kesesuaian** memakai pola rincian yang sama untuk pemeriksaan rujukan dokumen, laporan mediasi/diversi, relaas, kalender persidangan, anonimisasi, agenda, publikasi pihak (SK KMA 2-144/2022 berdasarkan tanggal pendaftaran), BHT, penahanan, sisa biaya, dan arsip. Untuk unggahan **Kelengkapan**, drawer menampilkan nama berkas dan memeriksa ekstensinya agar berkas non-PDF (`.docx`/`.doc`/`.rtf`) langsung terlihat pada banner peringatan maupun tiap baris tanpa mengubah angka `Sesuai`/`Tidak` EIS. Pemeriksaan hanya menyatakan data lokal memenuhi syarat yang bisa dibuktikan, misalnya rujukan dokumen ada atau sisa panjar sudah nol; isi dokumen dan dasar anonimisasi tidak disimpulkan. Sinkronisasi SIPP Web dan Data Center MARI adalah penilaian tingkat satker, bukan daftar perkara, dan tidak lagi ditandai sebagai ketidaksamaan.

**Verifikasi Dokumen Elektronik E-Litigasi** hanya menampilkan angka resmi. Badilum tidak menampilkan rincian entri pada indikator itu; hitungan bundel SIPP berdasarkan tanggal input tidak mereproduksi jumlah EIS Januari–Oktober 2026. Bundel tidak memuat tanggal verifikasi dan tidak ditampilkan sebagai daftar yang dinilai.

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
python -m pip install -r requirements.txt
npm run dev
```

Backend berjalan di:

```text
http://127.0.0.1:3000
```

### Menjalankan Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di:

```text
http://127.0.0.1:5173
```

Backend membutuhkan Windows, Python 3 di PATH, dan kredensial SSH/DB khusus yang sudah disiapkan di `%LOCALAPPDATA%\NatunaSakti\access`. Kredensial dilindungi DPAPI pengguna Windows dan tidak disimpan di repo. Aplikasi tidak memakai login, sehingga frontend/API dibatasi ke loopback; jangan mengekspos port ke LAN/internet. File DB sensitif tidak boleh di-commit ke Git.

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
