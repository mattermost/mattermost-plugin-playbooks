# Task 51: Retire migrated Cypress specs

**Task id**: `retire-cypress` · **Kind**: cleanup

## Target

- `e2e-tests/cypress/tests/integration/playbooks/**`

## What to do

Run last. For every Cypress spec in `docs/cypress_inventory.md`, check whether every task that lists it as a source is `done` in `docs/todo.json`. Delete fully covered specs (git rm). Also delete `e2e-tests/cypress/tests/integration/playbooks/tours_spec_ignore_.js`: it was dropped by decision (never ran, not ported). `channels/playbook_run_actions.js` follows the normal rule (covered by `run-start-actions`). A spec that has a PARTIAL/GAP row in `docs/tasks/go-coverage-gaps.result.md` assigned to "Follow-ups (outside the migration)" is NOT fully covered: keep it. Leave the others, and list them with the blocking task ids in `docs/tasks/retire-cypress.result.md`. Also remove now-unused Cypress support helpers only if nothing else imports them. Do not touch CI config unless all specs are gone; in that case, note it instead of changing it.

## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Rules

- Read `docs/todo.json` to know which tasks are done. Only delete specs whose every consuming task is done.
- **Quality gates are part of done.** Before reporting done you MUST run `e2e-tests/playwright/docs/quality.sh 2>&1 | tee e2e-tests/playwright/docs/tasks/reviews/<task-id>.attempt-<n>.quality.log` (it runs the CI checks matching your change: lint/types for webapp, Cypress and Playwright, i18n + GraphQL regeneration, `make deploy`, plus the hard-rule checks: no Go changes, webapp a11y-only) and **fix every issue it reports, then re-run it until it prints `QUALITY: PASS`**. Never disable a lint rule, add `eslint-disable`/`//nolint`, edit `eslint.config.mjs`/`eslint-rules/` to weaken a rule, or skip a test to get green. Keep regenerated files (`webapp/i18n/en.json`, GraphQL generated code) in the tree. If a failure is pre-existing and unrelated (prove it: it also fails on a clean `HEAD` via `git stash push -u -- e2e-tests webapp`, run, `git stash pop`; never stash the whole repo, which has untracked agent tooling), don't hide it: record the proof under `## Pre-existing failures` at the end of the quality log, and keep everything else green.
