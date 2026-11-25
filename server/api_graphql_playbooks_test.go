// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/graph-gophers/graphql-go"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGraphQLPlaybooks(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("basic get", func(t *testing.T) {
		var pbResultTest struct {
			Data struct {
				Playbook struct {
					ID    string
					Title string
				}
			}
		}
		testPlaybookQuery := `
			query Playbook($id: String!) {
				playbook(id: $id) {
					id
					title
				}
			}
			`
		err := e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testPlaybookQuery,
			OperationName: "Playbook",
			Variables:     map[string]interface{}{"id": e.BasicPlaybook.ID},
		}, &pbResultTest)
		require.NoError(t, err)

		assert.Equal(t, e.BasicPlaybook.ID, pbResultTest.Data.Playbook.ID)
		assert.Equal(t, e.BasicPlaybook.Title, pbResultTest.Data.Playbook.Title)
	})

	t.Run("list", func(t *testing.T) {
		var pbResultTest struct {
			Data struct {
				Playbooks []struct {
					ID    string
					Title string
				}
			}
		}
		testPlaybookQuery := `
			query Playbooks {
				playbooks {
					id
					title
				}
			}
			`
		err := e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testPlaybookQuery,
			OperationName: "Playbooks",
		}, &pbResultTest)
		require.NoError(t, err)

		assert.Len(t, pbResultTest.Data.Playbooks, 3)
	})

	t.Run("playbook mutate", func(t *testing.T) {
		newUpdatedTitle := "graphqlmutatetitle"

		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{"title": newUpdatedTitle})
		require.NoError(t, err)

		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		require.Equal(t, newUpdatedTitle, updatedPlaybook.Title)
	})

	t.Run("update playbook no permissions to broadcast", func(t *testing.T) {
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{"broadcastChannelIDs": []string{e.BasicPrivateChannel.Id}})
		require.Error(t, err)
	})

	t.Run("update playbook without modifying broadcast channel ids without permission. should succeed because no modification.", func(t *testing.T) {
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{"description": "unrelatedupdate"})
		require.NoError(t, err)
	})

	t.Run("update playbook with too many webhoooks", func(t *testing.T) {
		urls := []string{}
		for i := 0; i < 65; i++ {
			urls = append(urls, "http://localhost/"+strconv.Itoa(i))
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"webhookOnCreationEnabled": true,
			"webhookOnCreationURLs":    urls,
		})
		require.Error(t, err)
	})

	t.Run("change default owner", func(t *testing.T) {
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"defaultOwnerID": e.RegularUser.Id,
		})
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"defaultOwnerID": e.RegularUserNotInTeam.Id,
		})
		require.Error(t, err)
	})
	t.Run("checklist with preset values that need to be cleared", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       "",
				"assigneeModified": 101,
				"state":            "Closed",
				"stateModified":    102,
				"command":          "",
				"commandLastRun":   103,
				"lastSkipped":      104,
				"dueDate":          100,
				"conditionID":      "",
			},
		}

		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
		})

		require.NoError(t, err)

		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		expected := []client.Checklist{
			{
				ID:    updatedPlaybook.Checklists[0].ID, // Use the actual ID from the returned playbook
				Title: "A",
				Items: []client.ChecklistItem{
					{
						ID:               updatedPlaybook.Checklists[0].Items[0].ID, // Use the actual item ID
						Title:            "title1",
						Description:      "description1",
						AssigneeID:       "",
						AssigneeModified: 0,
						State:            "",
						StateModified:    0,
						Command:          "",
						CommandLastRun:   0,
						LastSkipped:      0,
						DueDate:          100,
						TaskActions:      nil, // TaskActions can be nil when not provided
					},
				},
			},
		}

		require.Equal(t, expected, updatedPlaybook.Checklists)
	})

	t.Run("update playbook with pre-assigned task, valid invite user list, and invitations enabled", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
				"conditionID":      "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser.Id},
			"inviteUsersEnabled": true,
		})
		require.NoError(t, err)
	})
}

