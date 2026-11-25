"""Read SIPP through dedicated SSH/DB accounts. Emit JSON only; never SQL from input."""
import ctypes
from ctypes import wintypes
from datetime import date, datetime, timedelta
from decimal import Decimal
import json
import os
from pathlib import Path
import sys

import paramiko
import pymysql


class Blob(ctypes.Structure):
    _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_byte))]


def credentials():
    path = Path(os.environ["LOCALAPPDATA"]) / "NatunaSakti" / "access" / "credentials.dpapi"
    encrypted = path.read_bytes()
    buffer = ctypes.create_string_buffer(encrypted)
    source = Blob(len(encrypted), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)))
    result = Blob()
    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result)
    ):
        raise ctypes.WinError()
    try:
        config = json.loads(ctypes.string_at(result.data, result.size))
    finally:
        ctypes.windll.kernel32.LocalFree(result.data)
    if (config["ssh_user"], config["db_user"], config["db_host"], config["db_port"], config["db_database"]) != (
        "natunasakti_tunnel", "natunasakti_ro", "127.0.0.1", 3306, "sipp32"
    ):
        raise ValueError("Dedicated restricted SIPP accounts required")
    return config


def encode(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, timedelta):
        seconds = int(value.total_seconds())
        sign = '-' if seconds < 0 else ''
        hours, remainder = divmod(abs(seconds), 3600)
        minutes, seconds = divmod(remainder, 60)
        return f'{sign}{hours:02}:{minutes:02}:{seconds:02}'
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError("Unsupported DB value")


def read_eis_audit(cursor, kind, start, end):
    if kind == 'witness':
        cursor.execute("""
            SELECT w.id,w.perkara_id,p.nomor_perkara,w.nama,w.jenis_saksi,w.diinput_tanggal,
                w.urutan > 0 AS has_order,w.saksi_pihak_ke > 0 AS has_side,
                w.jenis_pihak_id > 0 AS has_party_type,
                EXISTS(SELECT 1 FROM pihak x WHERE x.id=w.pihak_id) AS has_party,
                TRIM(COALESCE(w.alamat,'')) <> '' AS has_address,
                COUNT(k.id) AS qa_count,
                SUM(CASE WHEN k.id IS NOT NULL AND TRIM(COALESCE(k.pertanyaan,'')) <> ''
                    AND TRIM(COALESCE(k.jawaban,'')) <> '' THEN 1 ELSE 0 END) AS qa_complete
            FROM perkara_pihak5 w
            JOIN perkara p ON p.perkara_id=w.perkara_id
            LEFT JOIN perkara_keterangan_saksi k ON k.perkara_id=w.perkara_id AND k.saksi_id=w.id
            WHERE w.diinput_tanggal >= %s AND w.diinput_tanggal < %s
            GROUP BY w.id,w.perkara_id,p.nomor_perkara,w.nama,w.jenis_saksi,w.diinput_tanggal,
                w.urutan,w.saksi_pihak_ke,w.jenis_pihak_id,w.pihak_id,w.alamat
            ORDER BY w.diinput_tanggal,w.id
        """, (start, end))
        entries = cursor.fetchall()
        cursor.execute("""
            SELECT MIN(j.id) AS id,p.perkara_id,p.nomor_perkara,MIN(j.tanggal_sidang) AS tanggal_sidang,
                MIN(j.agenda) AS agenda,
                (SELECT COUNT(*) FROM perkara_pihak5 w WHERE w.perkara_id=p.perkara_id) AS witness_count,
                (SELECT COUNT(*) FROM perkara_pihak5 w WHERE w.perkara_id=p.perkara_id
                    AND TRIM(COALESCE(w.nama,'')) <> '') AS named_count
            FROM perkara_jadwal_sidang j JOIN perkara p ON p.perkara_id=j.perkara_id
            WHERE j.tanggal_sidang >= %s AND j.tanggal_sidang < %s
                AND LOWER(j.agenda) REGEXP '[[:<:]]saksi[[:>:]]'
            GROUP BY p.perkara_id,p.nomor_perkara
            ORDER BY tanggal_sidang,p.nomor_perkara
        """, (start, end))
        return {'entries': entries, 'hearings': cursor.fetchall()}
    else:
        cursor.execute("""
            SELECT j.id,j.perkara_id,p.nomor_perkara,j.tanggal_sidang,j.agenda,
                CASE WHEN TRIM(COALESCE(j.edoc_bas,'')) IN ('','0','-') THEN 'empty'
                     WHEN TRIM(j.edoc_bas) REGEXP '[.][[:alnum:]]{2,5}$' THEN 'registered'
                     ELSE 'unknown' END AS upload_state,
                NULLIF(TRIM(COALESCE(j.edoc_bas,'')),'') AS doc_path,
                EXISTS(SELECT 1 FROM template_perkara_bas b WHERE b.perkara_id=j.perkara_id
                    AND b.sidang_id=j.id AND TRIM(COALESCE(b.isian,'')) <> '') AS has_template_content,
                EXISTS(SELECT 1 FROM perkara_jadwal_sidang_detil d WHERE d.perkara_id=j.perkara_id
                    AND d.sidang_id=j.id AND TRIM(COALESCE(d.uraian,'')) <> '') AS has_hearing_detail,
                EXISTS(SELECT 1 FROM template_perkara_bas_detil_tanya_jawab b WHERE b.perkara_id=j.perkara_id
                    AND b.sidang_id=j.id AND (TRIM(COALESCE(b.pertanyaan_t,'')) <> ''
                    OR TRIM(COALESCE(b.jawaban_t,'')) <> '')) AS has_template_qa,
                EXISTS(SELECT 1 FROM template_perkara_bas_penutup b WHERE b.perkara_id=j.perkara_id
                    AND b.sidang_id=j.id AND TRIM(COALESCE(b.redaksi,'')) <> '') AS has_template_closing
            FROM perkara_jadwal_sidang j JOIN perkara p ON p.perkara_id=j.perkara_id
            WHERE j.tanggal_sidang >= %s AND j.tanggal_sidang < %s
            ORDER BY j.tanggal_sidang,j.id
        """, (start, end))
    return cursor.fetchall()


