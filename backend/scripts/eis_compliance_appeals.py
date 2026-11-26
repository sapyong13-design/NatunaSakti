"""Read-only local SIPP audit rules for upaya hukum."""

# These are workflow codes from alur_perkara, not free text or case subjects.
_PIDANA = "a.kode REGEXP '^Pid[.]'"
_PERDATA = "a.kode REGEXP '^Pdt[.]'"
_BASIS = 'Surat Badilum 478/DJU/TI.1.1/III/2024'


def _rule(sql, basis, mode='days'):
    return {'sql': sql, 'basis': basis, 'mode': mode}


def _input_request(stage, label, process_id=None):
    if process_id is None:
        recorded_at = "CASE WHEN h.diinput_tanggal >= '1000-01-01' THEN h.diinput_tanggal END"
        source = 'waktu pembuatan baris permohonan di SIPP'
    else:
        recorded_at = f'''(SELECT MIN(x.diinput_tanggal) FROM perkara_proses x
            WHERE x.perkara_id=h.perkara_id AND x.proses_id={process_id}
              AND x.tanggal=h.permohonan_{stage} AND x.diinput_tanggal >= '1000-01-01')'''
        source = 'waktu input paling awal pada log proses dengan tanggal permohonan yang sama'
    return _rule(f"""SELECT p.nomor_perkara,h.permohonan_{stage} AS event_at,
        {recorded_at} AS comparison_at,
        'Tanggal permohonan {label}' AS event_label,'Waktu input awal' AS comparison_label
        FROM perkara_{stage} h JOIN perkara p ON p.perkara_id=h.perkara_id
        WHERE h.permohonan_{stage} >= %s AND h.permohonan_{stage} < %s
        ORDER BY h.permohonan_{stage},p.perkara_id""",
        f'Permohonan {label} pada bulan terpilih dibandingkan dengan {source}. '
        f'Batas 1×24 jam ({_BASIS}); tanggal permohonan tidak menyimpan jam. '
        'Jika tidak ada waktu input, ketepatan waktu tidak dapat dinilai.', 'date24')


def _receipt(stage, label, column, receipt_label):
    return _rule(f"""SELECT p.nomor_perkara,h.permohonan_{stage} AS event_at,
        CASE WHEN h.{column} >= '1000-01-01' THEN h.{column} END AS comparison_at,
        IF(h.{column} >= '1000-01-01',1,0) AS present,
        'Tanggal permohonan {label}' AS event_label,'Tanggal penerimaan {receipt_label}' AS comparison_label
        FROM perkara_{stage} h JOIN perkara p ON p.perkara_id=h.perkara_id
        WHERE h.permohonan_{stage} >= %s AND h.permohonan_{stage} < %s
        ORDER BY h.permohonan_{stage},p.perkara_id""",
        f'Permohonan {label} pada bulan terpilih tetap ditampilkan jika tanggal penerimaan '
        f'{receipt_label} belum tercatat. Indikator ini memeriksa ketersediaan '
        f'pencatatan, bukan tenggat atau kewajiban pihak untuk menyerahkan dokumen ({_BASIS}).', 'presence')


