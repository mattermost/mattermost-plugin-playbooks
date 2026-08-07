// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost/server/public/model"
)

const defaultReminderTimerSeconds int64 = 86400

type CreatePlaybookArgs struct {
	Title                        string                    `json:"title" jsonschema:"Playbook title"`
	TeamID                       string                    `json:"team_id" jsonschema:"The 26-character Mattermost team ID where the playbook will be created"`
	Description                  string                    `json:"description,omitempty" jsonschema:"Optional playbook description"`
	Public                       *bool                     `json:"public,omitempty" jsonschema:"Whether the playbook is public. Defaults to true."`
	CreatePublicPlaybookRun      *bool                     `json:"create_public_playbook_run,omitempty" jsonschema:"Whether runs started from this playbook should create public channels"`
	Checklists                   []CreatePlaybookChecklist `json:"checklists,omitempty" jsonschema:"Initial playbook stages/checklists"`
	Members                      []CreatePlaybookMember    `json:"members,omitempty" jsonschema:"Optional playbook members/admins"`
	InvitedUserIDs               []string                  `json:"invited_user_ids,omitempty" jsonschema:"Users automatically invited to new run channels. Each entry accepts a user ID, 'me' for the current user, or a username with or without @ (for example '@bob'). Task assignees are auto-added."`
	InviteUsersEnabled           *bool                     `json:"invite_users_enabled,omitempty" jsonschema:"Whether invited_user_ids are invited to new run channels. Auto-enabled if tasks are pre-assigned."`
	DefaultOwnerID               string                    `json:"default_owner_id,omitempty" jsonschema:"Default owner for new runs. Accepts a user ID, 'me' for the current user, or a username with or without @ (for example '@bob'). Defaults to the requesting user."`
	DefaultOwnerEnabled          *bool                     `json:"default_owner_enabled,omitempty" jsonschema:"Whether default_owner_id is used for new runs. Defaults to true."`
	BroadcastChannelIDs          []string                  `json:"broadcast_channel_ids,omitempty" jsonschema:"Channels where status updates will be broadcast"`
	BroadcastEnabled             *bool                     `json:"broadcast_enabled,omitempty" jsonschema:"Whether status update broadcasting is enabled. Defaults to true when broadcast_channel_ids is provided."`
	ReminderMessageTemplate      string                    `json:"reminder_message_template,omitempty" jsonschema:"Template for status update reminders"`
	ReminderTimerDefaultSeconds  int64                     `json:"reminder_timer_default_seconds,omitempty" jsonschema:"Default status update reminder interval in seconds. Defaults to 86400."`
	StatusUpdateEnabled          *bool                     `json:"status_update_enabled,omitempty" jsonschema:"Whether status updates are enabled for runs"`
	Metrics                      []CreatePlaybookMetric    `json:"metrics,omitempty" jsonschema:"Optional key metrics, maximum 4"`
	ChannelID                    string                    `json:"channel_id,omitempty" jsonschema:"Existing channel to link to new runs when channel_mode is link_existing_channel"`
	ChannelMode                  string                    `json:"channel_mode,omitempty" jsonschema:"How runs of this playbook get a channel: create_new_channel (default) or link_existing_channel. When link_existing_channel, also set channel_id."`
	WebhookOnCreationURLs        []string                  `json:"webhook_on_creation_urls,omitempty" jsonschema:"HTTP/HTTPS URLs to call when a run is created from this playbook"`
	WebhookOnCreationEnabled     *bool                     `json:"webhook_on_creation_enabled,omitempty" jsonschema:"Whether creation webhooks are enabled. Defaults to true when webhook_on_creation_urls is provided."`
	WebhookOnStatusUpdateURLs    []string                  `json:"webhook_on_status_update_urls,omitempty" jsonschema:"HTTP/HTTPS URLs to call when a run status is updated"`
	WebhookOnStatusUpdateEnabled *bool                     `json:"webhook_on_status_update_enabled,omitempty" jsonschema:"Whether status-update webhooks are enabled. Defaults to true when webhook_on_status_update_urls is provided."`
}

type CreatePlaybookChecklist struct {
	Title string               `json:"title"`
	Items []CreatePlaybookItem `json:"items,omitempty"`
}
type CreatePlaybookItem struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Command     string `json:"command,omitempty"`
	AssigneeID  string `json:"assignee_id,omitempty" jsonschema:"Optional user to assign the task to. Accepts a user ID, 'me' for the current user, or a username with or without @ (for example '@bob')."`
	DueDate     int64  `json:"due_date,omitempty"`
}
type CreatePlaybookMember struct {
	UserID string   `json:"user_id" jsonschema:"Accepts a user ID, 'me' for the current user, or a username with or without @ (for example '@bob')."`
	Roles  []string `json:"roles,omitempty"`
}
type CreatePlaybookMetric struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Type        string `json:"type"`
	Target      *int64 `json:"target,omitempty"`
}

type CreatePlaybookAttributeArgs struct {
	PlaybookID string                        `json:"playbook_id" jsonschema:"The ID of the playbook template to add the attribute/property field to"`
	Name       string                        `json:"name" jsonschema:"Attribute name"`
	Type       string                        `json:"type" jsonschema:"Attribute type. Supported values: text, select, multiselect, date, user, multiuser"`
	Attrs      *CreatePlaybookAttributeAttrs `json:"attrs,omitempty" jsonschema:"Optional attribute metadata such as visibility, sort_order, options, parent_id, and value_type"`
}

type CreatePlaybookAttributeAttrs struct {
	Visibility string                          `json:"visibility,omitempty" jsonschema:"Optional visibility: hidden, when_set, or always. Defaults to when_set."`
	SortOrder  float64                         `json:"sort_order,omitempty" jsonschema:"Optional sort order for display"`
	Options    []CreatePlaybookAttributeOption `json:"options,omitempty" jsonschema:"Options for select or multiselect attributes"`
	ParentID   string                          `json:"parent_id,omitempty" jsonschema:"Optional parent property field ID"`
	ValueType  string                          `json:"value_type,omitempty" jsonschema:"Optional value type. Use url for URL text attributes."`
}

type CreatePlaybookAttributeOption struct {
	Name  string `json:"name" jsonschema:"Option display name"`
	Color string `json:"color,omitempty" jsonschema:"Optional option color"`
}

type ListPlaybooksArgs struct {
	TeamID       string `json:"team_id,omitempty" jsonschema:"Optional 26-character Mattermost team ID to filter playbook templates"`
	SearchTerm   string `json:"search_term,omitempty" jsonschema:"Optional search text for playbook template title or team name"`
	WithArchived bool   `json:"with_archived,omitempty" jsonschema:"Include archived playbook templates"`
	Page         int    `json:"page,omitempty" jsonschema:"Page number (0-indexed)"`
	PerPage      int    `json:"per_page,omitempty" jsonschema:"Number of results per page (max 100)"`
}

type GetPlaybookArgs struct {
	PlaybookID string `json:"playbook_id" jsonschema:"The ID of the playbook template to retrieve"`
}

type PlaybookIDArgs struct {
	PlaybookID string `json:"playbook_id" jsonschema:"The ID of the playbook template"`
}

