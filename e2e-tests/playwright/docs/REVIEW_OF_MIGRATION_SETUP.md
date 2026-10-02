# Review of the Cypress → Playwright migration setup

Reviewer: independent, read-only. No files other than this one were modified.

## Overall verdict

The scaffolding is unusually thorough and mostly trustworthy: the AGENTS.md
conventions match the two real spec files already in the repo, the inventory's
specific, checkable claims (app_bar's nested `it`, the permissions-spec
"to run followers" inversion, the checklist-rename concatenation bug, the
multiselect spec being misfiled under `runs/`) all check out against the
actual Cypress sources, the task-doc scopes for files split across multiple
targets (e.g. `rdp_main_header_spec.js` across tasks 06/08/09/10/25) partition
cleanly with no gaps or overlaps that I could find, and the "Go already
covers X" claims in §4 of the plan are accurate greps. `todo.sh` behaves
correctly for every read/write command I exercised in a scratch copy
(`next`, `get`, `start-attempt`, `coded`, `reviewed`, `status`), and the
`herdr` commands in the runbook match the installed CLI's `--help` output and
JSON response shapes exactly (`.result.workspace`, `.result.tab`,
`.result.root_pane`, `.result.agent.agent_status`), including the
path-exclusion `git stash push` trick, which I verified works as written in
a scratch git repo.

The one finding that should stop the loop before it starts is a **missed
Cypress spec**: `channels/playbook_run_actions.js` (644 lines, ~19 `it`
blocks covering invite-members/owner/broadcast/webhook *run-start* behavior
and "retrospective is disabled" on finish) is not in `cypress_inventory.md`,
not in `cypress_migration_plan.md`, and not listed as a source in any of the
49 task docs. It will never be migrated and never flagged for deletion by
`retire-cypress`, because nothing in the system knows it exists. Fix the
inventory/plan before starting the loop (see "top 5" below).

Beyond that, the issues are process-hardening gaps rather than outright
errors: `todo.sh next` has no concept of task dependencies, so if a
foundational task gets `BLOCKED`, downstream tasks will still be offered by
`next` (the runbook relies on the orchestrator's judgment, not the tool, to
catch this); and the "hard rule" against raw locators in specs (AGENTS.md's
biggest POM mandate) has zero automated enforcement — it depends entirely on
a fresh reviewer agent reading every diff correctly, 48 times in a row.

---

## Findings by artifact

### `AGENTS.md` (Playwright conventions)

- **MINOR** — `e2e-tests/playwright/AGENTS.md`, "Hard rule: every spec must
  go through a Page Object." The rule is real and the two existing specs
  follow it, but nothing in `eslint.config.mjs` enforces it — the Playwright
  plugin's `flat/recommended` config doesn't have a rule for "no
  `page.getBy*`/`page.locator` outside `tests/pages/**`". Over ~40 specs and
  up to 5 review attempts each, this is the single most repeated review
  check in the runbook's review prompt (§3c). A custom `no-restricted-syntax`
  ESLint rule scoped to `tests/**/*.spec.ts` (forbidding `page.getBy`,
  `page.locator` call expressions) would turn ~40 manual judgment calls into
  one automated gate and reduce reviewer false negatives/positives.
  *Fix*: add the lint rule (or an `eslint-plugin-playwright`-style custom
  rule) before starting the loop; keep the human-readable rule in AGENTS.md
  as the documentation of *why*.
- **MINOR** — the "Checklist for a new spec" section and the body of the
  doc are consistent with each other and with `create_playbook.spec.ts` /
  `edit_header.spec.ts` / `navigation.spec.ts`. No contradictions found.
  One small gap: AGENTS.md doesn't say anything about **test data cleanup**
  (teams/users/playbooks created in `beforeAll` or per-test are never
  deleted). For ~300 tests across 40 specs this will leave a lot of server
  state behind over repeated CI runs; worth a one-line policy (either "we
  don't clean up, CI resets the DB between runs" — confirm this is actually
  true for `make upload-to-server` / the Postgres fixture — or add a
  `afterAll` convention).
- **MINOR** — the a11y-locator priority list doesn't mention how to handle
  third-party **react-select** components (used heavily in owner/channel
  selectors across the suite, per the Cypress inventory's `getStyledComponent`
  complaints). Several tasks (07-checklist, 10-participants, 44-lhs,
  46-task-inbox) explicitly call out "fix the component to add an
  aria-label" as in-scope — AGENTS.md should say this pattern (webapp change
  to add a role/aria-label when none exists) is expected and acceptable,
  since "Hard rule" language elsewhere could be read as "Playwright specs
  only, don't touch webapp."  (The task docs do say this, and the plan's
  rules section repeats it, so this is a cross-doc consistency nit, not a
  contradiction.)

