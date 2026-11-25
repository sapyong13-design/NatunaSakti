"""Fixed read-only SIPP queries for Kelengkapan and Kesesuaian evidence."""

from datetime import date


def rule(sql, basis, mode='presence'):
    return {'sql': sql, 'basis': basis, 'mode': mode}


def presence(sql, basis):
    return rule(sql, basis, 'presence')


RULES = {
    'dakwaan': presence("""SELECT p.nomor_perkara,p.tanggal_pendaftaran AS event_at,
        CASE WHEN p.nomor_perkara REGEXP '/Pdt[.]|/Pdt/'
             THEN (CASE WHEN TRIM(COALESCE(p.petitum_dok,'')) NOT IN ('','0','-') THEN 1 ELSE 0 END)
             ELSE (CASE WHEN TRIM(COALESCE(p.dakwaan_dok,'')) NOT IN ('','0','-') THEN 1 ELSE 0 END) END AS present,
        CASE WHEN p.nomor_perkara REGEXP '/Pdt[.]|/Pdt/'
             THEN NULLIF(TRIM(COALESCE(p.petitum_dok,'')),'')
             ELSE NULLIF(TRIM(COALESCE(p.dakwaan_dok,'')),'') END AS doc_path,
        'Tanggal pendaftaran' AS event_label
        FROM perkara p WHERE p.tanggal_pendaftaran >= %s AND p.tanggal_pendaftaran < %s
        ORDER BY p.tanggal_pendaftaran,p.perkara_id""",
        'Perkara terdaftar pada bulan terpilih. Pidana memeriksa rujukan dakwaan_dok, perdata memeriksa rujukan petitum_dok.'),
    'tuntutan-doc': presence("""SELECT p.nomor_perkara,x.tanggal_penuntutan AS event_at,
        CASE WHEN TRIM(COALESCE(x.isi_penuntutan_dok,'')) NOT IN ('','0','-') THEN 1 ELSE 0 END AS present,
        NULLIF(TRIM(COALESCE(x.isi_penuntutan_dok,'')),'') AS doc_path,
        'Tanggal tuntutan' AS event_label
        FROM perkara_penuntutan x JOIN perkara p USING(perkara_id)
        WHERE x.tanggal_penuntutan >= %s AND x.tanggal_penuntutan < %s
        ORDER BY x.tanggal_penuntutan,p.perkara_id""",
        'Tuntutan pada bulan terpilih. Rujukan dokumen bukan bukti isi atau penerimaan oleh MIS.'),
    'putusan-doc': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN TRIM(COALESCE(x.amar_putusan_dok,'')) NOT IN ('','0','-') THEN 1 ELSE 0 END AS present,
        NULLIF(TRIM(COALESCE(x.amar_putusan_dok,'')),'') AS doc_path,
        'Tanggal putusan akhir' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Putusan bulan terpilih dengan/tanpa rujukan dokumen amar. Rujukan bukan bukti unggahan pertama.'),
    'lapor-mediasi': presence("""SELECT p.nomor_perkara,
        COALESCE(NULLIF(m.tgl_laporan_mediator,'0000-00-00'), NULLIF(m.keputusan_mediasi,'0000-00-00'), m.dimulai_mediasi) AS event_at,
        CASE WHEN m.tgl_laporan_mediator IS NOT NULL AND m.tgl_laporan_mediator > '1000-01-01' THEN 1 ELSE 0 END AS present,
        'Tanggal laporan/keputusan mediasi' AS event_label
        FROM perkara_mediasi m JOIN perkara p USING(perkara_id)
        WHERE COALESCE(NULLIF(m.tgl_laporan_mediator,'0000-00-00'), NULLIF(m.keputusan_mediasi,'0000-00-00'), m.dimulai_mediasi) >= %s
          AND COALESCE(NULLIF(m.tgl_laporan_mediator,'0000-00-00'), NULLIF(m.keputusan_mediasi,'0000-00-00'), m.dimulai_mediasi) < %s
        ORDER BY event_at,p.perkara_id""",
        'Perkara dengan laporan atau keputusan mediasi pada bulan terpilih; sesuai bila tanggal laporan mediator terisi.'),
    'lapor-diversi': presence("""SELECT p.nomor_perkara,d.tgl_laporan_hakim AS event_at,
        CASE WHEN d.tgl_laporan_hakim IS NOT NULL AND d.tgl_laporan_hakim > '1000-01-01' THEN 1 ELSE 0 END AS present,
        'Tanggal laporan hakim diversi' AS event_label
        FROM perkara_diversi d JOIN perkara p USING(perkara_id)
        WHERE d.tgl_laporan_hakim >= %s AND d.tgl_laporan_hakim < %s
        ORDER BY d.tgl_laporan_hakim,p.perkara_id""",
        'Perkara diversi dengan tanggal laporan hakim pada bulan terpilih. Kewajiban diversi tidak disimpulkan dari status perkara.'),
    'nilai-sengketa': presence("""SELECT p.nomor_perkara,p.tanggal_pendaftaran AS event_at,
        CASE WHEN p.nilai_sengketa > 0 THEN 1 ELSE 0 END AS present,
        'Tanggal pendaftaran' AS event_label
        FROM perkara p
        WHERE p.alur_perkara_id=8 AND p.tanggal_pendaftaran >= %s AND p.tanggal_pendaftaran < %s
        ORDER BY p.tanggal_pendaftaran,p.perkara_id""",
        'Perkara gugatan sederhana (alur 8) terdaftar pada bulan terpilih; memeriksa nilai_sengketa > 0.'),
    'relaas-pertama': presence("""SELECT p.nomor_perkara,f.first_date AS event_at,
        CASE WHEN TRIM(COALESCE(r.doc_relaas,'')) NOT IN ('','0','-') THEN 1 ELSE 0 END AS present,
        NULLIF(TRIM(COALESCE(r.doc_relaas,'')),'') AS doc_path,
        'Tanggal sidang pertama' AS event_label
        FROM perkara_pelaksanaan_relaas r JOIN perkara p USING(perkara_id)
        JOIN perkara_jadwal_sidang j ON j.id=r.sidang_id
        JOIN (SELECT perkara_id,MIN(tanggal_sidang) first_date FROM perkara_jadwal_sidang GROUP BY perkara_id) f
          ON f.perkara_id=j.perkara_id AND f.first_date=j.tanggal_sidang
        WHERE f.first_date >= %s AND f.first_date < %s
        ORDER BY f.first_date,p.perkara_id,r.id""",
        'Relaas yang terhubung ke jadwal sidang pertama pada bulan terpilih; memeriksa rujukan doc_relaas.'),
    'court-calendar': presence("""SELECT p.nomor_perkara,
        COALESCE((SELECT MAX(ph.tanggal_sidang) FROM perkara_penetapan_hari_sidang ph WHERE ph.perkara_id=p.perkara_id AND ph.tahapan_id=12), MIN(c.rencana_tanggal)) AS event_at,
        CASE WHEN EXISTS (SELECT 1 FROM perkara_edoc_calendar e WHERE e.perkara_id=p.perkara_id AND TRIM(COALESCE(e.edoc_calender,'')) <> '')
             THEN 1 ELSE 0 END AS present,
        (SELECT NULLIF(TRIM(e.edoc_calender),'') FROM perkara_edoc_calendar e
         WHERE e.perkara_id=p.perkara_id AND TRIM(COALESCE(e.edoc_calender,'')) <> ''
         ORDER BY e.id LIMIT 1) AS doc_path,
        'Tanggal penetapan hari sidang terakhir' AS event_label
        FROM perkara_court_calendar c JOIN perkara p USING(perkara_id)
        WHERE p.alur_perkara_id <> 119
        GROUP BY p.perkara_id,p.nomor_perkara
        HAVING event_at >= %s AND event_at < %s
        ORDER BY event_at,p.perkara_id""",
        'Satu baris per perkara non-praperadilan menurut tanggal sidang pada penetapan hari sidang terakhir; memeriksa keberadaan edoc_calender.'),
    'putusan-anonim': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN TRIM(COALESCE(x.amar_putusan_anonimisasi_dok,'')) NOT IN ('','0','-')
            OR TRIM(COALESCE(a.amar_anonim,'')) <> '' THEN 1 ELSE 0 END AS present,
        NULLIF(TRIM(COALESCE(x.amar_putusan_anonimisasi_dok,'')),'') AS doc_path,
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
    'publikasi-pihak': presence("""SELECT p.nomor_perkara,p.tanggal_pendaftaran AS event_at,
        CASE WHEN p.pihak_dipublikasikan = 'T' THEN 1
             WHEN p.pihak_dipublikasikan = 'Y' THEN 0
             ELSE NULL END AS present,
        COALESCE(NULLIF(TRIM(p.pihak_dipublikasikan),''),'Belum diisi') AS flag_text,
        'Tanggal pendaftaran' AS event_label
        FROM perkara p
        WHERE p.tanggal_pendaftaran >= %s AND p.tanggal_pendaftaran < %s
          AND (p.pihak_dipublikasikan = 'T'
               OR p.alur_perkara_id = 118
               OR p.nomor_perkara REGEXP '-Anak/'
               OR LOWER(COALESCE(p.jenis_perkara_nama,'')) REGEXP 'perlindungan anak|perceraian|pornografi|kesusilaan|kekerasan dalam rumah tangga')
        ORDER BY p.tanggal_pendaftaran,p.perkara_id""",
        'Perkara wajib anonimisasi (SK KMA 2-144/2022) menurut tanggal pendaftaran; sesuai bila pihak_dipublikasikan = T, belum dinilai bila kosong.'),
    'bht': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN x.tanggal_bht IS NOT NULL AND x.tanggal_bht > '1000-01-01' THEN 1 ELSE 0 END AS present,
        'Tanggal putusan' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s
          AND NOT EXISTS (SELECT 1 FROM perkara_banding b WHERE b.perkara_id=x.perkara_id)
        ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Putusan bulan terpilih tanpa permohonan banding; memeriksa pencatatan tanggal BHT.'),
    'penahanan': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN SUM(t.sampai IS NULL OR t.sampai <= '1000-01-01') = 0 AND MAX(t.sampai) >= x.tanggal_putusan THEN 1 ELSE 0 END AS present,
        'Tanggal putusan' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        JOIN penahanan_terdakwa t ON t.perkara_id=x.perkara_id
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s
          AND EXISTS (SELECT 1 FROM penahanan_terdakwa t2 WHERE t2.perkara_id=x.perkara_id AND t2.jenis_penahanan_id IN (7,8) AND t2.status_penahanan_id=1)
        GROUP BY p.perkara_id,p.nomor_perkara,x.tanggal_putusan
        HAVING MAX(t.sampai) > '1000-01-01'
        ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Perkara putus dengan penahanan PN bertanggal; sesuai bila seluruh baris penahanan bertanggal dan masih berlaku sampai tanggal putusan.'),
    'sisa-biaya': presence("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        CASE WHEN COALESCE(SUM(b.sisa),0) <= 0 THEN 1 ELSE 0 END AS present,
        'Tanggal putusan' AS event_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        JOIN perkara_biaya b ON b.perkara_id=x.perkara_id
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s
        GROUP BY p.perkara_id,p.nomor_perkara,x.tanggal_putusan ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Putusan bulan terpilih yang memiliki transaksi biaya perkara tingkat pertama; sesuai bila sisa panjar <= 0.'),
    'arsip': presence("""SELECT p.nomor_perkara,a.tanggal_masuk_arsip AS event_at,
        CASE WHEN x.tanggal_bht IS NOT NULL AND x.tanggal_bht > '1000-01-01'
                  AND DATEDIFF(a.tanggal_masuk_arsip, x.tanggal_bht) > 3 THEN 0 ELSE 1 END AS present,
        'Tanggal masuk arsip' AS event_label
        FROM arsip a JOIN perkara p ON p.perkara_id=a.perkara_id
        LEFT JOIN perkara_putusan x ON x.perkara_id=a.perkara_id
        WHERE a.tanggal_masuk_arsip >= %s AND a.tanggal_masuk_arsip < %s
        ORDER BY a.tanggal_masuk_arsip,a.id""",
        'Arsip masuk pada bulan terpilih; sesuai bila tanggal masuk arsip <= 3 hari kalender dari tanggal BHT.'),
}
