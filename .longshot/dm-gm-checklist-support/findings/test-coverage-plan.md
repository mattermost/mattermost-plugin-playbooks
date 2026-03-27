# DM/GM Channel Support — Change Summary & Test Coverage Plan

## Broad Categories of Changes

### 1. Channel Support Expansion
DM and GM channels are now valid targets for both checklists (no playbook) and playbook runs. The `TeamID` field on runs is nullable/empty for DM/GM-linked items. Runs and checklists can be moved between any channel types with automatic `TeamID` adjustment.

### 2. Backstage Visibility & Queries
The SQL query layer (`buildTeamLimitExpr`, `buildPermissionsExpr`) was modified to include DM/GM items in team-scoped backstage views. DM/GM checklists are cross-team (visible in all team contexts). DM/GM playbook runs are scoped to the playbook's team via a subquery join. Admin visibility for DM/GM checklists requires channel membership.

### 3. Automation & Action Gating
Several playbook automations are skipped or annotated for DM/GM: invite-on-start is skipped, owner defaults to the run starter, and participant channel add/remove actions are disabled at both server and UI layers. The Playbook Editor and Start Run dialog show informational hints for these limitations.

### 4. UI & Selector Changes
DM/GM channels appear in all channel selectors (run creation, move-channel, broadcast, link-to-existing). DM display names are resolved via `makeGetChannel`/`getDirectAndGroupChannels`. Channel links in backstage use proper routing (`/messages/@username` for DM, `/messages/{channel.name}` for GM). The RHS auto-opener now includes DM/GM runs.

### 5. Participant & Permission Scoping
Add-participant behavior differs by run type: DM/GM checklists restrict to channel members, DM/GM playbook runs allow the playbook's team members. The "add to channel" checkbox is hidden for all DM/GM. Task assignment scoping for DM/GM may need alignment with participant scoping.

---

## What Needs to Be Tested (Summary)

Every surface that displays, creates, modifies, or queries runs, checklists, playbooks, participants, or channels must be verified for correct behavior when the linked channel is a DM, GM, or self-DM — including creation flows, backstage listing visibility across teams and user roles (admin, regular, guest), channel selector display name resolution and navigation/routing, automation execution and suppression on run start, participant addition scoping by run type, action modal enable/disable states, move-channel flows between all channel type combinations, status update and broadcast delivery, and regression of all existing public/private channel behaviors.

---

## Comprehensive Test Checklist

### A. Run & Checklist Creation

- [ ] A1. Create a checklist in a DM channel via RHS empty state
- [ ] A2. Create a checklist in a GM channel via RHS empty state
- [ ] A3. Create a checklist in a self-DM channel via RHS empty state
- [ ] A4. Create a playbook run in a DM channel via "Run a playbook" dropdown → modal
- [ ] A5. Create a playbook run in a GM channel via "Run a playbook" dropdown → modal
- [ ] A6. Create a playbook run linked to a DM via the Start Run modal (link-to-existing mode)
- [ ] A7. Create a playbook run linked to a GM via the Start Run modal (link-to-existing mode)
- [ ] A8. Create a playbook run from a public channel but link to a DM/GM channel (override default)
- [ ] A9. Verify the run's `TeamID` is empty after creation in DM/GM
- [ ] A10. Verify the checklist's `TeamID` is empty after creation in DM/GM
- [ ] A11. Create a checklist in a DM/GM while another checklist already exists (list view vs detail view behavior)

### B. Backstage Visibility — LHS Sidebar

