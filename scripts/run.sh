#!/usr/bin/env bash
# run.sh — Single entry point for all script operations.
#
# Usage:
#   ./scripts/run.sh local <command> [options]
#
# Environment:
#   local   — http://localhost:9066  (worktree test server on port 9066)
#             Start it first with: ./scripts/start-worktree-server.sh
#             Stop it after with:  ./scripts/stop-worktree-server.sh
#
# Commands:
#   deploy  — Build + upload the plugin
#   seed    — Populate demo/test data
#   demo    — Interactive feature walkthrough (auto-seeds if needed)
#   smoke   — Non-interactive API assertions (auto-seeds if needed)
#   test    — Unit + E2E tests via test-phases.sh [go|webapp|e2e [0-4]]
#   all     — deploy + seed + smoke  (the typical CI flow)
#
# Credentials:
#   Uses built-in defaults (no setup needed)
#
# Examples:
#   ./scripts/run.sh local all
#   ./scripts/run.sh local deploy
#   ./scripts/run.sh local test
#   ./scripts/run.sh local test e2e 2

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Parse env + command ────────────────────────────────────────────────────────

ENV="${1:-}"
CMD="${2:-}"

if [[ -z "$ENV" || -z "$CMD" ]]; then
    echo "Usage: $0 local <deploy|seed|demo|smoke|test|all> [args]"
    echo ""
    echo "  Environment:  local — worktree test server at http://localhost:9066"
    echo "  Commands:     deploy  — build + upload plugin"
    echo "                seed    — populate demo data"
    echo "                demo    — interactive feature walkthrough"
    echo "                smoke   — API assertion tests"
    echo "                test    — unit + E2E tests [go|webapp|e2e [0-4]]"
    echo "                all     — deploy + seed + smoke"
    exit 1
fi

shift 2  # remaining args forwarded to the target script

# ── Apply environment defaults ─────────────────────────────────────────────────

case "$ENV" in
    local)
        MM_WORKTREE_PORT="${MM_WORKTREE_PORT:-9066}"
        export MM_URL="${MM_URL:-http://localhost:${MM_WORKTREE_PORT}}"
        export MM_ADMIN_USER="${MM_ADMIN_USER:-sysadmin}"
        export MM_ADMIN_PASSWORD="${MM_ADMIN_PASSWORD:-Sys@dmin-sample1}"
        export MM_TEAM_NAME="${MM_TEAM_NAME:-ad-1}"
        export MM_WORKTREE_DB="${MM_WORKTREE_DB:-mattermost_worktree}"
        export MM_LOCAL_SOCKET="${MM_LOCAL_SOCKET:-/var/tmp/mattermost_worktree.socket}"
        ;;
    *)
        echo "ERROR: Unknown environment '$ENV'. Use 'local'."
        exit 1
        ;;
esac

export MM_SERVICESETTINGS_SITEURL="$MM_URL"

echo "=== Environment: $ENV ($MM_URL) ==="
echo ""

# ── Ensure the worktree server is running (local env only) ────────────────────
# deploy.sh hangs for ~15s on a curl to MM_URL when nothing is listening, then fails
# with a useless "Login failed" message. Bring the server up first if it's not already.
ensure_worktree_server() {
    [[ "$ENV" != "local" ]] && return 0
    # Server is considered up if either the local socket exists or something is listening on the port.
    if [[ -S "$MM_LOCAL_SOCKET" ]] \
        || lsof -nP -iTCP:"$MM_WORKTREE_PORT" -sTCP:LISTEN -t > /dev/null 2>&1; then
        return 0
    fi
    echo "Worktree server not running on port $MM_WORKTREE_PORT — starting it..."
    "$SCRIPT_DIR/start-worktree-server.sh"
    echo ""
}

ensure_worktree_server

# ── Dispatch ───────────────────────────────────────────────────────────────────

run_deploy() {
    # Unset MM_SERVICESETTINGS_ENABLEDEVELOPER before building.
    # When this var is set, the Makefile only builds for the local machine's arch
    # (darwin-arm64), leaving the linux-amd64/arm64 binaries stale from a previous build.
    unset MM_SERVICESETTINGS_ENABLEDEVELOPER

    # Reset plugin DB version so morph reruns all migrations on next load.
    echo "Resetting plugin DB migration version to 0.0.0..."
    PGPASSWORD=mostest psql -h localhost -U mmuser -d "${MM_WORKTREE_DB:-mattermost_worktree}" \
        -c "UPDATE ir_system SET svalue = '0.0.0' WHERE skey = 'DatabaseVersion';" > /dev/null 2>&1 || true
    echo "    DB version reset."

    # Always build a fresh darwin-arm64 binary so the bundle is current for
    # Mattermost servers running natively on macOS (make dist only builds linux).
    echo "Building plugin server binary for darwin-arm64..."
    (cd "$REPO_ROOT/server" && env GOOS=darwin GOARCH=arm64 go build -trimpath -o dist/plugin-darwin-arm64 .)

    echo "Building plugin (linux-amd64 + linux-arm64)..."
    (cd "$REPO_ROOT" && make dist)
    echo ""
    bash "$SCRIPT_DIR/deploy.sh" "$@"
}

run_seed() {
    bash "$SCRIPT_DIR/seed.sh" --skip-deploy "$@"
}

seed_state_is_stale() {
    local state_file="$SCRIPT_DIR/seed-state.env"
    [[ ! -f "$state_file" ]] && return 0
    local stored_url
    stored_url=$(grep '^MM_URL=' "$state_file" | cut -d= -f2- | tr -d '"')
    [[ "$stored_url" != "$MM_URL" ]] && return 0
    return 1
}

run_demo() {
    if seed_state_is_stale; then
        echo "Seed state is missing or was created for a different server — running seed first..."
        echo ""
        run_seed
        echo ""
    fi
    bash "$SCRIPT_DIR/demo.sh" "$@"
}

run_smoke() {
    if seed_state_is_stale; then
        echo "Seed state is missing or was created for a different server — running seed first..."
        echo ""
        run_seed
        echo ""
    fi
    bash "$SCRIPT_DIR/smoke_test.sh" "$@"
}

run_test() {
    bash "$SCRIPT_DIR/test-phases.sh" "$@"
}

case "$CMD" in
    deploy)
        run_deploy "$@"
        ;;
    seed)
        # Deploy first unless --skip-deploy is passed
        if [[ " $* " != *"--skip-deploy"* ]]; then
            run_deploy
            echo ""
        fi
        run_seed "$@"
        ;;
    demo)
        run_demo "$@"
        ;;
    smoke)
        run_smoke "$@"
        ;;
    test)
        run_test "$@"
        ;;
    all)
        run_deploy
        echo ""
        run_seed
        echo ""
        run_smoke
        ;;
    *)
        echo "ERROR: Unknown command '$CMD'. Use: deploy|seed|demo|smoke|test|all"
        exit 1
        ;;
esac