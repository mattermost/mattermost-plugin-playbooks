package main

import (
	"context"
	"testing"

	"github.com/graph-gophers/graphql-go"
	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGraphQLRunList(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("list by participantOrFollower", func(t *testing.T) {
		var rResultTest struct {
			Data struct {
				Runs []struct {
					ID         string
					Name       string
					IsFavorite bool
				}
			}
			Errors []struct {
				Message string
				Path    string
			}
		}
		testRunsQuery := `
		query Runs($userID: String!) {
			runs(participantOrFollowerID: $userID) {
				id
				name
				isFavorite
			}
		}
		`
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testRunsQuery,
			OperationName: "Runs",
			Variables:     map[string]interface{}{"userID": "me"},
		}, &rResultTest)
		require.NoError(t, err)

		assert.Len(t, rResultTest.Data.Runs, 1)
		assert.Equal(t, e.BasicRun.ID, rResultTest.Data.Runs[0].ID)
		assert.Equal(t, e.BasicRun.Name, rResultTest.Data.Runs[0].Name)
		assert.False(t, rResultTest.Data.Runs[0].IsFavorite)
	})
}

func TestGraphQLChangeRunParticipants(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// create a third user to test multiple add/remove
	user3, _, err := e.ServerAdminClient.CreateUser(&model.User{
		Email:    "thirduser@example.com",
		Username: "thirduser",
		Password: "Password123!",
	})
	require.NoError(e.T, err)
	_, _, err = e.ServerAdminClient.AddTeamMember(e.BasicTeam.Id, user3.Id)
	require.NoError(e.T, err)

	t.Run("add two participants", func(t *testing.T) {
		response, err := addParticipants(e.PlaybooksClient, e.BasicRun.ID, []string{e.RegularUser2.Id, user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), e.BasicRun.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 3)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])
		assert.Equal(t, e.RegularUser2.Id, run.ParticipantIDs[1])
		assert.Equal(t, user3.Id, run.ParticipantIDs[2])

		meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), e.BasicRun.ID)
		require.NoError(t, err)
		require.Len(t, meta.Followers, 3)
		assert.Equal(t, e.RegularUser.Id, meta.Followers[0])
		assert.Equal(t, e.RegularUser2.Id, meta.Followers[1])
		assert.Equal(t, user3.Id, meta.Followers[2])

		member, err := e.A.GetChannelMember(request.EmptyContext(nil), e.BasicRun.ChannelID, e.RegularUser2.Id)
		require.Nil(t, err)
		assert.Equal(t, e.RegularUser2.Id, member.UserId)

		member, err = e.A.GetChannelMember(request.EmptyContext(nil), e.BasicRun.ChannelID, user3.Id)
		require.Nil(t, err)
		assert.Equal(t, user3.Id, member.UserId)

	})

	t.Run("remove two participants", func(t *testing.T) {
		response, err := removeParticipants(e.PlaybooksClient, e.BasicRun.ID, []string{e.RegularUser2.Id, user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), e.BasicRun.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 1)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])

		meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), e.BasicRun.ID)
		require.NoError(t, err)
		require.Len(t, meta.Followers, 1)
		assert.Equal(t, e.RegularUser.Id, meta.Followers[0])

		member, err := e.A.GetChannelMember(request.EmptyContext(nil), e.BasicRun.ChannelID, e.RegularUser2.Id)
		require.NotNil(t, err)
		assert.Nil(t, member)

		member, err = e.A.GetChannelMember(request.EmptyContext(nil), e.BasicRun.ChannelID, user3.Id)
		require.NotNil(t, err)
		assert.Nil(t, member)
	})

	t.Run("add participant to a public run with private channel", func(t *testing.T) {

		// This flow test a user with run access (regularUser) that adds another user (regularUser2)
		// to a public run with a private channel

		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                   "TestPrivatePlaybookNoMembers",
			TeamID:                  e.BasicTeam.Id,
			Public:                  true,
			CreatePublicPlaybookRun: false,
		})
		require.NoError(e.T, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(e.T, err)
		require.NotNil(e.T, run)

		response, err := addParticipants(e.PlaybooksClient, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])
		assert.Equal(t, e.RegularUser2.Id, run.ParticipantIDs[1])

		meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, meta.Followers, 2)
		assert.Equal(t, e.RegularUser.Id, meta.Followers[0])
		assert.Equal(t, e.RegularUser2.Id, meta.Followers[1])

		member, err := e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, e.RegularUser2.Id)
		require.Nil(t, err)
		assert.Equal(t, e.RegularUser2.Id, member.UserId)
	})

	t.Run("join a public run with private channel", func(t *testing.T) {

		// This flow test a user (regularUser2) that wants to participate a public run with a private channel

		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                   "TestPrivatePlaybookNoMembers",
			TeamID:                  e.BasicTeam.Id,
			Public:                  true,
			CreatePublicPlaybookRun: false,
		})
		require.NoError(e.T, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(e.T, err)
		require.NotNil(e.T, run)

		response, err := addParticipants(e.PlaybooksClient2, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])
		assert.Equal(t, e.RegularUser2.Id, run.ParticipantIDs[1])

		meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, meta.Followers, 2)
		assert.Equal(t, e.RegularUser.Id, meta.Followers[0])
		assert.Equal(t, e.RegularUser2.Id, meta.Followers[1])

		member, err := e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, e.RegularUser2.Id)
		require.Nil(t, member)
		require.NotNil(t, err)
	})
}

// AddParticipants adds participants to the run
func addParticipants(c *client.Client, playbookRunID string, userIDs []string) (graphql.Response, error) {
	mutation := `
	mutation AddRunParticipants($runID: String!, $userIDs: [String!]!) {
		addRunParticipants(runID: $runID, userIDs: $userIDs)
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "AddRunParticipants",
		Variables: map[string]interface{}{
			"runID":   playbookRunID,
			"userIDs": userIDs,
		},
	}, &response)

	return response, err
}

// RemoveParticipants removes participants from the run
func removeParticipants(c *client.Client, playbookRunID string, userIDs []string) (graphql.Response, error) {
	mutation := `
	mutation RemoveRunParticipants($runID: String!, $userIDs: [String!]!) {
		removeRunParticipants(runID: $runID, userIDs: $userIDs)
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "RemoveRunParticipants",
		Variables: map[string]interface{}{
			"runID":   playbookRunID,
			"userIDs": userIDs,
		},
	}, &response)

	return response, err
}
