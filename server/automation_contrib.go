// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import "github.com/mattermost/mattermost/server/public/model"

func (p *Plugin) registerAutomation() error {
	if err := p.API.RegisterAutomationGroup(model.AutomationGroupDescriptor{
		Label: "Playbooks",
		Icon:  "play-outline",
	}); err != nil {
		return err
	}
	signals := []model.AutomationSignalDescriptor{
		{Name: "playbook_created", Label: "Playbook created", Group: "Playbooks", Icon: "play-outline", Fields: idFields("playbook_id", "team_id", "user_id")},
		{Name: "playbook_updated", Label: "Playbook updated", Group: "Playbooks", Icon: "play-outline", Fields: idFields("playbook_id", "team_id", "user_id")},
		{Name: "playbook_archived", Label: "Playbook archived", Group: "Playbooks", Icon: "archive-outline", Fields: idFields("playbook_id", "team_id", "user_id")},
		{Name: "run_created", Label: "Run created", Group: "Playbooks", Icon: "play-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id", "post_id", "user_id")},
		{Name: "run_finished", Label: "Run finished", Group: "Playbooks", Icon: "checkbox-marked-circle-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id", "user_id")},
		{Name: "run_restored", Label: "Run restored", Group: "Playbooks", Icon: "play-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id", "user_id")},
		{Name: "run_status_changed", Label: "Run status changed", Group: "Playbooks", Icon: "playlist-check", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id", "status", "user_id")},
		{Name: "status_updated", Label: "Status updated", Group: "Playbooks", Icon: "playlist-check", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id", "post_id", "user_id")},
		{Name: "task_state_modified", Label: "Task state modified", Group: "Playbooks", Icon: "checkbox-marked-circle-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id", "item_id", "action", "user_id")},
		{Name: "owner_changed", Label: "Owner changed", Group: "Playbooks", Icon: "account-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id", "owner_user_id", "user_id")},
		{Name: "assignee_changed", Label: "Assignee changed", Group: "Playbooks", Icon: "account-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id", "item_id", "assignee_user_id")},
		{Name: "participants_changed", Label: "Participants changed", Group: "Playbooks", Icon: "account-multiple-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id")},
		{Name: "retrospective_published", Label: "Retrospective published", Group: "Playbooks", Icon: "play-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id", "post_id", "user_id")},
		{Name: "retrospective_canceled", Label: "Retrospective canceled", Group: "Playbooks", Icon: "close-circle-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id")},
		{Name: "property_changed", Label: "Property changed", Group: "Playbooks", Icon: "playlist-check", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id", "property_field_id")},
		{Name: "channel_archived", Label: "Channel archived", Group: "Playbooks", Icon: "archive-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id")},
		{Name: "channel_unarchived", Label: "Channel unarchived", Group: "Playbooks", Icon: "archive-outline", Fields: idFields("run_id", "playbook_id", "team_id", "channel_id")},
	}
	for _, signal := range signals {
		if err := p.API.RegisterAutomationSignal(signal); err != nil {
			return err
		}
	}
	actions := []model.AutomationActionDescriptor{
		{Type: "start_run", Label: "Start run", Description: "Creates a run. Playbook, team, and owner accept an id or signal data. Run name is the title of the new run.", Group: "Playbooks", Icon: "play-outline", Method: "POST", Path: "/api/v0/runs", Emits: []string{"run_created"}, Fields: []model.AutomationField{
			actionField("playbook_id", "Playbook"),
			actionField("team_id", "Team"),
			actionField("name", "Run name"),
			actionField("owner_user_id", "Owner"),
		}, Results: []model.AutomationField{actionField("id", "Run"), actionField("channel_id", "Channel")}},
		{Type: "get_run", Label: "Get run", Description: "Reads one run. Leave Run empty to use the run from the signal that started this flow.", Group: "Playbooks", Icon: "play-outline", Method: "GET", Path: "/api/v0/runs/{{.run_id}}", Fields: []model.AutomationField{actionField("run_id", "Run")}, Results: runReadResults()},
		{Type: "get_playbook", Label: "Get playbook", Description: "Reads one playbook. Leave Playbook empty to use the playbook from the signal that started this flow.", Group: "Playbooks", Icon: "play-outline", Method: "GET", Path: "/api/v0/playbooks/{{.playbook_id}}", Fields: []model.AutomationField{actionField("playbook_id", "Playbook")}, Results: playbookReadResults()},
		{Type: "get_run_by_channel", Label: "Get run by channel", Description: "Reads the run for a channel. Found is false when that channel is not exactly one playbook run.", Group: "Playbooks", Icon: "play-outline", Method: "GET", Path: "/api/v0/runs/for-channel/{{.channel_id}}", Fields: []model.AutomationField{actionField("channel_id", "Channel")}, Results: runByChannelResults()},
		{Type: "post_status", Label: "Post status update", Group: "Playbooks", Icon: "playlist-check", Method: "POST", Path: "/api/v0/runs/{{.run_id}}/status", Emits: []string{"status_updated"}, Fields: []model.AutomationField{actionField("run_id", "Run"), typedField("message", "Message", model.AutomationValueTextarea)}},
		{Type: "finish_run", Label: "Finish run", Group: "Playbooks", Icon: "checkbox-marked-circle-outline", Method: "PUT", Path: "/api/v0/runs/{{.run_id}}/finish", Emits: []string{"run_finished"}, Fields: []model.AutomationField{actionField("run_id", "Run")}, Results: []model.AutomationField{actionField("id", "Run")}},
		{Type: "restore_run", Label: "Restore run", Group: "Playbooks", Icon: "play-outline", Method: "PUT", Path: "/api/v0/runs/{{.run_id}}/restore", Emits: []string{"run_restored"}, Fields: []model.AutomationField{actionField("run_id", "Run")}, Results: []model.AutomationField{actionField("id", "Run")}},
		{Type: "set_task_state", Label: "Set task state", Group: "Playbooks", Icon: "checkbox-marked-circle-outline", Method: "PUT", Path: "/api/v0/runs/{{.run_id}}/checklists/{{.checklist}}/item/{{.item}}/state", Emits: []string{"task_state_modified"}, Fields: []model.AutomationField{
			actionField("run_id", "Run"),
			typedField("checklist", "Checklist number", model.AutomationValueInt),
			typedField("item", "Task number", model.AutomationValueInt),
			actionField("new_state", "State"),
		}},
		{Type: "add_task", Label: "Add task", Group: "Playbooks", Icon: "format-list-bulleted", Method: "POST", Path: "/api/v0/runs/{{.run_id}}/checklists/{{.checklist}}/add", Fields: []model.AutomationField{
			actionField("run_id", "Run"),
			typedField("checklist", "Checklist number", model.AutomationValueInt),
			actionField("title", "Task title"),
		}},
	}
	for _, action := range actions {
		if err := p.API.RegisterAutomationAction(action); err != nil {
			return err
		}
	}
	return nil
}

