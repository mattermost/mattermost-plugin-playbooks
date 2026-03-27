# DM/GM Feature Compatibility Graph

## Entity Relationships

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              TEAM                                        │
│  Playbooks are scoped to a team. Teams have members.                     │
│                                                                          │
│  ┌─────────────┐     ┌──────────────────────────────────────────────┐   │
│  │  PLAYBOOK   │────▶│  PLAYBOOK MEMBERS                            │   │
│  │  (team-scoped)    │  Users with access to view/edit the playbook │   │
│  │             │     │  Public playbook: all team members            │   │
│  │             │     │  Private playbook: explicitly added members   │   │
│  └──────┬──────┘     └──────────────────────────────────────────────┘   │
│         │                                                                │
│         │ creates                                                        │
│         ▼                                                                │
│  ┌──────────────┐         ┌─────────────────┐                           │
│  │  PLAYBOOK    │────────▶│  CHANNEL LINK   │                           │
│  │  RUN         │         │                 │                           │
│  │              │         │  Public channel  │                           │
│  │  TeamID: set │         │  Private channel │                           │
│  │  -or-        │         │  DM channel      │                           │
│  │  TeamID: ""  │         │  GM channel      │                           │
│  │  (DM/GM)     │         └────────┬────────┘                           │
│  └──────┬───────┘                  │                                     │
│         │                          │                                     │
│         │                          ▼                                     │
│         │                  ┌───────────────┐                             │
│         │                  │ CHANNEL       │                             │
│         │                  │ MEMBERS       │                             │
│         │                  │               │                             │
│         │                  │ Users in the  │                             │
│         │                  │ linked channel│                             │
│         ▼                  └───────────────┘                             │
│  ┌──────────────┐                                                        │
│  │  RUN         │                                                        │
│  │  PARTICIPANTS│  Users tracking/working on the run.                    │
│  │              │  Distinct from channel members.                         │
│  └──────────────┘                                                        │
│                                                                          │
│  ┌──────────────┐         ┌─────────────────┐                           │
│  │  CHECKLIST   │────────▶│  CHANNEL LINK   │                           │
│  │  (no playbook)         │                 │                           │
│  │              │         │  Public channel  │                           │
│  │  TeamID: set │         │  Private channel │                           │
│  │  -or-        │         │  DM channel      │                           │
│  │  TeamID: ""  │         │  GM channel      │                           │
│  │  (DM/GM)     │         └─────────────────┘                           │
│  └──────────────┘                                                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Cross-Section: Entity × Channel Type

### Playbooks

| Aspect | Public Channel | Private Channel | DM Channel | GM Channel |
|--------|---------------|-----------------|------------|------------|
| **Playbook scoped to** | Team | Team | Team | Team |
| **Can link to (default)** | ✅ | ✅ | ✅ | ✅ |
| **Playbook members** | Team-scoped users | Team-scoped users | Team-scoped users | Team-scoped users |
| **Playbook visibility** | Backstage of owning team | Same | Same | Same |

> Playbooks are always team-scoped. DM/GM is a channel-link option, not a playbook-level concept.

---

### Playbook Runs (linked to channel)

| Aspect | Public Channel | Private Channel | DM Channel | GM Channel |
|--------|---------------|-----------------|------------|------------|
| **Create run** | ✅ | ✅ | ✅ | ✅ |
| **Run's TeamID** | Channel's team | Channel's team | `""` (empty) | `""` (empty) |
| **Move to this channel type** | ✅ | ✅ | ✅ (TeamID→"") | ✅ (TeamID→"") |
| **Move from this channel type** | ✅ | ✅ | ✅ (TeamID updated) | ✅ (TeamID updated) |
| **Owner on creation** | Playbook default or run starter | Same | Run starter always (default owner skipped) | Run starter always (default owner skipped) |
| **Invite participants on start** | ✅ Playbook's invite list | ✅ | ❌ Skipped (can't add to DM/GM) | ❌ Skipped |
| **Add participant to channel action** | ✅ | ✅ | ❌ Skipped (server + UI disabled) | ❌ Skipped |
| **Remove participant from channel action** | ✅ | ✅ | ❌ Skipped (server + UI disabled) | ❌ Skipped |
| **Status updates** | ✅ | ✅ | ✅ | ✅ |
| **Broadcast to channels** | ✅ | ✅ | ✅ | ✅ |
| **Outgoing webhooks** | ✅ | ✅ | ✅ | ✅ |
| **Reminders** | ✅ | ✅ | ✅ (URL: `/messages/{id}`) | ✅ (URL: `/messages/{id}`) |

