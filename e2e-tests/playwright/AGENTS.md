# Writing Playwright E2E Tests — Playbooks

This guide documents the conventions used by the Playwright suite in
`e2e-tests/playwright`. It is the **new** E2E suite, gradually replacing the
Cypress suite in `e2e-tests/cypress` (ignore Cypress conventions when writing
Playwright tests — they are a different framework with different idioms).

Read this before adding or modifying any file under `e2e-tests/playwright/tests`.

## Directory layout

```
e2e-tests/playwright/
  playwright.config.ts       # test runner config (baseURL, globalSetup, reporters)
  tests/
    helpers/                 # API-driven setup helpers (auth, bootstrap, client, team, user, playbook, run, ...)
    pages/                   # Page Object Model classes, one per screen/feature area
    playbooks/*.spec.ts       # feature specs
    smoke/*.spec.ts           # smoke specs
```

- `helpers/` = "how to set up test data and perform cross-cutting actions" (via
  REST API, using `page.request`).
- `pages/` = "how to interact with a given page/screen" (Page Object Model).
- `*.spec.ts` = the actual test cases: seed data with helpers, drive the UI
  through page objects, assert through page object expectation methods.

Keep this separation. Specs should read like a short script of `#` steps and
`*` assertions; they should rarely call `page.locator(...)` directly — that
belongs in a page object.

> **Hard rule: every spec must go through a Page Object.** A spec file that
> calls `page.getBy*`/`page.locator(...)` directly (instead of through a
> `tests/pages/*` class) is a **critical review failure**, not a style nit —
> block the PR. The one narrow exception is a single truly one-off
> `expect(...)` on something not worth promoting yet (see "Assertions"
> below); the *locators* themselves still belong in a page object. If the
> screen under test has no page object yet, add one — don't inline the
> interaction "just this once."
>
> This is enforced by the local ESLint plugin in `eslint-rules/` (rules
> `playbooks-e2e/*`, wired in `eslint.config.mjs` for `tests/**/*.spec.ts`,
> unit-tested via `npm run test:eslint-rules`, and run by `npm run check`).
> The following fail lint in a spec file:
> - building locators: `getBy*`, `locator`, `frameLocator`, `$`/`$$`, `waitForSelector`, including aliased or destructured forms;
> - refining locators: `.filter({...})`, `.first()`, `.last()`, `.nth()`, `.and()`, `.or()`;
> - legacy selector APIs: `page.click('#sel')`, `page.fill('#sel', ...)`;
> - fixed waits: `waitForTimeout`, `setTimeout`;
> - silent skips: `test.skip('title', fn)`, `test.describe.skip`, a reason-less `test.skip()`/`test.fixme()`, and `.only`.
>
> Don't silence these with `eslint-disable`. Move the locator into a page
> object. To change a rule, edit `eslint-rules/` and its tests.

## Running tests

```bash
cd e2e-tests/playwright
npm run playwright:test        # headless run
npm run playwright:test:headed # headed, for local debugging
npm run playwright:ui          # Playwright's UI mode (best for authoring/debugging)
npm run check                  # eslint
npm run check-types             # tsc --noEmit
```

CI runs `npm run test` against a server built from `make upload-to-server`
(see `.github/actions/playwright-e2e-test/action.yaml`). There's no
"`--browser chrome`" footgun as with Cypress — the config pins a single
`chromium` project.

## Anatomy of a good spec file

Use `tests/playbooks/edit_header.spec.ts` or `create_playbook.spec.ts` as the
reference template. A good spec has:

1. **Copyright header** (every file):
   ```ts
   // Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
   // See LICENSE.txt for license information.
   ```

2. **A short provenance/scope comment** under the header when porting from
   Cypress or otherwise worth explaining, e.g.:
   ```ts
   // Playwright port of the Cypress spec
   // e2e-tests/cypress/tests/integration/playbooks/playbooks/edit/header_spec.js.
   // Covers the playbook-editor header actions: rename, edit description, duplicate.
   ```

3. **One `test.describe` per logical feature**, named as a short phrase (not
   `domain > feature` like Cypress — just a readable sentence fragment):
   ```ts
   test.describe('playbook editor header', () => { ... });
   ```

