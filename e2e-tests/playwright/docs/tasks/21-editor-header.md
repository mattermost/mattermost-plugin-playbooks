# Task 21: Playbook editor header/overview (extend existing edit_header spec)

**Task id**: `editor-header` · **Kind**: playwright

## Target

- `tests/playbooks/editor_header.spec.ts (rename from edit_header.spec.ts)`

## What to do

Target ~7 tests. Rename the existing spec (git mv) and extend it.
- Copy link icon: tooltip, clipboard, "Copied!".
- Duplicate: fold "duplicate clears run_number_prefix" in as an extra assertion in the existing duplicate test; duplicator is a member (Run, not Join).
- Archived playbook shows badge + disabled Run button.
- Usage tab: counters update after starting and finishing a run (seed via API).

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

## Cypress coverage (sources)

Scope column says which part of each source spec belongs to THIS task. The excerpt below is the full inventory of that spec; ignore the parts outside the scope.

| Cypress spec | Scope for this task |
|---|---|
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/header_spec.js` | already ported in edit_header.spec.ts; keep |
| `e2e-tests/cypress/tests/integration/playbooks/playbooks/overview_spec.js` | copy link, duplicate (+ duplicate clears run_number_prefix), archiving UI, usage statistics tab |

### `playbooks/edit/header_spec.js`

> Scope: already ported in edit_header.spec.ts; keep

- **Area**: playbook editor > title/header (rename, description, duplicate)
- **Setup**: single team/user; playbook created fresh per test (blank via UI, or API for duplicate test).
- **Tests**:
  - `playbooks > edit > Edit playbook name > can be updated` — renaming via title dropdown "Rename" + editable text field + Save persists new name after `cy.reload()`.
  - `playbooks > edit > Edit playbook description > can be updated` — double-clicking the placeholder description text, typing new description, Save persists text after reload.
  - `playbooks > edit > Duplicate > can be duplicated` — title dropdown "Duplicate" creates "Copy of <title>" shown both in the editor header and in the LHS "Playbooks" group.
- **Notes**: None.

### `playbooks/overview_spec.js`

> Scope: copy link, duplicate (+ duplicate clears run_number_prefix), archiving UI, usage statistics tab

- **Area**: playbook editor > overview/outline page
- **Setup**: `apiInitSetup` team/user, second user, second team, extra follower user; public playbook with retrospective template/timer, two private playbooks (solo/shared members), two playbooks for team-switch run testing; viewport macbook-13.
- **Tests**:
  - `redirects to not found error if the playbook is unknown` — playbook editor: visiting non-existent playbook ID redirects to `/playbooks/error?type=playbooks`.
  - `redirect to not found if the url is incorrect` — playbook editor: visiting a path-traversal-like malformed playbook URL redirects to `/playbooks/error?type=default`.
  - `should switch to channels and prompt to run when clicking run > for testPlaybookOnTeamForSwitching from its own team` — LHS/backstage list: finding and clicking a playbook then "Run Playbook" opens run-creation dialog at config step, from the playbook's own team.
  - `... > for testPlaybookOnTeamForSwitching from another team` — same flow but navigated from a different team, verifying cross-team switch still opens run dialog.
  - `... > for testPlaybookOnOtherTeamForSwitching from its own team` — same flow for a playbook that lives on the other team, visited from its own team.
  - `... > for testPlaybookOnOtherTeamForSwitchingOnOtherTeam from another team` — same flow for other-team playbook accessed from the first team, verifying switch+run dialog.
  - `... > on direct navigation to a playbook` — playbook editor: direct URL visit + "Run Playbook" click opens run-creation dialog.
  - `should copy playbook link` — playbook editor header: hovering copy-link icon shows tooltip "Copy link to", clicking copies URL to clipboard and tooltip changes to "Copied!".
  - `should duplicate playbook` — playbook editor title menu: "Duplicate" creates "Copy of ..." playbook, duplicator is sole member and can run (not join).
  - `duplicating a playbook clears the run_number_prefix` — playbook editor title menu + API: duplicating a playbook with a `run_number_prefix` set results in duplicate having empty prefix.
  - `checklists > header > has title` — playbook editor Outline `#checklists` section: shows "Tasks" header.
  - `checklists > shows checklists` — playbook editor Outline: checklist title and step titles rendered under `#checklists`.
  - `shows correct retrospective timer and template text` — playbook editor Outline `#retrospective` section: shows "7 days" reminder interval and retro template text.
  - `shows statistics in usage tab` — playbook editor usage/overview tab: "Runs currently in progress", "Participants currently active", "Runs finished in the last 30 days" counts update after starting then finishing a run (via API) + page reload.
  - `start a run` — playbook editor: "Run Playbook" → enter run name → confirm creates run shown in LHS "Runs" section.
  - `archiving > shows intended UI and disallows further updates` — playbook editor: archived playbook shows archive badge, disabled "Run Playbook" button; API update attempt on archived playbook returns 400.
  - `start a run > start a run, create a new channel` — playbook editor + run dialog: default config (create private channel) honored; starting run creates new channel shown via `runinfo-channel-link`.
  - `start a run > start a run in existing channel` — playbook editor Outline actions (`#link-existing-channel`) + run dialog: enabling "link to existing channel" action and selecting "Town" channel makes run dialog default to linking existing channel; run creates no new channel, links to "Town".
- **Notes**: Uses `cy.wait`-style `cy.waitForGraphQLQueries()` custom command for debounced GraphQL save; heavy reliance on `cy.apiCreatePlaybook`/API setup, some tests span both API and UI assertions.
