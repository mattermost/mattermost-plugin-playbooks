package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/mattermost/mattermost-plugin-agents/public/mcphelper"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// --- Argument structs ---

type ListRunsArgs struct {
	TeamID      string `json:"team_id,omitempty" jsonschema:"Filter by team ID (26-char Mattermost ID)"`
	Status      string `json:"status,omitempty" jsonschema:"Filter by status: InProgress or Finished"`
	OwnerUserID string `json:"owner_user_id,omitempty" jsonschema:"Filter by owner user ID. Use 'me' for the current user."`
	Page        int    `json:"page,omitempty" jsonschema:"Page number (0-indexed)"`
	PerPage     int    `json:"per_page,omitempty" jsonschema:"Number of results per page (max 100)"`
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
	CreateAt           int64       `json:"create_at"`
	EndAt              int64       `json:"end_at"`
	LastStatusUpdateAt int64       `json:"last_status_update_at"`
	ParticipantIDs     []string    `json:"participant_ids"`
	Checklists         []checklist `json:"checklists"`
}

// --- Tool registration ---

func (p *PlaybooksToolProvider) addRunTools(server *mcp.Server) {
	addTool(server, p.clientFactory, "list_runs",
		"List playbook runs with optional filters. Returns a paginated list of runs showing ID, name, status, owner, and timestamps. Use status='InProgress' to see active runs. Example: {\"status\": \"InProgress\", \"per_page\": 5}",
		toolListRuns)

	addTool(server, p.clientFactory, "get_run",
		"Get full details of a specific playbook run, including checklists with item states, participants, and status. Use this to understand the current state of a run before taking action. Example: {\"run_id\": \"abc123...\"}",
		toolGetRun)

	addTool(server, p.clientFactory, "update_run_status",
		"Post a status update to a playbook run. The message supports Markdown. Optionally set a reminder interval or finish the run. You must be a participant to post updates. Example: {\"run_id\": \"abc123...\", \"message\": \"Investigation complete, root cause identified.\", \"reminder_seconds\": 1800}",
		toolUpdateRunStatus)

	addTool(server, p.clientFactory, "finish_run",
		"Finish (close) a playbook run. This marks the run as Finished. Example: {\"run_id\": \"abc123...\"}",
		toolFinishRun)

	addTool(server, p.clientFactory, "change_run_owner",
		"Change the owner of a playbook run. The new owner must be a valid Mattermost user. Example: {\"run_id\": \"abc123...\", \"owner_id\": \"def456...\"}",
		toolChangeRunOwner)
}

func (p *PlaybooksToolProvider) addMCPHelperRunTools(server *mcphelper.Server) {
	addMCPHelperTool(server, p.clientFactory, "list_runs",
		"List playbook runs with optional filters. Returns a paginated list of runs showing ID, name, status, owner, and timestamps. Use status='InProgress' to see active runs. Example: {\"status\": \"InProgress\", \"per_page\": 5}",
		toolListRuns)

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
	if args.TeamID != "" {
		params.Set("team_id", args.TeamID)
	}
	if args.Status != "" {
		params.Add("statuses", args.Status)
	}
	if args.OwnerUserID != "" {
		params.Set("owner_user_id", args.OwnerUserID)
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
	if args.Message == "" {
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

// --- Formatting helpers ---

func formatListRuns(resp listRunsResponse) string {
	if len(resp.Items) == 0 {
		return "No playbook runs found matching the criteria."
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Found %d runs (showing %d):\n\n", resp.TotalCount, len(resp.Items)))

	for _, r := range resp.Items {
		sb.WriteString(fmt.Sprintf("- **%s** (ID: %s)\n", r.Name, r.ID))
		sb.WriteString(fmt.Sprintf("  Status: %s | Owner: %s | Playbook: %s\n", r.CurrentStatus, r.OwnerUserID, r.PlaybookID))
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
