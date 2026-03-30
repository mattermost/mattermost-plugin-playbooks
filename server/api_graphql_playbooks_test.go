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

// updatePlaybookViaGraphQL executes the updatePlaybook GraphQL mutation and
// returns the playbook state as read back through the REST GET endpoint so the
// two paths can be compared on equal footing.
func updatePlaybookViaGraphQL(t *testing.T, e *TestEnvironment, playbookID string, updates map[string]any) *client.Playbook {
	t.Helper()

	const mutation = `
	mutation UpdatePlaybook($id: String!, $updates: PlaybookUpdates!) {
		updatePlaybook(id: $id, updates: $updates)
	}`

	var resp struct {
		Data   json.RawMessage
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	err := e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "UpdatePlaybook",
		Variables: map[string]any{
			"id":      playbookID,
			"updates": updates,
		},
	}, &resp)
	require.NoError(t, err)
	require.Empty(t, resp.Errors, "GraphQL mutation returned errors: %v", resp.Errors)

	pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
	require.NoError(t, err)
	return pb
}

// freshPlaybook creates a new public playbook owned by the admin user and
// returns it. Each parity test starts with its own playbook so tests are
// independent.
func freshPlaybook(t *testing.T, e *TestEnvironment) *client.Playbook {
	t.Helper()

	id, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Parity Test Playbook " + t.Name(),
		TeamID: e.BasicTeam.Id,
		Public: true,
		Members: []client.PlaybookMember{
			{UserID: e.AdminUser.Id, Roles: []string{"playbook_admin", "playbook_member"}},
		},
		CreateChannelMemberOnNewParticipant:     true,
		RemoveChannelMemberOnRemovedParticipant: true,
	})
	require.NoError(t, err)

	pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), id)
	require.NoError(t, err)
	return pb
}

