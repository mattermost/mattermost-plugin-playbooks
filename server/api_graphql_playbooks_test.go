// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/graph-gophers/graphql-go"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGraphQLPlaybooks(t *testing.T) {
	// The "list" subtest lists playbooks across the whole server, so this test
	// requires a globally-empty database.
	e := SetupIsolated(t)
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
			Variables:     map[string]any{"id": e.BasicPlaybook.ID},
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

		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{"title": newUpdatedTitle})
		require.NoError(t, err)

		updatedPlaybook, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), e.BasicPlaybook.ID)
		require.NoError(t, err)

		require.Equal(t, newUpdatedTitle, updatedPlaybook.Title)
	})

	t.Run("update playbook no permissions to broadcast", func(t *testing.T) {
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{"broadcastChannelIDs": []string{e.BasicPrivateChannel.Id}})
		require.Error(t, err)
	})

	t.Run("update playbook without modifying broadcast channel ids without permission. should succeed because no modification.", func(t *testing.T) {
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{"description": "unrelatedupdate"})
		require.NoError(t, err)
	})

	t.Run("update playbook with too many webhoooks", func(t *testing.T) {
		urls := []string{}
		for i := range 65 {
			urls = append(urls, "http://localhost/"+strconv.Itoa(i))
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"webhookOnCreationEnabled": true,
			"webhookOnCreationURLs":    urls,
		})
		require.Error(t, err)
	})

	t.Run("change default owner", func(t *testing.T) {
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"defaultOwnerID": e.RegularUser.Id,
		})
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"defaultOwnerID": e.RegularUserNotInTeam.Id,
		})
		require.Error(t, err)
	})
	t.Run("checklist with preset values that need to be cleared", func(t *testing.T) {
		items := []map[string]any{
			{
				"title":                   "title1",
				"description":             "description1",
				"assigneeID":              "",
				"assigneeModified":        101,
				"state":                   "Closed",
				"stateModified":           102,
				"command":                 "",
				"commandLastRun":          103,
				"lastSkipped":             104,
				"dueDate":                 100,
				"conditionID":             "",
				"assigneeType":            "",
				"assigneePropertyFieldID": "",
			},
		}

		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"checklists": map[string]any{
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
		items := []map[string]any{
			{
				"title":                   "title1",
				"description":             "description1",
				"assigneeID":              e.RegularUser.Id,
				"assigneeModified":        0,
				"state":                   "",
				"stateModified":           0,
				"command":                 "",
				"commandLastRun":          0,
				"lastSkipped":             0,
				"dueDate":                 0,
				"conditionID":             "",
				"assigneeType":            "",
				"assigneePropertyFieldID": "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"checklists": map[string]any{
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

		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"checklists": []api.UpdateChecklist{
				{
					Title: strings.Repeat("A", (256*1024)+1),
					Items: []api.UpdateChecklistItem{},
				},
			},
		})
		require.Error(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{"title": strings.Repeat("A", 1025)})
		require.Error(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{"description": strings.Repeat("A", 4097)})
		require.Error(t, err)
	})

	t.Run("update playbook with pre-assigned task fails due to disabled invitations", func(t *testing.T) {
		items := []map[string]any{
			{
				"title":                   "title1",
				"description":             "description1",
				"assigneeID":              e.RegularUser.Id,
				"assigneeModified":        0,
				"state":                   "",
				"stateModified":           0,
				"command":                 "",
				"commandLastRun":          0,
				"lastSkipped":             0,
				"dueDate":                 0,
				"conditionID":             "",
				"assigneeType":            "",
				"assigneePropertyFieldID": "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"checklists": map[string]any{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs": []string{e.RegularUser.Id},
		})
		require.Error(t, err)
	})

	t.Run("update playbook with pre-assigned task fails due to missing assignee in existing invite user list", func(t *testing.T) {
		items := []map[string]any{
			{
				"title":                   "title1",
				"description":             "description1",
				"assigneeID":              e.RegularUser.Id,
				"assigneeModified":        0,
				"state":                   "",
				"stateModified":           0,
				"command":                 "",
				"commandLastRun":          0,
				"lastSkipped":             0,
				"dueDate":                 0,
				"conditionID":             "",
				"assigneeType":            "",
				"assigneePropertyFieldID": "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"checklists": map[string]any{
				"title": "A",
				"items": items,
			},
			"inviteUsersEnabled": true,
		})
		require.Error(t, err)
	})

	t.Run("update playbook with pre-assigned task fails due to assignee missing in new invite user list", func(t *testing.T) {
		items := []map[string]any{
			{
				"title":                   "title1",
				"description":             "description1",
				"assigneeID":              e.RegularUser.Id,
				"assigneeModified":        0,
				"state":                   "",
				"stateModified":           0,
				"command":                 "",
				"commandLastRun":          0,
				"lastSkipped":             0,
				"dueDate":                 0,
				"conditionID":             "",
				"assigneeType":            "",
				"assigneePropertyFieldID": "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"checklists": map[string]any{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser2.Id},
			"inviteUsersEnabled": true,
		})
		require.Error(t, err)
	})

	t.Run("update playbook with invite user list fails due to missing a pre-assignee", func(t *testing.T) {
		items := []map[string]any{
			{
				"title":                   "title1",
				"description":             "description1",
				"assigneeID":              e.RegularUser.Id,
				"assigneeModified":        0,
				"state":                   "",
				"stateModified":           0,
				"command":                 "",
				"commandLastRun":          0,
				"lastSkipped":             0,
				"dueDate":                 0,
				"conditionID":             "",
				"assigneeType":            "",
				"assigneePropertyFieldID": "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"checklists": map[string]any{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser.Id},
			"inviteUsersEnabled": true,
		})
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"invitedUserIDs": []string{e.RegularUser2.Id},
		})
		require.Error(t, err)
	})

	t.Run("update playbook fails if invitations are getting disabled but there are pre-assigned users", func(t *testing.T) {
		items := []map[string]any{
			{
				"title":                   "title1",
				"description":             "description1",
				"assigneeID":              e.RegularUser.Id,
				"assigneeModified":        0,
				"state":                   "",
				"stateModified":           0,
				"command":                 "",
				"commandLastRun":          0,
				"lastSkipped":             0,
				"dueDate":                 0,
				"conditionID":             "",
				"assigneeType":            "",
				"assigneePropertyFieldID": "",
			},
		}
		err := gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
			"checklists": map[string]any{
				"title": "A",
				"items": items,
			},
			"invitedUserIDs":     []string{e.RegularUser.Id},
			"inviteUsersEnabled": true,
		})
		require.NoError(t, err)

		err = gqlTestPlaybookUpdate(e, t, e.BasicPlaybook.ID, map[string]any{
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
		Variables: map[string]any{
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
		Variables: map[string]any{
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

func gqlTestPlaybookUpdate(e *TestEnvironment, t *testing.T, playbookID string, updates map[string]any) error {
	testPlaybookMutateQuery := `mutation UpdatePlaybook($id: String!, $updates: PlaybookUpdates!) {
		updatePlaybook(id: $id, updates: $updates)
	}`
	var response graphql.Response
	err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         testPlaybookMutateQuery,
		OperationName: "UpdatePlaybook",
		Variables:     map[string]any{"id": playbookID, "updates": updates},
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
			Variables:     map[string]any{"id": e.BasicPlaybook.ID},
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
			Variables: map[string]any{
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
			Variables: map[string]any{
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
			Variables: map[string]any{
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

func gqlTestPlaybookUpdateGuest(e *TestEnvironment, t *testing.T, playbookID string, updates map[string]any) error {
	testPlaybookMutateQuery := `mutation UpdatePlaybook($id: String!, $updates: PlaybookUpdates!) {
		updatePlaybook(id: $id, updates: $updates)
	}`
	var response graphql.Response
	err := e.PlaybooksClientGuest.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         testPlaybookMutateQuery,
		OperationName: "UpdatePlaybook",
		Variables:     map[string]any{"id": playbookID, "updates": updates},
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
		err := gqlTestPlaybookUpdateGuest(e, t, e.BasicPlaybook.ID, map[string]any{"title": "mutated"})
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
			Variables:     map[string]any{"id": e.BasicPlaybook.ID},
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

// TestAdminOnlyEdit_GraphQL verifies that GraphQL playbook mutations honor AdminOnlyEdit.
func TestAdminOnlyEdit_GraphQL(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	e.SetEnterpriseLicence()

	updatePlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "AdminOnlyEdit GraphQL Test Playbook",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
		AdminOnlyEdit:                           true,
		CreateChannelMemberOnNewParticipant:     true,
		RemoveChannelMemberOnRemovedParticipant: true,
	})
	require.NoError(t, err)

	t.Run("non-admin member GraphQL update is rejected", func(t *testing.T) {
		err := gqlDoPlaybookUpdate(e.PlaybooksClient, updatePlaybookID, map[string]interface{}{"title": "Non-Admin GraphQL Edit"})
		require.Error(t, err)
	})

	t.Run("playbook admin (non-sysadmin) GraphQL update succeeds", func(t *testing.T) {
		err := gqlDoPlaybookUpdate(e.PlaybooksClient2, updatePlaybookID, map[string]interface{}{"title": "Admin GraphQL Edit"})
		require.NoError(t, err)
	})

	t.Run("system admin GraphQL update succeeds", func(t *testing.T) {
		err := gqlDoPlaybookUpdate(e.PlaybooksAdminClient, updatePlaybookID, map[string]interface{}{"title": "SysAdmin GraphQL Edit"})
		require.NoError(t, err)
	})

	propFieldsPlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "AdminOnlyEdit GQL PropertyFields Test",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
		AdminOnlyEdit: true,
	})
	require.NoError(t, err)

	const addMutation = `mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
		addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
	}`
	const updateMutation = `mutation UpdatePlaybookPropertyField($playbookID: String!, $propertyFieldID: String!, $propertyField: PropertyFieldInput!) {
		updatePlaybookPropertyField(playbookID: $playbookID, propertyFieldID: $propertyFieldID, propertyField: $propertyField)
	}`
	const deleteMutation = `mutation DeletePlaybookPropertyField($playbookID: String!, $propertyFieldID: String!) {
		deletePlaybookPropertyField(playbookID: $playbookID, propertyFieldID: $propertyFieldID)
	}`

	baseField := map[string]interface{}{
		"name": "TestField",
		"type": "text",
		"attrs": map[string]interface{}{
			"visibility": "always",
			"sortOrder":  1.0,
		},
	}
	updateField := map[string]interface{}{
		"name": "UpdatedField",
		"type": "text",
		"attrs": map[string]interface{}{
			"visibility": "always",
			"sortOrder":  2.0,
		},
	}

	doAdd := func(c *client.Client) error {
		var resp graphql.Response
		if err := c.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         addMutation,
			OperationName: "AddPlaybookPropertyField",
			Variables:     map[string]interface{}{"playbookID": propFieldsPlaybookID, "propertyField": baseField},
		}, &resp); err != nil {
			return err
		}
		if len(resp.Errors) > 0 {
			return resp.Errors[0]
		}
		return nil
	}

	t.Run("non-admin member AddPlaybookPropertyField is rejected", func(t *testing.T) {
		err := doAdd(e.PlaybooksClient)
		require.Error(t, err)
	})

	// Seed a field as the playbook admin so update/delete have a target.
	seededFieldID, err := e.PlaybooksClient2.Playbooks.CreatePropertyField(context.Background(), propFieldsPlaybookID, client.PropertyFieldRequest{
		Name: "Seeded",
		Type: "text",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: stringPtr("always"),
			SortOrder:  float64Ptr(1.0),
		},
	})
	require.NoError(t, err)

	doUpdate := func(c *client.Client) error {
		var resp graphql.Response
		if err := c.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         updateMutation,
			OperationName: "UpdatePlaybookPropertyField",
			Variables: map[string]interface{}{
				"playbookID":      propFieldsPlaybookID,
				"propertyFieldID": seededFieldID.ID,
				"propertyField":   updateField,
			},
		}, &resp); err != nil {
			return err
		}
		if len(resp.Errors) > 0 {
			return resp.Errors[0]
		}
		return nil
	}

	doDelete := func(c *client.Client) error {
		var resp graphql.Response
		if err := c.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         deleteMutation,
			OperationName: "DeletePlaybookPropertyField",
			Variables:     map[string]interface{}{"playbookID": propFieldsPlaybookID, "propertyFieldID": seededFieldID.ID},
		}, &resp); err != nil {
			return err
		}
		if len(resp.Errors) > 0 {
			return resp.Errors[0]
		}
		return nil
	}

	t.Run("non-admin member UpdatePlaybookPropertyField is rejected", func(t *testing.T) {
		require.Error(t, doUpdate(e.PlaybooksClient))
	})

	t.Run("non-admin member DeletePlaybookPropertyField is rejected", func(t *testing.T) {
		require.Error(t, doDelete(e.PlaybooksClient))
	})

	t.Run("playbook admin (non-sysadmin) AddPlaybookPropertyField succeeds", func(t *testing.T) {
		require.NoError(t, doAdd(e.PlaybooksClient2))
	})

	t.Run("playbook admin (non-sysadmin) UpdatePlaybookPropertyField succeeds", func(t *testing.T) {
		require.NoError(t, doUpdate(e.PlaybooksClient2))
	})

	t.Run("system admin UpdatePlaybookPropertyField succeeds", func(t *testing.T) {
		require.NoError(t, doUpdate(e.PlaybooksAdminClient))
	})

	t.Run("system admin DeletePlaybookPropertyField succeeds", func(t *testing.T) {
		require.NoError(t, doDelete(e.PlaybooksAdminClient))
	})
}
