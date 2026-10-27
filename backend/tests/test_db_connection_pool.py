import os
import unittest
from contextlib import contextmanager
from unittest.mock import patch

from backend.routes.setFilesToDB import db_utils


class _FakePool:
    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.closed = False
        self.connection_value = object()
        self.__class__.instances.append(self)

    @contextmanager
    def connection(self):
        yield self.connection_value

    def close(self):
        self.closed = True


class ConnectionPoolTests(unittest.TestCase):
    def setUp(self):
        db_utils.close_db_connection_pool()
        _FakePool.instances.clear()

    def tearDown(self):
        db_utils.close_db_connection_pool()

    def test_pool_is_bounded_and_reused_in_one_process(self):
        env = {
            "DB_POOL_MIN_SIZE": "1",
            "DB_POOL_MAX_SIZE": "4",
            "DB_POOL_TIMEOUT_SECONDS": "12",
        }
        with (
            patch.dict(os.environ, env, clear=False),
            patch.object(db_utils, "ConnectionPool", _FakePool),
            patch.object(db_utils, "get_db_connection_params", return_value={"dbname": "test"}),
        ):
            first = db_utils.get_db_connection_pool()
            second = db_utils.get_db_connection_pool()

            self.assertIs(first, second)
            self.assertEqual(len(_FakePool.instances), 1)
            self.assertEqual(first.kwargs["min_size"], 1)
            self.assertEqual(first.kwargs["max_size"], 4)
            self.assertEqual(first.kwargs["timeout"], 12)

            with db_utils.get_db_connection() as connection:
                self.assertIs(connection, first.connection_value)

    def test_invalid_pool_sizes_fall_back_to_safe_defaults(self):
        env = {
            "DB_POOL_MIN_SIZE": "invalid",
            "DB_POOL_MAX_SIZE": "0",
            "DB_POOL_TIMEOUT_SECONDS": "-1",
        }
        with (
            patch.dict(os.environ, env, clear=False),
            patch.object(db_utils, "ConnectionPool", _FakePool),
            patch.object(db_utils, "get_db_connection_params", return_value={"dbname": "test"}),
        ):
            pool = db_utils.get_db_connection_pool()

            self.assertEqual(pool.kwargs["min_size"], 1)
            self.assertEqual(pool.kwargs["max_size"], 4)
            self.assertEqual(pool.kwargs["timeout"], 30)


if __name__ == "__main__":
    unittest.main()
