package main

import (
	"context"
	"fmt"
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
	require.NoError(t, err)
	_, _, err = e.ServerAdminClient.AddTeamMember(e.BasicTeam.Id, user3.Id)
	require.NoError(t, err)

	// if the test fits this testTable structure, add it here
	// otherwise, create another t.Run()
	testCases := []struct {
		Name                     string
		PlaybookCreateOptions    client.PlaybookCreateOptions
		PlaybookRunCreateOptions client.PlaybookRunCreateOptions
		ParticipantsToBeAdded    []string
		ExpectedRunParticipants  []string
		ExpectedRunFollowers     []string
		ExpectedChannelMembers   []string
		UnexpectedChannelMembers []string
	}{
		{
			Name: "Add 2 participants, actions ON, reporter = owner",
			PlaybookCreateOptions: client.PlaybookCreateOptions{
				Public:                              true,
				CreatePublicPlaybookRun:             true,
				CreateChannelMemberOnNewParticipant: true,
			},
			PlaybookRunCreateOptions: client.PlaybookRunCreateOptions{
				OwnerUserID: e.RegularUser.Id,
			},
			ParticipantsToBeAdded:    []string{e.RegularUser2.Id, user3.Id},
			ExpectedRunParticipants:  []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedRunFollowers:     []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedChannelMembers:   []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			UnexpectedChannelMembers: []string{},
		},
		{
			Name: "Add 1 participant, actions ON, reporter != owner",
			PlaybookCreateOptions: client.PlaybookCreateOptions{
				Public:                              true,
				CreatePublicPlaybookRun:             true,
				CreateChannelMemberOnNewParticipant: true,
			},
			PlaybookRunCreateOptions: client.PlaybookRunCreateOptions{
				OwnerUserID: e.RegularUser2.Id,
			},
			ParticipantsToBeAdded:    []string{user3.Id},
			ExpectedRunParticipants:  []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedRunFollowers:     []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedChannelMembers:   []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			UnexpectedChannelMembers: []string{},
		},
		{
			Name: "Add 2 participants, actions OFF, reporter = owner",
			PlaybookCreateOptions: client.PlaybookCreateOptions{
				Public:                              true,
				CreatePublicPlaybookRun:             true,
				CreateChannelMemberOnNewParticipant: false,
			},
			PlaybookRunCreateOptions: client.PlaybookRunCreateOptions{
				OwnerUserID: e.RegularUser.Id,
			},
			ParticipantsToBeAdded:    []string{e.RegularUser2.Id, user3.Id},
			ExpectedRunParticipants:  []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedRunFollowers:     []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedChannelMembers:   []string{e.RegularUser.Id},
			UnexpectedChannelMembers: []string{e.RegularUser2.Id, user3.Id},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			tc.PlaybookCreateOptions.Title = "Playbook title"
			tc.PlaybookCreateOptions.TeamID = e.BasicTeam.Id
			pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), tc.PlaybookCreateOptions)
			require.NoError(t, err)

			tc.PlaybookRunCreateOptions.Name = "Run title"
			tc.PlaybookRunCreateOptions.TeamID = e.BasicTeam.Id
			tc.PlaybookRunCreateOptions.PlaybookID = pbID
			run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), tc.PlaybookRunCreateOptions)
			require.NoError(t, err)

			_, err = addParticipants(e.PlaybooksClient, run.ID, tc.ParticipantsToBeAdded)
			require.NoError(t, err)

			// assert participants
			run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
			require.NoError(t, err)
			require.Len(t, run.ParticipantIDs, len(tc.ExpectedRunParticipants))
			for _, ep := range tc.ExpectedRunParticipants {
				found := false
				for _, p := range run.ParticipantIDs {
					if p == ep {
						found = true
						break
					}
				}
				assert.True(t, found, fmt.Sprintf("Participant %s not found", ep))
			}
			// assert followers
			meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), run.ID)
			require.NoError(t, err)
			require.Len(t, meta.Followers, len(tc.ExpectedRunFollowers))
			for _, ef := range tc.ExpectedRunFollowers {
				found := false
				for _, f := range meta.Followers {
					if f == ef {
						found = true
						break
					}
				}
				assert.True(t, found, fmt.Sprintf("Follower %s not found", ef))
			}
			//assert channel members
			for _, ecm := range tc.ExpectedChannelMembers {
				member, err := e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, ecm)
				require.Nil(t, err)
				assert.Equal(t, ecm, member.UserId)
			}
			// assert unexpected channel members
			for _, ucm := range tc.UnexpectedChannelMembers {
				_, err = e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, ucm)
				require.Error(t, err)
				assert.Contains(t, err.Error(), "No channel member found for that user ID and channel ID")
			}
		})

	}

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

	t.Run("remove two participants without removing from channel members", func(t *testing.T) {
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                                   "TestPlaybookNoMembersNoChannelRemove",
			TeamID:                                  e.BasicTeam.Id,
			Public:                                  true,
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: false,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		response, err := addParticipants(e.PlaybooksClient, run.ID, []string{e.RegularUser2.Id, user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		response, err = removeParticipants(e.PlaybooksClient, run.ID, []string{e.RegularUser2.Id, user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 1)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])

		meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, meta.Followers, 1)
		assert.Equal(t, e.RegularUser.Id, meta.Followers[0])

		member, err := e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, e.RegularUser2.Id)
		require.Nil(t, err)
		assert.NotNil(t, member)

		member, err = e.A.GetChannelMember(request.EmptyContext(nil), run.ChannelID, user3.Id)
		require.Nil(t, err)
		assert.NotNil(t, member)
	})

	t.Run("add participant to a public run with private channel", func(t *testing.T) {
		// This flow test a user with run access (regularUser) that adds another user (regularUser2)
		// to a public run with a private channel
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                               "TestPrivatePlaybookNoMembers",
			TeamID:                              e.BasicTeam.Id,
			Public:                              true,
			CreatePublicPlaybookRun:             false,
			CreateChannelMemberOnNewParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

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
			Title:                               "TestPrivatePlaybookNoMembers",
			TeamID:                              e.BasicTeam.Id,
			Public:                              true,
			CreatePublicPlaybookRun:             false,
			CreateChannelMemberOnNewParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

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
		require.Nil(t, err)
		assert.Equal(t, e.RegularUser2.Id, member.UserId)
	})

	t.Run("not participant tries to add other participant", func(t *testing.T) {

		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                               "TestPrivatePlaybookNoMembers",
			TeamID:                              e.BasicTeam.Id,
			Public:                              true,
			CreatePublicPlaybookRun:             true,
			CreateChannelMemberOnNewParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		// Should not be able to add participants, because is not a participant
		response, err := addParticipants(e.PlaybooksClient2, run.ID, []string{user3.Id})
		require.NotEmpty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 1)

		// Should be able to join the run
		response, err = addParticipants(e.PlaybooksClient2, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)

		// After joining the run user should be able to add other participants
		response, err = addParticipants(e.PlaybooksClient2, run.ID, []string{user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 3)
	})

	t.Run("leave run", func(t *testing.T) {
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                                   "TestPrivatePlaybookNoMembers",
			TeamID:                                  e.BasicTeam.Id,
			Public:                                  true,
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		// join the run
		response, err := addParticipants(e.PlaybooksClient2, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)

		// leave run
		response, err = removeParticipants(e.PlaybooksClient2, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 1)
	})

	t.Run("not participant tries to remove participant", func(t *testing.T) {

		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:                   "TestPrivatePlaybookNoMembers",
			TeamID:                  e.BasicTeam.Id,
			Public:                  true,
			CreatePublicPlaybookRun: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		// add participant
		response, err := addParticipants(e.PlaybooksClient, run.ID, []string{user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)

		// try to remove the participant
		response, err = removeParticipants(e.PlaybooksClient2, run.ID, []string{user3.Id})
		require.NotEmpty(t, response.Errors)
		require.NoError(t, err)

		// join the run
		response, err = addParticipants(e.PlaybooksClient2, run.ID, []string{e.RegularUser2.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 3)

		// now should be able to remove participant
		response, err = removeParticipants(e.PlaybooksClient2, run.ID, []string{user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), run.ID)
		require.NoError(t, err)
		require.Len(t, run.ParticipantIDs, 2)
		assert.Equal(t, e.RegularUser.Id, run.ParticipantIDs[0])
		assert.Equal(t, e.RegularUser2.Id, run.ParticipantIDs[1])
	})
}

func TestGraphQLChangeRunOwner(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// create a third user to test change owner
	user3, _, err := e.ServerAdminClient.CreateUser(&model.User{
		Email:    "thirduser@example.com",
		Username: "thirduser",
		Password: "Password123!",
	})
	require.NoError(t, err)
	_, _, err = e.ServerAdminClient.AddTeamMember(e.BasicTeam.Id, user3.Id)
	require.NoError(t, err)

	t.Run("set another participant as owner", func(t *testing.T) {
		// add another participant
		response, err := addParticipants(e.PlaybooksClient, e.BasicRun.ID, []string{user3.Id})
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		response, err = changeRunOwner(e.PlaybooksClient, e.BasicRun.ID, user3.Id)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.TODO(), e.BasicRun.ID)
		require.NoError(t, err)
		require.Equal(t, user3.Id, run.OwnerUserID)
	})

	t.Run("not participant tries to change an owner", func(t *testing.T) {
		response, err := changeRunOwner(e.PlaybooksClient2, e.BasicRun.ID, e.RegularUser.Id)
		require.NotEmpty(t, response.Errors)
		require.NoError(t, err)
	})

	t.Run("set not participant as owner", func(t *testing.T) {
		response, err := changeRunOwner(e.PlaybooksClient, e.BasicRun.ID, e.RegularUser2.Id)
		require.Empty(t, response.Errors)
		require.NoError(t, err)
	})

}

