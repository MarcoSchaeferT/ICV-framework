"""Keep database-changing processing behind explicit POST requests."""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from flask import Flask

from backend.routes.getDataFromDB import route_getDataFromDB as data_module
from backend.routes.columnMetadata import route_columnMetadata as metadata_module
from backend.routes.processData import route_processData as process_module


class ProcessHttpMethodTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(data_module.route_getDataFromDB, url_prefix='/api/getDataFromDB')
        app.register_blueprint(metadata_module.route_columnMetadata, url_prefix='/api/columnMetadata')
        app.register_blueprint(process_module.route_processData, url_prefix='/api/processData')
        self.client = app.test_client()

    def test_aggregation_get_is_rejected_without_running_command(self):
        with patch.object(process_module, 'aggregate_rki_data') as aggregate:
            response = self.client.get('/api/processData/aggregateRKI?targetDate=2022-06-01')

        self.assertEqual(response.status_code, 405)
        aggregate.assert_not_called()

    def test_country_assignment_get_is_rejected_without_running_command(self):
        with patch.object(process_module, 'assign_geo_pos_to_country') as assign:
            response = self.client.get('/api/processData/assignCountries?tableName=observations')

        self.assertEqual(response.status_code, 405)
        assign.assert_not_called()

    def test_aggregation_post_uses_json_body(self):
        with patch.object(process_module, 'aggregate_rki_data', return_value={'message': 'done'}) as aggregate:
            response = self.client.post(
                '/api/processData/aggregateRKI?targetDate=2020-01-01',
                json={'sourceTable': 'rki_source', 'targetTable': 'rki_states', 'targetDate': '2022-06-01'},
            )

        self.assertEqual(response.status_code, 200)
        aggregate.assert_called_once_with(
            source_table='rki_source', target_table='rki_states', targetDate='2022-06-01',
        )

    def test_aggregation_post_accepts_default_command(self):
        with patch.object(process_module, 'aggregate_rki_data', return_value={'message': 'done'}) as aggregate:
            response = self.client.post('/api/processData/aggregateRKI', json={})

        self.assertEqual(response.status_code, 200)
        aggregate.assert_called_once_with(
            source_table='aktuell_deutschland_sarscov2_infektionen',
            target_table=None,
            targetDate=None,
        )

    def test_country_assignment_post_uses_json_body(self):
        with patch.object(process_module, 'assign_geo_pos_to_country', return_value=12) as assign:
            response = self.client.post(
                '/api/processData/assignCountries',
                json={'tableName': 'observations', 'reprocessAll': True},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['updatedRows'], 12)
        assign.assert_called_once_with('observations', skip_existing=False)

    def test_processing_commands_require_json_objects(self):
        for path in ('aggregateRKI', 'assignCountries'):
            with self.subTest(path=path):
                response = self.client.post(f'/api/processData/{path}', data='invalid')
                self.assertEqual(response.status_code, 400)

    def test_aggregation_rejects_malformed_target_date_before_processing(self):
        with patch.object(process_module, 'aggregate_rki_data') as aggregate:
            response = self.client.post(
                '/api/processData/aggregateRKI',
                json={'targetDate': '2022-06-01-not-a-date'},
            )

        self.assertEqual(response.status_code, 400)
        aggregate.assert_not_called()

    def test_aggregated_relation_get_only_reads_existing_rows(self):
        schema = {
            'exists': True,
            'has_data': True,
            'columns': {'id': 'integer', 'datenstand': 'date'},
        }
        with (
            patch.object(data_module, 'get_relation_schema', new=AsyncMock(return_value=schema)) as get_schema,
            patch.object(data_module, 'getDBdata_allCols', new=AsyncMock(return_value=([{'id': 1}], None))) as read_rows,
            patch.object(process_module, 'aggregate_rki_data') as aggregate,
        ):
            response = self.client.get(
                '/api/getDataFromDB?relationName=http_method_test_aggregated&feature=ALL',
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['response'], [{'id': 1}])
        get_schema.assert_awaited_once_with('http_method_test_aggregated')
        read_rows.assert_awaited_once()
        aggregate.assert_not_called()

    def test_column_metadata_get_does_not_create_tables(self):
        connection_manager = MagicMock()
        connection = connection_manager.__enter__.return_value
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.description = [('id',)]
        cursor.fetchall.return_value = []
        with (
            patch.object(metadata_module, 'get_db_connection', return_value=connection_manager),
            patch.object(metadata_module, '_ensure_table') as ensure_table,
        ):
            response = self.client.get('/api/columnMetadata?relationName=observations&lang=en')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])
        cursor.execute.assert_called_once()
        ensure_table.assert_not_called()
        connection.commit.assert_not_called()


if __name__ == '__main__':
    unittest.main()
