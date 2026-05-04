#!/usr/bin/env bash
# seed.sh — Populates a Mattermost instance with playbooks and runs for testing
# the new_channel_only feature in this branch.
#
# Features seeded:
#   1. Playbook with new_channel_only=true (enforces new channel creation)
#   2. Playbook with new_channel_only=false (allows existing channel linking)
#
# Usage:
#   ./scripts/seed.sh [MM_URL] [ADMIN_USERNAME] [ADMIN_PASSWORD] [TEAM_NAME]
#
# Defaults:
#   MM_URL=http://localhost:9066
#   ADMIN_USERNAME=sysadmin
#   ADMIN_PASSWORD=Sys@dmin-sample1
#   TEAM_NAME=ad-1
#
# Prerequisites:
#   - A running Mattermost server with the playbooks plugin deployed
#   - curl and jq installed
#
# Options:
#   --skip-deploy    Skip the build+deploy step (plugin already running)
#
# If the plugin's DB schema is stale (e.g. migration was added to an existing version),
# reset the schema version before deploying:
#   Local:  PGPASSWORD=mostest docker exec -e PGPASSWORD=mostest mattermost-postgres \
#             psql -U mmuser -d mattermost_test \
#             -c "UPDATE ir_system SET svalue = '0.0.0' WHERE skey = 'DatabaseVersion';"

set -euo pipefail
trap 'echo ""; echo "Interrupted."; exit 130' INT TERM
trap 'echo "ERROR: script failed at line $LINENO (exit $?)" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Parse flags ---
SKIP_DEPLOY=false
POSITIONAL=()
for arg in "$@"; do
    case "$arg" in
        --skip-deploy) SKIP_DEPLOY=true ;;
        *) POSITIONAL+=("$arg") ;;
    esac
done

# --- Configuration (positional args override environment) ---
MM_URL="${POSITIONAL[0]:-${MM_URL:-http://localhost:9066}}"
ADMIN_USER="${POSITIONAL[1]:-${MM_ADMIN_USER:-sysadmin}}"
ADMIN_PASS="${POSITIONAL[2]:-${MM_ADMIN_PASSWORD:-Sys@dmin-sample1}}"
TEAM_NAME="${POSITIONAL[3]:-${MM_TEAM_NAME:-ad-1}}"

# Auto-skip local deploy when targeting a remote server
if [[ "$MM_URL" != *"localhost"* && "$MM_URL" != *"127.0.0.1"* ]]; then
    SKIP_DEPLOY=true
fi

API="$MM_URL/api/v4"
PB_API="$MM_URL/plugins/playbooks/api/v0"
GQL="$MM_URL/plugins/playbooks/api/v0/query"

echo "=== Playbooks Demo Seed Script ==="
echo "Server: $MM_URL"
echo "Team:   $TEAM_NAME"
echo ""

# --- Step 0: Build and deploy plugin ---
if [ "$SKIP_DEPLOY" = false ]; then
    echo "--- Building plugin..."
    (cd "$REPO_ROOT" && make dist)
    echo "    Build complete. Deploying..."
    MM_URL="$MM_URL" MM_ADMIN_USER="$ADMIN_USER" MM_ADMIN_PASSWORD="$ADMIN_PASS" \
        bash "$SCRIPT_DIR/deploy.sh"
    echo "    Plugin deployed. Waiting for server to load it..."
    sleep 3
else
    echo "--- Skipping deploy (--skip-deploy)"
fi
echo ""

# --- Helper functions ---
die() { echo "ERROR: $*" >&2; exit 1; }

auth_header() {
    echo "Authorization: Bearer $TOKEN"
}

mm_api() {
    local method="$1" path="$2"
    shift 2
    curl -sS -X "$method" "$API$path" \
        -H "$(auth_header)" \
        -H "Content-Type: application/json" \
        "$@"
}

pb_api() {
    local method="$1" path="$2"
    shift 2
    curl -sS -X "$method" "$PB_API$path" \
        -H "$(auth_header)" \
        -H "Content-Type: application/json" \
        "$@"
}

graphql() {
    local opname="$1" query="$2"
    curl -sS -X POST "$GQL" \
        -H "$(auth_header)" \
        -H "Content-Type: application/json" \
        -d "{\"operationName\": \"$opname\", \"query\": \"mutation $opname $query\"}"
}

