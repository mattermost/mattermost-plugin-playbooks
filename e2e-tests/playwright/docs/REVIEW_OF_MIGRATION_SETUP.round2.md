# Round 2 review — changes since round 1

Reviewer: independent, read-only. Only this file was written. All `todo.sh`
exercises ran against a `/tmp` copy of `todo.json`+`todo.sh`; `gen_tasks.py`
was exercised against a `/tmp` copy of the whole `docs/` tree; `eslint` was
run read-only inside `e2e-tests/playwright` (including via `--stdin` against
scratch files in `/tmp`, never written into the repo); `quality.sh` was only
checked with `bash -n` and by static reading plus comparison against
`.github/workflows/ci.yaml` and the `Makefile` — it was never executed.

## Overall verdict

The round-1 BLOCKER is fixed cleanly: `channels/playbook_run_actions.js` is
in the inventory, has its own task (`run-start-actions`, doc 06), the
coverage-gap self-check in `gen_tasks.py` now reports zero unmapped specs,
and the team even traced *why* it and `tours_spec_ignore_.js` were both
missed in round 1 (neither file's name matches Cypress's
`tests/integration/**/*_spec.{js,ts}` pattern, so neither ever ran) — a
genuinely good catch that round 1 didn't make. The new hard rules are
propagated consistently everywhere they need to be (every real task doc, the
plan, the runbook), `gen_tasks.py`'s merge logic is correct (verified: it
preserves in-progress task state across regeneration, enforces generator
order, refuses to silently drop a task, and only deletes genuinely stale
numbered docs — all confirmed against a scratch copy), and the git-command
scoping to `e2e-tests`/`webapp` is applied consistently through the runbook.

However, `quality.sh` — the one artifact whose entire job is to mechanically
enforce "no Go file may change" — has a **BLOCKER-level blind spot**: its
change-detection regex doesn't cover `internal/` or `loadtest/`, two
directories that hold real, compiled, first-party Go source under the same
root `go.mod` (confirmed: `internal/playbooksmcp/tools/*.go`,
`loadtest/*.go`, no nested `go.mod`). A change there is invisible to the
`no-go-changes` gate, invisible to the conditional `gofmt`/`lint-server`/
`go-tests` gates (which also key off the same pre-filtered `$changed`), and
invisible to every git command in the runbook (`status`/`diff`/`add`/
`stash` are all scoped to `e2e-tests webapp [server]`, never `internal` or
`loadtest`). This isn't a hypothetical: it's the exact kind of path the
"no Go changes" rule exists to catch, sitting completely outside the one
script built to catch it. This must be fixed before the loop starts.

