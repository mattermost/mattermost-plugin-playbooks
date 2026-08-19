// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
)

const (
	runTypePlaybook         = "playbook"
	runTypeChannelChecklist = "channelChecklist"

	channelModeCreateNew    = "create_new_channel"
	channelModeLinkExisting = "link_existing_channel"

	defaultStatusUpdateLimit = 10
	maxStatusUpdateLimit     = 50
)

// --- Argument structs ---

type ListRunsArgs struct {
	TeamID        string   `json:"team_id,omitempty" jsonschema:"Filter by team ID (26-char Mattermost ID)"`
	ChannelID     string   `json:"channel_id,omitempty" jsonschema:"Filter by channel ID (26-char Mattermost ID). If the agent is operating within a channel, set this to that channel's ID to see only its runs."`
	Status        string   `json:"status,omitempty" jsonschema:"Filter by status: InProgress or Finished"`
	OwnerUserID   string   `json:"owner_user_id,omitempty" jsonschema:"Filter by run owner. Accepts a user ID, 'me' for the current user, or a username with or without @ (for example '@bob')."`
	ParticipantID string   `json:"participant_id,omitempty" jsonschema:"Filter to runs this user participates in. Accepts a user ID, 'me' for the current user (answers 'which runs am I on?'), or a username with or without @. Combined with owner_user_id this is an AND, not an OR."`
	PlaybookID    string   `json:"playbook_id,omitempty" jsonschema:"Filter to runs started from this playbook template (26-char ID). Call list_playbooks first if you only know the template's title."`
	SearchTerm    string   `json:"search_term,omitempty" jsonschema:"Free-text search over run names. Use this to find a run by name instead of paging through everything."`
	OmitEnded     bool     `json:"omit_ended,omitempty" jsonschema:"If true, exclude finished runs."`
	Types         []string `json:"types,omitempty" jsonschema:"Filter by run types. Valid values: playbook (a run started from a playbook template), channelChecklist (a standalone channel checklist)."`
	Page          int      `json:"page,omitempty" jsonschema:"Page number (0-indexed)"`
	PerPage       int      `json:"per_page,omitempty" jsonschema:"Number of results per page (max 100)"`
}

type CreateChecklistArgs struct {
	Name      string                   `json:"name" jsonschema:"Name/title of the checklist run"`
	ChannelID string                   `json:"channel_id" jsonschema:"The Mattermost channel ID to create the checklist in"`
	TeamID    string                   `json:"team_id,omitempty" jsonschema:"Optional team ID. If omitted, the channel's team is used."`
	Summary   string                   `json:"summary,omitempty" jsonschema:"Optional summary/description for the checklist run"`
	Sections  []CreateChecklistSection `json:"sections,omitempty" jsonschema:"Optional initial sections to add after creating the checklist"`
}

type CreateChecklistSection struct {
	Title string                `json:"title" jsonschema:"Section title"`
	Items []CreateChecklistItem `json:"items,omitempty" jsonschema:"Optional initial items in this section"`
}

type CreateChecklistItem struct {
	Title       string `json:"title" jsonschema:"Item title"`
	Description string `json:"description,omitempty" jsonschema:"Optional item description (supports Markdown)"`
	AssigneeID  string `json:"assignee_id,omitempty" jsonschema:"Optional user to assign the item to. Accepts a user ID, 'me' for the current user, or a username with or without @ (for example '@bob')."`
	Command     string `json:"command,omitempty" jsonschema:"Optional slash command to associate with the item"`
	DueDate     int64  `json:"due_date,omitempty" jsonschema:"Optional due date as Unix timestamp in milliseconds"`
}

type GetRunArgs struct {
	RunID string `json:"run_id" jsonschema:"The ID of the playbook run to retrieve"`
}

type UpdateRunStatusArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	Message         string `json:"message" jsonschema:"Status update message (supports Markdown)"`
	ReminderSeconds int64  `json:"reminder_seconds,omitempty" jsonschema:"Seconds until the run's next status-update reminder. Omit to keep the run's existing cadence (its previous reminder, or the playbook's default interval)."`
	FinishRun       bool   `json:"finish_run,omitempty" jsonschema:"If true the run is finished after posting the update"`
}

type FinishRunArgs struct {
	RunID string `json:"run_id" jsonschema:"The ID of the playbook run to finish"`
}

type ChangeRunOwnerArgs struct {
	RunID   string `json:"run_id" jsonschema:"The ID of the playbook run"`
	OwnerID string `json:"owner_id" jsonschema:"The new owner. Accepts a user ID, 'me' for the current user, or a username with or without @ (for example '@bob')."`
}

type RunPlaybookArgs struct {
	PlaybookID      string `json:"playbook_id" jsonschema:"The 26-char ID of the playbook template to start a run from. Call list_playbooks first if you only know its title."`
	Name            string `json:"name,omitempty" jsonschema:"Name for the new run. Required for most playbooks. Omit it only when the playbook has a locked channel-name template (the server then generates the name) or when channel_id links an existing channel; if the server rejects the call for a missing name, retry with one."`
	OwnerUserID     string `json:"owner_user_id,omitempty" jsonschema:"User to own the run. Accepts a user ID, 'me' for the current user, or a username with or without @ (for example '@bob'). Omit to let the server pick (the playbook's default owner, else the caller)."`
	TeamID          string `json:"team_id,omitempty" jsonschema:"Team to create the run in. Omit to use the playbook's own team."`
	ChannelID       string `json:"channel_id,omitempty" jsonschema:"Link the run to this existing channel instead of creating a new one. Omit to follow the playbook's own channel setting."`
	Summary         string `json:"summary,omitempty" jsonschema:"Optional run summary shown on the run overview (supports Markdown)"`
	CreatePublicRun *bool  `json:"create_public_run,omitempty" jsonschema:"Whether a newly created run channel is public. Omit to inherit the playbook's setting. Ignored when the run links an existing channel."`
}

type UpdateRunArgs struct {
	RunID   string  `json:"run_id" jsonschema:"The ID of the playbook run to rename or re-summarize"`
	Name    *string `json:"name,omitempty" jsonschema:"New name for the run. Must not be empty."`
	Summary *string `json:"summary,omitempty" jsonschema:"New run summary (supports Markdown). Send an empty string to clear it."`
}

