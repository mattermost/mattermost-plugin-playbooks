# Task 14: Status updates from the run details page + token resolution

**Task id**: `run-status-updates` · **Kind**: playwright

## Target

- `tests/runs/status_updates.spec.ts`

## What to do

Target ~7 tests.
- Post update from RDP (reminder changes due date, message lands in channel); post button gone once finished.
- Request update: confirm posts message, cancel doesn't, disabled once finished.
- Tokens: **one table** `{ {SEQ}, {OWNER}, {CREATOR}, {Zone} property, unknown token, plain text, mixed known+unknown }`. For each row assert BOTH the modal "Resolves to:" preview (or its absence) AND the posted message content. This merges the preview spec and the posted-message spec.

## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Rules (non-negotiable)

- Follow `e2e-tests/playwright/AGENTS.md` (POM is mandatory: no `page.getBy*`/`page.locator` in specs; a11y-first locators; API seeding through `tests/helpers`; `@objective` JSDoc; `{tag: '@playbooks'}`; `#`/`*` comments; collision-free names; no fixed waits).
- Apply the consolidation principles P1-P7 from `docs/cypress_migration_plan.md`: modernize, don't copy-paste. Every behavior listed under "Cypress coverage" must be covered by some assertion, unless this doc says it moves elsewhere.
- Reuse and extend existing page objects/helpers before creating new ones. If a webapp component lacks an accessible name needed for a role locator, adding an a11y attribute in `webapp/` is allowed (hard rule 2, nothing else).
- Don't delete Cypress specs (that's the `retire-cypress` task).
- **Stuck on a selector?** You may use the agent-browser skill (`agent-browser skills get core`) to explore the running app and read its accessibility tree (roles + accessible names). Inspect the DOM only and **do not take screenshots**. Turn what you find into role/label locators in a page object. Any artifacts go to /tmp only; never change server config through the System Console. It's an exploration aid only; the Playwright tests must pass on their own.

- **Mattermost core UI goes through `MattermostCore`** (`tests/pages/mattermost/`, created by the `mattermost-core-pom` task): channels, posts, ephemeral messages, LHS sidebar, app bar/channel header, core RHS/threads, generic modals, interactive dialogs, System Console. Plugin page objects and specs must not locate core UI themselves. Extend `MattermostCore` if something is missing. The reviewer treats core-UI locators outside `tests/pages/mattermost/` as MAJOR.

## Definition of done

1. Target spec(s) exist and pass locally: `cd e2e-tests/playwright && npx playwright test <spec> --reporter=list` (server at `MM_SERVICESETTINGS_SITEURL`, default `http://localhost:8065`, plugin deployed with `make deploy` if you added webapp a11y attributes).
2. Run it a second time to check stability (`--repeat-each=2` is fine).
3. `e2e-tests/playwright/docs/quality.sh` prints `QUALITY: PASS` (log saved as `docs/tasks/reviews/<task-id>.attempt-<n>.quality.log`). If it redeployed the plugin, re-run step 1 afterwards.
4. At the top of the spec, a comment lists the Cypress spec(s) it replaces (and which parts).

## Cypress coverage (sources)

Scope column says which part of each source spec belongs to THIS task. The excerpt below is the full inventory of that spec; ignore the parts outside the scope.

| Cypress spec | Scope for this task |
|---|---|
| `e2e-tests/cypress/tests/integration/playbooks/runs/rdp_main_statusupdate_spec.js` | participant tests + "template token preview" describe |
| `e2e-tests/cypress/tests/integration/playbooks/runs/status_update_template_spec.js` | all tests |

### `runs/rdp_main_statusupdate_spec.js`

> Scope: participant tests + "template token preview" describe

