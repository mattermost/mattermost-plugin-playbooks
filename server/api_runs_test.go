package main

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/v2/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
	"gotest.tools/assert"
)

func TestRunCreation(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("dialog requests", func(t *testing.T) {
		for name, tc := range map[string]struct {
			dialogRequest model.SubmitDialogRequest
			expected      func(t *testing.T, result *http.Response, err error)
		}{
			"valid": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.NoError(t, err)
					assert.Equal(t, http.StatusCreated, result.StatusCode)
				},
			},
			"valid from post": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  `{"post_id": "` + e.BasicPublicChannelPost.Id + `"}`,
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.NoError(t, err)
					assert.Equal(t, http.StatusCreated, result.StatusCode)
				},
			},
			"somone else's user id": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.AdminUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "somerun",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusBadRequest, result.StatusCode)
				},
			},
			"missing playbook id": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: "noesnotexist",
						app.DialogFieldNameKey:       "somerun",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusInternalServerError, result.StatusCode)
				},
			},
			"no permissions to postid": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  `{"post_id": "` + e.BasicPrivateChannelPost.Id + `"}`,
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusInternalServerError, result.StatusCode)
				},
			},
		} {
			t.Run(name, func(t *testing.T) {
				dialogRequestBytes, err := json.Marshal(tc.dialogRequest)
				require.NoError(t, err)
				result, err := e.ServerClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/dialog", dialogRequestBytes, "")
				tc.expected(t, result, err)
			})
		}
	})
}

