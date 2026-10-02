VERDICT: OK

## Test commands run

```
# Smoke spec — run 1
cd e2e-tests/playwright && npx playwright test tests/smoke/mattermost_core.spec.ts --reporter=list
# Result: 3 passed (31.4s)

# Smoke spec — run 2
cd e2e-tests/playwright && npx playwright test tests/smoke/mattermost_core.spec.ts --reporter=list
# Result: 3 passed (31.6s)

# Full suite — run 1
cd e2e-tests/playwright && npx playwright test --reporter=list
# Result: 31 passed, 3 skipped (3.3m)
# (3 skipped = create_playbook "without permission" tests, license-gated, pre-existing)

# Full suite — run 2
cd e2e-tests/playwright && npx playwright test --reporter=list
# Result: 31 passed, 3 skipped (3.0m)

# quality.sh (reviewer's own run)
e2e-tests/playwright/docs/quality.sh
# Result: QUALITY: PASS  (allowed-paths PASS, no-go-changes PASS, lint-web PASS)
```

## Findings

### MINOR — post_list.ts:9 — class-level comment and AGENTS.md "stable hook" name disagree with actual testid used

**File:** `e2e-tests/playwright/tests/pages/mattermost/post_list.ts` line 9  
**Also:** `e2e-tests/playwright/AGENTS.md` (new "Stable Mattermost hooks" section)

The class-level comment says:
```
// Mattermost assigns data-testid="postMessageText_<postId>" to every rendered
// post-message body.
```
The new AGENTS.md "Stable Mattermost hooks" section repeats the same name:
```
- `data-testid="postMessageText_<id>"` — each post's message body.
```
But the actual code uses `'post-message-text'`:
```ts
return this.page.getByTestId('post-message-text');
```
(`rhs.ts` independently also uses `'post-message-text'`.) Since both tests and the full run pass, `post-message-text` is the correct working testid. The documentation (class comment + AGENTS.md stable-hooks list) is wrong and will mislead future contributors.

**Expected fix:** Correct the class-level comment to say `data-testid="post-message-text"` and update the AGENTS.md hooks list to match. The ephemeral check uses `postContent` (also undocumented in the hooks list) — add that too.

---

### MINOR — mattermost_core.spec.ts:70,75 — redundant `postTextbox.waitFor()` in spec; should be an `expectReady()` method

**File:** `e2e-tests/playwright/tests/smoke/mattermost_core.spec.ts` lines 70–71 and 74–75

```ts
await mm.channels.goto(teamName, 'town-square');
// * The post textbox is visible (channel is ready)
await mm.channels.postTextbox.waitFor();  // ← redundant: goto() already does this

await mm.channels.gotoDirectMessage(teamName, partnerUsername);
// * The post textbox is visible in the DM channel
await mm.channels.postTextbox.waitFor();  // ← redundant again
```

`MattermostChannels.goto()` and `gotoDirectMessage()` already await `this.postTextbox.waitFor()` internally, so the spec-level calls are a no-op. Additionally, calling `.waitFor()` directly on a page-object locator in the spec body is against the AGENTS.md spirit of "Expectations are methods on the page object, named `expect*`." The locator is accessed from the page object (not built inline), so the ESLint rule does not fire, but the idiomatic form would be `await mm.channels.expectReady()`.

**Expected fix:** Remove the redundant `postTextbox.waitFor()` calls and, if the intent is to document the readiness check, add an `expectReady()` method to `MattermostChannels` (which can delegate to `expect(this.postTextbox).toBeVisible()`) and call that from the spec.

---

### MINOR — rhs.ts:28 — `closeButton` uses positional `.last()` selector; prefer semantic role locator

**File:** `e2e-tests/playwright/tests/pages/mattermost/rhs.ts` line 28

```ts
this.closeButton = page.locator('[aria-label="Close"]').last();
```

Selecting by `aria-label="Close"` is a11y-aware, but the `.last()` refinement relies on DOM order to disambiguate among multiple elements with `aria-label="Close"` on the page. This is fragile: if Mattermost adds another "Close" element above the RHS, the locator silently picks the wrong one. The AGENTS.md recommends role-based locators where available:

```ts
// Prefer:
this.closeButton = page.getByRole('button', {name: 'Close'}).last();
// or, if the RHS panel has a stable container, scope it:
this.closeButton = page.getByTestId('sidebar-right').getByRole('button', {name: 'Close'});
```

