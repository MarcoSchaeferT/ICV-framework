import asyncio
from decimal import Decimal
import gzip
import json
import unittest
from unittest.mock import AsyncMock, patch

from backend.cache import ResponseCache
from backend.routes.getDataFromDB import route_getDataFromDB as route_module


class GridGeometryMetadataTests(unittest.TestCase):
    def test_quarter_degree_grid_metadata(self):
        geometry = (
            "POLYGON ((-39 83.75, -38.75 83.75, -38.75 83.5, "
            "-39 83.5, -39 83.75))"
        )

        cell_size, anchor_offset = route_module._grid_geometry_metadata(
            geometry, latitude=83.75, longitude=-38.75
        )

        self.assertEqual(cell_size, [0.25, 0.25])
        self.assertEqual(anchor_offset, [0.0, -0.25])

    def test_one_degree_grid_with_center_anchor(self):
        geometry = "POLYGON ((20 11, 21 11, 21 10, 20 10, 20 11))"

        cell_size, anchor_offset = route_module._grid_geometry_metadata(
            geometry, latitude=10.5, longitude=20.5
        )

        self.assertEqual(cell_size, [1.0, 1.0])
        self.assertEqual(anchor_offset, [0.5, -0.5])


class CompactGridQueryTests(unittest.TestCase):
    def test_default_grid_feature_uses_numeric_non_structural_column(self):
        columns = {
            "id": "integer",
            "geometry": "character varying",
            "latitude": "real",
            "longitude": "real",
            "temperature": "real",
            "label": "text",
        }

        feature = route_module._default_grid_feature(list(columns), columns)

        self.assertEqual(feature, "temperature")

    def test_default_grid_feature_requires_numeric_value_column(self):
        columns = {
            "id": "integer",
            "geometry": "character varying",
            "label": "text",
        }

        feature = route_module._default_grid_feature(list(columns), columns)

        self.assertEqual(feature, "")

    def test_compact_grid_preserves_dataset_resolution(self):
        schema = {
            "columns": {
                "id": "integer",
                "geometry": "character varying",
                "latitude": "real",
                "longitude": "real",
                "probability": "real",
            }
        }
        columnar = {
            "id": [1, 2],
            "lat0": [11.0, 11.0], "lng0": [20.0, 21.0],
            "lat1": [11.0, 11.0], "lng1": [21.0, 22.5],
            "lat2": [10.0, 9.5], "lng2": [21.0, 22.5],
            "lat3": [10.0, 9.5], "lng3": [20.0, 21.0],
            "feature": [0.2, 0.8],
        }

        with (
            patch.object(route_module, "get_relation_schema", new=AsyncMock(return_value=schema)),
            patch.object(route_module, "query_columnar", new=AsyncMock(return_value=columnar)),
        ):
            response, error = asyncio.run(route_module.getDBdata_mapGrid(
                "grid_table", "probability", None, None, None, None
            ))

        self.assertIsNone(error)
        self.assertEqual(response["format"], "map-grid-v1")
        self.assertEqual(response["featureName"], "probability")
        self.assertEqual(response["cellSize"], [1.0, 1.0])
        self.assertEqual(response["anchorOffset"], [0, 0])
        self.assertEqual(response["lat2"], [10.0, 9.5])
        self.assertEqual(response["lng2"], [21.0, 22.5])
        self.assertEqual(response["featureRange"], [0.2, 0.8])
        self.assertEqual(response["rowCount"], 2)

    def test_compact_grid_accepts_xy_coordinate_aliases(self):
        schema = {
            "columns": {
                "id": "integer",
                "geometry": "character varying",
                "y": "real",
                "x": "real",
                "temperature": "real",
            }
        }
        columnar = {
            "id": [1],
            "lat0": [11.0], "lng0": [20.0],
            "lat1": [11.0], "lng1": [21.0],
            "lat2": [10.0], "lng2": [21.0],
            "lat3": [10.0], "lng3": [20.0],
            "feature": [22.0],
        }

        with (
            patch.object(route_module, "get_relation_schema", new=AsyncMock(return_value=schema)),
            patch.object(route_module, "query_columnar", new=AsyncMock(return_value=columnar)),
        ):
            response, error = asyncio.run(route_module.getDBdata_mapGrid(
                "climate_grid", "temperature", None, None, None, None
            ))

        self.assertIsNone(error)
        self.assertEqual(response["lat0"], [11.0])
        self.assertEqual(response["lng0"], [20.0])
        self.assertEqual(response["anchorOffset"], [0, 0])

    def test_compact_grid_falls_back_to_geometry_coordinates(self):
        geometry = "POLYGON ((20 11, 21 11, 21 10, 20 10, 20 11))"
        schema = {
            "columns": {
                "id": "integer",
                "geometry": "character varying",
                "temperature": "real",
            }
        }

        async def query_columnar_with_geometry(_query, names, _params, row_mapper=None):
            mapped = row_mapper((7, geometry, 22.0))
            return {name: [mapped[index]] for index, name in enumerate(names)}

        with (
            patch.object(route_module, "get_relation_schema", new=AsyncMock(return_value=schema)),
            patch.object(route_module, "query_columnar", new=query_columnar_with_geometry),
        ):
            response, error = asyncio.run(route_module.getDBdata_mapGrid(
                "geometry_only_grid", "temperature", None, None, None, None
            ))

        self.assertIsNone(error)
        self.assertEqual(response["lat0"], [11.0])
        self.assertEqual(response["lng0"], [20.0])
        self.assertEqual(response["lat2"], [10.0])
        self.assertEqual(response["lng2"], [21.0])
        self.assertEqual(response["cellSize"], [1.0, 1.0])
        self.assertEqual(response["anchorOffset"], [0.0, 0.0])


class SerializedCacheTests(unittest.TestCase):
    def test_gzip_response_round_trip(self):
        payload = {
            "response": {
                "format": "map-grid-v1",
                "id": list(range(1_000)),
                "feature": [0.5] * 1_000,
            }
        }
        cached = route_module._encode_json_response(payload, "gzip")

        self.assertEqual(json.loads(gzip.decompress(cached.body)), payload)
        self.assertLess(len(cached.body), cached.uncompressed_length)

    def test_postgres_decimal_values_remain_json_serializable(self):
        cached = route_module._encode_json_response(
            {"response": [{"feature": Decimal("2024")}]},
            "identity",
        )

        self.assertEqual(json.loads(cached.body), {"response": [{"feature": "2024"}]})

    def test_explicit_size_skips_deep_object_walk(self):
        cache = ResponseCache(max_entries=2, max_bytes=1024, ttl_seconds=60)
        with (
            patch.object(cache, "_current_epochs", return_value=None),
            patch("backend.cache._deep_getsizeof", side_effect=AssertionError("must not run")),
        ):
            cache.set("serialized", b"payload", size_bytes=7)

        self.assertEqual(cache.get("serialized"), b"payload")
        self.assertEqual(cache.stats()["size_bytes"], 7)


if __name__ == "__main__":
    unittest.main()