func TestChecklistManagement(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createNewRunWithNoChecklists := func(t *testing.T) *client.PlaybookRun {
		t.Helper()

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 0)

		return run
	}

	t.Run("checklist creation - success: empty checklist", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		title := "A new checklist"

		// Create a valid, empty checklist
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: title,
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Make sure the new checklist is there
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Equal(t, title, editedRun.Checklists[0].Title)
	})

	t.Run("checklist creation - success: checklist with items", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		title := "A new checklist"

		// Create a valid checklist with some items
		items := []client.ChecklistItem{
			{
				Title:       "First",
				Description: "",
			},
			{
				Title:       "Second",
				Description: "Description",
			},
		}
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: title,
			Items: items,
		})
		require.NoError(t, err)

		// Make sure the new checklist is there
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Equal(t, title, editedRun.Checklists[0].Title)
		require.Equal(t, "First", editedRun.Checklists[0].Items[0].Title)
		require.Equal(t, "Second", editedRun.Checklists[0].Items[1].Title)
		require.Equal(t, "Description", editedRun.Checklists[0].Items[1].Description)
	})

	t.Run("checklist creation - failure: no title", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Try to create a new checklist with no title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "",
			Items: []client.ChecklistItem{},
		})
		require.Error(t, err)

		// Make sure that the checklist was not added
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 0)
	})

	t.Run("checklist renaming - success", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		oldTitle := "Old Title"
		newTitle := "New Title"

		// Create a new checklist with a known title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: oldTitle,
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Rename the checklist to a new title
		err = e.PlaybooksClient.PlaybookRuns.RenameChecklist(context.Background(), run.ID, 0, newTitle)
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklist's title has changed
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Equal(t, newTitle, editedRun.Checklists[0].Title)
	})

	t.Run("checklist renaming - failure: no title", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		oldTitle := "Old Title"
		newTitle := ""

		// Create a valid checklist
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: oldTitle,
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Try to rename the checklist to an empty title
		err = e.PlaybooksClient.PlaybookRuns.RenameChecklist(context.Background(), run.ID, 0, newTitle)
		require.Error(t, err)
	})

	t.Run("checklist renaming - failure: wrong checklist number", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		newTitle := "New Title"

		// Try to rename a checklist that does not exist (negative number)
		err := e.PlaybooksClient.PlaybookRuns.RenameChecklist(context.Background(), run.ID, -1, newTitle)
		require.Error(t, err)

		// Try to rename a checklist that does not exist (number greater than the index of the last checklist)
		err = e.PlaybooksClient.PlaybookRuns.RenameChecklist(context.Background(), run.ID, len(run.Checklists), newTitle)
		require.Error(t, err)
	})

	t.Run("checklist removal - success: result in no checklists", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		require.Len(t, run.Checklists, 0)

		// Create a valid checklist
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "title",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklist was created
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)

		// Remove the recently created checklist
		err = e.PlaybooksClient.PlaybookRuns.RemoveChecklist(context.Background(), run.ID, 0)
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklist was removed
		editedRun, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 0)
	})

	t.Run("checklist removal - success: still some checklists", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Create two valid checklists -- the first call to CreateChecklist will be the last checklist,
		// as CreateChecklist prepends the checklist
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Second checklist",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "First checklist",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklists were created
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 2)

		// Remove the last checklist
		err = e.PlaybooksClient.PlaybookRuns.RemoveChecklist(context.Background(), run.ID, 1)
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklist was removed
		editedRun, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Equal(t, "First checklist", editedRun.Checklists[0].Title)
	})

	t.Run("checklist removal - failure: wrong checklist number", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Try to remove a checklist that does not exist (negative number)
		err := e.PlaybooksClient.PlaybookRuns.RemoveChecklist(context.Background(), run.ID, -1)
		require.Error(t, err)

		// Try to rename a checklist that does not exist (number greater than the index of the last checklist)
		err = e.PlaybooksClient.PlaybookRuns.RemoveChecklist(context.Background(), run.ID, 0)
		require.Error(t, err)

		// Create a checklist so that there is at least one
		err = e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Second checklist",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Retrieve the run again and make sure that there is one checklist
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)

		// Try to remove a checklist that does not exist (number greater than the index of the last checklist)
		err = e.PlaybooksClient.PlaybookRuns.RemoveChecklist(context.Background(), run.ID, 1)
		require.Error(t, err)
	})

	t.Run("checklist adding - success", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Create a new checklist with a known title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Checklist Title",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Add the new checklistItem
		itemTitle := "New echo item"
		command := "/echo hi!"
		description := "A very complicated checklist item."
		err = e.PlaybooksClient.PlaybookRuns.AddChecklistItem(context.Background(), run.ID, 0, client.ChecklistItem{
			Title:       itemTitle,
			Command:     command,
			Description: description,
		})
		require.NoError(t, err)

		// Retrieve the run again and make sure that the checklistItem is there
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, editedRun.Checklists, 1)
		require.Len(t, editedRun.Checklists[0].Items, 1)
		require.Equal(t, itemTitle, editedRun.Checklists[0].Items[0].Title)
		require.Equal(t, command, editedRun.Checklists[0].Items[0].Command)
		require.Equal(t, description, editedRun.Checklists[0].Items[0].Description)
	})

	t.Run("checklist adding - failure: no title", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Create a new checklist with a known title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Checklist Title",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Add the new checklistItem with an invalid title
		err = e.PlaybooksClient.PlaybookRuns.AddChecklistItem(context.Background(), run.ID, 0, client.ChecklistItem{
			Title: "",
		})
		require.Error(t, err)
	})

	t.Run("checklist adding - failure: wrong checklist number", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)

		// Create a new checklist with a known title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Checklist Title",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Add the new checklistItem -- to an invalid checklist number (negative)
		err = e.PlaybooksClient.PlaybookRuns.AddChecklistItem(context.Background(), run.ID, -1, client.ChecklistItem{
			Title: "New echo item",
		})
		require.Error(t, err)

		// Add the new checklistItem -- to an invalid checklist number (non-existent)
		err = e.PlaybooksClient.PlaybookRuns.AddChecklistItem(context.Background(), run.ID, len(run.Checklists)+1, client.ChecklistItem{
			Title: "New echo item",
		})
		require.Error(t, err)
	})
}
