import os
import sys
import importlib.util
import unittest
from datetime import datetime
from psycopg2 import errors as pg_errors


class FakeCursor:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, *args, **kwargs):
        # Simulate a duplicate key error on insert
        raise pg_errors.UniqueViolation()


class FakeConn:
    def __init__(self):
        self.rollback_called = False

    def cursor(self):
        return FakeCursor()

    def commit(self):
        pass

    def rollback(self):
        self.rollback_called = True


class InsertChatLogTest(unittest.TestCase):
    def test_unique_violation_is_swallowed(self):
        # Dynamically load db_client.py from its file path
        here = os.path.dirname(__file__)
        repo_root = os.path.abspath(os.path.join(here, '..', '..', '..'))
        module_path = os.path.join(repo_root, 'services', 'eeg-tokenizer', 'db_client.py')
        spec = importlib.util.spec_from_file_location('db_client', module_path)
        db = importlib.util.module_from_spec(spec)  # type: ignore
        assert spec and spec.loader
        spec.loader.exec_module(db)  # type: ignore

        client = db.DatabaseClient.__new__(db.DatabaseClient)
        client.conn = FakeConn()
        client._ensure_conn = lambda: None

        # Should not raise despite UniqueViolation
        client.insert_chat_log(
            timestamp=datetime.now(),
            role='user',
            content='hello',
            token_window_start=None,
        )

        self.assertTrue(client.conn.rollback_called)


if __name__ == '__main__':
    unittest.main()