func TestUpdateRunActions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("update run actions", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		// data previous to update
		prevRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.False(t, prevRun.StatusUpdateBroadcastChannelsEnabled)
		assert.False(t, prevRun.StatusUpdateBroadcastWebhooksEnabled)
		assert.Empty(t, prevRun.WebhookOnStatusUpdateURLs)
		assert.Empty(t, prevRun.BroadcastChannelIDs)
		assert.True(t, prevRun.CreateChannelMemberOnNewParticipant)
		assert.True(t, prevRun.RemoveChannelMemberOnRemovedParticipant)

		//update
		updates := map[string]interface{}{
			"statusUpdateBroadcastChannelsEnabled":    true,
			"statusUpdateBroadcastWebhooksEnabled":    true,
			"broadcastChannelIDs":                     []string{e.BasicPublicChannel.Id},
			"webhookOnStatusUpdateURLs":               []string{"https://url1", "https://url2"},
			"createChannelMemberOnNewParticipant":     false,
			"removeChannelMemberOnRemovedParticipant": false,
		}
		response, err := updateRun(e.PlaybooksClient, run.ID, updates)
		require.Empty(t, response.Errors)
		require.NoError(t, err)

		// Make sure the action settings are updated
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.True(t, editedRun.StatusUpdateBroadcastChannelsEnabled)
		require.True(t, editedRun.StatusUpdateBroadcastWebhooksEnabled)
		require.Equal(t, updates["broadcastChannelIDs"], editedRun.BroadcastChannelIDs)
		require.Equal(t, updates["webhookOnStatusUpdateURLs"], editedRun.WebhookOnStatusUpdateURLs)
		require.False(t, editedRun.CreateChannelMemberOnNewParticipant)
		require.False(t, editedRun.RemoveChannelMemberOnRemovedParticipant)
	})

	t.Run("update fails due to lack of permissions", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		//update
		updates := map[string]interface{}{
			"statusUpdateBroadcastChannelsEnabled":    true,
			"statusUpdateBroadcastWebhooksEnabled":    true,
			"broadcastChannelIDs":                     []string{e.BasicPublicChannel.Id},
			"webhookOnStatusUpdateURLs":               []string{"https://url1", "https://url2"},
			"createChannelMemberOnNewParticipant":     false,
			"removeChannelMemberOnRemovedParticipant": false,
		}
		response, err := updateRun(e.PlaybooksClient2, run.ID, updates)
		require.NotEmpty(t, response.Errors)
		require.NoError(t, err)

		// Make sure the action settings are not updated
		editedRun, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.False(t, editedRun.StatusUpdateBroadcastChannelsEnabled)
		require.False(t, editedRun.StatusUpdateBroadcastWebhooksEnabled)
		assert.Empty(t, editedRun.WebhookOnStatusUpdateURLs)
		assert.Empty(t, editedRun.BroadcastChannelIDs)
		require.True(t, editedRun.CreateChannelMemberOnNewParticipant)
		require.True(t, editedRun.RemoveChannelMemberOnRemovedParticipant)
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

// ChangeRunOwner changes run owner
func changeRunOwner(c *client.Client, playbookRunID string, newOwnerID string) (graphql.Response, error) {
	mutation := `
	mutation ChangeRunOwner($runID: String!, $ownerID: String!) {
		changeRunOwner(runID: $runID, ownerID: $ownerID)
	}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "ChangeRunOwner",
		Variables: map[string]interface{}{
			"runID":   playbookRunID,
			"ownerID": newOwnerID,
		},
	}, &response)

	return response, err
}

// UpdateRun updates the run
func updateRun(c *client.Client, playbookRunID string, updates map[string]interface{}) (graphql.Response, error) {
	mutation := `
		mutation UpdateRun($id: String!, $updates: RunUpdates!) {
			updateRun(id: $id, updates: $updates)
		}
	`
	var response graphql.Response
	err := c.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         mutation,
		OperationName: "UpdateRun",
		Variables: map[string]interface{}{
			"id":      playbookRunID,
			"updates": updates,
		},
	}, &response)

	return response, err
}
