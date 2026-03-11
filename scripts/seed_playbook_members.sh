#!/bin/bash
#
# Seed script: creates a playbook, creates users on the Mattermost server,
# and adds them as members to the playbook. Useful for testing the Playbooks
# Access modal with many users.
#
# Usage:
#   ./scripts/seed_playbook_members.sh [count]
#
# Arguments:
#   count - Number of users to create and add (default: 30)
#
# Environment:
#   MM_SERVICESETTINGS_SITEURL - Mattermost server URL (required)
#   MM_ADMIN_TOKEN             - Admin auth token (required)
#   MM_TEAM_ID                 - Team ID to add users to (required)

set -euo pipefail

USER_COUNT="${1:-30}"

if [ -z "${MM_SERVICESETTINGS_SITEURL:-}" ]; then
    echo "Error: MM_SERVICESETTINGS_SITEURL environment variable is required."
    exit 1
fi

if [ -z "${MM_ADMIN_TOKEN:-}" ]; then
    echo "Error: MM_ADMIN_TOKEN environment variable is required."
    exit 1
fi

if [ -z "${MM_TEAM_ID:-}" ]; then
    echo "Error: MM_TEAM_ID environment variable is required."
    echo "Get it via:"
    echo "  curl -sL -H 'Authorization: Bearer \$MM_ADMIN_TOKEN' \$MM_SERVICESETTINGS_SITEURL/api/v4/teams"
    exit 1
fi

# Strip trailing slash to avoid double-slash in URLs
SERVER_URL="${MM_SERVICESETTINGS_SITEURL%/}"

AUTH="Authorization: Bearer $MM_ADMIN_TOKEN"
API="$SERVER_URL/api/v4"
PLUGIN_API="$SERVER_URL/plugins/playbooks/api/v0"

echo "=== Configuration ==="
echo "  Server URL:   $SERVER_URL"
echo "  API base:     $API"
echo "  Plugin API:   $PLUGIN_API"
echo "  Team ID:      $MM_TEAM_ID"
echo "  User count:   $USER_COUNT"
echo ""

# Quick connectivity check
echo "Checking server connectivity..."
CHECK=$(curl -sL -o /dev/null -w "%{http_code} (redirected to %{url_effective})" "$API/system/ping")
echo "  GET $API/system/ping -> $CHECK"
echo ""

# Helper: extract a JSON field using python3
json_field() {
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['$1'])" 2>/dev/null
}

# Create a playbook
echo "Creating playbook..."
PB_RESPONSE=$(curl -sL -w "\n%{http_code}" -X POST "$PLUGIN_API/playbooks" \
    -H "$AUTH" \
    -H "Content-Type: application/json" \
    -d "{
        \"title\": \"Access Modal Test Playbook\",
        \"description\": \"Auto-generated playbook for testing the access modal with many members.\",
        \"team_id\": \"$MM_TEAM_ID\",
        \"public\": false,
        \"create_public_playbook_run\": true,
        \"reminder_timer_default_seconds\": 86400,
        \"checklists\": [{\"title\": \"Default\", \"items\": [{\"title\": \"Sample task\"}]}]
    }")

PB_CODE=$(echo "$PB_RESPONSE" | tail -1)
PB_BODY=$(echo "$PB_RESPONSE" | sed '$d')

if [ "$PB_CODE" = "201" ] || [ "$PB_CODE" = "200" ]; then
    PLAYBOOK_ID=$(echo "$PB_BODY" | json_field id)
    if [ -z "$PLAYBOOK_ID" ]; then
        echo "  FAILED to parse playbook ID from response"
        echo "  Response body: $PB_BODY"
        exit 1
    fi
    echo "  Created playbook: $PLAYBOOK_ID"
else
    echo "  FAILED to create playbook (HTTP $PB_CODE)"
    echo "  Response body: $PB_BODY"
    exit 1
fi
echo ""

echo "Creating $USER_COUNT users and adding them to playbook $PLAYBOOK_ID..."
echo ""

for i in $(seq 1 "$USER_COUNT"); do
    USERNAME="testuser_pb_$(printf '%03d' "$i")"
    EMAIL="${USERNAME}@example.com"
    PASSWORD="TestPass123!@#"

    # Create the user
    echo "[$i/$USER_COUNT] Creating user $USERNAME"
    RESPONSE=$(curl -sL -w "\n%{http_code}" -X POST "$API/users" \
        -H "$AUTH" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$EMAIL\",
            \"username\": \"$USERNAME\",
            \"password\": \"$PASSWORD\",
            \"first_name\": \"Test\",
            \"last_name\": \"User $i\"
        }")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "201" ]; then
        USER_ID=$(echo "$BODY" | json_field id)
        echo "  Created ($USER_ID)"
    elif [ "$HTTP_CODE" = "400" ]; then
        # User likely already exists — look them up
        LOOKUP_RESP=$(curl -sL -w "\n%{http_code}" "$API/users/username/$USERNAME" -H "$AUTH")
        LOOKUP_CODE=$(echo "$LOOKUP_RESP" | tail -1)
        LOOKUP_BODY=$(echo "$LOOKUP_RESP" | sed '$d')

        if [ "$LOOKUP_CODE" = "200" ]; then
            USER_ID=$(echo "$LOOKUP_BODY" | json_field id)
            echo "  Already exists ($USER_ID)"
        else
            echo "  FAILED to create (HTTP $HTTP_CODE): $BODY"
            echo "  FAILED to look up (HTTP $LOOKUP_CODE): $LOOKUP_BODY"
            continue
        fi
    else
        echo "  FAILED to create (HTTP $HTTP_CODE): $BODY"
        continue
    fi

    # Validate we got a real user ID
    if [ -z "$USER_ID" ] || [ ${#USER_ID} -lt 20 ]; then
        echo "  FAILED: invalid user ID '$USER_ID', skipping"
        continue
    fi

    # Add user to team
    TEAM_RESP=$(curl -sL -w "\n%{http_code}" -X POST "$API/teams/$MM_TEAM_ID/members" \
        -H "$AUTH" \
        -H "Content-Type: application/json" \
        -d "{\"team_id\": \"$MM_TEAM_ID\", \"user_id\": \"$USER_ID\"}")
    TEAM_CODE=$(echo "$TEAM_RESP" | tail -1)
    echo "  Team add: HTTP $TEAM_CODE"

    # Add user to playbook via GraphQL
    GQL_RESPONSE=$(curl -sL -w "\n%{http_code}" -X POST "$PLUGIN_API/query" \
        -H "$AUTH" \
        -H "Content-Type: application/json" \
        -d "{
            \"operationName\": \"AddPlaybookMember\",
            \"variables\": {\"playbookID\": \"$PLAYBOOK_ID\", \"userID\": \"$USER_ID\"},
            \"query\": \"mutation AddPlaybookMember(\$playbookID: String!, \$userID: String!) { addPlaybookMember(playbookID: \$playbookID, userID: \$userID) }\"
        }")

    GQL_CODE=$(echo "$GQL_RESPONSE" | tail -1)
    GQL_BODY=$(echo "$GQL_RESPONSE" | sed '$d')

    if [ "$GQL_CODE" = "200" ] && echo "$GQL_BODY" | grep -q '"data"'; then
        echo "  Playbook add: OK"
    else
        echo "  Playbook add: FAILED (HTTP $GQL_CODE): $GQL_BODY"
    fi
done

echo ""
echo "Done. $USER_COUNT users processed for playbook $PLAYBOOK_ID."
echo "Open the Playbooks Access modal to verify the scrolling behavior."
