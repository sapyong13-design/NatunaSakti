# SIPP Sync - Dokumentasi Fitur

## Overview

Sinkron membaca seluruh perkara, jadwal sidang, dan putusan langsung dari MariaDB `sipp32` melalui SSH tunnel dengan akun khusus read-only. Tidak memakai scraping web atau fallback SIPP publik. Snapshot sumber dibaca konsisten dalam satu transaksi baca; hasil disimpan atomik di SQLite lokal. Kegagalan pembacaan/penyimpanan mempertahankan cache sebelumnya. Baris manual lokal tidak dihapus.

## Fitur

### 1. Auto-Sync (Cron Job)
- **Jadwal**: Setiap jam (menit 0)
- **Otomatis**: Berjalan di background tanpa perlu intervensi
- **Logging**: Setiap sync dicatat ke console

### 2. Manual Sync
- **Endpoint**: `POST /api/perkara/sipp/sync`
- **Frontend**: Tombol "Sync SIPP" di halaman Data
- **Feedback**: Progress indicator dan notifikasi
- **Mode**: selalu penuh, termasuk perubahan perkara lama; manual dan cron memakai guard bersama agar tidak overlap.
- **Sumber respons**: `source: sipp-db-ssh`, `mode: full`; progress dalam satuan perkara.
- **Nama**: semua pihak ditampilkan sesuai DB tanpa masking aplikasi. Flag `sipp_pihak_dipublikasikan` terpisah: `T` = checklist Anonimisasi dicentang, `Y` = tidak dicentang, kosong/null = Belum diketahui. Flag tetap dipakai laporan bulanan/mingguan.

### 3. Status Sync
- **Endpoint**: `GET /api/perkara/sipp/status`
- **Info**:
  - `total`: Jumlah seluruh perkara
  - `sipp_synced`: Jumlah perkara dari SIPP
  - `last_sync`: Timestamp sync terakhir

## Leaderboard Hakim (tanggal penetapan)

- `GET /api/dashboard/judges?period=monthly&year=2026&month=10` atau `period=yearly&year=2026`. Default bulan berjalan menurut waktu lokal backend. Parameter salah menghasilkan HTTP 400. Tidak melakukan pembacaan remote saat dashboard dibuka.
- Snapshot baca sekarang mencakup lima tabel, termasuk query tetap kolom disetujui pada `sipp32.perkara_hakim_pn`. Cache `hakim_assignment` dan timestamp `hakim_assignment_sync` diganti hanya dalam transaksi sinkron penuh yang sama dengan perkara/jadwal/putusan. Gagal baca atau tulis mempertahankan snapshot sebelumnya; refresh detail tidak mengganti cache penugasan penuh.
- Dasar periode adalah `tanggal_penetapan`, bukan `tanggal_pendaftaran`. Semua tahapan PN disertakan, termasuk tahapan 17, dan assignment tidak aktif/diganti tetap dihitung sebagai riwayat penunjukan.
- Semantik sumber diverifikasi melalui pembacaan terbatas oleh pengelola akses: jabatan 1 `Hakim Ketua` urutan 1; jabatan 3 `Hakim Tunggal` urutan 1; jabatan 2 `Hakim Anggota` urutan 2 = Anggota 1, urutan 3 = Anggota 2. Aplikasi memeriksa ID, label yang dinormalisasi spasinya, dan urutan bersama; kombinasi lain tidak diterka, melainkan dikecualikan dan ditampilkan dalam `coverage.unknown_roles`.
- Identitas hakim menggunakan `hakim_id`, bukan nama. Tiap kolom menghitung perkara unik per hakim/peran; total menghitung perkara unik lintas peran, bukan penjumlahan kolom. Baris duplikat identik tidak menambah hitungan; ID duplikat bertentangan menggagalkan sinkron atomik. Urut tabel: total menurun, nama, lalu ID. Ini bukan penilaian kinerja atau jumlah perkara aktif/putusan.
- Cakupan respons/UI mencantumkan baris periode yang dapat dihitung, peran tidak dikenal, identitas hakim hilang, tanggal hilang, dan waktu sinkron terakhir. Tanpa cache, UI meminta sinkron penuh (tidak menampilkan data contoh). Filter leaderboard mandiri dari filter pendaftaran dashboard.
- Uji offline (tidak memakai kredensial atau data remote): `node --test lib/*.test.js services/*.test.js routes/*.test.js` dari `backend`, `python scripts/test_read_sipp_db.py`, `node --test src/lib/*.test.mjs` dan `node node_modules/vite/bin/vite.js build` dari `frontend`. Gunakan Node 24 runtime lokal karena native SQLite tidak cocok dengan Node 26 sistem.