type UpdatePlaybookArgs struct {
	PlaybookID  string  `json:"playbook_id" jsonschema:"The ID of the playbook template to edit"`
	Title       *string `json:"title,omitempty" jsonschema:"New title for the playbook template. Must not be empty."`
	Description *string `json:"description,omitempty" jsonschema:"New description for the playbook template (supports Markdown). Send an empty string to clear it."`
}

type AddPlaybookTaskArgs struct {
	PlaybookID      string `json:"playbook_id" jsonschema:"The ID of the playbook template"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the checklist to add the task to"`
	Title           string `json:"title" jsonschema:"Title of the new task"`
	Description     string `json:"description,omitempty" jsonschema:"Optional task description (supports Markdown)"`
	Command         string `json:"command,omitempty" jsonschema:"Optional slash command to associate with the task"`
	AssigneeID      string `json:"assignee_id,omitempty" jsonschema:"Optional user to assign the task to. Accepts a user ID, 'me' for the current user, or a username with or without @ (for example '@bob')."`
	DueDate         int64  `json:"due_date,omitempty" jsonschema:"Optional relative offset from run start, in milliseconds (for example, 86400000 = 1 day)"`
}

type EditPlaybookTaskArgs struct {
	PlaybookID      string  `json:"playbook_id" jsonschema:"The ID of the playbook template"`
	ChecklistNumber int     `json:"checklist_number" jsonschema:"The zero-based index of the checklist"`
	ItemNumber      int     `json:"item_number" jsonschema:"The zero-based index of the task within the checklist"`
	Title           *string `json:"title,omitempty" jsonschema:"New title for the task"`
	Description     *string `json:"description,omitempty" jsonschema:"New task description (supports Markdown)"`
	Command         *string `json:"command,omitempty" jsonschema:"Slash command to associate with the task"`
	AssigneeID      *string `json:"assignee_id,omitempty" jsonschema:"User to assign the task to. Accepts a user ID, 'me' for the current user, or a username with or without @ (for example '@bob'). Set an empty string to clear."`
	DueDate         *int64  `json:"due_date,omitempty" jsonschema:"Relative offset from run start, in milliseconds (for example, 86400000 = 1 day); use 0 to clear"`
}

type RemovePlaybookTaskArgs struct {
	PlaybookID      string `json:"playbook_id" jsonschema:"The ID of the playbook template"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the checklist"`
	ItemNumber      int    `json:"item_number" jsonschema:"The zero-based index of the task to remove"`
}

type AddPlaybookSectionArgs struct {
	PlaybookID      string               `json:"playbook_id" jsonschema:"The ID of the playbook template"`
	ChecklistNumber *int                 `json:"checklist_number,omitempty" jsonschema:"Optional zero-based insertion index for the new section. Omit to append at the end."`
	Title           string               `json:"title" jsonschema:"Title of the new section"`
	Items           []CreatePlaybookItem `json:"items,omitempty" jsonschema:"Optional initial tasks using the same shape as create_playbook checklist items"`
}

type RenamePlaybookSectionArgs struct {
	PlaybookID      string `json:"playbook_id" jsonschema:"The ID of the playbook template"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the section to rename"`
	Title           string `json:"title" jsonschema:"New title for the section"`
}

type RemovePlaybookSectionArgs struct {
	PlaybookID      string `json:"playbook_id" jsonschema:"The ID of the playbook template"`
	ChecklistNumber int    `json:"checklist_number" jsonschema:"The zero-based index of the section to remove"`
}

type MovePlaybookSectionArgs struct {
	PlaybookID         string `json:"playbook_id" jsonschema:"The ID of the playbook template"`
	SourceChecklistIdx int    `json:"source_checklist_idx" jsonschema:"The zero-based source section index"`
	DestChecklistIdx   int    `json:"dest_checklist_idx" jsonschema:"The zero-based destination section index"`
}

type createPlaybookResult struct {
	PlaybookURL string `json:"playbook_url"`
	Playbook    any    `json:"playbook"`
}

type playbookSummary struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	TeamID   string `json:"team_id"`
	Public   bool   `json:"public"`
	DeleteAt int64  `json:"delete_at"`
}

type listPlaybooksResponse struct {
	TotalCount int               `json:"total_count"`
	PageCount  int               `json:"page_count"`
	HasMore    bool              `json:"has_more"`
	Items      []playbookSummary `json:"items"`
}

