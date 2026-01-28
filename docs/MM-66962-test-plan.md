# MM-66962: DM/GM Channel Support - Test Plan

## Overview

This document outlines test cases for verifying DM/GM channel checklist support. It catalogs all code paths that check channel permissions or TeamID, and specifies what testing is needed.

---

## Code Paths Requiring Verification

### 1. Run Creation (`server/api/playbook_runs.go`)

| Line | Check | Current Handling | Test Needed |
|------|-------|------------------|-------------|
| 477 | `TeamID == "" && ChannelID == ""` | Returns error | Verify DM/GM with channelID passes |
| 500-507 | `channel.IsGroupOrDirect()` | Sets TeamID to empty | Verify TeamID is empty after creation |
| 546 | `TeamID != ""` before team permission check | Skips for DM/GM | Verify no team permission error for DM/GM |
| 560 | `HasPermissionToTeam` for channel creation | Only for new channels | N/A - DM/GM always uses existing channel |
| 566-572 | Channel type permission selection | Uses `PermissionReadChannel` for DM/GM | Verify DM/GM uses correct permission |

### 2. Run Updates (`server/api/graphql_root_run.go`)

| Line | Check | Current Handling | Test Needed |
|------|-------|------------------|-------------|
| 208-214 | Channel linking validation | DM/GM runs can only link to DM/GM channels | Verify cross-type linking fails |
| 218-224 | Channel permission by type | Uses `PermissionReadChannel` for DM/GM | Verify permission check passes |

### 3. Permission Service (`server/app/permissions_service.go`)

| Line | Check | Current Handling | Test Needed |
|------|-------|------------------|-------------|
| 99-104 | `canViewTeam()` with empty TeamID | Returns false | N/A - internal function |
| 438-444 | `RunManageProperties` | Uses channel perms for DM/GM | Verify participant can manage |
| 480-492 | `RunView` | Uses channel perms for DM/GM | Verify participant can view |
| 547-551 | `CanManageChannelProperties` | No DM/GM handling | **Verify** - may need fix |

### 4. Run Service (`server/app/playbook_run_service.go`)

| Line | Check | Current Handling | Test Needed |
|------|-------|------------------|-------------|
| 325-335 | Webhook URL construction | DM/GM uses channel ID URL | Verify webhook payload has correct URL |
| 1023-1035 | Status update URL | DM/GM uses channel ID URL | Verify status update works |
| 3223-3254 | Member operations | Skips team member ops for DM/GM | Verify no team member errors |
| 4090-4107 | Add participant | Uses channel membership for DM/GM | Verify participant can be added |

### 5. Database Queries (`server/sqlstore/playbook_run.go`)

| Line | Check | Current Handling | Test Needed |
|------|-------|------------------|-------------|
| 1094 | `TeamID IS NULL OR TeamID = ''` | Identifies DM/GM runs | Verify DM/GM runs returned in queries |
| 1103-1122 | Permission filtering | Uses channel membership for DM/GM | Verify user sees their DM/GM runs |

### 6. Broadcast/Reminders

| File | Line | Check | Current Handling | Test Needed |
|------|------|-------|------------------|-------------|
| `plugin_api_tools.go` | 28-35 | Team validation | Skips for empty TeamID | Verify broadcast works for DM/GM |
| `reminder.go` | 139-146 | URL construction | DM/GM uses different format | Verify reminder links work |

### 7. Webapp (`webapp/src/components/`)

| File | Check | Current Handling | Test Needed |
|------|-------|------------------|-------------|
| `rhs_about.tsx` | Self-DM detection | Hides Owner/Participants | Verify UI for self-DM |
| `rhs_info_overview.tsx` | Self-DM detection | Hides Owner/Participants/Followers | Verify UI for self-DM |
| `update_run_status_modal.tsx` | TeamID validation | Removed TeamID requirement | Verify modal works for DM/GM |

### 8. Redux Selectors (`webapp/src/selectors.ts`)