func TestGraphQLUpdatePlaybookFails(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("update playbook fails because size constraints.", func(t *testing.T) {
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}

		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": []api.UpdateChecklist{
				{
					Title: strings.Repeat("A", (256*1024)+1),
					Items: []api.UpdateChecklistItem{},
				},
			},
		})
		require.Error(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{"title": strings.Repeat("A", 1025)})
		require.Error(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{"description": strings.Repeat("A", 4097)})
		require.Error(t, err)
	})

	t.Run("update playbook with pre-assigned task fails due to disabled invitations", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
				"conditionID":      "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs": []string{e.RegularUser.Id},
		})
		require.Error(t, err)
	})

	t.Run("update playbook with pre-assigned task fails due to missing assignee in existing invite user list", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
				"conditionID":      "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"inviteUsersEnabled": true,
		})
		require.Error(t, err)
	})

	t.Run("update playbook with pre-assigned task fails due to assignee missing in new invite user list", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
				"conditionID":      "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser2.Id},
			"inviteUsersEnabled": true,
		})
		require.Error(t, err)
	})

	t.Run("update playbook with invite user list fails due to missing a pre-assignee", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
				"conditionID":      "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser.Id},
			"inviteUsersEnabled": true,
		})
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"invitedUserIDs": []string{e.RegularUser2.Id},
		})
		require.Error(t, err)
	})

	t.Run("update playbook fails if invitations are getting disabled but there are pre-assigned users", func(t *testing.T) {
		items := []map[string]interface{}{
			{
				"title":            "title1",
				"description":      "description1",
				"assigneeID":       e.RegularUser.Id,
				"assigneeModified": 0,
				"state":            "",
				"stateModified":    0,
				"command":          "",
				"commandLastRun":   0,
				"lastSkipped":      0,
				"dueDate":          0,
				"conditionID":      "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"checklists": map[string]interface{}{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser.Id},
			"inviteUsersEnabled": true,
		})
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]interface{}{
			"inviteUsersEnabled": false,
		})
		require.Error(t, err)
	})
}

func TestUpdatePlaybookFavorite(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("favorite", func(t *testing.T) {
		isFavorite, err := getPlaybookFavorite(e.PlaybooksClient, e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.False(t, isFavorite)

		response, err := updatePlaybookFavorite(e.PlaybooksClient, e.BasicPlaybook.ID, true)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		isFavorite, err = getPlaybookFavorite(e.PlaybooksClient, e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.True(t, isFavorite)
	})

	t.Run("unfavorite", func(t *testing.T) {
		response, err := updatePlaybookFavorite(e.PlaybooksClient, e.BasicPlaybook.ID, false)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		isFavorite, err := getPlaybookFavorite(e.PlaybooksClient, e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.False(t, isFavorite)
	})

	t.Run("favorite playbook with read access", func(t *testing.T) {
		response, err := updatePlaybookFavorite(e.PlaybooksClient2, e.BasicPlaybook.ID, true)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		isFavorite, err := getPlaybookFavorite(e.PlaybooksClient2, e.BasicPlaybook.ID)
		require.NoError(t, err)
		require.True(t, isFavorite)
	})

	t.Run("favorite private playbook no access", func(t *testing.T) {
		response, _ := updatePlaybookFavorite(e.PlaybooksClient, e.PrivatePlaybookNoMembers.ID, false)
		require.NotEmpty(t, response.Errors)
	})
}

func updatePlaybookFavorite(c *client.Client, playbookID string, favorite bool) (graphql.Response, error) {
	mutation := `mutation UpdatePlaybookFavorite($id: String!, $favorite: Boolean!) {
		updatePlaybookFavorite(id: $id, favorite: $favorite)
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "UpdatePlaybookFavorite",
		Variables: map[string]interface{}{
			"id":       playbookID,
			"favorite": favorite,
		},
	}, &response)

	return response, err
}

func getPlaybookFavorite(c *client.Client, playbookID string) (bool, error) {
	query := `
	query GetPlaybookFavorite($id: String!) {
		playbook(id: $id) {
			isFavorite
		}
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         query,
		OperationName: "GetPlaybookFavorite",
		Variables: map[string]interface{}{
			"id": playbookID,
		},
	}, &response)
	if err != nil {
		return false, err
	}
	if len(response.Errors) > 0 {
		return false, fmt.Errorf("error from query %v", response.Errors)
	}

	favoriteResponse := struct {
		Playbook struct {
			IsFavorite bool `json:"isFavorite"`
		} `json:"playbook"`
	}{}
	err = json.Unmarshal(response.Data, &favoriteResponse)
	if err != nil {
		return false, err
	}
	return favoriteResponse.Playbook.IsFavorite, nil
}

func gqlTestPlaybookUpdate(e *TestEnvironment, t *testing.T, playbookID string, updates map[string]interface{}) error {
	testPlaybookMutateQuery := `mutation UpdatePlaybook($id: String!, $updates: PlaybookUpdates!) {
		updatePlaybook(id: $id, updates: $updates)
	}`
	var response graphql.Response
	err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         testPlaybookMutateQuery,
		OperationName: "UpdatePlaybook",
		Variables:     map[string]interface{}{"id": playbookID, "updates": updates},
	}, &response)
	if err != nil {
		return errors.Wrapf(err, "gqlTestPlaybookUpdate graphql failure")
	}

	if len(response.Errors) != 0 {
		return errors.Errorf("gqlTestPlaybookUpdate graphql failure %+v", response.Errors)
	}

	return err
}