// TestPlaybookUpdateParity verifies that the GraphQL mutation and the REST PUT
// endpoint accept the same field values and persist them identically.
func TestPlaybookUpdateParity(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("OwnerGroupOnlyActions persists through REST and GraphQL identically", func(t *testing.T) {
		pbREST := freshPlaybook(t, e)
		pbGraphQL := freshPlaybook(t, e)

		// Enable via REST
		pbREST.OwnerGroupOnlyActions = true
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pbREST)
		require.NoError(t, err)
		pbREST, err = e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pbREST.ID)
		require.NoError(t, err)

		// Enable via GraphQL
		pbGraphQL = updatePlaybookViaGraphQL(t, e, pbGraphQL.ID, map[string]any{"ownerGroupOnlyActions": true})

		assert.Equal(t, pbREST.OwnerGroupOnlyActions, pbGraphQL.OwnerGroupOnlyActions,
			"OwnerGroupOnlyActions should be identical after REST and GraphQL updates")
		assert.True(t, pbREST.OwnerGroupOnlyActions)

		// Disable via REST
		pbREST.OwnerGroupOnlyActions = false
		err = e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pbREST)
		require.NoError(t, err)
		pbREST, err = e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pbREST.ID)
		require.NoError(t, err)

		// Disable via GraphQL
		pbGraphQL = updatePlaybookViaGraphQL(t, e, pbGraphQL.ID, map[string]any{"ownerGroupOnlyActions": false})

		assert.Equal(t, pbREST.OwnerGroupOnlyActions, pbGraphQL.OwnerGroupOnlyActions)
		assert.False(t, pbREST.OwnerGroupOnlyActions)
	})

	t.Run("AdminOnlyEdit persists through REST and GraphQL identically", func(t *testing.T) {
		pbREST := freshPlaybook(t, e)
		pbGraphQL := freshPlaybook(t, e)

		pbREST.AdminOnlyEdit = true
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pbREST)
		require.NoError(t, err)
		pbREST, err = e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pbREST.ID)
		require.NoError(t, err)

		pbGraphQL = updatePlaybookViaGraphQL(t, e, pbGraphQL.ID, map[string]any{"adminOnlyEdit": true})

		assert.Equal(t, pbREST.AdminOnlyEdit, pbGraphQL.AdminOnlyEdit,
			"AdminOnlyEdit should be identical after REST and GraphQL updates")
		assert.True(t, pbREST.AdminOnlyEdit)
	})

	t.Run("NewChannelOnly persists through REST and GraphQL identically", func(t *testing.T) {
		pbREST := freshPlaybook(t, e)
		pbGraphQL := freshPlaybook(t, e)

		pbREST.NewChannelOnly = true
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pbREST)
		require.NoError(t, err)
		pbREST, err = e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pbREST.ID)
		require.NoError(t, err)

		pbGraphQL = updatePlaybookViaGraphQL(t, e, pbGraphQL.ID, map[string]any{"newChannelOnly": true})

		assert.Equal(t, pbREST.NewChannelOnly, pbGraphQL.NewChannelOnly)
		assert.True(t, pbREST.NewChannelOnly)
	})

	t.Run("AutoArchiveChannel persists through REST and GraphQL identically", func(t *testing.T) {
		pbREST := freshPlaybook(t, e)
		pbGraphQL := freshPlaybook(t, e)

		pbREST.AutoArchiveChannel = true
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pbREST)
		require.NoError(t, err)
		pbREST, err = e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pbREST.ID)
		require.NoError(t, err)

		pbGraphQL = updatePlaybookViaGraphQL(t, e, pbGraphQL.ID, map[string]any{"autoArchiveChannel": true})

		assert.Equal(t, pbREST.AutoArchiveChannel, pbGraphQL.AutoArchiveChannel)
		assert.True(t, pbREST.AutoArchiveChannel)
	})

	t.Run("RunNumberPrefix persists through REST and GraphQL identically", func(t *testing.T) {
		pbREST := freshPlaybook(t, e)
		pbGraphQL := freshPlaybook(t, e)

		// Use distinct prefixes: unique constraint prevents two live playbooks on the
		// same team from sharing the same prefix.
		pbREST.RunNumberPrefix = "INCR"
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pbREST)
		require.NoError(t, err)
		pbREST, err = e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pbREST.ID)
		require.NoError(t, err)

		pbGraphQL = updatePlaybookViaGraphQL(t, e, pbGraphQL.ID, map[string]any{"runNumberPrefix": "INCG"})

		assert.Equal(t, "INCR", pbREST.RunNumberPrefix)
		assert.Equal(t, "INCG", pbGraphQL.RunNumberPrefix)
	})

	t.Run("ChannelNameTemplate persists through REST and GraphQL identically", func(t *testing.T) {
		pbREST := freshPlaybook(t, e)
		pbGraphQL := freshPlaybook(t, e)

		pbREST.ChannelNameTemplate = "Incident {OWNER}"
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pbREST)
		require.NoError(t, err)
		pbREST, err = e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pbREST.ID)
		require.NoError(t, err)

		pbGraphQL = updatePlaybookViaGraphQL(t, e, pbGraphQL.ID, map[string]any{"channelNameTemplate": "Incident {OWNER}"})

		assert.Equal(t, pbREST.ChannelNameTemplate, pbGraphQL.ChannelNameTemplate)
		assert.Equal(t, "Incident {OWNER}", pbREST.ChannelNameTemplate)
	})

	t.Run("GraphQL updatePlaybook rejects AdminOnlyEdit toggle by non-admin", func(t *testing.T) {
		pb := freshPlaybook(t, e)

		const mutation = `
		mutation UpdatePlaybook($id: String!, $updates: PlaybookUpdates!) {
			updatePlaybook(id: $id, updates: $updates)
		}`

		var resp struct {
			Data   json.RawMessage
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		// Regular user (non-admin) attempts to enable AdminOnlyEdit
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         mutation,
			OperationName: "UpdatePlaybook",
			Variables: map[string]any{
				"id":      pb.ID,
				"updates": map[string]any{"adminOnlyEdit": true},
			},
		}, &resp)
		require.NoError(t, err)
		require.NotEmpty(t, resp.Errors,
			"GraphQL should reject AdminOnlyEdit toggle by a non-admin user")
	})

	t.Run("REST rejects AdminOnlyEdit toggle by non-admin with 403", func(t *testing.T) {
		pb := freshPlaybook(t, e)

		pb.AdminOnlyEdit = true
		err := e.PlaybooksClient.Playbooks.Update(context.Background(), *pb)
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, 403)
	})

	t.Run("GraphQL rejects NewChannelOnly=true when ChannelMode is link_existing_channel", func(t *testing.T) {
		pb := freshPlaybook(t, e)

		// First set the channel mode to link_existing_channel via REST
		pb.ChannelMode = client.PlaybookRunLinkExistingChannel
		pb.ChannelID = e.BasicPublicChannel.Id
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
		require.NoError(t, err)

		const mutation = `
		mutation UpdatePlaybook($id: String!, $updates: PlaybookUpdates!) {
			updatePlaybook(id: $id, updates: $updates)
		}`

		var resp struct {
			Data   json.RawMessage
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		err = e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         mutation,
			OperationName: "UpdatePlaybook",
			Variables: map[string]any{
				"id":      pb.ID,
				"updates": map[string]any{"newChannelOnly": true},
			},
		}, &resp)
		require.NoError(t, err)
		require.NotEmpty(t, resp.Errors,
			"GraphQL should reject NewChannelOnly=true when ChannelMode is link_existing_channel")
	})

	t.Run("REST rejects NewChannelOnly=true when ChannelMode is link_existing_channel", func(t *testing.T) {
		pb := freshPlaybook(t, e)

		pb.ChannelMode = client.PlaybookRunLinkExistingChannel
		pb.ChannelID = e.BasicPublicChannel.Id
		pb.NewChannelOnly = true
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, 400)
	})

	t.Run("GraphQL rejects RunNumberPrefix with invalid characters", func(t *testing.T) {
		pb := freshPlaybook(t, e)

		const mutation = `
		mutation UpdatePlaybook($id: String!, $updates: PlaybookUpdates!) {
			updatePlaybook(id: $id, updates: $updates)
		}`

		var resp struct {
			Data   json.RawMessage
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		err := e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         mutation,
			OperationName: "UpdatePlaybook",
			Variables: map[string]any{
				"id":      pb.ID,
				"updates": map[string]any{"runNumberPrefix": "INVALID PREFIX!"},
			},
		}, &resp)
		require.NoError(t, err)
		require.NotEmpty(t, resp.Errors,
			"GraphQL should reject runNumberPrefix with invalid characters")
	})

	t.Run("REST rejects RunNumberPrefix with invalid characters with 400", func(t *testing.T) {
		pb := freshPlaybook(t, e)

		pb.RunNumberPrefix = "INVALID PREFIX!"
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, 400)
	})

	t.Run("GraphQL allows RunNumberPrefix change after runs exist", func(t *testing.T) {
		pb := freshPlaybook(t, e)

		// Set an initial prefix while no runs exist.
		pb = updatePlaybookViaGraphQL(t, e, pb.ID, map[string]any{"runNumberPrefix": "PRE"})
		require.Equal(t, "PRE", pb.RunNumberPrefix)

		// Create a run.
		_, err := e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Prefix change test run",
			OwnerUserID: e.AdminUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pb.ID,
		})
		require.NoError(t, err)

		// Change the prefix via GraphQL — must succeed (prefix is mutable).
		pb = updatePlaybookViaGraphQL(t, e, pb.ID, map[string]any{"runNumberPrefix": "CHANGED"})
		require.Equal(t, "CHANGED", pb.RunNumberPrefix)
	})
}

