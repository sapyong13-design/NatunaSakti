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

Untuk memeriksa struktur yang dapat dilihat oleh akun sinkron, jalankan `python scripts/read-sipp-db.py --schema` dari `backend`. Perintah CLI ini hanya menampilkan nama tabel, nama kolom, tipe, dan nullability dari `information_schema.COLUMNS` untuk `sipp32`; tidak membaca baris perkara dan tidak menambah izin. MariaDB 5.5 tidak mendukung `START TRANSACTION … READ ONLY`; pembatasan tulis ditegakkan lewat izin `SELECT` akun dan query tetap pada pembaca. Akses membaca skema tidak berarti semua tabel disalin ke SQLite.

Untuk audit EIS saksi dan BAS, admin memperluas izin `natunasakti_ro@localhost` menjadi `SELECT` pada `sipp32.*`. Batas lima tabel di atas adalah konfigurasi awal. Verifikasi `SHOW GRANTS` memastikan tidak ada izin tulis atau `GRANT OPTION`. Sinkron reguler tetap memakai query tetap yang sama; audit membaca hanya kolom yang dibutuhkan untuk bulan terpilih. Alamat saksi, isi tanya-jawab, dan rujukan berkas BAS tidak dikembalikan oleh API. Jangan gunakan akun ini untuk membaca skema di luar `sipp32` atau menyalin seluruh database.


## Bukti cutover — 12 Oktober 2026

Sinkron nyata lewat endpoint manual berhasil membaca 4.607 perkara dan 15.501 jadwal sidang. Flag sumber: 283 `T`, 2.806 `Y`, 1.518 kosong/null. UI menampilkan nama sumber bahkan untuk flag `T`, dengan checklist terpisah. Permintaan sinkron bersamaan ditolak 429. Origin/Host asing dan POST lintas situs ditolak 403. Pengujian transaksi memastikan kegagalan detail mengembalikan seluruh perubahan lokal. Penambahan akun ini bukan jaminan terhadap query berat atau kompromi akun Windows lokal.


## Bukti lokal indikator Kinerja

Tab Kinerja kini punya pemeriksaan lokal per perkara, bukan hanya teks kriteria. Sumber dan aturannya:

| Indikator | Sumber lokal | Aturan | Mode |
|---|---|---|---|
| Penyelesaian Perkara Tepat Waktu | `perkara_putusan`, `perkara`, `perkara_jadwal_sidang`, `perkara_mediasi` | Pidana: tanggal pendaftaran → putusan. Perdata: sidang pertama setelah keputusan mediasi → putusan. Batas 5 bulan kalender. | `months` |
| Rilis Versi SIPP | `sys_config.app_version` | Versi terpasang dibandingkan dengan versi yang dinilai EIS (`ver. Satker`) dan versi terbaru (`ver. Terbaru`) dari snapshot. | `version` |
| Kesesuaian Kode Satker Nomor Perkara | `perkara.nomor_perkara` | Akhiran nomor perkara dibandingkan dengan kode satker yang ditampilkan EIS. | `code` |
| Jangka Waktu Pelaksanaan Delegasi Masuk | `delegasi_proses_masuk` | `tgl_surat_diterima` → `tgl_relaas`, batas 7 hari kerja (Senin–Jumat, libur nasional tidak dihitung). | `businessdays` |
| Pelaksanaan Mediasi | `perkara_mediasi` | Laporan/keputusan mediasi pada bulan terpilih; berhasil bila `hasil_mediasi` Y/Y1/Y2 atau tanggal kesepakatan terisi. | `mediation` |

Nilai pembanding (kode satker, versi) diambil dari snapshot EIS periode itu sendiri, bukan ditulis di kode. Peristiwa yang tanggalnya sama atau setelah waktu snapshot EIS diambil dilaporkan sebagai "belum dapat dinilai", bukan dihitung sebagai temuan.

Drawer tiap indikator menampilkan tabel `EIS / SIPP lokal / selisih` untuk Jumlah, Sesuai, dan Tidak, lalu daftar perkara dengan tanggal acuan, tanggal pembanding, dan catatan batas waktu. Tombol "Bukti SIPP lokal" tersedia pada semua indikator agar baris tanpa kolom angka (versi, kode satker) tetap dapat diperiksa.

Verifikasi 11 periode (Januari–November 2026): kelima indikator Kinerja cocok dengan angka EIS, termasuk 583 poin unsur dan 44/44 komponen pada mesin hitung `lib/eisScore.js`.

## Handoff Monitoring EIS & Keselarasan SIPP — 25 November 2026