func (p *PlaybooksToolProvider) addMCPHelperPlaybookTools(server *mcphelper.Server) {
	addMCPHelperTool(server, p.clientFactory, "create_playbook", "Create a new playbook template (a reusable checklist blueprint for incidents, releases, onboarding) in a team, with optional stages/checklists, tasks, members, invitations, default owner, broadcast settings, metrics, run channel options, and webhooks. This creates the template only — it does not start anything; to start a run from a template (\"start/run the playbook\") call run_playbook. Every user field (default_owner_id, invited_user_ids, members, task assignees) accepts a username with or without @, 'me', or a user ID. Returns the created playbook template and its browser URL. Example: {\"title\": \"Sev1 Incident\", \"team_id\": \"team123...\", \"checklists\": [{\"title\": \"Triage\", \"items\": [{\"title\": \"Page the on-call\"}]}]}", toolCreatePlaybook)
	addMCPHelperTool(server, p.clientFactory, "list_playbooks", "List and search playbook templates (reusable run blueprints) by team, title, or archived state. Use this first whenever you know a playbook's name but not its playbook_id — for example before run_playbook starts a run from it. This lists templates, not active runs; call list_runs for runs in progress. Example: {\"team_id\": \"team123...\", \"search_term\": \"Incident\", \"per_page\": 10}", toolListPlaybooks)
	addMCPHelperTool(server, p.clientFactory, "get_playbook", "Get full details for one playbook template, including its checklists and zero-based task indexes. Use this to confirm the playbook_id and the checklist_number/item_number values before editing template tasks. This reads a template, not a live run — use get_run for a run. Example: {\"playbook_id\": \"abc123...\"}", toolGetPlaybook)
	addMCPHelperTool(server, p.clientFactory, "update_playbook", "Rename a playbook template or edit its description. Provide title, description, or both — at least one is required. This edits the reusable template, so it does not change runs already started from it; use update_run to rename a run. If you do not know the playbook_id, call list_playbooks first. Example: {\"playbook_id\": \"abc123...\", \"title\": \"Sev1 Incident Response\"}", toolUpdatePlaybook)
	addMCPHelperTool(server, p.clientFactory, "archive_playbook", "Archive (delete, retire) a playbook template so no new runs can be started from it. Runs already started keep working, and restore_playbook can bring the template back. This is destructive: confirm you have the right template with list_playbooks or get_playbook before calling, because titles are often similar. Example: {\"playbook_id\": \"abc123...\"}", toolArchivePlaybook)
	addMCPHelperTool(server, p.clientFactory, "restore_playbook", "Restore (un-archive, bring back) an archived playbook template so runs can be started from it again. Archived templates are hidden by default: call list_playbooks with with_archived=true to find the playbook_id. Example: {\"playbook_id\": \"abc123...\"}", toolRestorePlaybook)
	addMCPHelperTool(server, p.clientFactory, "duplicate_playbook", "Duplicate (copy, clone) a playbook template into a new template you can then edit, which is far cheaper than rebuilding one with create_playbook. The copy keeps the original's checklists and settings. Call list_playbooks first if you do not know the playbook_id. Returns the new template's title, ID, and browser URL. Example: {\"playbook_id\": \"abc123...\"}", toolDuplicatePlaybook)
	addMCPHelperTool(server, p.clientFactory, "create_playbook_attribute", "Create a custom attribute/property field (for example Severity or Service) on a playbook template, so runs started from it can carry that value. If you do not already know the playbook_id, call list_playbooks first. Supported types are text, select, multiselect, date, user, and multiuser. Select and multiselect attributes require attrs.options. Returns the created field as formatted JSON. Example: {\"playbook_id\": \"abc123...\", \"name\": \"Severity\", \"type\": \"select\", \"attrs\": {\"visibility\": \"always\", \"sort_order\": 1, \"options\": [{\"name\": \"High\", \"color\": \"red\"}]}}", toolCreatePlaybookAttribute)
	addMCPHelperTool(server, p.clientFactory, "add_playbook_task", "Add a task to a checklist in a playbook template, so every future run started from it includes that task (use add_checklist_item to add a task to a live run instead). The checklist_number is a zero-based index. If you do not already know the playbook_id and checklist_number, do NOT guess them: first call list_playbooks to find the template by team/title, then get_playbook to confirm the checklist indexes. This fetches the playbook, preserves its existing fields, mutates only checklists, and saves the full playbook. assignee_id accepts a username with or without @, 'me', or a user ID. due_date is a relative offset from run start in milliseconds. Example: {\"playbook_id\": \"abc123...\", \"checklist_number\": 0, \"title\": \"Verify fix\", \"assignee_id\": \"@alice\"}", toolAddPlaybookTask)
	addMCPHelperTool(server, p.clientFactory, "edit_playbook_task", "Edit a task in a playbook template — its title, description, slash command, assignee, or relative due date (use edit_checklist_item for a task in a live run). Checklist and item numbers are zero-based indexes, and only provided task fields are updated. If you do not already know the playbook_id and indexes, do NOT guess them: first call list_playbooks to find the template by team/title, then get_playbook to confirm the checklist_number and item_number. This preserves all other playbook and task fields. assignee_id accepts a username with or without @, 'me', or a user ID; send an empty string to clear it. due_date is a relative offset from run start in milliseconds. Example: {\"playbook_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 1, \"title\": \"Updated task\"}", toolEditPlaybookTask)
	addMCPHelperTool(server, p.clientFactory, "remove_playbook_task", "Delete a task from a playbook template so future runs no longer include it (use remove_checklist_item for a task in a live run). Checklist and item numbers are zero-based indexes. If you do not already know the playbook_id and indexes, do NOT guess them: first call list_playbooks to find the template by team/title, then get_playbook to confirm the checklist_number and item_number. This fetches and saves the full playbook while mutating only checklists. Example: {\"playbook_id\": \"abc123...\", \"checklist_number\": 0, \"item_number\": 2}", toolRemovePlaybookTask)
	addMCPHelperTool(server, p.clientFactory, "add_playbook_section", "Add a checklist section (stage, task group) to a playbook template, optionally with its initial tasks (use add_section for a live run). The optional checklist_number is a zero-based insertion index; omit it to append. If you do not already know the playbook_id or section indexes, call list_playbooks, then get_playbook first. Initial items use the same shape as create_playbook checklist items; each assignee_id accepts a username with or without @, 'me', or a user ID, and assignees are invited automatically. This preserves all other playbook fields. Example: {\"playbook_id\": \"abc123...\", \"checklist_number\": 1, \"title\": \"Post-incident review\", \"items\": [{\"title\": \"Schedule retrospective\"}]}", toolAddPlaybookSection)
	addMCPHelperTool(server, p.clientFactory, "rename_playbook_section", "Rename a checklist section in a playbook template (use rename_section for a live run). The checklist_number is a zero-based index. If you do not already know the playbook_id and checklist_number, call list_playbooks, then get_playbook first. This preserves all other playbook fields. Example: {\"playbook_id\": \"abc123...\", \"checklist_number\": 0, \"title\": \"Updated section name\"}", toolRenamePlaybookSection)
	addMCPHelperTool(server, p.clientFactory, "remove_playbook_section", "Delete a whole checklist section and all its tasks from a playbook template (use remove_section for a live run). The checklist_number is a zero-based index; confirm it with get_playbook before using this destructive tool. This preserves all other playbook fields. Example: {\"playbook_id\": \"abc123...\", \"checklist_number\": 1}", toolRemovePlaybookSection)
	addMCPHelperTool(server, p.clientFactory, "move_playbook_section", "Reorder a checklist section within a playbook template (use move_section for a live run). Source and destination indexes are zero-based existing section indexes (0 = first, section count-1 = last). If you do not already know the playbook_id and indexes, call list_playbooks, then get_playbook first. This preserves all other playbook fields. Example: {\"playbook_id\": \"abc123...\", \"source_checklist_idx\": 1, \"dest_checklist_idx\": 0}", toolMovePlaybookSection)
}