### `cypress_inventory.md`

- **BLOCKER** — `channels/playbook_run_actions.js` (644 lines) is **entirely
  missing** from the inventory. `diff` against the real spec directory shows
  it's the only non-ignored spec absent (the other diff entry,
  `tours_spec_ignore_.js`, is discussed below as a MINOR). This file tests
  real, non-trivial, run-time behavior that's distinct from the editor-UI
  persistence tests already scoped to `editor_run_settings.spec.ts`:
  invite-members (enabled/disabled, with/without pre-existing users,
  non-existent users), default-owner resolution at run creation (creator
  default, enabled-but-unspecified, owner-in-invited-list, owner-not-invited,
  owner==creator), broadcast-channel-on-run-start (configured+enabled,
  configured+disabled, non-existent channel), creation webhook on run start,
  and "retrospective is disabled" when a run finishes. None of this is
  mentioned in the migration plan's target-spec table, the "move to Go"
  list, or any of the 49 task docs, so it has no destination and
  `retire-cypress` (task 49) will never touch it (its algorithm only acts on
  specs that appear as a *source* in `todo.json`-tracked tasks). This is the
  single biggest coverage hole in the whole setup — **fix before starting
  the loop**.
- **MINOR** — `tours_spec_ignore_.js` (product tour / onboarding walkthrough,
  4 real `it`s: creation tour, preview tour, follows/doesn't-follow tour
  choice from modal) is also absent from the inventory, with no stated
  reason. It's plausible the team intends to drop this silently (the
  `_ignore_` filename suggests it's already considered dead), but the
  project's own goal — "every Cypress behavior lands in some task...or gets
  dropped with a reason" — isn't met here since there's no "dropped with a
  reason" entry at all. *Fix*: add one line to §3/§4 of the plan: "dropped,
  `_ignore_` filename signals it was already disabled; product tours are
  [still shipped / being removed] — confirm with the team."
