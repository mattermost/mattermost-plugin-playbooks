# Task 46: LHS navigation and dot menus

**Task id**: `lhs` · **Kind**: playwright

## Target

- `tests/navigation/lhs.spec.ts`

## What to do

Target ~5 tests. Dot menu table `{run, playbook} x {copy link, favorite/unfavorite}`; leave run as owner requires reassignment; leave run without permanent access table `{on its RDP -> redirect to runs list, elsewhere -> stay}`; leave playbook.

## Migration hard rules (a violation is an automatic review BLOCKER)

1. **No Go file may change** (`*.go`, `go.mod`, `go.sum`). This includes Go tests. `quality.sh` fails on any Go change.
2. **The only allowed webapp changes are accessibility attributes** added so tests can use role/label locators: `aria-label`, `aria-labelledby`, `aria-describedby`, `role`, `alt`, label association (`htmlFor`/`id`), plus the i18n string an `aria-label` needs (`formatMessage` + the `make i18n-extract-webapp` update of `webapp/i18n/en.json`). No `data-testid`, no logic, styling, markup restructuring, new files, or bug fixes.
3. **If a test reveals a product bug, don't fix the product.** Keep the test, mark it `test.fixme('<what is broken>, see Cypress <spec> / <ticket if any>')`, and list it in the quality log under `## Product bugs found`.

## Rules (non-negotiable)

- Follow `e2e-tests/playwright/AGENTS.md` (POM is mandatory: no `page.getBy*`/`page.locator` in specs; a11y-first locators; API seeding through `tests/helpers`; `@objective` JSDoc; `{tag: '@playbooks'}`; `#`/`*` comments; collision-free names; no fixed waits).
- Apply the consolidation principles P1-P7 from `docs/cypress_migration_plan.md`: modernize, don't copy-paste. Every behavior listed under "Cypress coverage" must be covered by some assertion, unless this doc says it moves elsewhere.
- Reuse and extend existing page objects/helpers before creating new ones. If a webapp component lacks an accessible name needed for a role locator, adding an a11y attribute in `webapp/` is allowed (hard rule 2, nothing else).
- Don't delete Cypress specs (that's the `retire-cypress` task).
- **Stuck on a selector?** You may use the agent-browser skill (`agent-browser skills get core`) to explore the running app and read its accessibility tree (roles + accessible names). Turn what you find into role/label locators in a page object. Artifacts go to /tmp only; never change server config through the System Console. It's an exploration aid only; the Playwright tests must pass on their own.

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
| `e2e-tests/cypress/tests/integration/playbooks/lhs_spec.js` | all except "lhs refresh on follow/unfollow" (participants) |

### `lhs_spec.js`

> Scope: all except "lhs refresh on follow/unfollow" (participants)

- **Area**: LHS navigation and run/playbook dot-menu actions
- **Setup**: 2 team members (testUser owner, testViewerUser), public + private playbook; viewport macbook-13; runs created per-test via API.
- **Tests**:
  - `lhs > navigate > click run` — clicking a run entry in LHS "Runs" group navigates/selects it (basic click smoke test).
  - `lhs > run dot menu > shows on click` — clicking the run's LHS dot menu button opens the dropdown menu (RDP page loaded).
  - `lhs > run dot menu > can copy link` — "Copy link" dropdown item copies RDP run URL to clipboard (stubbed clipboard assertion).
  - `lhs > run dot menu > can favorite / unfavorite` — "Favorite" moves run into LHS "Favorite" group testId, "Unfavorite" removes it.
  - `lhs > run dot menu > lhs refresh on follow/unfollow` — on RDP as a non-owner viewer, clicking "Follow" in run header increases profile-option avatars from 1→2 and adds run to LHS; "Unfollow" via dot menu removes it from LHS "Runs" group.
  - `lhs > run dot menu > leave run` — owner cannot leave (confirm modal does not appear) until ownership reassigned to another participant via RDP owner selector; after reassignment, "Leave and unfollow" + confirm succeeds.
  - `lhs > leave run - no permanent access > leave run, when on rdp of the same run` — non-owner participant on RDP of a private-playbook run leaves via dot menu + confirm modal, gets redirected to `/playbooks/runs?sort=` list page.
  - `lhs > leave run - no permanent access > leave run, when not on rdp of the same run` — leaving the same run from LHS dot menu while on Playbooks list page (not RDP) keeps user on `/playbooks/playbooks` page after confirm.
  - `lhs > playbook dot menu > shows on click` — dot menu on a playbook LHS entry (backstage list) opens dropdown.
  - `lhs > playbook dot menu > can copy link` — "Copy link" copies playbook URL to clipboard.
  - `lhs > playbook dot menu > can favorite / unfavorite` — favorite/unfavorite toggles playbook between "Favorite" and "Playbooks" LHS groups.
  - `lhs > playbook dot menu > can leave` — "Leave" removes playbook entry from LHS "Playbooks" group.
- **Notes**: Has stray no-op `cy.wait;` (missing parens, does nothing) in `navigate` beforeEach — likely dead code / bug in the spec itself.