func toolCreatePlaybook(ctx context.Context, client APIClient, args CreatePlaybookArgs) (string, error) {
	title := strings.TrimSpace(args.Title)
	if title == "" {
		return "", fmt.Errorf("title is required")
	}
	if err := validateID(args.TeamID, "team_id"); err != nil {
		return "", err
	}
	if err := validateCreatePlaybookArgs(args); err != nil {
		return "", err
	}
	if err := resolveCreatePlaybookUserRefs(ctx, client, &args); err != nil {
		return "", err
	}

	currentUserID, err := client.GetCurrentUserID(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get current user ID: %w", err)
	}

	isPublic := true
	if args.Public != nil {
		isPublic = *args.Public
	}
	defaultOwnerID := args.DefaultOwnerID
	if defaultOwnerID == "" {
		defaultOwnerID = currentUserID
	}
	defaultOwnerEnabled := true
	if args.DefaultOwnerEnabled != nil {
		defaultOwnerEnabled = *args.DefaultOwnerEnabled
	}
	reminder := args.ReminderTimerDefaultSeconds
	if reminder == 0 {
		reminder = defaultReminderTimerSeconds
	}

	invited := uniqueStrings(args.InvitedUserIDs)
	inviteEnabled := boolValue(args.InviteUsersEnabled, len(invited) > 0)
	checklists := make([]map[string]any, 0, len(args.Checklists))
	for _, section := range args.Checklists {
		items := make([]map[string]any, 0, len(section.Items))
		for _, item := range section.Items {
			m := map[string]any{"title": strings.TrimSpace(item.Title), "description": item.Description, "command": item.Command}
			if item.AssigneeID != "" {
				m["assignee_id"] = item.AssigneeID
				invited = appendUnique(invited, item.AssigneeID)
				inviteEnabled = true
			}
			if item.DueDate != 0 {
				m["due_date"] = item.DueDate
			}
			items = append(items, m)
		}
		checklists = append(checklists, map[string]any{"title": strings.TrimSpace(section.Title), "items": items})
	}

	body := map[string]any{"title": title, "team_id": args.TeamID, "public": isPublic, "default_owner_id": defaultOwnerID, "default_owner_enabled": defaultOwnerEnabled, "reminder_timer_default_seconds": reminder}
	addNonEmpty(body, "description", args.Description)
	addNonEmpty(body, "reminder_message_template", args.ReminderMessageTemplate)
	addNonEmpty(body, "channel_id", args.ChannelID)
	if args.CreatePublicPlaybookRun != nil {
		body["create_public_playbook_run"] = *args.CreatePublicPlaybookRun
	}
	if args.ChannelMode != "" {
		// app.ChannelPlaybookMode only implements UnmarshalText, so the server
		// rejects the whole create request unless this is sent as a string.
		body["channel_mode"] = args.ChannelMode
	}
	if args.StatusUpdateEnabled != nil {
		body["status_update_enabled"] = *args.StatusUpdateEnabled
	}
	if len(checklists) > 0 {
		body["checklists"] = checklists
	}
	if len(args.Members) > 0 {
		body["members"] = args.Members
	}
	if len(invited) > 0 {
		body["invited_user_ids"] = invited
		body["invite_users_enabled"] = inviteEnabled
	}
	if len(args.BroadcastChannelIDs) > 0 {
		body["broadcast_channel_ids"] = uniqueStrings(args.BroadcastChannelIDs)
		body["broadcast_enabled"] = boolValue(args.BroadcastEnabled, true)
	} else if args.BroadcastEnabled != nil {
		body["broadcast_enabled"] = *args.BroadcastEnabled
	}
	if len(args.Metrics) > 0 {
		body["metrics"] = args.Metrics
	}
	if len(args.WebhookOnCreationURLs) > 0 {
		body["webhook_on_creation_urls"] = args.WebhookOnCreationURLs
		body["webhook_on_creation_enabled"] = boolValue(args.WebhookOnCreationEnabled, true)
	}
	if len(args.WebhookOnStatusUpdateURLs) > 0 {
		body["webhook_on_status_update_urls"] = args.WebhookOnStatusUpdateURLs
		body["webhook_on_status_update_enabled"] = boolValue(args.WebhookOnStatusUpdateEnabled, true)
	}

	var created struct {
		ID string `json:"id"`
	}
	if err := client.Post(ctx, "playbooks", body, &created); err != nil {
		return "", fmt.Errorf("failed to create playbook: %w", err)
	}
	if created.ID == "" {
		return "", fmt.Errorf("failed to create playbook: response missing id")
	}
	var playbook map[string]any
	if err := client.Get(ctx, fmt.Sprintf("playbooks/%s", created.ID), nil, &playbook); err != nil {
		return "", fmt.Errorf("created playbook %s, but failed to fetch details: %w", created.ID, err)
	}

	data, err := json.MarshalIndent(createPlaybookResult{PlaybookURL: client.GetPlaybookURL(created.ID), Playbook: playbook}, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func toolListPlaybooks(ctx context.Context, client APIClient, args ListPlaybooksArgs) (string, error) {
	if args.Page < 0 {
		return "", fmt.Errorf("page must be >= 0")
	}
	if args.TeamID != "" {
		if err := validateID(args.TeamID, "team_id"); err != nil {
			return "", err
		}
	}

	perPage := args.PerPage
	if perPage <= 0 {
		perPage = 10
	}
	if perPage > 100 {
		perPage = 100
	}

	params := url.Values{}
	params.Set("page", fmt.Sprintf("%d", args.Page))
	params.Set("per_page", fmt.Sprintf("%d", perPage))
	if args.TeamID != "" {
		params.Set("team_id", args.TeamID)
	}
	if search := strings.TrimSpace(args.SearchTerm); search != "" {
		params.Set("search_term", search)
	}
	if args.WithArchived {
		params.Set("with_archived", "true")
	}

	var resp listPlaybooksResponse
	if err := client.Get(ctx, "playbooks", params, &resp); err != nil {
		return "", fmt.Errorf("failed to list playbooks: %w", err)
	}
	return formatListPlaybooks(resp), nil
}

func toolGetPlaybook(ctx context.Context, client APIClient, args GetPlaybookArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}
	playbook, err := fetchPlaybookForMutation(ctx, client, args.PlaybookID)
	if err != nil {
		return "", err
	}
	data, err := json.MarshalIndent(playbook, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func toolUpdatePlaybook(ctx context.Context, client APIClient, args UpdatePlaybookArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}
	if args.Title == nil && args.Description == nil {
		return "", fmt.Errorf("at least one field (title or description) must be provided")
	}
	var title string
	if args.Title != nil {
		title = strings.TrimSpace(*args.Title)
		if title == "" {
			return "", fmt.Errorf("title must not be empty")
		}
	}

	// Templates have no granular update endpoint, so mutate only the requested
	// keys of the raw playbook map and PUT the whole thing back.
	playbook, err := fetchPlaybookForMutation(ctx, client, args.PlaybookID)
	if err != nil {
		return "", err
	}
	if args.Title != nil {
		playbook["title"] = title
	}
	if args.Description != nil {
		playbook["description"] = *args.Description
	}

	if err := putMutatedPlaybook(ctx, client, args.PlaybookID, playbook); err != nil {
		return "", err
	}

	switch {
	case args.Title != nil && args.Description != nil:
		return fmt.Sprintf("Renamed playbook template %s to %q and updated its description.", args.PlaybookID, title), nil
	case args.Title != nil:
		return fmt.Sprintf("Renamed playbook template %s to %q.", args.PlaybookID, title), nil
	default:
		return fmt.Sprintf("Updated the description of playbook template %s.", args.PlaybookID), nil
	}
}

func toolArchivePlaybook(ctx context.Context, client APIClient, args PlaybookIDArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}

	// Read before archiving so the confirmation names the playbook that was
	// actually affected, and a wrong ID fails before anything is destroyed.
	playbook, err := fetchPlaybookForMutation(ctx, client, args.PlaybookID)
	if err != nil {
		return "", err
	}
	title, _ := playbook["title"].(string)

	if err := client.Delete(ctx, fmt.Sprintf("playbooks/%s", args.PlaybookID)); err != nil {
		return "", wrapPlaybookError(err, args.PlaybookID, "archive")
	}

	return fmt.Sprintf("Archived playbook template %q (%s). No new runs can be started from it; call restore_playbook to bring it back.", title, args.PlaybookID), nil
}

func toolRestorePlaybook(ctx context.Context, client APIClient, args PlaybookIDArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}

	if err := client.Put(ctx, fmt.Sprintf("playbooks/%s/restore", args.PlaybookID), nil, nil); err != nil {
		return "", wrapPlaybookError(err, args.PlaybookID, "restore")
	}

	return fmt.Sprintf("Restored playbook template %s. Runs can be started from it again with run_playbook.", args.PlaybookID), nil
}

func toolDuplicatePlaybook(ctx context.Context, client APIClient, args PlaybookIDArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}

	var created struct {
		ID string `json:"id"`
	}
	if err := client.Post(ctx, fmt.Sprintf("playbooks/%s/duplicate", args.PlaybookID), nil, &created); err != nil {
		return "", wrapPlaybookError(err, args.PlaybookID, "duplicate")
	}
	if created.ID == "" {
		return "", fmt.Errorf("failed to duplicate playbook template %s: response missing id", args.PlaybookID)
	}

	duplicate, err := fetchPlaybookForMutation(ctx, client, created.ID)
	if err != nil {
		return "", fmt.Errorf("duplicated playbook %s into %s, but failed to fetch the copy: %w", args.PlaybookID, created.ID, err)
	}
	title, _ := duplicate["title"].(string)

	return fmt.Sprintf("Duplicated playbook template %s into %q (playbook_id: %s).\nURL: %s", args.PlaybookID, title, created.ID, client.GetPlaybookURL(created.ID)), nil
}

