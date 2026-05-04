#!/usr/bin/env bash
# demo.sh — Interactive walkthrough of the new_channel_only feature.
# Run seed.sh first, then open $MM_URL in your browser and follow the prompts.
#
# Usage:
#   ./scripts/demo.sh

set -euo pipefail
trap 'echo ""; echo "Interrupted."; exit 130' INT TERM

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

STATE_FILE="$SCRIPT_DIR/seed-state.env"
[ -f "$STATE_FILE" ] || { echo "ERROR: Run seed.sh first. State file not found: $STATE_FILE"; exit 1; }
source "$STATE_FILE"

pause() {
    echo ""
    echo "  >>> Press Enter to continue (Ctrl+C to quit)..."
    read -r || exit 130
}

section() {
    echo ""
    echo "=========================================================="
    echo "  $1"
    echo "=========================================================="
}

echo ""
echo "=== new_channel_only Feature Demo ==="
echo "Server: $MM_URL"
echo ""
echo "Two playbooks were seeded:"
echo "  PB1 'Incident Response'  — new_channel_only=true  (ID: $PB1_ID)"
echo "  PB2 'Release Checklist'  — new_channel_only=false (ID: $PB2_ID)"
echo ""

# STEP 1: Toggle visible in the playbook editor

section "STEP 1: Verify toggle in the playbook editor (PB1: enabled)"
echo ""
echo "  1. Go to: $MM_URL/playbooks/playbooks/$PB1_ID/outline"
echo ""
echo "  2. In the playbook editor, look for the 'Only allow runs in new channels' toggle."
echo "     Expected: Toggle is present and CHECKED (enabled)."
echo ""
echo "  3. Scroll down and review the rest of the playbook settings."
echo "     The toggle should be visible and editable."
pause

# STEP 2: Contrast - toggle disabled in PB2

section "STEP 2: Contrast — toggle in playbook without restriction (PB2: disabled)"
echo ""
echo "  1. Go to: $MM_URL/playbooks/playbooks/$PB2_ID/outline"
echo ""
echo "  2. Look for the same 'Only allow runs in new channels' toggle."
echo "     Expected: Toggle is present and UNCHECKED (disabled, default behavior)."
pause

# STEP 3: Verify run creation modal - restricted options

section "STEP 3: Verify run creation modal hides 'Link existing channel' option"
echo ""
echo "  When new_channel_only=true, the run creation modal should only show"
echo "  'Create a new channel' and hide 'Link to an existing channel'."
echo ""
echo "  1. Go to: $MM_URL/playbooks/playbooks/$PB1_ID/outline"
echo ""
echo "  2. Click the 'Run' button (play icon, top-right of the outline view)."
echo ""
echo "  3. In the run creation modal, look at the 'Channel' section."
echo "     Expected: Only 'Create a new channel' is available."
echo "     The 'Link to an existing channel' option should NOT appear."
pause

# STEP 4: Contrast - full options available in PB2

section "STEP 4: Contrast — run modal with full channel options (PB2)"
echo ""
echo "  1. Go to: $MM_URL/playbooks/playbooks/$PB2_ID/outline"
echo ""
echo "  2. Click the 'Run' button."
echo ""
echo "  3. In the 'Channel' section, both options should be visible:"
echo "     - 'Create a new channel'"
echo "     - 'Link to an existing channel'"
echo ""
echo "  This demonstrates the contrast between restricted (PB1) and unrestricted (PB2)."
pause

# STEP 5: Test server-side enforcement (optional API test)

section "STEP 5: Server-side enforcement (API validation)"
echo ""
echo "  The new_channel_only flag is also enforced server-side:"
echo ""
echo "  - POST /runs with channel_id to an existing channel on PB1"
echo "    Result: Rejected with 400/403 error"
echo ""
echo "  - POST /runs with channel_id to an existing channel on PB2"
echo "    Result: Accepted (200 OK)"
echo ""
echo "  To verify this manually, you can use the included smoke_test.sh:"
echo "    ./scripts/smoke_test.sh"
pause

# Summary

section "DEMO COMPLETE"
echo ""
echo "Feature summary:"
echo "  - 'Only allow runs in new channels' toggle in the playbook editor outline"
echo "  - When enabled, the run creation modal hides 'Link to an existing channel'"
echo "  - Server-side enforcement prevents linking to existing channels (API level)"
echo "  - Default is OFF (standard behavior with both options available)"
echo ""
echo "Links:"
echo "  PB1 (restricted):   $MM_URL/playbooks/playbooks/$PB1_ID/outline"
echo "  PB2 (unrestricted): $MM_URL/playbooks/playbooks/$PB2_ID/outline"
echo "  Server:             $MM_URL"
echo ""