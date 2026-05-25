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
	"github.com/modelcontextprotocol/go-sdk/mcp"
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
	InvitedUserIDs               []string                  `json:"invited_user_ids,omitempty" jsonschema:"Users automatically invited to new run channels. Task assignees are auto-added."`
	InviteUsersEnabled           *bool                     `json:"invite_users_enabled,omitempty" jsonschema:"Whether invited_user_ids are invited to new run channels. Auto-enabled if tasks are pre-assigned."`
	DefaultOwnerID               string                    `json:"default_owner_id,omitempty" jsonschema:"Default owner for new runs. Defaults to the requesting user."`
	DefaultOwnerEnabled          *bool                     `json:"default_owner_enabled,omitempty" jsonschema:"Whether default_owner_id is used for new runs. Defaults to true."`
	BroadcastChannelIDs          []string                  `json:"broadcast_channel_ids,omitempty" jsonschema:"Channels where status updates will be broadcast"`
	BroadcastEnabled             *bool                     `json:"broadcast_enabled,omitempty" jsonschema:"Whether status update broadcasting is enabled. Defaults to true when broadcast_channel_ids is provided."`
	ReminderMessageTemplate      string                    `json:"reminder_message_template,omitempty" jsonschema:"Template for status update reminders"`
	ReminderTimerDefaultSeconds  int64                     `json:"reminder_timer_default_seconds,omitempty" jsonschema:"Default status update reminder interval in seconds. Defaults to 86400."`
	StatusUpdateEnabled          *bool                     `json:"status_update_enabled,omitempty" jsonschema:"Whether status updates are enabled for runs"`
	Metrics                      []CreatePlaybookMetric    `json:"metrics,omitempty" jsonschema:"Optional key metrics, maximum 4"`
	ChannelID                    string                    `json:"channel_id,omitempty" jsonschema:"Existing channel to link to new runs when channel_mode links an existing channel"`
	ChannelMode                  *int                      `json:"channel_mode,omitempty" jsonschema:"Run channel mode. 0=create new channel, 1=link existing channel"`
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
	AssigneeID  string `json:"assignee_id,omitempty"`
	DueDate     int64  `json:"due_date,omitempty"`
}
type CreatePlaybookMember struct {
	UserID string   `json:"user_id"`
	Roles  []string `json:"roles,omitempty"`
}
type CreatePlaybookMetric struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Type        string `json:"type"`
	Target      *int64 `json:"target,omitempty"`
}

type createPlaybookResult struct {
	PlaybookURL string `json:"playbook_url"`
	Playbook    any    `json:"playbook"`
}

func (p *PlaybooksToolProvider) addPlaybookTools(server *mcp.Server) {
	addTool(server, p.clientFactory, "create_playbook", "Create a Mattermost Playbook in a team with optional stages/checklists, tasks, members, invitations, default owner, broadcast settings, metrics, run channel options, and webhooks. Returns the created playbook and browser URL.", toolCreatePlaybook)
}

func (p *PlaybooksToolProvider) addMCPHelperPlaybookTools(server *mcphelper.Server) {
	addMCPHelperTool(server, p.clientFactory, "create_playbook", "Create a Mattermost Playbook in a team with optional stages/checklists, tasks, members, invitations, default owner, broadcast settings, metrics, run channel options, and webhooks. Returns the created playbook and browser URL.", toolCreatePlaybook)
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
	if args.ChannelMode != nil {
		body["channel_mode"] = *args.ChannelMode
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

func validateCreatePlaybookArgs(args CreatePlaybookArgs) error {
	if args.ReminderTimerDefaultSeconds < 0 {
		return fmt.Errorf("reminder_timer_default_seconds must be positive")
	}
	if args.DefaultOwnerID != "" {
		if err := validateID(args.DefaultOwnerID, "default_owner_id"); err != nil {
			return err
		}
	}
	if args.ChannelID != "" {
		if err := validateID(args.ChannelID, "channel_id"); err != nil {
			return err
		}
	}
	for i, id := range args.InvitedUserIDs {
		if err := validateID(id, fmt.Sprintf("invited_user_ids[%d]", i)); err != nil {
			return err
		}
	}
	for i, id := range args.BroadcastChannelIDs {
		if err := validateID(id, fmt.Sprintf("broadcast_channel_ids[%d]", i)); err != nil {
			return err
		}
	}
	for i, m := range args.Members {
		if err := validateID(m.UserID, fmt.Sprintf("members[%d].user_id", i)); err != nil {
			return err
		}
	}
	for i, c := range args.Checklists {
		if strings.TrimSpace(c.Title) == "" {
			return fmt.Errorf("checklists[%d].title is required", i)
		}
		for j, item := range c.Items {
			if strings.TrimSpace(item.Title) == "" {
				return fmt.Errorf("checklists[%d].items[%d].title is required", i, j)
			}
			if item.AssigneeID != "" {
				if err := validateID(item.AssigneeID, fmt.Sprintf("checklists[%d].items[%d].assignee_id", i, j)); err != nil {
					return err
				}
			}
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
