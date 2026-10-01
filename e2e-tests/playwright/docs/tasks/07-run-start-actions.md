# Task 07: Run start side effects of playbook actions (invite, default owner, broadcast, webhook)

**Task id**: `run-start-actions` · **Kind**: playwright

## Target

- `tests/runs/run_start_actions.spec.ts`

## What to do

Target ~5 tests. The Cypress file never ran (its name doesn't match `specPattern`), so first confirm each behavior against the running app. A confirmed product bug becomes `test.fixme` (hard rule 3).
Here, playbook config is seeded via API (the editor UI for these settings is covered by editor-run-settings); this task asserts what happens **when a run starts**.
- Invite members: table `{off + none, on + 2 invited, off + 2 invited}` -> run channel first post shows who was added. Invited user removed from the team -> bot posts "Failed to invite the following users".
- Default owner: table `{off/no owner -> creator, on/no owner -> creator, on/invited owner -> owner, on/uninvited owner -> owner, on/owner = creator -> creator}` -> RHS owner. One test body over the table.
- Broadcast on start: `{enabled -> announcement "ran the <playbook> playbook" in broadcast channel, disabled -> nothing}`; deleted broadcast channel -> "Failed to broadcast run creation" bot post.
- Creation webhook: don't depend on httpbin.org. Assert the failure post appears for an unreachable URL (e.g. `http://127.0.0.1:9/`). Only assert the success path (no failure post) if a reachable endpoint is available from the Mattermost server; otherwise document why it's omitted.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/playbook_run_actions.js` | all tests except "when a playbook run is finished > retrospective is disabled" (already covered by the retrospective task) |

### `channels/playbook_run_actions.js`

> Scope: all tests except "when a playbook run is finished > retrospective is disabled" (already covered by the retrospective task)

- **Area**: run start side effects of playbook actions (invite members, default owner, broadcast, creation webhook) + finish with retro disabled — observed in the run channel posts, RHS and broadcast channel
- **Setup**: team/user + custom sysadmin + 2 extra team users; a public channel; one playbook per test configured via API (`invitedUserIds`/`inviteUsersEnabled`, `defaultOwnerId`/`defaultOwnerEnabled`, `broadcastChannelIds`/`broadcastEnabled`, `webhookOnCreationURLs`/`webhookOnCreationEnabled`, `retrospectiveEnabled`), run started via API.
- **Tests**:
  - `when a playbook run starts > invite members setting > with no invited users and setting disabled` — run channel first post is only "You were added to the channel by @playbooks." (nobody else invited).
  - `... > invite members setting > with invited users and setting enabled` — first post lists both invited users ("2 others" expands to @user0, @user1) "added to the channel by @playbooks".
  - `... > invite members setting > with invited users and setting disabled` — invited users configured but toggle off: nobody invited.
  - `... > invite members setting > with non-existent users` — invited user removed from the team before the run starts: bot posts "Failed to invite the following users: @<user>".
  - `... > default owner setting > defaults to the creator when no owner is specified` — RHS Owner shows the creator (setting off, no owner).
  - `... > default owner setting > defaults to the creator when no owner is specified, even if the setting is enabled` — setting on but empty owner id → creator is owner.
  - `... > default owner setting > assigns the owner when they are part of the invited members list` — RHS Owner = configured default owner (also invited).
  - `... > default owner setting > assigns the owner even if they are not invited` — RHS Owner = configured default owner (not invited, invite off).
  - `... > default owner setting > assigns the owner when they and the creator are the same` — RHS Owner = creator = configured owner.
  - `... > broadcast channel setting > with channel configured and setting enabled` — broadcast channel's last post contains the run name and "@user ran the <playbook> playbook."
  - `... > broadcast channel setting > with channel configured and setting disabled` — broadcast channel gets no run announcement.
  - `... > broadcast channel setting > with non-existent channel` — broadcast channel deleted before run start: bot posts "Failed to broadcast run creation to the configured channel." in the run channel.
  - `... > creation webhook setting > with webhook correctly configured and setting enabled` — run channel has no "Playbook run creation announcement through the outgoing webhook failed" post (webhook to https://httpbin.org/post).
  - `when a playbook run is finished > retrospective is disabled` — finishing a run of a retro-disabled playbook posts "marked <playbook> as finished" and no retrospective-reminder.
- **Notes**: **Never executed**: the file name doesn't match Cypress `specPattern` (`tests/integration/**/*_spec.{js,ts}`), so this is dormant coverage, not current coverage. Still worth porting: it is the only place run-start side effects of playbook actions are asserted. The webhook test depends on external httpbin.org. The finish/retro-disabled case duplicates `edit/retrospective_toggle_spec` "finishing a run with retrospective disabled posts no reminder".