4. **`test.beforeAll` for one-time, expensive seeding** shared across every
   test in the block (team, user, team membership). Use a *fresh browser
   context* (not the fixture `page`) inside `beforeAll`, and close it:
   ```ts
   test.beforeAll(async ({browser}) => {
       const context = await browser.newContext({baseURL});
       const page = await context.newPage();

       await loginAsAdmin(page);
       const team = await createTeam(page, 'pb-edit');
       const user = await createUser(page, 'pb-edit-user');
       await addUserToTeam(page, team.id, user.id);
       seededData = {teamName: team.name, teamId: team.id, user};

       await context.close();
   });
   ```
   Declare the shared state as a `let seededData: SomeInterface;` at
   `describe` scope with a typed interface — do not use loosely typed objects.

5. **Per-test setup inline at the top of each `test(...)`**, not in
   `beforeEach`, when each test needs its own freshly created resource (e.g. a
   playbook it will mutate). This avoids cross-test interference without the
   overhead of recreating the team/user per test:
   ```ts
   test('updates the playbook name', {tag: '@playbooks'}, async ({page}) => {
       const editor = new PlaybookEditorPage(page);

       // # Log in as the owning user and open a freshly created playbook's outline
       await loginAs(page, seededData.user.username, seededData.user.password);
       const playbook = await createPlaybook(page, seededData.teamId, `Rename Me ${Date.now()}`);
       await editor.goto(seededData.teamName, playbook.id);

       // # Rename the playbook
       await editor.rename('renamed playbook');

       // * The editor shows the updated name
       await editor.expectTitle('renamed playbook');

       // * The new name persists across a reload
       await page.reload();
       await editor.expectTitle('renamed playbook');
   });
   ```

6. **A `@objective` JSDoc comment above every `test()`**, optionally with a
   `@precondition` section when the test depends on seeded state that isn't
   obvious from the test body:
   ```ts
   /**
    * @objective Rename a playbook from the editor title menu and persist the change.
    */
   ```
   ```ts
   /**
    * @objective Hide the "Create New Playbook" dropdown entry from users without create permission.
    *
    * @precondition
    * The seeded user's team member role cannot create playbooks (requires a license).
    */
   ```

7. **`{tag: '@playbooks'}` on every `test()`** (second argument), so the suite
   can be filtered by tag later (`npx playwright test --grep @playbooks`).

8. **`#` / `*` comment convention inside tests** — same spirit as Cypress:
   - `// # <action>` before a step that does something (login, navigate, click).
   - `// * <expectation>` before an assertion (`expect...`, or a page-object
     `expect*` method).

9. **Graceful skips for license-gated behavior**, using an `err instanceof
   ApiError` check on the seeding call and `test.skip` in a `beforeEach`:
   ```ts
   let skipReason = '';
   test.beforeAll(async ({browser}) => {
       // ...
       try {
           const scheme = await createTeamScheme(page, '...');
           // ...
       } catch (err) {
           if (err instanceof ApiError && err.status === 501) {
               skipReason = 'Custom team schemes require an enterprise license (set MM_LICENSE).';
           } else {
               await context.close();
               throw err;
           }
       }
       await context.close();
   });

   test.beforeEach(() => {
       test.skip(Boolean(skipReason), skipReason);
   });
   ```

## Seeding data: always via API helpers, never through the UI

Almost all setup (teams, users, team membership, playbooks, runs, permission
schemes) should go through `tests/helpers/*.ts`, which call the Mattermost or
Playbooks REST API directly via `page.request`. Reasons:

- Much faster and more reliable than driving signup/creation UIs.
- Keeps specs focused on the behavior under test.
- Matches the pattern already established — don't reinvent it.

If a helper you need doesn't exist yet, add it to the appropriate
`tests/helpers/*.ts` file rather than inlining a raw `page.request.post(...)`
in the spec. Follow the existing style:

- Build the request with `requestedWith` spread into the options (the
  `X-Requested-With: XMLHttpRequest` header Mattermost requires to treat the
  request as same-origin/non-CSRF).
- Use `readJsonOrThrow<T>(response, 'message')` for the common
  "ok or throw with body" case.
- Use `throwApiError` / the `ApiError` class directly when a caller needs to
  branch on a specific HTTP status (e.g. a 501 license gate — see
  `createTeamScheme`).
