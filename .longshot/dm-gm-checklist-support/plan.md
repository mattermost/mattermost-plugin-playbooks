# DM/GM Checklist Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable checklists in DM/GM channels while gating playbook runs from DM/GM creation.

**Architecture:** Add a server-side gate rejecting playbook runs (PlaybookID != "") in DM/GM channels. Mirror the gate in the webapp UI by hiding "Run a playbook" and filtering DM/GM from the channel selector in playbook run contexts. Fix DM/GM URL construction bugs in server webhook/reminder code and webapp backstage links.

**Tech Stack:** Go (server API + service layer), React/TypeScript (webapp components), Redux selectors, styled-components

**Spec:** `.longshot/dm-gm-checklist-support/spec.md`

---

### Task 1: Server-side gate — reject playbook runs in DM/GM

**Files:**
- Modify: `server/api/playbook_runs.go:507` (inside `if playbookRun.ChannelID != ""` block)

- [ ] **Step 1: Add gate inside the channel validation block**

In the shared `createPlaybookRun()` helper, the channel is resolved inside `if playbookRun.ChannelID != ""` (line 494). The TeamID override chain ends at line 507. Add the gate **before the closing `}` at line 508** (still inside the `if ChannelID != ""` block, where `channel` is guaranteed non-nil):

```go
		// Only checklists (no playbook) are allowed in DM/GM channels.
		// Playbook runs in DM/GM will be supported in a future release.
		if channel.IsGroupOrDirect() && playbookRun.PlaybookID != "" {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook runs are not supported in direct or group message channels")
		}
```

The full block after the edit should read:
```go
	if playbookRun.ChannelID != "" {
		channel, err = h.pluginAPI.Channel.Get(playbookRun.ChannelID)
		// ... error handling ...

		// For DM/GM channels, TeamID is always empty
		if channel.IsGroupOrDirect() {
			playbookRun.TeamID = ""
		} else if playbookRun.TeamID == "" {
			playbookRun.TeamID = channel.TeamId
		} else if channel.TeamId != playbookRun.TeamID {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "channel not in given team")
		}

		// Only checklists (no playbook) are allowed in DM/GM channels.
		if channel.IsGroupOrDirect() && playbookRun.PlaybookID != "" {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook runs are not supported in direct or group message channels")
		}
	}
```

**Why inside the block:** `channel` is only assigned when `ChannelID != ""`. Placing the gate outside would require a `channel != nil` guard. Inside the block, `channel` is guaranteed non-nil.

- [ ] **Step 2: Verify build**

Run: `cd server && go build ./...`

- [ ] **Step 3: Commit**

```bash
git add server/api/playbook_runs.go
git commit -m "feat(api): gate playbook runs in DM/GM channels"
```

---

### Task 2: Fix DM/GM channel URL construction — server

All three locations use `/messages/@{channel.Id}` which is wrong. The `@` prefix is for usernames, not channel IDs. For simplicity, use `/messages/{channel.Id}` (no `@`) for both DM and GM — Mattermost routes `/messages/{channelId}` correctly for both channel types.

**Spec deviation note:** The spec suggests using `/messages/@{username}` for DMs (matching the webapp pattern) and `/messages/{channelId}` for GMs. This plan simplifies both to `/messages/{channelId}` to avoid extra API calls to resolve DM participant usernames in server-side code. The webapp uses `@username` for DMs because it already has the teammate object in scope; the server would need an additional `GetChannelMembers` call. The channel ID format works for both and keeps the fix minimal.

**Files:**
- Modify: `server/app/reminder.go:143`
- Modify: `server/app/playbook_run_service.go:329,1027`

- [ ] **Step 1: Fix reminder URL**

In `server/app/reminder.go`, line 143, change:

```go
		message = fmt.Sprintf("Status update is overdue for [%s](/messages/@%s?telem_action=todo_overduestatus_clicked&telem_run_id=%s&forceRHSOpen) (Owner: @%s)\n",
			channel.DisplayName, channel.Id, playbookRun.ID, ownerUserName)
```

to:

```go
		message = fmt.Sprintf("Status update is overdue for [%s](/messages/%s?telem_action=todo_overduestatus_clicked&telem_run_id=%s&forceRHSOpen) (Owner: @%s)\n",
			channel.DisplayName, channel.Id, playbookRun.ID, ownerUserName)
```

(Remove the `@` before `%s`.)

- [ ] **Step 2: Fix webhook URL in sendWebhooksOnCreation**

In `server/app/playbook_run_service.go`, line 329, change:

```go
		channelURL = fmt.Sprintf("%s/messages/@%s", *siteURL, channel.Id)
```

to:

```go
		channelURL = fmt.Sprintf("%s/messages/%s", *siteURL, channel.Id)
```

