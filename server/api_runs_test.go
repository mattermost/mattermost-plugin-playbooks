package main

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRunCreation(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("dialog requests", func(t *testing.T) {
		for name, tc := range map[string]struct {
			dialogRequest   model.SubmitDialogRequest
			expected        func(t *testing.T, result *http.Response, err error)
			permissionsPrep func()
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
						app.DialogFieldNameKey:       "no permissions",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusInternalServerError, result.StatusCode)
				},
			},
			"no permissions to playbook": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.PrivatePlaybookNoMembers.ID,
						app.DialogFieldNameKey:       "not happening",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					assert.Equal(t, http.StatusForbidden, result.StatusCode)
				},
			},
			"no permissions to private channels": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				permissionsPrep: func() {
					e.Permissions.RemovePermissionFromRole(model.PermissionCreatePrivateChannel.Id, model.TeamUserRoleId)
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.Error(t, err)
					assert.Equal(t, http.StatusForbidden, result.StatusCode)
				},
			},
			"request userid doesn't match": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.AdminUser.Id,
					State:  "{}",
					Submission: map[string]interface{}{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "bad userid",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.Error(t, err)
					assert.Equal(t, http.StatusBadRequest, result.StatusCode)
				},
			},
		} {
			t.Run(name, func(t *testing.T) {
				dialogRequestBytes, err := json.Marshal(tc.dialogRequest)
				require.NoError(t, err)

				if tc.permissionsPrep != nil {
					defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
					defer func() {
						e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
					}()
					tc.permissionsPrep()
				}

				result, err := e.ServerClient.DoAPIRequestBytes("POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/dialog", dialogRequestBytes, "")
				tc.expected(t, result, err)
			})
		}
	})

	t.Run("create valid run", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
	})

	t.Run("create valid run without playbook", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "No playbook",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
	})

	t.Run("can't without owner", func(t *testing.T) {
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "No owner",
			OwnerUserID: "",
			TeamID:      e.BasicTeam.Id,
		})
		assert.Error(t, err)
	})

	t.Run("can't without team", func(t *testing.T) {
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		assert.Error(t, err)
	})

	t.Run("missing name", func(t *testing.T) {
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		assert.Error(t, err)
	})

	t.Run("archived playbook", func(t *testing.T) {
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.ArchivedPlaybook.ID,
		})
		assert.Error(t, err)
	})
}