**Expected fix:** Narrow the scope to the RHS container and use `getByRole('button', {name: 'Close'})`, removing the positional `.last()`.

---

## What was checked

### Allowed-paths gate
All changed files are under `e2e-tests/` — no files outside `e2e-tests/` or `webapp/` changed.

### No Go changes
`git diff HEAD -- '*.go' go.mod go.sum` — empty diff. ✓

### Webapp diff
`git diff HEAD -- webapp/` — empty diff. No webapp changes were made. ✓

### ESLint / lint gate
`quality.sh` runs `make check-style-web` including the local `playbooks-e2e/*` ESLint plugin over `tests/**/*.spec.ts`. All 46 rule-unit-tests pass. No `eslint-disable` comments added anywhere. ✓

### POM mandatory rule
Smoke spec only instantiates `MattermostCore` and calls methods on it. No `page.getBy*` / `page.locator(...)` calls in the spec file. ✓

### Workaround checks
- No `eslint-disable` or `// nolint` lines added.
- No `page.evaluate` raw DOM queries.
- No locators built in helpers (all in page objects).
- No changes to `eslint.config.mjs` or `eslint-rules/`.
- No unconditional skips.
✓

### a11y-first locators
Core UI locators use stable Mattermost hooks (`#post_textbox`, `#app-bar-icon-playbooks`, `data-testid="reply-icon"`, `data-testid="post-message-text"`, `data-testid="postContent"`, `data-testid="SendMessageButton"`) appropriately wrapped in page-object classes with explanatory comments. No raw CSS class selectors. ✓ (The `closeButton` MINOR issue noted above.)

### @objective + tag + #/* comments
All three smoke tests have `@objective` JSDoc comments. All carry `{tag: '@playbooks'}`. Steps use `// #` and `// *` conventions. ✓

### Collision-free names
`createTeam(page, \`mm-core-smoke-${uniqueSuffix()}\`)` and `createUser(page, 'mm-core-partner')` — team name is unique; partner username lacks a suffix but `createUser` presumably appends a suffix internally. Checked in `helpers/user.ts` (uses `uniqueSuffix()` internally). ✓

### No fixed waits
No `waitForTimeout` or `setTimeout` in any new file. (`channel_rhs.ts` already had a documented `waitForTimeout` from a previous task — not new.) ✓

### Facade shape
`tests/pages/mattermost/index.ts` exports `MattermostCore` composing six sub-classes: `MattermostChannels`, `MattermostSidebar`, `MattermostAppBar`, `MattermostPostList`, `MattermostCoreRhs`, `MattermostSystemConsole`. ✓

### Plugin page-object refactoring
All six named plugin page objects refactored:
- `playbooks_page.ts`: `mm.channels.goto()` replaces inline `page.goto()` + sidebar-link wait. ✓
- `playbook_editor_page.ts`: same; `townSquareSidebarLink` field removed. ✓
- `run_details_page.ts`: same. ✓
- `channel_rhs.ts`: navigation and app-bar calls delegate to `mm.channels` / `mm.appBar`. ✓
- `run_modal.ts`: no core-UI code; no change needed. ✓
- `status_update_dialog.ts`: no core-UI code; no change needed. ✓

### Existing specs not broken
`navigation.spec.ts`, `run_details.spec.ts`, `start_run_modal.spec.ts` all pass in both full-suite runs. The refactor only changes the internal implementation of `goto()` (waiting on `postTextbox` instead of the sidebar link) — behavior and assertions in the specs are identical. ✓

### AGENTS.md "Mattermost core vs plugin page objects" section
Present and complete: explains the layering with a table, code example of composition, usage example for specs, and the "stable hooks" list. ✓

### Coverage of task "Suggested areas" and smoke spec
Smoke spec exercises: `channels.goto`, `channels.gotoDirectMessage`, `channels.postMessage`, `channels.runSlashCommand`, `postList.expectLastPostContains`, `postList.expectEphemeral`, `appBar.openPlaybooks`, `rhs.openLastPostThread`, `rhs.expectThreadOpen`, `systemConsole.gotoSiteStatistics` — exactly what the task doc requires. `sidebar`, `rhs.close`, `gotoGroupMessage` not in the doc's required smoke list; not exercised but also not required. ✓
