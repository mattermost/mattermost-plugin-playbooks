# DM/GM Channel Support — Spec

**Jira:** MM-66962
**Branch:** `MM-66962-dm-gm-channel-support`
**Profile:** mattermost-plugin-playbooks
**Scope:** L (multi-layer feature)
**Min Server Version:** v11 (PostgreSQL only)

## Summary

Enable both checklists and playbook runs in Direct Message and Group Message channels. DM/GM items are visible in backstage views with proper team scoping and channel-based permissions. Certain playbook automations that require channel member management are disabled for DM/GM with clarifying hints.

## Background

Branch has ~14 commits of existing work that built full DM/GM infrastructure for both checklists AND playbook runs: nullable TeamID migration, channel-based permissions, DM/GM-aware queries, webhook URL handling, participant/assignee scoping, and unified channel selectors. This spec narrows the scope to checklists only while preserving the shared infrastructure.

## Acceptance Criteria

### Creation & Lifecycle
1. Users can create checklists in DM, GM, and self-DM channels
2. Users can create playbook runs linked to DM/GM channels
3. Full lifecycle works in DM/GM: create, add tasks, assign tasks, check off tasks, status updates, update broadcasts
4. Runs and checklists can be moved between any channel types (public/private ↔ DM/GM) — TeamID updated automatically

### Backstage Visibility
5. DM/GM checklists appear in all team contexts (cross-team, since checklists have no playbook/team)
6. DM/GM playbook runs appear only in the team that owns the playbook
7. DM/GM checklists require channel membership to view (admins included — admins can't access DM/GM channels they don't belong to)
8. DM/GM playbook runs follow normal playbook access rules (public playbook = visible; private = playbook members only)
9. Backstage channel links resolve DM display names and use correct routing (`/{team}/messages/@{username}` for DM, `/{team}/messages/{channel.name}` for GM)

### Channel RHS
10. RHS run list works in DM/GM channels (empty state, create checklist, create run)
11. RHS auto-opens for DM/GM channels with active runs
12. "Run a playbook" visible in dropdown for all channel types (DM/GM included)
13. Channel selector in run creation modal includes DM/GM channels with resolved display names

