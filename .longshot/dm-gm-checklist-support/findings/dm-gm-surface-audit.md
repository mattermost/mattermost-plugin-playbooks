# DM/GM Support: Comprehensive Surface Audit — Before & After

## Visibility & Permissions

### Run/Checklist Listing Queries

| Surface | Scope | Before (master) | After (this branch) |
|---------|-------|-----------------|---------------------|
| **buildPermissionsExpr** (admin) | All runs | `return nil` — admin sees everything | Admin sees all team-based items + DM/GM playbook runs. DM/GM **checklists** require channel membership (admins can't access DM/GM channels they don't belong to). |
| **buildPermissionsExpr** (regular) | Playbook runs | Participant OR playbook access (public/member) | No change |
| **buildPermissionsExpr** (regular) | Checklists | Channel membership required | No change |
| **buildTeamLimitExpr** (team-scoped) | Team filter | Only `i.TeamID = ?` — DM/GM items excluded entirely | Team runs + DM/GM checklists (cross-team, channel member) + DM/GM playbook runs (same playbook team, channel member) |
| **buildTeamLimitExpr** (no team) | All accessible | Team member OR (DM/GM + channel member) | No change |

### Backstage Views

| Surface | Before | After | Change |
|---------|--------|-------|--------|
| **LHS Sidebar — Runs** | Team-scoped runs only; DM/GM runs invisible | DM/GM checklists visible (cross-team); DM/GM playbook runs visible (playbook's team only) | **NEW** |
| **LHS Sidebar — Playbooks** | Team-scoped playbooks | No change (playbooks are team-only) | None |
| **Runs Page (list)** | Team-scoped runs only | DM/GM items included per team-limit rules above | **NEW** |
| **Playbook → Usage tab** | Runs for this playbook, team-scoped | DM/GM runs from this playbook now included | **NEW** |
| **Playbook → Key Metrics** | Runs for this playbook, team-scoped | DM/GM runs from this playbook now included | **NEW** |
| **Run Detail Page (RDP)** | Single run by ID, permissions enforced | No change (already works for DM/GM by ID) | None |
| **RDP → Channel link** | Team channel links only | DM: `/{team}/messages/@{username}`, GM: `/{team}/messages/{channel.name}`. Display name resolved via `makeGetChannel` (completeDirectChannelInfo). | **FIXED** |
| **RDP → Owner/Participants/Followers** | Hidden for self-DM | Always visible (self-DM restriction removed) | **CHANGED** |

### Channel RHS Views

| Surface | Before | After | Change |
|---------|--------|-------|--------|
| **RHS Run List** | Queries by channelID; DM/GM channels blocked by master's `isDirectOrGroupMessage` guard (showed "checklists not available" message) | DM/GM channels fully supported; empty state + "New checklist" + "Run a playbook" all available | **CHANGED** |
| **RHS Run Detail** | Works for any run by ID | No change | None |
| **RHS Auto-Opener** | Queries by teamID; DM/GM runs not found → RHS doesn't auto-open for DM/GM | DM/GM runs included in team-scoped query → RHS auto-opens for DM/GM channels with active runs | **NEW** |
| **"Run a playbook" dropdown** | Hidden in DM/GM (master's guard) | Visible in all channel types (gating is in the run modal's channel selector) | **CHANGED** |
| **App Bar Icon** | Registered for all channels | No change | None |
| **"Channel Actions" menu** | Hidden in DM/GM via `shouldRender` | No change (pre-existing, intentional) | None |

### Modals & Dialogs

| Surface | Before | After | Change |
|---------|--------|-------|--------|
| **Start Run Modal — channel selector** | DM/GM channels excluded (`excludeDMGM`) | DM/GM channels included; hint shown when DM/GM selected explaining limitations | **CHANGED** |
| **Start Run Modal — owner** | Playbook's default owner used | DM/GM: owner = run starter (default owner skipped); regular: unchanged | **NEW** |
| **Move Channel Modal** | DM/GM excluded for playbook runs | DM/GM included for all run types | **CHANGED** |
| **Move Channel Modal — channel selector** | DM/GM channels shown as "Unknown" | DM display names resolved via `getDirectAndGroupChannels` | **FIXED** |
| **Run Actions Modal — participant actions** | No DM/GM awareness | "Add to channel" / "Remove from channel" toggles disabled for DM/GM with hint | **NEW** |
| **Run Actions Modal — broadcast/webhook** | No DM/GM awareness | No change (works for DM/GM) | None |
| **Update Status Modal** | `TeamID` required | `TeamID` requirement removed; works for DM/GM | **CHANGED** (pre-existing on branch) |
| **Add Participant Modal** | Team members shown | DM/GM: only channel members shown; "add to channel" checkbox hidden | **CHANGED** (pre-existing on branch) |

### Playbook Editor

| Surface | Before | After | Change |
|---------|--------|-------|--------|
| **Outline → Channel Access** | "Link to existing channel" excludes DM/GM | DM/GM channels available in selector; display names resolved | **CHANGED** |
| **Outline → Invite Participants** | No DM/GM awareness | Hint when linked to DM/GM: "This action will not apply..." | **NEW** |
| **Outline → Assign Owner** | No DM/GM awareness | Hint when linked to DM/GM: "Owner will be the user who starts the run" | **NEW** |
| **Outline → Participant Joins → Add to channel** | No DM/GM awareness | Hint when linked to DM/GM: "This action will not apply..." | **NEW** |
| **Outline → Participant Leaves → Remove from channel** | No DM/GM awareness | Hint when linked to DM/GM: "This action will not apply..." | **NEW** |
| **Outline → Status Updates → Broadcast selector** | DM/GM channels excluded | DM/GM channels included in broadcast selector | **CHANGED** |
| **Outline → Outgoing Webhook** | No DM/GM awareness | No change (works for DM/GM) | None |

### Server — Run Creation & Lifecycle

| Surface | Before | After | Change |
|---------|--------|-------|--------|
| **Create playbook run in DM/GM** | Rejected with 400 error | Allowed; TeamID set to "" | **CHANGED** |
| **Create checklist in DM/GM** | Allowed (pre-existing on branch) | No change | None |
| **Move run to DM/GM** | Rejected for playbook runs | Allowed for all run types; TeamID updated | **CHANGED** |
| **Move run from DM/GM to team channel** | Allowed (TeamID updated) | No change | None |
| **Invite on run start (DM/GM)** | Would fail with "Failed to invite" error posted | Entire invite block skipped for DM/GM channels | **NEW** |
| **Participant → Add to channel (DM/GM)** | Would attempt and fail | `participateActions` skips for DM/GM | **NEW** |
| **Participant → Remove from channel (DM/GM)** | Would attempt and fail | `leaveActions` skips for DM/GM | **NEW** |
| **Owner auto-assign (DM/GM)** | Playbook's default owner used | Run starter is owner (client-side, in run modal) | **NEW** |
| **Status update reminders (DM/GM)** | URL used `/messages/@{channelId}` (invalid) | URL uses `/messages/{channelId}` (valid) | **FIXED** |
| **Webhook URLs (DM/GM)** | URL used `/messages/@{channelId}` | URL uses `/messages/{channelId}` | **FIXED** |
| **Broadcast validation (DM/GM)** | `IsChannelActiveInTeam` skips team check for empty TeamID | No change (pre-existing on branch) | None |

### Server — Database & Queries

| Surface | Before | After | Change |
|---------|--------|-------|--------|
| **DB Migration 000083** | `TeamID NOT NULL` | `TeamID` nullable (supports empty string for DM/GM) | **NEW** (pre-existing on branch) |
| **Run listing SQL — team-scoped** | `WHERE i.TeamID = ?` only | `OR (DM/GM checklist + channel member)` OR `(DM/GM playbook run + playbook in team + channel member)` | **NEW** |
| **Playbook listing SQL** | Team-scoped only | No change (playbooks are team-only) | None |

### Task Management

| Surface | Before | After | Change |
|---------|--------|-------|--------|
| **Task Assignment (DM/GM)** | Team member search | Channel member scoped via `assign_to.tsx` key-based refresh | **CHANGED** (pre-existing on branch) |
| **Task Inbox** | Participant-filtered, team-scoped | DM/GM tasks visible (participant filter is teamless) | **UNCHANGED** (already works) |

### E2E Test Coverage

| Spec | Tests | Coverage |
|------|-------|----------|
| `dm_checklist_spec.js` | 8 | Create in DM, self-DM, task add+check, status update, assignment, run creation (API), dropdown, move-channel |
| `gm_checklist_spec.js` | 6 | Create in GM+task, task+check, status update, assignment, run creation (API), dropdown |
| `start_run_rhs_spec.js` | 1 (+5 skipped) | Run modal channel selector includes DM/GM |