- Use `uniqueSuffix()` / `slugify()` from `helpers/client.ts` to build
  collision-free names (team names, usernames) — see `createTeam`,
  `createUser`.
- Return typed interfaces (`Team`, `SeededUser`, `Playbook`, …), not `any`.

Example helper shape:

```ts
export async function createRun(page: Page, options: CreateRunOptions) {
    const response = await page.request.post('/plugins/playbooks/api/v0/runs', {
        ...requestedWith,
        data: {
            name: options.name,
            owner_user_id: options.ownerUserId,
            team_id: options.teamId,
            playbook_id: options.playbookId,
        },
    });

    if (response.status() !== 201) {
        throw new Error(`Unable to create run: ${response.status()} ${await response.text()}`);
    }
}
```

### Logging in

- `loginAsAdmin(page)` — logs in as sysadmin via API and ensures the admin
  has a team (used for seeding).
- `loginAs(page, username, password)` — logs in as any other user via API.
  Never log in by driving the Mattermost login form unless the test is
  specifically about the login UI.

Both set cookies on `page`'s browser context; no navigation is needed before
or after calling them. Navigate explicitly afterwards via a page object's
`goto(...)`.

### Deterministic, collision-free naming

Any test-created title/name that could collide across parallel runs/workers
must be unique:

- Prefer `uniqueSuffix()` (from `helpers/client.ts`) appended to a readable
  prefix: `` `PW Existing Playbook ${uniqueSuffix()}` ``.
- `Date.now()` is also used in a few specs (`` `Rename Me ${Date.now()}` ``) —
  acceptable, but prefer `uniqueSuffix()` for anything that might be created
  more than once within the same millisecond (e.g. in a tight loop or
  `beforeAll`).
- Never hardcode a name like `'My Test Playbook'` with no suffix.

## Page objects (Page Object Model)

Every screen/feature area gets a class in `tests/pages/`, instantiated with
the current `page` at the top of each test:

```ts
export class PlaybookEditorPage {
    readonly page: Page;
    readonly title: Locator;
    // ... more locators, initialized once in the constructor

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByTestId('playbook-editor-title');
        // ...
    }

    async goto(teamName: string, playbookId: string) { /* ... */ }

    async rename(newTitle: string) { /* ... action ... */ }

    async expectTitle(playbookTitle: string) { /* ... assertion, uses expect() ... */ }
}
```

Rules:

- **Locators are declared once**, as `readonly` fields initialized in the
  constructor from `page.getBy*`. Don't call `page.getByTestId(...)` inline
  inside test specs.
- **Prefer accessibility-first locators** in this priority order:
  1. `page.getByRole('button'/'link'/'dialog'/'menu'/'menuitem'/..., {name: ...})`
     — for interactive/semantic elements. This is the default choice: it
     reflects what a real user/assistive tech perceives, and it doubles as an
     a11y regression check (if the role/name disappears, the locator fails).
  2. `page.getByLabel(...)` / `page.getByPlaceholder(...)` — for form fields
     without a strong role-based match.
  3. `page.getByText(...)` — for static content with no better handle.
  4. `page.getByTestId('...')` — last resort, only when the element has no
     accessible role/name/text to hook into (e.g. a purely decorative
     container used just for layout/test hooks). If you reach for this,
     consider first whether the component should get a proper `aria-label`/
     role instead of a `data-testid`.
  - **Changing the webapp to make an element testable**: add accessibility
    attributes only (`aria-label`/`-labelledby`/`-describedby`, `role`, `alt`,
    label association), with i18n for any visible or announced string. Never add
    a `data-testid` for a new test. During the Cypress migration this is a hard
    rule, together with "no Go changes" (see `docs/MIGRATION_RUNBOOK.md`).
  - Avoid raw CSS/class selectors entirely, especially anything that looks
    like a library-generated class (`react-select__...`,
    `.Select-...`, emotion hashes). These break across library upgrades.
  - Existing code uses `getByTestId` more heavily than this guidance
    recommends (ported from Cypress, which leaned on `data-testid`/`findByTestId`
    heavily). When touching a page object, prefer migrating the locator to an
    a11y-based one if an equivalent role/name/label exists; otherwise leave it
    and note it as a candidate for follow-up rather than changing it as a
    drive-by.
