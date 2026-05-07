# Reklasifikasi Perkara Perikanan (PRK) — Design

**Tanggal:** 2026-05-07
**Konteks:** Filter dropdown "Perikanan" di DataView mengembalikan 0 baris meskipun database menyimpan beberapa perkara dengan nomor `Pid.Sus-PRK`.

## Masalah

`backend/services/sippSyncService.js:291-300` mendeteksi `PRK` di nomor perkara dan memetakannya ke `jenis_perkara = 'Perikanan'`. Tapi 4 perkara `Pid.Sus-PRK/2025/PN Ntn` di DB lokal masih ke-tag `'Pidana'` — kemungkinan ke-sync sebelum logic deteksi PRK ditambahkan.

Akibatnya filter `WHERE jenis_perkara = 'Perikanan'` (`backend/server.js:166`) tidak match apa-apa, dan tag warna di tabel tidak konsisten dengan kategori sebenarnya.

## Solusi

Satu kali migrasi data: update kolom `jenis_perkara` untuk semua baris yang nomor perkaranya mengandung `PRK`.

### Kriteria match

`UPPER(nomor_perkara) LIKE '%PRK%'` — menangkap semua varian (`Pid.Sus-PRK`, hipotetis `Pid.PRK`, dll). Konfirmasi user: cukup pakai pola ini.

### Eksekusi

Script Node sekali pakai di `backend/migrate-reclassify-prk.js`:

1. Buka `data/akurasi.db` via `better-sqlite3`.
2. Hitung baris yang akan ke-update (preview).
3. Jalankan `UPDATE perkara SET jenis_perkara = 'Perikanan' WHERE UPPER(nomor_perkara) LIKE '%PRK%' AND jenis_perkara != 'Perikanan'`.
4. Cetak jumlah baris yang berubah dan distribusi `jenis_perkara` setelahnya.

Idempoten: kondisi `!= 'Perikanan'` mencegah no-op update di run berikutnya.

### Tidak diubah

- Logic deteksi di `sippSyncService.detectJenisPerkara()` sudah benar (PRK dicek duluan).
- Sync periodik berikutnya pakai `INSERT OR REPLACE` (sippSyncService.js:321) — akan overwrite `jenis_perkara` dengan benar untuk baris yang masih ada di window 10 halaman SIPP.
- Filter backend dan dropdown frontend tidak perlu disentuh.

## Verifikasi

Setelah migrasi:
- `SELECT jenis_perkara, COUNT(*) FROM perkara GROUP BY jenis_perkara` menunjukkan baris di kategori `Perikanan`.
- Buka `/data` di frontend, pilih filter Perikanan → tabel berisi perkara PRK.

## Out of scope

- Tidak menyentuh DB di Laragon/produksi (ini cuma lokal).
- Tidak ada perubahan UI/skema.
- Tidak menambahkan jenis perkara baru di dropdown (sudah ada 3: Perdata, Pidana, Perikanan).
