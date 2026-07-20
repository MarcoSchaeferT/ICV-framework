# Gunicorn configuration file for dashboardDAVis backend
# https://docs.gunicorn.org/en/stable/settings.html

import multiprocessing
import os

# ---------------------------------------------------------------------------
# Server socket
# ---------------------------------------------------------------------------
bind = "0.0.0.0:5222"

# ---------------------------------------------------------------------------
# Worker processes
# ---------------------------------------------------------------------------
# Use gthread workers: they support Flask's async views (Flask internally
# runs async handlers via asyncio.run()) and provide true concurrency
# through threading within each worker process.
#
# Formula: workers = min(2 * CPU + 1, 4) — capped at 4 by default to keep the memory footprint
# low, since we use gthread with 4 threads (giving 16 concurrent request handlers).
# Configurable via GUNICORN_WORKERS env var.
workers = int(os.getenv("GUNICORN_WORKERS", min(2 * multiprocessing.cpu_count() + 1, 4)))
worker_class = "gthread"

# Threads per worker — each thread can handle one request concurrently.
# 4 threads × N workers gives good concurrency for I/O-bound DB queries
# without excessive memory overhead.
threads = 4

# ---------------------------------------------------------------------------
# Timeouts
# ---------------------------------------------------------------------------
# Large CSV uploads (up to 2.5 GB via Next.js proxy) and SVG generation
# can take a long time. The graceful timeout gives workers time to finish
# in-flight requests during reload/shutdown.
timeout = 300          # 5 minutes — matches proxyTimeout (120s) with margin
graceful_timeout = 120

# ---------------------------------------------------------------------------
# Request limits
# ---------------------------------------------------------------------------
# Allow large file uploads (CSV datasets up to 2.5 GB)
limit_request_line = 8190
limit_request_fields = 200

# ---------------------------------------------------------------------------
# Keep-alive
# ---------------------------------------------------------------------------
# Keep connections alive for reuse (Next.js proxy → backend)
keepalive = 5

# ---------------------------------------------------------------------------
# Preload app
# ---------------------------------------------------------------------------
# Preload the Flask app before forking workers. This:
# 1. Shares read-only memory (code, imports) across workers (copy-on-write)
# 2. Catches import errors early at startup
# 3. Reduces per-worker startup time
#
# IMPORTANT: The ResponseCache singleton is initialized before fork,
# but each forked worker gets its own copy (copy-on-write). This means
# each worker maintains its own cache. For this app's scale this is fine,
# but for multi-worker cache sharing, consider Redis in the future.
preload_app = True

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
accesslog = "-"        # stdout
errorlog = "-"         # stderr
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

# Use a cleaner access log format
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" %(D)sμs'

# ---------------------------------------------------------------------------
# Process naming
# ---------------------------------------------------------------------------
proc_name = "icv-backend"

# ---------------------------------------------------------------------------
# Server mechanics
# ---------------------------------------------------------------------------
# Restart workers after this many requests to prevent memory leaks
# from long-running processes (matplotlib, numpy allocations)
max_requests = 1000
max_requests_jitter = 50

# Temporary file directory for request bodies
tmp_upload_dir = None  # use system default
