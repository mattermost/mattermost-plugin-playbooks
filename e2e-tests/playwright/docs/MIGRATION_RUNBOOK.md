# Cypress → Playwright migration runbook

This runbook is for the **orchestrator**: a human or an agent running inside
Herdr that works through `docs/todo.json` one task at a time. It uses one pi
coding agent and one pi review agent per task, with up to 5 code→review loops.

All paths below are relative to the repo root
(`mattermost-plugin-playbooks/`). The orchestrator runs from there.

## Hard rules for the migration

These apply to every task. The reviewer treats any violation as a BLOCKER.

1. **No Go file may change**: no `*.go` (tests included), `go.mod` or `go.sum`. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** that tests need for role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, and label association (`htmlFor`/`id`). The i18n string an `aria-label` needs is also allowed (`formatMessage` plus the regenerated `webapp/i18n/en.json`). Nothing else: no `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes. `quality.sh` fails on new/deleted webapp files and on `data-testid` additions. It also prints the webapp diff so the reviewer can check that every hunk is a11y-only.
3. **Product bugs are not fixed during the migration.** The affected test stays, marked `test.fixme('<what is broken>')`, and the bug is listed under `## Product bugs found` in the quality log.
4. **The quality gates are part of "done".** The coder must run `e2e-tests/playwright/docs/quality.sh` and fix everything it reports, re-running until it prints `QUALITY: PASS`. Suppressing a check (eslint-disable, skipping a test, loosening config) is not a fix. The only exception is a failure the coder proves is pre-existing on a clean `HEAD`. That proof goes under `## Pre-existing failures` in the quality log.

## Files

| File | Purpose |
|---|---|
| `e2e-tests/playwright/docs/todo.json` | Task list and state. **Only modify it through `todo.sh`.** |
| `e2e-tests/playwright/docs/todo.sh` | Reads and writes `todo.json` safely (`next`, `start-attempt`, `coded`, `reviewed`, `done`, `block`, `status`, ...). |
| `e2e-tests/playwright/docs/tasks/NN-<id>.md` | The task spec: target, what to do, rules, definition of done, and the Cypress coverage with full inventory excerpts. |
| `e2e-tests/playwright/docs/tasks/reviews/<id>.attempt-<n>.md` | Review report written by the review agent for each attempt. |
| `e2e-tests/playwright/docs/tasks/reviews/<id>.attempt-<n>.quality.log` | Output of `quality.sh` saved by the coder for each attempt (plus the `Pre-existing failures` / `Product bugs found` sections). |
| `e2e-tests/playwright/docs/quality.sh` | Runs the CI quality gates that match the current change, and enforces hard rules 1–2. Exit 0 / `QUALITY: PASS` = green. |
| `e2e-tests/playwright/docs/cypress_migration_plan.md` | Consolidation principles P1–P7 and the overall layout. |
| `e2e-tests/playwright/docs/cypress_inventory.md` | Full per-test inventory of the Cypress suite. |
| `e2e-tests/playwright/AGENTS.md` | Playwright conventions. Both agents must follow it. |

## `todo.json` schema

```jsonc
{
  "version": 1,
  "tasks": [
    {
      "id": "start-run-modal",                 // stable id, used everywhere
      "name": "Run creation modal (...)",      // human-readable
      "doc": "e2e-tests/playwright/docs/tasks/04-start-run-modal.md",
      "done": false,                           // true only after a review OK
      "coded_at": null,                        // ISO UTC, set by the coding agent when it finishes an attempt
      "reviewed_at": null,                     // ISO UTC, set by the review agent
      "review_status": null,                   // null | "OK" | "NOK" | "BLOCKED"
      "attempts": 0,                           // code→review loops started (max 5)
      "notes": null                            // why a task is BLOCKED (or other remarks)
    }
  ]
}
```

