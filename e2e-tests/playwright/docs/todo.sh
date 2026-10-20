#!/usr/bin/env bash
# Helper for e2e-tests/playwright/docs/todo.json. All writes go through here so
# the file stays valid JSON. Usage: see MIGRATION_RUNBOOK.md.
set -euo pipefail

TODO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/todo.json"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-5}"
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

write() { # write <jq filter> [jq args...]
    local filter="$1"; shift
    local tmp; tmp="$(mktemp)"
    jq "$@" "$filter" "$TODO" > "$tmp" && mv "$tmp" "$TODO"
}

require_task() {
    jq -e --arg id "$1" '.tasks[] | select(.id == $id)' "$TODO" > /dev/null \
        || { echo "unknown task: $1" >&2; exit 1; }
}

cmd="${1:-}"; shift || true
case "$cmd" in
    next) # first task that is not done and not blocked
        jq -r '[.tasks[] | select(.done == false and .review_status != "BLOCKED")][0] // empty | .id' "$TODO" ;;
    get) # get <id>
        require_task "$1"; jq --arg id "$1" '.tasks[] | select(.id == $id)' "$TODO" ;;
    doc) # doc <id>
        require_task "$1"; jq -r --arg id "$1" '.tasks[] | select(.id == $id) | .doc' "$TODO" ;;
    start-attempt) # start-attempt <id>  -> prints new attempt number
        require_task "$1"
        write '(.tasks[] | select(.id == $id)) |= (.attempts += 1 | .coded_at = null | .reviewed_at = null | .review_status = null)' --arg id "$1"
        jq -r --arg id "$1" '.tasks[] | select(.id == $id) | .attempts' "$TODO" ;;
    coded) # coded <id>   (coding agent)
        require_task "$1"
        write '(.tasks[] | select(.id == $id) | .coded_at) = $t' --arg id "$1" --arg t "$(now)" ;;
    reviewed) # reviewed <id> OK|NOK   (review agent)
        require_task "$1"
        [[ "${2:-}" == OK || "${2:-}" == NOK ]] || { echo "status must be OK or NOK" >&2; exit 1; }
        write '(.tasks[] | select(.id == $id)) |= (.reviewed_at = $t | .review_status = $s)' --arg id "$1" --arg t "$(now)" --arg s "$2" ;;
    done) # done <id>   (orchestrator, only after review OK)
        require_task "$1"
        jq -e --arg id "$1" '.tasks[] | select(.id == $id) | .review_status == "OK" and .coded_at != null' "$TODO" > /dev/null \
            || { echo "refusing: task $1 has no coded_at or review is not OK" >&2; exit 1; }
        write '(.tasks[] | select(.id == $id) | .done) = true' --arg id "$1" ;;
    block) # block <id> "<note>"   (orchestrator, after MAX_ATTEMPTS NOK)
        require_task "$1"
        write '(.tasks[] | select(.id == $id)) |= (.review_status = "BLOCKED" | .notes = $n)' --arg id "$1" --arg n "${2:?note required}" ;;
    unblock) # unblock <id>   (human, to retry a blocked task)
        require_task "$1"
        write '(.tasks[] | select(.id == $id)) |= (.review_status = null | .attempts = 0)' --arg id "$1" ;;
    status) # summary table
        jq -r '.tasks[] | [ (if .done then "DONE" elif .review_status == "BLOCKED" then "BLOCKED" else "TODO" end), .id, (.attempts|tostring), (.coded_at // "-"), (.reviewed_at // "-") ] | @tsv' "$TODO" | column -t ;;
    max-attempts)
        echo "$MAX_ATTEMPTS" ;;
    *)
        echo "usage: todo.sh next|get <id>|doc <id>|start-attempt <id>|coded <id>|reviewed <id> OK|NOK|done <id>|block <id> <note>|unblock <id>|status" >&2
        exit 2 ;;
esac