func TestGraphQLPlaybooksMetrics(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("metrics get", func(t *testing.T) {
		var pbResultTest struct {
			Data struct {
				Playbook struct {
					ID      string
					Title   string
					Metrics []client.PlaybookMetricConfig
				}
			}
		}
		testPlaybookQuery := `
	query Playbook($id: String!) {
		playbook(id: $id) {
			id
			metrics {
				id
				title
				description
				type
				target
			}
		}
	}
	`
		err := e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testPlaybookQuery,
			OperationName: "Playbook",
			Variables:     map[string]interface{}{"id": e.BasicPlaybook.ID},
		}, &pbResultTest)
		require.NoError(t, err)

		require.Len(t, pbResultTest.Data.Playbook.Metrics, len(e.BasicPlaybook.Metrics))
		require.Equal(t, e.BasicPlaybook.Metrics[0].Title, pbResultTest.Data.Playbook.Metrics[0].Title)
		require.Equal(t, e.BasicPlaybook.Metrics[0].Type, pbResultTest.Data.Playbook.Metrics[0].Type)
		require.Equal(t, e.BasicPlaybook.Metrics[0].Target, pbResultTest.Data.Playbook.Metrics[0].Target)
	})

	t.Run("add metric", func(t *testing.T) {
		testAddMetricQuery := `
		mutation AddMetric($playbookID: String!, $title: String!, $description: String!, $type: String!, $target: Int) {
			addMetric(playbookID: $playbookID, title: $title, description: $description, type: $type, target: $target)
		}
		`
		var response graphql.Response
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testAddMetricQuery,
			OperationName: "AddMetric",
			Variables: map[string]interface{}{
				"playbookID":  e.BasicPlaybook.ID,
				"title":       "New Metric",
				"description": "the description",
				"type":        app.MetricTypeDuration,
			},
		}, &response)
		require.NoError(t, err)
		require.Empty(t, response.Errors)

		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		require.Len(t, updatedPlaybook.Metrics, 2)
		assert.Equal(t, updatedPlaybook.Metrics[1].Title, "New Metric")
	})

	t.Run("update metric", func(t *testing.T) {
		testUpdateMetricQuery := `
		mutation UpdateMetric($id: String!, $title: String, $description: String, $target: Int) {
			updateMetric(id: $id, title: $title, description: $description, target: $target)
		}
		`

		var response graphql.Response
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testUpdateMetricQuery,
			OperationName: "UpdateMetric",
			Variables: map[string]interface{}{
				"id":    e.BasicPlaybook.Metrics[0].ID,
				"title": "Updated Title",
			},
		}, &response)
		require.NoError(t, err)
		require.Empty(t, response.Errors)

		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		require.Len(t, updatedPlaybook.Metrics, 2)
		assert.Equal(t, "Updated Title", updatedPlaybook.Metrics[0].Title)
	})

	t.Run("delete metric", func(t *testing.T) {
		testDeleteMetricQuery := `
		mutation DeleteMetric($id: String!) {
			deleteMetric(id: $id)
		}
		`
		var response graphql.Response
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testDeleteMetricQuery,
			OperationName: "DeleteMetric",
			Variables: map[string]interface{}{
				"id": e.BasicPlaybook.Metrics[0].ID,
			},
		}, &response)
		require.NoError(t, err)
		require.Empty(t, response.Errors)

		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		require.Len(t, updatedPlaybook.Metrics, 1)
	})
}

func gqlTestPlaybookUpdateGuest(e *TestEnvironment, t *testing.T, playbookID string, updates map[string]interface{}) error {
	testPlaybookMutateQuery := `mutation UpdatePlaybook($id: String!, $updates: PlaybookUpdates!) {
		updatePlaybook(id: $id, updates: $updates)
	}`
	var response graphql.Response
	err := e.PlaybooksClientGuest.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         testPlaybookMutateQuery,
		OperationName: "UpdatePlaybook",
		Variables:     map[string]interface{}{"id": playbookID, "updates": updates},
	}, &response)
	if err != nil {
		return errors.Wrapf(err, "gqlTestPlaybookUpdate graphql failure")
	}

	if len(response.Errors) != 0 {
		return errors.Errorf("gqlTestPlaybookUpdate graphql failure %+v", response.Errors)
	}

	return err
}

