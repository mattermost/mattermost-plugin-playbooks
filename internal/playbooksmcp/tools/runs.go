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
)

// --- Argument structs ---

type ListRunsArgs struct {
	TeamID      string   `json:"team_id,omitempty" jsonschema:"Filter by team ID (26-char Mattermost ID)"`
	Status      string   `json:"status,omitempty" jsonschema:"Filter by status: InProgress or Finished"`
	OwnerUserID string   `json:"owner_user_id,omitempty" jsonschema:"Filter by owner user ID. Use 'me' for the current user."`
	Type        string   `json:"type,omitempty" jsonschema:"Filter by run type: playbook or channelChecklist"`
	Types       []string `json:"types,omitempty" jsonschema:"Filter by run types. Valid values: playbook, channelChecklist"`
	Page        int      `json:"page,omitempty" jsonschema:"Page number (0-indexed)"`
	PerPage     int      `json:"per_page,omitempty" jsonschema:"Number of results per page (max 100)"`
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
	AssigneeID  string `json:"assignee_id,omitempty" jsonschema:"Optional user ID to assign the item to"`
	Command     string `json:"command,omitempty" jsonschema:"Optional slash command to associate with the item"`
	DueDate     int64  `json:"due_date,omitempty" jsonschema:"Optional due date as Unix timestamp in milliseconds"`
}

type GetRunArgs struct {
	RunID string `json:"run_id" jsonschema:"The ID of the playbook run to retrieve"`
}

type UpdateRunStatusArgs struct {
	RunID           string `json:"run_id" jsonschema:"The ID of the playbook run"`
	Message         string `json:"message" jsonschema:"Status update message (supports Markdown)"`
	ReminderSeconds int64  `json:"reminder_seconds,omitempty" jsonschema:"Seconds until the next reminder (default: 3600)"`
	FinishRun       bool   `json:"finish_run,omitempty" jsonschema:"If true the run is finished after posting the update"`
}

type FinishRunArgs struct {
	RunID string `json:"run_id" jsonschema:"The ID of the playbook run to finish"`
}

type ChangeRunOwnerArgs struct {
	RunID   string `json:"run_id" jsonschema:"The ID of the playbook run"`
	OwnerID string `json:"owner_id" jsonschema:"The user ID of the new owner"`
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
}

type playbookRunDetail struct {
	ID                 string      `json:"id"`
	Name               string      `json:"name"`
	Summary            string      `json:"summary"`
	CurrentStatus      string      `json:"current_status"`
	OwnerUserID        string      `json:"owner_user_id"`
	TeamID             string      `json:"team_id"`
	ChannelID          string      `json:"channel_id"`
	PlaybookID         string      `json:"playbook_id"`
	Type               string      `json:"type"`
	CreateAt           int64       `json:"create_at"`
	EndAt              int64       `json:"end_at"`
	LastStatusUpdateAt int64       `json:"last_status_update_at"`
	ParticipantIDs     []string    `json:"participant_ids"`
	Checklists         []checklist `json:"checklists"`
}

// --- Tool registration ---