| Line | Check | Current Handling | Test Needed |
|------|-------|------------------|-------------|
| 98-107 | `inPlaybookRunChannel` | Checks both team and DM/GM runs | Verify DM/GM runs detected |
| 109-118 | `currentPlaybookRun` | Checks both team and DM/GM runs | Verify DM/GM run returned |

---

## Manual Test Cases

### TC1: Create Checklist in DM Channel

**Preconditions:** User has a DM conversation open

**Steps:**
1. Open DM channel with another user
2. Click "+" button or use slash command to create checklist
3. Add a checklist item
4. Verify checklist appears in RHS

**Expected Results:**
- Checklist created successfully
- `team_id` is empty in database
- Checklist appears in channel RHS
- No errors in server logs

---

### TC2: Create Checklist in GM Channel

**Preconditions:** User has a GM conversation with 2+ other users

**Steps:**
1. Open GM channel
2. Create a new checklist
3. Add items to checklist

**Expected Results:**
- Checklist created successfully
- All GM members can see and interact with checklist
- `team_id` is empty in database

---

### TC3: Create Checklist in Self-DM

**Preconditions:** User has self-DM open (message to self)

**Steps:**
1. Open self-DM channel
2. Create a new checklist
3. Verify Owner/Participants sections are hidden

**Expected Results:**
- Checklist created successfully
- Owner section not displayed (only 1 user)
- Participants section not displayed
- Followers section not displayed (backstage)

---

### TC4: Post Status Update in DM/GM Checklist

**Preconditions:** Checklist exists in DM/GM channel

**Steps:**
1. Open checklist in DM/GM
2. Click "Post update" button
3. Enter update message
4. Click "Post update"

**Expected Results:**
- Modal opens and is not disabled
- Update posts successfully to channel
- Status is saved to checklist

---

### TC5: Configure Broadcast Channels for DM/GM Checklist

**Preconditions:** Checklist exists in DM/GM channel

**Steps:**
1. Open checklist settings/actions
2. Add a broadcast channel (team channel)
3. Post a status update
4. Verify broadcast is received

**Expected Results:**
- Broadcast channel can be configured
- Status update broadcasts to configured channel
- No team validation errors

---

### TC6: Verify DM/GM Checklist Appears in Sidebar

**Preconditions:** User participates in DM/GM checklist

**Steps:**
1. Open Playbooks sidebar
2. Look for DM/GM checklist

**Expected Results:**
- **Current behavior:** DM/GM checklists may not appear (team-scoped view)
- **Known limitation:** To be addressed in future iteration

---

### TC7: Assign Task in DM/GM Checklist

**Preconditions:** Checklist in DM with another user

**Steps:**
1. Open checklist
2. Create a task
3. Assign task to the other DM participant
4. Verify assignee selector shows channel members

**Expected Results:**
- Assignee dropdown shows channel members (not team members)
- Task can be assigned to channel participant
- No errors when assigning

---

### TC8: Favorite DM/GM Checklist

**Preconditions:** Checklist exists in DM/GM

**Steps:**
1. Open checklist
2. Click favorite/star button
3. Verify favorite state persists

**Expected Results:**
- Favorite toggles without error
- Favorite state persists on refresh
- **Known limitation:** May not appear in team-scoped favorites view

---

### TC9: Follow DM/GM Checklist

**Preconditions:** Checklist exists in DM/GM, user is not owner

**Steps:**
1. Open checklist details
2. Click "Follow" button
3. Verify following state

**Expected Results:**
- Follow button works
- User receives DM notifications for updates

---

### TC10: Link DM/GM Checklist to Different Channel (Negative)

**Preconditions:** Checklist exists in DM channel

**Steps:**
1. Attempt to link checklist to a team channel via API/UI

**Expected Results:**
- Operation fails with appropriate error
- Error message: "DM/GM runs can only be linked to DM/GM channels"

---

### TC11: Webhook Notifications for DM/GM Checklist

**Preconditions:** Checklist in DM/GM with webhook configured

**Steps:**
1. Configure webhook URL for status updates
2. Post a status update
3. Verify webhook received