## Kolom Database

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `sipp_synced` | INTEGER | 1 = dari SIPP, 0/NULL = manual |
| `sipp_status` | TEXT | Status perkara di SIPP |
| `sipp_lama_proses` | TEXT | Lama proses perkara |
| `sipp_tanggal_register` | TEXT | Tanggal register di SIPP |
| `sipp_klasifikasi` | TEXT | Klasifikasi perkara |
| `sipp_last_sync` | TEXT | Timestamp sync terakhir |
| `sipp_pihak_dipublikasikan` | TEXT | `Y`, `T`, atau NULL; tidak diturunkan dari nama |

## Deteksi Jenis Perkara

Sistem otomatis mendeteksi jenis perkara dari nomor perkara:

| Prefix | Jenis |
|--------|-------|
| `/Pdt` | Perdata |
| `/Pid` | Pidana |
| `PRK` (diprioritaskan sebelum `/Pid`) | Perikanan |
| Lainnya | Lainnya |

Contoh:
- `4/Pdt.P/2026/PN Ntn` → Perdata
- `22/Pid.B/2026/PN Ntn` → Pidana

## File Terkait

- **Backend**:
  - `backend/services/sippSyncService.js` - Pemetaan snapshot dan transaksi cache lokal
  - `backend/routes/sipp.js` - Routes SIPP endpoints
  - `backend/server.js` - Konfigurasi cron job
  - `backend/scripts/read-sipp-db.py` - Pembaca DB via SSH, DPAPI dan host-key verification; hanya query tetap dengan parameter nomor perkara

- **Frontend**:
  - `frontend/src/lib/api.js` - API functions untuk SIPP
  - `frontend/src/views/DataView.vue` - UI dengan tombol sync

## Troubleshooting

### Sync gagal
1. Cek jaringan kantor ke `192.168.1.2:22` dan host key yang sudah diverifikasi di `~/.ssh/known_hosts`.
2. Jalankan pemeriksaan `%LOCALAPPDATA%\NatunaSakti\access\verify_access.py` sebagai pengguna Windows yang menyiapkan kredensial; jangan menonaktifkan verifikasi host key.
3. Pastikan `python` tersedia di PATH backend, dengan `paramiko` dan `pymysql` (`python -m pip install -r backend/requirements.txt`). Kredensial tidak boleh dipindahkan ke source/frontend; DPAPI terikat pengguna/PC.

### Data tidak muncul
1. Cek database: `backend/data/akurasi.db`
2. Verify sync status: `/api/perkara/sipp/status`
3. Refresh halaman Data di frontend

## Dependencies

- `cheerio` - Membersihkan HTML tersimpan pada kolom sumber menjadi teks
- `node-cron` - Job scheduler
- `better-sqlite3` - Cache SQLite lokal
- Python 3, `paramiko`, `pymysql` - SSH dan pembaca MariaDB melalui tunnel

## Akses DB internal read-only — 12 Oktober 2026

