\set ON_ERROR_STOP on

-- Query-level timings and I/O statistics. The server image preloads the
-- module, while CREATE EXTENSION exposes its views in this database.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- The statements below are generated only when the corresponding imported
-- dataset and all required columns exist. \gexec keeps this file repeatable
-- for both empty installations and existing database volumes.
SELECT 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_epi_date ON public.epidemiology_geography_whole_df_w_geometry (date)'
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'epidemiology_geography_whole_df_w_geometry'
    AND column_name = 'date'
)
\gexec

SELECT 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_epi_country_level_date ON public.epidemiology_geography_whole_df_w_geometry (country_name, aggregation_level, date)'
WHERE (
  SELECT count(*)
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'epidemiology_geography_whole_df_w_geometry'
    AND column_name IN ('country_name', 'aggregation_level', 'date')
) = 3
\gexec

-- Country-filtered map queries commonly use
--   WHERE iso_a3 = ... ORDER BY id
-- Create the matching composite index for every sufficiently large imported
-- table. `id` is intentionally not indexed separately here: imported tables
-- already use it as their primary key. Small tables are left to sequential
-- scans, which avoids index maintenance with no practical query benefit.
--
-- The generated name is capped below PostgreSQL's 63-byte identifier limit.
-- Existing valid, non-partial B-tree indexes whose first two key columns are
-- (iso_a3, id) are detected by structure, independent of their name.
SELECT format(
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS %I ON %I.%I (%I, %I)',
  format(
    'idx_iso_a3_id_%s_%s',
    left(data_table.relname, 38),
    left(md5(data_namespace.nspname || '.' || data_table.relname), 8)
  ),
  data_namespace.nspname,
  data_table.relname,
  iso_column.attname,
  id_column.attname
)
FROM pg_catalog.pg_class AS data_table
JOIN pg_catalog.pg_namespace AS data_namespace
  ON data_namespace.oid = data_table.relnamespace
JOIN pg_catalog.pg_attribute AS iso_column
  ON iso_column.attrelid = data_table.oid
 AND iso_column.attname = 'iso_a3'
 AND iso_column.attnum > 0
 AND NOT iso_column.attisdropped
JOIN pg_catalog.pg_attribute AS id_column
  ON id_column.attrelid = data_table.oid
 AND id_column.attname = 'id'
 AND id_column.attnum > 0
 AND NOT id_column.attisdropped
WHERE data_namespace.nspname = 'public'
  AND data_table.relkind = 'r'
  AND pg_catalog.pg_total_relation_size(data_table.oid) >= 10 * 1024 * 1024
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS existing_index
    JOIN pg_catalog.pg_class AS index_relation
      ON index_relation.oid = existing_index.indexrelid
    JOIN pg_catalog.pg_am AS index_method
      ON index_method.oid = index_relation.relam
    WHERE existing_index.indrelid = data_table.oid
      AND existing_index.indisvalid
      AND existing_index.indisready
      AND existing_index.indpred IS NULL
      AND existing_index.indexprs IS NULL
      AND existing_index.indnkeyatts >= 2
      AND index_method.amname = 'btree'
      AND existing_index.indkey[0] = iso_column.attnum
      AND existing_index.indkey[1] = id_column.attnum
  )
ORDER BY data_namespace.nspname, data_table.relname
\gexec

-- Refresh planner statistics for the explicitly optimized datasets. The
-- generic iso_a3 indexes use the tables' existing column statistics.
SELECT format('ANALYZE public.%I', table_name)
FROM (
  VALUES
    ('epidemiology_geography_whole_df_w_geometry'),
    ('seas5_forecast_aegypti_habitat_probability'),
    ('seas5_forecast_albopictus_habitat_probability')
) AS optimized_tables(table_name)
WHERE to_regclass(format('public.%I', table_name)) IS NOT NULL
\gexec