func toolCreatePlaybookAttribute(ctx context.Context, client APIClient, args CreatePlaybookAttributeArgs) (string, error) {
	body, err := buildCreatePlaybookAttributeBody(args)
	if err != nil {
		return "", err
	}

	var created map[string]any
	endpoint := fmt.Sprintf("playbooks/%s/property_fields", args.PlaybookID)
	if err := client.Post(ctx, endpoint, body, &created); err != nil {
		return "", wrapPlaybookError(err, args.PlaybookID, "create an attribute on")
	}
	if len(created) == 0 {
		return "", fmt.Errorf("failed to create playbook attribute: response was empty")
	}
	id, ok := created["id"].(string)
	if !ok || strings.TrimSpace(id) == "" {
		return "", fmt.Errorf("failed to create playbook attribute: response missing id")
	}

	data, err := json.MarshalIndent(created, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func toolAddPlaybookTask(ctx context.Context, client APIClient, args AddPlaybookTaskArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	title := strings.TrimSpace(args.Title)
	if title == "" {
		return "", fmt.Errorf("title is required")
	}
	assigneeID, err := resolveUserRef(ctx, client, args.AssigneeID, "assignee_id")
	if err != nil {
		return "", err
	}

	playbook, err := fetchPlaybookForMutation(ctx, client, args.PlaybookID)
	if err != nil {
		return "", err
	}
	checklist, err := playbookChecklist(playbook, args.PlaybookID, args.ChecklistNumber)
	if err != nil {
		return "", err
	}
	items, err := playbookChecklistItems(checklist, args.ChecklistNumber)
	if err != nil {
		return "", err
	}

	item := map[string]any{
		"title":       title,
		"description": args.Description,
		"command":     args.Command,
	}
	if assigneeID != "" {
		item["assignee_id"] = assigneeID
		ensurePlaybookInvitesUser(playbook, assigneeID)
	}
	if args.DueDate != 0 {
		item["due_date"] = args.DueDate
	}
	checklist["items"] = append(items, item)

	if err := putMutatedPlaybook(ctx, client, args.PlaybookID, playbook); err != nil {
		return "", err
	}
	return fmt.Sprintf("Added task %q to playbook %s checklist %d.", title, args.PlaybookID, args.ChecklistNumber), nil
}

func toolEditPlaybookTask(ctx context.Context, client APIClient, args EditPlaybookTaskArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ItemNumber, "item_number"); err != nil {
		return "", err
	}
	if args.Title == nil && args.Description == nil && args.Command == nil && args.AssigneeID == nil && args.DueDate == nil {
		return "", fmt.Errorf("at least one field (title, description, command, assignee_id, or due_date) must be provided")
	}
	if args.Title != nil && strings.TrimSpace(*args.Title) == "" {
		return "", fmt.Errorf("title is required")
	}
	// A nil assignee_id leaves the assignee alone; an explicit empty string
	// clears it. Only a non-empty value is a reference to resolve.
	var assigneeID string
	if args.AssigneeID != nil {
		resolved, err := resolveUserRef(ctx, client, *args.AssigneeID, "assignee_id")
		if err != nil {
			return "", err
		}
		assigneeID = resolved
	}

	playbook, err := fetchPlaybookForMutation(ctx, client, args.PlaybookID)
	if err != nil {
		return "", err
	}
	item, err := playbookTaskItem(playbook, args.PlaybookID, args.ChecklistNumber, args.ItemNumber)
	if err != nil {
		return "", err
	}

	if args.Title != nil {
		item["title"] = strings.TrimSpace(*args.Title)
	}
	if args.Description != nil {
		item["description"] = *args.Description
	}
	if args.Command != nil {
		item["command"] = *args.Command
	}
	if args.AssigneeID != nil {
		item["assignee_id"] = assigneeID
		if assigneeID != "" {
			ensurePlaybookInvitesUser(playbook, assigneeID)
		}
	}
	if args.DueDate != nil {
		item["due_date"] = *args.DueDate
	}

	if err := putMutatedPlaybook(ctx, client, args.PlaybookID, playbook); err != nil {
		return "", err
	}
	return fmt.Sprintf("Updated task [%d][%d] in playbook %s.", args.ChecklistNumber, args.ItemNumber, args.PlaybookID), nil
}

func toolRemovePlaybookTask(ctx context.Context, client APIClient, args RemovePlaybookTaskArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ItemNumber, "item_number"); err != nil {
		return "", err
	}

	playbook, err := fetchPlaybookForMutation(ctx, client, args.PlaybookID)
	if err != nil {
		return "", err
	}
	checklist, err := playbookChecklist(playbook, args.PlaybookID, args.ChecklistNumber)
	if err != nil {
		return "", err
	}
	items, err := playbookChecklistItems(checklist, args.ChecklistNumber)
	if err != nil {
		return "", err
	}
	if args.ItemNumber >= len(items) {
		return "", playbookOutOfRangeError("item_number", args.ItemNumber, args.PlaybookID, playbook)
	}
	removedTitle := playbookTaskTitle(items[args.ItemNumber])
	checklist["items"] = append(items[:args.ItemNumber], items[args.ItemNumber+1:]...)

	if err := putMutatedPlaybook(ctx, client, args.PlaybookID, playbook); err != nil {
		return "", err
	}
	return fmt.Sprintf("Removed task [%d][%d] (%q) from playbook %s.", args.ChecklistNumber, args.ItemNumber, removedTitle, args.PlaybookID), nil
}

func toolAddPlaybookSection(ctx context.Context, client APIClient, args AddPlaybookSectionArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}
	if args.ChecklistNumber != nil {
		if err := validateIndex(*args.ChecklistNumber, "checklist_number"); err != nil {
			return "", err
		}
	}
	title := strings.TrimSpace(args.Title)
	if title == "" {
		return "", fmt.Errorf("title is required")
	}
	if err := validateCreatePlaybookItems(args.Items, "items"); err != nil {
		return "", err
	}
	items, err := resolveCreatePlaybookItems(ctx, client, args.Items, "items")
	if err != nil {
		return "", err
	}

	playbook, err := fetchPlaybookForMutation(ctx, client, args.PlaybookID)
	if err != nil {
		return "", err
	}
	checklists, err := playbookChecklists(playbook, args.PlaybookID)
	if err != nil {
		return "", err
	}
	insertAt := len(checklists)
	if args.ChecklistNumber != nil {
		insertAt = *args.ChecklistNumber
	}
	if insertAt > len(checklists) {
		return "", playbookSectionOutOfRangeError("checklist_number", insertAt, args.PlaybookID, playbook)
	}

	section := map[string]any{
		"title": title,
		"items": buildCreatePlaybookItems(items, playbook),
	}
	checklists = insertChecklistAt(checklists, insertAt, section)
	playbook["checklists"] = checklists

	if err := putMutatedPlaybook(ctx, client, args.PlaybookID, playbook); err != nil {
		return "", err
	}
	message := fmt.Sprintf("Added section %q to playbook %s at checklist_number %d.", title, args.PlaybookID, insertAt)
	if hasAssignedCreatePlaybookItems(items) {
		message += " Assigned users were added to invited_user_ids and invite_users_enabled was set."
	}
	return message, nil
}