A second, real (not hypothetical) gap: the new ESLint rule is good as far as
it goes, but two concrete ways around it exist and were reproduced with real
`npx eslint` runs: chaining `.filter()/.first()/.nth()` off a page object's
already-exposed `Locator` field builds a *new* locator in the spec without
tripping the rule, and legacy selector-string action APIs
(`page.click('#foo')`, `page.fill('#foo', ...)`) aren't in the forbidden-call
list at all — and even the pre-existing `eslint-plugin-playwright` rule that
would otherwise flag them (`prefer-locator`, severity `warn`) is invisible
because `npm run check`/`quality.sh`'s `lint-web` gate both run `eslint
--quiet`, which drops every warning, including `no-skipped-test` (so
`test.skip`, which hard rule 3 explicitly forbids in favor of `test.fixme`,
also produces a clean `quality.sh` run). None of these are fatal to the
loop — the reviewer prompt still asks a human-like agent to read the diff —
but they quietly re-introduce exactly the manual-judgment burden the new
automation was supposed to remove, in the two highest-value spots: raw-CSS
escape hatches and the Cypress `.skip` pattern colliding with the new
`test.fixme` rule. Fix the regex blind spot before starting; the lint gaps
are lower severity but cheap to close and worth doing in the same pass.

---

## Findings by artifact

### 1. Hard rules (runbook, plan, task docs, AGENTS.md)

- **Verified propagated correctly**: `MIGRATION_RUNBOOK.md` has a "Hard
  rules for the migration" section (4 rules); `cypress_migration_plan.md`
  has a matching 3-rule summary pointing back to the runbook; every real
  task doc (all except `01-ported-create-playbook.md` and
  `02-ported-navigation.md`, which have nothing left to do) has a "Migration
  hard rules" section with consistent wording across the ones spot-checked
  (`06-run-start-actions.md`, `49-go-coverage-gaps.md`). No contradictions
  found in wording (the allowed a11y attribute list — `aria-label`,
  `aria-labelledby`, `aria-describedby`, `role`, `alt`, `htmlFor`/`id` — is
  identical everywhere it's repeated).
- **MINOR** — `e2e-tests/playwright/AGENTS.md` itself does **not** mention
  the new migration hard rules anywhere (grepped for "Hard rule", "No Go
  file", "test.fixme" — only the pre-existing POM "hard rule" from round 1
  is present). The task says these rules "live in ... AGENTS.md", but in
  practice they live in the runbook + plan + every task doc, and the coder
  prompt explicitly says "Respect the migration hard rules **in your task
  doc**" rather than pointing at AGENTS.md. Since AGENTS.md is the one file
  every coder/reviewer reads first on every one of the 50 tasks, consider
  adding a short pointer there too ("see MIGRATION_RUNBOOK.md 'Hard rules'
  for the no-Go/a11y-only/test.fixme rules that apply during this
  migration") so it isn't the one place where an agent could plausibly miss
  them. Not fixing this won't break anything functionally, since the task
  docs already carry the rules.
- **Verified**: `go-coverage-gaps` (task 49) is correctly converted to
  report-only — "Audit only. Hard rule: no Go file may change, and no code
  changes at all", output is a single `.md` report, and its Definition of
  Done correctly asks for `quality.sh` to pass (trivially, since a new `.md`
  file under `e2e-tests/playwright/docs/tasks/` doesn't touch any lint
  target). The runbook's review-prompt carve-out for this task ("replace
  3a–3d... No code changed at all") is consistent with the task doc.

### 2. `quality.sh`

- **BLOCKER** — `e2e-tests/playwright/docs/quality.sh`, the `changed`
  computation (near the top):
  ```bash
  changed="$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } \
      | grep -E '^(webapp|server|client|build|e2e-tests|assets)/|^plugin\.json$|^go\.(mod|sum)$' \
      | grep -v '/node_modules/' | sort -u)"
  ```
  This prefix allowlist omits `internal/` and `loadtest/`. Both are real,
  first-party Go packages under the repo's single root `go.mod` (confirmed:
  `find . -maxdepth 2 -name go.mod` shows only `./go.mod`, `./build/go.mod`,
  `./client/go.mod` — `internal/` and `loadtest/` have no nested module, so
  `go vet ./...`/`golangci-lint run ./...` in real CI cover them). Every
  consumer of `$changed` inherits the blind spot:
  - The explicit hard-rule-1 gate, `go_changed="$(grep -E '\.go$|^go\.(mod|sum)$' <<<"$changed" ...)"`,
    can never see a change under `internal/` or `loadtest/`, so
    `no-go-changes` passes even if a coding agent edits
    `internal/playbooksmcp/tools/playbooks.go`.
  - `has '\.go$|^go\.(mod|sum)$'` also returns false in that case, so the
    *entire* conditional Go block (`gofmt`, `lint-server`, `go-mod-tidy`,
    `go-tests`) is skipped too — not just the hard-rule check, but every
    mechanism that could have caught a broken/unformatted Go file as a
    side effect.
  - The runbook compounds this: every git command used by the orchestrator
    and the review agent (`git status --porcelain -- e2e-tests webapp
    server`, `git diff -- e2e-tests webapp server`, `git add -- e2e-tests
    webapp`, the `git stash push -u ... -- e2e-tests webapp ...`) is also
    scoped to the same three prefixes and never mentions `internal` or
    `loadtest`. So a stray change there is invisible to quality.sh, invisible
    to the reviewer's explicit diff command, never staged/committed by step
    5, and — because `git status --porcelain -- e2e-tests webapp server`
    (the precondition check for picking up the *next* task) is scoped the
    same way — it would sit in the working tree indefinitely without ever
    being flagged dirty.
  - Reproduced the root cause directly: `find . -name "*.go" | sed -E
    's#^\./([^/]+)/.*#\1#' | sort -u` lists `internal`, `loadtest`,
    `server`, `client`, `build`, `e2e-tests` (vendored, in `node_modules`,
    irrelevant), `.github` (a standalone `.github/actions/generate-specs/*.go`
    tool, same blind spot but much lower practical risk) as the directories
    containing `.go` files in this repo.
  *Fix*: add `internal` and `loadtest` to the path prefix allowlist in
  `quality.sh`'s `changed` computation, and add the same two paths to every
  git command in `MIGRATION_RUNBOOK.md` that is currently scoped to
  `e2e-tests webapp server` (or, simpler, scope those commands to "everything
  except known-irrelevant top-level dirs" instead of an allowlist that has
  to be kept in sync with the repo's top-level layout).
- **MAJOR** — `webapp-a11y-only` gate, the "forbidden new webapp files"
  check:
  ```bash
  new_files=$(git ls-files --others --exclude-standard -- webapp | grep -v "/node_modules/" || true)
  ```
  `git ls-files --others` only lists **untracked** files. A new webapp file
  that has been `git add`ed (even though nothing in the runbook tells the
  coder to stage anything, nothing forbids it either, and staging mid-task
  is a very ordinary agent habit) stops being "untracked" and silently
  disappears from this check. Reproduced directly: created
  `webapp/src/new_component.tsx`, confirmed it appears via `git ls-files
  --others --exclude-standard -- webapp`, ran `git add` on it, re-ran the
  same command — empty output. The `deleted=` check right below it doesn't
  have this problem (it uses `git diff --name-only --diff-filter=D HEAD`,
  which looks at the working tree + index vs. `HEAD` regardless of staging
  state), and neither does the `data-testid` check (`git diff -U0 HEAD --
  webapp/src`, same reasoning) — only the "new file" check uses the
  staging-sensitive `ls-files --others` form.
  *Fix*: replace it with `git diff --name-only --diff-filter=A HEAD --
  webapp | grep -v '/node_modules/'`, which (like the other two checks)
  compares against `HEAD` and therefore sees staged and unstaged new files
  alike.
- **MAJOR** — `npm run check` (`eslint . --quiet --cache`), which both
  `quality.sh`'s `lint-web` gate and the coder/reviewer's own "Definition of
  done" step run, passes `--quiet`, which drops every ESLint **warning**,
  not just notices. Two consequences that matter *specifically* for the new
  hard rules, reproduced with real `npx eslint` runs against scratch specs:
  - `eslint-plugin-playwright`'s `no-skipped-test` rule (enabled by
    `flat/recommended`) flags `test.skip(...)` — but only as a `warn`, so it
    is invisible under `--quiet`. Hard rule 3 requires `test.fixme`
    specifically ("the test stays, marked `test.fixme(...)`"); a coder (or a
    straight port of a Cypress `it.skip`) using `test.skip` instead produces
    a perfectly clean `quality.sh` run with zero errors, silently violating
    the rule the quiet mode exists to help enforce.
  - `prefer-locator` (also `warn`-only in `flat/recommended`) is the one
    built-in rule that would otherwise flag `page.click('#foo')`/
    `page.fill('#foo', ...)` (legacy selector-string action APIs) — these
    aren't in the new `no-restricted-syntax` list either (it only covers
    `getBy*`/`locator`/`frameLocator`/`$`/`$$`/`$eval`/`$$eval`/
    `waitForSelector`), so this is a second, compounding way for raw CSS
    selectors to slip into a spec file with a fully green `npm run check`.
  *Fix*: either drop `--quiet` from the `check` script that `quality.sh` and
  the Definition of Done rely on (accepting the extra noise from genuinely
  cosmetic warnings), or add explicit `no-restricted-syntax` entries for the
  legacy `page.click`/`page.fill`/`page.check`/`page.hover`/`page.selectOption`
  family and a dedicated `no-restricted-syntax` (or just un-suppress
  `no-skipped-test`) for `test.skip`, so these two specific, rule-relevant
  cases aren't silently downgraded to invisible.
- **MINOR** — `quality.sh`'s self-description ("mirrors
  `.github/workflows/ci.yaml` that apply to the current uncommitted
  change") is a reasonable approximation, not an exact mirror, in two ways
  worth knowing about (neither is a bug, just a documented gap in the
  "mirrors CI" claim):
  - CI's `lint-web` job *always* runs `make apply` (manifest diff),
    `make i18n-extract-webapp` (i18n diff) and `make graphql` (generated
    code diff) regardless of what changed; `quality.sh` only runs the
    equivalents when `has '^webapp/'` or `has '^plugin\.json$'`. Harmless
    while no webapp/plugin.json changes have landed yet (the diffs would be
    empty), but if upstream `main` ever drifts (e.g. a tool version bump
    regenerates a manifest field) `quality.sh` wouldn't notice until a task
    actually touches `webapp/` or `plugin.json`.
  - CI's `test` job runs the **full** `make test` (webapp jest + Go tests)
    unconditionally; `quality.sh`'s `webapp-unit-tests` gate only runs
    `npx jest --findRelatedTests` on the changed webapp files. Given hard
    rule 2 limits webapp changes to a11y attributes, this is a safe,
    deliberate narrowing (and Jest's `--findRelatedTests` does walk the
    import graph, so it should still catch most snapshot-test fallout from
    an aria-label change) — just not literally "the same gate as CI".
- **Verified clean**: `bash -n e2e-tests/playwright/docs/quality.sh`
  succeeds. No quoting bugs found in any of the `gate '...'` bodies (none of
  the single-quoted gate bodies contain an embedded single quote that would
  prematurely close the string); the two gates built with double-quoted
  strings (`webapp-unit-tests`, `go-tests`) correctly interpolate
  space-joined file/package lists built just above them. Exit-code handling
  at the end (`failures` array, `QUALITY: PASS`/`exit 0` vs. `QUALITY: FAIL
  (...)`/`exit 1`) is correct, and the deliberate absence of `set -e` is
  correct (the script needs to keep running every gate and aggregate
  failures, not abort on the first one — `set -uo pipefail` without `-e` is
  the right choice here).
- **No issue found**: the `*manifest.*` pathspec
  (`git --no-pager diff --exit-code -- "*manifest.*"`) is quoted so git's
  own glob pathspec engine (which matches recursively) handles it, which is
  actually more robust than CI's unquoted equivalent — today the two are
  behaviorally identical only because no file at the repo root happens to
  match `*manifest.*` (verified: `echo *manifest.*` at repo root doesn't
  expand), so bash leaves CI's unquoted glob untouched and it reaches git
  literally too. Not a bug, just noting it was checked.

### 3. The `run-start-actions` fix (round-1 BLOCKER)

- **Verified fixed, and well done**: `channels/playbook_run_actions.js` is
  now in `cypress_inventory.md` with an explicit, correctly-reasoned "Never
  executed" note; it has its own task (`06-run-start-actions.md`); the
  plan's target-spec table and totals now include it ("92 Cypress specs plus
  the dormant `channels/playbook_run_actions.js`"); and the generator's own
  coverage self-check (`missing = sorted(set(sections) - used)`) reports
  `unmapped inventory specs: []` when run against a scratch copy of the
  current docs tree.
  Independently re-verified the "never ran" claim: `grep specPattern
  e2e-tests/cypress/cypress.config.ts` → `tests/integration/**/*_spec.{js,ts}`,
  and the file is literally named `playbook_run_actions.js` (no `_spec`
  suffix) — confirmed it cannot match that glob.
  Also confirmed the same root cause was correctly applied to
  `tours_spec_ignore_.js` (dropped "by decision" in the plan, with the
  explanation "the name doesn't match `specPattern`, so it never ran") —
  this closes the round-1 MINOR finding about that file being silently
  dropped without a stated reason, and the `retire-cypress` task (50) now
  explicitly lists it for deletion with the "never ran, not ported" reason.
- **No issue found** with the task's scope line excluding "when a playbook
  run is finished > retrospective is disabled" (routed to the
  `retrospective` task instead) — checked that the `retrospective` task
  (27) doesn't also claim it from a different source in a way that would
  double-count or drop it; it doesn't come up there as a separate listed
  source, which is a minor loose end (the retrospective task doc should
  arguably say explicitly "+ `channels/playbook_run_actions.js`'s
  'retrospective is disabled' case" in its own sources table so the
  reviewer of task 27 doesn't have to go hunting). Not blocking — the
  `run-start-actions` doc is unambiguous about where it goes — but worth a
  one-line cross-reference for symmetry with how the `rdp_main_header_spec`
  split annotates every task with "NOT X (goes to task Y)".

### 4. Task ordering / no `depends_on`

- **Verified sane**: `todo.json`'s task order is `ported-create-playbook,
  ported-navigation, foundations, start-run-modal, start-run-entry-points,
  run-start-actions, finish-restore, checklist, rdp-header, rdp-viewer,
  participants, rdp-sidebar, ...` through `retire-cypress` — exactly
  sequential with the task doc numbering (01–50), and consistent with every
  page-object dependency I could find: `foundations` (03) is the only task
  before anything that uses `RunDetailsPage`/`ChannelRhs`/`RunModal`/
  `StatusUpdateDialog`, and no later task's "Target"/"What to do" section
  references a page object or helper that isn't either built by
  `foundations` or by an earlier task in the list.
  `run-start-actions` sits at position 6 (between `start-run-entry-points`
  and `finish-restore`); it only needs API helpers from `foundations`
  (`createRun`, `patchPlaybook`, etc.), not the `RunModal`/entry-point UI
  work from tasks 4–5, so its exact position relative to those two doesn't
  matter for correctness — it's a reasonable grouping choice (run-creation
  side effects placed next to run-creation UI), not a dependency violation.
- **MINOR** — `cypress_migration_plan.md` §5 "Suggested migration order"
  still lists step 2 as "`start_run_modal`, `start_run_entry_points`,
  `finish_restore`, `checklist`: core run lifecycle" — it was not updated to
  mention `run_start_actions` at all. Since the operative source of truth is
  `todo.json`'s order (per this round's decision), this doesn't affect the
  loop, but it's a drifted cross-reference a human skimming the plan could
  misread as "the new task isn't part of the core-lifecycle batch."
  *Fix*: one-line edit to insert `run_start_actions` into that list.
- **Confirmed via live test** (scratch copy of `todo.json`/`todo.sh`, no
  writes to the real files): `next`/`get`/`status` all still behave exactly
  as in round 1 against the new 50-task list; nothing about the reordering
  or the new task broke the schema or the state machine.

### 5. New ESLint rule (`eslint.config.mjs`)

- **Verified no false positives**: `npm run check` is clean against the
  current tree (0 errors); the rule's regex only matches *member* call
  expressions (`callee.type === "MemberExpression"`), so it doesn't trip on
  any of the many plain-function helper calls in `tests/helpers/*.ts`
  (`getCurrentUser(page)`, `getTeamByName(...)`, etc. — these are named,
  non-member calls and are also outside the rule's `files: ['tests/**/*.spec.ts']`
  scope anyway, since they live in `tests/helpers/`, not a spec file).
