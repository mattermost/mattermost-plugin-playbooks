# Task 05: MattermostCore page object: everything that belongs to Mattermost, not the plugin

**Task id**: `mattermost-core-pom` · **Kind**: playwright

## Target

- `tests/pages/mattermost/*.ts`
- `tests/pages/mattermost/index.ts (MattermostCore facade)`
- `tests/smoke/mattermost_core.spec.ts`

## What to do

Create one page-object layer for **Mattermost core UI** (anything the Playbooks plugin doesn't render), so plugin page objects and specs never locate core UI themselves. This is a prerequisite for all later tasks.

**Shape**
- `tests/pages/mattermost/` holds one class per core area, plus a facade `MattermostCore` (`tests/pages/mattermost/index.ts`) that composes them: `const mm = new MattermostCore(page); await mm.channels.goto(team, 'town-square'); await mm.postList.expectLastPostContains('...')`. Keep the API small and typed; add only what is used now or clearly needed by the remaining tasks (listed below).
- Suggested areas, based on the Cypress usage counts:
  - **channels** (center channel): `goto(teamName, channelName)` that waits until the team/channel is ready (it replaces the "visit town-square + wait for sidebar link" code duplicated in 4 page objects), `gotoDirectMessage(teamName, username)`, post textbox, `postMessage(text)` (= `uiPostMessageQuickly`, 99 uses), `runSlashCommand(cmd)`, slash-command autocomplete suggestions.
  - **postList**: last/first/nth post (`getLastPostId` etc.), `expectEphemeral(text)` (= `verifyEphemeralMessage`, 52 uses), system messages, post by id, post dot menu (`clickPostDotMenu`: delete, permalink), and interactive post buttons/selects as seen by core (attachments).
  - **sidebar** (LHS): channel links, switch channel, categories, DM/GM entries, Threads entry.
  - **channelHeader / appBar**: app bar icons (incl. the plugin's icon, located by its accessible name), legacy channel-header plugin button, tooltips (`uiGetToolTip`).
  - **rhs (core)**: thread view (`postMessageReplyInRHS`), Saved messages, close RHS. Only the generic RHS container; the Playbooks RHS content stays in `ChannelRhs`.
  - **threads**: global Threads view (CRT) items.
  - **modals**: generic confirm modal and interactive dialog (apps/legacy dialog used by `/playbook run`): fields, errors, submit/cancel.
  - **systemConsole**: navigate to a page (Site Statistics for the analytics task).
- API-level core actions that aren't UI (config patch, post as another user) stay in `tests/helpers/` (e.g. `postMessageAs` in a `post.ts` helper); don't put API calls in page objects.

**Refactor**
- Move every core-UI locator currently in plugin page objects (`playbooks_page.ts`, `playbook_editor_page.ts`, `run_details_page.ts`, `channel_rhs.ts`, `run_modal.ts`, `status_update_dialog.ts`, and anything added by the tasks done before this one) into the new classes. Plugin page objects keep only plugin UI and use `MattermostCore` for the rest (constructor composition: `this.mm = new MattermostCore(page)`).
- Existing specs must keep passing unchanged in behavior. Re-run all specs touched by the refactor.

**Rules**
- a11y-first locators. Core Mattermost markup isn't ours: hard rule 2 (webapp a11y attributes only) applies to *this* repo's webapp only. If core UI has no accessible name, use the most stable core hook available (ids/testids Mattermost itself uses, such as `#post_textbox` or `postMessageText_<id>`), wrapped and documented inside the core page object, never in plugin page objects or specs.
- Document the layering in `e2e-tests/playwright/AGENTS.md` (new short section "Mattermost core vs plugin page objects"): core UI only through `tests/pages/mattermost/`; plugin page objects must not locate core UI.
- Use the agent-browser skill if needed to read the real core accessibility tree.

**Smoke spec** `tests/smoke/mattermost_core.spec.ts` (~3 tests) exercising each public method once: navigate to a channel and a DM, post a message and assert it's the last post, run a slash command that produces an ephemeral post (e.g. `/playbook info` outside a run channel), open a thread reply in the RHS, open the app bar Playbooks icon, open System Console > Site Statistics.

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

## Definition of done

1. Target spec(s) exist and pass locally: `cd e2e-tests/playwright && npx playwright test <spec> --reporter=list` (server at `MM_SERVICESETTINGS_SITEURL`, default `http://localhost:8065`, plugin deployed with `make deploy` if you added webapp a11y attributes).
2. Run it a second time to check stability (`--repeat-each=2` is fine).
3. `e2e-tests/playwright/docs/quality.sh` prints `QUALITY: PASS` (log saved as `docs/tasks/reviews/<task-id>.attempt-<n>.quality.log`). If it redeployed the plugin, re-run step 1 afterwards.
4. At the top of the spec, a comment lists the Cypress spec(s) it replaces (and which parts).
