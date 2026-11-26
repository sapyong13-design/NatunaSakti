"""Fixed SIPP queries for registration, evidence and first-instance appointments."""

# Detail histories retain the initial order; perkara_penetapan can point to a
# replacement. Phase 10 marks the original case and phase 12 the hearing order.
_APPOINTMENTS = (
    ("judge", "perkara_hakim_pn", 10, "hakim_id", "majelis/hakim"),
    ("clerk", "perkara_panitera_pn", 10, "panitera_id", "panitera pengganti"),
    ("bailiff", "perkara_jurusita", 10, "jurusita_id", "jurusita"),
    ("hearing", "perkara_penetapan_hari_sidang", 12, "jadwalsidang_id", "hari sidang"),
)

RULES = {
    "registration": dict(
        sql="""
            SELECT p.nomor_perkara, p.tanggal_pendaftaran AS event_at,
                   CASE WHEN p.diinput_tanggal > '1000-01-01' THEN p.diinput_tanggal END AS comparison_at,
                   'Tanggal pendaftaran' AS event_label, 'Waktu input perkara di SIPP' AS comparison_label
            FROM perkara p
            WHERE p.tanggal_pendaftaran >= %s AND p.tanggal_pendaftaran < %s
        """,
        basis=("Periode menurut tanggal pendaftaran perkara. Pembanding 1×24 jam memakai tanggal "
               "pendaftaran dan waktu pembuatan catatan perkara di SIPP. Ini mengukur jeda pencatatan, "
               "bukan waktu sejak berkas diterima; tanggal surat bukan waktu penerimaan. "
               "Tanggal pendaftaran tidak menyimpan jam."),
        mode="date24",
    ),
    "evidence": dict(
        sql="""
            SELECT p.nomor_perkara, p.tanggal_pendaftaran AS event_at,
                   (SELECT MIN(b.tanggal_penerimaan) FROM perkara_barang_bukti b
                    WHERE b.perkara_id=p.perkara_id AND b.tanggal_penerimaan > '1000-01-01'
                      AND NULLIF(TRIM(b.jenis_barang_bukti), '') IS NOT NULL) AS comparison_at,
                   (EXISTS (SELECT 1 FROM perkara_barang_bukti b WHERE b.perkara_id=p.perkara_id
                            AND NULLIF(TRIM(b.jenis_barang_bukti), '') IS NOT NULL)
                    OR EXISTS (SELECT 1 FROM perkara_barang_bukti_perdata b WHERE b.perkara_id=p.perkara_id
                               AND NULLIF(TRIM(b.jenis_barang_bukti), '') IS NOT NULL)) AS present,
                   'Tanggal pendaftaran' AS event_label,
                   'Tanggal penerimaan barang bukti pidana tercatat' AS comparison_label
            FROM perkara p
            WHERE p.tanggal_pendaftaran >= %s AND p.tanggal_pendaftaran < %s
              AND (p.alur_perkara_id IN (111, 113, 116, 118)
                   OR EXISTS (SELECT 1 FROM perkara_barang_bukti b WHERE b.perkara_id=p.perkara_id)
                   OR EXISTS (SELECT 1 FROM perkara_barang_bukti_perdata b WHERE b.perkara_id=p.perkara_id))
        """,
        basis=("Periode menurut pendaftaran. Cakupan lokal: alur pidana dengan riwayat pencatatan "
               "di SIPP (biasa, cepat, perikanan, anak sesuai kode alur) dan perkara lain jika sudah "
               "punya baris barang bukti pidana atau perdata. Yang diperiksa hanya keberadaan isian jenis "
               "barang bukti, bukan isi atau kelengkapannya. Tanggal penerimaan bukan waktu input; "
               "catatan kosong tidak membuktikan bahwa barang bukti wajib ada dalam perkara itu."),
        mode="presence",
    ),
}

_FIRST_JUDGE_DATE = """(
    SELECT MIN(h.tanggal_penetapan) FROM perkara_hakim_pn h
    WHERE h.perkara_id=p.perkara_id AND h.tahapan_id=10 AND h.hakim_id > 0
      AND h.tanggal_penetapan > '1000-01-01'
)"""

