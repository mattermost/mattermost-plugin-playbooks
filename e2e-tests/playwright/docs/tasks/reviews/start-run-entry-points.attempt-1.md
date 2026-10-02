VERDICT: NOK

## Test runs

```
cd e2e-tests/playwright && npx playwright test tests/runs/start_run_entry_points.spec.ts --reporter=list
```

Run 1:
```
Running 10 tests using 1 worker
  ✓  1  start run via slash command in public channel @playbooks (6.8s)
  ✓  2  start run via slash command in private channel @playbooks (6.6s)
  ✓  3  start run via post menu in public channel @playbooks (7.0s)
  ✓  4  start run via post menu in private channel @playbooks (7.1s)
  ✓  5  Run button opens modal and confirmed run lands on RDP @playbooks (8.9s)
  ✓  6  Run Playbook button opens modal from own team and cross-team contexts @playbooks (14.6s)
  ✓  7  user who starts a run is channel admin of the run channel @playbooks (7.3s)
  ✓  8  dialog shows owner name and cancelling creates no run @playbooks (6.0s)
  -  9  whitespace-only run name is rejected ... (skipped: test.fixme)
  ✓ 10  clicking Yes, run playbook opens dialog and created run appears in RHS @playbooks (7.7s)
  1 skipped / 9 passed (1.3 min)
```

Run 2 (stability check): identical results — 9 passed, 1 fixme-skipped, stable.

```
cd e2e-tests/playwright && bash docs/quality.sh
```
Output (tail): `QUALITY: PASS`

Both runs and quality gate pass. Failures below are coverage/process issues found during manual review.

---

## Findings

### MAJOR — Coverage gap: `run_dialog_spec.js > cannot create a playbook run without filling required fields`

**File**: `e2e-tests/playwright/tests/runs/start_run_entry_points.spec.ts` (entire `interactive run dialog: validation and metadata` describe)