- **Partially redundant with `eslint-plugin-playwright`'s own
  `flat/recommended` rules** (not a bug, just worth knowing): the
  recommended config already includes `playwright/no-wait-for-timeout`,
  `playwright/no-wait-for-selector`, and `playwright/no-element-handle`
  (which covers `$`/`$$`/`$eval`/`$$eval`-style ElementHandle APIs), so the
  new rule's `waitForTimeout`, `waitForSelector`, `$`, `$$`, `$eval`,
  `$$eval` entries mostly duplicate existing coverage — except that those
  existing rules are `warn`-severity and therefore **suppressed by
  `--quiet`** (see the quality.sh finding above), so the new rule's
  `error`-severity duplication for `waitForTimeout` is in fact the only
  thing making that specific check actually fire under `npm run check`.
  The `$`/`$$`/`$eval`/`$$eval`/`waitForSelector` duplicates don't get the
  same benefit because they weren't given their own `no-restricted-syntax`
  entries with a custom message — wait, they were (confirmed by testing):
  `waitForSelector` does trigger the new rule's locator-building message (it's
  included in the `getBy*|locator|frameLocator|...|waitForSelector` branch).
  Only `$`/`$$`/`$eval`/`$$eval` also land under that same branch and fire
  correctly too (reproduced: all five of `page.$`, `page.$$`, `page.$eval`,
  `page.$$eval`, and chained `frameLocator(...).locator(...)` fired the
  "must not build locators" error in a scratch test). No action needed here
  — noting it only so the redundancy is understood, not flagged as a defect.