### Automations & Actions
14. Owner auto-assigned to run starter when linked to DM/GM (playbook default owner skipped)
15. Invite participants skipped on run start for DM/GM channels (can't add users to DM/GM)
16. "Add participant to channel" / "Remove from channel" actions disabled for DM/GM (server + UI)
17. Playbook Editor shows hints below affected actions when linked to DM/GM
18. Start Run dialog shows hint when DM/GM channel selected

### Infrastructure
19. Bot message and reminder URLs use `/messages/{channelId}` (not `@channelId`)
20. Broadcast channel selector includes DM/GM channels
21. DM/GM channel display names resolved via `getDirectAndGroupChannels` / `makeGetChannel`
22. No regressions to existing functionality in regular channels

## Scope

### In Scope

- Checklists (RunType: ChannelChecklist, PlaybookID = "") in DM/GM/self-DM channels
- All checklist-supported features in DM/GM: status updates, update broadcasts, daily digests, bot messages, task assignment, task inbox
- Server-side gate rejecting playbook run creation in DM/GM channels
- Webapp UI filtering to hide playbook-run-only options in DM/GM channels
- Bug fixes: GM channel links, reminder/webhook URL format, DM/GM link team prefix
- Selector memoization fix
- WIP commit evaluation and cleanup

### Out of Scope

- Playbook runs (PlaybookID != "") in DM/GM channels — gated, not supported
- Playbook-specific features (retrospectives, participant join/leave announcements) in DM/GM
- SQL LIKE wildcard escaping (pre-existing, unrelated)
- PostgreSQL-specific syntax cleanup (MySQL dropped in v11, moot)

### Preserved Infrastructure (no changes needed)

- DB migration 000083: nullable TeamID
- Channel-based permission checks (PermissionReadChannel / PermissionCreatePost) for DM/GM
- Status update and broadcast support for DM/GM
- Participant and assignee handling scoped to channel members
- Query filters for empty TeamID

## Design

### 1. Server-Side Gate

**File:** `server/api/playbook_runs.go` — shared `createPlaybookRun()` helper function (line ~467)

After the channel is resolved and TeamID is set to "" for DM/GM (~line 500), before the `if playbook != nil` branch:

```go
if channel != nil && channel.IsGroupOrDirect() && playbookRun.PlaybookID != "" {
    return nil, errors.Wrap(app.ErrMalformedPlaybookRun,
        "playbook runs are not supported in direct or group message channels")
}
```

**Placement rationale:** The gate goes in the shared `createPlaybookRun()` helper, NOT in either public handler (`createPlaybookRunFromPost` or `createPlaybookRunFromDialog`). The dialog handler always has a TeamID from `request.TeamId` so DM/GM is impossible via that path, but the shared helper is the single chokepoint.

The gate is in the API handler (not the permissions layer) because it's expected to be temporary — when playbook run support comes later, it's easy to find and remove.

### 2. Webapp UI Filtering

#### 2a. RHS Create Dropdown

**File:** `webapp/src/components/rhs/rhs_run_list.tsx`

"Run a playbook" remains visible in the dropdown for all channel types including DM/GM. The gating for DM/GM playbook runs happens at two levels:
1. The run creation modal's channel selector excludes DM/GM channels (`excludeDMGM` prop)
2. The server-side API gate rejects playbook run creation targeting DM/GM channels

This approach lets users discover the "Run a playbook" option in DM/GM without hitting a dead end — the modal simply won't offer DM/GM channels to link to.

#### 2b. Channel Selector Filtering

**File:** `webapp/src/components/backstage/channel_selector.tsx`

Add an optional `excludeDMGM?: boolean` prop to `ChannelSelector`. When true, DM/GM channels are excluded from the `selectableChannels` array (don't concatenate `dmgmChannels`). This affects both the dropdown options and any pre-populated values — if a DM/GM channel was somehow pre-selected, it should not appear when `excludeDMGM` is true.

The playbook run creation modal passes `excludeDMGM={true}`. The checklist move-channel modal does not (DM/GMs remain selectable for checklists).

#### 2c. Selector Memoization

**File:** `webapp/src/components/backstage/channel_selector.tsx`

Replace the plain `getMyDMAndGMChannels` function (currently at line 86, unmemoized) with a `createSelector`-based memoized selector matching the pattern of other selectors in the file.

### 3. Bug Fixes

#### 3a. GM Channel Links in Backstage Overview

**File:** `webapp/src/components/backstage/playbook_runs/playbook_run/rhs_info_overview.tsx`

Two issues:

1. **Missing GM handling:** Add GM channel path after the existing DM check:
   ```tsx
   } else if (channel.type === General.GM_CHANNEL) {
       channelPath = `messages/${channel.id}`;
   }
   ```

2. **Wrong team prefix for DM/GM links:** The link uses `/${teamName}/${channelPath}` (line 311). For DM/GM channels, `teamName` is either empty or the unrelated current team — both wrong. DM/GM paths must omit the team prefix entirely. Change to:
   ```tsx
   const linkTo = (channel.type === General.DM_CHANNEL || channel.type === General.GM_CHANNEL)
       ? `/${channelPath}`
       : `/${teamName}/${channelPath}`;
   ```

#### 3b. Reminder and Bot Message URL Format

Three locations use `/messages/@{channel.Id}` which produces invalid URLs for DM/GM. The `@` prefix is for usernames, not channel IDs. All three must be fixed:

1. **`server/app/reminder.go:143`** — `buildOverdueStatusUpdateMessage()`
   - Currently: `fmt.Sprintf("/messages/@%s", channel.Id)`
   - Fix: For DM, resolve the other participant's username and use `/messages/@{username}`. For GM, use `/messages/{channel.Id}` (no `@` prefix).

2. **`server/app/playbook_run_service.go:329`** — `sendWebhooksOnCreation()`
   - Same pattern, same fix.

3. **`server/app/playbook_run_service.go:1027`** — `sendWebhooksOnUpdateStatus()`
   - Same pattern, same fix.

Extract a shared helper to avoid duplicating the DM-vs-GM URL logic across three call sites.

### 4. WIP Commit Cleanup

Two WIP commits at HEAD need evaluation:

- **"WIP backstage rhs channel link overflow tooltip"** — evaluate if the tooltip overflow fix is complete and test-worthy; if so, finish and fold into a proper commit. If incomplete, revert.
- **"WIP DB"** — inspect the changes, determine if they're needed for the checklist scope. If they're playbook-run-only infra, revert.

Decision to be made during implementation based on code inspection.

### 5. Self-DM Support

Self-DM is a valid DM channel type returned by `channel.IsGroupOrDirect()`. Checklists in self-DM channels are explicitly supported — the server gate only blocks `PlaybookID != ""`, so self-DM checklists pass through. The existing code at `rhs_info_overview.tsx:111-113` already handles self-DM detection. No additional changes needed, but testing must cover this case.

## Non-Functional Requirements

- Server gate returns a clear error message
- UI never exposes a code path that leads to a server error (UI and server tell the same story)
- DM/GM infrastructure shared between checklists and runs must not regress
- Memoized selectors must preserve reference equality

## Testing Strategy

### Automated
- Server: unit test for playbook run gate (reject PlaybookID != "" in DM/GM, accept PlaybookID == "" in DM/GM)
- Regression: existing e2e tests pass

### Manual
- Create checklist in DM, GM, and self-DM — verify full lifecycle
- Trigger status update reminder in DM/GM checklist — verify URL navigates correctly
- Trigger update broadcast from DM/GM checklist — verify bot message URL
- Verify "Run a playbook" is hidden in DM/GM channels
- Verify channel selector excludes DM/GM when creating a playbook run
- Verify channel selector includes DM/GM when moving a checklist
- Verify playbook run creation from regular channels is unaffected
- Verify backstage overview channel link navigates correctly for DM and GM checklists

## Ambiguities Resolved

- **Scope pivot:** Checklists only, not playbook runs — confirmed by user
- **Existing infra:** Leave in place, don't strip — confirmed by user
- **Move-channel for DM/GM checklists:** DM/GM channels remain in the selector for checklist moves
- **Self-DM:** Supported (standard DM, passes all gates)
- **MySQL:** Dropped in v11, no driver branching needed
