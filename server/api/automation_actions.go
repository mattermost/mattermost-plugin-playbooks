// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/ops"
)

func runResult(run *app.PlaybookRun) map[string]model.AutomationValue {
	if run == nil {
		return nil
	}
	return map[string]model.AutomationValue{
		"id":             model.AutomationText(run.ID),
		"name":           model.AutomationText(run.Name),
		"playbook_id":    model.AutomationText(run.PlaybookID),
		"team_id":        model.AutomationText(run.TeamID),
		"channel_id":     model.AutomationText(run.ChannelID),
		"current_status": model.AutomationText(run.CurrentStatus),
		"sequential_id":  model.AutomationText(run.SequentialID),
		"summary":        {Type: model.AutomationValueTextarea, Text: run.Summary},
		"retrospective":  {Type: model.AutomationValueTextarea, Text: run.Retrospective},
	}
}

func playbookResult(playbook *app.Playbook) map[string]model.AutomationValue {
	if playbook == nil {
		return nil
	}
	return map[string]model.AutomationValue{
		"id":          model.AutomationText(playbook.ID),
		"title":       model.AutomationText(playbook.Title),
		"description": {Type: model.AutomationValueTextarea, Text: playbook.Description},
		"team_id":     model.AutomationText(playbook.TeamID),
		"num_stages":  model.AutomationInt(playbook.NumStages),
		"num_steps":   model.AutomationInt(playbook.NumSteps),
		"public":      model.AutomationBool(playbook.Public),
	}
}

func textField(fields map[string]model.AutomationValue, key string) string {
	value, ok := fields[key]
	if !ok {
		return ""
	}
	return value.Text
}

func intField(fields map[string]model.AutomationValue, key string) int {
	value, ok := fields[key]
	if !ok {
		return 0
	}
	return int(value.Int)
}

// ExecuteAutomation translates a Weave hook call into the shared run and playbook operations.
func ExecuteAutomation(runs *ops.Runs, playbooks *ops.Playbooks, req *model.AutomationActionRequest) (*model.AutomationActionResponse, string) {
	if req == nil || req.CallerPluginID != weaveCallerPluginID {
		return nil, "automation actions are only available to Weave"
	}
	if runs == nil || playbooks == nil {
		return nil, "playbooks is not ready"
	}
	if req.ActingUserID == "" {
		return nil, "acting user is required"
	}
	if req.RunAs == "" || req.RunAs == "bot" {
		return nil, "plugin_action cannot run as the bot"
	}
	caller := ops.Caller{
		Principal:  req.ActingUserID,
		Invoker:    req.InvokerUserID,
		OwnerScope: req.OwnerScope,
		RunAs:      req.RunAs,
	}
	fields := req.Fields
	switch req.Action {
	case "get_run":
		run, err := runs.Read(caller, textField(fields, "run_id"))
		if err != nil {
			return nil, err.Error()
		}
		return &model.AutomationActionResponse{Fields: runResult(run)}, ""
	case "get_playbook":
		playbook, err := playbooks.Read(caller, textField(fields, "playbook_id"))
		if err != nil {
			return nil, err.Error()
		}
		return &model.AutomationActionResponse{Fields: playbookResult(playbook)}, ""
	case "get_run_by_channel":
		found, run, err := runs.ReadByChannel(caller, textField(fields, "channel_id"))
		if err != nil {
			return nil, err.Error()
		}
		if !found {
			return &model.AutomationActionResponse{Fields: map[string]model.AutomationValue{
				"found": model.AutomationBool(false),
			}}, ""
		}
		out := map[string]model.AutomationValue{
			"found":      model.AutomationBool(true),
			"id":         model.AutomationText(run.ID),
			"name":       model.AutomationText(run.Name),
			"team_id":    model.AutomationText(run.TeamID),
			"channel_id": model.AutomationText(run.ChannelID),
		}
		return &model.AutomationActionResponse{Fields: out}, ""
	case "start_run":
		run, err := runs.Start(caller, textField(fields, "playbook_id"), textField(fields, "team_id"), textField(fields, "name"), textField(fields, "owner_user_id"))
		if err != nil {
			return nil, err.Error()
		}
		return &model.AutomationActionResponse{Fields: map[string]model.AutomationValue{
			"id":         model.AutomationText(run.ID),
			"channel_id": model.AutomationText(run.ChannelID),
		}}, ""
	case "post_status":
		if err := runs.PostStatus(caller, textField(fields, "run_id"), textField(fields, "message")); err != nil {
			return nil, err.Error()
		}
		return &model.AutomationActionResponse{}, ""
	case "finish_run":
		if err := runs.Finish(caller, textField(fields, "run_id")); err != nil {
			return nil, err.Error()
		}
		return &model.AutomationActionResponse{Fields: map[string]model.AutomationValue{"id": model.AutomationText(textField(fields, "run_id"))}}, ""
	case "restore_run":
		if err := runs.Restore(caller, textField(fields, "run_id")); err != nil {
			return nil, err.Error()
		}
		return &model.AutomationActionResponse{Fields: map[string]model.AutomationValue{"id": model.AutomationText(textField(fields, "run_id"))}}, ""
	case "set_task_state":
		if err := runs.SetTaskState(caller, textField(fields, "run_id"), intField(fields, "checklist"), intField(fields, "item"), textField(fields, "new_state")); err != nil {
			return nil, err.Error()
		}
		return &model.AutomationActionResponse{}, ""
	case "add_task":
		if err := runs.AddTask(caller, textField(fields, "run_id"), intField(fields, "checklist"), textField(fields, "title")); err != nil {
			return nil, err.Error()
		}
		return &model.AutomationActionResponse{}, ""
	default:
		return nil, "unknown playbooks action"
	}
}
