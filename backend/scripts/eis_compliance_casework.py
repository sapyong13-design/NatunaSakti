"""Fixed read-only SIPP queries for casework (no document bodies, users, or paths)."""


def rule(sql, basis, mode='evidence'):
    return {'sql': sql, 'basis': basis, 'mode': mode}


def process_input(code, name):
    return rule(f"""SELECT p.nomor_perkara,x.tanggal AS event_at,x.diinput_tanggal AS comparison_at,
        '{name}' AS event_label,'Waktu input proses' AS comparison_label
        FROM perkara_proses x JOIN perkara p USING(perkara_id)
        WHERE x.proses_id={code} AND x.tanggal >= %s AND x.tanggal < %s
        ORDER BY x.tanggal,p.perkara_id""",
        f'{name} bulan terpilih pada log proses SIPP. Batas 1×24 jam; tanggal tanpa jam dapat membuat hasil tidak pasti.', 'date24')


def audited_event(table, form, action, source, key, date, name, *, grouped=False):
    id_from_title = "CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(a.title,'[id=',-1),']',1) AS UNSIGNED)"
    timestamp = 'MIN(a.datetime)' if grouped else 'a.datetime'
    group = f'GROUP BY p.nomor_perkara,x.{key},x.{date}' if grouped else ''
    change = "AND a.description LIKE '%<td>ditunda</td><td>Y</td>%'" if not grouped else ''
    return rule(f"""SELECT p.nomor_perkara,x.{date} AS event_at,{timestamp} AS comparison_at,
        '{name}' AS event_label,'Waktu tercatat di audit SIPP' AS comparison_label
        FROM sys_audittrail a JOIN {source} x ON x.{key}={id_from_title}
        JOIN perkara p ON p.perkara_id=x.perkara_id
        WHERE a.tablename='{table}' AND a.formname='{form}' AND a.action='{action}'
          AND a.title REGEXP '[[]id=[0-9]+[]]$' AND a.datetime >= %s AND a.datetime < %s
          {change.replace('%', '%%')}
        {group} ORDER BY comparison_at,p.nomor_perkara""",
        f'{name} dibandingkan dengan '+ ('log pertama pada bulan terpilih' if grouped else 'setiap log pada bulan terpilih') +
        '. Batas 1×24 jam. Tanggal SIPP adalah data saat ini; log tidak membuktikan unggahan pertama sepanjang riwayat atau penerimaan MIS.', 'date24')

RULES = {
    'charge-input': rule("""SELECT p.nomor_perkara,x.tanggal_penuntutan AS event_at,x.diinput_tanggal AS comparison_at,
        'Tanggal tuntutan' AS event_label,'Waktu input tuntutan' AS comparison_label
        FROM perkara_penuntutan x JOIN perkara p USING(perkara_id)
        WHERE x.tanggal_penuntutan >= %s AND x.tanggal_penuntutan < %s
        ORDER BY x.tanggal_penuntutan,p.perkara_id""",
        'Tanggal tuntutan lokal dibandingkan waktu input awal, batas 1×24 jam.', 'date24'),
    'decision-input': process_input(210, 'Tanggal putusan'),
    'minutasi-input': process_input(220, 'Tanggal minutasi'),
    'minutasi-run': rule("""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,x.tanggal_minutasi AS comparison_at,
        CASE WHEN p.nomor_perkara REGEXP '/Pid[.]|/Pid/|/PRK/' THEN 7
             WHEN p.nomor_perkara REGEXP '/Pdt[.]|/Pdt/' THEN 14 ELSE NULL END AS limit_days,
        'Tanggal putusan' AS event_label,'Tanggal minutasi' AS comparison_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        WHERE x.tanggal_putusan >= %s AND x.tanggal_putusan < %s ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Putusan bulan terpilih; batas lokal 7 hari pidana dan 14 hari perdata, dihitung dalam hari kalender. Tanggal minutasi kosong bukan bukti terlambat.', 'days'),
    'decision-notice': process_input(218, 'Tanggal pemberitahuan putusan'),
    'delegation-input': rule("""SELECT COALESCE(p.nomor_perkara,d.nomor_perkara) AS nomor_perkara,
        x.tgl_relaas AS event_at,x.diinput_tanggal AS comparison_at,
        'Tanggal relaas delegasi masuk' AS event_label,'Waktu input awal proses delegasi' AS comparison_label
        FROM delegasi_proses_masuk x JOIN delegasi_masuk d ON d.id=x.delegasi_id
        LEFT JOIN perkara p ON p.perkara_id=d.perkara_id AND p.nomor_perkara=d.nomor_perkara
        WHERE x.tgl_relaas >= %s AND x.tgl_relaas < %s ORDER BY x.tgl_relaas,d.id""",
        'Relaas delegasi masuk pada bulan terpilih. Timestamp pembuatan baris proses tidak membuktikan kapan relaas diinput, sehingga hanya menjadi bukti pembanding.'),
    'adjournment-input': audited_event('perkara_jadwal_sidang', 'PENUNDAAN JADWAL SIDANG', 'UPDATE',
        'perkara_jadwal_sidang', 'id', 'tanggal_sidang', 'Tanggal sidang yang ditunda'),
    'detention-input': rule("""SELECT p.nomor_perkara,x.tanggal_surat AS event_at,x.diinput_tanggal AS comparison_at,
        'Tanggal surat perpanjangan' AS event_label,'Waktu input awal penahanan' AS comparison_label
        FROM penahanan_terdakwa x JOIN perkara p USING(perkara_id) JOIN jenis_penahanan j ON j.id=x.jenis_penahanan_id
        WHERE j.nama REGEXP '^Hakim PN.*Perpanjangan' AND x.tanggal_surat >= %s AND x.tanggal_surat < %s
        ORDER BY x.tanggal_surat,x.id""",
        'Surat perpanjangan dengan jenis penahanan Hakim PN. Tanggal surat tidak selalu sama dengan tanggal penetapan yang dipakai EIS; tidak disimpulkan kepatuhan 24 jam.'),
    'decision-upload': audited_event('perkara_putusan', 'UPLOAD E-DOCS PUTUSAN AKHIR', 'UNGGAH',
        'perkara_putusan', 'perkara_id', 'tanggal_putusan', 'Tanggal putusan akhir', grouped=True),
}

for key, case_pattern in [('tte-civil', '/Pdt[.]|/Pdt/'), ('tte-criminal', '/Pid[.]|/Pid/|/PRK/')]:
    RULES[key] = rule(f"""SELECT p.nomor_perkara,x.tanggal_putusan AS event_at,
        x.penerbitan_salinan_putusan AS comparison_at,
        'Tanggal putusan' AS event_label,'Tanggal penerbitan salinan' AS comparison_label
        FROM perkara_putusan x JOIN perkara p USING(perkara_id)
        WHERE p.nomor_perkara REGEXP '{case_pattern}' AND x.tanggal_putusan >= %s AND x.tanggal_putusan < %s
        ORDER BY x.tanggal_putusan,p.perkara_id""",
        'Tanggal penerbitan salinan dari SIPP bukan timestamp tanda tangan elektronik. Status TTE 1×24 jam tidak dapat dipastikan dari kolom ini.')
