"""Offline reader contract: fake transport, never remote credentials."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location('reader', Path(__file__).with_name('read-sipp-db.py'))
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)

class ReaderTest(unittest.TestCase):
    def test_assignment_read_is_inside_same_snapshot_and_parameterized(self):
        db = MagicMock()
        cursor = db.cursor.return_value.__enter__.return_value
        cursor.fetchall.return_value = []
        config = dict(ssh_key_path='unused', ssh_key_passphrase='unused', ssh_host='unused',
                      ssh_port=22, ssh_user='unused', db_host='unused', db_port=3306,
                      db_user='unused', db_password='unused', db_database='sipp32')
        with patch.object(reader, 'credentials', return_value=config), patch.object(reader.paramiko, 'SSHClient'), patch.object(reader.paramiko.Ed25519Key, 'from_private_key_file'), patch.object(reader.pymysql, 'connect', return_value=db):
            result = reader.read_snapshot('case-number')
        self.assertIn('hakim', result)
        calls = cursor.execute.call_args_list
        self.assertEqual(calls[0].args[0], 'START TRANSACTION WITH CONSISTENT SNAPSHOT')
        query = next(c for c in calls if 'perkara_hakim_pn' in c.args[0])
        self.assertIn('j.tanggal_penetapan', query.args[0])
        self.assertIn('j.diganti_oleh_id', query.args[0])
        self.assertNotIn('SELECT *', query.args[0])
        self.assertEqual(query.args[1], ('case-number',))
        db.rollback.assert_called_once()
        db.close.assert_called_once()

    def test_schema_mode_reads_column_metadata_without_reading_case_records(self):
        db = MagicMock()
        cursor = db.cursor.return_value.__enter__.return_value
        with patch.object(reader, 'credentials', return_value=dict(
            ssh_key_path='unused', ssh_key_passphrase='unused', ssh_host='unused',
            ssh_port=22, ssh_user='unused', db_host='unused', db_port=3306,
            db_user='unused', db_password='unused', db_database='sipp32'
        )), patch.object(reader.paramiko, 'SSHClient'), patch.object(reader.paramiko.Ed25519Key, 'from_private_key_file'), patch.object(reader.pymysql, 'connect', return_value=db):
            reader.read_snapshot(schema_only=True)
        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertEqual(len(statements), 2)
        self.assertIn('FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()', statements[1])
        db.rollback.assert_called_once()

if __name__ == '__main__':
    unittest.main()