func toolRenamePlaybookSection(ctx context.Context, client APIClient, args RenamePlaybookSectionArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}
	title := strings.TrimSpace(args.Title)
	if title == "" {
		return "", fmt.Errorf("title is required")
	}

	playbook, err := fetchPlaybookForMutation(ctx, client, args.PlaybookID)
	if err != nil {
		return "", err
	}
	checklist, err := playbookSection(playbook, args.PlaybookID, args.ChecklistNumber)
	if err != nil {
		return "", err
	}
	checklist["title"] = title

	if err := putMutatedPlaybook(ctx, client, args.PlaybookID, playbook); err != nil {
		return "", err
	}
	return fmt.Sprintf("Renamed section %d in playbook %s to %q.", args.ChecklistNumber, args.PlaybookID, title), nil
}

func toolRemovePlaybookSection(ctx context.Context, client APIClient, args RemovePlaybookSectionArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.ChecklistNumber, "checklist_number"); err != nil {
		return "", err
	}

	playbook, err := fetchPlaybookForMutation(ctx, client, args.PlaybookID)
	if err != nil {
		return "", err
	}
	checklists, err := playbookChecklists(playbook, args.PlaybookID)
	if err != nil {
		return "", err
	}
	if args.ChecklistNumber >= len(checklists) {
		return "", playbookSectionOutOfRangeError("checklist_number", args.ChecklistNumber, args.PlaybookID, playbook)
	}
	removedTitle := playbookChecklistTitle(checklists[args.ChecklistNumber])
	checklists = append(checklists[:args.ChecklistNumber], checklists[args.ChecklistNumber+1:]...)
	playbook["checklists"] = checklists

	if err := putMutatedPlaybook(ctx, client, args.PlaybookID, playbook); err != nil {
		return "", err
	}
	return fmt.Sprintf("Removed section %d (%q) from playbook %s.", args.ChecklistNumber, removedTitle, args.PlaybookID), nil
}

func toolMovePlaybookSection(ctx context.Context, client APIClient, args MovePlaybookSectionArgs) (string, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return "", err
	}
	if err := validateIndex(args.SourceChecklistIdx, "source_checklist_idx"); err != nil {
		return "", err
	}
	if err := validateIndex(args.DestChecklistIdx, "dest_checklist_idx"); err != nil {
		return "", err
	}

	playbook, err := fetchPlaybookForMutation(ctx, client, args.PlaybookID)
	if err != nil {
		return "", err
	}
	checklists, err := playbookChecklists(playbook, args.PlaybookID)
	if err != nil {
		return "", err
	}
	if args.SourceChecklistIdx >= len(checklists) {
		return "", playbookSectionOutOfRangeError("source_checklist_idx", args.SourceChecklistIdx, args.PlaybookID, playbook)
	}
	if args.DestChecklistIdx >= len(checklists) {
		return "", playbookSectionOutOfRangeError("dest_checklist_idx", args.DestChecklistIdx, args.PlaybookID, playbook)
	}
	if args.SourceChecklistIdx == args.DestChecklistIdx {
		return fmt.Sprintf("Section %d is already at destination %d in playbook %s.", args.SourceChecklistIdx, args.DestChecklistIdx, args.PlaybookID), nil
	}

	section := checklists[args.SourceChecklistIdx]
	checklists = append(checklists[:args.SourceChecklistIdx], checklists[args.SourceChecklistIdx+1:]...)
	checklists = insertChecklistAt(checklists, args.DestChecklistIdx, section)
	playbook["checklists"] = checklists

	if err := putMutatedPlaybook(ctx, client, args.PlaybookID, playbook); err != nil {
		return "", err
	}
	return fmt.Sprintf("Moved section %d to %d in playbook %s.", args.SourceChecklistIdx, args.DestChecklistIdx, args.PlaybookID), nil
}

func fetchPlaybookForMutation(ctx context.Context, client APIClient, playbookID string) (map[string]any, error) {
	var playbook map[string]any
	if err := client.Get(ctx, fmt.Sprintf("playbooks/%s", playbookID), nil, &playbook); err != nil {
		return nil, wrapPlaybookError(err, playbookID, "get")
	}
	if playbook == nil {
		return nil, fmt.Errorf("failed to get playbook template %s: response was empty", playbookID)
	}
	return playbook, nil
}

func putMutatedPlaybook(ctx context.Context, client APIClient, playbookID string, playbook map[string]any) error {
	if err := client.Put(ctx, fmt.Sprintf("playbooks/%s", playbookID), playbook, nil); err != nil {
		return wrapPlaybookError(err, playbookID, "update")
	}
	return nil
}

func playbookChecklist(playbook map[string]any, playbookID string, checklistNumber int) (map[string]any, error) {
	rawChecklists, ok := playbook["checklists"]
	if !ok || rawChecklists == nil {
		return nil, playbookOutOfRangeError("checklist_number", checklistNumber, playbookID, playbook)
	}
	checklists, ok := rawChecklists.([]any)
	if !ok {
		return nil, fmt.Errorf("playbook %s checklists have unexpected format", playbookID)
	}
	if checklistNumber >= len(checklists) {
		return nil, playbookOutOfRangeError("checklist_number", checklistNumber, playbookID, playbook)
	}
	checklist, ok := checklists[checklistNumber].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("playbook %s checklist_number %d has unexpected format", playbookID, checklistNumber)
	}
	return checklist, nil
}

func playbookChecklistItems(checklist map[string]any, checklistNumber int) ([]any, error) {
	rawItems, ok := checklist["items"]
	if !ok || rawItems == nil {
		return []any{}, nil
	}
	items, ok := rawItems.([]any)
	if !ok {
		return nil, fmt.Errorf("checklist_number %d items have unexpected format", checklistNumber)
	}
	return items, nil
}

func playbookTaskItem(playbook map[string]any, playbookID string, checklistNumber, itemNumber int) (map[string]any, error) {
	checklist, err := playbookChecklist(playbook, playbookID, checklistNumber)
	if err != nil {
		return nil, err
	}
	items, err := playbookChecklistItems(checklist, checklistNumber)
	if err != nil {
		return nil, err
	}
	if itemNumber >= len(items) {
		return nil, playbookOutOfRangeError("item_number", itemNumber, playbookID, playbook)
	}
	item, ok := items[itemNumber].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("playbook %s task [%d][%d] has unexpected format", playbookID, checklistNumber, itemNumber)
	}
	return item, nil
}

func ensurePlaybookInvitesUser(playbook map[string]any, userID string) {
	rawInvited := playbook["invited_user_ids"]
	invited, found := normalizePlaybookInvitedUserIDs(rawInvited, userID)
	if !found {
		invited = append(invited, userID)
	}
	playbook["invited_user_ids"] = invited
	playbook["invite_users_enabled"] = true
}

func formatListPlaybooks(resp listPlaybooksResponse) string {
	if len(resp.Items) == 0 {
		return "No playbook templates found."
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "Found %d playbook template(s) (total: %d):\n", len(resp.Items), resp.TotalCount)
	for _, playbook := range resp.Items {
		visibility := "private"
		if playbook.Public {
			visibility = "public"
		}
		archived := ""
		if playbook.DeleteAt != 0 {
			archived = " archived"
		}
		fmt.Fprintf(&sb, "- %s (playbook_id: %s, team_id: %s, %s%s)\n", playbook.Title, playbook.ID, playbook.TeamID, visibility, archived)
	}
	return strings.TrimRight(sb.String(), "\n")
}