type RunIDArgs struct {
	RunID string `json:"run_id" jsonschema:"The ID of the playbook run"`
}

type GetStatusUpdatesArgs struct {
	RunID string `json:"run_id" jsonschema:"The ID of the playbook run to read status updates from"`
	Limit int    `json:"limit,omitempty" jsonschema:"How many of the most recent updates to return (default 10, max 50)"`
}

type AddRunParticipantsArgs struct {
	UserIDs           []string `json:"user_ids" jsonschema:"Users to add to the run. Each entry accepts a user ID, 'me' for the current user (join the run), or a username with or without @ — pass '@bob' directly, no lookup step is needed."`
	RunID             string   `json:"run_id" jsonschema:"The ID of the playbook run"`
	ForceAddToChannel bool     `json:"force_add_to_channel,omitempty" jsonschema:"If true, also add the users to the run's channel even when the run does not sync channel membership."`
}

type RemoveRunParticipantArgs struct {
	RunID  string `json:"run_id" jsonschema:"The ID of the playbook run"`
	UserID string `json:"user_id" jsonschema:"User to remove from the run. Accepts a user ID, 'me' for the current user (leave the run), or a username with or without @ (for example '@bob')."`
}

// --- API response types (subset of fields for formatting) ---

type playbookRunSummary struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	CurrentStatus string `json:"current_status"`
	OwnerUserID   string `json:"owner_user_id"`
	TeamID        string `json:"team_id"`
	ChannelID     string `json:"channel_id"`
	PlaybookID    string `json:"playbook_id"`
	Type          string `json:"type"`
	CreateAt      int64  `json:"create_at"`
	EndAt         int64  `json:"end_at"`
}

type listRunsResponse struct {
	TotalCount int                  `json:"total_count"`
	PageCount  int                  `json:"page_count"`
	HasMore    bool                 `json:"has_more"`
	Items      []playbookRunSummary `json:"items"`
}

type checklist struct {
	ID    string          `json:"id"`
	Title string          `json:"title"`
	Items []checklistItem `json:"items"`
}

type checklistItem struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	State       string `json:"state"`
	AssigneeID  string `json:"assignee_id"`
	Command     string `json:"command"`
	Description string `json:"description"`
	DueDate     int64  `json:"due_date"`
	// AssigneeType/AssigneePropertyFieldID describe role-based and
	// property-based assignment. Without them an item assigned to "the run
	// owner" looks unassigned, because assignee_id is empty in that case.
	AssigneeType            string `json:"assignee_type"`
	AssigneePropertyFieldID string `json:"assignee_property_field_id"`
	// LastSkipped carries the JSON name "delete_at" on app.ChecklistItem; it
	// marks when the item was skipped, not when it was deleted.
	LastSkipped int64 `json:"delete_at"`
}

type runStatusPost struct {
	ID       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	DeleteAt int64  `json:"delete_at"`
}

type runTimelineEvent struct {
	ID        string `json:"id"`
	EventType string `json:"event_type"`
}

type playbookRunDetail struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	Summary            string   `json:"summary"`
	CurrentStatus      string   `json:"current_status"`
	OwnerUserID        string   `json:"owner_user_id"`
	ReporterUserID     string   `json:"reporter_user_id"`
	TeamID             string   `json:"team_id"`
	ChannelID          string   `json:"channel_id"`
	PlaybookID         string   `json:"playbook_id"`
	Type               string   `json:"type"`
	SequentialID       string   `json:"sequential_id"`
	RunNumber          int64    `json:"run_number"`
	CreateAt           int64    `json:"create_at"`
	EndAt              int64    `json:"end_at"`
	LastStatusUpdateAt int64    `json:"last_status_update_at"`
	TaskTotal          int      `json:"task_total"`
	TaskCompleted      int      `json:"task_completed"`
	ParticipantIDs     []string `json:"participant_ids"`

	StatusUpdateEnabled bool `json:"status_update_enabled"`
	// PreviousReminder is a time.Duration, so it arrives in nanoseconds even
	// though every reminder the API accepts is expressed in seconds.
	PreviousReminder            int64 `json:"previous_reminder"`
	ReminderTimerDefaultSeconds int64 `json:"reminder_timer_default_seconds"`
	RetrospectiveEnabled        bool  `json:"retrospective_enabled"`
	RetrospectivePublishedAt    int64 `json:"retrospective_published_at"`

	StatusPosts    []runStatusPost    `json:"status_posts"`
	TimelineEvents []runTimelineEvent `json:"timeline_events"`
	Checklists     []checklist        `json:"checklists"`
}

// playbookForRun is the slice of a playbook template that run_playbook needs to
// resolve creation parameters the POST /runs endpoint does not resolve itself.
type playbookForRun struct {
	ID                        string `json:"id"`
	Title                     string `json:"title"`
	TeamID                    string `json:"team_id"`
	ChannelID                 string `json:"channel_id"`
	ChannelMode               string `json:"channel_mode"`
	ChannelNameTemplate       string `json:"channel_name_template"`
	ChannelNameTemplateLocked bool   `json:"channel_name_template_locked"`
	DeleteAt                  int64  `json:"delete_at"`
}

type runStatusUpdate struct {
	ID             string `json:"id"`
	CreateAt       int64  `json:"create_at"`
	DeleteAt       int64  `json:"delete_at"`
	Message        string `json:"message"`
	AuthorUserName string `json:"author_user_name"`
}

type runMetadata struct {
	ChannelName        string   `json:"channel_name"`
	ChannelDisplayName string   `json:"channel_display_name"`
	TeamName           string   `json:"team_name"`
	NumParticipants    int64    `json:"num_participants"`
	TotalPosts         int64    `json:"total_posts"`
	Followers          []string `json:"followers"`
}

// --- Tool registration ---

