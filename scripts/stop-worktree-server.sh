#!/usr/bin/env bash
# stop-worktree-server.sh — Stop the local Mattermost worktree server started by
# start-worktree-server.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.worktree-server.pid"

if [[ ! -f "$PID_FILE" ]]; then
    echo "No worktree server PID file found — server is not running."
    exit 0
fi

PID=$(cat "$PID_FILE")

if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping worktree server (PID $PID)..."
    kill "$PID"
    rm -f "$PID_FILE"
    echo "Stopped."
else
    echo "Process $PID is not running — removing stale PID file."
    rm -f "$PID_FILE"
fi