func (p *PlaybooksToolProvider) addMCPHelperRunTools(server *mcphelper.Server) {
	addMCPHelperTool(server, p.clientFactory, "list_runs",
		"List playbook runs and channel checklists with optional filters. Returns a paginated list showing ID, name, type, status, owner, and timestamps. Use status='InProgress' to see active runs and type='channelChecklist' to list checklists. Example: {\"status\": \"InProgress\", \"type\": \"channelChecklist\", \"per_page\": 5}",
		toolListRuns)

	addMCPHelperTool(server, p.clientFactory, "create_checklist",
		"Create a channel checklist (a playbook run without an associated playbook) in an existing Mattermost channel. The authenticated user is used as owner. Optionally include initial sections and items. Example: {\"name\": \"Release checklist\", \"channel_id\": \"abc123...\", \"sections\": [{\"title\": \"Pre-release\", \"items\": [{\"title\": \"Confirm changelog\"}]}]}",
		toolCreateChecklist)

	addMCPHelperTool(server, p.clientFactory, "get_run",
		"Get full details of a specific playbook run, including checklists with item states, participants, and status. Use this to understand the current state of a run before taking action. Example: {\"run_id\": \"abc123...\"}",
		toolGetRun)

	addMCPHelperTool(server, p.clientFactory, "update_run_status",
		"Post a status update to a playbook run. The message supports Markdown. Optionally set a reminder interval or finish the run. You must be a participant to post updates. Example: {\"run_id\": \"abc123...\", \"message\": \"Investigation complete, root cause identified.\", \"reminder_seconds\": 1800}",
		toolUpdateRunStatus)

	addMCPHelperTool(server, p.clientFactory, "finish_run",
		"Finish (close) a playbook run. This marks the run as Finished. Example: {\"run_id\": \"abc123...\"}",
		toolFinishRun)

	addMCPHelperTool(server, p.clientFactory, "change_run_owner",
		"Change the owner of a playbook run. The new owner must be a valid Mattermost user. Example: {\"run_id\": \"abc123...\", \"owner_id\": \"def456...\"}",
		toolChangeRunOwner)
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
	if args.Status != "" {
		params.Add("statuses", args.Status)
	}
	if args.OwnerUserID != "" {
		params.Set("owner_user_id", args.OwnerUserID)
	}
	if args.Type != "" {
		if err := validateRunType(args.Type); err != nil {
			return "", err
		}
		params.Add("types", args.Type)
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
	if err := validateInitialSections(args.Sections); err != nil {
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

	for i, section := range args.Sections {
		items := append([]CreateChecklistItem(nil), section.Items...)
		for j := range items {
			items[j].Title = strings.TrimSpace(items[j].Title)
		}
		sectionBody := map[string]any{
			"title": strings.TrimSpace(section.Title),
			"items": items,
		}
		if err := client.Post(ctx, fmt.Sprintf("runs/%s/checklists", run.ID), sectionBody, nil); err != nil {
			return "", fmt.Errorf("created checklist run %s, but failed to add section %d: %w", run.ID, i, err)
		}
	}

	if len(args.Sections) > 0 {
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
		return "", fmt.Errorf("failed to get run: %w", err)
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
		reminder = 3600
	}

	body := map[string]any{
		"message":    args.Message,
		"reminder":   reminder,
		"finish_run": args.FinishRun,
	}

	if err := client.Post(ctx, fmt.Sprintf("runs/%s/status", args.RunID), body, nil); err != nil {
		return "", fmt.Errorf("failed to update status: %w", err)
	}

	return fmt.Sprintf("Status update posted to run %s.", args.RunID), nil
}

func toolFinishRun(ctx context.Context, client APIClient, args FinishRunArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}

	if err := client.Put(ctx, fmt.Sprintf("runs/%s/finish", args.RunID), nil, nil); err != nil {
		return "", fmt.Errorf("failed to finish run: %w", err)
	}

	return fmt.Sprintf("Run %s has been finished.", args.RunID), nil
}

func toolChangeRunOwner(ctx context.Context, client APIClient, args ChangeRunOwnerArgs) (string, error) {
	if err := validateID(args.RunID, "run_id"); err != nil {
		return "", err
	}
	if err := validateID(args.OwnerID, "owner_id"); err != nil {
		return "", err
	}

	body := map[string]string{
		"owner_id": args.OwnerID,
	}

	if err := client.Post(ctx, fmt.Sprintf("runs/%s/owner", args.RunID), body, nil); err != nil {
		return "", fmt.Errorf("failed to change owner: %w", err)
	}

	return fmt.Sprintf("Owner of run %s changed to %s.", args.RunID, args.OwnerID), nil
}

func validateRunType(runType string) error {
	switch runType {
	case "playbook", "channelChecklist":
		return nil
	default:
		return fmt.Errorf("type must be one of playbook or channelChecklist")
	}
}

func validateInitialSections(sections []CreateChecklistSection) error {
	for i, section := range sections {
		if strings.TrimSpace(section.Title) == "" {
			return fmt.Errorf("sections[%d].title is required", i)
		}
		for j, item := range section.Items {
			if strings.TrimSpace(item.Title) == "" {
				return fmt.Errorf("sections[%d].items[%d].title is required", i, j)
			}
			if item.AssigneeID != "" {
				if err := validateID(item.AssigneeID, fmt.Sprintf("sections[%d].items[%d].assignee_id", i, j)); err != nil {
					return err
				}
			}
		}
	}
	return nil
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

func formatRunDetail(run playbookRunDetail) string {
	data, err := json.MarshalIndent(run, "", "  ")
	if err != nil {
		return fmt.Sprintf("Run: %s (%s) — Status: %s", run.Name, run.ID, run.CurrentStatus)
	}
	return string(data)
}