func (p *PlaybooksToolProvider) addMCPHelperRunTools(server *mcphelper.Server) {
	addMCPHelperTool(server, p.clientFactory, "run_playbook",
		"Start a playbook run from a playbook template — users say \"start the incident playbook\", \"run/launch/kick off a playbook\", \"begin a new incident\". Creates the active run, its channel, and copies the playbook's checklists. A playbook is a reusable template; a run is one active instance of it, so this tool is how a template becomes something people work in. If you do not know the playbook_id, call list_playbooks first — never guess it. owner_user_id accepts a username with or without @, 'me', or a user ID. Omit name only when the playbook generates it from a locked channel-name template; otherwise supply one. Returns the new run's name, ID, run number, channel, owner, and browser URL. Example: {\"playbook_id\": \"abc123...\", \"name\": \"Sev1 — checkout 500s\", \"owner_user_id\": \"me\", \"summary\": \"Checkout is returning 500s for ~5% of requests.\"}",
		toolRunPlaybook)

	addMCPHelperTool(server, p.clientFactory, "list_runs",
		"List and search playbook runs (active playbook instances, incidents, ongoing checklists) with filters for team, channel, owner, participant, playbook template, status, and free-text name search. Use this to find a run_id before acting on a run. status='InProgress' shows active runs; participant_id='me' shows runs the current user is on and also accepts a username such as '@bob'; playbook_id restricts to runs of one playbook template; types=[\"channelChecklist\"] shows standalone channel checklists. To start a new run from a template use run_playbook instead. Example: {\"status\": \"InProgress\", \"participant_id\": \"me\", \"search_term\": \"checkout\", \"per_page\": 5}",
		toolListRuns)

	addMCPHelperTool(server, p.clientFactory, "create_checklist",
		"Create a standalone ad-hoc channel checklist in an existing Mattermost channel — a playbook run with NO playbook template behind it, which copies no checklists, tasks, or settings from any playbook. This is NOT a way to start a playbook: if the user named a playbook (\"start the incident playbook\"), call run_playbook, which copies the template's content; using this tool instead silently produces an empty run with none of it. Use this only for a task list typed out from scratch. The authenticated user becomes the owner, and you may include initial sections and items; item assignee_id accepts a username with or without @, 'me', or a user ID. Example: {\"name\": \"Release checklist\", \"channel_id\": \"abc123...\", \"sections\": [{\"title\": \"Pre-release\", \"items\": [{\"title\": \"Confirm changelog\"}]}]}",
		toolCreateChecklist)

	addMCPHelperTool(server, p.clientFactory, "get_run",
		"Get the full state of one playbook run: status, owner, reporter, run number, task progress, channel/team, participants, and every checklist item with its zero-based [checklist_number][item_number] index, state, assignee and due date. Call this before acting on a run, and to read the indexes the checklist tools need. Status update text is not included — call get_status_updates for that. Example: {\"run_id\": \"abc123...\"}",
		toolGetRun)

	addMCPHelperTool(server, p.clientFactory, "get_run_metadata",
		"Get a playbook run's channel name, channel display name, team name, participant count, post count, and followers, so you can say \"the run lives in ~incident-42\" instead of quoting raw 26-character IDs. Example: {\"run_id\": \"abc123...\"}",
		toolGetRunMetadata)

	addMCPHelperTool(server, p.clientFactory, "update_run",
		"Rename a playbook run or edit its run summary (the overview description). Provide name, summary, or both — at least one is required. Renaming does not rename the run's channel. Finished runs cannot be edited; restore_run first. If you do not know the run_id, call list_runs or resolve_channel_context. Example: {\"run_id\": \"abc123...\", \"name\": \"Sev2 — checkout latency\", \"summary\": \"Latency recovered; monitoring.\"}",
		toolUpdateRun)

	addMCPHelperTool(server, p.clientFactory, "update_run_status",
		"Post a status update to a playbook run (progress update, situation report). The message supports Markdown. Posting an update also reschedules the run's next status-update reminder: omit reminder_seconds to keep the run's existing cadence, or set it explicitly. Set finish_run=true to post a final update and close the run in one call. You must be a run participant. Example: {\"run_id\": \"abc123...\", \"message\": \"Investigation complete, root cause identified.\", \"reminder_seconds\": 1800}",
		toolUpdateRunStatus)

	addMCPHelperTool(server, p.clientFactory, "get_status_updates",
		"Read the text of past status updates posted to a playbook run, newest first, with author and timestamp. This is the only way to see what previous updates actually said — get_run does not include their text. Use it to summarize how a run or incident has progressed. Example: {\"run_id\": \"abc123...\", \"limit\": 5}",
		toolGetStatusUpdates)

	addMCPHelperTool(server, p.clientFactory, "request_status_update",
		"Ask the owner of a playbook run for a status update (nudge them). Posts a request in the run's channel; it does not post an update itself — use update_run_status for that. Example: {\"run_id\": \"abc123...\"}",
		toolRequestStatusUpdate)

	addMCPHelperTool(server, p.clientFactory, "finish_run",
		"Finish (close, complete, end, resolve) a playbook run, marking it Finished. Depending on the playbook's settings you may need to be the run owner or a system admin rather than just a participant, and an already-finished run cannot be finished again. Reopen a run with restore_run. Example: {\"run_id\": \"abc123...\"}",
		toolFinishRun)

	addMCPHelperTool(server, p.clientFactory, "restore_run",
		"Reopen a finished playbook run (un-finish, restore, \"we closed it too early\"), moving it back to In Progress. This is the inverse of finish_run and is required before a finished run can be edited again. Example: {\"run_id\": \"abc123...\"}",
		toolRestoreRun)

	addMCPHelperTool(server, p.clientFactory, "change_run_owner",
		"Change the owner (lead, commander) of a playbook run — \"hand this run to @alice\". owner_id accepts a username with or without @, 'me', or a 26-character user ID. If the new owner is not already in the run's channel you need permission to add channel members, otherwise the server rejects the change. The run must still be in progress. Example: {\"run_id\": \"abc123...\", \"owner_id\": \"@alice\"}",
		toolChangeRunOwner)

	addMCPHelperTool(server, p.clientFactory, "add_run_participants",
		"Add people to a playbook run, or join a run yourself — \"add @alice to this run\", \"put me on the incident\". Pass usernames directly in user_ids: each entry accepts a username with or without @, 'me' for the current user, or a 26-character user ID. There is no separate user-lookup tool and you do not need one. Participants show up on the run and can be assigned tasks. Set force_add_to_channel=true to also add them to the run's channel when the run does not sync channel membership. Example: {\"run_id\": \"abc123...\", \"user_ids\": [\"@alice\", \"me\"], \"force_add_to_channel\": true}",
		toolAddRunParticipants)

	addMCPHelperTool(server, p.clientFactory, "remove_run_participant",
		"Remove someone from a playbook run, or leave a run yourself — \"take @bob off this run\", \"remove me from the incident\". user_id accepts a username with or without @, 'me' to leave, or a 26-character user ID. The removed user also stops following the run. The run's owner cannot be removed: hand the run over with change_run_owner first. Example: {\"run_id\": \"abc123...\", \"user_id\": \"@bob\"}",
		toolRemoveRunParticipant)

	addMCPHelperTool(server, p.clientFactory, "follow_run",
		"Follow a playbook run to get notified about its status updates, without becoming a participant. Use add_run_participants instead to actually join the run. Example: {\"run_id\": \"abc123...\"}",
		toolFollowRun)

	addMCPHelperTool(server, p.clientFactory, "unfollow_run",
		"Unfollow a playbook run and stop getting notified about its status updates. This does not remove you as a participant — use remove_run_participant for that. Example: {\"run_id\": \"abc123...\"}",
		toolUnfollowRun)
}