# --- Step 1: Wait for server ---
echo "--- Waiting for server at $MM_URL..."
for i in $(seq 1 30); do
    if curl -sS --max-time 3 "$API/system/ping" > /dev/null 2>&1; then
        echo "    Server is up."
        break
    fi
    [ "$i" -eq 30 ] && die "Server not responding at $MM_URL after 30 attempts."
    echo "    Waiting... ($i/30)"
    sleep 2
done

# --- Step 2: Authenticate as admin ---
echo "--- Authenticating as $ADMIN_USER..."
LOGIN_RESP=$(curl -sS --max-time 10 -i -X POST "$API/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"login_id\": \"$ADMIN_USER\", \"password\": \"$ADMIN_PASS\"}" 2>&1)

TOKEN=$(echo "$LOGIN_RESP" | grep -i '^token:' | awk '{print $2}' | tr -d '\r\n' || true)

if [ -z "$TOKEN" ]; then
    echo "    Login failed — creating admin user '$ADMIN_USER'..."

    curl -sS --max-time 10 -X PUT "$API/config/patch" \
        -H "Content-Type: application/json" \
        -d '{"TeamSettings": {"EnableOpenServer": true}}' > /dev/null 2>&1 || true

    CREATE_ADMIN_RESP=$(curl -sS --max-time 10 -X POST "$API/users" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"sysadmin@sample.mattermost.com\",
            \"username\": \"$ADMIN_USER\",
            \"password\": \"$ADMIN_PASS\",
            \"first_name\": \"System\",
            \"last_name\": \"Admin\"
        }" 2>&1)

    CREATED_ID=$(echo "$CREATE_ADMIN_RESP" | jq -r '.id // empty' 2>/dev/null)
    if [ -z "$CREATED_ID" ]; then
        echo "    Create response: $(echo "$CREATE_ADMIN_RESP" | jq -r '.message // .' 2>/dev/null || echo "$CREATE_ADMIN_RESP")"
        die "Failed to create admin user and login failed. Ensure the server is running and accessible."
    fi
    echo "    Created user $ADMIN_USER (ID: $CREATED_ID)"

    LOGIN_RESP=$(curl -sS --max-time 10 -i -X POST "$API/users/login" \
        -H "Content-Type: application/json" \
        -d "{\"login_id\": \"$ADMIN_USER\", \"password\": \"$ADMIN_PASS\"}" 2>&1)

    TOKEN=$(echo "$LOGIN_RESP" | grep -i '^token:' | awk '{print $2}' | tr -d '\r\n')
    [ -z "$TOKEN" ] && die "Created admin user but still cannot authenticate."

    curl -sS --max-time 10 -X PUT "$API/users/$CREATED_ID/roles" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"roles": "system_admin system_user"}' > /dev/null 2>&1 || true
    echo "    Promoted to system_admin."
fi

echo "    Authenticated (token: ${TOKEN:0:8}...)"
ADMIN_ID=$(mm_api GET /users/me | jq -r '.id')
echo "    Admin user ID: $ADMIN_ID"

# --- Enable developer mode so PlaybookAttributesAllowed() passes without a license ---
echo "--- Enabling developer mode..."
_LOCAL_SOCKET="${MM_LOCAL_SOCKET:-/var/tmp/mattermost_local.socket}"
if [[ -S "$_LOCAL_SOCKET" ]]; then
    _CFG=$(curl -s -o /dev/null -w "%{http_code}" \
        --unix-socket "$_LOCAL_SOCKET" \
        -X PUT "http://localhost/api/v4/config/patch" \
        -H "Content-Type: application/json" \
        -d '{"ServiceSettings":{"EnableDeveloper":true,"EnableTesting":true},"TeamSettings":{"EnableOpenServer":true,"EnableUserCreation":true,"EnableTeamCreation":true}}' \
        2>/dev/null || echo "000")
    echo "    Developer mode enabled via socket (HTTP $_CFG)."
else
    CONFIG_RESP=$(mm_api PUT /config/patch -d '{"ServiceSettings": {"EnableDeveloper": true, "EnableTesting": true}, "TeamSettings": {"EnableOpenServer": true}}')
    CONFIG_ERR=$(echo "$CONFIG_RESP" | jq -r '.message // empty' 2>/dev/null)
    if [ -n "$CONFIG_ERR" ]; then
        echo "    WARNING: Config patch failed: $CONFIG_ERR"
    else
        echo "    Developer mode enabled."
    fi