- **Verified accurate** (spot-checked specs, large and small):
  `runs/rdp_main_header_spec.js`, `playbooks/edit/actions_spec.js`,
  `runs/permissions_spec.js`, `channels/app_bar_spec.js`,
  `channels/rhs/checklist_spec.js`, `runs/rdp_main_checklist_multiselect_spec.js`,
  `digest_spec.js`, `channels/rhs/home_spec.js`, `api/runs_spec.js`,
  `playbooks/edit_metrics_spec.js`. All three headline bugs the plan claims
  are real:
  - `channels/app_bar_spec.js`: both `it(...)` blocks are nested inside outer
    `it(...)` calls — confirmed by reading the file; the inner assertions
    never run under Mocha/Cypress.
  - `runs/permissions_spec.js` line ~331: under `describe('should be
    visible', ...)`, `it('to run followers', ...)` calls
    `assertRunIsNotVisible(run, runFollower)` — the title says visible, the
    assertion says not visible. Confirmed verbatim.
  - `channels/rhs/checklist_spec.js` line ~322: `renames a checklist` asserts
    `cy.findByText(oldTitle + newTitle).should('exist')` (string
    concatenation, no separator/space) — confirmed; this is almost certainly
    a test bug (the product likely replaces the title, it doesn't append),
    and the task doc for `checklist.spec.ts` (07) correctly flags "verify
    real behavior first" before porting it as a regression assertion.
  - `runs/rdp_main_checklist_multiselect_spec.js`: confirmed its own
    `describe` title is `'playbook editor > outline > checklist bulk edit'`
    — it is indeed editor/outline functionality despite living under
    `runs/` and being named `rdp_*`.
- **Minor accuracy nit**: the plan's header line ("Input: ... all 92 Cypress
  specs") undercounts by 2 relative to the 94 files that actually exist in
  the tree (`find ... -name '*.js' | wc -l` → 94). The inventory itself has
  exactly 92 `##` headings, so the 92 is self-consistent with the inventory
  but not with the Cypress tree — which is exactly the missing-file bug
  above surfacing as a silent off-by-two in the stated totals.

### `cypress_migration_plan.md`

- **MAJOR** (downstream of the BLOCKER above) — because
  `playbook_run_actions.js` isn't in the plan, its ~19 tests aren't counted
  in "about 60 API-only tests move to Go" nor in the ~300-test Playwright
  target, and "down from 92 specs / ~790 tests" is off by one spec and ~19
  tests. Numbers should be recomputed after the inventory gap is fixed.
- **Consolidation (P1–P7) spot-checks**: the principles are sound and the
  specific candidates I checked are genuine duplication, not coverage loss:
  - P1 (participant/viewer split): confirmed `rdp_main_header_spec.js`,
    `rdp_main_retrospective_spec.js`, `rdp_main_checklist_spec.js` all share
    a `commonTests()`-style helper run twice; collapsing the read-only half
    into one `rdp_viewer.spec.ts` is safe **provided** the per-feature
    "participant" spec keeps the behavioral assertions (the task docs for
    08/09 do split this correctly, with 09 explicitly listed as a sink for
    "viewer halves of all `rdp_*` specs").
  - P6 "dead code" claims for `app_bar_spec` and `lhs_spec`'s `cy.wait;`
    (bare reference, not a call — a no-op statement) were both confirmed by
    direct inspection.
  - The `digest_spec.js` "skipped" claim is accurate but for a subtler
    reason than "tests are `.skip`'d individually" — the whole `describe` is
    `describe.skip(...)`, which the plan's §1 P6 phrasing ("Skipped/stale
    (16 tests)") doesn't distinguish from individually-skipped tests. Not
    wrong, just worth a footnote since a reader skimming for `it.skip` won't
    find any in that file.
- **MINOR** — §2's "Totals (approx.)" row and the individual target-spec `~N
  (source count)` numbers are a reasonable approximation but a few are
  off by enough to matter for the per-task "Definition of done" check
  ("every behavior ... must be covered ... unless this doc says it moves
  elsewhere"). E.g. `run_naming.spec.ts` lists source count "(~45)" against
  4 source specs whose combined `it` count (spot-checked via the inventory
  text) looks closer to the mid-30s. This doesn't block anything since the
  *task docs* (not this summary table) are what coding/review agents actually
  use, and the task docs re-derive their own per-spec breakdowns — but it
  means the plan's headline numbers shouldn't be quoted as a QA gate.
- **No contradictions found** between the plan's §2 target layout and the
  individual task docs' "Target" sections — I cross-checked all 40-ish
  non-ported spec names and every one maps 1:1 to exactly one task id.

### Tasks (`docs/tasks/*.md`)

- **Verified**: the `rdp_main_header_spec.js` split across tasks
  06-finish-restore / 08-rdp-header / 09-rdp-viewer / 10-participants /
  25-run-actions is cleanly partitioned — each task's source table has an
  explicit "NOT X (goes to task Y)" annotation and the five scopes are
  mutually exclusive by inspection (title/badge/copy-link/rename/favorite/
  leave → 08; viewer mirror → 09; Participate → 10; finish confirm/cancel →
  06; run-actions modal + broadcast → 25). This is the most failure-prone
  part of the whole plan (one Cypress file feeding five Playwright specs)
  and it was done carefully.
- **Verified**: task 07 (`checklist`) and task 24 (`run-visibility`) both
  correctly encode the two bugs found above (concatenated-title rename,
  inverted "to run followers") as explicit instructions to the coding agent
  ("verify real behavior first" / "encode the real expectation with a
  correct row name"), rather than silently porting broken assertions.
- **MINOR** — task **48 (go-coverage-gaps)** and task **49
  (retire-cypress)** both implicitly assume every API-only Cypress spec is
  *listed somewhere* as a task source. Because of the BLOCKER above,
  `playbook_run_actions.js`'s run-start-time assertions (which are
  *not* pure API-contract tests — some exercise real posts/messages in
  real channels, i.e. legitimate E2E material, not just a Go-test
  candidate) have no task, so task 48 won't pick them up either. Once the
  inventory is fixed, re-triage this file: some of it (owner/creator
  resolution at creation, webhook-on-run-start) is plausibly Go-coverable
  (and in fact `role_based_assignment_spec.js`'s "owner/creator resolution
  at creation" is *already* routed to Go in task 48 — this file's
  equivalent tests should probably merge into that same Go task), but the
  broadcast-channel and invite assertions that post real messages to real
  channels read as genuine Playwright material and should land in
  `editor_run_settings.spec.ts` or `run_actions.spec.ts`.
- **MINOR** — Task ordering (plan §5 / the `todo.json` array order) is
  sensible: `foundations` (03) is first among un-ported work, then run
  lifecycle (`start-run-modal`, `start-run-entry-points`, `finish-restore`,
  `checklist`), consistent with task 03's own target list building exactly
  the page objects (`RunDetailsPage`, `ChannelRhs`, `RunModal`,
  `StatusUpdateDialog`) that tasks 04–10 declare as dependencies. No
  circular or out-of-order dependency found in a scan of every task's
  "Target" vs. implied page-object usage.
- **MINOR** — none of the 49 task docs declare an explicit machine-readable
  "depends_on" field (see `todo.json` schema finding below) — the ordering
  is implicit in array position only. This works as long as the loop always
  runs tasks strictly in order and never skips ahead (see below), but there
  is no structural guard against an orchestrator (or a human running
  `unblock` + resuming later) jumping to `start-run-modal` before
  `foundations` is actually `done`.

### `todo.json` / `todo.sh`

- **Verified correct** (tested against a copied `todo.json`/`todo.sh` in
  `/tmp`, read-only against the real files): `next`, `get`, `doc`,
  `start-attempt`, `coded`, `reviewed <id> OK|NOK`, `status` all behave
  exactly as documented. `done` correctly refuses when `review_status !=
  "OK"` or `coded_at` is null (verified by schema/filter reading; the `jq
  -e ... > /dev/null || exit 1` guard is sound).
- **MAJOR** — `next`'s selection filter is
  `select(.done == false and .review_status != "BLOCKED")`, i.e. it has
  **no concept of task dependencies**. If `foundations` (id `foundations`,
  array position 3) gets blocked after 5 NOK attempts, `next` will happily
  return `start-run-modal` next, even though every later task's doc assumes
  `RunDetailsPage`/`ChannelRhs`/`RunModal`/`StatusUpdateDialog` already
  exist. The runbook's prose *does* cover this ("If a later task depends on
  a blocked one ... stop the run and report to the human") but that's a
  judgment call left to the orchestrator agent reading free-text `notes`,
  not something `todo.sh` can check mechanically. A cheap fix: add an
  optional `"depends_on": ["foundations"]` array to each task and have
  `next` skip (or the runbook explicitly check) any task whose dependencies
  aren't `done`.
- **MINOR** — `todo.sh max-attempts` (reads `$MAX_ATTEMPTS`, default `5`) is
  defined but **never called** anywhere in `MIGRATION_RUNBOOK.md` — the
  runbook hardcodes "`for attempt in 1..5`" and "up to 5 code→review loops"
  in prose instead of asking the script. If someone later wants to tune
  `MAX_ATTEMPTS` for a single run (e.g. bump to 8 for a gnarly task), the
  hook exists in the script but nothing in the runbook tells the
  orchestrator to use it. Either wire `todo.sh max-attempts` into the loop
  description or drop the unused command.
- **MINOR** — `start-attempt` unconditionally increments `attempts` and
  resets `coded_at`/`reviewed_at`/`review_status` to null. The "Resuming
  after an interruption" section in the runbook correctly warns not to call
  `start-attempt` again when resuming mid-attempt, but there's no guard in
  the script itself — a human or a confused orchestrator re-running
  `start-attempt` on an in-progress attempt silently burns an extra attempt
  and loses the stored `coded_at`. Since `MAX_ATTEMPTS` is small (5), this
  is cheap to hit by accident. Consider an idempotency check (e.g. refuse
  `start-attempt` if `coded_at` is already set and `review_status` is null,
  i.e. mid-review).
- **MINOR** — the `block` command takes a free-text note but there is no
  schema validation that it includes the pieces the runbook's §6 asks for
  (remaining findings, root cause, stash reference). This relies entirely on
  the orchestrator following the prompt template; a malformed/empty note
  would still be accepted by `jq`.
- **Confirmed via live test**: the "block, then stash everything except
  `todo.json` and `docs/tasks/reviews`" sequence
  (`git stash push -u -m "..." -- . ':!...todo.json' ':!...reviews'`)
  works exactly as intended — reproduced in a scratch repo: the stash
  captures the implementation changes and leaves `todo.json` + the reviews
  directory as the only things left to `git add`/commit. No git syntax
  issue.

### `MIGRATION_RUNBOOK.md`

- **Verified against the installed `herdr` CLI** (`herdr --help`, `herdr
  workspace --help`, `herdr tab --help`, `herdr agent --help`, `herdr pane
  --help`, `herdr agent start/prompt/wait --help`, `herdr pane split
  --help`, plus live `herdr agent list`/`herdr agent get <name>` against
  real running agents in this session): every command and JSON path used in
  the runbook is syntactically valid and matches the real response shape
  (`.result.workspace.workspace_id`, `.result.tab.tab_id`,
  `.result.root_pane.pane_id`, `.result.agent.agent_status`,
  `.result.pane.pane_id`). No made-up flags or wrong paths found.
- **MINOR** — Step 2 creates a workspace with `herdr workspace create`
  *and then* creates a separate tab with `herdr tab create --workspace
  "$WS"`. Per `herdr --skill`, `workspace create` already returns its own
  `.result.tab` and `.result.root_pane` — so the first task in a fresh
  `migration` workspace leaves behind an unused idle root pane/tab that is
  never closed by the loop (step 5/6 only close the tab created by `tab
  create`, not the workspace's own root tab). Harmless, but it's clutter
  across a 49-task run; worth a one-line note to reuse or close the
  workspace's initial tab.
- **MINOR** — Step 4's review prompt tells the review agent to "run the spec
  yourself twice ... plus `npm run check` and `npm run check-types`" but
  doesn't tell it which directory to run them from (`cd e2e-tests/playwright`
  first). Minor, but worth being explicit since the reviewer pane's cwd is
  inherited from `herdr pane split --cwd "$PWD"` at the *repo root*, not
  `e2e-tests/playwright`.
- **MINOR / potential race** — Step 4 waits with
  `herdr agent prompt reviewer "$PROMPT" --wait --timeout 1800000`, which
  per `herdr --skill` only guarantees a *settled* (`idle`/`done`/`blocked`)
  state was observed, not that the specific turn's work (writing the review
  file + running `todo.sh reviewed`) is complete — "it does not track turns:
  if the agent is already working, that active turn's completion may
  satisfy it." Since the reviewer pane is freshly started for the attempt,
  this is low risk in practice (no prior turn to confuse it with), but the
  subsequent explicit check — "check that both signals agree: review_status
  in todo.json and the VERDICT: line" — is exactly the right mitigation and
  is already in the doc. No fix needed beyond noting it's intentional.
- **No blocking issues found** in the resume logic (§ "Resuming after an
  interruption"): the three branches (`coded_at` set + `review_status`
  null; `coded_at` null + dirty tree; clean tree) are exhaustive and match
  how `start-attempt`/`coded`/`reviewed` actually mutate the JSON.
- **MINOR** — the runbook doesn't say what to do if the *coder* agent name
  collision check fails (Herdr requires unique live agent names; "coder"/
  "reviewer" are reused every task but should be free once the previous
  task's tab is closed). If a previous run crashed without closing a tab,
  `herdr agent start coder ...` will fail with a name collision and the
  runbook has no explicit recovery step beyond the general "see what's
  alive" resume guidance. Worth one line: "if `agent start` fails on a name
  collision, `herdr agent list` to find the stale agent, decide if it's
  truly stale (check its pane's tab against existing todo.json state), and
  close it before retrying."

---

## Top 5 fixes to make before starting the loop

1. **Fix the missing-spec gap.** Add `channels/playbook_run_actions.js` to
   `cypress_inventory.md`, decide its destination(s) in
   `cypress_migration_plan.md` (likely split between
   `editor_run_settings.spec.ts`/`run_actions.spec.ts` for the real-message
   assertions and task 48's Go coverage for the pure
   owner/creator-resolution-at-creation parts, merging with
   `role_based_assignment_spec.js`'s equivalent), and update whichever task
   doc(s) own that scope. Recompute the plan's totals.
2. **Add dependency tracking to `todo.json`/`todo.sh`.** At minimum, add
   `depends_on` to each task and make `next` skip tasks whose dependencies
   aren't `done` (or hard-fail with a clear message), so a blocked
   `foundations` task can't silently let downstream tasks start.
3. **Automate the POM "no raw locator in specs" rule.** Add a scoped ESLint
   rule (or a quick custom check run as part of `npm run check`) so the
   reviewer agent doesn't have to catch this by eye on every one of ~40
   specs across up to 5 attempts each.
4. **Resolve the two documented-but-unported Cypress bugs as data, not
   prose, before task 07/24 run**: confirm with the actual product behavior
   (not just "verify before porting") whether the checklist rename really
   concatenates titles and whether private-playbook private-channel
   followers really can't see the run, and bake the *confirmed* expectation
   into the task docs so the coding agent isn't left to re-derive it from
   scratch.
5. **Decide and record `tours_spec_ignore_.js`'s fate** (drop with a
   one-line reason, or add it as a 50th task) so the "every Cypress spec
   lands in a task or is dropped with a reason" invariant is actually true
   for 100% of the files in the directory, not 92/94.
