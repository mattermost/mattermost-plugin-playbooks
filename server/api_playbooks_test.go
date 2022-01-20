package main

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlaybooks(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()

	t.Run("unlicenced servers can't create a private playbook", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test1",
			TeamID: e.BasicTeam.Id,
			Public: false,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, id)
	})

	t.Run("create public playbook, unlicensed with zero pre-existing playbooks in the team, should succeed", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test1",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
	})

	t.Run("create public playbook, unlicensed with one pre-existing playbook in the team, should succeed", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test2",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
	})

	e.SetE10Licence()

	t.Run("create playbook, e10 licenced with one pre-existing playbook in the team, should now succeed", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test2",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
	})

	t.Run("e10 licenced servers can't create private playbooks", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test3",
			TeamID: e.BasicTeam.Id,
			Public: false,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, id)
	})

	e.SetE20Licence()

	t.Run("e20 licenced servers can create private playbooks", func(t *testing.T) {
		_, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test4",
			TeamID: e.BasicTeam.Id,
			Public: false,
		})
		assert.Nil(t, err)
	})

	t.Run("create playbook with no permissions to broadcast channel", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:               "test5",
			TeamID:              e.BasicTeam.Id,
			BroadcastChannelIDs: []string{e.BasicPrivateChannel.Id},
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Empty(t, id)
	})

	t.Run("archived playbooks cannot be updated or used to create new runs", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test6 - to be archived",
			TeamID: e.BasicTeam.Id,
		})
		assert.Nil(t, err)

		playbook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), id)
		assert.Nil(t, err)

		// Make sure we /can/ update
		playbook.Title = "New Title!"
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *playbook)
		assert.Nil(t, err)

		err = e.PlaybooksClient.Playbooks.Archive(context.Background(), id)
		assert.Nil(t, err)

		// Test that we cannot update an archived playbook
		playbook.Title = "Another title"
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *playbook)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)

		// Test that we cannot use an archived playbook to start a new run
		_, err = e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  id,
		})
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
	})

	t.Run("playbooks can be searched by title", func(t *testing.T) {
		id, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 1 -- all access",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		id, err = e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 2 -- only regular user access",
			TeamID: e.BasicTeam.Id,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		id, err = e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 3 -- strange string: hümberdångle",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		id, err = e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SearchTest 4 -- team 2 string: よこそ",
			TeamID: e.BasicTeam2.Id,
			Public: true,
		})
		assert.Nil(t, err)
		assert.NotEmpty(t, id)

		playbookResults, err := e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "SearchTest",
		})
		assert.Nil(t, err)
		assert.Equal(t, 4, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "SearchTest 2",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "ümber",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "よこそ",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient2.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "SearchTest",
		})
		assert.Nil(t, err)
		assert.Equal(t, 2, playbookResults.TotalCount)

		playbookResults, err = e.PlaybooksClient2.Playbooks.List(context.Background(), "", 0, 10, client.PlaybookListOptions{
			SearchTeam: "ümberdå",
		})
		assert.Nil(t, err)
		assert.Equal(t, 1, playbookResults.TotalCount)
	})
}

func TestPlaybooksRetrieval(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("get playbook", func(t *testing.T) {
		result, err := e.PlaybooksClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		assert.Equal(t, result.ID, e.BasicPlaybook.ID)
	})

	t.Run("get multiple playbooks", func(t *testing.T) {
		actualList, err := e.PlaybooksClient.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{})
		require.NoError(t, err)
		assert.Greater(t, len(actualList.Items), 0)
	})
}

func TestPlaybookUpdate(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("update playbook properties", func(t *testing.T) {
		e.BasicPlaybook.Description = "This is the updated description"
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)
	})

	t.Run("update playbook no permissions to broadcast", func(t *testing.T) {
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("update playbook without chaning existing broadcast channel", func(t *testing.T) {
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)

		e.BasicPlaybook.Description = "unrelated update"
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)
	})
}

