#!/usr/bin/env bash
# Runs the CI quality gates (mirrors .github/workflows/ci.yaml) that apply to
# the current uncommitted change (vs HEAD). Exit code 0 = everything green.
#
#   e2e-tests/playwright/docs/quality.sh 2>&1 | tee <log file>
#
# Gates:
#   always            : make check-style-web (webapp + cypress + playwright eslint/tsc), caches cleared
#   webapp/ changed   : make i18n-extract-webapp, make graphql (regenerated files must be kept),
#                       jest on related tests, make deploy (build + install so E2E runs the new code)
#   Go changed        : gofmt, make check-style-server (go vet, golangci-lint, license govet),
#                       go mod tidy diff, go test on changed packages, make deploy
#   plugin.json       : make apply + manifest diff
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

# Changed files vs HEAD:
#   - tracked changes (staged or not) count everywhere,
#   - untracked files count when they are inside a directory (root-level scratch files such as
#     release notes are ignored),
#   - agent tooling (.agents/, .claude/, .cursor/) and node_modules never count.
# `quality.sh --list` prints this set (the runbook uses it to inspect/commit the work).
ignore='^\.(agents|claude|cursor)/|/node_modules/|^node_modules/'
changed="$( { git diff --name-only HEAD; git ls-files --others --exclude-standard | grep '/'; } \
    | grep -vE "$ignore" | sort -u)"
if [ "${1:-}" = "--list" ]; then
    [ -n "$changed" ] && echo "$changed"
    exit 0
fi
has() { grep -qE "$1" <<<"$changed"; }
failures=()
gate() { # gate <name> <bash command>
    echo
    echo "=== GATE $1: $2"
    if bash -c "$2"; then echo "=== PASS $1"; else echo "=== FAIL $1"; failures+=("$1"); fi
}

echo "Changed files:"; sed 's/^/  /' <<<"$changed"

# ---- Migration hard rules (see MIGRATION_RUNBOOK.md "Hard rules") ----
# 0. The migration only touches e2e-tests/ and (a11y-only) webapp/.
outside="$(grep -vE '^(e2e-tests|webapp)/' <<<"$changed" | grep -v '^$' || true)"
echo; echo "=== GATE allowed-paths"
if [ -n "$outside" ]; then
    echo "Only e2e-tests/ and webapp/ may change during the migration. Outside changes:"; sed 's/^/  /' <<<"$outside"
    echo "=== FAIL allowed-paths"; failures+=(allowed-paths)
else
    echo "=== PASS allowed-paths"
fi
# 1. No Go file may change.
go_changed="$(grep -E '\.go$|^go\.(mod|sum)$' <<<"$changed" || true)"
echo; echo "=== GATE no-go-changes"
if [ -n "$go_changed" ]; then
    echo "Go files must not change during the migration:"; sed 's/^/  /' <<<"$go_changed"
    echo "=== FAIL no-go-changes"; failures+=(no-go-changes)
else
    echo "=== PASS no-go-changes"
fi
# 2. Webapp: only accessibility attributes may be added (aria-*, role, alt, htmlFor/id
#    for label association) plus the i18n strings they need. No new files, no deletions.
#    A script can't fully judge "a11y only", so print the diff for the reviewer and fail on the obvious violations.
if has '^webapp/'; then
    gate webapp-a11y-only '
        new_files=$( { git diff --name-only --diff-filter=A HEAD -- webapp; git ls-files --others --exclude-standard -- webapp; } | grep -v "/node_modules/" | sort -u || true)
        deleted=$(git diff --name-only --diff-filter=D HEAD -- webapp)
        testids=$(git diff -U0 HEAD -- webapp/src | grep -E "^\+" | grep -E "data-testid" || true)
        echo "--- webapp diff (reviewer: every hunk must be an a11y attribute or its i18n string) ---"
        git --no-pager diff -U1 HEAD -- webapp
        rc=0
        [ -z "$new_files" ] || { echo "FORBIDDEN new webapp files: $new_files"; rc=1; }
        [ -z "$deleted" ] || { echo "FORBIDDEN deleted webapp files: $deleted"; rc=1; }
        [ -z "$testids" ] || { echo "FORBIDDEN data-testid additions (use a11y attributes):"; echo "$testids"; rc=1; }
        exit $rc'
fi

gate lint-web 'rm -f webapp/.eslintcache webapp/.stylelintcache e2e-tests/.eslintcache e2e-tests/cypress/.eslintcache e2e-tests/playwright/.eslintcache && make check-style-web'

if has '^plugin\.json$'; then
    gate manifest 'make apply && git --no-pager diff --exit-code -- "*manifest.*"'
fi

need_deploy=0
if has '^webapp/'; then
    need_deploy=1
    # These regenerate files; CI fails if they differ from what is committed, so keep the result in the tree.
    gate i18n-extract 'make i18n-extract-webapp && git --no-pager diff --stat -- webapp/i18n/en.json'
    gate graphql 'make graphql && git --no-pager diff --stat -- webapp/src/graphql/generated/ server/graphql/models.go'
    web_files="$(grep -E '^webapp/src/.*\.(ts|tsx|js|jsx)$' <<<"$changed" | sed 's#^webapp/##' | tr '\n' ' ')"
    if [ -n "$web_files" ]; then
        gate webapp-unit-tests "cd webapp && npx jest --ci --forceExit --passWithNoTests --findRelatedTests $web_files"
    fi
fi

if has '\.go$|^go\.(mod|sum)$'; then
    need_deploy=1
    gate gofmt 'out=$(gofmt -l server client build 2>/dev/null); [ -z "$out" ] || { echo "not gofmt-ed:"; echo "$out"; exit 1; }'
    gate lint-server 'bin/golangci-lint cache clean 2>/dev/null; make check-style-server'
    gate go-mod-tidy 'go mod tidy && git --no-pager diff --exit-code -- go.mod go.sum'
    pkgs="$(grep -E '\.go$' <<<"$changed" | xargs -n1 dirname 2>/dev/null | sort -u | sed 's#^#./#' | tr '\n' ' ')"
    if [ -n "$pkgs" ]; then
        gate go-tests "go test $pkgs"
    fi
fi

if [ "$need_deploy" = 1 ]; then
    gate deploy 'make deploy'
    echo "NOTE: product code changed and was redeployed. Re-run the Playwright spec(s) after this script."
fi

echo
if [ ${#failures[@]} -eq 0 ]; then
    echo "QUALITY: PASS"
    exit 0
fi
echo "QUALITY: FAIL (${failures[*]})"
exit 1