// --- Tool implementations ---

func toolListRuns(ctx context.Context, client APIClient, args ListRunsArgs) (string, error) {
	params := url.Values{}
	if args.Page < 0 {
		return "", fmt.Errorf("page must be >= 0")
	}
	if args.TeamID != "" {
		params.Set("team_id", args.TeamID)
	}
	if args.ChannelID != "" {
		if err := validateID(args.ChannelID, "channel_id"); err != nil {
			return "", err
		}
		params.Set("channel_id", args.ChannelID)
	}
	if args.Status != "" {
		params.Add("statuses", args.Status)
	}
	// The list endpoint resolves the literal "me" itself but knows nothing of
	// usernames, so resolve both filters here for one consistent convention.
	if owner, err := resolveUserRef(ctx, client, args.OwnerUserID, "owner_user_id"); err != nil {
		return "", err
	} else if owner != "" {
		params.Set("owner_user_id", owner)
	}
	if participant, err := resolveUserRef(ctx, client, args.ParticipantID, "participant_id"); err != nil {
		return "", err
	} else if participant != "" {
		params.Set("participant_id", participant)
	}
	if args.PlaybookID != "" {
		if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
			return "", err
		}
		params.Set("playbook_id", args.PlaybookID)
	}
	if search := strings.TrimSpace(args.SearchTerm); search != "" {
		params.Set("search_term", search)
	}
	if args.OmitEnded {
		params.Set("omit_ended", "true")
	}
	for _, runType := range args.Types {
		if err := validateRunType(runType); err != nil {
			return "", err
		}
		params.Add("types", runType)
	}

	perPage := args.PerPage
	if perPage <= 0 {
		perPage = 10
	}
	if perPage > 100 {
		perPage = 100
	}
	params.Set("page", fmt.Sprintf("%d", args.Page))
	params.Set("per_page", fmt.Sprintf("%d", perPage))

	var resp listRunsResponse
	if err := client.Get(ctx, "runs", params, &resp); err != nil {
		return "", fmt.Errorf("failed to list runs: %w", err)
	}

	return formatListRuns(resp), nil
}

func toolCreateChecklist(ctx context.Context, client APIClient, args CreateChecklistArgs) (string, error) {
	name := strings.TrimSpace(args.Name)
	if name == "" {
		return "", fmt.Errorf("name is required")
	}
	if err := validateID(args.ChannelID, "channel_id"); err != nil {
		return "", err
	}
	if args.TeamID != "" {
		if err := validateID(args.TeamID, "team_id"); err != nil {
			return "", err
		}
	}
	sections, err := resolveInitialSections(ctx, client, args.Sections)
	if err != nil {
		return "", err
	}

	ownerUserID, err := client.GetCurrentUserID(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get current user ID: %w", err)
	}

	body := map[string]any{
		"name":          name,
		"owner_user_id": ownerUserID,
		"channel_id":    args.ChannelID,
		"playbook_id":   "",
	}
	if args.TeamID != "" {
		body["team_id"] = args.TeamID
	}
	if args.Summary != "" {
		body["summary"] = args.Summary
	}

	var run playbookRunDetail
	if err := client.Post(ctx, "runs", body, &run); err != nil {
		return "", fmt.Errorf("failed to create checklist: %w", err)
	}

	for i, section := range sections {
		sectionBody := map[string]any{
			"title": section.Title,
			"items": section.Items,
		}
		if err := client.Post(ctx, fmt.Sprintf("runs/%s/checklists", run.ID), sectionBody, nil); err != nil {
			return "", fmt.Errorf("created checklist run %s, but failed to add section %d: %w", run.ID, i, err)
		}
	}

	if len(sections) > 0 {
		if err := client.Get(ctx, fmt.Sprintf("runs/%s", run.ID), nil, &run); err != nil {
			return "", fmt.Errorf("created checklist run %s, but failed to fetch updated details: %w", run.ID, err)
		}
	}

	return formatRunDetail(run), nil
}

func toolGetRun(ctx context.Context, client APIClient, args GetRunArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}

	var run playbookRunDetail
	if err := client.Get(ctx, fmt.Sprintf("runs/%s", args.RunID), nil, &run); err != nil {
		return "", wrapRunError(err, args.RunID, "get")
	}

	return formatRunDetail(run), nil
}

