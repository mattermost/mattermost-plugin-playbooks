# Task 03: Foundations: shared page objects and seeding helpers

**Task id**: `foundations` · **Kind**: playwright

## Target

- `tests/pages/run_details_page.ts`
- `tests/pages/channel_rhs.ts`
- `tests/pages/run_modal.ts`
- `tests/pages/status_update_dialog.ts`
- `tests/helpers/*.ts`
- `tests/smoke/run_details.spec.ts`

## What to do

Build the building blocks every later task needs, so later tasks don't each reinvent them.

**Helpers** (`tests/helpers/`, same style as existing: `requestedWith`, `readJsonOrThrow`, typed returns):
- `run.ts`: make `createRun` **return the run** (id, channel_id, name); add `finishRun`, `restoreRun`, `updateStatus(runId, message, reminderSeconds)`, `addParticipants(runId, userIds)`, `getRun(runId)`.
- `playbook.ts`: `patchPlaybook(id, partial)` / `updatePlaybook`, `archivePlaybook`, `getPlaybook`; `createPlaybook` options for `members`, `public`, checklists with items.
- `channel.ts` (new): `createChannel(teamId, {type: 'O'|'P'})`, `createDirectChannel(a, b)`, `createGroupChannel(ids)`, `getChannel`.
- `config.ts` (new): `patchConfig(partial)` (admin) for feature flags like App Bar / beta features / EnableTesting.
- `user.ts`/`team.ts`: anything missing to seed a viewer user that is a team member but not a participant.

**Page objects** (`tests/pages/`), a11y-first locators, `expect*` methods:
- `RunDetailsPage` (`/playbooks/runs/:id`): `goto(teamName, runId)`, header (title, status badge, context menu), sections (summary, status update, checklist, retrospective, finish), right sidebar (Info/Timeline).
- `ChannelRhs`: `gotoRunChannel(teamName, channelName)`, run title, checklist, run list, menu.
- `RunModal` (start-run modal): run name, summary, channel-mode radios, channel selector, submit/cancel.
- `StatusUpdateDialog`: message, reminder, "mark as finished", submit/cancel.
Only implement what you can exercise in the smoke spec; later tasks extend these classes.

**Smoke spec** `tests/smoke/run_details.spec.ts`: seed playbook + run via API, open the RDP and the run channel RHS, assert the run name is visible on both. This proves the helpers + POs work end-to-end.

## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Rules (non-negotiable)

- Follow `e2e-tests/playwright/AGENTS.md` (POM is mandatory: no `page.getBy*`/`page.locator` in specs; a11y-first locators; API seeding through `tests/helpers`; `@objective` JSDoc; `{tag: '@playbooks'}`; `#`/`*` comments; collision-free names; no fixed waits).
- Apply the consolidation principles P1-P7 from `docs/cypress_migration_plan.md`: modernize, don't copy-paste. Every behavior listed under "Cypress coverage" must be covered by some assertion, unless this doc says it moves elsewhere.
- Reuse and extend existing page objects/helpers before creating new ones. If a webapp component lacks an accessible name needed for a role locator, adding an a11y attribute in `webapp/` is allowed (hard rule 2, nothing else).
- Don't delete Cypress specs (that's the `retire-cypress` task).

## Definition of done

1. Target spec(s) exist and pass locally: `cd e2e-tests/playwright && npx playwright test <spec> --reporter=list` (server at `MM_SERVICESETTINGS_SITEURL`, default `http://localhost:8065`, plugin deployed with `make deploy` if you added webapp a11y attributes).
2. Run it a second time to check stability (`--repeat-each=2` is fine).
3. `e2e-tests/playwright/docs/quality.sh` prints `QUALITY: PASS` (log saved as `docs/tasks/reviews/<task-id>.attempt-<n>.quality.log`). If it redeployed the plugin, re-run step 1 afterwards.
4. At the top of the spec, a comment lists the Cypress spec(s) it replaces (and which parts).
