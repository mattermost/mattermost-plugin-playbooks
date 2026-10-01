# Task 38: Channel RHS run list

**Task id**: `rhs-run-list` · **Kind**: playwright

## Target

- `tests/channels/rhs_run_list.spec.ts`

## What to do

Target ~6 tests. Filter counts; show more pagination; card info + click-through; dotmenu (go to overview, go to playbook, hidden-cases table `{standalone, private playbook without access}`, move channel reduces count); stays in list after moving with 2 runs. Don't depend on fixed names like 'playbook-run-9'; use generated names.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/rhs/list_spec.js` | all tests |

### `channels/rhs/list_spec.js`

> Scope: all tests

- **Area**: RHS (channel) > run list (filtering, pagination, card info, navigation to RDP/PBE, moving runs between channels)
- **Setup**: team/user + viewer user; one playbook with 10 active + 4 finished runs in one channel, plus 1 standalone (no-playbook) run and 1 private-playbook run (viewer added as participant) in the same channel; viewport macbook-13.
- **Tests**:
  - `can filter` — filter dropdown shows counts for active (`numActiveRuns+2`) and finished (`numFinishedRuns`) runs; selecting finished filter shows only that many run cards.
  - `can show more (pagination)` — initial page shows 8 run cards; clicking 'Show more' loads remaining cards (total `numActiveRuns+2`).
  - `card has the basic info` — a run card shows run name, playbook name ('The playbook name'), and owner username.
  - `can click through` — clicking a run card navigates the RHS into that run's detail view showing 'Tasks' checklist section.
  - `dotmenu > can navigate to RDP` — run card dotmenu 'Go to overview' navigates to `/playbooks/runs/...?from=channel_rhs_dotmenu`.
  - `dotmenu > can navigate to PBE` — run card dotmenu 'Go to playbook' navigates to the Playbook Editor page showing the playbook's title.
  - `dotmenu > hides "Go to playbook" for standalone runs` — standalone (no-playbook) run's dotmenu has no 'Go to playbook' option but does have 'Move to a different channel'.
  - `dotmenu > hides "Go to playbook" for private playbooks without access` — viewer without playbook access sees no 'Go to playbook' option (but does see 'Go to overview') for the private-playbook run they participate in.
  - `dotmenu > can change linked channel` — moving the first run card to 'Town Square' via dotmenu reduces the current channel's run-card count by one (12→11 after pagination).
  - `dotmenu > navigation > stays at list even if one only linked run after moving run` — in a channel with only 2 runs, moving one run elsewhere leaves the RHS still showing the list view (not auto-navigating into detail) with 1 remaining card.
- **Notes**: uses `cy.wait(500/1000/5000)` in several tests (flaky patterns); large single-channel fixture with many run states supports multiple test scenarios — efficient but tightly coupled ordering (e.g. 'playbook-run-9' name assumptions).
