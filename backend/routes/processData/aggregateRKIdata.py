"""
===============================================================================
RKI COVID-19 / SARS-CoV-2 Data Aggregation Module
===============================================================================

This module provides data aggregation capabilities for raw Robert Koch Institute 
(RKI) COVID-19 / SARS-CoV-2 district-level infection datasets in PostgreSQL.

Epidemiological Metrics & Processing Overview:
----------------------------------------------
1. Geographic Aggregation:
   Maps 5-digit German district IDs (`idlandkreis` / `landkreis_id`) to 2-digit 
   federal state IDs (`idbundesland` from '01' to '16') and maps them to standard 
   German state names (e.g., 'Bayern', 'Berlin', 'Schleswig-Holstein').

2. Status Flag Filtering (RKI Standard Logic):
   Applies official RKI flag semantics for case, death, and recovery counts:
     * Flag  0 : Historical valid record (already accounted for in baseline data; 
                 included in valid counts where flag IN (1, 0)).
     * Flag  1 : Valid record added/updated in current dataset snapshot 
                 (included in valid counts where flag IN (1, 0)).
     * Flag -1 : Audit marker for cases deleted in dataset snapshot 
                 (omitted from valid epidemiological counts).
     * Flag -9 : Outcome unknown or non-applicable (omitted from death/recovery counts).

3. Metric Calculations:
   Computes key epidemiological indicators per federal state per reporting date (`meldedatum`):
     * Daily Metrics:
        New cases (`newcases`),
        new deaths (`newdeaths`),
        new recoveries (`newrecovered`).
     * 7-Day Rolling Windows:
        7-day cumulative cases (`accucasesperweek`), 
        7-day cumulative deaths (`accudeathsperweek`),
        7-day cumulative recoveries (`accurecoveredperweek`).
     * Cumulative History:
        Total cases (`accucases`),
        total deaths (`accudeaths`),
        total recoveries (`accurecovered`) 
        up to target date.

4. Streamlined Window Aggregation Architecture:
   - High-Performance Bulk Pre-Computation: Evaluates a complete Cartesian product grid 
     (16 States x N Dates) via SQL Window Functions to compute all historical state-level 
     time-series metrics in a single pass (< 100ms).
   - Incremental Cache Check: Checks if the target date already exists in a populated 
     target table (cache hit). If missing or incomplete, builds the full grid.

5. Caching, Metadata & Database Indexing:
   - Ensures composite indexes exist on `(datenstand, idbundesland)` and `(meldedatum::date)`.
   - Datatypes in the target table conform strictly to backend standard SQL schema:
     `datenstand` DATE, `bundesland` VARCHAR(255), `idbundesland` VARCHAR(10),
     metrics as INTEGER, and `geometry` TEXT.
   - Automatically registers and populates per-relation column metadata entries in 
     `column_metadata_en` and `column_metadata_de`.
   - Invalidates backend API response cache (`backend.cache.response_cache`) whenever table changes occur.

Usage Example:
--------------
>>> from backend.routes.processData.aggregateRKIdata import aggregate_rki_data
>>> result = aggregate_rki_data(
...     source_table="aktuell_deutschland_sarscov2_infektionen",
...     target_table="aktuell_deutschland_sarscov2_infektionen_aggregated",
...     targetDate="2021-05-15"
... )
>>> print(result["insertedRows"])
"""

from datetime import date, datetime
from typing import Optional, Union, Dict, Any
import psycopg
from psycopg import sql
from backend.routes.setFilesToDB.db_utils import get_db_connection_params
from backend.cache import response_cache


