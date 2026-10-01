# Task 40: Status update posts and reminder posts in channels

**Task id**: `status-update-posts` · **Kind**: playwright

## Target

- `tests/channels/status_update_posts.spec.ts`

## What to do

Target ~5 tests.
- custom_run_update renders in the run channel and when permalinked elsewhere.
- Renders (markdown) in the Playbooks bot DM for a participant.
- Reminder post: table `{participant -> text + Post update button, channel member -> text}` x `{channel, Threads view}`; snooze deletes the interactive post.
- Reminder timing: use a 1-2s reminder and `expect.poll`/`toBeVisible({timeout})`, never a fixed sleep. CRT config via config helper.

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
| `e2e-tests/cypress/tests/integration/playbooks/channels/post_type_components_spec.js` | non-skipped tests |
| `e2e-tests/cypress/tests/integration/playbooks/channels/update_post_dm_spec.js` | all tests |
| `e2e-tests/cypress/tests/integration/playbooks/channels/update_request_post_spec.js` | all tests |

### `channels/post_type_components_spec.js`

> Scope: non-skipped tests

- **Area**: channel post > custom post type rendering for status updates (`custom_run_update`)
- **Setup**: team/user, public playbook with `createPublicPlaybookRun: true` and a run named 'Test Run'; an extra 'Other Channel'.
- **Tests**:
  - `update post (custom_run_update) > displays in run channel` — posting a status update via API shows a channel post with text "{username} posted an update for {runName}" and the update message.
  - `update post (custom_run_update) > displays when permalinked in a different channel` — posting a permalink (in another channel) to a status-update post renders the same custom post type content (update text) correctly outside the original channel.
  - `update post (custom_run_update) > [SKIPPED] displays when permalinked in a different channel, even if not a member of the original channel` — (skipped, MM-63645) intended to verify permalinked status-update post renders correctly even after leaving the original run channel.

### `channels/update_post_dm_spec.js`

> Scope: all tests

- **Area**: status update post rendering in DMs from Playbooks bot
- **Setup**: 2 users (owner userA, participant userB) added to one public run; no viewport override.
- **Tests**:
  - `channels > status update posts in DMs > status update posts render correctly in DMs from playbooks bot` — userA posts a status update with markdown via API, userB visits Playbooks bot DM channel and sees markdown-rendered update text and "@userA posted an update for <run name>" line (channel/DM post surface).

### `channels/update_request_post_spec.js`

> Scope: all tests

- **Area**: status update reminder/request interactive post (channel, RHS thread, Threads view)
- **Setup**: CRT enabled (`ThreadAutoFollow`, `CollapsedThreads: default_on`); one playbook, two public runs sharing the same channel; testParticipant owns both runs, testChannelMemberOnly is channel member but not run participant; status updates posted with 1–2s reminders; `cy.wait(TIMEOUTS.TWO_SEC)` to let reminder post appear.
- **Tests**:
  - `channels > update request post > displays interactive post > as a participant > in the run channel` — reminder post in run channel shows "@user, please provide a status update for <run>" text and a "Post update" button.
  - `channels > update request post > displays interactive post > as a participant > reset reminder` — clicking snooze dropdown (StyledSelect) and selecting an option causes the update-request post to show "(message deleted)", removing the interactive button.
  - `channels > update request post > displays interactive post > as a participant > in threads view` — replying to the reminder post surfaces it in Threads view (ThreadItem) with same text; opening it shows RHS post retaining "Post update" button.
  - `channels > update request post > displays interactive post > as a channel member only > in the run channel` — non-participant channel member also sees the reminder text in the run channel (no assertion on button visibility).
  - `channels > update request post > displays interactive post > as a channel member only > in threads view` — same thread-view visibility check for a channel-member-only (non-participant) user, without checking for the update button.
- **Notes**: Uses `cy.wait(TIMEOUTS.TWO_SEC)` fixed wait for reminder posts — timing-dependent pattern.