- [ ] B1. DM/GM checklist appears in LHS sidebar of Team A (user is channel member)
- [ ] B2. DM/GM checklist appears in LHS sidebar of Team B (same user, cross-team)
- [ ] B3. DM/GM checklist does NOT appear for a user who is not a channel member
- [ ] B4. DM/GM playbook run (Team A's playbook) appears in Team A's LHS sidebar
- [ ] B5. DM/GM playbook run (Team A's playbook) does NOT appear in Team B's LHS sidebar
- [ ] B6. DM/GM playbook run appears for a playbook member who is NOT in the DM/GM channel
- [ ] B7. DM/GM playbook run does NOT appear for a non-playbook-member
- [ ] B8. Team-based runs do NOT leak into other teams' LHS (regression)
- [ ] B9. Admin user: DM/GM checklist only visible if channel member
- [ ] B10. Admin user: DM/GM playbook run visible regardless of channel membership
- [ ] B11. Admin user: Team A run does NOT appear in Team B's LHS
- [ ] B12. Guest user: only sees DM/GM items they participate in

### C. Backstage Visibility — Runs Page

- [ ] C1. DM/GM checklists appear on Runs page alongside team-scoped runs
- [ ] C2. DM/GM playbook runs appear on Runs page (filtered to playbook's team)
- [ ] C3. Filter by "In Progress" / "Finished" includes DM/GM items
- [ ] C4. Filter by run type (Playbook / Checklist) correctly includes/excludes DM/GM items
- [ ] C5. Pagination works correctly when DM/GM items are mixed with team items
- [ ] C6. Sort order (by name, date, etc.) works with DM/GM items

### D. Backstage Visibility — Playbook Usage & Metrics

- [ ] D1. Playbook → Usage tab shows DM/GM-linked runs from that playbook
- [ ] D2. Playbook → Key Metrics includes DM/GM-linked finished runs
- [ ] D3. Usage count is accurate (includes DM/GM runs)

### E. Run Detail Page (RDP) — Backstage

- [ ] E1. DM/GM checklist detail page loads correctly
- [ ] E2. DM/GM playbook run detail page loads correctly
- [ ] E3. Channel link shows correct display name for DM (resolved from user profile)
- [ ] E4. Channel link shows correct display name for GM (group member names)
- [ ] E5. Channel link navigates correctly for DM (`/{team}/messages/@{username}`)
- [ ] E6. Channel link navigates correctly for GM (`/{team}/messages/{channel.name}`)
- [ ] E7. Owner section is visible for DM/GM runs and checklists
- [ ] E8. Participants section is visible for DM/GM runs and checklists
- [ ] E9. Followers section is visible for DM/GM runs and checklists
- [ ] E10. Owner section is visible for self-DM checklists (no longer hidden)

### F. Channel RHS

- [ ] F1. Open DM channel → click app bar icon → RHS opens with empty state
- [ ] F2. Open DM channel with existing checklist → RHS auto-opens with run detail
- [ ] F3. Open DM channel with multiple checklists → RHS shows list view
- [ ] F4. Open GM channel → same as F1-F3
- [ ] F5. "New checklist" button works in DM/GM empty state
- [ ] F6. "Run a playbook" appears in dropdown for DM/GM channels
- [ ] F7. "Go to Playbooks" link in dropdown works from DM/GM
- [ ] F8. RHS auto-opener triggers for DM/GM channels with active runs
- [ ] F9. RHS auto-opener does NOT trigger for DM/GM channels with only finished runs
- [ ] F10. Switching from a DM channel to a public channel updates the RHS correctly
- [ ] F11. "Channel Actions" menu is hidden in DM/GM (pre-existing — verify no regression)

### G. Channel Selectors & Display Names

- [ ] G1. "Link to existing channel" selector in Playbook Editor shows DM/GM channels
- [ ] G2. DM channels show resolved display name (not "Unknown Channel")
- [ ] G3. GM channels show group member names
- [ ] G4. Start Run modal channel selector shows DM/GM channels
- [ ] G5. Move-channel modal channel selector shows DM/GM channels
- [ ] G6. Broadcast channel selector (Playbook Editor) shows DM/GM channels
- [ ] G7. Broadcast channel selector (Run Actions modal) shows DM/GM channels
- [ ] G8. Search/filter in selectors finds DM channels by username
- [ ] G9. Search/filter in selectors finds GM channels by member names

### H. Move Channel Flows

- [ ] H1. Move checklist from public channel → DM channel (TeamID updated to "")
- [ ] H2. Move checklist from DM channel → public channel (TeamID updated to team)
- [ ] H3. Move checklist from DM → GM
- [ ] H4. Move checklist from GM → DM
- [ ] H5. Move playbook run from public channel → DM channel (TeamID updated)
- [ ] H6. Move playbook run from DM → public channel (TeamID updated)
- [ ] H7. Move playbook run from DM → GM
- [ ] H8. After move to DM/GM: verify item appears in DM/GM channel's RHS
- [ ] H9. After move to DM/GM: verify item no longer appears in original channel's RHS
- [ ] H10. After move from DM/GM to team channel: verify backstage visibility adjusts

### I. Automations — Run Start

- [ ] I1. Start playbook run in DM/GM → owner is the run starter (not playbook default)
- [ ] I2. Start playbook run in public channel → owner is playbook default (regression check)
- [ ] I3. Start playbook run in DM/GM → invite-on-start is skipped (no "Failed to invite" message)
- [ ] I4. Start playbook run in public channel → invite-on-start works (regression check)
- [ ] I5. Start playbook run in DM/GM with webhook-on-creation configured → webhook fires
- [ ] I6. Start playbook run in DM/GM → verify no errors in server logs

### J. Automations — Participant Actions

- [ ] J1. Run Actions modal for DM/GM run: "Add to channel" toggle disabled with hint
- [ ] J2. Run Actions modal for DM/GM run: "Remove from channel" toggle disabled with hint
- [ ] J3. Run Actions modal for DM/GM run: broadcast and webhook toggles remain editable
- [ ] J4. Run Actions modal for public channel run: all toggles editable (regression)
- [ ] J5. Server: adding a participant to a DM/GM run does NOT attempt to add to channel
- [ ] J6. Server: removing a participant from a DM/GM run does NOT attempt to remove from channel
- [ ] J7. Server: adding a participant to a public channel run with "add to channel" enabled → adds to channel (regression)

### K. Add Participant Modal

- [ ] K1. DM/GM checklist: participant search shows only channel members
- [ ] K2. DM/GM checklist: "add to channel" checkbox is hidden
- [ ] K3. DM/GM playbook run: participant search shows playbook's team members (not just channel members)
- [ ] K4. DM/GM playbook run: "add to channel" checkbox is hidden
- [ ] K5. DM/GM playbook run: adding a team member as participant succeeds (server accepts)
- [ ] K6. Public channel run: participant search shows team members (regression)
- [ ] K7. Public channel run: "add to channel" checkbox visible when automation enabled (regression)
- [ ] K8. Self-DM checklist: can add self as participant

### L. Task Management

- [ ] L1. Add task to DM/GM checklist
- [ ] L2. Check off task in DM/GM checklist
- [ ] L3. Assign task in DM/GM checklist → assignee dropdown shows channel members
- [ ] L4. Assign task in DM/GM playbook run → assignee dropdown shows (❓ channel members or team members?)
- [ ] L5. Task inbox includes tasks from DM/GM checklists and runs
- [ ] L6. Due date works on DM/GM tasks

### M. Status Updates & Broadcasts

- [ ] M1. Post status update via `/playbook update` in DM/GM channel
- [ ] M2. Status update reminder fires for DM/GM checklist → URL is navigable
- [ ] M3. Status update broadcast to another channel works from DM/GM run
- [ ] M4. Status update webhook fires for DM/GM run → URL in payload is correct (`/messages/{channelId}`)
- [ ] M5. Broadcast to a DM/GM channel works (DM/GM is the broadcast target)
- [ ] M6. Status update from public channel run → broadcasts work (regression)

### N. Playbook Editor Hints

- [ ] N1. "Link to existing channel" set to DM → hints appear below: invite participants, assign owner, participant joins, participant leaves
- [ ] N2. "Link to existing channel" set to public → no hints shown
- [ ] N3. Change from DM → public → hints disappear
- [ ] N4. Change from public → GM → hints appear
- [ ] N5. All toggles remain interactive (not disabled) when hints are shown
- [ ] N6. Hints do not appear when "Create a new channel" mode is selected

### O. Start Run Dialog

- [ ] O1. Select DM channel → hint appears below channel selector
- [ ] O2. Select public channel → no hint
- [ ] O3. Switch from DM → public → hint disappears
- [ ] O4. Hint text mentions owner override and channel action limitations

### P. URL & Navigation

- [ ] P1. Bot reminder message for DM checklist contains navigable link
- [ ] P2. Bot reminder message for GM checklist contains navigable link
- [ ] P3. Webhook payload for DM/GM run contains correct channel URL
- [ ] P4. Backstage channel link for DM run navigates to correct DM
- [ ] P5. Backstage channel link for GM run navigates to correct GM
- [ ] P6. Backstage channel link for public/private run works (regression)

### Q. Permissions & Access Control

- [ ] Q1. Regular user: can only see DM/GM checklists they are a channel member of
- [ ] Q2. Regular user: can see DM/GM playbook run if they have playbook access (even without channel membership)
- [ ] Q3. Admin user: can see DM/GM playbook runs
- [ ] Q4. Admin user: can only see DM/GM checklists they are a channel member of
- [ ] Q5. Guest user: can only see DM/GM items they are a participant of
- [ ] Q6. Non-team-member cannot see DM/GM playbook run (even if run is in a DM they're in but playbook is on another team)
- [ ] Q7. Run participant who is NOT a channel member: can view run in backstage but cannot navigate to the channel

### R. Edge Cases

- [ ] R1. Self-DM checklist: all sections visible (owner, participants, followers)
- [ ] R2. Self-DM: can assign self as task assignee
- [ ] R3. DM with bot user (e.g., playbooks bot DM): checklist creation works
- [ ] R4. GM with 8 members (maximum): checklist creation works
- [ ] R5. Move a checklist to a DM → move it back to a public channel → verify TeamID restored
- [ ] R6. Delete/archive the linked DM/GM channel → run/checklist shows "Channel deleted"
- [ ] R7. Multiple checklists in same DM/GM → list view paging works
- [ ] R8. Favoriting a DM/GM run → appears in favorites across teams (checklists) or in playbook's team (runs)
- [ ] R9. Following a DM/GM run → follower receives notifications
- [ ] R10. Finishing a DM/GM run → status changes correctly, RHS updates
- [ ] R11. Slash command `/playbook check` in DM/GM channel → works
- [ ] R12. DM/GM channel with both a checklist AND a playbook run → list view shows both with correct type icons