func toolUpdateRunStatus(ctx context.Context, client APIClient, args UpdateRunStatusArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if strings.TrimSpace(args.Message) == "" {
		return "", fmt.Errorf("message is required")
	}

	// The "reminder" field is deserialized into time.Duration on the server,
	// but the codebase convention (see client/playbook_runs.go:144 and
	// server/api/playbook_runs.go updateStatusDialog) treats the raw int64
	// as seconds, not nanoseconds. Do NOT multiply by time.Second here.
	reminder := args.ReminderSeconds
	if reminder <= 0 && !args.FinishRun {
		// The API rejects a zero reminder on a non-finishing update, so one has
		// to be sent. Inherit the run's own cadence rather than imposing an
		// hour on a run that, say, updates daily.
		run, err := fetchRunForBounds(ctx, client, args.RunID)
		if err != nil {
			return "", err
		}
		reminder = defaultReminderSecondsForRun(run)
	}

	body := map[string]any{
		"message":    args.Message,
		"reminder":   reminder,
		"finish_run": args.FinishRun,
	}

	if err := client.Post(ctx, fmt.Sprintf("runs/%s/status", args.RunID), body, nil); err != nil {
		return "", wrapRunError(err, args.RunID, "post a status update to")
	}

	return fmt.Sprintf("Status update posted to run %s.", args.RunID), nil
}

func toolFinishRun(ctx context.Context, client APIClient, args FinishRunArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}

	if err := client.Put(ctx, fmt.Sprintf("runs/%s/finish", args.RunID), nil, nil); err != nil {
		return "", wrapRunError(err, args.RunID, "finish")
	}

	return fmt.Sprintf("Run %s has been finished.", args.RunID), nil
}

func toolChangeRunOwner(ctx context.Context, client APIClient, args ChangeRunOwnerArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	ownerID, err := resolveUserRef(ctx, client, args.OwnerID, "owner_id")
	if err != nil {
		return "", err
	}
	if ownerID == "" {
		return "", fmt.Errorf("owner_id is required")
	}

	body := map[string]string{
		"owner_id": ownerID,
	}

	if err := client.Post(ctx, fmt.Sprintf("runs/%s/owner", args.RunID), body, nil); err != nil {
		return "", wrapRunError(err, args.RunID, "change the owner of")
	}

	return fmt.Sprintf("Owner of run %s changed to %s.", args.RunID, ownerID), nil
}

// defaultReminderSecondsForRun picks the reminder interval to send with a
// status update when the caller did not specify one: the run's own previous
// reminder (stored as a time.Duration in nanoseconds), else the interval the
// playbook configured, else one hour.
func defaultReminderSecondsForRun(run playbookRunDetail) int64 {
	if run.PreviousReminder > 0 {
		if seconds := run.PreviousReminder / int64(time.Second); seconds > 0 {
			return seconds
		}
	}
	if run.ReminderTimerDefaultSeconds > 0 {
		return run.ReminderTimerDefaultSeconds
	}
	return 3600
}

func toolRunPlaybook(ctx context.Context, client APIClient, args RunPlaybookArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}
	if args.TeamID != "" {
		if err := validateID(args.TeamID, "team_id"); err != nil {
			return "", err
		}
	}
	if args.ChannelID != "" {
		if err := validateID(args.ChannelID, "channel_id"); err != nil {
			return "", err
		}
	}

	ownerUserID, err := resolveUserRef(ctx, client, args.OwnerUserID, "owner_user_id")
	if err != nil {
		return "", err
	}

	// Fetch the playbook first: it validates the ID with an actionable error,
	// supplies the default team, and carries the channel mode that POST /runs
	// deliberately does not read (the webapp resolves it client-side too).
	var playbook playbookForRun
	if err := client.Get(ctx, fmt.Sprintf("playbooks/%s", args.PlaybookID), nil, &playbook); err != nil {
		return "", wrapPlaybookError(err, args.PlaybookID, "start a run from")
	}
	if playbook.DeleteAt != 0 {
		return "", fmt.Errorf("playbook %s (%q) is archived and cannot be used to start a run; call list_playbooks to pick an active playbook, or restore_playbook to un-archive this one", args.PlaybookID, playbook.Title)
	}

	channelID := args.ChannelID
	if channelID == "" && playbook.ChannelMode == channelModeLinkExisting && playbook.ChannelID != "" {
		channelID = playbook.ChannelID
	}

	name := strings.TrimSpace(args.Name)
	templateLocked := playbook.ChannelNameTemplate != "" && playbook.ChannelNameTemplateLocked
	if name == "" && channelID == "" && !templateLocked {
		return "", fmt.Errorf("name is required to start a run from playbook %s (%q): it creates a new channel and the playbook has no locked channel-name template to generate a name from", args.PlaybookID, playbook.Title)
	}

	body := map[string]any{"playbook_id": args.PlaybookID}
	if name != "" {
		body["name"] = name
	}
	if ownerUserID != "" {
		body["owner_user_id"] = ownerUserID
	}
	if channelID != "" {
		body["channel_id"] = channelID
	}
	// The server derives the team from the channel and rejects a team_id that
	// disagrees with it, so only default from the playbook when no channel is
	// being linked.
	switch {
	case args.TeamID != "":
		body["team_id"] = args.TeamID
	case channelID == "" && playbook.TeamID != "":
		body["team_id"] = playbook.TeamID
	}
	if summary := strings.TrimSpace(args.Summary); summary != "" {
		body["summary"] = summary
	}
	if args.CreatePublicRun != nil {
		body["create_public_run"] = *args.CreatePublicRun
	}

	var run playbookRunDetail
	if err := client.Post(ctx, "runs", body, &run); err != nil {
		return "", fmt.Errorf("failed to start a run from playbook %s (%q): %w", args.PlaybookID, playbook.Title, err)
	}

	return formatStartedRun(client, playbook, run, channelID != ""), nil
}

func toolUpdateRun(ctx context.Context, client APIClient, args UpdateRunArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if args.Name == nil && args.Summary == nil {
		return "", fmt.Errorf("at least one field (name or summary) must be provided")
	}

	body := map[string]any{}
	if args.Name != nil {
		name := strings.TrimSpace(*args.Name)
		if name == "" {
			return "", fmt.Errorf("name must not be empty")
		}
		body["name"] = name
	}
	if args.Summary != nil {
		body["summary"] = *args.Summary
	}

	if err := client.Patch(ctx, fmt.Sprintf("runs/%s", args.RunID), body, nil); err != nil {
		return "", wrapRunError(err, args.RunID, "update", "Finished runs cannot be edited — call restore_run first.")
	}

	switch {
	case args.Name != nil && args.Summary != nil:
		return fmt.Sprintf("Run %s renamed to %q and its summary updated.", args.RunID, body["name"]), nil
	case args.Name != nil:
		return fmt.Sprintf("Run %s renamed to %q.", args.RunID, body["name"]), nil
	default:
		return fmt.Sprintf("Summary of run %s updated.", args.RunID), nil
	}
}

