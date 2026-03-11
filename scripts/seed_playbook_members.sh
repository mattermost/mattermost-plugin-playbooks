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

echo "Creating $USER_COUNT users and adding them to playbook $PLAYBOOK_ID..."
echo ""

for i in $(seq 1 "$USER_COUNT"); do
    USERNAME="testuser_pb_$(printf '%03d' "$i")"
    EMAIL="${USERNAME}@example.com"
    PASSWORD="TestPass123!@#"

    # Create the user
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API/users" \
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
        echo "[$i/$USER_COUNT] Created user $USERNAME ($USER_ID)"
    elif [ "$HTTP_CODE" = "400" ]; then
        # User likely already exists — look them up
        USER_ID=$(curl -s -X GET "$API/users/username/$USERNAME" \
            -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
        echo "[$i/$USER_COUNT] User $USERNAME already exists ($USER_ID)"
    else
        echo "[$i/$USER_COUNT] Failed to create user $USERNAME (HTTP $HTTP_CODE)"
        echo "  $BODY"
        continue
    fi

    # Add user to team
    curl -s -o /dev/null -X POST "$API/teams/$MM_TEAM_ID/members" \
        -H "$AUTH" \
        -H "Content-Type: application/json" \
        -d "{\"team_id\": \"$MM_TEAM_ID\", \"user_id\": \"$USER_ID\"}"

    # Add user to playbook via GraphQL
    GQL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$PLUGIN_API/query" \
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
        echo "  -> Failed to add to playbook (HTTP $GQL_CODE): $GQL_BODY"
    fi
done

echo ""
echo "Done. $USER_COUNT users processed for playbook $PLAYBOOK_ID."
echo "Open the Playbooks Access modal to verify the scrolling behavior."
