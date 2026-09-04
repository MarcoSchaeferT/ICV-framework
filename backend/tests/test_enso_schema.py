import sys
import types
import unittest
from unittest.mock import patch

from backend.routes.processData.enso_schema import (
    enso_column_metadata,
    enso_suitability_column_kind,
    is_enso_numeric_column,
    is_enso_suitability_column,
    normalize_enso_column_name,
    parse_enso_climate_column,
    parse_enso_suitability_column,
)
from backend.routes.columnMetadata import route_columnMetadata
from backend.routes.processData import ensoSuitability
from backend.routes.setFilesToDB import createTable


class EnsoSchemaTests(unittest.TestCase):
    def test_accepts_raw_and_sanitized_enso_columns(self):
        cases = {
            "Forecast: Aug 2026": "forecast",
            "forecast_aug_2026": "forecast",
            "forecast___jan_2027": "forecast",
            "Referenz: Jan 2000-2025": "reference",
            "reference_dec_1991_2020": "reference",
            "referenz___feb_2000_2025_(std)": "reference_std",
        }

        for column_name, expected_kind in cases.items():
            with self.subTest(column_name=column_name):
                self.assertEqual(
                    enso_suitability_column_kind(column_name),
                    expected_kind,
                )
                self.assertTrue(is_enso_suitability_column(column_name))

    def test_rejects_columns_that_only_contain_generic_keywords(self):
        for column_name in (
            "forecast_date",
            "weather_forecast_aug_2026",
            "forecast_august_2026",
            "forecast_aug_2026_source",
            "reference_temperature",
            "external_reference",
            "referenzwert",
        ):
            with self.subTest(column_name=column_name):
                self.assertIsNone(enso_suitability_column_kind(column_name))
                self.assertFalse(is_enso_suitability_column(column_name))

    def test_normalizes_csv_and_database_separators(self):
        self.assertEqual(
            normalize_enso_column_name("  Referenz: Jan 2000-2025 (std)  "),
            "referenz_jan_2000_2025_(std)",
        )

    def test_parses_real_rolling_dataset_columns(self):
        forecast = parse_enso_suitability_column("Forecast_Jan_2027")
        self.assertIsNotNone(forecast)
        self.assertEqual(
            (forecast.kind, forecast.month, forecast.year),
            ("forecast", 1, 2027),
        )

        climate_forecast = parse_enso_climate_column("tp_fc_2027_01")
        self.assertIsNotNone(climate_forecast)
        self.assertEqual(
            (
                climate_forecast.kind,
                climate_forecast.variable,
                climate_forecast.month,
                climate_forecast.year,
            ),
            ("forecast", "tp", 1, 2027),
        )
        self.assertTrue(is_enso_numeric_column("t2m_ref_12_std"))
        self.assertFalse(is_enso_numeric_column("weather_forecast_aug_2026"))

    def test_builds_localized_metadata_for_real_schema(self):
        forecast = enso_column_metadata("Forecast_Aug_2026", "en")
        self.assertEqual(
            (
                forecast["datatype"],
                forecast["dimension"],
                forecast["availability"],
            ),
            ("float", "%", 1),
        )
        self.assertIn("August 2026", forecast["description"])

        reference_std = enso_column_metadata(
            "Referenz_Jan_2000-2025_(std)", "de"
        )
        self.assertEqual(reference_std["availability"], 0)
        self.assertIn("Standardabweichung", reference_std["description"])

        precipitation = enso_column_metadata("tp_fc_2027_01", "en")
        self.assertEqual(precipitation["dimension"], "m/day")
        self.assertEqual(precipitation["availability"], 0)

    def test_sql_type_override_only_applies_to_enso_columns(self):
        fake_index = types.ModuleType("backend.index")
        fake_index.metadata = {"known_column": "string"}

        with patch.dict(sys.modules, {"backend.index": fake_index}):
            self.assertEqual(
                createTable.getColumnSQLdataType("Forecast: Aug 2026"),
                "float4",
            )
            self.assertEqual(
                createTable.getColumnSQLdataType(
                    "forecast_date",
                    {"forecast_date": "date"},
                ),
                "date",
            )
            self.assertEqual(
                createTable.getColumnSQLdataType("external_reference"),
                "varchar",
            )

    def test_processing_uses_real_rolling_column_schema(self):
        row = {
            "forecast_jan_2027": 0.7,
            "forecast_dec_2026": 0.6,
            "referenz_jan_2000_2025": 0.4,
            "referenz_jan_2000_2025_(std)": 0.1,
        }

        self.assertEqual(
            ensoSuitability._forecast_prob_items(row),
            [
                (2026, 12, "forecast_dec_2026"),
                (2027, 1, "forecast_jan_2027"),
            ],
        )
        mean, std = ensoSuitability._build_ref_suitability_series(row)
        self.assertEqual(mean[0], 0.4)
        self.assertEqual(std[0], 0.1)

    def test_plot_uses_shared_german_messages_without_axis_offset_text(self):
        row = {
            "longitude": -75.625,
            "latitude": 6.125,
            "forecast_mar_2027": 0.100001,
            "referenz_mar_2000_2025": 0.1,
            "referenz_mar_2000_2025_(std)": 0.000001,
            "t2m_fc_2027_03": 20.0,
            "d2m_fc_2027_03": 15.0,
            "si10_fc_2027_03": 1.5,
            "tp_fc_2027_03": 0.002,
        }

        ensoSuitability._load_plot_text.cache_clear()
        fig = ensoSuitability._build_enso_figure(
            59960,
            row,
            "seas5_forecast_albopictus_habitat_probability",
            active_month="mar",
            locale="de",
        )
        try:
            suitability_axis = fig.axes[-1]
            self.assertEqual(suitability_axis.get_title(), "Habitateignung [%]")
            self.assertIn(
                "Mär",
                [tick.get_text() for tick in suitability_axis.get_xticklabels()],
            )
            self.assertFalse(
                suitability_axis.yaxis.get_major_formatter().get_useOffset()
            )
            self.assertFalse(suitability_axis.yaxis.get_offset_text().get_visible())
            header_texts = [header.get_text() for header in fig.texts]
            self.assertTrue(
                any("SEAS5-Vorhersage" in header for header in header_texts)
            )
            self.assertIn(
                "Lat: 6.13°, Lng: -75.63°",
                header_texts,
            )
            self.assertIsNone(fig.axes[0].get_legend())
            self.assertEqual(
                [label.get_text() for label in fig.legends[0].get_texts()],
                ["ERA5-Mittelwert (2000–2025)", "SEAS5-Vorhersage"],
            )
        finally:
            ensoSuitability.plt.close(fig)


