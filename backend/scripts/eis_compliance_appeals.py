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
        h.pemberitahuan_permohonan_banding AS comparison_at,7 AS limit_days,
        'Tanggal permohonan banding' AS event_label,'Tanggal pemberitahuan permohonan' AS comparison_label
        FROM perkara_banding h JOIN perkara p ON p.perkara_id=h.perkara_id
        WHERE h.pemberitahuan_permohonan_banding >= %s AND h.pemberitahuan_permohonan_banding < %s
        ORDER BY h.pemberitahuan_permohonan_banding,p.perkara_id""",
        f'Pemberitahuan permohonan banding tercatat pada bulan terpilih. Batas 7 hari kalender '
        f'dari permohonan banding ({_BASIS}); yang diperiksa adalah tanggal pada register perkara.'),
    'banding-inzage': _rule("""SELECT p.nomor_perkara,h.permohonan_banding AS event_at,
        x.tanggal AS comparison_at,
        'Tanggal permohonan banding di PN' AS event_label,'Tanggal pemberitahuan inzage' AS comparison_label
        FROM perkara_proses x JOIN perkara_banding h ON h.perkara_id=x.perkara_id
        JOIN perkara p ON p.perkara_id=h.perkara_id
        WHERE x.proses_id=350 AND x.tanggal >= %s AND x.tanggal < %s
        ORDER BY x.tanggal,p.perkara_id""",
        f'Pemberitahuan inzage pada log proses SIPP (bukan pelaksanaan inzage) di bulan terpilih. '
        f'Batas 7 hari disebut sejak pendaftaran perkara ({_BASIS}), tetapi tanggal registrasi banding '
        'di PN yang menjadi acuan tidak dapat dipastikan: tanggal permohonan bukan bukti tanggal '
        'registrasi, sedangkan registrasi di PT terjadi setelah pengiriman. Kedua tanggal yang '
        'tersedia ditampilkan sebagai bukti, tanpa penilaian tenggat.', 'evidence'),
    'banding-send': _rule(f"""SELECT p.nomor_perkara,h.permohonan_banding AS event_at,
        h.pengiriman_berkas_banding AS comparison_at,
        CASE WHEN {_PIDANA} THEN 14 WHEN {_PERDATA} THEN 30 END AS limit_days,
        'Tanggal permohonan banding' AS event_label,'Tanggal pengiriman berkas ke PT' AS comparison_label
        FROM perkara_banding h JOIN perkara p ON p.perkara_id=h.perkara_id
        LEFT JOIN alur_perkara a ON a.id=p.alur_perkara_id
        WHERE h.pengiriman_berkas_banding >= %s AND h.pengiriman_berkas_banding < %s
        ORDER BY h.pengiriman_berkas_banding,p.perkara_id""",
        f'Pengiriman ke PT pada bulan terpilih diukur sejak permohonan banding: 14 hari pidana '
        f'dan 30 hari perdata ({_BASIS}). Tanpa golongan yang dikenali dari kode alur SIPP, '
        'tanggal tetap ditampilkan tanpa penilaian tenggat.'),
    'kasasi-notice': _rule(f"""SELECT p.nomor_perkara,h.permohonan_kasasi AS event_at,
        h.pemberitahuan_kasasi AS comparison_at,
        CASE WHEN {_PIDANA} THEN 2 WHEN {_PERDATA} THEN 7 END AS limit_days,
        'Tanggal permohonan kasasi' AS event_label,'Tanggal pemberitahuan permohonan' AS comparison_label
        FROM perkara_kasasi h JOIN perkara p ON p.perkara_id=h.perkara_id
        LEFT JOIN alur_perkara a ON a.id=p.alur_perkara_id
        WHERE h.pemberitahuan_kasasi >= %s AND h.pemberitahuan_kasasi < %s
        ORDER BY h.pemberitahuan_kasasi,p.perkara_id""",
        f'Pemberitahuan dalam bulan terpilih diukur sejak permohonan kasasi: 2 hari pidana '
        f'dan 7 hari perdata ({_BASIS}). Golongan ditentukan dari kode alur SIPP.'),
    'kasasi-memory': _receipt('kasasi', 'kasasi', 'penerimaan_memori_kasasi', 'memori kasasi'),
    'kasasi-deliver': _rule("""SELECT p.nomor_perkara,h.penerimaan_memori_kasasi AS event_at,
        CASE WHEN h.penyerahan_memori_kasasi >= '1000-01-01' THEN h.penyerahan_memori_kasasi END AS comparison_at,
        14 AS limit_days,'Tanggal penerimaan memori kasasi' AS event_label,
        'Tanggal penyerahan memori kepada termohon' AS comparison_label
        FROM perkara_kasasi h JOIN perkara p ON p.perkara_id=h.perkara_id
        WHERE h.penerimaan_memori_kasasi >= %s AND h.penerimaan_memori_kasasi < %s
        ORDER BY h.penerimaan_memori_kasasi,p.perkara_id""",
        f'Memori kasasi diterima pada bulan terpilih. Penyerahan kepada termohon dibatasi 14 hari '
        f'sejak penerimaan ({_BASIS}). Penyerahan tanpa tanggal tercatat bukan bukti terlambat.'),
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
