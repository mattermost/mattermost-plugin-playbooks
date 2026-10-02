VERDICT: OK

## Findings

### MINOR — `confirm_modal.ts:30-32` — raw CSS id selectors below a11y priority

```ts
this.dialog = page.locator('#confirmModal');
this.confirmButton = page.locator('#confirmModalButton');
this.cancelButton = page.locator('#cancelModalButton');
```

AGENTS.md priority order puts `page.locator('#...')` below all recommended options (`getByRole` → `getByLabel` → `getByText` → `getByTestId`). Prefer `page.getByRole('dialog')` for the modal wrapper and — given the button label varies per dialog — possibly `page.locator('#confirmModalButton')` is an acceptable pragmatic choice for the buttons (the IDs are declared stable infra IDs). No behavioral impact; noted as a follow-up candidate.

**Expected fix (non-blocking):** `dialog` → `page.getByRole('dialog', {name: /confirm/i})` scoped to the first matching dialog, or keep the id locator with a comment explaining why role/label is less suitable here.

---

### MINOR — `run_details_page.ts:63` — `finishButton` has no accessible name filter

```ts
this.finishButton = this.finishSection.getByRole('button');
```

The RHS counterpart (`channel_rhs.ts`) correctly uses `{name: /finish/i}`. Both refer to a single button inside the section, so there is no current ambiguity, but the name-less form is less robust if the section ever gains a second button (e.g. a dismiss/close).

**Expected fix (non-blocking):** `this.finishSection.getByRole('button', {name: /finish/i})` for parity with `rhsFinishButton`.

---

## Coverage verification

All Cypress behaviors within scope are covered:

| Source | Behavior | Test |
|---|---|---|
| `rdp_main_finish_spec.js` | Hidden for viewer | `finish section: visible for owner (with placeholder), hidden for viewer` |
| `rdp_main_finish_spec.js` | Visible for owner + placeholder | same |
| `rdp_main_finish_spec.js` | Confirm finish (finish-section) | `finish run via finish section: confirm` |
| `rdp_main_finish_spec.js` | Cancel finish (finish-section) | `finish run via finish section: cancel` |
| `rdp_main_header_spec.js` | Confirm finish (context menu) | `finish run via header context menu: confirm` |
| `rdp_main_header_spec.js` | Cancel finish (context menu) | `finish run via header context menu: cancel` |
| `rdp_main_finish_spec.js` | Outstanding-task warning | `finish modal warns about outstanding tasks when a visible task is incomplete` |
| `rdp_main_restore_spec.js` | Restart → badge In Progress + LHS | `restart run from context menu` |
| `auto_archive_spec.js` | RHS finish archives channel | `auto-archive: archives channel on finish and unarchives on restore with timeline events` (Part 1) |
| `auto_archive_spec.js` | RDP finish archives + `channel_archived` event | same (Part 2) |
| `auto_archive_spec.js` | RDP restore unarchives + `channel_unarchived` event | same (Part 2) |
| `auto_archive_spec.js` | Linked channel never archived | `auto-archive: linked pre-existing channel is not archived on finish` |
| `auto_archive_spec.js` | Disabled setting leaves channel untouched | `auto-archive: disabled setting leaves channel untouched across finish and restore` |
| `auto_archive_spec.js` | Status post "from Finished to In Progress" | `auto-archive: status post in channel after restore` |
| `auto_archive_spec.js` | Second finish re-archives after manual unarchive | `auto-archive: second finish re-archives channel after manual unarchive and restore` |

Editor-toggle tests (toggle visibility, banner, mode-switch) correctly absent (go to `editor-run-settings`). Conditional-hidden-tasks describe correctly absent (goes to `conditions`). `rdp_main_header_spec.js` non-finish tests (title, badge, favorite, participate, rename, leave, run-actions) correctly absent (go to `rdp-header`).

## Consolidation

The 2-row table requested by the doc is implemented as a `finishTriggers: FinishTrigger[]` parametrized array (finish-section / header context menu), each exercising confirm and cancel paths — 4 tests from 1 loop body. ✅

## Rule checks

- **POM**: All locators in page objects; spec never calls `page.getBy*`/`page.locator` directly. ✅
- **a11y-first**: Role-based locators used throughout (MINOR exceptions noted above). ✅
- **No `eslint-disable`**: Confirmed. ✅
- **No `waitForTimeout`/`setTimeout`**: Confirmed. ✅
- **No `test.skip`/`test.fixme`**: Confirmed. ✅
- **`expect.poll` for archive/unarchive**: Every `delete_at` check uses `expect.poll` with timeout + message. ✅
- **No Go changes**: `quality.sh` gate `no-go-changes` PASS. ✅
- **No webapp changes**: `git diff HEAD -- webapp/` is empty. ✅
- **No files outside `e2e-tests/`**: `quality.sh` gate `allowed-paths` PASS. ✅
- **`MattermostConfirmModal`**: Generic reusable core-modal wrapper; no plugin-specific logic. ✅

## Test runs

```
Run 1:
  npx playwright test tests/runs/finish_restore.spec.ts --reporter=list
  12 passed (2.0m)  — all 12 tests green

Run 2 (stability):
  npx playwright test tests/runs/finish_restore.spec.ts --reporter=list
  12 passed (2.0m)  — all 12 tests green

quality.sh re-run: QUALITY: PASS
```