- [ ] **Step 3: Fix webhook URL in sendWebhooksOnUpdateStatus**

In `server/app/playbook_run_service.go`, line 1027, change:

```go
		channelURL = fmt.Sprintf("%s/messages/@%s", *siteURL, channel.Id)
```

to:

```go
		channelURL = fmt.Sprintf("%s/messages/%s", *siteURL, channel.Id)
```

- [ ] **Step 4: Verify build**

Run: `cd server && go build ./...`

- [ ] **Step 5: Commit**

```bash
git add server/app/reminder.go server/app/playbook_run_service.go
git commit -m "fix(urls): remove @ prefix from DM/GM channel URLs in bot messages"
```

---

### Task 3: Keep "Run a playbook" visible in DM/GM channels — webapp

**REVISED**: "Run a playbook" stays visible in the dropdown for all channel types. The DM/GM gate is enforced by the run modal's channel selector (`excludeDMGM` prop in Task 4) and the server gate (Task 1). No code changes needed in `rhs_run_list.tsx` for this task.

**Status:** COMPLETE (no-op — original conditional rendering was removed)

~~- [ ] **Step 3: Conditionally render the "Run a playbook" menu item**~~

Wrap the `CreateChecklistMenuItem` for "Run a playbook" (lines 213-221) in a conditional. Change:

```tsx
                                <CreateChecklistMenuItem
                                    onClick={handleStartRun}
                                    data-testid='create-from-playbook'
                                >
                                    <MenuItemIcon>
                                        <PlayOutlineIcon size={18}/>
                                    </MenuItemIcon>
                                    <FormattedMessage defaultMessage='Run a playbook'/>
                                </CreateChecklistMenuItem>
                                <Separator/>
```

to:

```tsx
                                {!isDirectOrGroupMessage && (
                                    <>
                                        <CreateChecklistMenuItem
                                            onClick={handleStartRun}
                                            data-testid='create-from-playbook'
                                        >
                                            <MenuItemIcon>
                                                <PlayOutlineIcon size={18}/>
                                            </MenuItemIcon>
                                            <FormattedMessage defaultMessage='Run a playbook'/>
                                        </CreateChecklistMenuItem>
                                        <Separator/>
                                    </>
                                )}
```

- [ ] **Step 4: Verify types**

Run: `cd webapp && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/rhs/rhs_run_list.tsx
git commit -m "feat(rhs): hide 'Run a playbook' in DM/GM channels"
```

---

### Task 4: Channel selector — excludeDMGM prop + memoization

**Files:**
- Modify: `webapp/src/components/backstage/channel_selector.tsx:34-48,86-90,121-125`
- Modify: `webapp/src/components/modals/run_playbook_modal.tsx:323`

- [ ] **Step 1: Memoize getMyDMAndGMChannels**

In `channel_selector.tsx`, replace lines 86-90:

```tsx
const getMyDMAndGMChannels = (state: GlobalState): Channel[] => {
    return getMyChannels(state).filter((channel) =>
        (channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL) && channel.delete_at === 0
    );
};
```

with:

```tsx
const getMyDMAndGMChannels = createSelector(
    'getMyDMAndGMChannels',
    getMyChannels,
    (channels: Channel[]): Channel[] => {
        return channels.filter((channel) =>
            (channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL) && channel.delete_at === 0
        );
    },
);
```

- [ ] **Step 2: Add excludeDMGM prop to Props interface**

In the `Props` interface (lines 34-48), add:

```tsx
    excludeDMGM?: boolean;
```

- [ ] **Step 3: Filter DM/GM when excludeDMGM is true**

At line 125 where `selectableChannels` is built, change:

```tsx
    const selectableChannels = [...teamChannels, ...dmgmChannels];
```

to:

```tsx
    const selectableChannels = props.excludeDMGM ? teamChannels : [...teamChannels, ...dmgmChannels];
```

- [ ] **Step 4: Pass excludeDMGM from the playbook run creation modal**

In `webapp/src/components/modals/run_playbook_modal.tsx`, find the `<StyledChannelSelector` usage (line ~323). This is a `styled(ChannelSelector)` wrapper — props pass through. Add the `excludeDMGM` prop:

```tsx
<StyledChannelSelector
    ...existing props...
    excludeDMGM={true}
/>
```

- [ ] **Step 5: Verify types**

Run: `cd webapp && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add webapp/src/components/backstage/channel_selector.tsx webapp/src/components/modals/run_playbook_modal.tsx
git commit -m "feat(channel-selector): add excludeDMGM prop and memoize DM/GM selector"
```

---

### Task 5: Fix GM channel link + team prefix in backstage overview

**Files:**
- Modify: `webapp/src/components/backstage/playbook_runs/playbook_run/rhs_info_overview.tsx:297-311`

