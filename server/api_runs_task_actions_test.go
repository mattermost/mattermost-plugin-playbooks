// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestRunTaskActionsREST(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	e.CreateGuest()

	createRunWithItem := func(t *testing.T) *client.PlaybookRun {
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
			Items: []client.ChecklistItem{{Title: "Item"}},
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
		require.Len(t, edited.Checklists[0].Items[0].TaskActions[0].Actions, 1)
		require.Equal(t, string(app.MarkItemAsDoneActionType), edited.Checklists[0].Items[0].TaskActions[0].Actions[0].Type)
		require.Equal(t, actionPayload, edited.Checklists[0].Items[0].TaskActions[0].Actions[0].Payload)

		newTriggerPayload := `{"keywords":["one", "two", "edited"], "user_ids":["abc"]}`
		err = e.PlaybooksClient.PlaybookRuns.SetTaskActions(context.Background(), run.ID, 0, 0, []client.TaskAction{
			taskAction(newTriggerPayload, actionPayload),
		})
		require.NoError(t, err)

		edited, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, newTriggerPayload, edited.Checklists[0].Items[0].TaskActions[0].Trigger.Payload)
		require.Len(t, edited.Checklists[0].Items[0].TaskActions[0].Actions, 1)
		require.Equal(t, string(app.MarkItemAsDoneActionType), edited.Checklists[0].Items[0].TaskActions[0].Actions[0].Type)
		require.Equal(t, actionPayload, edited.Checklists[0].Items[0].TaskActions[0].Actions[0].Payload)
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

	t.Run("missing task_actions field is rejected", func(t *testing.T) {
		run := createRunWithItem(t)
		url := fmt.Sprintf("%s/plugins/playbooks/api/v0/runs/%s/checklists/0/item/0/task_actions", e.ServerClient.URL, run.ID)
		req, err := http.NewRequest(http.MethodPut, url, strings.NewReader(`{}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+e.ServerClient.AuthToken)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("null task_actions is rejected", func(t *testing.T) {
		run := createRunWithItem(t)
		url := fmt.Sprintf("%s/plugins/playbooks/api/v0/runs/%s/checklists/0/item/0/task_actions", e.ServerClient.URL, run.ID)
		req, err := http.NewRequest(http.MethodPut, url, strings.NewReader(`{"task_actions":null}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+e.ServerClient.AuthToken)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("nil client slice clears task actions via empty array", func(t *testing.T) {
		run := createRunWithItem(t)
		err := e.PlaybooksClient.PlaybookRuns.SetTaskActions(context.Background(), run.ID, 0, 0, []client.TaskAction{
			taskAction(`{"keywords":["one"], "user_ids":[]}`, `{"enabled":false}`),
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.SetTaskActions(context.Background(), run.ID, 0, 0, nil)
		require.NoError(t, err)

		edited, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Empty(t, edited.Checklists[0].Items[0].TaskActions)
	})
}
