#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

MM_URL="${MM_URL:-http://localhost:9066}"
MM_ADMIN_USER="${MM_ADMIN_USER:-}"
MM_ADMIN_PASSWORD="${MM_ADMIN_PASSWORD:-}"
MM_TOKEN="${MM_TOKEN:-}"

# Find the plugin bundle
BUNDLE=$(ls "$SCRIPT_DIR/../dist"/*.tar.gz 2>/dev/null | head -1)
if [[ -z "$BUNDLE" ]]; then
  echo "ERROR: No .tar.gz found in dist/. Run 'make dist' first." >&2
  exit 1
fi
echo "Bundle: $BUNDLE"

# Authenticate if no token provided and no local socket (socket path handles auth itself).
_LOCAL_SOCKET_EARLY="${MM_LOCAL_SOCKET:-/var/tmp/mattermost_local.socket}"
if [[ -z "$MM_TOKEN" ]] && [[ ! -S "$_LOCAL_SOCKET_EARLY" ]]; then
  if [[ -z "$MM_ADMIN_USER" || -z "$MM_ADMIN_PASSWORD" ]]; then
    echo "ERROR: Provide MM_TOKEN or both MM_ADMIN_USER and MM_ADMIN_PASSWORD." >&2
    exit 1
  fi
  echo "Logging in as $MM_ADMIN_USER..."
  LOGIN_RESPONSE=$(curl -s -i --max-time 15 \
    -H "Content-Type: application/json" \
    -d "{\"login_id\":\"$MM_ADMIN_USER\",\"password\":\"$MM_ADMIN_PASSWORD\"}" \
    "$MM_URL/api/v4/users/login")
  MM_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -i "^Token:" | awk '{print $2}' | tr -d '\r') || true
  if [[ -z "$MM_TOKEN" ]]; then
    echo "Login failed — creating admin user '$MM_ADMIN_USER'..."
    curl -s --max-time 10 -X PUT "$MM_URL/api/v4/config/patch" \
      -H "Content-Type: application/json" \
      -d '{"TeamSettings": {"EnableOpenServer": true}}' > /dev/null 2>&1 || true
    CREATE_RESP=$(curl -s --max-time 10 -X POST "$MM_URL/api/v4/users" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"sysadmin@sample.mattermost.com\",\"username\":\"$MM_ADMIN_USER\",\"password\":\"$MM_ADMIN_PASSWORD\",\"first_name\":\"System\",\"last_name\":\"Admin\"}")
    CREATED_ID=$(echo "$CREATE_RESP" | grep -o '"id":"[a-z0-9]\{26\}"' | head -1 | cut -d'"' -f4)
    if [[ -z "$CREATED_ID" ]]; then
      echo "ERROR: Login failed and could not create admin user." >&2
      echo "$LOGIN_RESPONSE" >&2
      echo "$CREATE_RESP" >&2
      exit 1
    fi
    echo "Created user $MM_ADMIN_USER (ID: $CREATED_ID)"
    LOGIN_RESPONSE=$(curl -s -i --max-time 15 \
      -H "Content-Type: application/json" \
      -d "{\"login_id\":\"$MM_ADMIN_USER\",\"password\":\"$MM_ADMIN_PASSWORD\"}" \
      "$MM_URL/api/v4/users/login")
    MM_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -i "^Token:" | awk '{print $2}' | tr -d '\r') || true
    [[ -z "$MM_TOKEN" ]] && { echo "ERROR: Created user but login still failed." >&2; exit 1; }
    curl -s --max-time 10 -X PUT "$MM_URL/api/v4/users/$CREATED_ID/roles" \
      -H "Authorization: Bearer $MM_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"roles": "system_admin system_user"}' > /dev/null 2>&1 || true
    echo "Promoted to system_admin."
  fi
  echo "Authenticated."
fi

PLUGIN_ID="playbooks"

# The server always runs with CWD = MM_SERVER_REPO and PluginSettings.Directory = "./plugins".
# Default to that resolved path; only override if a local config.json has an absolute path.
_MM_SERVER_REPO="${MM_SERVER_REPO:-/Users/catalintomai/mattermost/mattermost/server}"
_ABS_PLUGIN_DIR="$_MM_SERVER_REPO/plugins"
_ABS_CLIENT_DIR="$_MM_SERVER_REPO/client/plugins"
_CONFIG_FILE="$SCRIPT_DIR/.worktree-server/config.json"
if [[ -f "$_CONFIG_FILE" ]] && command -v jq > /dev/null 2>&1; then
  _RAW_PLUGIN_DIR=$(jq -r '.PluginSettings.Directory // empty' "$_CONFIG_FILE" 2>/dev/null)
  _RAW_CLIENT_DIR=$(jq -r '.PluginSettings.ClientDirectory // empty' "$_CONFIG_FILE" 2>/dev/null)
  if [[ -n "$_RAW_PLUGIN_DIR" ]] && [[ "${_RAW_PLUGIN_DIR:0:1}" == "/" ]]; then
    _ABS_PLUGIN_DIR="${_RAW_PLUGIN_DIR%/}"
    _ABS_CLIENT_DIR="${_RAW_CLIENT_DIR%/}"
  fi
fi

# Use the server's local Unix socket when available — it bypasses HTTP-level auth
# and all permission checks entirely (server has EnableLocalMode: true).
# Default Mattermost socket location is /var/tmp/mattermost_local.socket.
_LOCAL_SOCKET="${MM_LOCAL_SOCKET:-/var/tmp/mattermost_local.socket}"

if [[ -S "$_LOCAL_SOCKET" ]]; then
  echo "Local socket found: $_LOCAL_SOCKET — uploading via local mode."

  # If the server's DB is missing, create it and restart so migrations run.
  # Without this, all API calls fail with DB errors and the plugin can't be managed.
  if command -v psql > /dev/null 2>&1; then
    _DB_HEALTH="${MM_WORKTREE_DB:-mattermost_worktree}"
    if ! PGPASSWORD=mostest psql -h localhost -U mmuser -d "$_DB_HEALTH" -q -c "SELECT 1" > /dev/null 2>&1; then
      echo "  Database '$_DB_HEALTH' missing — creating and restarting worktree server..."
      PGPASSWORD=mostest psql -h localhost -U mmuser -d postgres -q \
        -c "CREATE DATABASE $_DB_HEALTH OWNER mmuser;" 2>/dev/null || true
      "$SCRIPT_DIR/stop-worktree-server.sh" 2>/dev/null || true
      "$SCRIPT_DIR/start-worktree-server.sh"
      echo -n "  Waiting for socket..."
      for _wi in $(seq 1 30); do
        [[ -S "$_LOCAL_SOCKET" ]] && break
        sleep 2
        echo -n "."
      done
      echo ""
      [[ -S "$_LOCAL_SOCKET" ]] || { echo "ERROR: server did not come back up."; exit 1; }
      # Socket is up but migrations may still be running — wait until the users table exists.
      echo -n "  Waiting for migrations..."
      for _mi in $(seq 1 60); do
        if PGPASSWORD=mostest psql -h localhost -U mmuser -d "$_DB_HEALTH" -q \
            -c "SELECT 1 FROM users LIMIT 1" > /dev/null 2>&1; then
          break
        fi
        sleep 2
        echo -n "."
      done
      echo ""
      echo "  Server restarted and migrations complete."
    fi
  fi

  # Ensure admin user exists BEFORE upload so HTTP fallback can authenticate if upload fails.
  _AU="${MM_ADMIN_USER:-sysadmin}"
  _AP="${MM_ADMIN_PASSWORD:-Sys@dmin-sample1}"
  echo "Ensuring admin user '$_AU' exists..."
  # Open server so user creation works even on a fresh DB.
  curl -s -o /dev/null --unix-socket "$_LOCAL_SOCKET" \
    -X PUT "http://localhost/api/v4/config/patch" \
    -H "Content-Type: application/json" \
    -d '{"TeamSettings":{"EnableOpenServer":true,"EnableUserCreation":true}}' || true
  # Use HTTP status to distinguish "user found" from "user not found" error JSON.
  # Both return an "id" field, but the error response has status_code != 200.
  _USER_HTTP=$(curl -s -o /tmp/_user_lookup.json -w "%{http_code}" \
    --unix-socket "$_LOCAL_SOCKET" \
    "http://localhost/api/v4/users/username/$_AU" 2>/dev/null || echo "000")
  if [[ "$_USER_HTTP" == "200" ]]; then
    _ADMIN_ID=$(jq -r '.id // empty' /tmp/_user_lookup.json 2>/dev/null)
  else
    _ADMIN_ID=""
  fi
  if [[ -z "$_ADMIN_ID" ]]; then
    _CU=$(curl -s --unix-socket "$_LOCAL_SOCKET" \
      -X POST "http://localhost/api/v4/users" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"sysadmin@sample.mattermost.com\",\"username\":\"$_AU\",\"password\":\"$_AP\",\"first_name\":\"System\",\"last_name\":\"Admin\"}" \
      2>/dev/null || echo '{}')
    _ADMIN_ID=$(echo "$_CU" | jq -r 'if .status_code then empty else .id end' 2>/dev/null)
    [[ -n "$_ADMIN_ID" ]] && echo "  Created admin user: $_ADMIN_ID" || echo "  WARNING: Could not create admin user: ${_CU:0:200}"
  fi
  if [[ -n "$_ADMIN_ID" ]]; then
    curl -s -o /dev/null --unix-socket "$_LOCAL_SOCKET" \
      -X PUT "http://localhost/api/v4/users/$_ADMIN_ID/roles" \
      -H "Content-Type: application/json" \
      -d '{"roles":"system_admin system_user"}' 2>/dev/null || true
    echo "  admin user ready (ID: $_ADMIN_ID)"
  fi

  # Disable the plugin and wait for the subprocess to fully stop before uploading.
  # force=true handles removal and reinstall; pre-deleting creates an inconsistent
  # state that causes "plugin already active" on re-activation.
  curl -s -o /dev/null --unix-socket "$_LOCAL_SOCKET" \
    -X POST "http://localhost/api/v4/plugins/$PLUGIN_ID/disable" || true
  # Give the plugin subprocess time to begin exiting before we start polling.
  # Without this, the API may report "not active" before the OS process exits,
  # causing force=true's activatePlugin to race with the still-running subprocess.
  sleep 3
  # Poll until the plugin is no longer active (up to 10 s) so the subprocess exits.
  # Only break on HTTP 200 + not-in-active-list. API errors (DB down, 500s) are treated
  # as "still unknown" and keep waiting — avoids false-inactive when the DB was unhealthy.
  for _i in $(seq 1 10); do
    _PLUGINS_HTTP=$(curl -s -o /tmp/_plugins.json -w "%{http_code}" \
      --unix-socket "$_LOCAL_SOCKET" "http://localhost/api/v4/plugins" 2>/dev/null || echo "000")
    if [[ "$_PLUGINS_HTTP" == "200" ]]; then
      if ! jq -e ".active[]? | select(.id == \"${PLUGIN_ID}\")" /tmp/_plugins.json > /dev/null 2>&1; then
        break
      fi
    fi
    sleep 1
  done
  # Hard fallback: if still active after polling, delete and wipe before uploading.
  _PLUGINS_HTTP=$(curl -s -o /tmp/_plugins.json -w "%{http_code}" \
    --unix-socket "$_LOCAL_SOCKET" "http://localhost/api/v4/plugins" 2>/dev/null || echo "000")
  if [[ "$_PLUGINS_HTTP" == "200" ]] && \
      jq -e ".active[]? | select(.id == \"${PLUGIN_ID}\")" /tmp/_plugins.json > /dev/null 2>&1; then
    echo "  plugin still active after 10s — forcing removal before upload."
    curl -s -o /dev/null --unix-socket "$_LOCAL_SOCKET" \
      -X DELETE "http://localhost/api/v4/plugins/$PLUGIN_ID" || true
    rm -rf "$_ABS_PLUGIN_DIR/$PLUGIN_ID" 2>/dev/null || true
    rm -rf "$_ABS_CLIENT_DIR/$PLUGIN_ID" 2>/dev/null || true
    sleep 2
  fi

  HTTP_CODE=$(curl -s -o /tmp/deploy_response.json -w "%{http_code}" \
    --unix-socket "$_LOCAL_SOCKET" \
    -F "plugin=@$BUNDLE" -F "force=true" \
    "http://localhost/api/v4/plugins")
  BODY=$(cat /tmp/deploy_response.json)

  if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
    echo "Uploaded successfully (HTTP $HTTP_CODE). Plugin ID: $PLUGIN_ID"
    curl -s -o /dev/null --unix-socket "$_LOCAL_SOCKET" \
      -X POST "http://localhost/api/v4/plugins/$PLUGIN_ID/enable" || true
    echo "Plugin enabled."

    # Ensure system_admin role has all required permissions.
    # Two-pronged: roles API via socket (proper invalidation) + psql fallback.
    echo "Refreshing system_admin role permissions..."
    # playbook_* and run_* are plugin-registered permissions — excluded from the PATCH because
    # the server rejects them until the plugin's OnActivate completes. They are written via psql.
    # manage_others_teams / sysconsole_read|write_authentication were removed in newer MM versions.
    _FULL_PERMS="manage_system manage_team manage_roles create_team add_user_to_team remove_user_from_team import_team view_team list_team_channels read_channel create_public_channel create_private_channel manage_public_channel_members manage_private_channel_members manage_public_channel_properties manage_private_channel_properties delete_public_channel delete_private_channel manage_channel_roles edit_other_users delete_post delete_others_posts manage_bots manage_others_bots create_user_access_token read_user_access_token revoke_user_access_token sysconsole_read_plugins sysconsole_write_plugins sysconsole_read_site sysconsole_write_site sysconsole_read_environment sysconsole_write_environment sysconsole_read_reporting sysconsole_write_reporting sysconsole_read_integrations sysconsole_write_integrations sysconsole_read_user_management_users sysconsole_write_user_management_users sysconsole_write_user_management_permissions sysconsole_read_user_management_permissions sysconsole_write_user_management_groups sysconsole_read_user_management_groups sysconsole_write_user_management_teams sysconsole_read_user_management_teams sysconsole_write_user_management_channels sysconsole_read_user_management_channels sysconsole_write_user_management_system_roles sysconsole_read_user_management_system_roles sysconsole_read_about sysconsole_write_about sysconsole_read_experimental sysconsole_write_experimental"
    _USER_PERMS_BASE="create_public_channel create_private_channel invite_user join_public_teams create_post create_direct_channel add_reaction view_team list_team_channels read_channel join_public_channels upload_file playbook_public_create playbook_public_manage_properties playbook_public_manage_members playbook_public_view run_create run_manage_properties run_manage_members"

    # On a fresh DB, morph migrations create the schema but NOT the built-in role rows.
    # Without rows in the roles table, SessionHasPermissionTo returns false for ALL
    # HTTP requests (socket requests use IsUnrestricted() and bypass this check).
    # INSERT both core roles here (idempotent via ON CONFLICT) so the in-memory cache
    # warm-up below populates the server's role cache with real permissions.
    if command -v psql > /dev/null 2>&1; then
      _ROLE_DB="${MM_WORKTREE_DB:-mattermost_worktree}"
      _RI_TS=$(( $(date +%s) * 1000 ))
      PGPASSWORD=mostest psql -h localhost -U mmuser -d "$_ROLE_DB" -q -c "
        INSERT INTO roles (id,name,displayname,description,permissions,schememanaged,builtin,createat,updateat,deleteat)
        VALUES ('sa000000000000000000000000','system_admin','authentication.roles.global_admin.name','authentication.roles.global_admin.description','$_FULL_PERMS',true,true,$_RI_TS,$_RI_TS,0)
        ON CONFLICT (name) DO UPDATE SET permissions=EXCLUDED.permissions, updateat=EXCLUDED.updateat;
        INSERT INTO roles (id,name,displayname,description,permissions,schememanaged,builtin,createat,updateat,deleteat)
        VALUES ('su000000000000000000000000','system_user','authentication.roles.global_user.name','authentication.roles.global_user.description','$_USER_PERMS_BASE',true,true,$_RI_TS,$_RI_TS,0)
        ON CONFLICT (name) DO UPDATE SET permissions=EXCLUDED.permissions, updateat=EXCLUDED.updateat;
      " > /dev/null 2>&1 && echo "  roles DB init: OK" || echo "  roles DB init: failed (non-fatal)"
    fi
    # Warm the server's in-memory role cache by fetching both roles via socket.
    # GetByName checks the cache (miss on fresh DB), fetches from DB, and caches the result.
    # This must run AFTER psql INSERT so the DB has the rows to return.
    for _rn in "system_admin" "system_user"; do
      _WARM_H=$(curl -s -o /dev/null -w "%{http_code}" \
        --unix-socket "$_LOCAL_SOCKET" \
        "http://localhost/api/v4/roles/name/$_rn" 2>/dev/null || echo "000")
      echo "  role cache warm ($_rn): HTTP $_WARM_H"
    done

    # Path 1: roles API via socket
    _SA_HTTP=$(curl -s -o /tmp/_role_get.json -w "%{http_code}" \
      --unix-socket "$_LOCAL_SOCKET" \
      "http://localhost/api/v4/roles/name/system_admin" 2>/dev/null || echo "000")
    _SA=$(cat /tmp/_role_get.json 2>/dev/null || echo '{}')
    # Only extract .id on HTTP 200 — error responses also have an "id" field (error code).
    if [[ "$_SA_HTTP" == "200" ]]; then
      _SA_ID=$(echo "$_SA" | jq -r '.id // empty' 2>/dev/null)
    else
      _SA_ID=""
      echo "  WARNING: GET system_admin role returned HTTP $_SA_HTTP: ${_SA:0:120}"
    fi
    if [[ -n "$_SA_ID" ]]; then
      # The local mode PATCH endpoint is PUT /api/v4/roles/{id}/patch (not /api/v4/roles/{id}).
      # It takes RolePatch JSON: {"permissions": [...]}.  Sending the full role JSON causes 404.
      # PatchRole compares the provided permissions against the CACHED role. If different (which
      # they will be on repeated deploys where the cache is stale), it saves to DB AND invalidates
      # the cache — making the new permissions visible to subsequent HTTP permission checks.
      # Use _FULL_PERMS directly — do NOT union with the existing role's permissions.
      # Unioning inherits stale/removed permissions from prior DB writes, which cause
      # IsValid() to reject the PATCH. _FULL_PERMS already contains only valid permissions.
      _NEW_PERMS=$(echo "$_FULL_PERMS" | jq -R '[split(" ")[]]' 2>/dev/null)
      if [[ -n "$_NEW_PERMS" ]]; then
        _PUT_CODE=$(curl -s -o /tmp/_role_resp.json -w "%{http_code}" \
          --unix-socket "$_LOCAL_SOCKET" \
          -X PUT "http://localhost/api/v4/roles/$_SA_ID/patch" \
          -H "Content-Type: application/json" \
          -d "{\"permissions\": $_NEW_PERMS}" 2>/dev/null || echo "000")
        echo "  roles API PATCH: HTTP $_PUT_CODE"
        [[ "$_PUT_CODE" -ge 400 ]] && cat /tmp/_role_resp.json >&2 || true
      fi
    else
      echo "  WARNING: could not fetch system_admin role via socket (response: ${_SA:0:120})"
    fi

    # Invalidate role cache via socket so both updates take effect immediately.
    _CC=$(curl -s -o /dev/null -w "%{http_code}" \
      --unix-socket "$_LOCAL_SOCKET" \
      -X POST "http://localhost/api/v4/caches/invalidate" 2>/dev/null || echo "000")
    echo "  cache invalidate: HTTP $_CC"

    # Set config via socket (EnableOpenServer so seed.sh can create teams).
    _CFG=$(curl -s -o /tmp/_cfg_resp.json -w "%{http_code}" \
      --unix-socket "$_LOCAL_SOCKET" \
      -X PUT "http://localhost/api/v4/config/patch" \
      -H "Content-Type: application/json" \
      -d '{"ServiceSettings":{"EnableDeveloper":true,"EnableTesting":true},"TeamSettings":{"EnableOpenServer":true,"EnableUserCreation":true,"EnableTeamCreation":true}}' \
      2>/dev/null || echo "000")
    echo "  config patch: HTTP $_CFG"
    [[ "$_CFG" -ge 400 ]] && cat /tmp/_cfg_resp.json >&2 || true

    # psql: ensure admin user has system_admin role in DB (handles socket-to-different-server case).
    if command -v psql > /dev/null 2>&1; then
      _DB_U="${MM_WORKTREE_DB:-mattermost_worktree}"
      PGPASSWORD=mostest psql -h localhost -U mmuser -d "$_DB_U" -q -c \
        "UPDATE users SET roles = 'system_admin system_user' WHERE username = '$_AU';" \
        > /dev/null 2>&1 && echo "  psql user role: OK" || echo "  psql user role: failed (non-fatal)"
    fi

    echo "Waiting for plugin to fully load on all nodes..."
    sleep 8
    echo "Done. $MM_URL"
    exit 0
  else
    echo "WARNING: Local socket upload returned HTTP $HTTP_CODE — falling back to API." >&2
    echo "$BODY" >&2
  fi
  # Re-authenticate for HTTP fallback — we skipped HTTP auth when the socket was present.
  if [[ -z "$MM_TOKEN" ]] && [[ -n "${MM_ADMIN_USER:-}" ]] && [[ -n "${MM_ADMIN_PASSWORD:-}" ]]; then
    _REAUTH=$(curl -s -i --max-time 15 \
      -H "Content-Type: application/json" \
      -d "{\"login_id\":\"$MM_ADMIN_USER\",\"password\":\"$MM_ADMIN_PASSWORD\"}" \
      "$MM_URL/api/v4/users/login")
    MM_TOKEN=$(echo "$_REAUTH" | grep -i "^Token:" | awk '{print $2}' | tr -d '\r') || true
    [[ -n "$MM_TOKEN" ]] && echo "Re-authenticated for HTTP fallback." || echo "WARNING: HTTP re-auth failed — upload will likely fail."
  fi
fi

# ── HTTP preflight: re-inject sysconsole permissions ──────────────────────────
# Mattermost v8+ treats system_admin as scheme-managed: psql updates to the roles
# table are IGNORED because the server's in-memory cache takes precedence.
# Use the local socket (still available after a failed socket upload) to update
# the role via the proper roles API, which correctly handles scheme-managed roles.
# Only fall back to psql when no socket is present.
_PRE_SOCKET="${MM_LOCAL_SOCKET:-/var/tmp/mattermost_local.socket}"
_DB_PRE="${MM_WORKTREE_DB:-mattermost_worktree}"
_AU_PRE="${MM_ADMIN_USER:-sysadmin}"
echo "HTTP preflight: fixing system_admin permissions..."

if [[ -S "$_PRE_SOCKET" ]]; then
  # Socket path: update role via roles API (handles scheme-managed roles correctly).
  _PRE_PERMS="sysconsole_write_plugins sysconsole_read_plugins"
  _SA_PRE_HTTP=$(curl -s -o /tmp/_sa_pre_get.json -w "%{http_code}" \
    --unix-socket "$_PRE_SOCKET" \
    "http://localhost/api/v4/roles/name/system_admin" 2>/dev/null || echo "000")
  _SA_PRE=$(cat /tmp/_sa_pre_get.json 2>/dev/null || echo '{}')
  if [[ "$_SA_PRE_HTTP" == "200" ]]; then
    _SA_PRE_ID=$(echo "$_SA_PRE" | jq -r '.id // empty' 2>/dev/null)
  else
    _SA_PRE_ID=""
    echo "  WARNING: GET system_admin role returned HTTP $_SA_PRE_HTTP"
  fi
  if [[ -n "$_SA_PRE_ID" ]]; then
    _PP_ARR=$(echo "$_PRE_PERMS" | jq -R 'split(" ")' 2>/dev/null)
    _SA_PRE_PATCH=$(echo "$_SA_PRE" | jq --argjson p "$_PP_ARR" \
      '.permissions |= (. + $p | unique)' 2>/dev/null)
    _PPR=$(curl -s -o /tmp/_pre_role.json -w "%{http_code}" \
      --unix-socket "$_PRE_SOCKET" \
      -X PUT "http://localhost/api/v4/roles/$_SA_PRE_ID" \
      -H "Content-Type: application/json" \
      -d "$_SA_PRE_PATCH" 2>/dev/null || echo "000")
    echo "  roles API (socket): HTTP $_PPR"
    [[ "$_PPR" -ge 400 ]] && cat /tmp/_pre_role.json >&2 || true
  else
    echo "  WARNING: could not fetch system_admin role via socket"
  fi
  # Invalidate role cache via socket so the update takes effect immediately.
  _PCI=$(curl -s -o /dev/null -w "%{http_code}" \
    --unix-socket "$_PRE_SOCKET" \
    -X POST "http://localhost/api/v4/caches/invalidate" 2>/dev/null || echo "000")
  echo "  cache invalidate (socket): HTTP $_PCI"
  # Ensure user row has system_admin role in DB.
  if command -v psql > /dev/null 2>&1; then
    PGPASSWORD=mostest psql -h localhost -U mmuser -d "$_DB_PRE" -q -c \
      "UPDATE users SET roles = 'system_admin system_user' WHERE username = '$_AU_PRE';" \
      > /dev/null 2>&1 && echo "  psql user role: OK" || echo "  psql user role: failed (non-fatal)"
  fi
elif [[ "$MM_URL" == *"localhost"* || "$MM_URL" == *"127.0.0.1"* ]] && command -v psql > /dev/null 2>&1; then
  # No socket — psql only (may not take effect for scheme-managed roles, but try).
  PGPASSWORD=mostest psql -h localhost -U mmuser -d "$_DB_PRE" -q -c \
    "UPDATE users SET roles = 'system_admin system_user' WHERE username = '$_AU_PRE';" \
    > /dev/null 2>&1 && echo "  psql user role: OK" || echo "  psql user role: failed"
  PGPASSWORD=mostest psql -h localhost -U mmuser -d "$_DB_PRE" -q -c \
    "UPDATE roles SET permissions = trim(coalesce(permissions,'')) || ' sysconsole_write_plugins sysconsole_read_plugins' WHERE name = 'system_admin' AND position('sysconsole_write_plugins' IN coalesce(permissions,'')) = 0;" \
    > /dev/null 2>&1 && echo "  psql role perms: OK" || echo "  psql role perms: failed"
fi

# Re-login after role update so the new token reflects the updated permissions.
_RL=$(curl -s -i --max-time 15 \
  -H "Content-Type: application/json" \
  -d "{\"login_id\":\"$_AU_PRE\",\"password\":\"${MM_ADMIN_PASSWORD:-Sys@dmin-sample1}\"}" \
  "$MM_URL/api/v4/users/login")
_NT=$(echo "$_RL" | grep -i "^Token:" | awk '{print $2}' | tr -d '\r') || true
[[ -n "$_NT" ]] && MM_TOKEN="$_NT" && echo "  re-authenticated." || echo "  WARNING: re-auth failed"

# Disable and remove plugin directory before upload to avoid "destination already exists" errors
echo "Disabling plugin before upload..."
curl -s -o /dev/null \
  -X POST \
  -H "Authorization: Bearer $MM_TOKEN" \
  "$MM_URL/api/v4/plugins/$PLUGIN_ID/disable"
curl -s -o /dev/null \
  -X DELETE \
  -H "Authorization: Bearer $MM_TOKEN" \
  "$MM_URL/api/v4/plugins/$PLUGIN_ID" || true
rm -rf "$_ABS_PLUGIN_DIR/$PLUGIN_ID" 2>/dev/null || true
rm -rf "$_ABS_CLIENT_DIR/$PLUGIN_ID" 2>/dev/null || true

# Upload plugin (force=true replaces existing)
echo "Uploading plugin..."
HTTP_CODE=$(curl -s -o /tmp/deploy_response.json -w "%{http_code}" \
  -H "Authorization: Bearer $MM_TOKEN" \
  -F "plugin=@$BUNDLE" \
  -F "force=true" \
  "$MM_URL/api/v4/plugins")

BODY=$(cat /tmp/deploy_response.json)

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
  echo "Uploaded successfully (HTTP $HTTP_CODE). Plugin ID: $PLUGIN_ID"
else
  echo "ERROR: Upload failed (HTTP $HTTP_CODE)." >&2
  echo "$BODY" >&2
  exit 1
fi

# Enable the plugin
echo "Enabling plugin $PLUGIN_ID..."
HTTP_CODE=$(curl -s -o /tmp/enable_response.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $MM_TOKEN" \
  "$MM_URL/api/v4/plugins/$PLUGIN_ID/enable")

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
  echo "Plugin enabled."
else
  BODY=$(cat /tmp/enable_response.json)
  # 304 means it was already enabled
  if [[ "$HTTP_CODE" -eq 304 ]]; then
    echo "Plugin already enabled."
  else
    echo "WARNING: Enable returned HTTP $HTTP_CODE." >&2
    echo "$BODY" >&2
  fi
fi

echo "Waiting for plugin to fully load on all nodes..."
sleep 8
echo "Done. $MM_URL"