// TestPlaybookReadParity verifies that all new fields added in this branch are
// returned correctly via both the REST GET endpoint and the GraphQL query.
func TestPlaybookReadParity(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("fields saved via REST are readable via GraphQL query", func(t *testing.T) {
		pb := freshPlaybook(t, e)

		// Set all new fields via REST
		pb.OwnerGroupOnlyActions = true
		pb.AutoArchiveChannel = true
		pb.NewChannelOnly = true
		pb.RunNumberPrefix = "REQ"
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
		require.NoError(t, err)

		// Read back via GraphQL query
		const query = `
		query GetPlaybook($id: String!) {
			playbook(id: $id) {
				ownerGroupOnlyActions
				autoArchiveChannel
				newChannelOnly
				runNumberPrefix
			}
		}`

		var resp struct {
			Data struct {
				Playbook struct {
					OwnerGroupOnlyActions bool   `json:"ownerGroupOnlyActions"`
					AutoArchiveChannel    bool   `json:"autoArchiveChannel"`
					NewChannelOnly        bool   `json:"newChannelOnly"`
					RunNumberPrefix       string `json:"runNumberPrefix"`
				} `json:"playbook"`
			} `json:"data"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		err = e.PlaybooksAdminClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         query,
			OperationName: "GetPlaybook",
			Variables:     map[string]any{"id": pb.ID},
		}, &resp)
		require.NoError(t, err)
		require.Empty(t, resp.Errors)

		gql := resp.Data.Playbook
		assert.True(t, gql.OwnerGroupOnlyActions, "OwnerGroupOnlyActions saved via REST must be readable via GraphQL")
		assert.True(t, gql.AutoArchiveChannel, "AutoArchiveChannel saved via REST must be readable via GraphQL")
		assert.True(t, gql.NewChannelOnly, "NewChannelOnly saved via REST must be readable via GraphQL")
		assert.Equal(t, "REQ", gql.RunNumberPrefix, "RunNumberPrefix saved via REST must be readable via GraphQL")
	})

	t.Run("fields saved via GraphQL mutation are readable via REST GET", func(t *testing.T) {
		pb := freshPlaybook(t, e)

		updatePlaybookViaGraphQL(t, e, pb.ID, map[string]any{
			"ownerGroupOnlyActions": true,
			"autoArchiveChannel":    true,
			"runNumberPrefix":       "GQL",
		})

		// Read back via REST GET
		pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pb.ID)
		require.NoError(t, err)

		assert.True(t, pb.OwnerGroupOnlyActions, "OwnerGroupOnlyActions saved via GraphQL must be readable via REST")
		assert.True(t, pb.AutoArchiveChannel, "AutoArchiveChannel saved via GraphQL must be readable via REST")
		assert.Equal(t, "GQL", pb.RunNumberPrefix, "RunNumberPrefix saved via GraphQL must be readable via REST")
	})
}