fi

# --- Step 3: Ensure team exists ---
echo "--- Finding or creating team '$TEAM_NAME'..."
TEAM_RESP=$(mm_api GET "/teams/name/$TEAM_NAME" 2>/dev/null)
TEAM_ID=$(echo "$TEAM_RESP" | jq -r 'select(.status_code == null) | .id // empty' 2>/dev/null)

if [ -z "$TEAM_ID" ]; then
    echo "    Team not found — creating..."
    _TDISPLAY="$(echo "$TEAM_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')"
    _TBODY="{\"name\": \"$TEAM_NAME\", \"display_name\": \"$_TDISPLAY\", \"type\": \"O\"}"
    # Prefer local socket: localCreateTeam bypasses the create_team permission check,
    # which fails on fresh DBs where the roles table has not been initialized yet.
    if [[ -S "$_LOCAL_SOCKET" ]]; then
        TEAM_RESP=$(curl -s --unix-socket "$_LOCAL_SOCKET" \
            -X POST "http://localhost/api/v4/teams" \
            -H "Content-Type: application/json" \
            -d "$_TBODY" 2>/dev/null || echo '{}')
    else
        TEAM_RESP=$(mm_api POST /teams -d "$_TBODY")
    fi
    TEAM_ID=$(echo "$TEAM_RESP" | jq -r 'select(.status_code == null) | .id // empty' 2>/dev/null)
    if [ -z "$TEAM_ID" ] || [ "$TEAM_ID" = "null" ]; then
        ERR_MSG=$(echo "$TEAM_RESP" | jq -r '.message // .id // .' 2>/dev/null || echo "$TEAM_RESP")
        die "Failed to create team '$TEAM_NAME': $ERR_MSG"
    fi
    echo "    Created team: $TEAM_ID"
    # localCreateTeam doesn't add the creator as a member — add admin explicitly.
    if [[ -S "$_LOCAL_SOCKET" ]]; then
        curl -s -o /dev/null --unix-socket "$_LOCAL_SOCKET" \
            -X POST "http://localhost/api/v4/teams/$TEAM_ID/members" \
            -H "Content-Type: application/json" \
            -d "{\"team_id\": \"$TEAM_ID\", \"user_id\": \"$ADMIN_ID\"}" 2>/dev/null || true
    fi
else
    echo "    Team ID: $TEAM_ID"
fi

# --- Step 4: Ensure demo-operator user exists ---
echo "--- Ensuring second user 'demo-operator' exists..."
OPERATOR_RESP=$(mm_api POST /users -d '{
    "email": "demo-operator@example.com",
    "username": "demo-operator",
    "password": "Operator@1234567",
    "first_name": "Demo",
    "last_name": "Operator"
}' 2>/dev/null || true)

OPERATOR_ID=$(echo "$OPERATOR_RESP" | jq -r 'select(.status_code == null) | .id // empty' 2>/dev/null)
if [ -z "$OPERATOR_ID" ]; then
    LOOKUP_RESP=$(mm_api GET "/users/username/demo-operator" 2>/dev/null || true)
    OPERATOR_ID=$(echo "$LOOKUP_RESP" | jq -r 'select(.status_code == null) | .id // empty' 2>/dev/null)
fi
if [ -z "$OPERATOR_ID" ]; then
    echo "    Create response: $(echo "$OPERATOR_RESP" | jq -c '.' 2>/dev/null || echo "$OPERATOR_RESP")"
    die "Failed to create/find demo-operator user."
fi
echo "    Operator user ID: $OPERATOR_ID"

mm_api PUT "/users/$OPERATOR_ID/password" -d '{"new_password": "Operator@1234567"}' > /dev/null 2>&1 || true
echo "    Operator password set."

# Authenticate as demo-operator and save token for demo.sh
echo "--- Authenticating as demo-operator..."
OP_LOGIN_RESP=$(curl -sS --max-time 10 -i -X POST "$API/users/login" \
    -H "Content-Type: application/json" \
    -d '{"login_id": "demo-operator", "password": "Operator@1234567"}')