Akses khusus sudah aktif dipakai sinkron NatunaSakti. Penyiapan tidak mengubah data, tabel, trigger, akun lama, atau job sinkron SIPP, dan tidak membuat view. Akses kolom `amar_putusan` ditambahkan sebagai SELECT untuk mempertahankan detail putusan dan laporan denda; path dokumen tidak diberikan.

- SSH: `natunasakti_tunnel` pada `192.168.1.2:22`, autentikasi public key saja. Hanya local forwarding ke `127.0.0.1:3306`; sesi shell/command/SFTP, remote forwarding, agent/X11 forwarding, PTY, dan Unix-socket forwarding ditutup.
- Key dibatasi ke alamat sumber yang terlihat server, `192.168.1.1`. Ini gateway NAT, bukan identitas unik PC; SSH key tetap wajib.
- DB: `natunasakti_ro@localhost`, hanya `SELECT` kolom terpilih pada `sipp32.perkara`, `perkara_jadwal_sidang`, `perkara_putusan`, `perkara_putusan_terdakwa`, dan tambahan terbatas `perkara_hakim_pn`; maksimum dua koneksi. Izin tambahan penugasan hanya `id,perkara_id,tahapan_id,tanggal_penetapan,urutan,jabatan_hakim_id,jabatan_hakim_nama,hakim_id,hakim_nama,aktif,tanggal_tidak_aktif,diganti_oleh_id`. Tidak meminta NIP, tabel master hakim, atau dokumen. Tanpa akses langsung ke tabel `pihak`, tabel admin, atau kolom dokumen/posita yang tidak diperlukan.
- Kredensial di `%LOCALAPPDATA%\NatunaSakti\access`, di luar repo. Private key terenkripsi; password DB dan passphrase key dibungkus Windows DPAPI untuk pengguna Windows saat ini. ACL direktori hanya pengguna tersebut dan SYSTEM. DPAPI tidak melindungi dari proses jahat yang sudah berjalan sebagai pengguna itu atau admin PC.
- Pemeriksaan berulang: `verify_access.py` pada direktori yang sama, memakai Python dengan `paramiko` dan `pymysql`. Pemeriksaan melakukan pembacaan terbatas, penolakan akses terlarang, dan `SHOW GRANTS`; tidak menjalankan query tulis atau mencetak isi perkara/kredensial.
- Verifikasi nyata lulus: tunnel dan pembacaan kolom diizinkan; sesi SSH dan forwarding tujuan lain ditolak; kolom/tabel di luar izin ditolak; grant hanya USAGE dan SELECT kolom. Hak root DB tidak berubah; login admin SSH baru berhasil; sshd, MariaDB, dan Apache tetap aktif.
- Cadangan SSH server: `/etc/ssh/sshd_config.natunasakti-backup-20261012T074240`. `sshd -t` lulus sebelum reload SSH; SIPP/MariaDB tidak direstart.

Akun read-only tetap dapat menyalin data yang diizinkan. Backend dan Vite hanya listen `127.0.0.1`; API membatasi Host/Origin serta request lintas situs. Semua file DB lokal dihentikan pelacakannya dan di-ignore; file tetap di PC, direktori data dibatasi ACL ke pengguna Windows dan SYSTEM. Riwayat Git lama tidak ditulis ulang: salinan DB yang pernah di-commit tetap ada di riwayat lama. Jangan menaruh kredensial di frontend, source code, log, atau chat.

## Bukti cutover — 12 Oktober 2026

Sinkron nyata lewat endpoint manual berhasil membaca 4.607 perkara dan 15.501 jadwal sidang. Flag sumber: 283 `T`, 2.806 `Y`, 1.518 kosong/null. UI menampilkan nama sumber bahkan untuk flag `T`, dengan checklist terpisah. Permintaan sinkron bersamaan ditolak 429. Origin/Host asing dan POST lintas situs ditolak 403. Pengujian transaksi memastikan kegagalan detail mengembalikan seluruh perubahan lokal. Penambahan akun ini bukan jaminan terhadap query berat atau kompromi akun Windows lokal.