- **MAJOR (false negative, reproduced)** — chaining a *refinement* method
  off a page object's already-exposed `Locator` field is not caught, even
  though it builds a new locator in the spec, which is exactly what the
  hard POM rule (and the reviewer prompt's "Add a field or method to a page
  object" framing) is meant to prevent:
  ```ts
  await playbooksPage.someExposedField.filter({hasText: 'Foo'}).click();
  await playbooksPage.someExposedField.first().click();
  await playbooksPage.someExposedField.nth(2).click();
  ```
  None of `filter`, `first`, `last`, `nth`, `and`, `or` are in the
  forbidden-call regex. Reproduced directly with `npx eslint --stdin`: all
  three lines above pass with zero errors. AGENTS.md is explicit that
  "composite/filtered locators belong in a small documented method" — this
  is precisely the pattern that slips through. Given the reviewer prompt
  (step 3c in the runbook) already explicitly calls out one specific
  workaround to watch for ("raw DOM queries via `page.evaluate`"), it should
  call out this one too, since it's arguably more likely for a coding agent
  to reach for naturally (it feels like "using the page object," since the
  receiver is a page-object field, even though the `.filter(...)` call is
  still building a new locator in the spec).
  *Fix*: extend the regex to also catch `filter|first|last|nth|and|or` (or,
  more precisely, flag any of these called on something that isn't already
  a local variable assigned from a page-object method — the simpler regex
  extension will have some false positives on legitimate array/stream
  `.filter()`/`.first()` elsewhere in a spec, but specs essentially never do
  generic array processing, so the trade-off is favorable), and add one
  sentence to the runbook's review prompt (3c) naming this pattern
  explicitly.
- **MINOR (false negative, low likelihood)** — destructuring a locator
  method off `page` before calling it (`const {getByRole} = page; await
  getByRole('button').click();`) or binding it to a local
  (`page.getByRole.bind(page)`) produces a non-`MemberExpression` call site
  and is not caught. Reproduced directly (clean `eslint` run). This requires
  deliberate, somewhat unusual code from the coding agent, so it's low risk
  in practice, but worth a one-line mention in AGENTS.md's POM section
  ("don't destructure or alias page/locator methods to dodge the lint
  rule") since the reviewer's manual-check bullet doesn't mention it either.

### 6. `gen_tasks.py` merge logic

- **Verified correct** via a scratch copy of the whole `docs/` tree
  (`cp -r`, running the real script, never touching the committed files):
  - Running it twice in a row is a no-op (`md5sum todo.json` and the
    `tasks/*.md` file listing are byte-identical before/after a second run).
  - Simulated an in-progress task (`checklist`: `attempts: 3`, `coded_at`
    set, `review_status: "NOK"`, a `notes` string) and re-ran the
    generator: every one of those fields survived unchanged; only `name`
    and `doc` were refreshed to the generator's current values, exactly as
    advertised ("keeps state, follows generator order/name/doc").
  - Simulated a stale/renamed task id (appended a fake `some-old-removed-task`
    entry to `todo.json`) and re-ran: the generator correctly refuses with
    `todo.json has tasks the generator no longer defines: ['some-old-removed-task'];
    remove them manually` and a non-zero exit code, rather than silently
    dropping it.
  - Diffed the scratch run's output against the real, committed
    `docs/tasks/*.md` and `todo.json`: identical file lists and identical
    content for every file spot-checked (`06-run-start-actions.md`,
    `49-go-coverage-gaps.md`) — confirms the committed docs really are the
    generator's output, not hand-edited copies that could drift from it.
  - The stale-doc deletion (`for f in os.listdir(TASKS_DIR): if
    re.match(r'^\d{2}-.*\.md$', f) and f not in produced: os.remove(...)`)
    runs after all current-run files have already been written, deletes
    only files matching the `NN-*.md` numbering pattern, and — confirmed by
    reading the regex — can never match anything inside `tasks/reviews/`
    (a different directory, not reached by this single-level
    `os.listdir`) or a `*.result.md` file (no leading `NN-` digits), which
    matches the stated guarantee.
  - No-`todo.json`-yet path (first run) also verified: produces the same
    50-task list with the "already ported" tasks correctly pre-marked
    `done: true`.
- **No bugs found.** This is a solid, idempotent, state-preserving
  generator with a real safety net (the "unmapped inventory specs" check)
  against round 1's class of bug recurring.

### 7. Runbook git scoping

- **Verified consistent**: every git command in `MIGRATION_RUNBOOK.md`
  (`status --porcelain`, `diff`, `add`, `stash push`) is scoped to
  `e2e-tests webapp` (with `server` added for the read-only `status`/`diff`
  commands, so the reviewer can *see* a stray server change even though the
  loop will never `add`/commit one). No leftover `git add -A` or unscoped
  `git stash` found anywhere. The explicit comment on the `git add` line
  ("never `git add -A` — it would pick up untracked `.agents/` tooling")
  correctly explains why the scoping exists.
- **BLOCKER, same root cause as the quality.sh finding above**: none of
  these pathspecs include `internal` or `loadtest`. This means the
  reviewer's own explicit instruction — "Inspect the work: `git status
  --porcelain -- e2e-tests webapp server`, `git diff -- e2e-tests webapp
  server`" — cannot reveal a change under either directory even if the
  reviewer does everything right. Fix this alongside the `quality.sh` fix
  (likely the same one-line edit repeated in both places, or a shared
  "migration paths" variable referenced from both if that's easy to set up).
- **No issue found** with the staged-new-file edge case for webapp changes
  specifically in the *runbook's own* commit step (`git add -- e2e-tests
  webapp`): unlike `quality.sh`'s a11y gate, the commit step doesn't try to
  distinguish "new" from "modified" files, so this particular blind spot
  doesn't affect what actually gets committed — only `quality.sh`'s
  independent "forbidden new webapp files" detector (finding under §2).

---

## Cross-artifact contradictions checked for and not found

- Hard-rule wording (the allowed a11y attribute list, "no Go changes",
  "test.fixme not test.skip") is identical across the runbook, the plan,
  and every task doc sampled.
- `quality.sh`'s own in-file comment describing the hard-rule gates ("1. No
  Go file may change... 2. Webapp: only accessibility attributes...")
  matches the runbook's numbered list 1–2 (3–4 are intentionally not
  mechanically checked by the script, and nothing claims otherwise).
- The review prompt's carve-out for `go-coverage-gaps` and `retire-cypress`
  (replace 3a–3d / cross-check against `todo.json` and the go-coverage-gaps
  follow-ups) matches what those two task docs actually ask for.
- `todo.json`'s 50 ids match `gen_tasks.py`'s 50 generated ids exactly (no
  drift between the generator and the committed state file).
- The inventory's new "Never executed" note on `playbook_run_actions.js`
  and the plan's "dormant" framing and the task doc's "first confirm each
  behavior against the running app" instruction all agree with each other
  and with the underlying `specPattern` fact.

---

## Verdict: can the loop start?

**Not yet — fix the `quality.sh`/runbook path-scoping blind spot first.**
Everything else is in good enough shape to run concurrently with that fix
(none of the other findings are correctness-breaking for the *first* few
tasks, since `foundations` and the early run-lifecycle tasks don't touch
`internal/` or `loadtest/` at all), but shipping the "no Go file may change"
hard rule with a known, reproduced hole in its one enforcement mechanism
undermines the single most load-bearing rule in the whole hard-rules design.
The ESLint false negatives (`.filter()`/`.first()`/`.nth()` chaining, the
`--quiet`-suppressed `test.skip`/`prefer-locator` gaps) are real but lower
severity — they degrade "mostly automated" back to "mostly automated plus a
specific thing the reviewer should know to look for," which is still
workable if the reviewer prompt is updated to name them explicitly, even
before the regex itself is widened.

### Top fixes before starting

1. **(BLOCKER)** Add `internal` and `loadtest` to `quality.sh`'s `changed`
   path allowlist, and to every scoped git command in
   `MIGRATION_RUNBOOK.md` (`status`/`diff`/`add`/`stash`).
2. **(MAJOR)** Fix the staged-new-file blind spot in the `webapp-a11y-only`
   gate: swap `git ls-files --others --exclude-standard -- webapp` for
   `git diff --name-only --diff-filter=A HEAD -- webapp`.
3. **(MAJOR)** Decide on the `--quiet` trade-off: either drop it from
   `npm run check` (accepting extra warning noise), or explicitly promote/
   duplicate `no-skipped-test` and `prefer-locator`-equivalent coverage
   (legacy selector-string action APIs) into the custom `no-restricted-syntax`
   rule so hard rule 3 (`test.fixme` not `test.skip`) and the raw-CSS
   loophole are both mechanically enforced, not just warned-and-hidden.
4. **(MAJOR)** Extend the new ESLint rule to catch `.filter()/.first()/
   .last()/.nth()/.and()/.or()` chained off a spec-level locator reference,
   and add one sentence to the runbook's reviewer prompt (step 3c) naming
   this as a specific thing to check by eye until the rule covers it.
5. **(MINOR)** Update `cypress_migration_plan.md` §5's "Suggested migration
   order" step 2 to mention `run_start_actions`, and add a one-line
   cross-reference in task 27 (`retrospective`)'s sources table noting it
   also owns the "retrospective is disabled" case from
   `channels/playbook_run_actions.js`, for symmetry with how other
   multi-task Cypress-file splits are annotated.