func TestGraphQLPlaybooksGuests(t *testing.T) {
	e := Setup(t)
	e.SetEnterpriseLicence()
	e.CreateBasic()
	e.CreateGuest()

	t.Run("update playbook guest not member", func(t *testing.T) {
		err := gqlTestPlaybookUpdateGuest(e, t, e.BasicPlaybook.ID, map[string]interface{}{"title": "mutated"})
		require.Error(t, err)
	})

	t.Run("basic get guest not member", func(t *testing.T) {
		testPlaybookQuery := `
			query Playbook($id: String!) {
				playbook(id: $id) {
					id
					title
				}
			}
			`
		var response graphql.Response
		err := e.PlaybooksClientGuest.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testPlaybookQuery,
			OperationName: "Playbook",
			Variables:     map[string]interface{}{"id": e.BasicPlaybook.ID},
		}, &response)
		require.NoError(t, err)
		require.NotZero(t, len(response.Errors))
	})

	t.Run("list guest", func(t *testing.T) {
		var pbResultTest struct {
			Data struct {
				Playbooks []struct {
					ID    string
					Title string
				}
			}
		}
		testPlaybookQuery := `
			query Playbooks {
				playbooks {
					id
					title
				}
			}
			`
		err := e.PlaybooksClientGuest.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testPlaybookQuery,
			OperationName: "Playbooks",
		}, &pbResultTest)
		require.NoError(t, err)

		assert.Len(t, pbResultTest.Data.Playbooks, 0)
	})
}

func gqlDoPlaybookUpdate(c *client.Client, playbookID string, updates map[string]any) error {
	const mutation = `mutation UpdatePlaybook($id: String!, $updates: PlaybookUpdates!) {
		updatePlaybook(id: $id, updates: $updates)
	}`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "UpdatePlaybook",
		Variables:     map[string]any{"id": playbookID, "updates": updates},
	}, &response)
	if err != nil {
		return errors.Wrapf(err, "gqlDoPlaybookUpdate graphql failure")
	}
	if len(response.Errors) != 0 {
		return errors.Errorf("gqlDoPlaybookUpdate graphql errors: %+v", response.Errors)
	}
	return nil
}