- **Area**: RDP main > status update section (post update, request update, template token preview)
- **Setup**: Public playbook, testUser (owner/participant) + testViewerUser (non-participant); macbook-13 viewport. Second describe: fresh playbook per test with `run_number_prefix` and a `Zone` select property field, for status update message template token preview.
- **Tests**:
  - `as participant > is visible` — RDP status-update section visible.
  - `as participant > has no title` — section has no h3 title for participant.
  - `as participant > post update > button disappears if we finish the run` — finishing the run via finish-section button+confirm removes the post-update button.
  - `as participant > post update > button triggers post update modal` — clicking post-update opens status update dialog; posting message with reminder "15 minutes" updates due-date display and posts message to run channel.
  - `as participant > request an update > is disabled if the run is finished` — after finishing run, kebab "Request update..." option is force-clickable but disabled (no confirm modal opens).
  - `as participant > request an update > requests and confirm` — kebab menu "Request update..." + confirm posts "<user> requested a status update for <run>." to channel.
  - `as participant > request an update > requests and cancel` — kebab menu "Request update..." + cancel does not post the request message.
  - `as viewer > is visible` — status-update section visible to non-participant viewer.
  - `as viewer > has a title` — viewer sees h3 title "Recent status update".
  - `as viewer > has placeholder` — viewer sees placeholder "No updates have been posted yet".
  - `as viewer > has a due date` — viewer sees "Update due" / "in 24 hours".
  - `as viewer > shows the most recent update` — after participant posts an update (15 min reminder), viewer's due date and `status-update-card` reflect new update text.
  - `as viewer > requests an update and confirm` — viewer's "Request update..." + confirm posts request message to channel.
  - `as viewer > requests an update and cancel` — viewer's "Request update..." + cancel does not post message.
  - `status update > template token preview > shows "Resolves to:" line when message contains {SEQ}` — status update modal preview resolves `{SEQ}` token to run's sequential_id.
  - `status update > template token preview > shows "Resolves to:" line when message contains {OWNER}` — preview resolves `{OWNER}` token to owner display text.
  - `status update > template token preview > shows "Resolves to:" line for mixed system + unknown tokens — unknown token passed through` — preview resolves known `{SEQ}` but leaves unknown `{unknownfoo}` token literal.
  - `status update > template token preview > hides "Resolves to:" line when message has only unknown tokens` — no preview line shown when only unresolvable tokens present.
  - `status update > template token preview > hides "Resolves to:" line for plain text with no tokens` — no preview line for plain text.
  - `status update > template token preview > shows "Resolves to:" for property field token after value is set` — after setting a custom property field value via GraphQL mutation, message token `{Zone}` resolves to the field's value in preview.
- **Notes**: File has `/* eslint-disable no-only-tests/no-only-tests */` at top (odd, no `.only` present though). Property-field preview test uses direct GraphQL mutation via `cy.request` (API-level setup, not UI).

### `runs/status_update_template_spec.js`

> Scope: all tests

- **Area**: Status update message template token resolution (actual posted message, not just the preview) — posted via RDP status update modal
- **Setup**: Shared playbook (status updates enabled, 1-day reminder, two text property fields Zone/Manager); fresh run per test with property values set via RDP RHS; macbook-13 viewport. Uses custom commands `playbooksVisitRun`, `playbooksSetRunPropertyViaRHS`, `assertRunPropertyValueStored`, `playbooksPostStatusUpdateViaRunPage`.
- **Tests**:
  - `system tokens {OWNER} and {CREATOR} are resolved in status update messages` — posting a status update with `{OWNER}`/`{CREATOR}` tokens resolves them to the owner's display name (nickname>fullname>username) in the actual posted message; no raw tokens remain.
  - `custom attribute token {Zone} is resolved in status update messages` — `{Zone}` token resolves to the run's property value "Alpha" in posted message.
  - `demo template: {SEQ}, {Zone}, {OWNER}, {Manager}, {CREATOR} all resolve together` — combined template resolves all tokens together; `{SEQ}` is stripped (not left literal) when no `run_number_prefix` configured.
  - `unknown tokens are left as-is (lenient resolution)` — posted message: unknown token `{DoesNotExist}` passed through verbatim while known `{OWNER}` token resolves.
- **Notes**: Complements `rdp_main_statusupdate_spec.js`'s template-preview tests but asserts the actual *posted* message content rather than the modal preview — some duplication/overlap in intent (preview vs. posted-result) worth noting for consolidation.
