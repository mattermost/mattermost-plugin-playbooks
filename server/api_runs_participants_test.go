// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestRunParticipantsREST(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
	defer func() {
		e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	}()
	e.Permissions.AddPermissionToRole(t, model.PermissionManagePublicChannelMembers.Id, model.TeamUserRoleId)
	e.Permissions.AddPermissionToRole(t, model.PermissionManagePrivateChannelMembers.Id, model.TeamUserRoleId)

	user3, _, err := e.ServerAdminClient.CreateUser(context.Background(), &model.User{
		Email:    e.email("restthirduser"),
		Username: e.username("restthirduser"),
		Password: testUserPassword,
	})
	require.NoError(t, err)
	_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicTeam.Id, user3.Id)
	require.NoError(t, err)

	userNotInTeam, _, err := e.ServerAdminClient.CreateUser(context.Background(), &model.User{
		Email:    e.email("restnotinteam"),
		Username: e.username("restnotinteam"),
		Password: testUserPassword,
	})
	require.NoError(t, err)

	createRun := func(t *testing.T, pbOpts client.PlaybookCreateOptions, ownerID string) *client.PlaybookRun {
		t.Helper()
		pbOpts.Title = "Participants playbook"
		pbOpts.TeamID = e.BasicTeam.Id
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), pbOpts)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Participants run",
			OwnerUserID: ownerID,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)
		return run
	}

	requireChannelMember := func(t *testing.T, channelID, userID string, expected bool) {
		t.Helper()
		member, appErr := e.A.GetChannelMember(request.EmptyContext(nil), channelID, userID)
		if expected {
			require.Nil(t, appErr)
			assert.Equal(t, userID, member.UserId)
			return
		}
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Error(), "No channel member found for that user ID and channel ID")
	}

	requireFollowers := func(t *testing.T, runID string, expected []string) {
		t.Helper()
		meta, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), runID)
		require.NoError(t, err)
		assert.ElementsMatch(t, expected, meta.Followers)
	}

	publicRunWithChannelActions := client.PlaybookCreateOptions{
		Public:                                  true,
		CreatePublicPlaybookRun:                 true,
		CreateChannelMemberOnNewParticipant:     true,
		RemoveChannelMemberOnRemovedParticipant: true,
	}

	testCases := []struct {
		Name                     string
		PlaybookCreateOptions    client.PlaybookCreateOptions
		OwnerID                  string
		ParticipantsToBeAdded    []string
		ExpectedRunParticipants  []string
		ExpectedChannelMembers   []string
		UnexpectedChannelMembers []string
	}{
		{
			Name:                    "add 2 participants, channel actions on, requester is owner",
			PlaybookCreateOptions:   publicRunWithChannelActions,
			OwnerID:                 e.RegularUser.Id,
			ParticipantsToBeAdded:   []string{e.RegularUser2.Id, user3.Id},
			ExpectedRunParticipants: []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedChannelMembers:  []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
		},
		{
			Name:                    "add 1 participant, channel actions on, requester is not owner",
			PlaybookCreateOptions:   publicRunWithChannelActions,
			OwnerID:                 e.RegularUser2.Id,
			ParticipantsToBeAdded:   []string{user3.Id},
			ExpectedRunParticipants: []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedChannelMembers:  []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
		},
		{
			Name: "add 2 participants, channel actions off",
			PlaybookCreateOptions: client.PlaybookCreateOptions{
				Public:                  true,
				CreatePublicPlaybookRun: true,
			},
			OwnerID:                  e.RegularUser.Id,
			ParticipantsToBeAdded:    []string{e.RegularUser2.Id, user3.Id},
			ExpectedRunParticipants:  []string{e.RegularUser.Id, e.RegularUser2.Id, user3.Id},
			ExpectedChannelMembers:   []string{e.RegularUser.Id},
			UnexpectedChannelMembers: []string{e.RegularUser2.Id, user3.Id},
		},
		{
			Name: "users outside the run's team are skipped",
			PlaybookCreateOptions: client.PlaybookCreateOptions{
				Public:                  true,
				CreatePublicPlaybookRun: true,
			},
			OwnerID:                  e.RegularUser.Id,
			ParticipantsToBeAdded:    []string{e.RegularUser2.Id, userNotInTeam.Id},
			ExpectedRunParticipants:  []string{e.RegularUser.Id, e.RegularUser2.Id},
			ExpectedChannelMembers:   []string{e.RegularUser.Id},
			UnexpectedChannelMembers: []string{e.RegularUser2.Id},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			run := createRun(t, tc.PlaybookCreateOptions, tc.OwnerID)

			updatedRun, err := e.PlaybooksClient.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
				UserIDs: tc.ParticipantsToBeAdded,
			})
			require.NoError(t, err)
			assert.ElementsMatch(t, tc.ExpectedRunParticipants, updatedRun.ParticipantIDs)

			requireFollowers(t, run.ID, tc.ExpectedRunParticipants)
			for _, userID := range tc.ExpectedChannelMembers {
				requireChannelMember(t, run.ChannelID, userID, true)
			}
			for _, userID := range tc.UnexpectedChannelMembers {
				requireChannelMember(t, run.ChannelID, userID, false)
			}
		})
	}

	t.Run("force add to channel ignores the run's channel setting", func(t *testing.T) {
		run := createRun(t, client.PlaybookCreateOptions{Public: true, CreatePublicPlaybookRun: true}, e.RegularUser.Id)

		_, err := e.PlaybooksClient.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs:           []string{e.RegularUser2.Id},
			ForceAddToChannel: true,
		})
		require.NoError(t, err)

		requireChannelMember(t, run.ChannelID, e.RegularUser2.Id, true)
	})

	t.Run("remove two participants and their channel membership", func(t *testing.T) {
		run := createRun(t, publicRunWithChannelActions, e.RegularUser.Id)
		_, err := e.PlaybooksClient.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{e.RegularUser2.Id, user3.Id},
		})
		require.NoError(t, err)

		updatedRun, err := e.PlaybooksClient.PlaybookRuns.RemoveParticipants(context.Background(), run.ID, []string{e.RegularUser2.Id, user3.Id})
		require.NoError(t, err)
		assert.Equal(t, []string{e.RegularUser.Id}, updatedRun.ParticipantIDs)

		requireFollowers(t, run.ID, []string{e.RegularUser.Id})
		requireChannelMember(t, run.ChannelID, e.RegularUser2.Id, false)
		requireChannelMember(t, run.ChannelID, user3.Id, false)
	})

	t.Run("remove participants but keep channel membership", func(t *testing.T) {
		run := createRun(t, client.PlaybookCreateOptions{
			Public:                              true,
			CreatePublicPlaybookRun:             true,
			CreateChannelMemberOnNewParticipant: true,
		}, e.RegularUser.Id)
		_, err := e.PlaybooksClient.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{e.RegularUser2.Id, user3.Id},
		})
		require.NoError(t, err)

		updatedRun, err := e.PlaybooksClient.PlaybookRuns.RemoveParticipants(context.Background(), run.ID, []string{e.RegularUser2.Id, user3.Id})
		require.NoError(t, err)
		assert.Equal(t, []string{e.RegularUser.Id}, updatedRun.ParticipantIDs)

		requireFollowers(t, run.ID, []string{e.RegularUser.Id})
		requireChannelMember(t, run.ChannelID, e.RegularUser2.Id, true)
		requireChannelMember(t, run.ChannelID, user3.Id, true)
	})

	t.Run("add participant to a public run with a private channel", func(t *testing.T) {
		run := createRun(t, client.PlaybookCreateOptions{
			Public:                              true,
			CreateChannelMemberOnNewParticipant: true,
		}, e.RegularUser.Id)

		updatedRun, err := e.PlaybooksClient.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{e.RegularUser2.Id},
		})
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{e.RegularUser.Id, e.RegularUser2.Id}, updatedRun.ParticipantIDs)

		requireFollowers(t, run.ID, []string{e.RegularUser.Id, e.RegularUser2.Id})
		requireChannelMember(t, run.ChannelID, e.RegularUser2.Id, true)
	})

	t.Run("join a public run with a private channel", func(t *testing.T) {
		run := createRun(t, client.PlaybookCreateOptions{
			Public:                              true,
			CreateChannelMemberOnNewParticipant: true,
		}, e.RegularUser.Id)

		updatedRun, err := e.PlaybooksClient2.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{e.RegularUser2.Id},
		})
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{e.RegularUser.Id, e.RegularUser2.Id}, updatedRun.ParticipantIDs)

		requireFollowers(t, run.ID, []string{e.RegularUser.Id, e.RegularUser2.Id})
		requireChannelMember(t, run.ChannelID, e.RegularUser2.Id, true)
	})

	t.Run("non-participant can join but not add others", func(t *testing.T) {
		run := createRun(t, publicRunWithChannelActions, e.RegularUser.Id)

		_, err := e.PlaybooksClient2.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{user3.Id},
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		unchanged, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Len(t, unchanged.ParticipantIDs, 1)

		_, err = e.PlaybooksClient2.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{e.RegularUser2.Id},
		})
		require.NoError(t, err)

		updatedRun, err := e.PlaybooksClient2.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{user3.Id},
		})
		require.NoError(t, err)
		require.Len(t, updatedRun.ParticipantIDs, 3)
	})

	t.Run("participant can leave", func(t *testing.T) {
		run := createRun(t, publicRunWithChannelActions, e.RegularUser.Id)

		_, err := e.PlaybooksClient2.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{e.RegularUser2.Id},
		})
		require.NoError(t, err)

		updatedRun, err := e.PlaybooksClient2.PlaybookRuns.RemoveParticipants(context.Background(), run.ID, []string{e.RegularUser2.Id})
		require.NoError(t, err)
		assert.Equal(t, []string{e.RegularUser.Id}, updatedRun.ParticipantIDs)
	})

	t.Run("non-participant cannot remove others", func(t *testing.T) {
		run := createRun(t, client.PlaybookCreateOptions{Public: true, CreatePublicPlaybookRun: true}, e.RegularUser.Id)
		_, err := e.PlaybooksClient.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{user3.Id},
		})
		require.NoError(t, err)

		_, err = e.PlaybooksClient2.PlaybookRuns.RemoveParticipants(context.Background(), run.ID, []string{user3.Id})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		_, err = e.PlaybooksClient2.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{e.RegularUser2.Id},
		})
		require.NoError(t, err)

		updatedRun, err := e.PlaybooksClient2.PlaybookRuns.RemoveParticipants(context.Background(), run.ID, []string{user3.Id})
		require.NoError(t, err)
		assert.ElementsMatch(t, []string{e.RegularUser.Id, e.RegularUser2.Id}, updatedRun.ParticipantIDs)
	})

	t.Run("user without run access cannot join a private run", func(t *testing.T) {
		run := createRun(t, client.PlaybookCreateOptions{
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
		}, e.RegularUser.Id)

		_, err := e.PlaybooksClient2.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{e.RegularUser2.Id},
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("adding others to a finished run fails", func(t *testing.T) {
		run := createRun(t, publicRunWithChannelActions, e.RegularUser.Id)
		require.NoError(t, e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID))

		_, err := e.PlaybooksClient.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{e.RegularUser2.Id},
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		assert.Contains(t, err.Error(), "already ended")
	})

	t.Run("removing others from a finished run fails", func(t *testing.T) {
		run := createRun(t, publicRunWithChannelActions, e.RegularUser.Id)
		_, err := e.PlaybooksClient.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{
			UserIDs: []string{user3.Id},
		})
		require.NoError(t, err)
		require.NoError(t, e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID))

		_, err = e.PlaybooksClient.PlaybookRuns.RemoveParticipants(context.Background(), run.ID, []string{user3.Id})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("empty user_ids is rejected", func(t *testing.T) {
		run := createRun(t, publicRunWithChannelActions, e.RegularUser.Id)

		_, err := e.PlaybooksClient.PlaybookRuns.AddParticipants(context.Background(), run.ID, client.PlaybookRunParticipantsOptions{})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)

		_, err = e.PlaybooksClient.PlaybookRuns.RemoveParticipants(context.Background(), run.ID, nil)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("removing the owner is rejected", func(t *testing.T) {
		run := createRun(t, publicRunWithChannelActions, e.RegularUser.Id)

		_, err := e.PlaybooksClient.PlaybookRuns.RemoveParticipants(context.Background(), run.ID, []string{e.RegularUser.Id})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		assert.Contains(t, err.Error(), "owner user can't leave the run")
	})
}