OPERATOR_TOKEN=$(echo "$OP_LOGIN_RESP" | grep -i '^token:' | awk '{print $2}' | tr -d '\r\n' || true)
if [ -n "$OPERATOR_TOKEN" ]; then
    echo "    Operator authenticated (token: ${OPERATOR_TOKEN:0:8}...)"
else
    echo "    WARNING: Could not authenticate as demo-operator — OPERATOR_TOKEN will be empty in state file"
    OPERATOR_TOKEN=""
fi

mm_api POST "/teams/$TEAM_ID/members" -d "{\"team_id\": \"$TEAM_ID\", \"user_id\": \"$OPERATOR_ID\"}" > /dev/null 2>&1 || true
echo "    Added operator to team."

# --- Clean up previous seed data ---
echo ""
echo "--- Cleaning up previous seed data..."

ALL_RUN_CHANNELS=$(pb_api GET "/runs?team_id=$TEAM_ID&per_page=200" 2>/dev/null \
    | jq -r '.items[]?.channel_id // empty' 2>/dev/null || true)

ALL_INPROGRESS=$(pb_api GET "/runs?team_id=$TEAM_ID&status=InProgress&per_page=200" 2>/dev/null \
    | jq -r '.items[]?.id' 2>/dev/null || true)
for RID in $ALL_INPROGRESS; do
    pb_api PUT "/runs/$RID/finish" > /dev/null 2>&1 || true
done

CHANNEL_COUNT=0
for CHID in $ALL_RUN_CHANNELS; do
    [ -z "$CHID" ] && continue
    mm_api DELETE "/channels/$CHID" > /dev/null 2>&1 || true
    CHANNEL_COUNT=$((CHANNEL_COUNT + 1))
done

echo "    Finished $(echo "$ALL_INPROGRESS" | wc -w | tr -d ' ') runs, archived $CHANNEL_COUNT channels."

db_cleanup() {
    # Run each DELETE independently — a missing table (e.g. on a fresh DB) won't
    # abort cleanup of the tables that do exist.
    # Delete ALL playbooks-related artifacts across all teams (not team-scoped).
    local stmts=(
        "DELETE FROM ir_run_participants"
        "DELETE FROM ir_statusposts"
        "DELETE FROM ir_timelineevent"
        "DELETE FROM ir_metric"
        "DELETE FROM ir_channelaction"
        "DELETE FROM ir_viewedchannel"
        "DELETE FROM ir_category_item"
        "DELETE FROM channelmembers WHERE channelid IN (SELECT ChannelID FROM ir_incident)"
        "DELETE FROM publicchannels WHERE id IN (SELECT ChannelID FROM ir_incident)"
        "DELETE FROM channels WHERE id IN (SELECT ChannelID FROM ir_incident)"
        "DELETE FROM ir_incident"
        "DELETE FROM ir_condition"
        "DELETE FROM ir_metricconfig"
        "DELETE FROM ir_playbookmember"
        "DELETE FROM ir_playbookautofollow"
        "DELETE FROM ir_playbook"
    )
    if [[ "$MM_URL" == *"localhost"* || "$MM_URL" == *"127.0.0.1"* ]]; then
        local db="${MM_WORKTREE_DB:-mattermost_worktree}"
        for stmt in "${stmts[@]}"; do
            PGPASSWORD=mostest psql -h localhost -U mmuser -d "$db" -q -c "$stmt" \
                > /dev/null 2>&1 || true
        done
    else
        echo "    WARNING: DB cleanup not available for remote servers."
        echo "    Old finished runs may linger in the runs list."
        ALL_PBS=$(pb_api GET "/playbooks?team_id=$TEAM_ID&per_page=200" 2>/dev/null \
            | jq -r '.items[]?.id' 2>/dev/null || true)
        for PBID in $ALL_PBS; do
            [ -z "$PBID" ] && continue
            pb_api DELETE "/playbooks/$PBID" > /dev/null 2>&1 || true
        done
        return
    fi
}

if db_cleanup; then
    echo "    DB cleanup done (all playbooks and runs removed for team $TEAM_ID)."
else
    echo "    WARNING: DB cleanup failed — old data may persist."
fi