A task is in one of three states:
- **TODO**: `done == false` and `review_status != "BLOCKED"`. `todo.sh next` returns the first one.
- **DONE**: `done == true`.
- **BLOCKED**: 5 loops ended in NOK. `notes` explains why. `next` skips it. A human runs `todo.sh unblock <id>` to retry it.

`start-attempt` resets `coded_at`, `reviewed_at` and `review_status` for the new loop.
That way, "has the coding agent finished?" is simply "is `coded_at` non-null?".

## Preconditions (check once before starting)

1. You are inside Herdr: `test "$HERDR_ENV" = 1`. Otherwise stop.
2. The Mattermost server is up and the plugin is deployed:
   `curl -sf http://localhost:8065/api/v4/system/ping` returns 200, and the Playwright smoke spec passes:
   `cd e2e-tests/playwright && npx playwright test tests/smoke --reporter=list`.
3. You are on a dedicated branch with no pending work: `e2e-tests/playwright/docs/quality.sh --list` prints nothing.
   `--list` is the single definition of "the work". It covers tracked changes anywhere, plus untracked files inside directories. It ignores agent tooling (`.agents/`, `.claude/`, `.cursor/`), `node_modules`, and root-level scratch files (e.g. release notes). Never stage or stash anything outside that list.
4. `jq` is installed, and `e2e-tests/playwright/docs/todo.sh status` works.

## The loop

```
T = todo.sh next                       # first TODO task; stop when empty
read T.doc                             # orchestrator understands the task
open a Herdr tab for T (coder pane + reviewer pane)
start pi "coder" agent
for attempt in 1..5:
    n = todo.sh start-attempt T
    prompt coder (attempt 1: implement; attempt > 1: fix review n-1)
    wait until coded_at is set (or coder reports BLOCKED → treat as NOK with its reason)
    start a FRESH pi "reviewer" agent
    prompt reviewer → writes reviews/T.attempt-n.md, sets reviewed_at + review_status
    stop the reviewer agent (close its pane)
    if review_status == OK:
        todo.sh done T; commit; break
if not done after 5 attempts:
    todo.sh block T "<why>"; stash the work; leave it out of the commit
close T's tab, go back to the top
```

The coder stays alive across all attempts of a task, so it remembers what it did.
Each review uses a fresh reviewer so it judges the work independently.

### Step 1: pick the task

```bash
ID=$(e2e-tests/playwright/docs/todo.sh next)
[ -z "$ID" ] && echo "nothing left" && exit 0
DOC=$(e2e-tests/playwright/docs/todo.sh doc "$ID")
```

Read `$DOC` yourself before delegating. If the doc is obviously wrong or
outdated (for example, a target file already exists from another task),
fix the doc first.

### Step 2: create the task tab and the coding agent

Create a workspace once (`migration`) and reuse it. Make one tab per task:

```bash
WS=$(herdr workspace list | jq -r '.result.workspaces[] | select(.label=="migration") | .workspace_id')
[ -z "$WS" ] && WS=$(herdr workspace create --cwd "$PWD" --label migration --no-focus | jq -r .result.workspace.workspace_id)

TAB_JSON=$(herdr tab create --workspace "$WS" --cwd "$PWD" --label "$ID" --no-focus)
TAB=$(echo "$TAB_JSON" | jq -r .result.tab.tab_id)
CODER_PANE=$(echo "$TAB_JSON" | jq -r .result.root_pane.pane_id)

herdr agent start coder --kind pi --pane "$CODER_PANE" --timeout 60000
```

Agent names must be unique among live agents. That's why only one task runs at a time
and the reviewer is closed after each review.

### Step 3: prompt the coding agent

Start the attempt, then prompt the coder:

```bash
N=$(e2e-tests/playwright/docs/todo.sh start-attempt "$ID")
```

**Attempt 1 prompt:**

