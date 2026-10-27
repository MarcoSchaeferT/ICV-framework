# Backend documentation rules

These rules apply to `backend/**/*.py` and `backend/API_docs/*.yml`. The backend is a Flask application with PostgreSQL access through psycopg, Redis-backed shared state, and Flasgger endpoint descriptions. Document the behavior implemented in the code; when an older rule or guide disagrees with runtime behavior, flag the discrepancy instead of copying it into a new docstring.

## Sources of truth

- Python type hints and Pydantic models define in-process data shapes. Docstrings explain meaning, units, defaults, return values, exceptions, and side effects that types cannot express.
- `backend/API_docs/*.yml` describes the public HTTP contract: method, route, query or form fields, status codes, response variants, and realistic examples. Keep these files aligned with Flask route decorators and response construction. Do not duplicate full HTTP schemas in route docstrings.
- Tests in `backend/tests` demonstrate edge cases. Do not present a test fixture as a production guarantee unless the implementation enforces it.
- Use actual route paths, such as `/api/getDataFromDB`, rather than paths inferred from frontend documentation. Check environment-dependent limits and defaults in their defining module before documenting them.

## Python inline documentation

- Add a module docstring to a module whose purpose or integration points are not obvious from its filename. Give each public class, Pydantic model, route handler, and nontrivial function a docstring. Document private helpers when they encode a data contract, lifecycle rule, failure fallback, or performance-sensitive operation.
- Write a short imperative or descriptive first line. Use Google-style `Args:`, `Query Parameters:`, `Returns:`, `Yields:`, `Raises:`, and `Example:` sections consistently when they clarify a non-obvious contract. Do not mix NumPy-style (`Parameters / ----------`) and Google-style docstrings.
- `content/docs/developer-guide/api/python/*` is generated output from `scripts/generate-python-api-docs.py` (invoked via `npm run docs:api`). Do not edit generated `.mdx` files manually; update the Python docstrings and rerun `npm run docs:api`.
- Explain input units and coordinate order, nullable or sentinel values, ordering of parallel arrays, error payloads, and whether an operation reads or writes PostgreSQL, Redis, files, or process-local cache. State worker and thread implications where relevant.
- For schema-like classes and response formats, include a small executable Python `Example:` or `Examples:` block with realistic public-health data when it clarifies usage. Never use secrets, live credentials, or invented production guarantees in examples.
- Do not restate each line of code, add redundant comments to obvious assignments, or use a docstring to hide a known mismatch. Preserve existing names and spellings in documented APIs, including legacy names.

## Architecture and safety context

- Describe database queries in terms of the actual psycopg helpers and parameterized values. Distinguish SQL identifiers composed with `psycopg.sql.Identifier` from bound data values.
- Make the distinction between process-local caches or pools and cross-worker Redis coordination explicit. Document fallback behavior if Redis is unavailable and the resulting visibility limits.
- Document upload flow stages as implemented: request streaming, upload ID creation, background processing, progress polling, cleanup, and cache invalidation. Mention error and cancellation behavior where the code provides it.
- Document `responseFormat=map-grid-v1` as a column-oriented payload with aligned arrays; describe geometry coordinate order from the producer and consumer code. Keep ENSO column formats and reference periods aligned with `enso_schema.py`.
- Keep documentation-only changes free of executable behavior changes. Report implementation gaps separately. Verify with AST parsing, relevant backend tests, and a comparison that ignores only docstrings/comments.