# ============================================================================
# PLAYBOOK 1: "Cyber Incident Response"
# Demonstrates: sequential IDs with "INC" prefix, channel name template,
# and required attributes (Zone + Attack Type are in the template).
# ============================================================================
echo ""
echo "=== Creating Playbook 1: Cyber Incident Response ==="

PB1_RESP=$(pb_api POST /playbooks -d "{
    \"title\": \"Incident Response (new_channel_only=true)\",
    \"description\": \"Playbook with new_channel_only flag enabled — all runs must create a new channel.\",
    \"team_id\": \"$TEAM_ID\",
    \"public\": true,
    \"create_public_playbook_run\": true,
    \"reminder_timer_default_seconds\": 86400,
    \"status_update_enabled\": false,
    \"channel_mode\": \"create_new_channel\",
    \"new_channel_only\": true,
    \"members\": [
        {\"user_id\": \"$ADMIN_ID\", \"roles\": [\"playbook_admin\", \"playbook_member\"]},
        {\"user_id\": \"$OPERATOR_ID\", \"roles\": [\"playbook_member\"]}
    ],
    \"checklists\": [
        {
            \"title\": \"Initial Triage\",
            \"items\": [
                {\"title\": \"Confirm incident scope\"},
                {\"title\": \"Notify stakeholders\"},
                {\"title\": \"Document initial findings\"}
            ]
        },
        {
            \"title\": \"Containment\",
            \"items\": [
                {\"title\": \"Isolate affected systems\"},
                {\"title\": \"Block malicious IPs\"},
                {\"title\": \"Preserve forensic evidence\"}
            ]
        },
        {
            \"title\": \"Recovery\",
            \"items\": [
                {\"title\": \"Restore from backup\"},
                {\"title\": \"Verify system integrity\"},
                {\"title\": \"Post-incident review\"}
            ]
        }
    ]
}")
echo "    API response: $PB1_RESP"
PB1_ID=$(echo "$PB1_RESP" | jq -r 'select(.status_code == null) | .id // empty' 2>/dev/null || true)

if [ -z "$PB1_ID" ]; then
    die "Failed to create Playbook 1"
fi
echo "    Created playbook: $PB1_ID"

# --- Create runs for Playbook 1 (testing new_channel_only enforcement) ---
echo ""
echo "--- Creating runs for Playbook 1 (new_channel_only enforcement test)..."
RUN1_ID=$(pb_api POST /runs -d "{
    \"name\": \"new_channel_only run 1\",
    \"owner_user_id\": \"$OPERATOR_ID\",
    \"team_id\": \"$TEAM_ID\",
    \"playbook_id\": \"$PB1_ID\"
}" | jq -r '.id')
echo "  Created run: $RUN1_ID"

RUN2_ID=$(pb_api POST /runs -d "{
    \"name\": \"new_channel_only run 2\",
    \"owner_user_id\": \"$ADMIN_ID\",
    \"team_id\": \"$TEAM_ID\",
    \"playbook_id\": \"$PB1_ID\"
}" | jq -r '.id')
echo "  Created run: $RUN2_ID"

# Add operator as participant to PB1 runs
echo "--- Adding operator as participant to PB1 runs..."
for RID in $RUN1_ID $RUN2_ID; do
    graphql "AddRunParticipants" "{ addRunParticipants(runID: \\\"$RID\\\", userIDs: [\\\"$OPERATOR_ID\\\"], forceAddToChannel: true) }" > /dev/null 2>&1 || true
done
echo "    Operator added to runs + channels."

# ============================================================================
# PLAYBOOK 2: "Release Checklist"
# No run_number_prefix — shows the plain sequential number (00001, 00002, ...)
# without a prefix string. Used as a contrast in the demo.
# ============================================================================
echo ""
echo "=== Creating Playbook 2: Release Checklist (no prefix — contrast playbook) ==="

PB2_ID=$(pb_api POST /playbooks -d "{
    \"title\": \"Release Checklist\",
    \"description\": \"Simple playbook without a run number prefix. Runs are numbered 00001, 00002, ... — shows the sequential counter without a prefix string.\",
    \"team_id\": \"$TEAM_ID\",
    \"public\": true,
    \"create_public_playbook_run\": true,
    \"reminder_timer_default_seconds\": 86400,
    \"channel_mode\": \"link_existing_channel\",
    \"new_channel_only\": false,
    \"members\": [
        {\"user_id\": \"$ADMIN_ID\", \"roles\": [\"playbook_admin\", \"playbook_member\"]},
        {\"user_id\": \"$OPERATOR_ID\", \"roles\": [\"playbook_member\"]}
    ],
    \"checklists\": [
        {
            \"title\": \"Pre-Release\",
            \"items\": [
                {\"title\": \"Run regression tests\"},
                {\"title\": \"Update changelog\"},
                {\"title\": \"Tag release branch\"}
            ]
        },
        {
            \"title\": \"Deploy\",
            \"items\": [
                {\"title\": \"Deploy to staging\"},
                {\"title\": \"Smoke test staging\"},
                {\"title\": \"Deploy to production\"},
                {\"title\": \"Verify production health\"}
            ]
        }
    ]
}" | jq -r '.id')
echo "    Created playbook: $PB2_ID"

# Create one run for PB2 — sequential_id will be "00001" (no prefix)
echo "--- Creating run for Playbook 2 (plain sequential number, no prefix)..."
PB2_RUN_JSON=$(pb_api POST /runs -d "{
    \"name\": \"v2.5.0 Release\",
    \"owner_user_id\": \"$OPERATOR_ID\",
    \"team_id\": \"$TEAM_ID\",
    \"playbook_id\": \"$PB2_ID\"
}")
PB2_RUN_ID=$(echo "$PB2_RUN_JSON" | jq -r '.id // empty')
PB2_RUN_SEQ=$(echo "$PB2_RUN_JSON" | jq -r '.sequential_id // empty')
if [ -z "$PB2_RUN_ID" ]; then
    echo "    ERROR creating PB2 run. Response: $(echo "$PB2_RUN_JSON" | jq -c '.' 2>/dev/null || echo "$PB2_RUN_JSON")"
fi
echo "    Run: v2.5.0 Release (ID: $PB2_RUN_ID, SeqID: $PB2_RUN_SEQ)"

graphql "AddRunParticipants" "{ addRunParticipants(runID: \\\"$PB2_RUN_ID\\\", userIDs: [\\\"$OPERATOR_ID\\\"], forceAddToChannel: true) }" > /dev/null 2>&1 || true
echo "    Operator added to PB2 run."

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "=========================================="
echo "  SEED COMPLETE"
echo "=========================================="
echo ""
echo "Playbook 1: Incident Response (new_channel_only=true)"
echo "  ID: $PB1_ID"
echo "  new_channel_only: true"
echo "  channel_mode: create_new_channel"
echo "  Runs: 2 runs created"
echo ""
echo "Playbook 2: Release Checklist (new_channel_only=false)"
echo "  ID: $PB2_ID"
echo "  new_channel_only: false"
echo "  channel_mode: link_existing_channel"
echo "  Runs: 1 run created"
echo ""
echo "Users:"
echo "  Admin:    $ADMIN_USER (ID: $ADMIN_ID)"
echo "  Operator: demo-operator (ID: $OPERATOR_ID) — second user for testing"
echo ""
echo "Run IDs (for smoke test):"
echo "  RUN1=$RUN1_ID  (from PB1)"
echo "  RUN2=$RUN2_ID  (from PB1)"
echo "  PB2_RUN_ID=$PB2_RUN_ID  (from PB2)"
echo ""

# Write state file for demo.sh
cat > "$SCRIPT_DIR/seed-state.env" <<EOF
# Generated by seed.sh — $(date -u +%Y-%m-%dT%H:%M:%SZ)
MM_URL=$MM_URL
TOKEN=$TOKEN
ADMIN_TOKEN=$TOKEN
ADMIN_ID=$ADMIN_ID
ADMIN_USER=$ADMIN_USER
OPERATOR_TOKEN=$OPERATOR_TOKEN
OPERATOR_ID=$OPERATOR_ID
TEAM_ID=$TEAM_ID
TEAM_NAME=$TEAM_NAME
PB1_ID=$PB1_ID
PB2_ID=$PB2_ID
RUN1_ID=$RUN1_ID
RUN2_ID=$RUN2_ID
PB2_RUN_ID=$PB2_RUN_ID
PB_API=$PB_API
GQL=$GQL
API=$API
EOF
echo "State saved to scripts/seed-state.env"