func toolRestoreRun(ctx context.Context, client APIClient, args RunIDArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := client.Put(ctx, fmt.Sprintf("runs/%s/restore", args.RunID), nil, nil); err != nil {
		return "", wrapRunError(err, args.RunID, "restore", "Restoring can require being the run owner or a system admin.")
	}
	return fmt.Sprintf("Run %s reopened and is In Progress again.", args.RunID), nil
}

func toolRequestStatusUpdate(ctx context.Context, client APIClient, args RunIDArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := client.Post(ctx, fmt.Sprintf("runs/%s/request-update", args.RunID), nil, nil); err != nil {
		return "", wrapRunError(err, args.RunID, "request a status update for")
	}
	return fmt.Sprintf("Requested a status update from the owner of run %s.", args.RunID), nil
}

func toolFollowRun(ctx context.Context, client APIClient, args RunIDArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := client.Put(ctx, fmt.Sprintf("runs/%s/followers", args.RunID), nil, nil); err != nil {
		return "", wrapRunError(err, args.RunID, "follow")
	}
	return fmt.Sprintf("Now following run %s; you will be notified about its status updates.", args.RunID), nil
}

func toolUnfollowRun(ctx context.Context, client APIClient, args RunIDArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := client.Delete(ctx, fmt.Sprintf("runs/%s/followers", args.RunID)); err != nil {
		return "", wrapRunError(err, args.RunID, "unfollow")
	}
	return fmt.Sprintf("No longer following run %s.", args.RunID), nil
}

func toolGetStatusUpdates(ctx context.Context, client APIClient, args GetStatusUpdatesArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	limit := args.Limit
	if limit <= 0 {
		limit = defaultStatusUpdateLimit
	}
	if limit > maxStatusUpdateLimit {
		limit = maxStatusUpdateLimit
	}

	var updates []runStatusUpdate
	if err := client.Get(ctx, fmt.Sprintf("runs/%s/status-updates", args.RunID), nil, &updates); err != nil {
		return "", wrapRunError(err, args.RunID, "get status updates for")
	}

	return formatStatusUpdates(args.RunID, updates, limit), nil
}

func toolGetRunMetadata(ctx context.Context, client APIClient, args RunIDArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}

	var metadata runMetadata
	if err := client.Get(ctx, fmt.Sprintf("runs/%s/metadata", args.RunID), nil, &metadata); err != nil {
		return "", wrapRunError(err, args.RunID, "get metadata for")
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "Run %s:\n", args.RunID)
	if metadata.ChannelDisplayName != "" || metadata.ChannelName != "" {
		fmt.Fprintf(&sb, "- Channel: %s (~%s)\n", metadata.ChannelDisplayName, metadata.ChannelName)
	} else {
		sb.WriteString("- Channel: (not visible to you)\n")
	}
	if metadata.TeamName != "" {
		fmt.Fprintf(&sb, "- Team: %s\n", metadata.TeamName)
	}
	fmt.Fprintf(&sb, "- Participants: %d\n", metadata.NumParticipants)
	fmt.Fprintf(&sb, "- Posts in channel: %d\n", metadata.TotalPosts)
	fmt.Fprintf(&sb, "- Followers: %d", len(metadata.Followers))
	if len(metadata.Followers) > 0 {
		fmt.Fprintf(&sb, " (%s)", strings.Join(metadata.Followers, ", "))
	}
	return sb.String(), nil
}

func toolAddRunParticipants(ctx context.Context, client APIClient, args AddRunParticipantsArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if len(args.UserIDs) == 0 {
		return "", fmt.Errorf("user_ids is required; pass 'me' to join the run yourself, or a username such as '@bob'")
	}

	userIDs, err := resolveUserRefs(ctx, client, args.UserIDs, "user_ids")
	if err != nil {
		return "", err
	}

	body := map[string]any{
		"user_ids":             userIDs,
		"force_add_to_channel": args.ForceAddToChannel,
	}
	if err := client.Post(ctx, fmt.Sprintf("runs/%s/participants", args.RunID), body, nil); err != nil {
		return "", wrapRunError(err, args.RunID, "add participants to",
			"Adding someone other than yourself requires run-manage permission and an in-progress run.")
	}

	return fmt.Sprintf("Added %d participant(s) to run %s: %s.", len(userIDs), args.RunID, strings.Join(userIDs, ", ")), nil
}

func toolRemoveRunParticipant(ctx context.Context, client APIClient, args RemoveRunParticipantArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	userID, err := resolveUserRef(ctx, client, args.UserID, "user_id")
	if err != nil {
		return "", err
	}
	if userID == "" {
		return "", fmt.Errorf("user_id is required; pass 'me' to leave the run yourself, or a username such as '@bob'")
	}

	// Fetch first so removing a non-participant reports the actual roster
	// instead of an opaque API error.
	run, err := fetchRunForBounds(ctx, client, args.RunID)
	if err != nil {
		return "", err
	}
	if run.OwnerUserID == userID {
		return "", fmt.Errorf("user %s owns run %s and cannot be removed from it; hand the run over with change_run_owner first", userID, args.RunID)
	}
	if !containsString(run.ParticipantIDs, userID) {
		return fmt.Sprintf("User %s is not a participant of run %s; no change made. Current participants: %s.",
			userID, args.RunID, formatIDList(run.ParticipantIDs)), nil
	}

	if err := client.Delete(ctx, fmt.Sprintf("runs/%s/participants/%s", args.RunID, userID)); err != nil {
		return "", wrapRunError(err, args.RunID, fmt.Sprintf("remove participant %s from", userID),
			"Removing someone other than yourself requires run-manage permission and an in-progress run.")
	}

	return fmt.Sprintf("Removed user %s from run %s; they no longer follow the run.", userID, args.RunID), nil
}

