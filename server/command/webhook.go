// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package command

import (
	"flag"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

const webhookHelpText = `**Webhook commands:**
- ` + "`/playbook webhook create --name <name> --playbook <id>|--run <id>`" + ` — Create a new incoming webhook.
- ` + "`/playbook webhook list --playbook <id>|--run <id>`" + ` — List incoming webhooks.
- ` + "`/playbook webhook delete <webhook-id>`" + ` — Delete an incoming webhook.`

func (r *Runner) actionWebhook(args []string) {
	if len(args) < 1 {
		r.postCommandResponse(webhookHelpText)
		return
	}

	command := strings.ToLower(args[0])
	params := []string{}
	if len(args) > 1 {
		params = args[1:]
	}

	switch command {
	case "create":
		r.actionWebhookCreate(params)
	case "list":
		r.actionWebhookList(params)
	case "delete":
		r.actionWebhookDelete(params)
	default:
		r.postCommandResponse(webhookHelpText)
	}
}

func (r *Runner) actionWebhookCreate(args []string) {
	fs := flag.NewFlagSet("webhook-create", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	name := fs.String("name", "", "Webhook name (required)")
	playbookID := fs.String("playbook", "", "Playbook ID (scope to a playbook)")
	runID := fs.String("run", "", "Run ID (scope to a run)")

	if err := fs.Parse(args); err != nil {
		r.postCommandResponse(fmt.Sprintf("Error parsing flags: %s", err.Error()))
		return
	}

	if *name == "" {
		r.postCommandResponse("The `--name` flag is required.")
		return
	}

	if *playbookID == "" && *runID == "" {
		r.postCommandResponse("Either `--playbook <id>` or `--run <id>` is required.")
		return
	}

	if *playbookID != "" && *runID != "" {
		r.postCommandResponse("Provide only one of `--playbook` or `--run`, not both.")
		return
	}

	var teamID string

	if *playbookID != "" {
		pb, err := r.playbookService.Get(*playbookID)
		if err != nil {
			r.postCommandResponse(fmt.Sprintf("Playbook not found: %s", *playbookID))
			return
		}
		if err := r.permissions.PlaybookViewWithPlaybook(r.args.UserId, pb); err != nil {
			r.postCommandResponse("You don't have permission to access this playbook.")
			return
		}
		teamID = pb.TeamID
	}

	if *runID != "" {
		run, err := r.playbookRunService.GetPlaybookRun(*runID)
		if err != nil {
			r.postCommandResponse(fmt.Sprintf("Run not found: %s", *runID))
			return
		}
		if err := r.permissions.RunView(r.args.UserId, *runID); err != nil {
			r.postCommandResponse("You don't have permission to access this run.")
			return
		}
		teamID = run.TeamID
	}

	webhook := app.IncomingWebhook{
		Name:          *name,
		CreatorID:     r.args.UserId,
		TeamID:        teamID,
		PlaybookID:    *playbookID,
		PlaybookRunID: *runID,
	}

	created, err := r.incomingWebhookStore.Create(webhook)
	if err != nil {
		r.warnUserAndLogErrorf("Error creating webhook: %v", err)
		return
	}

	siteURL := ""
	if cfg := r.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL; cfg != nil {
		siteURL = *cfg
	}
	webhookURL := fmt.Sprintf("%s/plugins/playbooks/hooks/%s", siteURL, created.ID)

	response := fmt.Sprintf(`Incoming webhook **%s** created.

**URL:** `+"`%s`"+`

:warning: Keep this URL secret — the webhook ID is the credential.
To revoke access, delete the webhook with:
`+"```"+`
/playbook webhook delete %s
`+"```"+`

**Example:**
`+"```"+`
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "update_property", "property_name": "Build Status", "value": "passed"}' \
  %s
`+"```", *name, webhookURL, created.ID, webhookURL)

	r.postCommandResponse(response)
}

func (r *Runner) actionWebhookList(args []string) {
	fs := flag.NewFlagSet("webhook-list", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	playbookID := fs.String("playbook", "", "Playbook ID")
	runID := fs.String("run", "", "Run ID")

	if err := fs.Parse(args); err != nil {
		r.postCommandResponse(fmt.Sprintf("Error parsing flags: %s", err.Error()))
		return
	}

	if *playbookID == "" && *runID == "" {
		r.postCommandResponse("Either `--playbook <id>` or `--run <id>` is required.")
		return
	}

	if *playbookID != "" && *runID != "" {
		r.postCommandResponse("Provide only one of `--playbook` or `--run`, not both.")
		return
	}

	// Permission checks.
	if *playbookID != "" {
		if err := r.permissions.PlaybookView(r.args.UserId, *playbookID); err != nil {
			r.postCommandResponse("You don't have permission to access this playbook.")
			return
		}
	}
	if *runID != "" {
		if err := r.permissions.RunView(r.args.UserId, *runID); err != nil {
			r.postCommandResponse("You don't have permission to access this run.")
			return
		}
	}

	var webhooks []app.IncomingWebhook
	var err error
	var scopeLabel string

	if *playbookID != "" {
		webhooks, err = r.incomingWebhookStore.GetByPlaybookID(*playbookID)
		scopeLabel = fmt.Sprintf("playbook `%s`", *playbookID)
	} else {
		webhooks, err = r.incomingWebhookStore.GetByPlaybookRunID(*runID)
		scopeLabel = fmt.Sprintf("run `%s`", *runID)
	}

	if err != nil {
		r.warnUserAndLogErrorf("Error listing webhooks: %v", err)
		return
	}

	if len(webhooks) == 0 {
		r.postCommandResponse(fmt.Sprintf("No incoming webhooks found for %s.", scopeLabel))
		return
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("**Incoming webhooks for %s:**\n\n", scopeLabel))
	sb.WriteString("| Name | Creator | Created |\n")
	sb.WriteString("|------|---------|--------|\n")

	for _, wh := range webhooks {
		creatorName := wh.CreatorID
		if user, err := r.pluginAPI.User.Get(wh.CreatorID); err == nil {
			creatorName = "@" + user.Username
		}
		createdAt := time.UnixMilli(wh.CreateAt).Format("2006-01-02 15:04")
		sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n", wh.Name, creatorName, createdAt))
	}

	r.postCommandResponse(sb.String())
}

func (r *Runner) actionWebhookDelete(args []string) {
	if len(args) < 1 {
		r.postCommandResponse("Usage: `/playbook webhook delete <webhook-id>`")
		return
	}

	webhookID := args[0]

	webhook, err := r.incomingWebhookStore.Get(webhookID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Webhook not found: `%s`", webhookID))
		return
	}

	// Check the caller can view the webhook's scope.
	if webhook.PlaybookID != "" {
		if err := r.permissions.PlaybookView(r.args.UserId, webhook.PlaybookID); err != nil {
			r.postCommandResponse("You don't have permission to access this webhook's playbook.")
			return
		}
	}
	if webhook.PlaybookRunID != "" {
		if err := r.permissions.RunView(r.args.UserId, webhook.PlaybookRunID); err != nil {
			r.postCommandResponse("You don't have permission to access this webhook's run.")
			return
		}
	}

	// Only the creator or a system admin can delete.
	if webhook.CreatorID != r.args.UserId {
		if !r.pluginAPI.User.HasPermissionTo(r.args.UserId, model.PermissionManageSystem) {
			r.postCommandResponse("Only the webhook creator or a system administrator can delete this webhook.")
			return
		}
	}

	if err := r.incomingWebhookStore.Delete(webhookID); err != nil {
		r.warnUserAndLogErrorf("Error deleting webhook: %v", err)
		return
	}

	r.postCommandResponse(fmt.Sprintf("Webhook **%s** (`%s`) deleted.", webhook.Name, webhookID))
}
