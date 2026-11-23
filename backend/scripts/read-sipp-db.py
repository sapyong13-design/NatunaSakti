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


def read_snapshot(nomor=None):
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
        # No remote commands or write SQL. One consistent InnoDB snapshot across five reads.
        with db.cursor() as cursor:
            cursor.execute("START TRANSACTION WITH CONSISTENT SNAPSHOT")
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
        request = json.load(sys.stdin)
        nomor = request.get("nomor")
        if nomor is not None and (not isinstance(nomor, str) or not 1 <= len(nomor) <= 250):
            raise ValueError("Invalid perkara number")
        json.dump(read_snapshot(nomor), sys.stdout, ensure_ascii=False, default=encode)
    except Exception as error:
        # Keep credentials and potentially sensitive server error text out of API/logs.
        print("SIPP DB read failed (" + type(error).__name__ + ")", file=sys.stderr)
        sys.exit(1)