func playbookOutOfRangeError(field string, value int, playbookID string, playbook map[string]any) error {
	var sb strings.Builder
	fmt.Fprintf(&sb, "%s %d is out of range for playbook %s. Available tasks:\n", field, value, playbookID)
	writePlaybookChecklists(&sb, playbookID, playbook)
	return fmt.Errorf("%s", sb.String())
}

func writePlaybookChecklists(sb *strings.Builder, playbookID string, playbook map[string]any) {
	title, _ := playbook["title"].(string)
	if strings.TrimSpace(title) == "" {
		title = "Playbook"
	}
	fmt.Fprintf(sb, "**%s** (playbook_id: %s)\n", title, playbookID)

	checklists, ok := playbook["checklists"].([]any)
	if !ok || len(checklists) == 0 {
		sb.WriteString("  (no checklists)\n")
		return
	}
	for ci, rawChecklist := range checklists {
		checklist, ok := rawChecklist.(map[string]any)
		if !ok {
			fmt.Fprintf(sb, "  [%d] (unexpected checklist format)\n", ci)
			continue
		}
		checklistTitle, _ := checklist["title"].(string)
		if strings.TrimSpace(checklistTitle) == "" {
			checklistTitle = fmt.Sprintf("Checklist %d", ci)
		}
		fmt.Fprintf(sb, "  [%d] %s\n", ci, checklistTitle)
		items, ok := checklist["items"].([]any)
		if !ok || len(items) == 0 {
			sb.WriteString("    (no tasks)\n")
			continue
		}
		for ii, rawItem := range items {
			itemTitle := playbookTaskTitle(rawItem)
			if strings.TrimSpace(itemTitle) == "" {
				itemTitle = "(untitled task)"
			}
			fmt.Fprintf(sb, "    [%d][%d] %s\n", ci, ii, itemTitle)
		}
	}
}

func normalizePlaybookInvitedUserIDs(raw any, userID string) ([]any, bool) {
	invited := []any{}
	found := false
	switch ids := raw.(type) {
	case []any:
		for _, id := range ids {
			invited = append(invited, id)
			if s, ok := id.(string); ok && s == userID {
				found = true
			}
		}
	case []string:
		for _, id := range ids {
			invited = append(invited, id)
			if id == userID {
				found = true
			}
		}
	}
	return invited, found
}

func playbookTaskTitle(raw any) string {
	item, ok := raw.(map[string]any)
	if !ok {
		return ""
	}
	title, _ := item["title"].(string)
	return title
}

func playbookChecklists(playbook map[string]any, playbookID string) ([]any, error) {
	rawChecklists, ok := playbook["checklists"]
	if !ok || rawChecklists == nil {
		return []any{}, nil
	}
	checklists, ok := rawChecklists.([]any)
	if !ok {
		return nil, fmt.Errorf("playbook %s checklists have unexpected format: expected a JSON array of sections, got %T", playbookID, rawChecklists)
	}
	return checklists, nil
}

func insertChecklistAt(checklists []any, idx int, val any) []any {
	checklists = append(checklists, nil)
	copy(checklists[idx+1:], checklists[idx:])
	checklists[idx] = val
	return checklists
}

func playbookSection(playbook map[string]any, playbookID string, checklistNumber int) (map[string]any, error) {
	checklists, err := playbookChecklists(playbook, playbookID)
	if err != nil {
		return nil, err
	}
	if checklistNumber >= len(checklists) {
		return nil, playbookSectionOutOfRangeError("checklist_number", checklistNumber, playbookID, playbook)
	}
	checklist, ok := checklists[checklistNumber].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("playbook %s checklist_number %d has unexpected format: expected a JSON object, got %T", playbookID, checklistNumber, checklists[checklistNumber])
	}
	return checklist, nil
}

func playbookSectionOutOfRangeError(field string, value int, playbookID string, playbook map[string]any) error {
	var sb strings.Builder
	fmt.Fprintf(&sb, "%s %d is out of range for playbook %s. Available sections:\n", field, value, playbookID)
	writePlaybookChecklists(&sb, playbookID, playbook)
	return fmt.Errorf("%s", sb.String())
}

func playbookChecklistTitle(raw any) string {
	checklist, ok := raw.(map[string]any)
	if !ok {
		return ""
	}
	title, _ := checklist["title"].(string)
	return title
}

func buildCreatePlaybookItems(items []CreatePlaybookItem, playbook map[string]any) []any {
	out := make([]any, 0, len(items))
	for _, item := range items {
		m := map[string]any{
			"title":       strings.TrimSpace(item.Title),
			"description": item.Description,
			"command":     item.Command,
		}
		if item.AssigneeID != "" {
			m["assignee_id"] = item.AssigneeID
			ensurePlaybookInvitesUser(playbook, item.AssigneeID)
		}
		if item.DueDate != 0 {
			m["due_date"] = item.DueDate
		}
		out = append(out, m)
	}
	return out
}

func hasAssignedCreatePlaybookItems(items []CreatePlaybookItem) bool {
	for _, item := range items {
		if item.AssigneeID != "" {
			return true
		}
	}
	return false
}

func buildCreatePlaybookAttributeBody(args CreatePlaybookAttributeArgs) (map[string]any, error) {
	if err := validateID(args.PlaybookID, "playbook_id"); err != nil {
		return nil, err
	}

	name := strings.TrimSpace(args.Name)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	for _, reserved := range []string{"SEQ", "OWNER", "CREATOR", "PROPERTY_USER"} {
		if strings.EqualFold(name, reserved) {
			return nil, fmt.Errorf("name %q is reserved", name)
		}
	}

	attrType := strings.ToLower(strings.TrimSpace(args.Type))
	if !isSupportedPlaybookAttributeType(attrType) {
		return nil, fmt.Errorf("type must be one of: text, select, multiselect, date, user, multiuser")
	}

	body := map[string]any{
		"name": name,
		"type": attrType,
	}
	if args.Attrs != nil {
		attrs, err := buildCreatePlaybookAttributeAttrs(*args.Attrs, attrType)
		if err != nil {
			return nil, err
		}
		if len(attrs) > 0 {
			body["attrs"] = attrs
		}
	} else if attributeTypeRequiresOptions(attrType) {
		return nil, fmt.Errorf("attrs.options is required for %s attributes", attrType)
	}

	return body, nil
}