**Expected Results:**
- Webhook fires successfully
- Payload contains correct channel URL format
- `team_id` is empty in payload

---

### TC12: Reminder Timer for DM/GM Checklist

**Preconditions:** Checklist in DM/GM with status updates enabled

**Steps:**
1. Configure reminder timer
2. Wait for reminder to fire
3. Verify reminder notification

**Expected Results:**
- Reminder fires at scheduled time
- Notification link uses correct URL format (not team-based)

---

## Automated Test Recommendations

Add to `server/api_runs_test.go`:

```go
func TestCreateRunInDMChannel(t *testing.T) {
    // Test creating a run in a DM channel
    // Verify TeamID is empty
    // Verify run is accessible to DM participants
}

func TestCreateRunInGMChannel(t *testing.T) {
    // Test creating a run in a GM channel
    // Verify TeamID is empty
    // Verify run is accessible to all GM participants
}

func TestDMGMRunCannotLinkToTeamChannel(t *testing.T) {
    // Create DM/GM run
    // Attempt to link to team channel
    // Verify error returned
}

func TestTeamRunCannotLinkToDMGMChannel(t *testing.T) {
    // Create team-based run
    // Attempt to link to DM/GM channel
    // Verify error returned
}

func TestDMGMRunPermissions(t *testing.T) {
    // Create DM/GM run
    // Verify channel member can view
    // Verify non-channel member cannot view
}

func TestStatusUpdateInDMGMRun(t *testing.T) {
    // Create DM/GM run
    // Post status update
    // Verify success
}

func TestBroadcastFromDMGMRun(t *testing.T) {
    // Create DM/GM run with broadcast channel
    // Post status update
    // Verify broadcast to team channel succeeds
}
```

---

## Known Limitations (Out of Scope)

1. **Sidebar visibility:** DM/GM checklists don't appear in team-scoped sidebar
2. **Favorites display:** Favorites stored with empty teamID may not display in UI
3. **Playbook templates:** Cannot create runs from playbooks in DM/GM (by design)

---

## Files Modified in This Feature

| File | Changes |
|------|---------|
| `server/sqlstore/migrations/` | Made TeamID nullable |
| `server/sqlstore/playbook_run.go` | Updated queries for DM/GM |
| `server/api/playbook_runs.go` | DM/GM validation and handling |
| `server/api/graphql_root_run.go` | DM/GM validation |
| `server/app/permissions_service.go` | Channel-based permissions for DM/GM |
| `server/app/playbook_run_service.go` | Skip team ops for DM/GM |
| `server/app/plugin_api_tools.go` | Broadcast channel validation |
| `server/app/reminder.go` | URL construction for DM/GM |
| `webapp/src/components/rhs/rhs_about.tsx` | Self-DM UI handling |
| `webapp/src/components/backstage/.../rhs_info_overview.tsx` | Self-DM UI handling |
| `webapp/src/components/modals/update_run_status_modal.tsx` | Remove TeamID requirement |
| `webapp/src/hooks/general.ts` | Profile fetching for DM/GM |
| `webapp/src/components/checklist_item/assign_to.tsx` | Profile source for DM/GM |
| `webapp/src/index.tsx` | Enable channel header button for DM/GM |
| `webapp/src/components/rhs/rhs_run_list.tsx` | Remove DM/GM blocking message |
| `webapp/src/selectors.ts` | Check DM/GM runs (empty team_id) in selectors |

---

## Verification Checklist

- [ ] TC1: Create checklist in DM
- [ ] TC2: Create checklist in GM
- [ ] TC3: Self-DM UI handling
- [ ] TC4: Status updates work
- [ ] TC5: Broadcast channels work
- [ ] TC6: Sidebar visibility (document limitation)
- [ ] TC7: Task assignment uses channel members
- [ ] TC8: Favorites work
- [ ] TC9: Following works
- [ ] TC10: Cross-type linking blocked
- [ ] TC11: Webhooks work
- [ ] TC12: Reminders work
