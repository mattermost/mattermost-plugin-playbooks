#!/bin/bash
#
# Seed script: creates users on the Mattermost server and adds them
# as members to a playbook. Useful for testing the Playbooks Access modal
# with many users.
#
# Usage:
#   ./scripts/seed_playbook_members.sh <playbook_id> [count]
#
# Arguments:
#   playbook_id  - ID of the playbook to add members to (required)
#   count        - Number of users to create and add (default: 30)
#
# Environment:
#   MM_SERVICESETTINGS_SITEURL - Mattermost server URL (required)
#   MM_ADMIN_TOKEN             - Admin auth token (required)
#   MM_TEAM_ID                 - Team ID to add users to (required)

set -euo pipefail

PLAYBOOK_ID="${1:?Usage: $0 <playbook_id> [count]}"
USER_COUNT="${2:-30}"

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
    echo "  curl -H 'Authorization: Bearer \$MM_ADMIN_TOKEN' $MM_SERVICESETTINGS_SITEURL/api/v4/teams"
    exit 1
fi

SERVER_URL="$MM_SERVICESETTINGS_SITEURL"

AUTH="Authorization: Bearer $MM_ADMIN_TOKEN"
API="$SERVER_URL/api/v4"
PLUGIN_API="$SERVER_URL/plugins/playbooks/api/v0"

echo "=== Configuration ==="
echo "  Server URL:   $SERVER_URL"
echo "  API base:     $API"
echo "  Plugin API:   $PLUGIN_API"
echo "  Team ID:      $MM_TEAM_ID"
echo "  Playbook ID:  $PLAYBOOK_ID"
echo "  User count:   $USER_COUNT"
echo ""

# Quick connectivity check
echo "Checking server connectivity..."
CHECK=$(curl -sL -o /dev/null -w "%{http_code} (redirected to %{url_effective})" "$API/system/ping")
echo "  GET $API/system/ping -> $CHECK"
echo ""

echo "Creating $USER_COUNT users and adding them to playbook $PLAYBOOK_ID..."
echo ""

for i in $(seq 1 "$USER_COUNT"); do
    USERNAME="testuser_pb_$(printf '%03d' "$i")"
    EMAIL="${USERNAME}@example.com"
    PASSWORD="TestPass123!@#"

    # Create the user
    echo "[$i/$USER_COUNT] POST $API/users (username=$USERNAME)"
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
        USER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
        echo "  Created user $USERNAME ($USER_ID)"
    elif [ "$HTTP_CODE" = "400" ]; then
        # User likely already exists — look them up
        echo "  User may already exist (HTTP 400), looking up by username..."
        LOOKUP=$(curl -sL "$API/users/username/$USERNAME" -H "$AUTH")
        USER_ID=$(echo "$LOOKUP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
        echo "  Found existing user $USERNAME ($USER_ID)"
    else
        echo "  FAILED to create user $USERNAME (HTTP $HTTP_CODE)"
        echo "  Response body: $BODY"
        continue
    fi

    # Add user to team
    echo "  POST $API/teams/$MM_TEAM_ID/members (user_id=$USER_ID)"
    TEAM_RESP=$(curl -sL -w "\n%{http_code}" -X POST "$API/teams/$MM_TEAM_ID/members" \
        -H "$AUTH" \
        -H "Content-Type: application/json" \
        -d "{\"team_id\": \"$MM_TEAM_ID\", \"user_id\": \"$USER_ID\"}")
    TEAM_CODE=$(echo "$TEAM_RESP" | tail -1)
    echo "  -> Team add response: HTTP $TEAM_CODE"

    # Add user to playbook via GraphQL
    echo "  POST $PLUGIN_API/query (addPlaybookMember)"
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
        echo "  -> Added to playbook"
    else
        echo "  -> FAILED to add to playbook (HTTP $GQL_CODE)"
        echo "  Response body: $GQL_BODY"
    fi
    echo ""
done

echo "Done. $USER_COUNT users processed for playbook $PLAYBOOK_ID."
echo "Open the Playbooks Access modal to verify the scrolling behavior."