---

### Checklists (no playbook, linked to channel)

| Aspect | Public Channel | Private Channel | DM Channel | GM Channel |
|--------|---------------|-----------------|------------|------------|
| **Create checklist** | ✅ | ✅ | ✅ | ✅ |
| **Checklist's TeamID** | Channel's team | Channel's team | `""` (empty) | `""` (empty) |
| **Move to this channel type** | ✅ | ✅ | ✅ (TeamID→"") | ✅ (TeamID→"") |
| **Status updates** | ✅ | ✅ | ✅ | ✅ |
| **Task assignment** | Team member search | Team member search | Channel member search | Channel member search |
| **Add participant to channel action** | ✅ | ✅ | ❌ Skipped | ❌ Skipped |
| **Remove participant from channel action** | ✅ | ✅ | ❌ Skipped | ❌ Skipped |

---

### Run Participants

| Aspect | Public/Private Channel Run | DM/GM Playbook Run | DM/GM Checklist |
|--------|---------------------------|--------------------|-----------------|
| **Who can be added** | Team members | Playbook's team members | Channel members only |
| **Membership check (server)** | `TeamMembers` table | `TeamMembers` (playbook's team) | `ChannelMembers` table |
| **Search scope (UI)** | `searchProfiles({team_id})` | `searchProfiles({team_id: playbook.team_id})` | Local channel member filter |
| **"Add to channel" checkbox** | ✅ Visible | ❌ Hidden (can't add to DM/GM) | ❌ Hidden |
| **Task assignment scope** | Team member search | ❓ Currently channel member search — should it be playbook team? | Channel member search |

---

### Backstage Visibility

| Item | Team A Context | Team B Context | Cross-Team? |
|------|---------------|---------------|-------------|
| **Team A playbook** | ✅ Visible | ❌ | No |
| **Team A playbook run (team channel)** | ✅ Visible | ❌ | No |
| **Team A playbook run (DM/GM channel)** | ✅ Visible (playbook is Team A's) | ❌ | No — scoped to playbook's team |
| **DM/GM checklist (no playbook)** | ✅ Visible (if channel member) | ✅ Visible (if channel member) | Yes — checklists are teamless |
| **Team B playbook run (team channel)** | ❌ | ✅ Visible | No |

---

### Backstage Visibility — Permission Model

| User Role | Team Channel Run | Team Channel Checklist | DM/GM Playbook Run | DM/GM Checklist |
|-----------|-----------------|----------------------|--------------------|-----------------|
| **Admin** | ✅ All in team (pre-existing) | ✅ All in team (pre-existing) | ✅ All with playbook (pre-existing pattern) | ✅ Only if channel member |
| **Playbook member** | ✅ | N/A (no playbook) | ✅ | N/A |
| **Public playbook + team member** | ✅ | N/A | ✅ | N/A |
| **Run participant** | ✅ | ✅ | ✅ | ✅ |
| **Channel member (non-participant)** | ❌ (need playbook access) | ✅ | ❌ (need playbook access) | ✅ |
| **Non-member of channel** | ✅ (if playbook access) | ❌ | ✅ (if playbook access) | ❌ |
| **Guest** | Only if participant | Only if participant | Only if participant | Only if participant |

---

### Channel RHS Behavior

| Aspect | Public Channel | Private Channel | DM Channel | GM Channel |
|--------|---------------|-----------------|------------|------------|
| **RHS auto-opens** | ✅ (if active run) | ✅ | ✅ (now included in team query) | ✅ |
| **"New checklist" button** | ✅ | ✅ | ✅ | ✅ |
| **"Run a playbook" dropdown** | ✅ | ✅ | ✅ | ✅ |
| **"Channel Actions" menu** | ✅ | ✅ | ❌ Hidden (pre-existing `shouldRender`) | ❌ Hidden |
| **Run list (multiple runs)** | ✅ | ✅ | ✅ | ✅ |
| **Run detail auto-select (1 run)** | ✅ | ✅ | ✅ | ✅ |
| **App bar icon** | ✅ | ✅ | ✅ | ✅ |

> ❓ **"Channel Actions" menu hidden in DM/GM** — pre-existing from master. Should this be revisited now that runs are supported in DM/GM?

---

### Playbook Editor — Automation Hints (when linked to DM/GM)

| Automation | Public/Private | DM/GM | Hint Shown? |
|------------|---------------|-------|-------------|
| **Invite participants** | ✅ Active | ✅ Active (configurable) | Yes — "will not apply when linked to DM/GM" |
| **Assign owner role** | ✅ Active | ✅ Active (configurable) | Yes — "owner will be user who starts the run" |
| **Participant joins → Add to channel** | ✅ Active | ✅ Active (configurable) | Yes — "will not apply when linked to DM/GM" |
| **Participant leaves → Remove from channel** | ✅ Active | ✅ Active (configurable) | Yes — "will not apply when linked to DM/GM" |
| **Send outgoing webhook** | ✅ Active | ✅ Active | No |
| **Broadcast to channels** | ✅ Active | ✅ Active | No |

> All automations remain configurable in the editor. Hints are informational only — the user can override the linked channel at run start time.

---

### Start Run Dialog — DM/GM Behavior

| Aspect | When Public/Private Selected | When DM/GM Selected |
|--------|----------------------------|---------------------|
| **Channel selector** | Team channels + DM/GM shown | Same |
| **Hint message** | None | "Owner will be you, invitations and channel actions will not apply" |
| **Owner** | Playbook default (if configured) | Run starter (override) |
| **Run name** | Playbook template | Playbook template |
| **Summary** | Playbook template | Playbook template |

---

### Run Actions Modal — DM/GM Behavior

| Action | Public/Private Channel | DM/GM Channel |
|--------|----------------------|---------------|
| **Broadcast update to channels** | ✅ Editable | ✅ Editable |
| **Send outgoing webhook** | ✅ Editable | ✅ Editable |
| **Add participant to channel** | ✅ Editable | ❌ Disabled + hint |
| **Remove participant from channel** | ✅ Editable | ❌ Disabled + hint |

---

### URL/Link Construction

| Channel Type | Backstage Channel Link | Bot Message URL | Webhook URL |
|-------------|----------------------|-----------------|-------------|
| **Public** | `/{team}/channels/{name}` | `/{team}/channels/{name}` | `{siteURL}/{team}/channels/{name}` |
| **Private** | `/{team}/channels/{name}` | `/{team}/channels/{name}` | `{siteURL}/{team}/channels/{name}` |
| **DM** | `/{team}/messages/@{username}` | `/messages/{channelId}` | `{siteURL}/messages/{channelId}` |
| **GM** | `/{team}/messages/{channel.name}` | `/messages/{channelId}` | `{siteURL}/messages/{channelId}` |

> DM backstage links use `@username` (human-readable). Bot/webhook URLs use `channelId` (server doesn't resolve usernames for simplicity).

---

### Open Questions (❓)

1. **Task assignment in DM/GM playbook runs** — Currently scoped to channel members. Should it be scoped to the playbook's team members instead (matching add-participant behavior)?

2. **"Channel Actions" menu in DM/GM** — Hidden via pre-existing `shouldRender`. Should it be shown now that runs/checklists are supported in DM/GM?

3. **Playbook run in DM/GM visible to non-channel-member playbook members** — A user with playbook access but not in the DM/GM can see the run in backstage. They can view run details but can't navigate to the channel. Is this intended?

4. **Cross-team admin visibility** — Admin on Team B can see Team A's run in backstage if it's a cross-team query scenario. The `buildTeamLimitExpr` should prevent this, but warrants verification (see debug investigation in progress).