func containsString(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

func validateRunType(runType string) error {
	switch runType {
	case runTypePlaybook, runTypeChannelChecklist:
		return nil
	default:
		return fmt.Errorf("types entries must be one of %s or %s", runTypePlaybook, runTypeChannelChecklist)
	}
}

// resolveInitialSections validates section titles and returns a copy whose
// item assignees are resolved to user IDs, so a caller may write
// "assignee_id": "@bob" the same way it can everywhere else.
func resolveInitialSections(ctx context.Context, client APIClient, sections []CreateChecklistSection) ([]CreateChecklistSection, error) {
	resolved := make([]CreateChecklistSection, 0, len(sections))
	for i, section := range sections {
		title := strings.TrimSpace(section.Title)
		if title == "" {
			return nil, fmt.Errorf("sections[%d].title is required", i)
		}
		items, err := resolveChecklistItems(ctx, client, section.Items, fmt.Sprintf("sections[%d].items", i))
		if err != nil {
			return nil, err
		}
		resolved = append(resolved, CreateChecklistSection{Title: title, Items: items})
	}
	return resolved, nil
}

// resolveChecklistItems trims titles and resolves assignee references,
// returning a copy so the caller's arguments are left untouched.
func resolveChecklistItems(ctx context.Context, client APIClient, items []CreateChecklistItem, field string) ([]CreateChecklistItem, error) {
	resolved := make([]CreateChecklistItem, 0, len(items))
	for i, item := range items {
		item.Title = strings.TrimSpace(item.Title)
		if item.Title == "" {
			return nil, fmt.Errorf("%s[%d].title is required", field, i)
		}
		assignee, err := resolveUserRef(ctx, client, item.AssigneeID, fmt.Sprintf("%s[%d].assignee_id", field, i))
		if err != nil {
			return nil, err
		}
		item.AssigneeID = assignee
		resolved = append(resolved, item)
	}
	return resolved, nil
}

// --- Formatting helpers ---

func formatListRuns(resp listRunsResponse) string {
	if len(resp.Items) == 0 {
		return "No playbook runs found matching the criteria."
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "Found %d runs (showing %d):\n\n", resp.TotalCount, len(resp.Items))

	for _, r := range resp.Items {
		fmt.Fprintf(&sb, "- **%s** (ID: %s)\n", r.Name, r.ID)
		fmt.Fprintf(&sb, "  Type: %s | Status: %s | Owner: %s | Playbook: %s\n", r.Type, r.CurrentStatus, r.OwnerUserID, r.PlaybookID)
	}

	if resp.HasMore {
		sb.WriteString("\n(More results available — use page parameter to paginate)")
	}

	return sb.String()
}

// formatRunDetail renders a run compactly rather than dumping its JSON: the
// raw payload is large, low-signal, and the checklist indexes the other tools
// need get buried in it.
func formatRunDetail(run playbookRunDetail) string {
	var sb strings.Builder

	fmt.Fprintf(&sb, "**%s** (run_id: %s)\n", run.Name, run.ID)
	if run.SequentialID != "" {
		fmt.Fprintf(&sb, "- Run number: %s\n", run.SequentialID)
	} else if run.RunNumber > 0 {
		fmt.Fprintf(&sb, "- Run number: %d\n", run.RunNumber)
	}
	fmt.Fprintf(&sb, "- Status: %s | Type: %s\n", displayRunStatus(run.CurrentStatus), displayRunType(run.Type))
	fmt.Fprintf(&sb, "- Owner: %s | Reporter: %s\n", displayOrNone(run.OwnerUserID), displayOrNone(run.ReporterUserID))
	fmt.Fprintf(&sb, "- Team: %s | Channel: %s\n", displayOrNone(run.TeamID), displayOrNone(run.ChannelID))
	if run.PlaybookID != "" {
		fmt.Fprintf(&sb, "- Started from playbook: %s\n", run.PlaybookID)
	}
	fmt.Fprintf(&sb, "- Created at: %d (epoch ms)", run.CreateAt)
	if run.EndAt != 0 {
		fmt.Fprintf(&sb, " | Ended at: %d", run.EndAt)
	}
	sb.WriteString("\n")

	total, completed := runTaskProgress(run)
	fmt.Fprintf(&sb, "- Tasks: %d/%d complete\n", completed, total)

	fmt.Fprintf(&sb, "- Status updates: %s", displayEnabled(run.StatusUpdateEnabled))
	if run.LastStatusUpdateAt != 0 {
		fmt.Fprintf(&sb, ", last posted at %d", run.LastStatusUpdateAt)
	}
	if seconds := run.PreviousReminder / int64(time.Second); seconds > 0 {
		fmt.Fprintf(&sb, ", next reminder in %ds", seconds)
	} else if run.ReminderTimerDefaultSeconds > 0 {
		fmt.Fprintf(&sb, ", default interval %ds", run.ReminderTimerDefaultSeconds)
	}
	sb.WriteString("\n")

	fmt.Fprintf(&sb, "- Retrospective: %s", displayEnabled(run.RetrospectiveEnabled))
	if run.RetrospectivePublishedAt != 0 {
		fmt.Fprintf(&sb, ", published at %d", run.RetrospectivePublishedAt)
	} else if run.RetrospectiveEnabled {
		sb.WriteString(", not published yet")
	}
	sb.WriteString("\n")

	if summary := strings.TrimSpace(run.Summary); summary != "" {
		fmt.Fprintf(&sb, "\nSummary:\n%s\n", summary)
	}

	fmt.Fprintf(&sb, "\nParticipants (%d): %s\n", len(run.ParticipantIDs), formatIDList(run.ParticipantIDs))

	sb.WriteString("\nChecklists (indexes are zero-based [checklist_number][item_number]):\n")
	writeRunChecklistsVerbose(&sb, run)

	if count := len(run.StatusPosts); count > 0 {
		fmt.Fprintf(&sb, "\n%d status update(s) posted — call get_status_updates to read them.\n", count)
	} else {
		sb.WriteString("\nNo status updates posted yet.\n")
	}
	if count := len(run.TimelineEvents); count > 0 {
		fmt.Fprintf(&sb, "%d timeline event(s) recorded (not listed here).\n", count)
	}

	return strings.TrimRight(sb.String(), "\n")
}

// formatStartedRun summarizes a freshly created run: enough for the model to
// report back and to keep acting on the run, without re-dumping every field.
func formatStartedRun(client APIClient, playbook playbookForRun, run playbookRunDetail, linkedExistingChannel bool) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "Started run **%s** (run_id: %s) from playbook %q.\n", run.Name, run.ID, playbook.Title)
	if run.SequentialID != "" {
		fmt.Fprintf(&sb, "- Run number: %s\n", run.SequentialID)
	} else if run.RunNumber > 0 {
		fmt.Fprintf(&sb, "- Run number: %d\n", run.RunNumber)
	}
	fmt.Fprintf(&sb, "- Owner: %s\n", displayOrNone(run.OwnerUserID))
	channelNote := "new channel created"
	if linkedExistingChannel {
		channelNote = "linked to an existing channel"
	}
	fmt.Fprintf(&sb, "- Channel: %s (%s)\n", displayOrNone(run.ChannelID), channelNote)
	total, completed := runTaskProgress(run)
	fmt.Fprintf(&sb, "- Checklists: %d, tasks: %d/%d complete\n", len(run.Checklists), completed, total)
	fmt.Fprintf(&sb, "- URL: %s\n", client.GetRunURL(run.ID))

	// The checklists copied from the playbook are what the caller acts on
	// next, so surface their indexes here rather than making them call
	// get_run just to learn a checklist_number.
	sb.WriteString("\nSections copied from the playbook:\n")
	writeRunSectionIndexes(&sb, run, -1)

	return strings.TrimRight(sb.String(), "\n")
}