func TestUpdatePlaybook_PersistedValuesRemainReadable(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	checklistWithDueDate := func(dueDate float64) []map[string]any {
		return []map[string]any{
			{
				"title": "checklist",
				"items": []map[string]any{
					{
						"title":            "item",
						"description":      "",
						"state":            "",
						"stateModified":    0,
						"assigneeID":       "",
						"assigneeModified": 0,
						"command":          "",
						"commandLastRun":   0,
						"dueDate":          dueDate,
						"conditionID":      "",
					},
				},
			},
		}
	}

	const (
		originalDueDate       = int64(7200000)
		originalReminderTimer = int64(60)
	)

	createPlaybook := func(t *testing.T) string {
		id, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "PersistedValuesPlaybook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			ChannelMode:                 client.PlaybookRunLinkExistingChannel,
			ReminderTimerDefaultSeconds: originalReminderTimer,
			Checklists: []client.Checklist{
				{Title: "checklist", Items: []client.ChecklistItem{{Title: "item", DueDate: originalDueDate}}},
			},
		})
		require.NoError(t, err)
		return id
	}

	// A rejected update must leave every previously stored value untouched. The original
	// ChannelMode is link_existing_channel, which is not the read-path fallback, so an
	// invalid mode that slipped through the write path would be observable here.
	verifyUnchanged := func(t *testing.T, pb *client.Playbook) {
		assert.Equal(t, client.PlaybookRunLinkExistingChannel, pb.ChannelMode)
		assert.Equal(t, originalReminderTimer, pb.ReminderTimerDefaultSeconds)
		require.Len(t, pb.Checklists, 1)
		require.Len(t, pb.Checklists[0].Items, 1)
		assert.Equal(t, originalDueDate, pb.Checklists[0].Items[0].DueDate)
	}

	testCases := []struct {
		name        string
		updates     map[string]any
		expectError bool
		verify      func(t *testing.T, pb *client.Playbook)
	}{
		{
			name:        "unknown channelMode is rejected",
			updates:     map[string]any{"channelMode": "not_a_mode"},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "empty channelMode is rejected",
			updates:     map[string]any{"channelMode": ""},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "channelMode with different casing is rejected",
			updates:     map[string]any{"channelMode": "CREATE_NEW_CHANNEL"},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "channelMode with surrounding whitespace is rejected",
			updates:     map[string]any{"channelMode": " create_new_channel "},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "invalid channelMode combined with valid fields rejects the whole update",
			updates:     map[string]any{"channelMode": "not_a_mode", "checklists": checklistWithDueDate(3600000)},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "fractional checklist item dueDate is rejected",
			updates:     map[string]any{"checklists": checklistWithDueDate(1.5)},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "negative fractional checklist item dueDate is rejected",
			updates:     map[string]any{"checklists": checklistWithDueDate(-1.5)},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "checklist item dueDate outside int64 range is rejected",
			updates:     map[string]any{"checklists": checklistWithDueDate(1e20)},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "large negative checklist item dueDate is rejected",
			updates:     map[string]any{"checklists": checklistWithDueDate(-1e20)},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "checklist item dueDate of 2^63 is rejected",
			updates:     map[string]any{"checklists": checklistWithDueDate(9223372036854775808)},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "checklist item dueDate marshalled in exponent form is rejected",
			updates:     map[string]any{"checklists": checklistWithDueDate(1e21)},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "fractional reminderTimerDefaultSeconds is rejected",
			updates:     map[string]any{"reminderTimerDefaultSeconds": 1.5},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "reminderTimerDefaultSeconds outside int64 range is rejected",
			updates:     map[string]any{"reminderTimerDefaultSeconds": 1e20},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:        "fractional retrospectiveReminderIntervalSeconds is rejected",
			updates:     map[string]any{"retrospectiveReminderIntervalSeconds": 1.5},
			expectError: true,
			verify:      verifyUnchanged,
		},
		{
			name:    "channelMode link_existing_channel is accepted",
			updates: map[string]any{"channelMode": "link_existing_channel"},
			verify: func(t *testing.T, pb *client.Playbook) {
				assert.Equal(t, client.PlaybookRunLinkExistingChannel, pb.ChannelMode)
			},
		},
		{
			name:    "integral checklist item dueDate given in exponent form is accepted",
			updates: map[string]any{"checklists": checklistWithDueDate(1e3)},
			verify: func(t *testing.T, pb *client.Playbook) {
				require.Len(t, pb.Checklists, 1)
				require.Len(t, pb.Checklists[0].Items, 1)
				assert.Equal(t, int64(1000), pb.Checklists[0].Items[0].DueDate)
			},
		},
		{
			name:    "largest float64 below 2^63 is accepted as checklist item dueDate",
			updates: map[string]any{"checklists": checklistWithDueDate(9223372036854774784)},
			verify: func(t *testing.T, pb *client.Playbook) {
				require.Len(t, pb.Checklists, 1)
				require.Len(t, pb.Checklists[0].Items, 1)
				// encoding/json writes the shortest round-tripping decimal for float64.
				assert.Equal(t, int64(9223372036854775000), pb.Checklists[0].Items[0].DueDate)
			},
		},
		{
			name:    "channelMode create_new_channel is accepted",
			updates: map[string]any{"channelMode": "create_new_channel"},
			verify: func(t *testing.T, pb *client.Playbook) {
				assert.Equal(t, client.PlaybookRunCreateNewChannel, pb.ChannelMode)
			},
		},
		{
			name:    "integer checklist item dueDate is accepted",
			updates: map[string]any{"checklists": checklistWithDueDate(3600000)},
			verify: func(t *testing.T, pb *client.Playbook) {
				require.Len(t, pb.Checklists, 1)
				require.Len(t, pb.Checklists[0].Items, 1)
				assert.Equal(t, int64(3600000), pb.Checklists[0].Items[0].DueDate)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			playbookID := createPlaybook(t)

			err := gqlDoPlaybookUpdate(e.PlaybooksClient, playbookID, tc.updates)
			if tc.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
			require.NoError(t, err, "playbook must remain readable after updatePlaybook")
			if tc.verify != nil {
				tc.verify(t, pb)
			}

			err = gqlDoPlaybookUpdate(e.PlaybooksClient, playbookID, map[string]any{"description": "still editable"})
			require.NoError(t, err, "subsequent valid updatePlaybook must succeed")

			pb, err = e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
			require.NoError(t, err)
			assert.Equal(t, "still editable", pb.Description)
		})
	}
}