class _FakeCursor:
    def __init__(self, inserted_rows, deleted_relations):
        self.inserted_rows = inserted_rows
        self.deleted_relations = deleted_relations

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def execute(self, _query, params=None):
        if isinstance(params, tuple) and len(params) == 6:
            self.inserted_rows.append(params)
        elif isinstance(params, tuple) and len(params) == 1:
            self.deleted_relations.append(params[0])


class _FakeConnection:
    def __init__(self, inserted_rows, deleted_relations):
        self.inserted_rows = inserted_rows
        self.deleted_relations = deleted_relations

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def cursor(self):
        return _FakeCursor(self.inserted_rows, self.deleted_relations)

    def commit(self):
        pass


class EnsoColumnMetadataTests(unittest.TestCase):
    def test_schema_and_inferred_types_are_stored_in_metadata(self):
        inserted_rows = []
        deleted_relations = []
        templates = {}

        with (
            patch.object(route_columnMetadata, "loadMetadataCSV", return_value=templates),
            patch.object(route_columnMetadata, "get_db_connection_params", return_value={}),
            patch.object(
                route_columnMetadata.psycopg,
                "connect",
                return_value=_FakeConnection(inserted_rows, deleted_relations),
            ),
        ):
            route_columnMetadata.populate_column_metadata(
                "seas5_forecast_test_habitat_probability",
                [
                    "Forecast: Aug 2026",
                    "Referenz: Jan 2000-2025 (std)",
                    "t2m_ref_01_mean",
                    "forecast_date",
                    "external_reference",
                ],
                resolved_sql_types={
                    "Forecast: Aug 2026": "float4",
                    "Referenz: Jan 2000-2025 (std)": "float4",
                    "t2m_ref_01_mean": "float4",
                    "forecast_date": "date",
                    "external_reference": "float4",
                },
                replace_existing=True,
            )

        self.assertEqual(
            deleted_relations,
            [
                "seas5_forecast_test_habitat_probability",
                "seas5_forecast_test_habitat_probability",
            ],
        )
        rows_by_column = {}
        for relation, column, datatype, dimension, description, availability in inserted_rows:
            self.assertEqual(relation, "seas5_forecast_test_habitat_probability")
            rows_by_column.setdefault(column, []).append(
                (datatype, dimension, description, availability)
            )

        for datatype, dimension, _description, availability in rows_by_column["forecast___aug_2026"]:
            self.assertEqual((datatype, dimension, availability), ("float", "%", 1))
        for datatype, dimension, _description, availability in rows_by_column["referenz___jan_2000_2025_(std)"]:
            self.assertEqual((datatype, dimension, availability), ("float", "%", 0))
        for datatype, dimension, description, availability in rows_by_column["t2m_ref_01_mean"]:
            self.assertEqual(datatype, "float")
            self.assertEqual(dimension, "°C")
            self.assertTrue(description)
            self.assertEqual(availability, 0)
        for datatype, dimension, description, availability in rows_by_column["forecast_date"]:
            self.assertEqual((datatype, dimension, description, availability), ("date", "", "", 0))
        for datatype, dimension, description, availability in rows_by_column["external_reference"]:
            self.assertEqual((datatype, dimension, description, availability), ("float", "", "", 0))

    def test_partial_metadata_updates_do_not_delete_other_columns(self):
        inserted_rows = []
        deleted_relations = []
        with (
            patch.object(route_columnMetadata, "loadMetadataCSV", return_value={}),
            patch.object(route_columnMetadata, "get_db_connection_params", return_value={}),
            patch.object(
                route_columnMetadata.psycopg,
                "connect",
                return_value=_FakeConnection(inserted_rows, deleted_relations),
            ),
        ):
            route_columnMetadata.populate_column_metadata(
                "existing_dataset",
                ["admin"],
            )

        self.assertEqual(deleted_relations, [])


if __name__ == "__main__":
    unittest.main()
