// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestRunTaskActionsREST(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	e.CreateGuest()

	createRunWithItem := func(t *testing.T, requirements ...client.TaskRequirement) *client.PlaybookRun {
		t.Helper()
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Task actions run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Checklist",
			Items: []client.ChecklistItem{{
				Title:        "Item",
				Requirements: requirements,
			}},
		})
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.Checklists, 1)
		require.Len(t, run.Checklists[0].Items, 1)
		return run
	}

	taskAction := func(triggerPayload, actionPayload string) client.TaskAction {
		return client.TaskAction{
			Trigger: client.TriggerAction{Type: string(app.KeywordsByUsersTriggerType), Payload: triggerPayload},
			Actions: []client.TriggerAction{{Type: string(app.MarkItemAsDoneActionType), Payload: actionPayload}},
		}
	}

	t.Run("set and update task actions", func(t *testing.T) {
		run := createRunWithItem(t)
		triggerPayload := `{"keywords":["one", "two"], "user_ids":["abc"]}`
		actionPayload := `{"enabled":false}`

		err := e.PlaybooksClient.PlaybookRuns.SetTaskActions(context.Background(), run.ID, 0, 0, []client.TaskAction{
			taskAction(triggerPayload, actionPayload),
		})
		require.NoError(t, err)

		edited, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, edited.Checklists[0].Items[0].TaskActions, 1)
		require.Equal(t, string(app.KeywordsByUsersTriggerType), edited.Checklists[0].Items[0].TaskActions[0].Trigger.Type)
		require.Equal(t, triggerPayload, edited.Checklists[0].Items[0].TaskActions[0].Trigger.Payload)

		newTriggerPayload := `{"keywords":["one", "two", "edited"], "user_ids":["abc"]}`
		err = e.PlaybooksClient.PlaybookRuns.SetTaskActions(context.Background(), run.ID, 0, 0, []client.TaskAction{
			taskAction(newTriggerPayload, actionPayload),
		})
		require.NoError(t, err)

		edited, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, newTriggerPayload, edited.Checklists[0].Items[0].TaskActions[0].Trigger.Payload)
	})

	t.Run("guest cannot set task actions", func(t *testing.T) {
		run := createRunWithItem(t)
		err := e.PlaybooksClientGuest.PlaybookRuns.SetTaskActions(context.Background(), run.ID, 0, 0, []client.TaskAction{
			taskAction(`{"keywords":["one"], "user_ids":[]}`, `{"enabled":false}`),
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("invalid task actions are rejected", func(t *testing.T) {
		run := createRunWithItem(t)
		err := e.PlaybooksClient.PlaybookRuns.SetTaskActions(context.Background(), run.ID, 0, 0, []client.TaskAction{
			{
				Trigger: client.TriggerAction{Type: "not_a_real_trigger", Payload: `{}`},
				Actions: []client.TriggerAction{{Type: string(app.MarkItemAsDoneActionType), Payload: `{"enabled":false}`}},
			},
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("finished run is rejected", func(t *testing.T) {
		run := createRunWithItem(t)
		err := e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.SetTaskActions(context.Background(), run.ID, 0, 0, []client.TaskAction{
			taskAction(`{"keywords":["one"], "user_ids":[]}`, `{"enabled":false}`),
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("requirements with enabled mark as done are rejected", func(t *testing.T) {
		run := createRunWithItem(t, client.TaskRequirement{ID: "req-1", Label: "Ticket URL"})
		edited, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, edited.Checklists[0].Items[0].Requirements, 1)

		err = e.PlaybooksClient.PlaybookRuns.SetTaskActions(context.Background(), run.ID, 0, 0, []client.TaskAction{
			taskAction(`{"keywords":["one"], "user_ids":[]}`, `{"enabled":true}`),
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("negative checklist and item indices are rejected", func(t *testing.T) {
		run := createRunWithItem(t)
		actions := []client.TaskAction{
			taskAction(`{"keywords":["one"], "user_ids":[]}`, `{"enabled":false}`),
		}

		err := e.PlaybooksClient.PlaybookRuns.SetTaskActions(context.Background(), run.ID, -1, 0, actions)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)

		err = e.PlaybooksClient.PlaybookRuns.SetTaskActions(context.Background(), run.ID, 0, -1, actions)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})
}