- [ ] **Step 1: Add GM channel path handling**

After the DM check (line 305-307), add GM handling:

```tsx
        // DM channels use @username path format
        if (channel.type === General.DM_CHANNEL && teammate) {
            channelPath = `messages/@${teammate.username}`;
        } else if (channel.type === General.GM_CHANNEL) {
            channelPath = `messages/${channel.id}`;
        }
```

- [ ] **Step 2: Fix team prefix for DM/GM links**

Change the link `to` prop (line 311) from:

```tsx
                to={`/${teamName}/${channelPath}`}
```

to:

```tsx
                to={(channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL)
                    ? `/${channelPath}`
                    : `/${teamName}/${channelPath}`
                }
```

- [ ] **Step 3: Verify types**

Run: `cd webapp && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/backstage/playbook_runs/playbook_run/rhs_info_overview.tsx
git commit -m "fix(backstage): GM channel link path and DM/GM team prefix"
```

---

### Task 6: Evaluate WIP commits

Two WIP commits need resolution before shipping.

**Files:**
- Review: `git show b628bd2d` (WIP backstage rhs channel link overflow tooltip)
- Review: `git show 7d2492e6` (WIP DB — sqlstore changes)

- [ ] **Step 1: Evaluate "WIP backstage rhs channel link overflow tooltip" (b628bd2d)**

This commit adds overflow tooltip handling to `rhs_info_overview.tsx`. Review the changes:
- Adds `useRef` + `useTextOverflow` hook for channel name overflow detection
- Wraps link in conditional `<Tooltip>` when overflowing
- Changes `ItemContent` from `div` to `span`

If the tooltip works correctly after Task 5's modifications: keep. If it conflicts with Task 5 changes or is incomplete: note what needs finishing.

- [ ] **Step 2: Evaluate "WIP DB" (7d2492e6)**

This commit modifies `server/sqlstore/playbook.go` and `server/sqlstore/playbook_run.go` (126 insertions, 47 deletions). These are DM/GM query changes for both playbook listing and run listing.

Review: are these changes needed for checklists in DM/GM? The playbook_run.go changes likely are (query filters for empty TeamID). The playbook.go changes may be DM/GM-aware playbook listing which is run-only scope.

If keeping: rename the commit with a proper message. If partially needed: note what to revert.

- [ ] **Step 3: Record decision and act**

Based on evaluation, either:
- Keep both and amend commit messages (if complete and relevant)
- Revert one or both (if incomplete or out of scope)
- Finish incomplete work (if close to done)

---

### Task 7: Server-side test for playbook run gate

**Files:**
- Modify: `server/api_runs_test.go`

- [ ] **Step 1: Add test for playbook run rejection in DM channel**

Add a test case to `TestRunCreation` that:
1. Creates a DM channel between two test users
2. Attempts to create a playbook run (with PlaybookID set) in the DM channel
3. Asserts the request fails with the expected error message

- [ ] **Step 2: Add test for checklist acceptance in DM channel**

Add a test case that:
1. Creates a DM channel between two test users
2. Creates a checklist (PlaybookID = "") in the DM channel
3. Asserts the request succeeds

- [ ] **Step 3: Add test for GM channel**

Repeat the above two tests using a GM channel (3+ users).

- [ ] **Step 4: Run tests**

Run: `cd server && go test ./... -run TestRunCreation -v -count=1`
Expected: all new tests pass, existing tests unaffected.

- [ ] **Step 5: Commit**

```bash
git add server/api_runs_test.go
git commit -m "test(api): add DM/GM gate tests for playbook run creation"
```

---

### Task 8: Quality pass

- [ ] **Step 1: Run server lint**

Run: `make check-style`
Fix any issues in modified files.

- [ ] **Step 2: Run webapp type check**

Run: `cd webapp && npx tsc --noEmit`
Fix any type errors.

- [ ] **Step 3: Run webapp lint**

Run: `cd webapp && npm run lint`
Fix any lint issues in modified files.

- [ ] **Step 4: Run full server tests**

Run: `cd server && go test ./... -count=1`
Verify no regressions.

- [ ] **Step 5: Deploy and manual smoke test**

Run: `make deploy`

Manual checks:
1. Open a DM channel — verify "Run a playbook" is hidden in create dropdown
2. Create a checklist in the DM — verify it works
3. Open a GM channel — same checks
4. Open a regular channel — verify "Run a playbook" is still visible
5. Create a playbook run in a regular channel — verify it works
6. Check backstage overview for a DM/GM checklist — verify channel link navigates correctly

- [ ] **Step 6: Commit any fixes**

```bash
git add -u
git commit -m "chore: quality fixes for DM/GM checklist support"
```
