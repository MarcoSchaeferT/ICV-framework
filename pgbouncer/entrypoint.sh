#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# PgBouncer entrypoint – generates configuration from environment variables.
# Credentials are injected via Docker Compose env / .env and never baked
# into the image.
# ---------------------------------------------------------------------------

DB_HOST="${PGBOUNCER_DB_HOST:-icv-database}"
DB_PORT="${PGBOUNCER_DB_PORT:-5333}"
DB_NAME="${PGBOUNCER_DB_NAME:-icv-database}"
DB_USER="${PGBOUNCER_DB_USER:-icv_user}"
DB_PASSWORD="${PGBOUNCER_DB_PASSWORD:-password}"
POOL_MODE="${PGBOUNCER_POOL_MODE:-transaction}"
MAX_CLIENT_CONN="${PGBOUNCER_MAX_CLIENT_CONN:-100}"
DEFAULT_POOL_SIZE="${PGBOUNCER_DEFAULT_POOL_SIZE:-20}"
MIN_POOL_SIZE="${PGBOUNCER_MIN_POOL_SIZE:-5}"
RESERVE_POOL_SIZE="${PGBOUNCER_RESERVE_POOL_SIZE:-5}"
LOG_CONNECTIONS="${PGBOUNCER_LOG_CONNECTIONS:-0}"
LOG_DISCONNECTIONS="${PGBOUNCER_LOG_DISCONNECTIONS:-0}"

# ── Generate pgbouncer.ini ────────────────────────────────────────────────
cat > /etc/pgbouncer/pgbouncer.ini << EOF
;; =========================================================================
;; PgBouncer configuration for ICV
;; Auto-generated from environment variables – do not edit manually.
;; =========================================================================

[databases]
${DB_NAME} = host=${DB_HOST} port=${DB_PORT} dbname=${DB_NAME}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432

;; --- Authentication ------------------------------------------------------
;; 'plain' is acceptable here because PgBouncer is only reachable on the
;; Docker-internal bridge network (not exposed to the host).
auth_type = plain
auth_file = /etc/pgbouncer/userlist.txt

;; --- Pool settings --------------------------------------------------------
;; 'transaction' mode: server connection is returned to the pool after each
;; transaction (COMMIT / ROLLBACK).  This is the best mode for web
;; applications because it maximises connection reuse across requests.
pool_mode = ${POOL_MODE}

;; max_client_conn  – total client connections PgBouncer will accept.
;;                    With 4 Gunicorn workers × 4 threads = 16 concurrent
;;                    connections, plus headroom for admin/monitoring.
max_client_conn = ${MAX_CLIENT_CONN}

;; default_pool_size – server connections kept open per database/user pair.
;;                     20 connections shared across all workers is plenty
;;                     for typical dashboard workloads.
default_pool_size = ${DEFAULT_POOL_SIZE}

;; min_pool_size – always keep this many server connections open.
min_pool_size = ${MIN_POOL_SIZE}

;; reserve_pool_size – extra connections for burst traffic.
reserve_pool_size = ${RESERVE_POOL_SIZE}
reserve_pool_timeout = 3

;; --- psycopg3 compatibility ----------------------------------------------
;; psycopg3 sends startup parameters that PgBouncer must ignore in
;; transaction/statement pool mode (they are session-level settings).
ignore_startup_parameters = extra_float_digits,options

;; --- Logging --------------------------------------------------------------
log_connections = ${LOG_CONNECTIONS}
log_disconnections = ${LOG_DISCONNECTIONS}
log_pooler_errors = 1
stats_period = 60

;; --- Admin / stats --------------------------------------------------------
admin_users = ${DB_USER}
stats_users = ${DB_USER}

;; --- Timeouts -------------------------------------------------------------
;; server_idle_timeout: close unused server connections after 10 minutes.
server_idle_timeout = 600

;; client_idle_timeout: 0 = no limit (let the app manage idle connections).
client_idle_timeout = 0

;; server_connect_timeout: how long to wait when opening a new server conn.
server_connect_timeout = 15

;; server_login_retry: retry interval (seconds) if server login fails.
server_login_retry = 1

;; query_wait_timeout: how long a client waits in queue for a server conn.
;; Set high enough for large CSV uploads / long queries.
query_wait_timeout = 120

;; --- TCP keepalive (detect dead connections early) -------------------------
tcp_keepalive = 1
tcp_keepidle = 30
tcp_keepintvl = 10
tcp_keepcnt = 3
EOF

# ── Generate userlist.txt ──────────────────────────────────────────────────
cat > /etc/pgbouncer/userlist.txt << EOF
"${DB_USER}" "${DB_PASSWORD}"
EOF

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  PgBouncer starting                                        ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Database : ${DB_NAME} → ${DB_HOST}:${DB_PORT}"
echo "║  Listen   : 0.0.0.0:6432"
echo "║  Pool mode: ${POOL_MODE}"
echo "║  Pool size: ${DEFAULT_POOL_SIZE} (min ${MIN_POOL_SIZE}, reserve ${RESERVE_POOL_SIZE})"
echo "║  Max conns: ${MAX_CLIENT_CONN}"
echo "║  Logging  : connections=${LOG_CONNECTIONS}, disconnections=${LOG_DISCONNECTIONS}"
echo "╚══════════════════════════════════════════════════════════════╝"

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
