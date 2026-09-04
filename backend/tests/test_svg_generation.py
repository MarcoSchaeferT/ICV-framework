import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import backend.index as backend_index
from backend.routes.processData import ensoSuitability, uncertaintyVis


class _MemoryCache:
    """Small thread-safe stand-in for the application response cache."""

    def __init__(self):
        self._values = {}
        self._lock = threading.Lock()
        self.set_calls = []

    def get(self, key):
        with self._lock:
            return self._values.get(key)

    def set(self, key, value, **kwargs):
        with self._lock:
            self._values[key] = value
            self.set_calls.append((key, kwargs))


class SvgGenerationRouteTests(unittest.TestCase):
    def test_enso_svg_is_rendered_in_memory_and_cached(self):
        cache = _MemoryCache()
        svg = b'<svg xmlns="http://www.w3.org/2000/svg" />'

        with (
            patch.object(backend_index, "response_cache", cache),
            patch.object(backend_index, "render_ENSO_suitability_svg", return_value=svg) as render,
            backend_index.app.test_client() as client,
        ):
            response = client.get(
                "/api/get_uncertainty_svg",
                query_string={
                    "filename": "climate_forecast_cell.svg",
                    "cellID": 42,
                    "dataset": "seas5_forecast_albopictus_habitat_probability",
                    "month": "aug",
                    "locale": "de",
                },
            )
            cached_response = client.get(
                "/api/get_uncertainty_svg",
                query_string={
                    "filename": "climate_forecast_cell.svg",
                    "cellID": 42,
                    "dataset": "seas5_forecast_albopictus_habitat_probability",
                    "month": "aug",
                    "locale": "de",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, svg)
        self.assertEqual(response.mimetype, "image/svg+xml")
        self.assertEqual(response.headers["Cache-Control"], "no-cache")
        self.assertEqual(cached_response.data, svg)
        render.assert_called_once_with(
            cell_id=42,
            dataset_template="seas5_forecast_albopictus_habitat_probability",
            active_month="aug",
            locale="de",
        )
        self.assertEqual(len(cache.set_calls), 1)

    def test_uq_request_renders_and_caches_both_related_plots(self):
        cache = _MemoryCache()
        rendered = {
            "uncertainty": b"<svg>uncertainty</svg>",
            "calibration": b"<svg>calibration</svg>",
        }

        with (
            patch.object(backend_index, "response_cache", cache),
            patch.object(backend_index, "render_uncertainty_svgs", return_value=rendered) as render,
            backend_index.app.test_client() as client,
        ):
            uncertainty_response = client.get(
                "/api/get_uncertainty_svg",
                query_string={"filename": "seasonal_uncertainty_cell.svg", "cellID": 84},
            )
            calibration_response = client.get(
                "/api/get_uncertainty_svg",
                query_string={"filename": "seasonal_calibration_cell.svg", "cellID": 84},
            )

        self.assertEqual(uncertainty_response.data, rendered["uncertainty"])
        self.assertEqual(calibration_response.data, rendered["calibration"])
        render.assert_called_once()
        self.assertEqual(len(cache.set_calls), 2)

    def test_enso_cache_keeps_locales_separate(self):
        cache = _MemoryCache()

        def render_locale(**kwargs):
            return f"<svg>{kwargs['locale']}</svg>".encode()

        with (
            patch.object(backend_index, "response_cache", cache),
            patch.object(
                backend_index,
                "render_ENSO_suitability_svg",
                side_effect=render_locale,
            ) as render,
            backend_index.app.test_client() as client,
        ):
            responses = [
                client.get(
                    "/api/get_uncertainty_svg",
                    query_string={
                        "filename": "climate_forecast_cell.svg",
                        "cellID": 59960,
                        "locale": locale,
                    },
                ).data
                for locale in ("en", "de")
            ]

        self.assertEqual(responses, [b"<svg>en</svg>", b"<svg>de</svg>"])
        self.assertEqual(render.call_count, 2)
        self.assertEqual(len(cache.set_calls), 2)

    def test_concurrent_enso_cache_misses_only_render_once(self):
        cache = _MemoryCache()
        svg = b"<svg>shared</svg>"
        render_count = 0
        count_lock = threading.Lock()

        def render_once(**_kwargs):
            nonlocal render_count
            with count_lock:
                render_count += 1
            time.sleep(0.05)
            return svg

        def request_svg():
            with backend_index.app.test_client() as client:
                response = client.get(
                    "/api/get_uncertainty_svg",
                    query_string={
                        "filename": "climate_forecast_cell.svg",
                        "cellID": 123,
                        "dataset": "seas5_forecast_albopictus_habitat_probability",
                        "month": "sep",
                    },
                )
                return response.status_code, response.data

        with (
            patch.object(backend_index, "response_cache", cache),
            patch.object(backend_index, "render_ENSO_suitability_svg", side_effect=render_once),
            ThreadPoolExecutor(max_workers=4) as executor,
        ):
            responses = list(executor.map(lambda _index: request_svg(), range(4)))

        self.assertEqual(responses, [(200, svg)] * 4)
        self.assertEqual(render_count, 1)

    def test_unknown_svg_name_is_rejected(self):
        with backend_index.app.test_client() as client:
            response = client.get(
                "/api/get_uncertainty_svg",
                query_string={"filename": "other.svg", "cellID": 42},
            )
        self.assertEqual(response.status_code, 400)


class OfflineSvgExportTests(unittest.TestCase):
    def test_enso_export_does_not_delete_other_variants(self):
        with TemporaryDirectory() as directory:
            out_dir = Path(directory)
            existing = out_dir / "42_previous_climate_forecast_cell.svg"
            existing.write_bytes(b"old")

            with patch.object(
                ensoSuitability,
                "render_ENSO_suitability_svg",
                return_value=b"<svg>new</svg>",
            ):
                target = ensoSuitability.create_ENSO_suitability_visualizations(
                    cell_id=42,
                    out_dir=out_dir,
                )

            self.assertTrue(existing.exists())
            self.assertEqual(target.read_bytes(), b"<svg>new</svg>")

    def test_uq_export_does_not_delete_other_cells(self):
        with TemporaryDirectory() as directory:
            out_dir = Path(directory)
            existing = out_dir / "7_seasonal_uncertainty_cell.svg"
            existing.write_bytes(b"old")

            with patch.object(
                uncertaintyVis,
                "render_uncertainty_svgs",
                return_value={"uncertainty": b"<svg>new</svg>"},
            ):
                uncertaintyVis.create_uncertainty_visualizations(
                    out_dir=out_dir,
                    grid_start=8,
                    grid_end=8,
                    plot_type="uncertainty",
                )

            self.assertEqual(existing.read_bytes(), b"old")
            self.assertEqual(
                (out_dir / "8_seasonal_uncertainty_cell.svg").read_bytes(),
                b"<svg>new</svg>",
            )


class UncertaintyDataSelectionTests(unittest.TestCase):
    def test_simulation_selection_is_stable_across_workers(self):
        row = {
            "longitude": 10,
            "latitude": 20,
            "geometry": None,
            "mean": 0.5,
            "sd": 0.1,
            "cv": 0.2,
            "q05": 0.3,
            "q95": 0.7,
            **{f"sim_{index}": index / 100 for index in range(1, 51)},
        }
        with patch.object(uncertaintyVis, "fetch_pixel_row", return_value=row):
            first = uncertaintyVis._fetch_monthly_data(123, {}, "unused_{month}", range(1, 4))
            second = uncertaintyVis._fetch_monthly_data(123, {}, "unused_{month}", range(1, 4))

        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
