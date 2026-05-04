#!/usr/bin/env bash
# smoke_test.sh — API assertions for the new_channel_only feature.
# Requires seed.sh to have been run first (reads scripts/seed-state.env).
#
# All writes go through the REST API only — there is no GraphQL path for
# new_channel_only. The playbook editor sends a REST PUT that coerces
# channel_mode to create_new_channel alongside new_channel_only=true
# in a single request (see webapp/src/components/backstage/playbook_editor/outline/outline.tsx).
#
# Covers 9 scenarios:
#   1. new_channel_only defaults to false on a new playbook; PB1=true, PB2=false
#   2. Server-side enforcement: run with existing channel rejected when new_channel_only=true
#   3. PB2 (new_channel_only=false) allows linking an existing channel
#   4. Toggle persists via REST PUT (ON then OFF round-trip)
#   5. Invalid playbook config rejected (new_channel_only=true + link_existing_channel → 400)
#   6. Happy-path run creation on new_channel_only=true playbook (no channel_id → run + fresh channel)
#   7. Export/import preserves new_channel_only
#   8. Duplicate preserves new_channel_only
#   9. Editor-style coerced write: PUT with new_channel_only=true + channel_mode=create_new_channel
#      in one request persists both fields (mirrors outline.tsx handleNewChannelOnlyChange)
#
# Usage:
#   ./scripts/smoke_test.sh
#
# Exit code: 0 if all tests pass, 1 if any fail.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

_RUN_URL="${MM_URL:-}"

STATE_FILE="$SCRIPT_DIR/seed-state.env"
[ -f "$STATE_FILE" ] || { echo "ERROR: Run seed.sh first. State file not found: $STATE_FILE"; exit 1; }
source "$STATE_FILE"

[ -n "$_RUN_URL" ] && MM_URL="$_RUN_URL"
API="$MM_URL/api/v4"
PB_API="$MM_URL/plugins/playbooks/api/v0"

ADMIN_PASS="${MM_ADMIN_PASSWORD:-${ADMIN_PASS:-Sys@dmin-sample1}}"

# Helpers

PASS=0
FAIL=0
FAILURES=()

