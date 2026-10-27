import unittest

from backend.routes.getDataFromDB.route_getDataFromDB import conditionBuilderEquals


class QueryFilterTests(unittest.TestCase):
    def test_date_year_filter_uses_index_friendly_range(self):
        where_clause, params = conditionBuilderEquals(["date"], ["2024"])

        self.assertIsNotNone(where_clause)
        self.assertEqual(
            where_clause.as_string(),
            ' WHERE "date" >= %s AND "date" < %s',
        )
        self.assertEqual(params, ["2024-01-01", "2025-01-01"])

    def test_non_year_filter_keeps_equality_semantics(self):
        where_clause, params = conditionBuilderEquals(["country_name"], ["Germany"])

        self.assertIsNotNone(where_clause)
        self.assertEqual(where_clause.as_string(), ' WHERE "country_name" = %s')
        self.assertEqual(params, ["Germany"])


if __name__ == "__main__":
    unittest.main()