def audit_bounds(period, cutoff=None):
    if len(period) != 7 or period[4] != '-' or not (period[:4] + period[5:]).isascii() or not (period[:4] + period[5:]).isdigit():
        raise ValueError('Invalid audit period')
    start = date.fromisoformat(period + '-01')
    end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    if cutoff is not None:
        limit = date.fromisoformat(cutoff) + timedelta(days=1)
        end = min(end, limit)
    return start.isoformat(), end.isoformat()

def read_snapshot(nomor=None, schema_only=False, audit=None, compliance=None):
    config = credentials()
    ssh = paramiko.SSHClient()
    ssh.load_host_keys(str(Path.home() / ".ssh" / "known_hosts"))
    ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
    db = None
    try:
        key = paramiko.Ed25519Key.from_private_key_file(
            config["ssh_key_path"], password=config["ssh_key_passphrase"]
        )
        ssh.connect(
            config["ssh_host"], port=config["ssh_port"], username=config["ssh_user"],
            pkey=key, look_for_keys=False, allow_agent=False, timeout=10, auth_timeout=10,
        )
        channel = ssh.get_transport().open_channel(
            "direct-tcpip", (config["db_host"], config["db_port"]), ("127.0.0.1", 0), timeout=10
        )
        db = pymysql.connect(
            user=config["db_user"], password=config["db_password"],
            database=config["db_database"], charset="utf8mb4", defer_connect=True,
            autocommit=False, read_timeout=30, write_timeout=10,
            cursorclass=pymysql.cursors.DictCursor,
        )
        db.connect(sock=channel)
        # MariaDB 5.5 has no READ ONLY transaction modifier; the account grants
        # enforce read-only access. This reader issues fixed SELECTs only.
        with db.cursor() as cursor:
            cursor.execute("START TRANSACTION WITH CONSISTENT SNAPSHOT")
            if compliance is not None:
                rule, start, end = compliance
                if rule.get('params', True):
                    cursor.execute(rule['sql'], (start, end))
                else:
                    cursor.execute(rule['sql'])
                result = {'basis': rule['basis'], 'mode': rule['mode'], 'rows': cursor.fetchall()}
                db.rollback()
                return result
            if audit is not None:
                rows = read_eis_audit(cursor, *audit)
                db.rollback()
                return rows
            if schema_only:
                cursor.execute(
                    "SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name,"
                    "COLUMN_TYPE AS column_type,IS_NULLABLE AS is_nullable "
                    "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() "
                    "ORDER BY TABLE_NAME,ORDINAL_POSITION"
                )
                columns = cursor.fetchall()
                db.rollback()
                return columns
            where = " WHERE nomor_perkara=%s" if nomor else ""
            params = (nomor,) if nomor else ()
            cursor.execute(
                "SELECT perkara_id,nomor_perkara,tanggal_pendaftaran,jenis_perkara_nama,"
                "pihak1_text,pihak2_text,pihak3_text,pihak4_text,para_pihak,pihak_dipublikasikan,"
                "tahapan_terakhir_text,proses_terakhir_text FROM perkara" + where + " ORDER BY perkara_id",
                params,
            )
            perkara = cursor.fetchall()
            queries = {
                "jadwal": "SELECT j.perkara_id,j.id,j.tanggal_sidang,j.jam_sidang,j.sampai_jam,j.agenda,j.ruangan,j.alasan_ditunda FROM perkara_jadwal_sidang j",
                "putusan": "SELECT j.perkara_id,j.tanggal_putusan,j.status_putusan_nama,j.status_putusan_text,j.amar_putusan,j.tanggal_minutasi,j.tanggal_bht FROM perkara_putusan j",
                "terdakwa": "SELECT j.perkara_id,j.id,j.tanggal_putusan,j.status_putusan_text,j.durasi_nominal,j.satuan,j.keterangan_putusan FROM perkara_putusan_terdakwa j",
            }
            queries["hakim"] = "SELECT j.id,j.perkara_id,j.tahapan_id,j.tanggal_penetapan,j.urutan,j.jabatan_hakim_id,j.jabatan_hakim_nama,j.hakim_id,j.hakim_nama,j.aktif,j.tanggal_tidak_aktif,j.diganti_oleh_id FROM sipp32.perkara_hakim_pn j"
            result = {"perkara": perkara}
            for name, query in queries.items():
                if nomor:
                    query += " INNER JOIN perkara p ON p.perkara_id=j.perkara_id WHERE p.nomor_perkara=%s"
                query += " ORDER BY j.perkara_id"
                if name == "jadwal":
                    query += ",j.tanggal_sidang,j.id"
                cursor.execute(query, params)
                result[name] = cursor.fetchall()
        db.rollback()
        return result
    finally:
        if db is not None:
            db.close()
        ssh.close()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        if sys.argv[1:] == ['--schema']:
            json.dump(read_snapshot(schema_only=True), sys.stdout, ensure_ascii=False)
            sys.exit(0)
        if len(sys.argv) == 4 and sys.argv[1] == '--eis-audit' and sys.argv[2] in ('witness', 'bas'):
            audit = (sys.argv[2], *audit_bounds(sys.argv[3]))
            json.dump(read_snapshot(audit=audit), sys.stdout, ensure_ascii=False, default=encode)
            sys.exit(0)
        if len(sys.argv) in (4, 5) and sys.argv[1] == '--eis-compliance':
            from eis_compliance_appeals import RULES as appeals
            from eis_compliance_casework import RULES as casework
            from eis_compliance_events import RULES as events
            from eis_compliance_fit import RULES as fit
            from eis_compliance_kinerja import RULES as kinerja
            rule = (appeals | casework | events | fit | kinerja)[sys.argv[2]]
            cutoff = sys.argv[4] if len(sys.argv) == 5 else None
            json.dump(read_snapshot(compliance=(rule, *audit_bounds(sys.argv[3], cutoff))),
                      sys.stdout, ensure_ascii=False, default=encode)
            sys.exit(0)
        if sys.argv[1:]:
            raise ValueError('Unsupported argument')
        request = json.load(sys.stdin)
        nomor = request.get("nomor")
        if nomor is not None and (not isinstance(nomor, str) or not 1 <= len(nomor) <= 250):
            raise ValueError("Invalid perkara number")
        json.dump(read_snapshot(nomor), sys.stdout, ensure_ascii=False, default=encode)
    except Exception as error:
        # Keep credentials and potentially sensitive server error text out of API/logs.
        print("SIPP DB read failed (" + type(error).__name__ + ")", file=sys.stderr)
        sys.exit(1)
