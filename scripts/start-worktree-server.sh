#!/usr/bin/env bash
# start-worktree-server.sh — Build and start a local Mattermost server on port 9066
# for plugin worktree testing. Uses a separate DB (mattermost_worktree) so it does
# not interfere with the main server on port 8065.
#
# Usage:
#   ./scripts/start-worktree-server.sh [--rebuild]
#
#   --rebuild   Force a fresh go build even if the binary already exists.
#
# Requires:
#   - PostgreSQL accessible at localhost:5432 with mmuser/mostest
#   - /Users/catalintomai/mattermost/mattermost checked out (MM_SERVER_REPO override supported)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.worktree-server.pid"
LOG_DIR="/var/tmp/mattermost-worktree-logs"
LOG_FILE="$LOG_DIR/mattermost.log"

MM_SERVER_REPO="${MM_SERVER_REPO:-}"
if [[ -z "$MM_SERVER_REPO" ]]; then
    echo "ERROR: MM_SERVER_REPO not set. Point it to your Mattermost server checkout:"
    echo "  export MM_SERVER_REPO=/path/to/mattermost/server"
    exit 1
fi

MM_WORKTREE_PORT="${MM_WORKTREE_PORT:-9066}"
MM_WORKTREE_DB="${MM_WORKTREE_DB:-mattermost_worktree}"
BINARY="$MM_SERVER_REPO/bin/mattermost"

REBUILD=false
for arg in "$@"; do
    [[ "$arg" == "--rebuild" ]] && REBUILD=true
done

# ── Guard: already running ─────────────────────────────────────────────────────

if [[ -f "$PID_FILE" ]]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Worktree server is already running (PID $OLD_PID) on port $MM_WORKTREE_PORT."
        exit 0
    else
        echo "Stale PID file found — removing."
        rm -f "$PID_FILE"
    fi
fi

# ── Build binary if needed ─────────────────────────────────────────────────────

if [[ "$REBUILD" == true || ! -f "$BINARY" ]]; then
    echo "Building Mattermost server binary..."
    (cd "$MM_SERVER_REPO" && go build -ldflags='-X github.com/mattermost/mattermost/server/public/model.BuildNumber=dev' -o bin/mattermost ./cmd/mattermost)
    echo "Build complete."
fi

# ── Ensure PostgreSQL is running ──────────────────────────────────────────────

pg_ready() { pg_isready -h localhost -p 5432 -q 2>/dev/null; }

if ! pg_ready; then
    echo "PostgreSQL not ready — starting mattermost-postgres Docker container..."
    docker info > /dev/null 2>&1 || { echo "ERROR: Docker is not running. Start Docker Desktop first."; exit 1; }
    docker start mattermost-postgres
    echo -n "Waiting for PostgreSQL..."
    for i in $(seq 1 30); do
        sleep 1
        echo -n "."
        pg_ready && break
    done
    echo ""
    pg_ready || { echo "ERROR: mattermost-postgres did not become ready."; exit 1; }
fi

# ── Create database if it doesn't exist ───────────────────────────────────────

echo "Ensuring database '$MM_WORKTREE_DB' exists..."
PGPASSWORD=mostest psql -h localhost -U mmuser -d postgres \
    -c "CREATE DATABASE $MM_WORKTREE_DB OWNER mmuser;" 2>/dev/null || true

# ── Write config ───────────────────────────────────────────────────────────────

CONFIG_DIR="$SCRIPT_DIR/.worktree-server"
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOG_DIR"

cat > "$CONFIG_DIR/config.json" <<EOF
{
    "ServiceSettings": {
        "SiteURL": "http://localhost:$MM_WORKTREE_PORT",
        "ListenAddress": ":$MM_WORKTREE_PORT",
        "EnableDeveloper": true,
        "EnableTesting": true,
        "EnableLocalMode": true,
        "LocalModeSocketLocation": "$CONFIG_DIR/mattermost.socket",
        "WebserverMode": "static",
        "ClientDirectory": "$MM_SERVER_REPO/client"
    },
    "SqlSettings": {
        "DriverName": "postgres",
        "DataSource": "postgres://mmuser:mostest@localhost/$MM_WORKTREE_DB?sslmode=disable&connect_timeout=10&binary_parameters=yes",
        "MaxIdleConns": 10,
        "MaxOpenConns": 100,
        "ConnMaxLifetimeMilliseconds": 3600000,
        "ConnMaxIdleTimeMilliseconds": 300000
    },
    "FileSettings": {
        "DriverName": "local",
        "Directory": "$CONFIG_DIR/data/"
    },
    "LogSettings": {
        "EnableConsole": false,
        "ConsoleLevel": "INFO",
        "EnableFile": true,
        "FileLocation": "$LOG_DIR",
        "FileLevel": "INFO"
    },
    "EmailSettings": {
        "SendEmailNotifications": false,
        "SMTPServer": "localhost",
        "SMTPPort": "10025",
        "EnableSMTPAuth": false,
        "FeedbackEmail": "admin@localhost",
        "ReplyToAddress": "admin@localhost"
    },
    "TeamSettings": {
        "EnableOpenServer": true
    },
    "PluginSettings": {
        "Enable": true,
        "EnableUploads": true,
        "Directory": "./plugins",
        "ClientDirectory": "./client/plugins"
    },
    "MetricsSettings": {
        "ListenAddress": ":9067"
    }
}
EOF

# ── Start server ───────────────────────────────────────────────────────────────

echo "Starting Mattermost server on port $MM_WORKTREE_PORT (DB: $MM_WORKTREE_DB)..."
echo "Log: $LOG_FILE"

cd "$MM_SERVER_REPO"
MM_SERVICESETTINGS_LISTENADDRESS=":$MM_WORKTREE_PORT" \
MM_METRICSSETTINGS_LISTENADDRESS=":$((MM_WORKTREE_PORT + 1))" \
MM_SERVICESETTINGS_ENABLEDEVELOPER="true" \
MM_SERVICESETTINGS_ENABLELOCALMODE="true" \
MM_SERVICESETTINGS_LOCALMODESOCKETLOCATION="$CONFIG_DIR/mattermost.socket" \
    "$BINARY" server -c "$CONFIG_DIR/config.json" \
    > "$LOG_FILE" 2>&1 &

SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"
echo "Started (PID $SERVER_PID)."

# ── Wait for server to be ready ────────────────────────────────────────────────

echo -n "Waiting for server to be ready..."
for i in $(seq 1 60); do
    if curl -sf "http://localhost:$MM_WORKTREE_PORT/api/v4/system/ping" > /dev/null 2>&1; then
        echo " ready."
        echo "Worktree server running at http://localhost:$MM_WORKTREE_PORT"
        exit 0
    fi
    sleep 1
    echo -n "."
done

echo ""
echo "ERROR: Server did not become ready within 60s. Check $LOG_FILE"
exit 1