# EIS hanya menilai penetapan jurusita untuk perkara perdata.
_CIVIL_ONLY = " AND p.nomor_perkara REGEXP '/Pdt[.]|/Pdt/'"

_PENETAPAN_COLUMNS = {
    "judge": "penetapan_majelis_hakim",
    "clerk": "penetapan_panitera_pengganti",
    "bailiff": "penetapan_jurusita",
    "hearing": "penetapan_hari_sidang",
}

for key, table, phase, reference, label in _APPOINTMENTS:
    # The identifier checks distinguish actual assignments/orders from empty rows.
    acuan = "p.tanggal_pendaftaran" if key == "judge" else _FIRST_JUDGE_DATE
    acuan_label = "Tanggal pendaftaran" if key == "judge" else "Penetapan majelis/hakim pertama"
    end_label = f"Tanggal penetapan {label}"
    scope = "hari sidang pertama" if key == "hearing" else f"{label} pertama"
    condition = f"a.tahapan_id={phase} AND a.{reference} > 0"
    if key == "bailiff":
        condition += _CIVIL_ONLY
    appoint_condition = condition + (" AND p.alur_perkara_id <> 118" if key == "hearing" else "")
    RULES[f"{key}-appoint"] = dict(
        sql=f"""
            SELECT p.nomor_perkara, {acuan} AS event_at, a.tanggal_penetapan AS comparison_at,
                   3 AS limit_days, '{acuan_label}' AS event_label,
                   'Penetapan {scope}' AS comparison_label
            FROM perkara p JOIN {table} a ON a.perkara_id=p.perkara_id
            WHERE a.tanggal_penetapan >= %s AND a.tanggal_penetapan < %s
              AND {appoint_condition}
              AND NOT EXISTS (
                  SELECT 1 FROM {table} earlier WHERE earlier.perkara_id=a.perkara_id
                    AND earlier.tahapan_id={phase} AND earlier.{reference} > 0
                    AND earlier.tanggal_penetapan > '1000-01-01'
                    AND earlier.tanggal_penetapan < a.tanggal_penetapan
              )
            GROUP BY p.perkara_id, p.nomor_perkara, event_at, a.tanggal_penetapan
        """,
        basis=(f"Periode berdasarkan tanggal penetapan {scope}" + (" (non-anak)" if key == "hearing" else "") +
               " yang tercatat di SIPP. Satu baris per perkara; penetapan ulang dan anggota majelis tidak dihitung lagi. "
               f"Pembanding lokal: maksimal 3 hari kalender dari {acuan_label.lower()}. "
               "Penetapan tanpa tanggal tidak bisa ditempatkan dalam periode."),
        mode="days",
    )
    input_condition = condition + ("" if key == "hearing" else " AND a.aktif='Y'")
    input_group = f"GROUP BY a.id, p.perkara_id, p.nomor_perkara" if key == "hearing" else "GROUP BY p.perkara_id, p.nomor_perkara"
    input_basis = (
        f"Periode menurut tanggal penetapan {label}; setiap penetapan (termasuk penetapan kembali) "
        "dihitung per baris. Pembanding 1×24 jam memakai waktu input catatan; tanggal penetapan tidak menyimpan jam."
        if key == "hearing" else
        f"Periode menurut tanggal penetapan {label} yang berstatus aktif (aktif='Y'). Pembanding 1×24 jam memakai "
        "waktu pembuatan catatan paling awal untuk setiap perkara; baris pada tanggal yang sama dihitung sekali. "
        "Tanggal penetapan tidak menyimpan jam."
    )
    RULES[f"{key}-input"] = dict(
        sql=f"""
            SELECT p.nomor_perkara, MIN(a.tanggal_penetapan) AS event_at,
                   MIN(CASE WHEN a.diinput_tanggal > '1000-01-01' THEN a.diinput_tanggal END) AS comparison_at,
                   '{end_label}' AS event_label, 'Waktu input pertama di SIPP' AS comparison_label
            FROM perkara p JOIN {table} a ON a.perkara_id=p.perkara_id
            WHERE a.tanggal_penetapan >= %s AND a.tanggal_penetapan < %s
              AND {input_condition}
            {input_group}
            ORDER BY event_at, p.perkara_id
        """,
        basis=input_basis,
        mode="date24_or_present",
    )