**Problem**: The task scope explicitly includes **all tests** from `channels/run_dialog_spec.js`. The Cypress test `cannot create a playbook run without filling required fields` asserts that submitting the Interactive Run Dialog (slash-command flow) with empty `playbookRunName` and `playbookID` fields keeps the modal open and shows `'This field is required.'` errors on both fields. No test in the spec (or anywhere in the Playwright suite) exercises this validation path. The `playbookField` locator already exists on `InteractiveRunDialog` (it's even commented as "Used to assert validation-error messages on the field wrapper") but is never called.

**Expected fix**: Add a test inside the `interactive run dialog: validation and metadata` describe that:
1. Opens the dialog via `/playbook run`.
2. Submits immediately (without filling any fields).
3. Asserts `dialog.expectOpen()` (modal stays open).
4. Asserts 'This field is required.' is visible on both the run-name field and the playbook-select field.

---

### MAJOR — Coverage gap: `overview_spec.js > start a run` (LHS Runs section verification)

**File**: `e2e-tests/playwright/tests/runs/start_run_entry_points.spec.ts:249` — `Run Playbook button opens modal from own team and cross-team contexts`

**Problem**: The task scope includes `overview_spec.js > start a run`, described as: *"playbook editor: 'Run Playbook' → enter run name → confirm creates run shown in LHS 'Runs' section."* The current test only opens the modal twice (once from own team, once cross-team) and **cancels** both times. It never fills a run name, confirms, or asserts the created run appears in the LHS "Runs" section (`playbooksPage.expectRunVisible`). Run-creation completion from the editor entry point is not verified in this spec or anywhere else in the Playwright suite; `start_run_modal.spec.ts` verifies RDP navigation but does not cover LHS Runs section appearance.

**Expected fix**: At minimum, one of the two cross-team cases should fill a run name, confirm, then assert the created run is visible in the Playbooks LHS Runs list (e.g. `await playbooksPage.openRunsList(); await playbooksPage.expectRunVisible(runName)`).

---

### MAJOR — Process gap: quality log missing `## Product bugs found` section

**File**: `e2e-tests/playwright/docs/tasks/reviews/start-run-entry-points.attempt-1.quality.log`

**Problem**: Migration hard rule 3 states *"If a test reveals a product bug, don't fix the product — mark it `test.fixme` and list it in the quality log under `## Product bugs found`."* The spec correctly has a `test.fixme` with a `@fixme` JSDoc for the whitespace-name-rejection regression (server now falls back to "Untitled" instead of rejecting). However, the quality log contains **no `## Product bugs found` section** documenting this discovered bug. The task review prompt explicitly flags this as "at least a MAJOR finding." While this is a documentation/process gap rather than a functional test defect, the required quality-gate artifact is absent and must be present before the task can be considered done.

**Expected fix**: Add to the quality log:
```
## Product bugs found

- `interactive run dialog: validation and metadata > whitespace-only run name is rejected`:
  The legacy Cypress spec `run_dialog_spec.js > rejects invalid channel names` expected
  the interactive dialog to reject whitespace-only run names with an "unable to create
  playbook run" error. The server now trims whitespace to "" and falls back to "Untitled"
  without returning an error. Marked test.fixme in the spec.
  See: e2e-tests/cypress/tests/integration/playbooks/channels/run_dialog_spec.js
```

---

### MINOR — Coverage attribution: `overview_spec.js > start a run > create a new channel / in existing channel`

**File**: `e2e-tests/playwright/tests/runs/start_run_entry_points.spec.ts` (spec header comment)

**Problem**: The task scope includes two overview_spec sub-tests: *"start a run > start a run, create a new channel"* (verifying `runinfo-channel-link` after default create-private-channel mode) and *"start a run > start a run in existing channel"* (configuring `#link-existing-channel` from the editor outline → run dialog defaults to link-existing). Neither is explicitly covered in this spec, nor attributed to `overview_spec.js` in `start_run_modal.spec.ts` (which covers functionally equivalent channel-mode behaviors from `start_run_spec.js`). The consolidation principle P3 allows merging, and the behaviors are substantially tested via API-configured equivalents in `start_run_modal.spec.ts`. However, the provenance/attribution is absent and the `#link-existing-channel` Outline-action UI path is not exercised.

**Expected fix**: Either add a note in the spec header that these overview_spec behaviors are intentionally consolidated into `start_run_modal.spec.ts`, or add the `#link-existing-channel` Outline configuration step to a test here.

---

## What passed

- **No Go changes** — confirmed via `git diff HEAD -- '*.go'` (empty).
- **No webapp changes** — confirmed via `git diff HEAD -- webapp/` (empty).
- **Allowed paths gate** — all changed files are under `e2e-tests/playwright/` only.
- **Lint / type-check** — `quality.sh` → `QUALITY: PASS`; no `eslint-disable`, no changes to `eslint.config.mjs` or `eslint-rules/`.
- **POM compliance** — no `page.getBy*` / `page.locator` calls in the spec file; all locators in page objects.
- **MattermostCore facade** — interactive dialog, channel settings, post list, slash command all go through `MattermostCore` sub-objects in `tests/pages/mattermost/`. No core-UI locators in plugin page objects or specs.
- **A11y-first locators** — `getByRole` / `getByText` used throughout; `getByTestId` only where unavoidable (Mattermost's interactive-dialog field naming convention, testid-only elements), with explanatory comments.
- **API seeding** — channel actions, runs, channels all seeded via helpers; no UI-driven setup.
- **No fixed waits** — no `waitForTimeout` / `setTimeout`.
- **Proper test structure** — `@objective` JSDoc, `{tag: '@playbooks'}`, `#`/`*` comment convention, collision-free `uniqueSuffix()` names, typed `beforeAll` interfaces.
- **`test.fixme` format** — the whitespace-name fixme has a reason string and `@fixme` JSDoc (passes `no-unconditional-skip` rule).
- **Cypress spec provenance comment** — present at the top of the spec file listing all five source specs.