### Mesin Skor & Peta Keselarasan
- `backend/lib/eisScore.js` (`GET /api/eis/score`) mereproduksi nilai maksimal, perolehan, konversi per komponen, dan skor total EIS dari snapshot resmi (termasuk bobot efektif banding `7`, kasasi `7`, PK `0` serta daftar `ALWAYS_COUNTED`).
- `backend/lib/eisParity.js` memetakan sub-indikator yang belum selaras 100% menjadi dua tier:
  - `warn` (kuning, **Mendekati** di UI): `Kelengkapan | Dokumen Elektronik Rencana Persidangan (Court Callendar)` (`8/11` bulan cocok) dan `Kesesuaian | Penahanan` (`6/11` bulan cocok; `Jumlah` lokal `>=` EIS namun 0 `Tidak` lokal belum menutup `1–2 Tidak` MIS pada Mar/Mei/Jul/Agu).
  - `diff` (merah, **Belum sama** di UI): `Kesesuaian | Verifikasi Dokumen Elektronik Elitigasi` dan `18` sub-bagian di **Kepatuhan** (banding/kasasi/PK, penetapan hakim/PP/hari sidang, pemberitahuan putusan, penundaan jadwal sidang, unggah putusan akhir, minutasi, TTE pidana).
- `Pelaksanaan Sinkronisasi SIPP WEB` dan `Pelaksanaan Sinkronisasi SIPP ke Data Center MARI` tidak ditandai tidak selaras karena penilaian tingkat satker tidak memiliki log sinkronisasi di `sipp32` (`sys_sinkronisasi` dan `sync_antrian` 0 baris).

### Aturan Lokal & Pemeriksaan Format Berkas
- **Kepatuhan (`backend/scripts/eis_compliance_casework.py`)**:
  - `Penginputan Penetapan Perpanjangan Penahanan`: selaras **10/10** bulan (Jan–Okt 2026) memakai `jenis_penahanan_id IN (7, 8)` menurut `tanggal_surat` dengan mode `date24_early`.
  - `Kepatuhan Penundaan Jadwal Sidang`: **7/10** cocok (Jan–Mei, Agu, Okt) memakai log `INSERT` penundaan (`urutan > 1`) terhadap `tanggal_sidang` baru (`YEAR(prev)=YEAR(new)`).
  - `Unggah Putusan Akhir`: **6/10** cocok (Jan, Mar–Jun, Agu) per berkas `amar_putusan_dok` unik.
- **Kelengkapan & Kesesuaian (`backend/scripts/eis_compliance_fit.py`)**:
  - `Publikasi Pihak`: selaras **11/11** berdasarkan `tanggal_pendaftaran` perkara SK KMA 2-144/2022 (`alur 118`, `-Anak/`, Perlindungan Anak, Perceraian, Pornografi, Kesusilaan, KDRT, atau `pihak_dipublikasikan = 'T'`).
  - `Penahanan`: mewajibkan baris penahanan PN bertanggal (`jenis_penahanan_id IN (7, 8)` dan `status_penahanan_id = 1`) sehingga perkara pra-PN/rehab tidak memicu `Tidak` palsu di April.
  - `Court Callendar`: memakai `MAX(perkara_penetapan_hari_sidang.tanggal_sidang)` (`tahapan_id = 12`) non-praperadilan (`alur_perkara_id <> 119`), cocok **8/11** bulan; total EIS `114` > `111` perkara SIPP akibat riwayat penetapan ulang di sisi MIS.
  - **Audit PDF Kelengkapan & BAS (`eisCompliance.js`, `eisSippAudit.js`, `EisComplianceList.vue`, `EisScheduleList.vue`)**: menampilkan nama berkas (`docName`) dan ekstensi (`docExt`) di tiap baris; berkas terunggah selain `.pdf` (`.docx`/`.doc`/`.rtf`) diberi banner dan penanda kuning tanpa mengubah status `Sesuai`/`Tidak` EIS.
- **Pencatatan Saksi (`MonitoringEisView.vue`)**: cocok **10/10** (Jan–Okt 2026); di November 2026 `6/6` lengkap di SIPP lokal vs `6/5/1` EIS karena `26/Pdt.P` baru diinput `24 Nov 14:15` dan tampilan web EIS menunggu pembaruan dari sisi Badilum.

### Catatan Operasional MIS Badilum (`192.168.1.2/mis/sinkronisasi`)
- `AUTOSYNC` / `SINKRONISASI MASSAL` berjalan via loop JS browser dan berisiko macet setelah tabel `#1` (`perkara`); gunakan **SINKRON** parsial (`kirimparsial`) untuk tahun berjalan pada tabel inti perkara jika angka Badilum tertinggal.
- Tabel historis pra-2026 (`perkara_jadwal_sidang`, `perkara_hakim_pn`, dll.) wajar berselisih dengan total lokal sejak 2009 dan **tidak perlu `RESET`** kecuali ada penghapusan baris 2026 yang merusak hitung EIS.

### Verifikasi Terakhir (25 November 2026)
- Backend Node: `62/62` lulus (`node --test lib/*.test.js services/*.test.js routes/*.test.js`).
- Backend Python: `2/2` lulus (`python scripts/test_read_sipp_db.py`).
- Frontend: `31/31` lulus (`node --test src/lib/*.test.mjs`) dan `npm run build` sukses.