func TestRunRetrieval(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("by channel id", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.GetByChannelID(context.Background(), e.BasicRun.ChannelID)
		require.NoError(t, err)
		require.Equal(t, e.BasicRun.ID, run.ID)
	})

	t.Run("by channel id not found", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.GetByChannelID(context.Background(), model.NewId())
		require.Error(t, err)
		require.Nil(t, run)
	})

	t.Run("empty list", func(t *testing.T) {
		list, err := e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam2.Id,
		})
		require.Nil(t, err)
		require.Len(t, list.Items, 0)
	})

	t.Run("filters", func(t *testing.T) {
		endedRun, err := e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Anouther Run",
			TeamID:      e.BasicTeam.Id,
			OwnerUserID: e.AdminUser.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		err = e.PlaybooksAdminClient.PlaybookRuns.Finish(context.Background(), endedRun.ID)
		require.NoError(t, err)

		list, err := e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam.Id,
		})
		require.Nil(t, err)
		require.Len(t, list.Items, 2)

		list, err = e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:   e.BasicTeam.Id,
			Statuses: []client.Status{client.StatusInProgress},
		})
		require.Nil(t, err)
		require.Len(t, list.Items, 1)

		list, err = e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:  e.BasicTeam.Id,
			OwnerID: e.RegularUser.Id,
		})
		require.Nil(t, err)
		require.Len(t, list.Items, 1)
	})

	t.Run("checklist autocomplete", func(t *testing.T) {
		resp, err := e.ServerClient.DoAPIRequest("GET", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/checklist-autocomplete?channel_id="+e.BasicPrivateChannel.Id, "", "")
		assert.Error(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

}

func TestRunStatus(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("update", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update", 600)
		assert.NoError(t, err)
	})

	t.Run("update empty message", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "  \t  \r ", 600)
		assert.Error(t, err)
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

	type ExpectedError struct{ StatusCode int }

	moveItemTests := []struct {
		Title              string
		Checklists         [][]string
		SourceChecklistIdx int
		SourceItemIdx      int
		DestChecklistIdx   int
		DestItemIdx        int
		ExpectedItemTitles [][]string
		ExpectedError      *ExpectedError
	}{
		{
			"One checklist with two items - move the first item",
			[][]string{{"00", "01"}},
			0, 0, 0, 1,
			[][]string{{"01", "00"}},
			nil,
		},
		{
			"One checklist with two items - move the second item",
			[][]string{{"00", "01"}},
			0, 1, 0, 0,
			[][]string{{"01", "00"}},
			nil,
		},
		{
			"One checklist with three items - move the first item to the second position",
			[][]string{{"00", "01", "02"}},
			0, 0, 0, 1,
			[][]string{{"01", "00", "02"}},
			nil,
		},
		{
			"One checklist with three items - move the second item to the first position",
			[][]string{{"00", "01", "02"}},
			0, 1, 0, 0,
			[][]string{{"01", "00", "02"}},
			nil,
		},
		{
			"One checklist with three items - move the first item to the last position",
			[][]string{{"00", "01", "02"}},
			0, 0, 0, 2,
			[][]string{{"01", "02", "00"}},
			nil,
		},
		{
			"Multiple checklists - move from one to another",
			[][]string{{"00", "01", "02"}, {"10", "11", "12"}},
			0, 1, 1, 0,
			[][]string{{"00", "02"}, {"01", "10", "11", "12"}},
			nil,
		},
		{
			"Multiple checklists - move to an empty checklist",
			[][]string{{"00", "01"}, {}},
			0, 0, 1, 0,
			[][]string{{"01"}, {"00"}},
			nil,
		},
		{
			"Multiple checklists - leave the original checklist empty",
			[][]string{{"00"}, {"10"}},
			0, 0, 1, 1,
			[][]string{{}, {"10", "00"}},
			nil,
		},
		{
			"One checklist - invalid source checklist: greater than lenght of checklists",
			[][]string{{"00"}},
			1, 0, 0, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid source checklist: negative number",
			[][]string{{"00"}},
			-1, 0, 0, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid dest checklist: greater than length of items",
			[][]string{{"00"}},
			0, 0, 1, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid dest checklist: negative number",
			[][]string{{"00"}},
			0, 0, -1, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid source item: greater than lenght of items",
			[][]string{{"00"}},
			0, 1, 0, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid source item: negative number",
			[][]string{{"00"}},
			0, -1, 0, 0,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid dest item: greater than length of items",
			[][]string{{"00"}},
			0, 0, 0, 1,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
		{
			"One checklist - invalid dest item: negative number",
			[][]string{{"00"}},
			0, 0, 0, -1,
			[][]string{},
			&ExpectedError{StatusCode: 500},
		},
	}

	for _, test := range moveItemTests {
		t.Run(test.Title, func(t *testing.T) {
			// Create a new empty run
			run := createNewRunWithNoChecklists(t)

			// Add the specified checklists: note that we need to iterate backwards because CreateChecklist prepends new checklists
			for i := len(test.Checklists) - 1; i >= 0; i-- {
				// Generate the items for this checklist
				checklist := test.Checklists[i]
				items := make([]client.ChecklistItem, 0, len(checklist))
				for _, title := range checklist {
					items = append(items, client.ChecklistItem{Title: title})
				}

				// Create the checklist with the defined items
				err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
					Title: "Checklist",
					Items: items,
				})
				require.NoError(t, err)
			}

			// Move the item from its source to its destination
			err := e.PlaybooksClient.PlaybookRuns.MoveChecklistItem(context.Background(), run.ID, test.SourceChecklistIdx, test.SourceItemIdx, test.DestChecklistIdx, test.DestItemIdx)

			// If an error is expected, check that it's the one we expect
			if test.ExpectedError != nil {
				requireErrorWithStatusCode(t, err, test.ExpectedError.StatusCode)
				return
			}

			// If no error is expected, retrieve the run again
			require.NoError(t, err)
			run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
			require.NoError(t, err)

			// And check that the new checklists are ordered as specified by the test data
			for checklistIdx, actualChecklist := range run.Checklists {
				expectedItemTitles := test.ExpectedItemTitles[checklistIdx]
				require.Len(t, actualChecklist.Items, len(expectedItemTitles))

				for itemIdx, actualItem := range actualChecklist.Items {
					require.Equal(t, expectedItemTitles[itemIdx], actualItem.Title)
				}
			}
		})
	}

	moveChecklistTests := []struct {
		Title              string
		Checklists         []string
		SourceChecklistIdx int
		DestChecklistIdx   int
		ExpectedChecklists []string
		ExpectedError      *ExpectedError
	}{
		{
			"Move checklist to the same position",
			[]string{"0"},
			0, 0,
			[]string{"0"},
			nil,
		},
		{
			"Swap two checklists, moving the first one",
			[]string{"0", "1"},
			0, 1,
			[]string{"1", "0"},
			nil,
		},
		{
			"Swap two checklists, moving the second one",
			[]string{"0", "1"},
			1, 0,
			[]string{"1", "0"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - first to second ",
			[]string{"0", "1", "2"},
			0, 1,
			[]string{"1", "0", "2"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - first to third",
			[]string{"0", "1", "2"},
			0, 2,
			[]string{"1", "2", "0"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - second to first",
			[]string{"0", "1", "2"},
			1, 0,
			[]string{"1", "0", "2"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - second to third",
			[]string{"0", "1", "2"},
			1, 2,
			[]string{"0", "2", "1"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - third to first",
			[]string{"0", "1", "2"},
			2, 0,
			[]string{"2", "0", "1"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - third to second",
			[]string{"0", "1", "2"},
			2, 1,
			[]string{"0", "2", "1"},
			nil,
		},
		{
			"Wrong destination index - greater than length of list",
			[]string{"0", "1", "2"},
			0, 5,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
		{
			"Wrong destination index - negative",
			[]string{"0", "1", "2"},
			0, -5,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
		{
			"Wrong source index - greater than length of list",
			[]string{"0", "1", "2"},
			5, 0,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
		{
			"Wrong source index - negative",
			[]string{"0", "1", "2"},
			-5, 0,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
	}

	for _, test := range moveChecklistTests {
		t.Run(test.Title, func(t *testing.T) {
			// Create a new empty run
			run := createNewRunWithNoChecklists(t)

			// Add the specified checklists: note that we need to iterate backwards because CreateChecklist prepends new checklists
			for i := len(test.Checklists) - 1; i >= 0; i-- {
				err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
					Title: test.Checklists[i],
				})
				require.NoError(t, err)
			}

			// Move the checklist from its source to its destination
			err := e.PlaybooksClient.PlaybookRuns.MoveChecklist(context.Background(), run.ID, test.SourceChecklistIdx, test.DestChecklistIdx)

			// If an error is expected, check that it's the one we expect
			if test.ExpectedError != nil {
				requireErrorWithStatusCode(t, err, test.ExpectedError.StatusCode)
				return
			}

			// If no error is expected, retrieve the run again
			require.NoError(t, err)
			run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
			require.NoError(t, err)

			// And check that the new checklists are ordered as specified by the test data
			for checklistIdx, actualChecklist := range run.Checklists {
				require.Equal(t, test.ExpectedChecklists[checklistIdx], actualChecklist.Title)
			}
		})
	}
}
