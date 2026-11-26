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

	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

func TestUpdatePlaybookRunSettings(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createRun := func(t *testing.T) *client.PlaybookRun {
		t.Helper()
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run settings",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		return run
	}

	t.Run("update run actions", func(t *testing.T) {
		run := createRun(t)
		assert.False(t, run.StatusUpdateBroadcastChannelsEnabled)
		assert.False(t, run.StatusUpdateBroadcastWebhooksEnabled)
		assert.Empty(t, run.WebhookOnStatusUpdateURLs)
		assert.Empty(t, run.BroadcastChannelIDs)
		assert.True(t, run.CreateChannelMemberOnNewParticipant)
		assert.True(t, run.RemoveChannelMemberOnRemovedParticipant)

		broadcastChannelIDs := []string{e.BasicPublicChannel.Id}
		webhooks := []string{"https://url1", "https://url2"}
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			StatusUpdateBroadcastChannelsEnabled:    model.NewPointer(true),
			StatusUpdateBroadcastWebhooksEnabled:    model.NewPointer(true),
			BroadcastChannelIDs:                     &broadcastChannelIDs,
			WebhookOnStatusUpdateURLs:               &webhooks,
			CreateChannelMemberOnNewParticipant:     model.NewPointer(false),
			RemoveChannelMemberOnRemovedParticipant: model.NewPointer(false),
		})
		require.NoError(t, err)
		require.True(t, updatedRun.StatusUpdateBroadcastChannelsEnabled)

		stored, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.True(t, stored.StatusUpdateBroadcastChannelsEnabled)
		assert.True(t, stored.StatusUpdateBroadcastWebhooksEnabled)
		assert.Equal(t, broadcastChannelIDs, stored.BroadcastChannelIDs)
		assert.Equal(t, webhooks, stored.WebhookOnStatusUpdateURLs)
		assert.False(t, stored.CreateChannelMemberOnNewParticipant)
		assert.False(t, stored.RemoveChannelMemberOnRemovedParticipant)
	})

	t.Run("false values are applied, not ignored", func(t *testing.T) {
		run := createRun(t)

		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			StatusUpdateBroadcastChannelsEnabled: model.NewPointer(true),
		})
		require.NoError(t, err)

		_, err = e.PlaybooksClient.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			StatusUpdateBroadcastChannelsEnabled: model.NewPointer(false),
		})
		require.NoError(t, err)

		stored, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.False(t, stored.StatusUpdateBroadcastChannelsEnabled)
	})

	t.Run("empty lists clear broadcast channels and webhooks", func(t *testing.T) {
		run := createRun(t)
		broadcastChannelIDs := []string{e.BasicPublicChannel.Id}
		webhooks := []string{"https://url1"}
		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			BroadcastChannelIDs:       &broadcastChannelIDs,
			WebhookOnStatusUpdateURLs: &webhooks,
		})
		require.NoError(t, err)

		_, err = e.PlaybooksClient.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			BroadcastChannelIDs:       &[]string{},
			WebhookOnStatusUpdateURLs: &[]string{},
		})
		require.NoError(t, err)

		stored, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Empty(t, stored.BroadcastChannelIDs)
		assert.Empty(t, stored.WebhookOnStatusUpdateURLs)
	})

	t.Run("invalid webhook URL is rejected", func(t *testing.T) {
		run := createRun(t)
		webhooks := []string{"ftp://not-allowed"}

		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			WebhookOnStatusUpdateURLs: &webhooks,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("adding a broadcast channel the user can't post in is forbidden", func(t *testing.T) {
		run := createRun(t)
		privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      e.BasicTeam.Id,
			Name:        "no-access-" + model.NewId()[:8],
			DisplayName: "No access",
			Type:        model.ChannelTypePrivate,
		})
		require.NoError(t, err)
		broadcastChannelIDs := []string{privateChannel.Id}

		_, err = e.PlaybooksClient.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			BroadcastChannelIDs: &broadcastChannelIDs,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		stored, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Empty(t, stored.BroadcastChannelIDs)
	})

	t.Run("moving to a private channel without permission is forbidden", func(t *testing.T) {
		run := createRun(t)

		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			ChannelID: &e.BasicPrivateChannel.Id,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("moving to a channel that doesn't exist is rejected", func(t *testing.T) {
		run := createRun(t)

		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			ChannelID: model.NewPointer(model.NewId()),
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("user who can't manage the run is forbidden", func(t *testing.T) {
		run := createRun(t)

		_, err := e.PlaybooksClient2.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			StatusUpdateBroadcastChannelsEnabled: model.NewPointer(true),
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("finished run settings can't change", func(t *testing.T) {
		run := createRun(t)
		require.NoError(t, e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID))

		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), run.ID, client.PlaybookRunUpdateOptions{
			StatusUpdateBroadcastChannelsEnabled: model.NewPointer(true),
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		assert.Contains(t, err.Error(), "cannot modify a finished run")
	})
}

func TestUpdatePlaybookRunChannel(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	makePublicChannel := func(t *testing.T, teamID string) *model.Channel {
		t.Helper()
		name := "test-ch-" + model.NewId()[:8]
		ch, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      teamID,
			Name:        name,
			DisplayName: name,
			Type:        model.ChannelTypeOpen,
		})
		require.NoError(t, err)
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), ch.Id, e.RegularUser.Id)
		require.NoError(t, err)
		return ch
	}

	createPlaybookRun := func(t *testing.T) *client.PlaybookRun {
		t.Helper()
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Playbook Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		return run
	}

	createChecklist := func(t *testing.T, teamID, channelID string) *client.PlaybookRun {
		t.Helper()
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Checklist",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      teamID,
			ChannelID:   channelID,
		})
		require.NoError(t, err)
		return run
	}

	moveRun := func(runID, channelID string) error {
		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), runID, client.PlaybookRunUpdateOptions{
			ChannelID: &channelID,
		})
		return err
	}

	t.Run("playbook run rejected when moved to DM channel", func(t *testing.T) {
		dmChannel, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.RegularUser2.Id)
		require.NoError(t, err)
		run := createPlaybookRun(t)

		requireErrorWithStatusCode(t, moveRun(run.ID, dmChannel.Id), http.StatusBadRequest)
	})

	t.Run("playbook run rejected when moved to GM channel", func(t *testing.T) {
		gmChannel, _, err := e.ServerAdminClient.CreateGroupChannel(context.Background(), []string{e.RegularUser.Id, e.RegularUser2.Id, e.AdminUser.Id})
		require.NoError(t, err)
		run := createPlaybookRun(t)

		requireErrorWithStatusCode(t, moveRun(run.ID, gmChannel.Id), http.StatusBadRequest)
	})

	t.Run("playbook run moves to same-team public channel", func(t *testing.T) {
		target := makePublicChannel(t, e.BasicTeam.Id)
		run := createPlaybookRun(t)

		require.NoError(t, moveRun(run.ID, target.Id))

		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, target.Id, updated.ChannelID)
		assert.Equal(t, e.BasicTeam.Id, updated.TeamID)
	})

	t.Run("playbook run rejected when moved to different team channel", func(t *testing.T) {
		target := makePublicChannel(t, e.BasicTeam2.Id)
		run := createPlaybookRun(t)

		requireErrorWithStatusCode(t, moveRun(run.ID, target.Id), http.StatusBadRequest)
	})

	t.Run("team checklist moves to DM and clears TeamID", func(t *testing.T) {
		src := makePublicChannel(t, e.BasicTeam.Id)
		dmChannel, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.RegularUser2.Id)
		require.NoError(t, err)
		run := createChecklist(t, e.BasicTeam.Id, src.Id)
		require.Equal(t, e.BasicTeam.Id, run.TeamID)

		require.NoError(t, moveRun(run.ID, dmChannel.Id))

		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Empty(t, updated.TeamID)
		assert.Equal(t, dmChannel.Id, updated.ChannelID)
	})

	t.Run("team checklist rejected when moved to different team channel", func(t *testing.T) {
		src := makePublicChannel(t, e.BasicTeam.Id)
		target := makePublicChannel(t, e.BasicTeam2.Id)
		run := createChecklist(t, e.BasicTeam.Id, src.Id)

		requireErrorWithStatusCode(t, moveRun(run.ID, target.Id), http.StatusBadRequest)
	})

	t.Run("DM checklist migrates to team channel and gains TeamID", func(t *testing.T) {
		dmChannel, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.RegularUser2.Id)
		require.NoError(t, err)
		run := createChecklist(t, "", dmChannel.Id)
		require.Empty(t, run.TeamID)

		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), e.BasicPublicChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		require.NoError(t, moveRun(run.ID, e.BasicPublicChannel.Id))

		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, e.BasicTeam.Id, updated.TeamID)
		assert.Equal(t, e.BasicPublicChannel.Id, updated.ChannelID)
	})

	t.Run("DM checklist moves to another DM keeping empty TeamID", func(t *testing.T) {
		srcDM, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.RegularUser2.Id)
		require.NoError(t, err)
		dstDM, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.AdminUser.Id)
		require.NoError(t, err)
		run := createChecklist(t, "", srcDM.Id)

		require.NoError(t, moveRun(run.ID, dstDM.Id))

		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Empty(t, updated.TeamID)
		assert.Equal(t, dstDM.Id, updated.ChannelID)
	})

	t.Run("checklist rejected when moved to a DM the user isn't in", func(t *testing.T) {
		src := makePublicChannel(t, e.BasicTeam.Id)
		otherDM, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser2.Id, e.AdminUser.Id)
		require.NoError(t, err)
		run := createChecklist(t, e.BasicTeam.Id, src.Id)

		requireErrorWithStatusCode(t, moveRun(run.ID, otherDM.Id), http.StatusForbidden)
	})
}
