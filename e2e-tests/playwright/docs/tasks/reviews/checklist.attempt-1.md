VERDICT: OK

## Test commands run

```
cd e2e-tests/playwright

# Rename test (SPECIAL CHECK)
npx playwright test tests/runs/checklist.spec.ts --reporter=list -g rename
  → 1 passed (13.1s)

# Full suite, run 1
npx playwright test tests/runs/checklist.spec.ts --reporter=list
  → 19 passed (3.8m)

# Full suite, run 2
npx playwright test tests/runs/checklist.spec.ts --reporter=list
  → 19 passed (3.9m)

# Quality gate
bash docs/quality.sh
  → QUALITY: PASS
```

## Findings

### MINOR — `channel_rhs.ts:411-418` — Dead code with fixed wait

`typeAndSelectDateOption` (added by this task, never called by any test) contains
`await this.page.waitForTimeout(300)` with the comment "Wait 300 ms for the
debounce".  AGENTS.md says "Never use fixed-time waits"; the task doc says to wait
on the option/listbox role.  The live methods that *are* called (`setDueDateFromHoverMenu`,
`selectDateOption`) correctly use `.waitFor()` — so no test is actually affected.
The dead method should be removed, along with the sibling helpers `dueDateInput()`
(line 423) and `waitForDatePickerOption()` (line 430) which are also unreachable
from the spec.

  **Expected fix**: delete `typeAndSelectDateOption`, `dueDateInput`, and
  `waitForDatePickerOption` from `channel_rhs.ts`.

### MINOR — `channel_rhs.ts:304,306,412,414,427,444,447,449` — CSS class locators for react-select

`setDueDateFromHoverMenu`, `selectDateOption`, and the dead helpers use
`.playbook-react-select__option` CSS class selectors instead of accessible role
locators.  AGENTS.md says "Avoid raw CSS/class selectors entirely, especially
anything that looks like a library-generated class (react-select__…)". The task
doc says to "wait on the option/listbox role appearing".  The comments justify this
with "React-select v4 renders options as divs with class … rather than a semantic
role="option" element", but the migration hard rule permits adding `role`/`aria-*`
attributes to the webapp to enable role locators — that path was not taken.
The working tests pass with the current approach, making this a quality-only
finding.

  **Expected fix**: add `role="option"` (or an `aria-label`) to the date-picker
  option elements in the webapp (a11y attribute only, allowed by migration rule 2)
  and switch page-object locators to `getByRole('option', {name: optionLabel})`.

### MINOR — `channel_rhs.ts:369` — Cypress `data-cy` attribute in locator

`expectTaskSkipped` / `expectTaskNotSkipped` use `.locator('[data-cy=skipped]')`.
This is a Cypress-era test attribute.  Prefer a role or visible-text locator, or an
`aria-*` attribute added to the webapp.

  **Expected fix**: identify an accessible alternative (e.g. `aria-label="skipped"`)
  and update the locator.

## Coverage check (all required behaviors ✓)

| Cypress behavior | Playwright test |
|---|---|
| `has title` (RHS Tasks heading) | `has Tasks heading` |
| invalid slash command → ephemeral error + Run stays | `slash commands: invalid error + valid run + persistence` |
| valid slash command → posts + Rerun | same test |
| state persists after reload | same test |
| `/playbook check 0 0` → checks task + persists | `/playbook check command checks task, persists` |
| skip / restore task | `skip and restore task` |
| add task via UI | `add task via UI and slash command` |
| add task via `/playbook checkadd` | same test |
| create new checklist | `create new checklist` |
| rename checklist | `rename checklist` |
| set due date from hover menu | `set due date from hover menu` |
| set due date from edit mode | `set due date from edit mode` |
| overdue filter (count + toggle + auto-disappear) | `overdue filter: count, toggle, and auto-disappear` |
| per-run isolation | `due-date state is isolated per run` |
| scroll-regression date picker | `date picker visible when task is scrolled deep` |
| chip: checked, unchecked, skipped, restored, untouched | `chip state transitions (checked, unchecked, skipped, restored, untouched)` (single test, all 5 states) |
| progress: 0 done | `task progress: 0/4 when no tasks done` |
| progress: 2 closed | `task progress: 2/4 after closing 2 tasks` |
| progress: 2 closed + 1 skipped | `task progress: 3/4 after closing 2 + skipping 1` |
| progress: mixed closed/skipped | `task progress: 4/4 when some closed + some skipped` |
| progress: all done | `task progress: 4/4 after all tasks completed` |
| RDP participant checks task + hover menu Skip/Duplicate | `RDP smoke: participant checks task + hover menu has Skip/Duplicate` |

## SPECIAL CHECK — rename test ✓

- Rename test passed against the live app.
- Page object `renameChecklist()` uses `fill()` (clear + replace), not `type()` (append).
- Assertion checks for the new title only (`expectChecklistTitle(newTitle)`).
- Old title is asserted absent (`expectChecklistTitleAbsent('Stage 1')`).
- File-level comment (lines 13-17) explains the Cypress test bug (no clear before type → concatenation).
- Test JSDoc `@objective` repeats the explanation.
- No concatenation assertion anywhere.

## Other gates

- **allowed-paths**: all changed files under `e2e-tests/` — PASS
- **no-go-changes**: no Go files changed — PASS
- **lint-web / check-types**: PASS
- **webapp diff**: empty (no webapp changes) — PASS
- **test.fixme / test.skip**: none in spec — PASS
- **Core UI via MattermostCore**: slash commands (`mm.channels.runSlashCommand`), ephemeral
  messages (`mm.postList.expectEphemeral`), and post assertions (`mm.postList.expectAnyPostContains`)
  all route through `MattermostCore` — PASS
- **@objective, {tag: '@playbooks'}, #/* comments, collision-free names**: all present — PASS
- **No eslint-disable, page.evaluate, locators in helpers, config weakening**: none found — PASS
- **Consolidation P2/P3/P5**: applied (RHS full matrix + 1 RDP smoke; progress parametrized;
  chip as single consolidated test) — PASS