pass() { echo "  PASS  $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL+1)); FAILURES+=("$1"); }

assert_eq() {
    local label="$1" expected="$2" actual="$3"
    if [ "$actual" = "$expected" ]; then
        pass "$label"
    else
        fail "$label (expected='$expected' got='$actual')"
    fi
}

assert_not_empty() {
    local label="$1" value="$2"
    if [ -n "$value" ] && [ "$value" != "null" ]; then
        pass "$label"
    else
        fail "$label (expected non-empty value)"
    fi
}

auth_header() { echo "Authorization: Bearer $TOKEN"; }

pb_api() {
    local method="$1" path="$2"; shift 2
    curl -sS -X "$method" "$PB_API$path" \
        -H "$(auth_header)" -H "Content-Type: application/json" "$@"
}

mm_api() {
    local method="$1" path="$2"; shift 2
    curl -sS -X "$method" "$API$path" \
        -H "$(auth_header)" -H "Content-Type: application/json" "$@"
}

section() {
    echo ""
    echo "-- $1"
}

# Authenticate

LOGIN_RESP=$(curl -sS -i -X POST "$API/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"login_id\": \"$ADMIN_USER\", \"password\": \"$ADMIN_PASS\"}")
NEW_TOKEN=$(echo "$LOGIN_RESP" | grep -i '^token:' | awk '{print $2}' | tr -d '\r\n')
[ -n "$NEW_TOKEN" ] && TOKEN="$NEW_TOKEN"
[ -z "${TOKEN:-}" ] && { echo "ERROR: authentication failed"; exit 1; }

echo "=== new_channel_only Smoke Tests ==="
echo "Server: $MM_URL"
echo "Admin:  $ADMIN_USER"
echo ""

# Test 1: new_channel_only defaults to false; seed state correct

# ── Pre-test cleanup: clear previous smoke-test runs and channels ─────────────

section "Pre-test cleanup"

SEED_PB_IDS=$(grep -oE 'PB[0-9]+_ID=\S+' "$STATE_FILE" | cut -d= -f2 | tr '\n' ' ')
ALL_SMOKE_RUNS=$(pb_api GET "/runs?team_id=$TEAM_ID&per_page=200" 2>/dev/null \
    | jq -r '.items[] | .id + " " + .playbook_id' 2>/dev/null || true)
while IFS= read -r line; do
    [ -z "$line" ] && continue
    RID=$(echo "$line" | cut -d' ' -f1)
    RUN_PB=$(echo "$line" | cut -d' ' -f2)
    echo " $SEED_PB_IDS " | grep -q " $RUN_PB " && continue
    RCHAN=$(pb_api GET "/runs/$RID" 2>/dev/null | jq -r '.channel_id // empty')
    pb_api PUT "/runs/$RID/finish" > /dev/null 2>&1 || true
    [ -n "$RCHAN" ] && mm_api DELETE "/channels/$RCHAN" > /dev/null 2>&1 || true
done <<< "$ALL_SMOKE_RUNS"
echo "  cleaned up previous smoke-test runs."

section "1: new_channel_only defaults to false on a new playbook"

NEW_PB_ID=$(pb_api POST /playbooks -d "{
    \"title\": \"Smoke Default Test $(date +%s)\",
    \"team_id\": \"$TEAM_ID\",
    \"public\": false,
    \"channel_mode\": \"create_new_channel\",
    \"reminder_timer_default_seconds\": 86400,
    \"members\": [{\"user_id\": \"$ADMIN_ID\", \"roles\": [\"playbook_admin\", \"playbook_member\"]}]
}" | jq -r '.id // empty')

if [ -n "$NEW_PB_ID" ] && [ "$NEW_PB_ID" != "null" ]; then
    NEW_PB_NCO=$(pb_api GET "/playbooks/$NEW_PB_ID" | jq -r '.new_channel_only // false')
    assert_eq "New playbook new_channel_only defaults to false" "false" "$NEW_PB_NCO"
    pb_api DELETE "/playbooks/$NEW_PB_ID" > /dev/null 2>&1 || true
else
    fail "Could not create test playbook for default check"
fi

PB1=$(pb_api GET "/playbooks/$PB1_ID")
assert_not_empty "PB1 loaded" "$(echo "$PB1" | jq -r '.id // empty')"

PB2=$(pb_api GET "/playbooks/$PB2_ID")
assert_not_empty "PB2 loaded" "$(echo "$PB2" | jq -r '.id // empty')"

NCO_PB1=$(echo "$PB1" | jq -r 'if .new_channel_only then "true" else "false" end')
assert_eq "PB1 new_channel_only = true" "true" "$NCO_PB1"

NCO_PB2=$(echo "$PB2" | jq -r 'if .new_channel_only then "true" else "false" end')
assert_eq "PB2 new_channel_only = false (contrast)" "false" "$NCO_PB2"

# Test 2: Server-side enforcement

section "2: Run with existing channel rejected when new_channel_only=true"

SOME_CHANNEL=$(mm_api GET "/teams/$TEAM_ID/channels" 2>/dev/null \
    | jq -r '[.[] | select(.name != "town-square" and .delete_at == 0)] | .[0].id // empty')

if [ -z "$SOME_CHANNEL" ]; then
    fail "could not find an existing channel to test with"
else
    NCO_RESP=$(pb_api POST /runs -d "{
        \"name\": \"should-be-rejected\",
        \"owner_user_id\": \"$ADMIN_ID\",
        \"team_id\": \"$TEAM_ID\",
        \"playbook_id\": \"$PB1_ID\",
        \"channel_id\": \"$SOME_CHANNEL\"
    }" 2>/dev/null || true)
    NCO_ID=$(echo "$NCO_RESP" | jq -r '.id // empty' 2>/dev/null)
    if [ -z "$NCO_ID" ]; then
        pass "run with existing channel rejected when new_channel_only=true"
    else
        fail "run with existing channel accepted — enforcement missing (id=$NCO_ID)"
        pb_api PUT "/runs/$NCO_ID/finish" > /dev/null 2>&1 || true
    fi
fi

# Test 3: PB2 allows existing channel

section "3: Run with existing channel allowed when new_channel_only=false"

if [ -n "$SOME_CHANNEL" ]; then
    PB2_RESP=$(pb_api POST /runs -d "{
        \"name\": \"smoke-existing-channel-test\",
        \"owner_user_id\": \"$ADMIN_ID\",
        \"team_id\": \"$TEAM_ID\",
        \"playbook_id\": \"$PB2_ID\",
        \"channel_id\": \"$SOME_CHANNEL\"
    }" 2>/dev/null || true)
    PB2_RUN_ID=$(echo "$PB2_RESP" | jq -r '.id // empty' 2>/dev/null)
    if [ -n "$PB2_RUN_ID" ]; then
        pass "run with existing channel accepted when new_channel_only=false"
        pb_api PUT "/runs/$PB2_RUN_ID/finish" > /dev/null 2>&1 || true
    else
        fail "run with existing channel rejected on PB2 — unexpected (response: $(echo "$PB2_RESP" | jq -c '.error // .' 2>/dev/null))"
    fi
else
    fail "no existing channel available — skipping PB2 contrast test"
fi

# Test 4: Toggle persists via REST PUT (round-trip)

section "4: Toggle persists via REST PUT (ON then OFF round-trip)"

PB1_CURRENT=$(pb_api GET "/playbooks/$PB1_ID")
PB1_TOGGLED=$(echo "$PB1_CURRENT" | jq '.new_channel_only = false')
pb_api PUT "/playbooks/$PB1_ID" -d "$PB1_TOGGLED" > /dev/null 2>&1 || true
PB1_AFTER=$(pb_api GET "/playbooks/$PB1_ID")
NCO_AFTER=$(echo "$PB1_AFTER" | jq -r 'if .new_channel_only then "true" else "false" end')
assert_eq "Toggle OFF persists" "false" "$NCO_AFTER"

pb_api PUT "/playbooks/$PB1_ID" -d "$(echo "$PB1_AFTER" | jq '.new_channel_only = true')" > /dev/null 2>&1 || true
PB1_FINAL=$(pb_api GET "/playbooks/$PB1_ID")
NCO_FINAL=$(echo "$PB1_FINAL" | jq -r 'if .new_channel_only then "true" else "false" end')
assert_eq "Toggle ON persists" "true" "$NCO_FINAL"

# Test 5: Invalid playbook config rejected (new_channel_only=true + link_existing_channel → 400)

section "5: Invalid playbook config rejected (new_channel_only=true + link_existing_channel)"

CONFLICT_RESP=$(pb_api POST /playbooks -d "{
    \"title\": \"conflict-nco-smoke-$(date +%s)\",
    \"team_id\": \"$TEAM_ID\",
    \"public\": true,
    \"channel_mode\": \"link_existing_channel\",
    \"new_channel_only\": true,
    \"reminder_timer_default_seconds\": 86400,
    \"members\": [{\"user_id\": \"$ADMIN_ID\", \"roles\": [\"playbook_admin\", \"playbook_member\"]}]
}" 2>/dev/null || true)
CONFLICT_ID=$(echo "$CONFLICT_RESP" | jq -r '.id // empty' 2>/dev/null)
if [ -z "$CONFLICT_ID" ]; then
    pass "Playbook create with new_channel_only=true + link_existing_channel returns error"
else
    fail "Playbook create with conflicting config was accepted — validation missing (id=$CONFLICT_ID)"
    pb_api DELETE "/playbooks/$CONFLICT_ID" > /dev/null 2>&1 || true
fi

# Also test update-time validation: take a normal playbook and try to set both flags
VALID_PB_ID=$(pb_api POST /playbooks -d "{
    \"title\": \"update-conflict-test-$(date +%s)\",
    \"team_id\": \"$TEAM_ID\",
    \"public\": true,
    \"channel_mode\": \"create_new_channel\",
    \"reminder_timer_default_seconds\": 86400,
    \"members\": [{\"user_id\": \"$ADMIN_ID\", \"roles\": [\"playbook_admin\", \"playbook_member\"]}]
}" | jq -r '.id // empty')
if [ -n "$VALID_PB_ID" ] && [ "$VALID_PB_ID" != "null" ]; then
    VALID_PB_BODY=$(pb_api GET "/playbooks/$VALID_PB_ID")
    CONFLICT_UPDATE_RESP=$(pb_api PUT "/playbooks/$VALID_PB_ID" \
        -d "$(echo "$VALID_PB_BODY" | jq '.new_channel_only = true | .channel_mode = "link_existing_channel"')" 2>/dev/null || true)
    CONFLICT_UPDATE_ID=$(echo "$CONFLICT_UPDATE_RESP" | jq -r '.id // empty' 2>/dev/null)
    if [ -z "$CONFLICT_UPDATE_ID" ]; then
        pass "Playbook update with new_channel_only=true + link_existing_channel returns error"
    else
        fail "Playbook update with conflicting config was accepted — validation missing"
    fi
    pb_api DELETE "/playbooks/$VALID_PB_ID" > /dev/null 2>&1 || true
else
    fail "Could not create test playbook for update-conflict check"
fi

# Test 6: Happy-path run creation (no channel_id, new_channel_only=true → run + fresh channel created)

section "6: Happy-path run creation on new_channel_only=true playbook (no channel_id supplied)"

HAPPY_RUN_RESP=$(pb_api POST /runs -d "{
    \"name\": \"smoke-happy-nco-$(date +%s)\",
    \"owner_user_id\": \"$ADMIN_ID\",
    \"team_id\": \"$TEAM_ID\",
    \"playbook_id\": \"$PB1_ID\"
}" 2>/dev/null || true)
HAPPY_RUN_ID=$(echo "$HAPPY_RUN_RESP" | jq -r '.id // empty' 2>/dev/null)
HAPPY_CHAN_ID=$(echo "$HAPPY_RUN_RESP" | jq -r '.channel_id // empty' 2>/dev/null)
if [ -n "$HAPPY_RUN_ID" ] && [ "$HAPPY_RUN_ID" != "null" ]; then
    pass "Run created successfully on new_channel_only=true playbook (no channel_id)"
    if [ -n "$HAPPY_CHAN_ID" ] && [ "$HAPPY_CHAN_ID" != "null" ]; then
        pass "Run has a fresh channel_id assigned"
    else
        fail "Run was created but has no channel_id"
    fi
    pb_api PUT "/runs/$HAPPY_RUN_ID/finish" > /dev/null 2>&1 || true
else
    fail "Run creation without channel_id failed on new_channel_only=true playbook (response: $(echo "$HAPPY_RUN_RESP" | jq -c '.error // .' 2>/dev/null))"
fi

# Test 7: Export/import preserves new_channel_only

section "7: Export/import preserves new_channel_only"

EXPORT_RESP=$(curl -sS "$PB_API/playbooks/$PB1_ID/export" -H "$(auth_header)" 2>/dev/null || true)
if echo "$EXPORT_RESP" | jq -e '.new_channel_only == true' > /dev/null 2>&1; then
    pass "Exported playbook JSON contains new_channel_only=true"

    IMPORT_RESP=$(pb_api POST "/playbooks/import?team_id=$TEAM_ID" \
        -d "$EXPORT_RESP" 2>/dev/null || true)
    IMPORT_ID=$(echo "$IMPORT_RESP" | jq -r '.id // empty' 2>/dev/null)
    if [ -n "$IMPORT_ID" ] && [ "$IMPORT_ID" != "null" ]; then
        IMPORTED_PB=$(pb_api GET "/playbooks/$IMPORT_ID")
        IMPORTED_NCO=$(echo "$IMPORTED_PB" | jq -r 'if .new_channel_only then "true" else "false" end')
        assert_eq "Imported playbook preserves new_channel_only=true" "true" "$IMPORTED_NCO"
        pb_api DELETE "/playbooks/$IMPORT_ID" > /dev/null 2>&1 || true
    else
        fail "Import failed (response: $(echo "$IMPORT_RESP" | jq -c '.error // .' 2>/dev/null))"
    fi
else
    fail "Exported JSON does not contain new_channel_only=true (got: $(echo "$EXPORT_RESP" | jq -c '.new_channel_only // "MISSING"'))"
fi

# Test 8: Duplicate preserves new_channel_only

section "8: Duplicate preserves new_channel_only"

DUP_RESP=$(pb_api POST "/playbooks/$PB1_ID/duplicate" 2>/dev/null || true)
DUP_ID=$(echo "$DUP_RESP" | jq -r '.id // empty' 2>/dev/null)
if [ -n "$DUP_ID" ] && [ "$DUP_ID" != "null" ]; then
    DUP_PB=$(pb_api GET "/playbooks/$DUP_ID")
    DUP_NCO=$(echo "$DUP_PB" | jq -r 'if .new_channel_only then "true" else "false" end')
    assert_eq "Duplicated playbook preserves new_channel_only=true" "true" "$DUP_NCO"
    pb_api DELETE "/playbooks/$DUP_ID" > /dev/null 2>&1 || true
else
    fail "Duplicate failed (response: $(echo "$DUP_RESP" | jq -c '.error // .' 2>/dev/null))"
fi

# Test 9: Editor-style coerced write (new_channel_only=true + channel_mode=create_new_channel in one PUT)
#
# The playbook editor's handleNewChannelOnlyChange (outline.tsx) sends both fields together in a
# single REST PUT when the user enables the toggle. This test mirrors that exact request shape and
# verifies the server accepts and persists both fields correctly.

section "9: Editor-style coerced PUT (new_channel_only=true + channel_mode=create_new_channel)"

# Create a playbook that starts with new_channel_only=false and link_existing_channel mode
EDITOR_PB_ID=$(pb_api POST /playbooks -d "{
    \"title\": \"editor-coerce-test-$(date +%s)\",
    \"team_id\": \"$TEAM_ID\",
    \"public\": true,
    \"channel_mode\": \"link_existing_channel\",
    \"new_channel_only\": false,
    \"reminder_timer_default_seconds\": 86400,
    \"members\": [{\"user_id\": \"$ADMIN_ID\", \"roles\": [\"playbook_admin\", \"playbook_member\"]}]
}" | jq -r '.id // empty')

if [ -n "$EDITOR_PB_ID" ] && [ "$EDITOR_PB_ID" != "null" ]; then
    EDITOR_PB_BODY=$(pb_api GET "/playbooks/$EDITOR_PB_ID")
    # Simulate exactly what outline.tsx handleNewChannelOnlyChange sends:
    # {...restPlaybook, new_channel_only: true, channel_mode: 'create_new_channel'}
    EDITOR_PUT_RESP=$(pb_api PUT "/playbooks/$EDITOR_PB_ID" \
        -d "$(echo "$EDITOR_PB_BODY" | jq '.new_channel_only = true | .channel_mode = "create_new_channel"')" 2>/dev/null || true)

    EDITOR_PB_AFTER=$(pb_api GET "/playbooks/$EDITOR_PB_ID")
    EDITOR_NCO=$(echo "$EDITOR_PB_AFTER" | jq -r 'if .new_channel_only then "true" else "false" end')
    EDITOR_MODE=$(echo "$EDITOR_PB_AFTER" | jq -r '.channel_mode // empty')
    assert_eq "Editor PUT: new_channel_only=true persists" "true" "$EDITOR_NCO"
    assert_eq "Editor PUT: channel_mode coerced to create_new_channel" "create_new_channel" "$EDITOR_MODE"

    pb_api DELETE "/playbooks/$EDITOR_PB_ID" > /dev/null 2>&1 || true
else
    fail "Could not create test playbook for editor-coerce test"
fi

# Summary

TOTAL_TESTS=$((PASS + FAIL))
echo ""
echo "=========================================="
echo "  Results: $PASS/$TOTAL_TESTS passed"
echo "=========================================="

if [ ${#FAILURES[@]} -gt 0 ]; then
    echo ""
    echo "Failed tests:"
    for f in "${FAILURES[@]}"; do
        echo "  x $f"
    done
    echo ""
    exit 1
else
    echo ""
    echo "All tests passed."
    echo ""
fi