- **Finding the right locator**: the Playwright UI mode / codegen
  (`npm run playwright:ui`, `npx playwright codegen <url>`) and the
  `agent-browser` skill (`agent-browser skills get core`, accessibility-tree
  snapshots) both show the roles and accessible names the app really renders.
  Use them to discover the locator, then write it as a role/label locator in a
  page object. Never paste generated CSS selectors.
- **Composite/filtered locators belong in a small documented method**, not a
  one-off inline expression in the spec. E.g. `templateCard(title)` in
  `playbooks_page.ts` filters a `getByRole('button')` by a nested heading, with
  a comment explaining why that shape was chosen:
  ```ts
  // A preset template is rendered as a clickable card (role="button") whose
  // heading is the template title. Selecting it instantly creates a playbook
  // from that template and routes to the new playbook's outline.
  templateCard(templateTitle: string): Locator {
      return this.page.getByRole('button').filter({
          has: this.page.getByRole('heading', {name: templateTitle, exact: true}),
      });
  }
  ```
- **Navigation helpers (`goto`) must leave the app in a stable, loaded
  state** before returning — wait on a locator that only appears once the
  target view is ready, rather than returning immediately after
  `page.goto(...)`:
  ```ts
  async goto(teamName: string) {
      await this.page.goto(`/${teamName}/channels/town-square`);

      // Wait for the team's sidebar to render (sets the current team) before
      // leaving for the product.
      await this.page.getByRole('link', {name: 'town square public channel'}).waitFor();
      await this.page.goto('/playbooks');
      await this.playbooksLHSButton.waitFor();
  }
  ```
  Note the pattern of visiting a team channel first (to set the "current
  team" in the webapp) before navigating to a team-agnostic product URL like
  `/playbooks/...`.
- **Expectations are methods on the page object**, named `expect*`, and use
  `expect(...)` from `@playwright/test` internally (imported at the top of
  the page object file). Specs call `await editor.expectTitle(...)`, never
  `await expect(editor.title).toContainText(...)` directly in the spec.
  Keep each `expect*` method asserting one coherent thing; add a short
  comment when the "why" isn't obvious (see
  `expectCreatePlaybookDropdownOpen`'s comment on guarding against vacuous
  "hidden" assertions).
- **Don't leak locator construction logic into specs.** If a spec needs a new
  kind of lookup, add a method or locator to the page object, even if it's
  currently used by only one test.

## Waiting and flakiness

- **Never use fixed-time waits** (`page.waitForTimeout(...)`). Playwright's
  auto-waiting `expect(...)` and locator actions (`.click()`, `.fill()`,
  etc.) already retry until the element is actionable/visible — use those.
- **Wait for state, not time**, when an action triggers an async UI
  transition: wait on a locator (`await this.title.waitFor()`) that only
  appears/changes once the transition is complete, as in the `goto()`
  examples above.
- **Modals/overlays**: assert `.toHaveCount(0)` (page object pattern already
  used for `expectCreatePlaybookButtonHidden`) rather than `not.toBeVisible()`
  when the component unmounts on close instead of just hiding.
- When you need to wait for a specific network call to settle, use
  `page.waitForResponse(...)`/`page.route(...)` rather than guessing a
  timeout — none of the current suite needs this yet, but if you add it,
  keep the same no-fixed-wait principle.

## Assertions

- Specs don't call `expect()` directly in most cases — they call a
  page-object `expect*` method. It's fine to call `expect()` directly in a
  spec for something truly one-off and not worth promoting to a page object
  method yet, but default to adding the method. Even in that one-off case,
  the **locator itself must still come from the page object** (a `readonly`
  field or a method returning a `Locator`) — the hard rule against inline
  `page.getBy*`/`page.locator(...)` in specs has no exception.
- Use the most specific locator check available: `toContainText`,
  `toHaveText`, `toBeVisible`, `toHaveCount(0)`, `toHaveURL(regex)`. Avoid
  generic `toBeTruthy()`/`toBeDefined()` on DOM state.

## Types and lint

- `strict`-friendly TypeScript: give every exported function/interface
  explicit types; avoid `any`. Helpers return typed interfaces (`Team`,
  `SeededUser`, `Playbook`, `Role`, `Scheme`, ...).