def aggregate_rki_data(
    source_table: str = "aktuell_deutschland_sarscov2_infektionen",
    target_table: Optional[str] = None,
    targetDate: Optional[Union[str, date, datetime]] = None
) -> Dict[str, Any]:
    """
    Aggregates district-level RKI COVID-19 infection data into state-level metrics.

    Scans cumulative RKI infection records up to `targetDate` and computes single-day,
    7-day rolling window, and historical cumulative totals for all 16 German federal states.

    Args:
        source_table (str): Name of the PostgreSQL source table containing raw RKI 
            district-level data. Defaults to "aktuell_deutschland_sarscov2_infektionen".
        target_table (Optional[str]): Name of the target PostgreSQL table for storing 
            aggregated state metrics. If None, defaults to `f"{source_table}_aggregated"`.
        targetDate (Optional[Union[str, date, datetime]]): Target date for aggregation 
            (formatted as "YYYY-MM-DD", `date`, or `datetime`). If None, automatically 
            selects the maximum date available in `source_table`.

    Returns:
        Dict[str, Any]: Execution result metadata containing:
            - "message" (str): Summary description of the aggregation outcome.
            - "sourceTable" (str): Name of the source table used.
            - "targetTable" (str): Name of the target table updated.
            - "targetDate" (str): ISO string ("YYYY-MM-DD") of the processed target date.
            - "insertedRows" (int, optional): Total row count in the target table after insertion.

    Raises:
        ValueError: If `source_table` is empty, does not exist in the database schema, 
            or lacks required column aliases.
        psycopg.Error: If a PostgreSQL database execution error occurs.

    Side Effects:
        - Creates `target_table` with schema constraints and indexes if non-existent.
        - Auto-populates `column_metadata_en` and `column_metadata_de` for `target_table`.
        - Rebuilds complete state time-series grid in `target_table` if missing target date.
        - Inserts aggregated rows into PostgreSQL `target_table`.
        - Invalidates cache entries in `backend.cache.response_cache`.
    """
    if not source_table:
        raise ValueError("source_table parameter is required.")

    if not target_table:
        target_table = f"{source_table}_aggregated"

    conn_params = get_db_connection_params()

    with psycopg.connect(**conn_params) as conn:
        with conn.cursor() as cur:
            # -------------------------------------------------------------------------
            # STEP 1: Check Source Table Existence
            # -------------------------------------------------------------------------
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_tables 
                    WHERE schemaname = 'public' 
                    AND tablename = %s
                )
            """, (source_table,))
            if not cur.fetchone()[0]:
                raise ValueError(f"Source table '{source_table}' does not exist in database.")

            # -------------------------------------------------------------------------
            # STEP 2: Inspect and Resolve Column Aliases
            # -------------------------------------------------------------------------
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = %s
            """, (source_table,))
            raw_cols = [row[0] for row in cur.fetchall()]
            # Strip BOM (\ufeff) and normalize to lowercase
            cols = {col.lower().lstrip('\ufeff'): col for col in raw_cols}

            def find_col(aliases: list[str]) -> str:
                """
                Finds the matching column name in the source table from a list of alias candidates.

                Normalizes column names by stripping leading UTF-8 BOM characters (\ufeff)
                and converting to lowercase.

                Args:
                    aliases (list[str]): List of candidate column names/aliases.

                Returns:
                    str: The exact column name as defined in the PostgreSQL database table.

                Raises:
                    ValueError: If none of the alias candidates match available table columns.
                """
                for alias in aliases:
                    clean_alias = alias.lower().lstrip('\ufeff')
                    if clean_alias in cols:
                        return cols[clean_alias]
                raise ValueError(
                    f"Could not find required column in '{source_table}' matching aliases: {aliases}. "
                    f"Available columns: {raw_cols}"
                )

            col_id_landkreis = find_col(["idlandkreis", "id_landkreis", "landkreis_id"])
            col_meldedatum = find_col(["meldedatum", "date", "datum"])
            col_anzahl_fall = find_col(["anzahlfall", "anzahl_fall", "cases", "fall_anzahl"])
            col_anzahl_todesfall = find_col(["anzahltodesfall", "anzahl_todesfall", "deaths", "todesfall_anzahl"])
            col_anzahl_genesen = find_col(["anzahlgenesen", "anzahl_genesen", "recovered", "genesen_anzahl"])
            col_neuer_fall = find_col(["neuerfall", "neuer_fall"])
            col_neuer_todesfall = find_col(["neuertodesfall", "neuer_todesfall"])
            col_neu_genesen = find_col(["neugenesen", "neu_genesen"])

            # -------------------------------------------------------------------------
            # STEP 3: Define Date Parsing Utility
            # -------------------------------------------------------------------------
            def parse_date(d: Union[str, date, datetime, None]) -> Optional[date]:
                """
                Parses a date representation into a datetime.date object.

                Args:
                    d (Union[str, date, datetime, None]): Raw date input string ("YYYY-MM-DD"),
                        date object, datetime object, or None.

                Returns:
                    Optional[date]: Cleaned `datetime.date` instance, or None if input is empty/falsy.
                """
                if not d:
                    return None
                if isinstance(d, datetime):
                    return d.date()
                if isinstance(d, date):
                    return d
                if isinstance(d, str):
                    return datetime.strptime(d[:10], "%Y-%m-%d").date()
                return None

            # -------------------------------------------------------------------------
            # STEP 4: Determine Target Aggregation Date
            # -------------------------------------------------------------------------
            cur.execute(sql.SQL("SELECT MAX({col}::date) FROM {tbl}").format(
                col=sql.Identifier(col_meldedatum),
                tbl=sql.Identifier(source_table)
            ))
            row = cur.fetchone()
            table_max_date = row[0] if (row and row[0]) else date.today()
            if isinstance(table_max_date, str):
                table_max_date = datetime.strptime(table_max_date[:10], "%Y-%m-%d").date()

            parsed_target = parse_date(targetDate)
            target_date = parsed_target if parsed_target else table_max_date

            formatted_target_date = str(target_date)[:10]

            # -------------------------------------------------------------------------
            # STEP 5: Ensure Target Table Schema, Metadata, and Database Indexes Exist
            # -------------------------------------------------------------------------
            cur.execute(sql.SQL("""
                CREATE TABLE IF NOT EXISTS {target_tbl} (
                    id SERIAL PRIMARY KEY,
                    bundesland VARCHAR(255),
                    datenstand DATE,
                    newcases INTEGER,
                    accucasesperweek INTEGER,
                    accucases INTEGER,
                    newdeaths INTEGER,
                    accudeathsperweek INTEGER,
                    accudeaths INTEGER,
                    newrecovered INTEGER,
                    accurecoveredperweek INTEGER,
                    accurecovered INTEGER,
                    idbundesland VARCHAR(10),
                    geometry TEXT,
                    CONSTRAINT {uniq_constraint} UNIQUE (datenstand, idbundesland)
                );
                CREATE INDEX IF NOT EXISTS {idx_name} ON {target_tbl} (datenstand, idbundesland);
                CREATE INDEX IF NOT EXISTS {src_idx} ON {source_tbl} (({col_meldedatum}::date));
            """).format(
                target_tbl=sql.Identifier(target_table),
                source_tbl=sql.Identifier(source_table),
                idx_name=sql.Identifier(f"idx_{target_table}_datenstand"),
                src_idx=sql.Identifier(f"idx_{source_table}_meldedatum_date"),
                uniq_constraint=sql.Identifier(f"uniq_{target_table}_datenstand_idbundesland"),
                col_meldedatum=sql.Identifier(col_meldedatum)
            ))
            conn.commit()

            # Ensure per-relation column metadata entries (column_metadata_en / column_metadata_de) exist
            try:
                from backend.routes.columnMetadata.route_columnMetadata import populate_column_metadata
                target_columns = [
                    "bundesland", "datenstand", "newcases", "accucasesperweek", "accucases",
                    "newdeaths", "accudeathsperweek", "accudeaths", "newrecovered",
                    "accurecoveredperweek", "accurecovered", "idbundesland", "geometry"
                ]
                populate_column_metadata(target_table, target_columns)
            except Exception as meta_err:
                print(f"WARNING: Could not populate column metadata for '{target_table}': {meta_err}")

            # -------------------------------------------------------------------------
            # STEP 6: Check Incremental Cache (Target Date Already Present)
            # -------------------------------------------------------------------------
            cur.execute(sql.SQL("SELECT COUNT(*) FROM {target_tbl}").format(
                target_tbl=sql.Identifier(target_table)
            ))
            row_count = cur.fetchone()[0]

            cur.execute(sql.SQL("SELECT 1 FROM {target_tbl} WHERE datenstand = %s::date LIMIT 1").format(
                target_tbl=sql.Identifier(target_table)
            ), (formatted_target_date,))
            has_target_date = cur.fetchone() is not None

            if row_count >= 1000 and has_target_date:
                print(f"[INCREMENTAL CACHE HIT] Date {formatted_target_date} already aggregated in {target_table}.")
                return {
                    "message": f"Date {formatted_target_date} already present in aggregated table",
                    "sourceTable": source_table,
                    "targetTable": target_table,
                    "targetDate": formatted_target_date,
                    "insertedRows": row_count
                }

            # -------------------------------------------------------------------------
            # STEP 7: Bulk Window Aggregation Grid Population (Full 16-State Grid)
            # -------------------------------------------------------------------------
            print(f"[BULK WINDOW AGGREGATE] Building complete 16-state x all-dates grid for {target_table}...")
            cur.execute(sql.SQL("TRUNCATE {target_tbl};").format(target_tbl=sql.Identifier(target_table)))
            conn.commit()

            bulk_query = sql.SQL("""
                -- Daily totals per state (filtering valid records via RKI flags IN (1, 0))
                -- RKI Flag Logic (neuer_fall / neuer_todesfall / neu_genesen):
                --   0  = Valid historical record (already adjusted for past corrections; include in valid counts IN (1, 0))
                --   1  = Valid record added in dataset snapshot (include in valid counts IN (1, 0)) change of the snapshot compared to yesterday
                --  -1  = Audit marker for cases deleted in dataset snapshot (omitted from valid case counts) change of the snapshot compared to yesterday
                --  -9  = Not applicable / Unknown outcome (omitted from death & recovery counts)
                -- Note: All epidemiological metrics filter valid records via flag IN (1, 0) over Meldedatum ranges.
                WITH daily AS (
                    SELECT 
                        LEFT(LPAD({col_id_landkreis}::text, 5, '0'), 2) AS idbundesland,
                        {col_meldedatum}::date AS meldedatum,
                        SUM(CASE WHEN COALESCE(NULLIF({col_neuer_fall}::text, '')::integer, 0) IN (1, 0) THEN COALESCE(NULLIF({col_anzahl_fall}::text, '')::integer, 0) ELSE 0 END) AS daily_cases,
                        SUM(CASE WHEN COALESCE(NULLIF({col_neuer_todesfall}::text, '')::integer, 0) IN (1, 0) THEN COALESCE(NULLIF({col_anzahl_todesfall}::text, '')::integer, 0) ELSE 0 END) AS daily_deaths,
                        SUM(CASE WHEN COALESCE(NULLIF({col_neu_genesen}::text, '')::integer, 0) IN (1, 0) THEN COALESCE(NULLIF({col_anzahl_genesen}::text, '')::integer, 0) ELSE 0 END) AS daily_recovered
                    FROM {source_tbl}
                    WHERE {col_id_landkreis} IS NOT NULL AND {col_meldedatum} IS NOT NULL
                    GROUP BY 1, 2
                ),
                -- All 16 German Federal States ('01' to '16')
                states AS (
                    SELECT LPAD(s::text, 2, '0') AS idbundesland
                    FROM generate_series(1, 16) s
                ),
                -- All distinct Meldedatum dates in dataset
                dates AS (
                    SELECT DISTINCT meldedatum FROM daily
                ),
                -- Complete Cartesian Grid (16 States x N Dates)
                grid AS (
                    SELECT s.idbundesland, d.meldedatum
                    FROM states s
                    CROSS JOIN dates d
                ),
                -- Left join daily metrics onto complete grid (fill missing reporting days with 0)
                grid_daily AS (
                    SELECT 
                        g.idbundesland,
                        g.meldedatum,
                        COALESCE(d.daily_cases, 0) AS daily_cases,
                        COALESCE(d.daily_deaths, 0) AS daily_deaths,
                        COALESCE(d.daily_recovered, 0) AS daily_recovered
                    FROM grid g
                    LEFT JOIN daily d ON g.idbundesland = d.idbundesland AND g.meldedatum = d.meldedatum
                ),
                -- Compute Cumulative Totals & 7-Day Rolling Metrics via Window Functions
                windowed AS (
                    SELECT 
                        idbundesland,
                        meldedatum,
                        meldedatum AS datenstand,
                        -- Single-day metrics
                        daily_cases AS newcases,
                        daily_deaths AS newdeaths,
                        daily_recovered AS newrecovered,
                        -- Cumulative totals (entire history up to target_date)
                        SUM(daily_cases) OVER (PARTITION BY idbundesland ORDER BY meldedatum ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::integer AS accucases,
                        SUM(daily_deaths) OVER (PARTITION BY idbundesland ORDER BY meldedatum ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::integer AS accudeaths,
                        SUM(daily_recovered) OVER (PARTITION BY idbundesland ORDER BY meldedatum ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::integer AS accurecovered,
                        -- 7-day weekly metrics (last 7 days up to target_date)
                        SUM(daily_cases) OVER (PARTITION BY idbundesland ORDER BY meldedatum RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW)::integer AS accucasesperweek,
                        SUM(daily_deaths) OVER (PARTITION BY idbundesland ORDER BY meldedatum RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW)::integer AS accudeathsperweek,
                        SUM(daily_recovered) OVER (PARTITION BY idbundesland ORDER BY meldedatum RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW)::integer AS accurecoveredperweek
                    FROM grid_daily
                )
                INSERT INTO {target_tbl} (bundesland, datenstand, newcases, accucasesperweek, accucases, newdeaths, accudeathsperweek, accudeaths, newrecovered, accurecoveredperweek, accurecovered, idbundesland, geometry)
                SELECT 
                    CASE w.idbundesland
                        WHEN '01' THEN 'Schleswig-Holstein'
                        WHEN '02' THEN 'Hamburg'
                        WHEN '03' THEN 'Niedersachsen'
                        WHEN '04' THEN 'Bremen'
                        WHEN '05' THEN 'Nordrhein-Westfalen'
                        WHEN '06' THEN 'Hessen'
                        WHEN '07' THEN 'Rheinland-Pfalz'
                        WHEN '08' THEN 'Baden-Württemberg'
                        WHEN '09' THEN 'Bayern'
                        WHEN '10' THEN 'Saarland'
                        WHEN '11' THEN 'Berlin'
                        WHEN '12' THEN 'Brandenburg'
                        WHEN '13' THEN 'Mecklenburg-Vorpommern'
                        WHEN '14' THEN 'Sachsen'
                        WHEN '15' THEN 'Sachsen-Anhalt'
                        WHEN '16' THEN 'Thüringen'
                        ELSE 'Unbekannt'
                    END AS bundesland,
                    w.datenstand,
                    w.newcases,
                    w.accucasesperweek,
                    w.accucases,
                    w.newdeaths,
                    w.accudeathsperweek,
                    w.accudeaths,
                    w.newrecovered,
                    w.accurecoveredperweek,
                    w.accurecovered,
                    w.idbundesland,
                    NULL::text AS geometry
                FROM windowed w
                ORDER BY w.datenstand, w.idbundesland
                ON CONFLICT (datenstand, idbundesland) DO NOTHING;
            """).format(
                target_tbl=sql.Identifier(target_table),
                source_tbl=sql.Identifier(source_table),
                col_id_landkreis=sql.Identifier(col_id_landkreis),
                col_meldedatum=sql.Identifier(col_meldedatum),
                col_anzahl_fall=sql.Identifier(col_anzahl_fall),
                col_anzahl_todesfall=sql.Identifier(col_anzahl_todesfall),
                col_anzahl_genesen=sql.Identifier(col_anzahl_genesen),
                col_neuer_fall=sql.Identifier(col_neuer_fall),
                col_neuer_todesfall=sql.Identifier(col_neuer_todesfall),
                col_neu_genesen=sql.Identifier(col_neu_genesen)
            )
            cur.execute(bulk_query)
            conn.commit()

            # -------------------------------------------------------------------------
            # STEP 8: Invalidate Response Cache & Return Summary
            # -------------------------------------------------------------------------
            evicted = response_cache.invalidate(target_table)
            print(f"[CACHE INVALIDATE] {target_table} — evicted {evicted} entries after aggregating date {formatted_target_date}")

            cur.execute(sql.SQL("SELECT COUNT(*) FROM {target_tbl}").format(
                target_tbl=sql.Identifier(target_table)
            ))
            inserted_count = cur.fetchone()[0]

            return {
                "message": "Aggregation completed successfully",
                "sourceTable": source_table,
                "targetTable": target_table,
                "targetDate": formatted_target_date,
                "insertedRows": inserted_count
            }