func actionField(key, label string) model.AutomationField {
	return typedField(key, label, model.AutomationValueText)
}

func typedField(key, label string, kind model.AutomationValueType) model.AutomationField {
	return model.AutomationField{Key: key, Label: label, Type: kind}
}

func runReadResults() []model.AutomationField {
	return []model.AutomationField{
		actionField("id", "Run"), actionField("name", "Name"), actionField("playbook_id", "Playbook"),
		actionField("team_id", "Team"), actionField("channel_id", "Channel"), actionField("current_status", "Status"),
		actionField("sequential_id", "ID"), typedField("summary", "Summary", model.AutomationValueTextarea),
		typedField("retrospective", "Retrospective", model.AutomationValueTextarea),
	}
}

func playbookReadResults() []model.AutomationField {
	return []model.AutomationField{
		actionField("id", "Playbook"), actionField("title", "Title"), typedField("description", "Description", model.AutomationValueTextarea),
		actionField("team_id", "Team"), typedField("num_stages", "Stages", model.AutomationValueInt),
		typedField("num_steps", "Steps", model.AutomationValueInt), typedField("public", "Shared", model.AutomationValueBool),
	}
}

func runByChannelResults() []model.AutomationField {
	return []model.AutomationField{
		typedField("found", "Found", model.AutomationValueBool), actionField("id", "Run"), actionField("name", "Name"),
		actionField("team_id", "Team"), actionField("channel_id", "Channel"),
	}
}

func idFields(keys ...string) []model.AutomationField {
	fields := make([]model.AutomationField, len(keys))
	for i, key := range keys {
		fields[i] = model.AutomationField{Key: key, Label: key, Type: "text"}
	}
	return fields
}