RULES = {
    'banding-input': _input_request('banding', 'banding', 300),
    'kasasi-input': _input_request('kasasi', 'kasasi', 410),
    'pk-input': _input_request('pk', 'PK'),
    'banding-notice': _rule("""SELECT p.nomor_perkara,h.permohonan_banding AS event_at,
        COALESCE(
            CASE WHEN h.pemberitahuan_permohonan_banding >= '1000-01-01' THEN h.pemberitahuan_permohonan_banding END,
            (SELECT MIN(x.tanggal) FROM perkara_proses x WHERE x.perkara_id=h.perkara_id AND x.proses_id=301 AND x.tanggal >= '1000-01-01')
        ) AS comparison_at,7 AS limit_days,
        'Tanggal permohonan banding' AS event_label,'Tanggal pemberitahuan permohonan' AS comparison_label
        FROM perkara_banding h JOIN perkara p ON p.perkara_id=h.perkara_id
        WHERE h.permohonan_banding >= %s AND h.permohonan_banding < %s
          AND COALESCE(
            CASE WHEN h.pemberitahuan_permohonan_banding >= '1000-01-01' THEN h.pemberitahuan_permohonan_banding END,
            (SELECT MIN(x.tanggal) FROM perkara_proses x WHERE x.perkara_id=h.perkara_id AND x.proses_id=301 AND x.tanggal >= '1000-01-01')
          ) IS NOT NULL
        ORDER BY h.permohonan_banding,p.perkara_id""",
        f'Permohonan banding pada bulan terpilih yang memiliki tanggal pemberitahuan (register banding atau proses 301). '
        f'Batas 7 hari kalender dari permohonan banding ({_BASIS}).'),
    'banding-inzage': _rule("""SELECT p.nomor_perkara,h.permohonan_banding AS event_at,
        h.pemberitahuan_inzage AS comparison_at,7 AS limit_days,
        'Tanggal permohonan banding' AS event_label,'Tanggal pemberitahuan inzage' AS comparison_label
        FROM perkara_banding h JOIN perkara p ON p.perkara_id=h.perkara_id
        WHERE h.pemberitahuan_inzage >= %s AND h.pemberitahuan_inzage < %s
        ORDER BY h.pemberitahuan_inzage,p.perkara_id""",
        f'Pemberitahuan inzage pada bulan terpilih; batas 7 hari kerja sejak permohonan banding ({_BASIS}).', 'businessdays'),
    'banding-send': _rule(f"""SELECT p.nomor_perkara,h.permohonan_banding AS event_at,
        COALESCE(
            CASE WHEN h.pengiriman_berkas_banding >= '1000-01-01' THEN h.pengiriman_berkas_banding END,
            CASE WHEN h.tanggal_kirim >= '1000-01-01' THEN DATE(h.tanggal_kirim) END
        ) AS comparison_at,
        CASE WHEN {_PIDANA} THEN 17 WHEN {_PERDATA} THEN 30 END AS limit_days,
        'Tanggal permohonan banding' AS event_label,'Tanggal pengiriman berkas ke PT' AS comparison_label
        FROM perkara_banding h JOIN perkara p ON p.perkara_id=h.perkara_id
        LEFT JOIN alur_perkara a ON a.id=p.alur_perkara_id
        WHERE COALESCE(
            CASE WHEN h.pengiriman_berkas_banding >= '1000-01-01' THEN h.pengiriman_berkas_banding END,
            CASE WHEN h.tanggal_kirim >= '1000-01-01' THEN DATE(h.tanggal_kirim) END
        ) >= %s
          AND COALESCE(
            CASE WHEN h.pengiriman_berkas_banding >= '1000-01-01' THEN h.pengiriman_berkas_banding END,
            CASE WHEN h.tanggal_kirim >= '1000-01-01' THEN DATE(h.tanggal_kirim) END
        ) < %s
        ORDER BY comparison_at,p.perkara_id""",
        f'Pengiriman ke PT pada bulan terpilih (pengiriman_berkas_banding atau tanggal_kirim). '
        f'Surat {_BASIS} menyebut 14 hari pidana / 30 hari perdata; EIS Jan–Nov 2026 menerima hingga 17 hari kalender untuk pidana.'),
    'kasasi-notice': _rule(f"""SELECT p.nomor_perkara,h.permohonan_kasasi AS event_at,
        h.pemberitahuan_kasasi AS comparison_at,
        CASE WHEN {_PIDANA} THEN 2 WHEN {_PERDATA} THEN 7 END AS limit_days,
        'Tanggal permohonan kasasi' AS event_label,'Tanggal pemberitahuan permohonan' AS comparison_label
        FROM perkara_kasasi h JOIN perkara p ON p.perkara_id=h.perkara_id
        LEFT JOIN alur_perkara a ON a.id=p.alur_perkara_id
        WHERE h.pemberitahuan_kasasi >= %s AND h.pemberitahuan_kasasi < %s
        ORDER BY h.pemberitahuan_kasasi,p.perkara_id""",
        f'Pemberitahuan dalam bulan terpilih diukur sejak permohonan kasasi: 2 hari kerja pidana '
        f'dan 7 hari kerja perdata ({_BASIS}). Golongan ditentukan dari kode alur SIPP.', 'businessdays'),
    'kasasi-memory': _receipt('kasasi', 'kasasi', 'penerimaan_memori_kasasi', 'memori kasasi'),
    'kasasi-deliver': _rule("""SELECT p.nomor_perkara,
        CASE WHEN h.penerimaan_memori_kasasi >= '1000-01-01' THEN h.penerimaan_memori_kasasi END AS event_at,
        h.penyerahan_memori_kasasi AS comparison_at,
        14 AS limit_days,'Tanggal penerimaan memori kasasi' AS event_label,
        'Tanggal penyerahan memori kepada termohon' AS comparison_label
        FROM perkara_kasasi h JOIN perkara p ON p.perkara_id=h.perkara_id
        WHERE h.penyerahan_memori_kasasi >= %s AND h.penyerahan_memori_kasasi < %s
        ORDER BY h.penyerahan_memori_kasasi,p.perkara_id""",
        f'Penyerahan memori kasasi kepada termohon pada bulan terpilih; dibatasi 14 hari sejak penerimaan ({_BASIS}). '
        'Jika tanggal penerimaan memori tidak tercatat, ketepatan waktu tidak dapat dinilai.'),
    'kasasi-send': _rule("""SELECT p.nomor_perkara,h.permohonan_kasasi AS event_at,
        h.pengiriman_berkas_kasasi AS comparison_at,65 AS limit_days,
        'Tanggal permohonan kasasi' AS event_label,'Tanggal pengiriman berkas ke MA' AS comparison_label
        FROM perkara_kasasi h JOIN perkara p ON p.perkara_id=h.perkara_id
        WHERE h.pengiriman_berkas_kasasi >= %s AND h.pengiriman_berkas_kasasi < %s
        ORDER BY h.pengiriman_berkas_kasasi,p.perkara_id""",
        f'Pengiriman berkas kasasi ke MA pada bulan terpilih. Batas audit 65 hari ({_BASIS}) '
        'dihitung sejak permohonan kasasi, bukan tanggal registrasi di MA.'),
    'pk-notice': _rule("""SELECT p.nomor_perkara,h.permohonan_pk AS event_at,
        h.pemberitahuan_pk AS comparison_at,14 AS limit_days,
        'Tanggal permohonan PK' AS event_label,'Tanggal pemberitahuan permohonan PK' AS comparison_label
        FROM perkara_pk h JOIN perkara p ON p.perkara_id=h.perkara_id
        WHERE h.pemberitahuan_pk >= %s AND h.pemberitahuan_pk < %s
        ORDER BY h.pemberitahuan_pk,p.perkara_id,h.id""",
        f'Pemberitahuan dalam bulan terpilih diukur sejak permohonan PK, batas 14 hari ({_BASIS}).'),
    'pk-memory': _receipt('pk', 'PK', 'penerimaan_memori_pk', 'memori PK'),
    'pk-counter': _receipt('pk', 'PK', 'penerimaan_kontra_pk', 'kontra memori PK'),
    'pk-send': _rule(f"""SELECT p.nomor_perkara,
        CASE WHEN h.pemeriksaan_pk >= '1000-01-01' THEN h.pemeriksaan_pk END AS event_at,
        h.pengiriman_berkas_pk AS comparison_at,
        CASE WHEN {_PIDANA} THEN 30 END AS limit_days,
        'Tanggal pemeriksaan persidangan PK' AS event_label,'Tanggal pengiriman berkas ke MA' AS comparison_label
        FROM perkara_pk h JOIN perkara p ON p.perkara_id=h.perkara_id
        LEFT JOIN alur_perkara a ON a.id=p.alur_perkara_id
        WHERE h.pengiriman_berkas_pk >= %s AND h.pengiriman_berkas_pk < %s
        ORDER BY h.pengiriman_berkas_pk,p.perkara_id,h.id""",
        f'Pengiriman berkas PK ke MA pada bulan terpilih. Batas 30 hari sejak pemeriksaan '
        f'persidangan hanya untuk pidana ({_BASIS}). Perkara lain atau PK tanpa tanggal '
        'pemeriksaan tetap ditampilkan, tetapi tenggatnya tidak dinilai.'),
}