func TestPlaybooksSort(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()
	e.SetE20Licence()

	playbookAID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "A",
		TeamID: e.BasicTeam.Id,
		Checklists: []client.Checklist{
			{
				Title: "A",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
				},
			},
		},
	})
	require.NoError(t, err)
	playbookBID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "B",
		TeamID: e.BasicTeam.Id,
		Checklists: []client.Checklist{
			{
				Title: "B",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
				},
			},
			{
				Title: "B",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
				},
			},
		},
	})
	require.NoError(t, err)
	_, err = e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Some Run",
		OwnerUserID: e.AdminUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookBID,
	})
	require.NoError(t, err)
	playbookCID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "C",
		TeamID: e.BasicTeam.Id,
		Checklists: []client.Checklist{
			{
				Title: "C",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
			{
				Title: "C",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
			{
				Title: "C",
				Items: []client.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
		},
	})
	require.NoError(t, err)
	_, err = e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Some Run",
		OwnerUserID: e.AdminUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookCID,
	})
	require.NoError(t, err)
	_, err = e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Some Run",
		OwnerUserID: e.AdminUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookCID,
	})
	require.NoError(t, err)

	testData := []struct {
		testName           string
		sortField          client.Sort
		sortDirection      client.SortDirection
		expectedList       []string
		expectedErr        error
		expectedStatusCode int
	}{
		{
			testName:           "get playbooks with invalid sort field",
			sortField:          "test",
			sortDirection:      "",
			expectedList:       nil,
			expectedErr:        errors.New("bad parameter 'sort' (test)"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with invalid sort direction",
			sortField:          "",
			sortDirection:      "test",
			expectedList:       nil,
			expectedErr:        errors.New("bad parameter 'direction' (test)"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with no sort fields",
			sortField:          "",
			sortDirection:      "",
			expectedList:       []string{playbookAID, playbookBID, playbookCID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=title direction=asc",
			sortField:          client.SortByTitle,
			sortDirection:      "asc",
			expectedList:       []string{playbookAID, playbookBID, playbookCID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=title direction=desc",
			sortField:          client.SortByTitle,
			sortDirection:      "desc",
			expectedList:       []string{playbookCID, playbookBID, playbookAID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=stages direction=asc",
			sortField:          client.SortByStages,
			sortDirection:      "asc",
			expectedList:       []string{playbookAID, playbookBID, playbookCID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=stages direction=desc",
			sortField:          client.SortByStages,
			sortDirection:      "desc",
			expectedList:       []string{playbookCID, playbookBID, playbookAID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=steps direction=asc",
			sortField:          client.SortBySteps,
			sortDirection:      "asc",
			expectedList:       []string{playbookAID, playbookBID, playbookCID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=steps direction=desc",
			sortField:          client.SortBySteps,
			sortDirection:      "desc",
			expectedList:       []string{playbookCID, playbookBID, playbookAID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=runs direction=asc",
			sortField:          client.SortByRuns,
			sortDirection:      "asc",
			expectedList:       []string{playbookAID, playbookBID, playbookCID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=runs direction=desc",
			sortField:          client.SortByRuns,
			sortDirection:      "desc",
			expectedList:       []string{playbookCID, playbookBID, playbookAID},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
	}

	for _, data := range testData {
		t.Run(data.testName, func(t *testing.T) {
			actualList, err := e.PlaybooksAdminClient.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{
				Sort:      data.sortField,
				Direction: data.sortDirection,
			})

			if data.expectedErr == nil {
				require.NoError(t, err)
				require.Equal(t, len(data.expectedList), len(actualList.Items))
				for i, item := range actualList.Items {
					assert.Equal(t, data.expectedList[i], item.ID)
				}
			} else {
				requireErrorWithStatusCode(t, err, data.expectedStatusCode)
				assert.Contains(t, err.Error(), data.expectedErr.Error())
				require.Empty(t, actualList)
			}
		})
	}

}

func TestPlaybooksPaging(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()
	e.SetE20Licence()

	_, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "test1",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)
	_, err = e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "test2",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)
	_, err = e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "test3",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)

	testData := []struct {
		testName           string
		page               int
		perPage            int
		expectedErr        error
		expectedStatusCode int
		expectedTotalCount int
		expectedPageCount  int
		expectedHasMore    bool
		expectedNumItems   int
	}{
		{
			testName:           "get playbooks with negative page values",
			page:               -1,
			perPage:            -1,
			expectedErr:        errors.New("bad parameter"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with page=0 per_page=0",
			page:               0,
			perPage:            0,
			expectedTotalCount: 3,
			expectedPageCount:  1,
			expectedHasMore:    false,
			expectedNumItems:   3,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with page=0 per_page=3",
			page:               0,
			perPage:            3,
			expectedTotalCount: 3,
			expectedPageCount:  1,
			expectedHasMore:    false,
			expectedNumItems:   3,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with page=0 per_page=2",
			page:               0,
			perPage:            2,
			expectedTotalCount: 3,
			expectedPageCount:  2,
			expectedHasMore:    true,
			expectedNumItems:   2,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with page=1 per_page=2",
			page:               1,
			perPage:            2,
			expectedTotalCount: 3,
			expectedPageCount:  2,
			expectedHasMore:    false,
			expectedNumItems:   1,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with page=2 per_page=2",
			page:               2,
			perPage:            2,
			expectedTotalCount: 3,
			expectedPageCount:  2,
			expectedHasMore:    false,
			expectedNumItems:   0,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with page=9999 per_page=2",
			page:               9999,
			perPage:            2,
			expectedTotalCount: 3,
			expectedPageCount:  2,
			expectedHasMore:    false,
			expectedNumItems:   0,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
	}

	for _, data := range testData {
		t.Run(data.testName, func(t *testing.T) {
			actualList, err := e.PlaybooksAdminClient.Playbooks.List(context.Background(), e.BasicTeam.Id, data.page, data.perPage, client.PlaybookListOptions{})

			if data.expectedErr == nil {
				require.NoError(t, err)
				assert.Equal(t, data.expectedTotalCount, actualList.TotalCount)
				assert.Equal(t, data.expectedPageCount, actualList.PageCount)
				assert.Equal(t, data.expectedHasMore, actualList.HasMore)
				assert.Len(t, actualList.Items, data.expectedNumItems)
			} else {
				requireErrorWithStatusCode(t, err, data.expectedStatusCode)
				assert.Contains(t, err.Error(), data.expectedErr.Error())
				require.Empty(t, actualList)
			}
		})
	}
}

func getPlaybookIDsList(playbooks []client.Playbook) []string {
	ids := []string{}
	for _, pb := range playbooks {
		ids = append(ids, pb.ID)
	}

	return ids
}

func TestPlaybooksPermissions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("test no permissions to create", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
		defer func() {
			e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		e.Permissions.RemovePermissionFromRole(model.PermissionPublicPlaybookCreate.Id, model.TeamUserRoleId)
		e.Permissions.RemovePermissionFromRole(model.PermissionPrivatePlaybookCreate.Id, model.TeamUserRoleId)

		resultPublic, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test1",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Equal(t, "", resultPublic)

		resultPrivate, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "test2",
			TeamID: e.BasicTeam.Id,
			Public: false,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		assert.Equal(t, "", resultPrivate)

	})

	t.Run("permissions to get private playbook", func(t *testing.T) {
		_, err := e.PlaybooksClient2.Playbooks.Get(context.Background(), e.BasicPrivatePlaybook.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("list playbooks", func(t *testing.T) {
		t.Run("user in private", func(t *testing.T) {
			results, err := e.PlaybooksClient.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{})
			require.NoError(t, err)

			expectedIDs := getPlaybookIDsList([]client.Playbook{*e.BasicPlaybook, *e.BasicPrivatePlaybook})

			assert.ElementsMatch(t, expectedIDs, getPlaybookIDsList(results.Items))
		})

		t.Run("user in private list all", func(t *testing.T) {
			results, err := e.PlaybooksClient.Playbooks.List(context.Background(), "", 0, 100, client.PlaybookListOptions{})
			require.NoError(t, err)

			expectedIDs := getPlaybookIDsList([]client.Playbook{*e.BasicPlaybook, *e.BasicPrivatePlaybook})

			assert.ElementsMatch(t, expectedIDs, getPlaybookIDsList(results.Items))
		})

		t.Run("user not in private", func(t *testing.T) {
			results, err := e.PlaybooksClient2.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{})
			require.NoError(t, err)

			expectedIDs := getPlaybookIDsList([]client.Playbook{*e.BasicPlaybook})

			assert.ElementsMatch(t, expectedIDs, getPlaybookIDsList(results.Items))
		})

		t.Run("user not in private list all", func(t *testing.T) {
			results, err := e.PlaybooksClient2.Playbooks.List(context.Background(), "", 0, 100, client.PlaybookListOptions{})
			require.NoError(t, err)

			expectedIDs := getPlaybookIDsList([]client.Playbook{*e.BasicPlaybook})

			assert.ElementsMatch(t, expectedIDs, getPlaybookIDsList(results.Items))
		})

		t.Run("not in team", func(t *testing.T) {
			_, err := e.PlaybooksClientNotInTeam.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{})
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})
	})

	t.Run("update playbook", func(t *testing.T) {
		e.BasicPlaybook.Description = "updated"
		e.BasicPrivatePlaybook.Description = "updated"

		t.Run("user not in private", func(t *testing.T) {
			err := e.PlaybooksClient2.Playbooks.Update(context.Background(), *e.BasicPrivatePlaybook)
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})

		t.Run("public with no permissions", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.RemovePermissionFromRole(model.PermissionPublicPlaybookManageProperties.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})

		t.Run("private with no permissions", func(t *testing.T) {
			defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
			defer func() {
				e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
			}()
			e.Permissions.RemovePermissionFromRole(model.PermissionPrivatePlaybookManageProperties.Id, model.PlaybookMemberRoleId)

			err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPrivatePlaybook)
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
		})

	})
}

func TestPlaybooksConversions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("public to private conversion", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
		defer func() {
			e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		e.Permissions.RemovePermissionFromRole(model.PermissionPublicPlaybookMakePrivate.Id, model.PlaybookMemberRoleId)

		e.BasicPlaybook.Public = false
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		e.Permissions.AddPermissionToRole(model.PermissionPublicPlaybookMakePrivate.Id, model.PlaybookMemberRoleId)

		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)

	})

	t.Run("private to public conversion", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions()
		defer func() {
			e.Permissions.RestoreDefaultRolePermissions(defaultRolePermissions)
		}()
		e.Permissions.RemovePermissionFromRole(model.PermissionPrivatePlaybookMakePublic.Id, model.PlaybookMemberRoleId)

		e.BasicPlaybook.Public = true
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		e.Permissions.AddPermissionToRole(model.PermissionPrivatePlaybookMakePublic.Id, model.PlaybookMemberRoleId)

		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)

	})
}

func TestPlaybooksImportExport(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()
	e.SetE20Licence()
	e.CreateBasicPlaybook()

	t.Run("Export", func(t *testing.T) {
		result, err := e.PlaybooksClient.Playbooks.Export(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		var exportedPlaybook app.Playbook
		err = json.Unmarshal(result, &exportedPlaybook)
		require.NoError(t, err)
		assert.Equal(t, e.BasicPlaybook.Title, exportedPlaybook.Title)
	})
}

func TestPlaybooksDuplicate(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()
	e.SetE20Licence()
	e.CreateBasicPlaybook()

	t.Run("Duplicate", func(t *testing.T) {
		newID, err := e.PlaybooksClient.Playbooks.Duplicate(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.NotEqual(t, e.BasicPlaybook.ID, newID)

		duplicatedPlaybook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), newID)
		require.NoError(t, err)

		assert.Equal(t, "Copy of "+e.BasicPlaybook.Title, duplicatedPlaybook.Title)
		assert.Equal(t, e.BasicPlaybook.Description, duplicatedPlaybook.Description)
		assert.Equal(t, e.BasicPlaybook.TeamID, duplicatedPlaybook.TeamID)
	})
}