func formatStatusUpdates(runID string, updates []runStatusUpdate, limit int) string {
	visible := make([]runStatusUpdate, 0, len(updates))
	for _, update := range updates {
		if update.DeleteAt != 0 {
			continue
		}
		visible = append(visible, update)
	}
	if len(visible) == 0 {
		return fmt.Sprintf("No status updates have been posted to run %s yet.", runID)
	}

	// Truncating to limit only yields the most recent updates if the newest
	// sort first, so don't rely on the endpoint's ordering for that.
	sort.SliceStable(visible, func(i, j int) bool {
		return visible[i].CreateAt > visible[j].CreateAt
	})

	shown := visible
	if len(shown) > limit {
		shown = shown[:limit]
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "%d status update(s) on run %s, newest first (showing %d):\n", len(visible), runID, len(shown))
	for _, update := range shown {
		fmt.Fprintf(&sb, "\n- @%s at %d (epoch ms):\n  %s\n", displayOrNone(update.AuthorUserName), update.CreateAt, strings.TrimSpace(update.Message))
	}
	if len(shown) < len(visible) {
		fmt.Fprintf(&sb, "\n(%d older update(s) not shown — raise limit to see more.)", len(visible)-len(shown))
	}
	return strings.TrimRight(sb.String(), "\n")
}

// runTaskProgress prefers the server-computed counters and falls back to
// counting checklist items, since they are computed rather than stored and an
// older payload may not carry them.
func runTaskProgress(run playbookRunDetail) (total, completed int) {
	if run.TaskTotal > 0 {
		return run.TaskTotal, run.TaskCompleted
	}
	for _, cl := range run.Checklists {
		for _, item := range cl.Items {
			total++
			if item.State == "closed" || item.State == "skipped" {
				completed++
			}
		}
	}
	return total, completed
}

// writeRunChecklistsVerbose uses the same [checklist_number][item_number]
// notation as writeRunChecklists so indexes stay consistent across tools, and
// adds the per-item detail get_run callers need.
func writeRunChecklistsVerbose(sb *strings.Builder, run playbookRunDetail) {
	if len(run.Checklists) == 0 {
		sb.WriteString("  (no checklists)\n")
		return
	}
	for ci, cl := range run.Checklists {
		fmt.Fprintf(sb, "  Checklist %d: %q\n", ci, cl.Title)
		if len(cl.Items) == 0 {
			sb.WriteString("    (no items)\n")
			continue
		}
		for ii, item := range cl.Items {
			fmt.Fprintf(sb, "    [%d][%d] %s (%s)", ci, ii, item.Title, displayState(item.State))
			if assignee := displayAssignee(item); assignee != "" {
				fmt.Fprintf(sb, " — assignee: %s", assignee)
			}
			if item.DueDate != 0 {
				fmt.Fprintf(sb, " — due: %d (epoch ms)", item.DueDate)
			}
			if item.LastSkipped != 0 {
				fmt.Fprintf(sb, " — skipped at %d", item.LastSkipped)
			}
			sb.WriteString("\n")
		}
	}
}

// displayAssignee reports who a task is assigned to, including role-based and
// property-based assignment where assignee_id is empty by design.
func displayAssignee(item checklistItem) string {
	if item.AssigneeID != "" {
		return item.AssigneeID
	}
	switch {
	case item.AssigneePropertyFieldID != "":
		return fmt.Sprintf("by property field %s", item.AssigneePropertyFieldID)
	case item.AssigneeType != "":
		return fmt.Sprintf("by role (%s)", item.AssigneeType)
	default:
		return ""
	}
}

func formatIDList(ids []string) string {
	if len(ids) == 0 {
		return "none"
	}
	return strings.Join(ids, ", ")
}

func displayOrNone(value string) string {
	if value == "" {
		return "none"
	}
	return value
}

func displayEnabled(enabled bool) string {
	if enabled {
		return "enabled"
	}
	return "disabled"
}

func displayRunStatus(status string) string {
	if status == "" {
		return "unknown"
	}
	return status
}

func displayRunType(runType string) string {
	switch runType {
	case "":
		return "unknown"
	case runTypeChannelChecklist:
		return "channelChecklist (standalone channel checklist)"
	case runTypePlaybook:
		return "playbook (run started from a playbook template)"
	default:
		return runType
	}
}