```
You are the CODING agent for migration task `<ID>`.
1. Read, in this order: AGENTS.md, e2e-tests/playwright/AGENTS.md, e2e-tests/playwright/docs/cypress_migration_plan.md (section 1), and your task doc <DOC>.
2. Implement the task exactly as the doc describes. Read the original Cypress specs listed in the doc when you need details beyond the inventory excerpt.
3. Respect the migration hard rules in your task doc: no Go file changes at all; webapp changes are limited to a11y attributes; product bugs become test.fixme, not product fixes.
4. Meet the doc's "Definition of done": the spec passes locally twice. Then run the quality gates:
   e2e-tests/playwright/docs/quality.sh 2>&1 | tee e2e-tests/playwright/docs/tasks/reviews/<ID>.attempt-<N>.quality.log
   Fix EVERY issue it reports and re-run until it prints QUALITY: PASS. Don't suppress checks. If it redeployed the plugin, re-run your spec afterwards.
5. Do NOT commit, and do NOT edit docs/todo.json by hand.
6. Only when the spec passes AND quality.sh prints QUALITY: PASS, run: e2e-tests/playwright/docs/todo.sh coded <ID>
   Then reply with exactly: CODED <ID>
If you truly cannot complete it (e.g. a product bug blocks it), don't run `coded`. Reply: BLOCKED <ID> <one-line reason>, and put details in e2e-tests/playwright/docs/tasks/reviews/<ID>.coder-blocked.md.
```

**Attempt N > 1 prompt:**

```
Review attempt <N-1> of task `<ID>` is NOK. Read e2e-tests/playwright/docs/tasks/reviews/<ID>.attempt-<N-1>.md.
Fix every finding marked BLOCKER or MAJOR. Fix MINOR findings when they're cheap.
If you disagree with a finding, don't ignore it: add a "## Coder response" section to that review file explaining why.
Re-run the full Definition of done from the task doc, including
`e2e-tests/playwright/docs/quality.sh 2>&1 | tee e2e-tests/playwright/docs/tasks/reviews/<ID>.attempt-<N>.quality.log`, until it prints QUALITY: PASS.
The hard rules still apply: no Go changes, webapp changes limited to a11y attributes. Then run: e2e-tests/playwright/docs/todo.sh coded <ID>
and reply with exactly: CODED <ID>
```

Send the prompt and wait. Coding can take a long time, so use a generous timeout and re-wait if needed:

```bash
herdr agent prompt coder "$PROMPT" --wait --timeout 3600000
```

After `--wait` returns, check the actual state; don't trust the wait alone:

```bash
e2e-tests/playwright/docs/todo.sh get "$ID" | jq -r .coded_at   # non-null → coding finished
herdr agent get coder | jq -r .result.agent.agent_status          # working → wait again
herdr agent read coder --source recent-unwrapped --lines 60        # look for CODED / BLOCKED
```

- `coded_at` is set → go to step 4.
- The agent is still `working` → run `herdr agent wait coder --timeout 3600000` again.
- The agent is `blocked` (a question or approval UI) → read it. Answer it yourself only if the task doc makes the answer obvious. Otherwise ask the human.
- The coder replied `BLOCKED` → count this attempt as NOK. Use the coder's reason as the review. If attempts remain, either re-prompt with guidance or block the task (step 6).
- The agent went `idle` without `coded_at` and without a `CODED`/`BLOCKED` reply → prompt once: "Continue the task; finish with `todo.sh coded <ID>` and reply CODED <ID>."

### Step 4: run a fresh review agent

```bash
REVIEWER_PANE=$(herdr pane split "$CODER_PANE" --direction right --cwd "$PWD" --no-focus | jq -r .result.pane.pane_id)
herdr agent start reviewer --kind pi --pane "$REVIEWER_PANE" --timeout 60000
mkdir -p e2e-tests/playwright/docs/tasks/reviews
```

**Review prompt:**