func TestUpdatePlaybook_ValueValidationDoesNotBypassPermissions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	e.CreateGuest()

	createPlaybook := func(t *testing.T, public bool, adminIsMember bool) string {
		members := []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
		}
		if adminIsMember {
			members = append(members, client.PlaybookMember{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}})
		}
		id, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:       "ValidationPermissionsPlaybook",
			TeamID:      e.BasicTeam.Id,
			Public:      public,
			Members:     members,
			ChannelMode: client.PlaybookRunCreateNewChannel,
		})
		require.NoError(t, err)
		return id
	}

	testCases := []struct {
		name         string
		public       bool
		archive      bool
		excludeAdmin bool
		client       *client.Client
		expectError  bool
		expectedMode client.ChannelPlaybookMode
	}{
		{
			name:         "non-member cannot change channelMode of a private playbook",
			client:       e.PlaybooksClient2,
			expectError:  true,
			expectedMode: client.PlaybookRunCreateNewChannel,
		},
		{
			name:         "guest cannot change channelMode of a public playbook",
			public:       true,
			client:       e.PlaybooksClientGuest,
			expectError:  true,
			expectedMode: client.PlaybookRunCreateNewChannel,
		},
		{
			name:         "member cannot change channelMode of an archived playbook",
			archive:      true,
			client:       e.PlaybooksClient,
			expectError:  true,
			expectedMode: client.PlaybookRunCreateNewChannel,
		},
		{
			name:         "sysadmin cannot change channelMode of an archived playbook",
			archive:      true,
			client:       e.PlaybooksAdminClient,
			expectError:  true,
			expectedMode: client.PlaybookRunCreateNewChannel,
		},
		{
			name:         "member can change channelMode of a private playbook",
			client:       e.PlaybooksClient,
			expectedMode: client.PlaybookRunLinkExistingChannel,
		},
		{
			name:         "non-member sysadmin can change channelMode of a private playbook",
			excludeAdmin: true,
			client:       e.PlaybooksAdminClient,
			expectedMode: client.PlaybookRunLinkExistingChannel,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			playbookID := createPlaybook(t, tc.public, !tc.excludeAdmin)
			if tc.archive {
				require.NoError(t, e.PlaybooksAdminClient.Playbooks.Archive(context.Background(), playbookID))
			}
			if tc.excludeAdmin {
				stored, getErr := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
				require.NoError(t, getErr)
				for _, m := range stored.Members {
					require.NotEqual(t, e.AdminUser.Id, m.UserID, "sysadmin must not be in the stored member list before the update")
				}
			}

			err := gqlDoPlaybookUpdate(tc.client, playbookID, map[string]any{"channelMode": "link_existing_channel"})
			if tc.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
			require.NoError(t, err)
			assert.Equal(t, tc.expectedMode, pb.ChannelMode)
		})
	}
}


func TestAddMetric_PersistedValuesRemainReadable(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	const addMetricMutation = `
	mutation AddMetric($playbookID: String!, $title: String!, $description: String!, $type: String!) {
		addMetric(playbookID: $playbookID, title: $title, description: $description, type: $type)
	}`
	const playbookMetricsQuery = `
	query Playbook($id: String!) {
		playbook(id: $id) { id metrics { title type } }
	}`

	testCases := []struct {
		name        string
		metricType  string
		expectError bool
	}{
		{name: "unknown metric type is rejected", metricType: "not_a_metric_type", expectError: true},
		{name: "empty metric type is rejected", metricType: "", expectError: true},
		{name: "known metric type is accepted", metricType: app.MetricTypeInteger},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
				Title:  "MetricTypePlaybook",
				TeamID: e.BasicTeam.Id,
				Public: true,
				Members: []client.PlaybookMember{
					{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
					{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
				},
			})
			require.NoError(t, err)

			var addResponse graphql.Response
			err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
				Query:         addMetricMutation,
				OperationName: "AddMetric",
				Variables: map[string]any{
					"playbookID":  playbookID,
					"title":       "metric",
					"description": "",
					"type":        tc.metricType,
				},
			}, &addResponse)
			require.NoError(t, err)
			if tc.expectError {
				assert.NotEmpty(t, addResponse.Errors, "addMetric must reject a metric type the read path cannot serve")
			} else {
				require.Empty(t, addResponse.Errors)
			}

			var queryResponse struct {
				Data struct {
					Playbook *struct {
						ID      string
						Metrics []struct {
							Title string
							Type  string
						}
					}
				}
				Errors []struct {
					Message string
				}
			}
			err = e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
				Query:         playbookMetricsQuery,
				OperationName: "Playbook",
				Variables:     map[string]any{"id": playbookID},
			}, &queryResponse)
			require.NoError(t, err)
			require.Empty(t, queryResponse.Errors, "playbook must remain readable over GraphQL after addMetric")
			require.NotNil(t, queryResponse.Data.Playbook)
			if tc.expectError {
				assert.Empty(t, queryResponse.Data.Playbook.Metrics)
			} else {
				require.Len(t, queryResponse.Data.Playbook.Metrics, 1)
				assert.Equal(t, tc.metricType, queryResponse.Data.Playbook.Metrics[0].Type)
			}
		})

		t.Run(tc.name+" over REST create", func(t *testing.T) {
			_, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
				Title:  "MetricTypeRESTPlaybook",
				TeamID: e.BasicTeam.Id,
				Public: true,
				Metrics: []client.PlaybookMetricConfig{
					{Title: "metric", Type: tc.metricType},
				},
			})
			if tc.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}