- Run `npm run check` (eslint, `eslint-plugin-playwright` recommended rules)
  and `npm run check-types` (`tsc --noEmit`) before considering a change
  done — both are part of `make check-style` / `pb-lint`.
- Follow existing import grouping: `@playwright/test` types first, then
  relative imports from `../helpers/*` and `../pages/*`.

## Mattermost core vs plugin page objects

The Playbooks plugin renders UI *inside* the Mattermost webapp. Two separate
layers of page objects reflect that boundary:

| Layer | Location | Covers |
|---|---|---|
| **Mattermost core** | `tests/pages/mattermost/` | Channel sidebar, post textbox, post list, app bar icons, core RHS (thread view), System Console |
| **Plugin** | `tests/pages/*.ts` | Playbooks product: playbook editor, run details page, channel RHS panel, run modal, status update dialog |

**Rule: plugin page objects must not locate core Mattermost UI directly.**
All core-UI interactions (navigating to channels, posting messages, opening
app bar icons, checking ephemeral replies, etc.) go through the `MattermostCore`
facade (`tests/pages/mattermost/index.ts`). Plugin page objects compose it
in their constructor:

```ts
import {MattermostCore} from './mattermost';

export class ChannelRhs {
    readonly mm: MattermostCore;
    constructor(page: Page) {
        this.mm = new MattermostCore(page);
        // ...
    }
    async gotoChannelAndOpenRhs(teamName: string, channelName: string) {
        await this.mm.channels.goto(teamName, channelName); // ← core
        await this.openPlaybooksRhs();                      // ← plugin
    }
}
```

Specs may also instantiate `MattermostCore` directly when they need core UI
outside a plugin page object:

```ts
const mm = new MattermostCore(page);
await mm.channels.goto(teamName, 'town-square');
await mm.postList.expectLastPostContains('hello');
await mm.appBar.openPlaybooks();
await mm.systemConsole.gotoSiteStatistics();
```

**Stable Mattermost hooks used in the core layer** (documented here, not in
plugin page objects or specs):
- `#post_textbox` — the post composition textbox id (Mattermost assigns this
  directly, no accessible name is exposed).
- `#app-bar-icon-<pluginId>` — app bar icon id assigned by the Mattermost
  framework when a plugin registers via `registerAppBarComponent`.
- `data-testid="reply-icon"` — the Reply button in the post action toolbar.
- `data-testid="postMessageText_<id>"` — each post's message body.
- `.post.post--ephemeral` — CSS class Mattermost adds to ephemeral posts.

These hooks live **only** inside `tests/pages/mattermost/`; they are wrapped
and documented there so the rest of the suite never depends on them directly.

## Checklist for a new spec

- [ ] Copyright header, and a "ported from Cypress spec X" comment if
      applicable.
- [ ] One `test.describe('<feature>', ...)` per file (or one per logical
      grouping within the file, as `create_playbook.spec.ts` does for
      "creation" vs "creation without permission").
- [ ] Expensive/shared seeding in `test.beforeAll` with its own
      `browser.newContext()` + `context.close()`; cheap/per-test seeding
      inline in the test body.
- [ ] Shared state typed via an interface and a single `let seededData: X;`.
- [ ] Every `test()` has `{tag: '@playbooks'}` and an `@objective` (plus
      `@precondition` if needed) JSDoc comment.
- [ ] `// #` / `// *` comments mark steps vs assertions.
- [ ] All data seeding goes through `tests/helpers/*`; new helpers follow the
      existing `requestedWith` / `readJsonOrThrow` / typed-return style.
- [ ] All UI interaction and assertions go through a `tests/pages/*` Page
      Object; no raw `page.locator`/`page.getBy*` calls in the spec itself.
- [ ] Locators prefer `getByRole`/`getByLabel` > `getByText` > `getByTestId`
      (a11y-first; `getByTestId` as last resort); no library-generated CSS
      class selectors.
- [ ] All test data names are collision-safe (`uniqueSuffix()` or
      `Date.now()`), never hardcoded.
- [ ] No fixed-time waits; waits are on state (a locator appearing/changing).
- [ ] `npm run check` and `npm run check-types` pass; `npm run
      playwright:test` passes locally.
