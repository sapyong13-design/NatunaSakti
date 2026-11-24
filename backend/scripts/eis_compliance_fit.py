"""Fixed read-only SIPP queries for Kelengkapan and Kesesuaian evidence."""

from datetime import date


def rule(sql, basis, mode='presence'):
    return {'sql': sql, 'basis': basis, 'mode': mode}


def presence(sql, basis):
    return rule(sql, basis, 'presence')


RULES = {
    'dakwaan': presence("""SELECT p.nomor_perkara,p.tanggal_pendaftaran AS event_at,
        CASE WHEN TRIM(COALESCE(p.dakwaan_dok,'')) NOT IN ('','0','-') THEN 1 ELSE 0 END AS present,
        'Tanggal pendaftaran' AS event_label
        FROM perkara p WHERE p.tanggal_pendaftaran >= %s AND p.tanggal_pendaftaran < %s
        ORDER BY p.tanggal_pendaftaran,p.perkara_id""",
        'Perkara terdaftar pada bulan terpilih. Yang diperiksa hanya rujukan dokumen dakwaan/petitum di SIPP, bukan isi dokumen.'),
    'tuntutan-doc': presence("""SELECT p.nomor_perkara,x.tanggal_penuntutan AS event_at,
        CASE WHEN TRIM(COALESCE(x.isi_penuntutan_dok,'')) NOT IN ('','0','-') THEN 1 ELSE 0 END AS present,
        'Tanggal tuntutan' AS event_label
        FROM perkara_penuntutan x JOIN perkara p USING(perkara_id)
        WHERE x.tanggal_penuntutan >= %s AND x.tanggal_penuntutan < %s
        ORDER BY x.tanggal_penuntutan,p.perkara_id""",
        'Tuntutan pada bulan terpilih. Rujukan dokumen bukan bukti isi atau penerimaan oleh MIS.'),
    'putusan-doc': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN TRIM(COALESCE(x.amar_putusan_dok,'')) NOT IN ('','0','-') THEN 1 ELSE 0 END AS present,
        'Tanggal putusan akhir' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Putusan bulan terpilih dengan/tanpa rujukan dokumen amar. Rujukan bukan bukti unggahan pertama.'),
    'lapor-mediasi': presence("""SELECT p.nomor_perkara,m.tgl_laporan_mediator AS event_at,
        CASE WHEN m.tgl_laporan_mediator IS NOT NULL AND m.tgl_laporan_mediator > '1000-01-01' THEN 1 ELSE 0 END AS present,
        'Tanggal laporan mediator' AS event_label
        FROM perkara_mediasi m JOIN perkara p USING(perkara_id)
        WHERE m.tgl_laporan_mediator >= %s AND m.tgl_laporan_mediator < %s
        ORDER BY m.tgl_laporan_mediator,p.perkara_id""",
        'Perkara dengan tanggal laporan mediator pada bulan terpilih. Cakupan wajib mediasi mengikuti data SIPP.'),
    'lapor-diversi': presence("""SELECT p.nomor_perkara,d.tgl_laporan_hakim AS event_at,
        CASE WHEN d.tgl_laporan_hakim IS NOT NULL AND d.tgl_laporan_hakim > '1000-01-01' THEN 1 ELSE 0 END AS present,
        'Tanggal laporan hakim diversi' AS event_label
        FROM perkara_diversi d JOIN perkara p USING(perkara_id)
        WHERE d.tgl_laporan_hakim >= %s AND d.tgl_laporan_hakim < %s
        ORDER BY d.tgl_laporan_hakim,p.perkara_id""",
        'Perkara diversi dengan tanggal laporan hakim pada bulan terpilih. Kewajiban diversi tidak disimpulkan dari status perkara.'),
    'nilai-sengketa': presence("""SELECT p.nomor_perkara,p.tanggal_pendaftaran AS event_at,
        CASE WHEN TRIM(COALESCE(o.obyek_gugatan,'')) <> '' THEN 1 ELSE 0 END AS present,
        'Tanggal pendaftaran' AS event_label
        FROM perkara p LEFT JOIN perkara_obyek_sengketa o USING(perkara_id)
        WHERE p.nomor_perkara REGEXP '/Pdt[.]' AND p.tanggal_pendaftaran >= %s AND p.tanggal_pendaftaran < %s
        ORDER BY p.tanggal_pendaftaran,p.perkara_id""",
        'Perdata terdaftar bulan terpilih dengan/tanpa uraian obyek sengketa. Nilai sengketa gugatan sederhana tidak diturunkan dari uraian bebas.'),
    'relaas-pertama': presence("""SELECT p.nomor_perkara,r.tanggal_relaas AS event_at,
        CASE WHEN TRIM(COALESCE(r.doc_relaas,'')) NOT IN ('','0','-') THEN 1 ELSE 0 END AS present,
        'Tanggal relaas panggilan' AS event_label
        FROM perkara_pelaksanaan_relaas r JOIN perkara p USING(perkara_id)
        JOIN (SELECT perkara_id,MIN(tanggal_sidang) first_date FROM perkara_jadwal_sidang GROUP BY perkara_id) f
          ON f.perkara_id=r.perkara_id
        WHERE r.tanggal_relaas >= %s AND r.tanggal_relaas < %s
        ORDER BY r.tanggal_relaas,p.perkara_id""",
        'Relaas pada bulan terpilih. Relasi ke sidang pertama belum dipastikan karena tabel relaas memakai sidang_id yang dapat berubah.'),
    'court-calendar': presence("""SELECT p.nomor_perkara,c.rencana_tanggal AS event_at,
        1 AS present,'Tanggal rencana persidangan' AS event_label
        FROM perkara_court_calendar c JOIN perkara p USING(perkara_id)
        WHERE c.rencana_tanggal >= %s AND c.rencana_tanggal < %s
        ORDER BY c.rencana_tanggal,p.perkara_id""",
        'Baris rencana persidangan pada bulan terpilih dianggap catatan tersedia. Kualitas dan versi dokumen tidak dinilai.'),
    'putusan-anonim': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN TRIM(COALESCE(x.amar_putusan_anonimisasi_dok,'')) NOT IN ('','0','-')
            OR TRIM(COALESCE(a.amar_anonim,'')) <> '' THEN 1 ELSE 0 END AS present,
        'Tanggal putusan' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        LEFT JOIN perkara_putusan_anonim a USING(perkara_id)
        WHERE p.pihak_dipublikasikan='T' AND x.tanggal_putusan >= %s AND x.tanggal_putusan < %s ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Putusan bulan terpilih yang ditandai tidak dipublikasikan (wajib anonimisasi). Rujukan dokumen atau teks anonimisasi diperiksa; kesesuaian dengan SK KMA tidak.'),
    'agenda-terakhir': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN LOWER(COALESCE(j.agenda,'')) REGEXP 'putusan|penetapan' THEN 1 ELSE 0 END AS present,
        'Tanggal putusan' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        JOIN perkara_jadwal_sidang j ON j.perkara_id=x.perkara_id
          AND j.tanggal_sidang=(SELECT MAX(tanggal_sidang) FROM perkara_jadwal_sidang WHERE perkara_id=x.perkara_id)
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Agenda jadwal terakhir pada perkara yang putus bulan terpilih. Teks agenda bukan kode agenda resmi; agenda ambigu tidak disimpulkan.'),
    'putusan-sidang-terakhir': rule("""SELECT p.nomor_perkara,MAX(j.tanggal_sidang) AS event_at,
        x.tanggal_putusan AS comparison_at,0 AS limit_days,
        'Tanggal sidang terakhir' AS event_label,'Tanggal putusan' AS comparison_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        JOIN perkara_jadwal_sidang j ON j.perkara_id=x.perkara_id
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s
        GROUP BY p.nomor_perkara,x.tanggal_putusan ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Tanggal sidang terakhir harus sama dengan tanggal putusan. Selisih berarti perlu dicek, bukan otomatis salah input.', 'days'),
    'publikasi-pihak': rule("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        COALESCE(NULLIF(TRIM(p.pihak_dipublikasikan),''),'Belum diisi') AS flag_text,
        'Tanggal putusan' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Flag publikasi pihak pada putusan bulan terpilih (Y dipublikasikan, T tidak dipublikasikan). Cakupan yang dinilai MIS dan dasar anonimisasi tidak diketahui, sehingga tidak ada yang ditandai sebagai temuan.', 'evidence'),
    'bht': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN x.tanggal_bht IS NOT NULL AND x.tanggal_bht > '1000-01-01' THEN 1 ELSE 0 END AS present,
        'Tanggal putusan' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Pencatatan tanggal BHT pada putusan bulan terpilih. BHT yang belum jatuh tempo dapat muncul sebagai belum tercatat.'),
    'penahanan': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN MAX(t.sampai) <= x.tanggal_putusan THEN 1 ELSE 0 END AS present,
        'Tanggal putusan' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        JOIN penahanan_terdakwa t ON t.perkara_id=x.perkara_id
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s
        GROUP BY p.nomor_perkara,x.tanggal_putusan ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Hanya perkara dengan catatan penahanan. Penahanan yang berakhir setelah tanggal putusan ditandai untuk dicek; penahanan lanjutan menunggu upaya hukum bisa sah. Penangguhan dan pengalihan tidak diperiksa.'),
    'sisa-biaya': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN COALESCE(SUM(b.sisa),0) <= 0 THEN 1 ELSE 0 END AS present,
        'Tanggal putusan' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        LEFT JOIN perkara_biaya b ON b.perkara_id=x.perkara_id
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s
        GROUP BY p.nomor_perkara,x.tanggal_putusan ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Sisa panjar pada transaksi biaya tingkat pertama. Pengembalian yang dilakukan di luar SIPP tidak terlihat.'),
    'elitigasi': rule("""SELECT p.nomor_perkara,MIN(b.diinput_tanggal) AS event_at,
        SUM(b.verifikasi IN (1,3)) AS verified_docs,COUNT(*) AS total_docs,
        'Tanggal input dokumen e-Litigasi pertama' AS event_label
        FROM perkara_bundel b JOIN perkara p USING(perkara_id)
        WHERE b.diinput_tanggal >= %s AND b.diinput_tanggal < %s
        GROUP BY p.nomor_perkara ORDER BY event_at,p.nomor_perkara""",
        'E-Litigasi diverifikasi hakim di e-Berpadu/e-Court, bukan di SIPP. sipp32 hanya menyimpan flag verifikasi tanpa tanggal, dan MIS tidak mengirim tabel bukti/verifikasi ke Badilum (103 tabel tersinkron, tidak satu pun berisi data ini). Karena itu angka resmi tidak dapat dihitung ulang; daftar ini hanya bukti berkas dan status verifikasi saat ini.', 'evidence'),
    'arsip': presence("""SELECT p.nomor_perkara,a.tanggal_masuk_arsip AS event_at,
        1 AS present,'Tanggal masuk arsip' AS event_label
        FROM arsip a JOIN perkara p ON p.perkara_id=a.perkara_id
        WHERE a.tanggal_masuk_arsip >= %s AND a.tanggal_masuk_arsip < %s
        ORDER BY a.tanggal_masuk_arsip,a.id""",
        'Arsip pada bulan terpilih. Batas waktu menurut SOP Kepaniteraan tidak dihitung tanpa aturan resmi yang terverifikasi.'),
}