func buildCreatePlaybookAttributeAttrs(args CreatePlaybookAttributeAttrs, attrType string) (map[string]any, error) {
	attrs := map[string]any{}

	if visibility := strings.TrimSpace(args.Visibility); visibility != "" {
		switch visibility {
		case app.PropertyFieldVisibilityHidden, app.PropertyFieldVisibilityWhenSet, app.PropertyFieldVisibilityAlways:
			attrs["visibility"] = visibility
		default:
			return nil, fmt.Errorf("attrs.visibility must be one of: hidden, when_set, always")
		}
	}
	if args.SortOrder != 0 {
		attrs["sort_order"] = args.SortOrder
	}
	if parentID := strings.TrimSpace(args.ParentID); parentID != "" {
		if err := validateID(parentID, "attrs.parent_id"); err != nil {
			return nil, err
		}
		attrs["parent_id"] = parentID
	}
	if valueType := strings.TrimSpace(args.ValueType); valueType != "" {
		if valueType != "url" {
			return nil, fmt.Errorf("attrs.value_type must be url when provided")
		}
		attrs["value_type"] = valueType
	}

	if len(args.Options) > 0 {
		options := make([]map[string]any, 0, len(args.Options))
		for i, option := range args.Options {
			name := strings.TrimSpace(option.Name)
			if name == "" {
				return nil, fmt.Errorf("attrs.options[%d].name is required", i)
			}
			out := map[string]any{"name": name}
			if color := strings.TrimSpace(option.Color); color != "" {
				out["color"] = color
			}
			options = append(options, out)
		}
		attrs["options"] = options
	} else if attributeTypeRequiresOptions(attrType) {
		return nil, fmt.Errorf("attrs.options is required for %s attributes", attrType)
	}

	return attrs, nil
}

func isSupportedPlaybookAttributeType(attrType string) bool {
	switch model.PropertyFieldType(attrType) {
	case model.PropertyFieldTypeText, model.PropertyFieldTypeSelect, model.PropertyFieldTypeMultiselect,
		model.PropertyFieldTypeDate, model.PropertyFieldTypeUser, model.PropertyFieldTypeMultiuser:
		return true
	default:
		return false
	}
}

func attributeTypeRequiresOptions(attrType string) bool {
	return model.PropertyFieldType(attrType) == model.PropertyFieldTypeSelect ||
		model.PropertyFieldType(attrType) == model.PropertyFieldTypeMultiselect
}

func validateCreatePlaybookItems(items []CreatePlaybookItem, field string) error {
	for i, item := range items {
		if strings.TrimSpace(item.Title) == "" {
			return fmt.Errorf("%s[%d].title is required", field, i)
		}
	}
	return nil
}

// resolveCreatePlaybookItems returns a copy of items whose assignee
// references have been resolved to user IDs.
func resolveCreatePlaybookItems(ctx context.Context, client APIClient, items []CreatePlaybookItem, field string) ([]CreatePlaybookItem, error) {
	resolved := append([]CreatePlaybookItem(nil), items...)
	for i := range resolved {
		assignee, err := resolveUserRef(ctx, client, resolved[i].AssigneeID, fmt.Sprintf("%s[%d].assignee_id", field, i))
		if err != nil {
			return nil, err
		}
		resolved[i].AssigneeID = assignee
	}
	return resolved, nil
}

// resolveCreatePlaybookUserRefs rewrites every user reference in args to a
// user ID, copying the slices it touches so the caller's arguments are left
// alone. It runs before any request is sent, so an unknown username fails
// without creating a half-configured template.
func resolveCreatePlaybookUserRefs(ctx context.Context, client APIClient, args *CreatePlaybookArgs) error {
	owner, err := resolveUserRef(ctx, client, args.DefaultOwnerID, "default_owner_id")
	if err != nil {
		return err
	}
	args.DefaultOwnerID = owner

	if len(args.InvitedUserIDs) > 0 {
		invited, err := resolveUserRefs(ctx, client, args.InvitedUserIDs, "invited_user_ids")
		if err != nil {
			return err
		}
		args.InvitedUserIDs = invited
	}

	if len(args.Members) > 0 {
		members := append([]CreatePlaybookMember(nil), args.Members...)
		for i := range members {
			userID, err := resolveUserRef(ctx, client, members[i].UserID, fmt.Sprintf("members[%d].user_id", i))
			if err != nil {
				return err
			}
			if userID == "" {
				return fmt.Errorf("members[%d].user_id is required", i)
			}
			members[i].UserID = userID
		}
		args.Members = members
	}

	if len(args.Checklists) > 0 {
		checklists := append([]CreatePlaybookChecklist(nil), args.Checklists...)
		for i := range checklists {
			if len(checklists[i].Items) == 0 {
				continue
			}
			items, err := resolveCreatePlaybookItems(ctx, client, checklists[i].Items, fmt.Sprintf("checklists[%d].items", i))
			if err != nil {
				return err
			}
			checklists[i].Items = items
		}
		args.Checklists = checklists
	}

	return nil
}

func validateCreatePlaybookArgs(args CreatePlaybookArgs) error {
	if args.ReminderTimerDefaultSeconds < 0 {
		return fmt.Errorf("reminder_timer_default_seconds must be non-negative")
	}
	switch args.ChannelMode {
	case "", channelModeCreateNew, channelModeLinkExisting:
	default:
		return fmt.Errorf("channel_mode must be one of %s or %s", channelModeCreateNew, channelModeLinkExisting)
	}
	if args.ChannelID != "" {
		if err := validateID(args.ChannelID, "channel_id"); err != nil {
			return err
		}
	}
	for i, id := range args.BroadcastChannelIDs {
		if err := validateID(id, fmt.Sprintf("broadcast_channel_ids[%d]", i)); err != nil {
			return err
		}
	}
	for i, c := range args.Checklists {
		if strings.TrimSpace(c.Title) == "" {
			return fmt.Errorf("checklists[%d].title is required", i)
		}
		if err := validateCreatePlaybookItems(c.Items, fmt.Sprintf("checklists[%d].items", i)); err != nil {
			return err
		}
	}
	if err := validateMetrics(args.Metrics); err != nil {
		return err
	}
	for i, u := range args.WebhookOnCreationURLs {
		if err := validateWebhookURL(u, fmt.Sprintf("webhook_on_creation_urls[%d]", i)); err != nil {
			return err
		}
	}
	for i, u := range args.WebhookOnStatusUpdateURLs {
		if err := validateWebhookURL(u, fmt.Sprintf("webhook_on_status_update_urls[%d]", i)); err != nil {
			return err
		}
	}
	return nil
}

func validateMetrics(metrics []CreatePlaybookMetric) error {
	if len(metrics) > 4 {
		return fmt.Errorf("metrics cannot contain more than 4 items")
	}
	seen := map[string]bool{}
	for i, m := range metrics {
		title := strings.TrimSpace(m.Title)
		if title == "" {
			return fmt.Errorf("metrics[%d].title is required", i)
		}
		key := strings.ToLower(title)
		if seen[key] {
			return fmt.Errorf("metrics[%d].title duplicates another metric", i)
		}
		seen[key] = true
		switch m.Type {
		case "metric_duration", "metric_currency", "metric_integer":
		default:
			return fmt.Errorf("metrics[%d].type must be one of metric_duration, metric_currency, metric_integer", i)
		}
	}
	return nil
}
func validateWebhookURL(raw, name string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return fmt.Errorf("%s must be an http or https URL", name)
	}
	return nil
}
func boolValue(p *bool, def bool) bool {
	if p == nil {
		return def
	}
	return *p
}
func uniqueStrings(in []string) []string {
	var out []string
	for _, s := range in {
		out = appendUnique(out, s)
	}
	return out
}
func appendUnique(in []string, s string) []string {
	for _, existing := range in {
		if existing == s {
			return in
		}
	}
	return append(in, s)
}
func addNonEmpty(m map[string]any, key, value string) {
	if value != "" {
		m[key] = value
	}
}
