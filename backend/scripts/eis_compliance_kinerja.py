"""Fixed read-only SIPP queries for the Kinerja indicators (per-case evidence)."""

def rule(sql, basis, mode, **extra):
    return dict(sql=sql, basis=basis, mode=mode, **extra)

# Lima bulan kalender: batas dihitung di sisi JS dari tanggal acuan.
TIMELY = rule(
    """
    SELECT p.nomor_perkara,
           CASE WHEN p.nomor_perkara REGEXP '/Pdt[.]|/Pdt/'
                THEN COALESCE(
                       (SELECT MIN(j.tanggal_sidang) FROM perkara_jadwal_sidang j
                        WHERE j.perkara_id=p.perkara_id
                          AND j.tanggal_sidang >= COALESCE(
                              (SELECT MAX(m.keputusan_mediasi) FROM perkara_mediasi m
                               WHERE m.perkara_id=p.perkara_id AND m.keputusan_mediasi > '1000-01-01'),
                              '1000-01-01')),
                       (SELECT MIN(j.tanggal_sidang) FROM perkara_jadwal_sidang j
                        WHERE j.perkara_id=p.perkara_id))
                ELSE p.tanggal_pendaftaran END AS event_at,
           CASE WHEN p.nomor_perkara REGEXP '/Pdt[.]|/Pdt/'
                THEN 'Tanggal sidang pertama setelah mediasi' ELSE 'Tanggal pendaftaran' END AS event_label,
           x.tanggal_putusan AS comparison_at,
           'Tanggal putusan' AS comparison_label,
           5 AS limit_months
    FROM perkara_putusan x JOIN perkara p USING(perkara_id)
    WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s
    ORDER BY x.tanggal_putusan,p.perkara_id
    """,
    'Perkara putus pada bulan terpilih. Batas lima bulan kalender; acuan pidana = tanggal '
    'pendaftaran, acuan perdata = sidang pertama yang tercatat setelah keputusan mediasi '
    '(proksi: cache tidak memastikan sidang benar-benar terlaksana).',
    'months',
)

SATKER_CODE = rule(
    """
    SELECT p.nomor_perkara, p.tanggal_pendaftaran AS event_at,
           SUBSTRING_INDEX(p.nomor_perkara,'/',-1) AS code_actual,
           'Tanggal pendaftaran' AS event_label
    FROM perkara p
    WHERE p.tanggal_pendaftaran >= %s AND p.tanggal_pendaftaran < %s
    ORDER BY p.tanggal_pendaftaran,p.perkara_id
    """,
    'Kode satker diambil dari bagian akhir nomor perkara setiap perkara yang terdaftar pada '
    'bulan terpilih, lalu dibandingkan dengan kode yang ditampilkan EIS untuk satker ini.',
    'code',
)

DELEGATION = rule(
    """
    SELECT p.nomor_perkara, d.tgl_surat_diterima AS event_at,
           d.tgl_relaas AS comparison_at, d.nomor_relaas,
           'Surat delegasi diterima' AS event_label,
           'Relaas delegasi dilaksanakan' AS comparison_label,
           7 AS limit_days
    FROM delegasi_proses_masuk d JOIN perkara p ON p.perkara_id=d.perkara_id
    WHERE d.tgl_relaas >= %s AND d.tgl_relaas < %s
      AND d.tgl_surat_diterima > '1000-01-01' AND d.tgl_relaas > '1000-01-01'
    ORDER BY d.tgl_relaas,p.perkara_id
    """,
    'Delegasi masuk yang relaasnya dilaksanakan pada bulan terpilih. Batas 7 hari kerja dihitung '
    'Senin–Jumat tanpa kalender hari libur nasional; hari libur tidak tersedia di basis data.',
    'businessdays',
)

MEDIATION = rule(
    """
    SELECT p.nomor_perkara,
           COALESCE(NULLIF(m.tgl_laporan_mediator,'0000-00-00'), NULLIF(m.keputusan_mediasi,'0000-00-00'), m.dimulai_mediasi) AS event_at,
           m.hasil_mediasi, m.mediasi_berhasil, m.dimulai_mediasi, m.keputusan_mediasi, m.tgl_laporan_mediator,
           'Tanggal laporan/keputusan mediasi' AS event_label
    FROM perkara_mediasi m JOIN perkara p USING(perkara_id)
    WHERE COALESCE(NULLIF(m.tgl_laporan_mediator,'0000-00-00'), NULLIF(m.keputusan_mediasi,'0000-00-00'), m.dimulai_mediasi) >= %s
      AND COALESCE(NULLIF(m.tgl_laporan_mediator,'0000-00-00'), NULLIF(m.keputusan_mediasi,'0000-00-00'), m.dimulai_mediasi) < %s
    ORDER BY event_at,p.perkara_id
    """,
    'Perkara dengan laporan mediator pada bulan terpilih. Berhasil bila hasil mediasi berkode '
    'Y/Y1/Y2 atau tanggal kesepakatan perdamaian terisi; kode T dihitung tidak berhasil.',
    'mediation',
)

VERSION = rule(
    """
    SELECT name, value FROM sys_config WHERE name='app_version' LIMIT 1
    """,
    'Versi SIPP terpasang dibaca dari sys_config.app_version di basis data satker; versi terbaru '
    'mengikuti nilai yang ditampilkan EIS karena tidak ada di basis data lokal.',
    'version',
    params=False,
)

RULES = {
    'timely-decision': TIMELY,
    'satker-code': SATKER_CODE,
    'delegation-arrival': DELEGATION,
    'mediation-result': MEDIATION,
    'sipp-version': VERSION,
}