```
You are the REVIEW agent for migration task `<ID>`, attempt <N>. Do NOT modify any code or tests. You may only write your review file.
1. Read: AGENTS.md, e2e-tests/playwright/AGENTS.md, e2e-tests/playwright/docs/cypress_migration_plan.md (section 1), and the task doc <DOC>.
2. Inspect the work: `e2e-tests/playwright/docs/quality.sh --list` lists every changed file (anywhere in the repo). Read `git diff HEAD` for tracked files and read each untracked file in that list. This is everything done for this task (all earlier tasks are committed). Any file outside `e2e-tests/` and `webapp/` is a BLOCKER (the `allowed-paths` gate also fails on it).
3. Verify all of the following:
   a. Coverage: every behavior in the doc's "Cypress coverage" (within each source's Scope) is asserted somewhere, unless the doc moves it elsewhere. List anything missing.
   b. Consolidation: duplicates were merged and tables were used as the doc asks. It's not a copy-paste of the Cypress specs.
   c. e2e-tests/playwright/AGENTS.md rules: POM is mandatory. ESLint already rejects `getBy*`, `locator`, and `waitForTimeout` calls in spec files. The local plugin `eslint-rules/` (`playbooks-e2e/*` rules) rejects these in spec files: locator builders, locator refinements (`.filter({...})`/`.first()`/`.nth()`/`.and()`/`.or()`), legacy `page.click('#sel')`-style APIs, destructured or aliased builders, fixed waits, and unconditional skips. Still check for workarounds that dodge the rules, which are BLOCKERs: any eslint-disable, raw DOM queries via `page.evaluate`, locators built in helpers instead of page objects, or changes to `eslint.config.mjs`/`eslint-rules/` that weaken the rules. Check a11y-first locators, helpers for seeding, @objective + tag + #/* comments, collision-free names, and no fixed waits (`waitForTimeout`).
   d. Definition of done: run the spec yourself twice (`npx playwright test <spec> --reporter=list`). Re-run `e2e-tests/playwright/docs/quality.sh` yourself; don't trust the coder's log. Any failure is a BLOCKER, unless it is listed under `## Pre-existing failures` in the coder's quality log (`<ID>.attempt-<N>.quality.log`) with convincing proof that it also fails on a clean HEAD. Any suppressed check (new eslint-disable, nolint, skipped test, loosened config) is a BLOCKER.
   e. Migration hard rules: ANY Go file change is a BLOCKER. Read the full webapp diff (`git diff -- webapp`). Every hunk must be only an a11y attribute (aria-label/-labelledby/-describedby, role, alt, htmlFor/id) or the i18n string an aria-label needs. Anything else is a BLOCKER: logic, styling, markup restructuring, data-testid, new files, or a product bug fix. A product bug must appear as `test.fixme` with a reason, not as a product fix.
4. Write e2e-tests/playwright/docs/tasks/reviews/<ID>.attempt-<N>.md:
   - The first line is exactly `VERDICT: OK` or `VERDICT: NOK`.
   - Then a findings list. Each finding has: severity (BLOCKER | MAJOR | MINOR), file:line, the problem, and the expected fix.
   - Verdict is NOK if there is at least one BLOCKER or MAJOR finding. MINOR findings alone are still OK.
   - Include the exact test commands you ran and their results.
5. Run: e2e-tests/playwright/docs/todo.sh reviewed <ID> OK   (or NOK)
6. Reply with exactly: REVIEW <OK|NOK> e2e-tests/playwright/docs/tasks/reviews/<ID>.attempt-<N>.md
```

For the `go-coverage-gaps` task (report only), replace 3a–3d: check that every
listed Cypress test has a row and that each COVERED claim points to a real Go
test that asserts the same thing. Spot-check at least 5. Every PARTIAL/GAP must be
either assigned to a Playwright task or listed as a follow-up. No code changed
at all. For `retire-cypress`, check that only fully covered specs were deleted
(cross-check against `todo.json` and the go-coverage-gaps follow-ups).

Wait the same way as for the coder:

```bash
herdr agent prompt reviewer "$PROMPT" --wait --timeout 1800000
```

Then check that both signals agree: `review_status` in `todo.json` and the
`VERDICT:` line on the first line of the review file. If they disagree, or either is
missing, re-prompt the reviewer once to fix it.

Then stop the reviewer so the next review starts fresh:

```bash
herdr pane close "$REVIEWER_PANE"
```

### Step 5: on OK, mark done and commit

```bash
e2e-tests/playwright/docs/todo.sh done "$ID"
files=$(e2e-tests/playwright/docs/quality.sh --list)
echo "$files" | grep -vE '^(e2e-tests|webapp)/' && { echo "changes outside e2e-tests/webapp - hard rules violated"; exit 1; }
echo "$files" | xargs git add --   # never `git add -A`: it would pick up untracked .agents/ tooling and scratch files
git diff --cached --name-only | grep -E '\.go$|^go\.(mod|sum)$' && { echo "Go change staged - hard rule 1 violated"; exit 1; }
git commit -m "e2e(playwright): $(e2e-tests/playwright/docs/todo.sh get "$ID" | jq -r .name)"
herdr tab close "$TAB"
```

The commit includes the code, the review files, and the updated `todo.json`.
Committing after each task keeps the next reviewer's `git diff` limited to
that task. Don't push; a human decides when.

On NOK with attempts left (`N < 5`), go back to step 3 with the "Attempt N > 1"
prompt. Reuse the same coder; start a new reviewer.

### Step 6: after 5 NOK attempts, block the task

Don't mark it done. Write a note that a human can act on:

```bash
e2e-tests/playwright/docs/todo.sh block "$ID" "5/5 reviews NOK. Remaining: <the BLOCKER/MAJOR findings from the last review, 1-3 lines>. Root cause: <e.g. product bug X / flaky server-side timing / missing a11y name / doc scope unclear>. Work stashed as 'blocked <ID>'. Reviews: docs/tasks/reviews/<ID>.attempt-*.md"
e2e-tests/playwright/docs/quality.sh --list \
  | grep -vE '^e2e-tests/playwright/docs/(todo\.json|tasks/reviews/)' \
  | xargs git stash push -u -m "blocked $ID" --
git add e2e-tests/playwright/docs/todo.json e2e-tests/playwright/docs/tasks/reviews
git commit -m "e2e(playwright): block $ID after 5 review loops"
herdr tab close "$TAB"
```

The stash keeps the partial work without polluting the next task's diff. Then go
back to step 1. `next` skips blocked tasks. If a later task depends on a blocked
one (for example, everything depends on `foundations`), stop the run and report
to the human instead of continuing.

## Resuming after an interruption

The state lives in `todo.json` and git, so you can always resume:
- `todo.sh status` shows where things stand.
- If `next` returns a task with `attempts > 0`, it was interrupted mid-loop.
  - If the tree has changes and `coded_at` is set but `review_status` is null → resume at step 4 for attempt `attempts`.
  - If the tree has changes and `coded_at` is null → resume at step 3. Tell the coder the work is partially done, and don't call `start-attempt` again.
  - If the tree is clean → just restart the loop. `start-attempt` keeps counting from the stored value.
- `herdr agent list` shows whether `coder` or `reviewer` from a previous run are still alive. Reuse a live coder; close a stale reviewer.

## Rules for the orchestrator

- Run one task at a time. Tasks share page objects and helpers, so parallel tasks would conflict.
- Never edit `todo.json` by hand. Always use `todo.sh`.
- Never mark a task done without a review OK. `todo.sh done` refuses anyway.
- Only close Herdr tabs and panes this loop created. Never run `herdr server stop`.
- If the server goes down (smoke spec fails for every task), stop and tell the human. Don't burn attempts on infrastructure failures, and don't count them as attempts.
- Keep the loop moving without asking the human, except for: blocked agent questions you can't answer, a blocked prerequisite task, or infrastructure problems.