func TestUpdatePlaybook_MetricTypeValidation(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createPlaybook := func(t *testing.T) *client.Playbook {
		id, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "MetricTypeUpdatePlaybook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			Metrics: []client.PlaybookMetricConfig{
				{Title: "existing", Type: app.MetricTypeCurrency},
			},
		})
		require.NoError(t, err)

		pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), id)
		require.NoError(t, err)
		require.Len(t, pb.Metrics, 1)
		return pb
	}

	t.Run("existing metric without type keeps its stored type", func(t *testing.T) {
		pb := createPlaybook(t)
		existingID := pb.Metrics[0].ID

		pb.Metrics[0].Type = ""
		pb.Metrics[0].Title = "renamed"
		require.NoError(t, e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb))

		updated, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pb.ID)
		require.NoError(t, err)
		require.Len(t, updated.Metrics, 1)
		assert.Equal(t, existingID, updated.Metrics[0].ID)
		assert.Equal(t, "renamed", updated.Metrics[0].Title)
		assert.Equal(t, app.MetricTypeCurrency, updated.Metrics[0].Type)
	})

	t.Run("existing metric with a different type keeps its stored type", func(t *testing.T) {
		pb := createPlaybook(t)

		pb.Metrics[0].Type = "not_a_metric_type"
		require.NoError(t, e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb))

		updated, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pb.ID)
		require.NoError(t, err)
		require.Len(t, updated.Metrics, 1)
		assert.Equal(t, app.MetricTypeCurrency, updated.Metrics[0].Type)
	})

	t.Run("new metric needs a valid type", func(t *testing.T) {
		for name, metricType := range map[string]string{
			"missing": "",
			"unknown": "not_a_metric_type",
		} {
			t.Run(name, func(t *testing.T) {
				pb := createPlaybook(t)
				pb.Metrics = append(pb.Metrics, client.PlaybookMetricConfig{Title: "new", Type: metricType})

				err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
				requireErrorWithStatusCode(t, err, http.StatusBadRequest)

				stored, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pb.ID)
				require.NoError(t, err)
				require.Len(t, stored.Metrics, 1)
			})
		}
	})

	t.Run("metric id from another playbook still needs a valid type", func(t *testing.T) {
		pb := createPlaybook(t)
		other := createPlaybook(t)

		pb.Metrics = append(pb.Metrics, client.PlaybookMetricConfig{
			ID:    other.Metrics[0].ID,
			Title: "foreign",
			Type:  "not_a_metric_type",
		})
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("unknown metric id still needs a valid type", func(t *testing.T) {
		pb := createPlaybook(t)

		pb.Metrics = append(pb.Metrics, client.PlaybookMetricConfig{
			ID:    model.NewId(),
			Title: "unknown id",
		})
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("import with metric id and invalid type is rejected", func(t *testing.T) {
		exported, err := e.PlaybooksAdminClient.Playbooks.Export(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		var payload map[string]any
		require.NoError(t, json.Unmarshal(exported, &payload))
		payload["metrics"] = []map[string]any{
			{"id": model.NewId(), "title": "imported", "type": "not_a_metric_type"},
		}
		body, err := json.Marshal(payload)
		require.NoError(t, err)

		_, err = e.PlaybooksAdminClient.Playbooks.Import(context.Background(), body, e.BasicTeam.Id)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})
}

// TestCorruptedPlaybookRowRemainsUsable seeds a playbook row with values the old GraphQL
// write path could persist and verifies the playbook and its runs are usable end to end.

func TestCorruptedPlaybookRowRemainsUsable(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	sqlSettings := e.Srv.Config().SqlSettings
	db, err := sql.Open(*sqlSettings.DriverName, *sqlSettings.DataSource)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "CorruptedRowPlaybook",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
		Checklists: []client.Checklist{
			{Title: "checklist", Items: []client.ChecklistItem{{Title: "item"}}},
		},
	})
	require.NoError(t, err)

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "run of corrupted playbook",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookID,
	})
	require.NoError(t, err)

	checklistsJSON := `[{"id":"cl1","title":"checklist","items":[` +
		`{"id":"i1","title":"fractional","due_date":1.5},` +
		`{"id":"i2","title":"overflow","due_date":1e20},` +
		`{"id":"i3","title":"valid","due_date":3600000}` +
		`]}]`
	_, err = db.Exec("UPDATE IR_Playbook SET ChannelMode = 'not_a_mode', ChecklistsJSON = $1 WHERE ID = $2", checklistsJSON, playbookID)
	require.NoError(t, err)

	t.Run("sysadmin and member can read the playbook over REST", func(t *testing.T) {
		for _, c := range []*client.Client{e.PlaybooksAdminClient, e.PlaybooksClient} {
			pb, err := c.Playbooks.Get(context.Background(), playbookID)
			require.NoError(t, err)
			assert.Equal(t, client.PlaybookRunCreateNewChannel, pb.ChannelMode)
			require.Len(t, pb.Checklists, 1)
			require.Len(t, pb.Checklists[0].Items, 3)
			assert.Equal(t, int64(0), pb.Checklists[0].Items[0].DueDate)
			assert.Equal(t, int64(0), pb.Checklists[0].Items[1].DueDate)
			assert.Equal(t, int64(3600000), pb.Checklists[0].Items[2].DueDate)
		}
	})

	t.Run("playbook can be read over GraphQL", func(t *testing.T) {
		var result struct {
			Data struct {
				Playbook struct {
					ID          string
					ChannelMode string
					Checklists  []struct {
						Items []struct {
							DueDate float64
						}
					}
				}
			}
			Errors []struct {
				Message string
			}
		}
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query: `query Playbook($id: String!) {
				playbook(id: $id) { id channelMode checklists { items { dueDate } } }
			}`,
			OperationName: "Playbook",
			Variables:     map[string]any{"id": playbookID},
		}, &result)
		require.NoError(t, err)
		require.Empty(t, result.Errors)
		assert.Equal(t, playbookID, result.Data.Playbook.ID)
		assert.Equal(t, "create_new_channel", result.Data.Playbook.ChannelMode)
		require.Len(t, result.Data.Playbook.Checklists, 1)
		require.Len(t, result.Data.Playbook.Checklists[0].Items, 3)
	})

	t.Run("playbook appears in the team listing", func(t *testing.T) {
		list, err := e.PlaybooksClient.Playbooks.List(context.Background(), e.BasicTeam.Id, 0, 100, client.PlaybookListOptions{})
		require.NoError(t, err)
		found := false
		for _, pb := range list.Items {
			if pb.ID == playbookID {
				found = true
			}
		}
		assert.True(t, found)
	})

	t.Run("valid GraphQL update succeeds", func(t *testing.T) {
		err := gqlDoPlaybookUpdate(e.PlaybooksClient, playbookID, map[string]any{"description": "recovered"})
		require.NoError(t, err)

		pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
		require.NoError(t, err)
		assert.Equal(t, "recovered", pb.Description)
	})

	t.Run("existing run remains usable and can be finished by sysadmin", func(t *testing.T) {
		fetched, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, playbookID, fetched.PlaybookID)

		require.NoError(t, e.PlaybooksAdminClient.PlaybookRuns.Finish(context.Background(), run.ID))

		fetched, err = e.PlaybooksAdminClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, string(client.StatusFinished), fetched.CurrentStatus)
	})

	t.Run("new run can be started from the playbook", func(t *testing.T) {
		newRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "new run of recovered playbook",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.Len(t, newRun.Checklists, 1)
		require.Len(t, newRun.Checklists[0].Items, 3)
	})

	t.Run("REST update persists normalized values", func(t *testing.T) {
		pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
		require.NoError(t, err)
		pb.Title = "CorruptedRowPlaybook saved"
		require.NoError(t, e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb))

		var storedMode string
		var storedChecklists []byte
		err = db.QueryRow("SELECT ChannelMode, ChecklistsJSON FROM IR_Playbook WHERE ID = $1", playbookID).Scan(&storedMode, &storedChecklists)
		require.NoError(t, err)
		assert.Equal(t, "create_new_channel", storedMode)

		var stored []app.Checklist
		require.NoError(t, json.Unmarshal(storedChecklists, &stored))
		require.Len(t, stored, 1)
		require.Len(t, stored[0].Items, 3)
		assert.Equal(t, int64(0), stored[0].Items[0].DueDate)
		assert.Equal(t, int64(0), stored[0].Items[1].DueDate)
		assert.Equal(t, int64(3600000), stored[0].Items[2].DueDate)
	})
}

