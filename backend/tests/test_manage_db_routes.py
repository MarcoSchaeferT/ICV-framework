"""Exercise the Flask dispatch path for database administration routes."""

import unittest
from unittest.mock import AsyncMock, patch

from flask import Flask

from backend.routes.manageDB import route_manageDB as manage_module


class ManageDbRouteTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(manage_module.route_manageDB, url_prefix='/api/manageDB')
        self.client = app.test_client()

    def test_list_relations_returns_json(self):
        relations = [{'table_name': 'observations', 'row_count': 12}]
        with patch.object(manage_module, 'query_raw', new=AsyncMock(return_value=relations)):
            response = self.client.get('/api/manageDB')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), relations)

    def test_delete_requires_relation_name(self):
        with patch.object(manage_module, 'execute_raw', new=AsyncMock()) as execute:
            response = self.client.delete('/api/manageDB')

        self.assertEqual(response.status_code, 400)
        execute.assert_not_awaited()


if __name__ == '__main__':
    unittest.main()
