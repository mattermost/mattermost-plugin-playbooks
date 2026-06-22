// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestRunCreation(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	incompletePlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "TestPlaybook",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Members: []client.PlaybookMember{
			{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
		},
		ChannelMode: client.PlaybookRunLinkExistingChannel,
		ChannelID:   "",
	})
	require.NoError(t, err)

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
					Submission: map[string]any{
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
					Submission: map[string]any{
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
					Submission: map[string]any{
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
					Submission: map[string]any{
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
					Submission: map[string]any{
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
					Submission: map[string]any{
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
					Submission: map[string]any{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				permissionsPrep: func() {
					e.Permissions.RemovePermissionFromRole(t, model.PermissionCreatePrivateChannel.Id, model.TeamUserRoleId)
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
					Submission: map[string]any{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID,
						app.DialogFieldNameKey:       "bad userid",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.Error(t, err)
					assert.Equal(t, http.StatusBadRequest, result.StatusCode)
				},
			},
			"invalid: missing channelid": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]any{
						app.DialogFieldPlaybookIDKey: incompletePlaybookID,
						app.DialogFieldNameKey:       "run number 1",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.Error(t, err)
					assert.Equal(t, http.StatusBadRequest, result.StatusCode)
				},
			},
			// Dialog with empty playbook and no channel fails (channel required for runs without playbook - MM-67648/MM-66249)
			"empty playbook ID without channel fails": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]any{
						app.DialogFieldPlaybookIDKey: "", // Empty playbook ID
						app.DialogFieldNameKey:       "Standalone Run",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					// Client returns error for 4xx; no channel in dialog yields 403 (RunCreate) or 400 (Option A)
					require.Error(t, err)
					require.NotNil(t, result)
					assert.True(t, result.StatusCode == http.StatusForbidden || result.StatusCode == http.StatusBadRequest, "expected 403 or 400")
				},
			},
			"valid playbook ID creates RunTypePlaybook": {
				dialogRequest: model.SubmitDialogRequest{
					TeamId: e.BasicTeam.Id,
					UserId: e.RegularUser.Id,
					State:  "{}",
					Submission: map[string]any{
						app.DialogFieldPlaybookIDKey: e.BasicPlaybook.ID, // Valid playbook ID
						app.DialogFieldNameKey:       "Playbook Run",
					},
				},
				expected: func(t *testing.T, result *http.Response, err error) {
					require.NoError(t, err)
					assert.Equal(t, http.StatusCreated, result.StatusCode)

					// Get the created run ID from the Location header
					url, err := result.Location()
					require.NoError(t, err)
					runID := url.Path[strings.LastIndex(url.Path, "/")+1:]

					// Verify the run was created with the correct type
					run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), runID)
					require.NoError(t, err)
					assert.Equal(t, app.RunTypePlaybook, run.Type, "Run with playbook ID should have RunTypePlaybook")
					assert.Equal(t, e.BasicPlaybook.ID, run.PlaybookID, "Run should have the correct playbook ID")
					assert.NotEmpty(t, run.ChannelID, "Run should have a channel ID")
				},
			},
		} {
			t.Run(name, func(t *testing.T) {
				dialogRequestBytes, err := json.Marshal(tc.dialogRequest)
				require.NoError(t, err)

				if tc.permissionsPrep != nil {
					defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
					defer func() {
						e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
					}()
					tc.permissionsPrep()
				}

				result, err := e.doPluginRequest(e.ServerClient, context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/dialog", string(dialogRequestBytes), nil)
				tc.expected(t, result, err)
			})
		}
	})

	// Checklist creation: run_create is not required; gate is permission to post in channel.
	// Remove run_create from team_user so these tests validate that behavior.
	t.Run("checklist creation without run_create", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
		defer e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		e.Permissions.RemovePermissionFromRole(t, model.PermissionRunCreate.Id, model.TeamUserRoleId)

		t.Run("create run without playbook with ChannelID", func(t *testing.T) {
			run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
				Name:        "Channel checklist",
				OwnerUserID: e.RegularUser.Id,
				TeamID:      e.BasicTeam.Id,
				ChannelID:   e.BasicPublicChannel.Id,
				PlaybookID:  "",
			})
			require.NoError(t, err)
			require.NotNil(t, run)
			assert.Equal(t, app.RunTypeChannelChecklist, run.Type)
			assert.Empty(t, run.PlaybookID)
			assert.Equal(t, e.BasicPublicChannel.Id, run.ChannelID)
		})

		t.Run("create valid run without playbook", func(t *testing.T) {
			run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
				Name:        "No playbook",
				OwnerUserID: e.RegularUser.Id,
				TeamID:      e.BasicTeam.Id,
				ChannelID:   e.BasicPublicChannel.Id,
				PlaybookID:  "",
			})
			require.NoError(t, err)
			require.NotNil(t, run)
			assert.Equal(t, app.RunTypeChannelChecklist, run.Type, "Run without playbook ID should have RunTypeChannelChecklist")
			assert.Empty(t, run.PlaybookID)
			assert.Equal(t, e.BasicPublicChannel.Id, run.ChannelID)
		})
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
		assert.Equal(t, app.RunTypePlaybook, run.Type, "Run with playbook ID should have RunTypePlaybook")
		assert.Equal(t, e.BasicPlaybook.ID, run.PlaybookID)
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

	t.Run("create valid run using playbook with due dates", func(t *testing.T) {
		durations := []int64{
			4 * time.Hour.Milliseconds(),      // 4 hours
			30 * time.Minute.Milliseconds(),   // 30 min
			4 * 24 * time.Hour.Milliseconds(), // 4 days
		}

		// create playbook with relative due dates
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Public: true,
			Title:  "PB",
			TeamID: e.BasicTeam.Id,
			Checklists: []client.Checklist{
				{
					Title: "A",
					Items: []client.ChecklistItem{
						{
							Title:   "Do this1",
							DueDate: durations[0],
						},
						{
							Title:   "Do this2",
							DueDate: durations[1],
						},
					},
				},
				{
					Title: "B",
					Items: []client.ChecklistItem{
						{
							Title:   "Do this1",
							DueDate: durations[2],
						},
						{
							Title: "Do this2",
						},
					},
				},
			},
		})
		assert.NoError(t, err)

		now := model.GetMillis()
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "With due dates",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
		// compare date with 10^4 precision because run creation might take more than a second
		assert.Equal(t, (now+durations[0])/10000, run.Checklists[0].Items[0].DueDate/10000)
		assert.Equal(t, (now+durations[1])/10000, run.Checklists[0].Items[1].DueDate/10000)
		assert.Equal(t, (now+durations[2])/10000, run.Checklists[1].Items[0].DueDate/10000)
		assert.Zero(t, run.Checklists[1].Items[1].DueDate)
	})
}

func TestCreateRunInExistingChannel(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// create playbook
	playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Public:      true,
		Title:       "PB",
		TeamID:      e.BasicTeam.Id,
		ChannelMode: client.PlaybookRunLinkExistingChannel,
		ChannelID:   e.BasicPublicChannel.Id,
	})
	assert.NoError(t, err)

	t.Run("create a run", func(t *testing.T) {
		// create a run, pass the channel id from the playbook configuration
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run in existing channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   e.BasicPublicChannel.Id,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
		assert.Equal(t, e.BasicPublicChannel.Id, run.ChannelID)

		// Verify user was not promoted to admin
		member, _, err := e.ServerAdminClient.GetChannelMember(context.Background(), e.BasicPublicChannel.Id, e.RegularUser.Id, "")
		require.NoError(t, err)
		assert.NotContains(t, member.Roles, model.ChannelAdminRoleId)

	})

	t.Run("no access to the linked channel", func(t *testing.T) {
		// create a run, pass the channel id from the playbook configuration
		run, err := e.PlaybooksClient2.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run in existing channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   e.BasicPublicChannel.Id,
		})

		// PlaybooksClient2 is not a channel member, so should not be able to start a run
		assert.Error(t, err)
		assert.Nil(t, run)
	})

	t.Run("create a run, pass a channel different from the playbook configs", func(t *testing.T) {
		// create private channel
		privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "test_private",
			Name:        "test_private",
			Type:        model.ChannelTypePrivate,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(e.T, err)
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), privateChannel.Id, e.RegularUser.Id)
		require.NoError(e.T, err)

		// create a run, pass the channel id different from the playbook configs
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run in existing channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   privateChannel.Id,
		})
		assert.NoError(t, err)
		assert.NotNil(t, run)
		assert.Equal(t, privateChannel.Id, run.ChannelID)
	})

	t.Run("does not add different owner to existing private channel when requester lacks manage-members", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
		defer e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		e.Permissions.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelMembers.Id, model.TeamUserRoleId)
		e.Permissions.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelMembers.Id, model.ChannelUserRoleId)

		privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "different_owner_private",
			Name:        e.resourceName("different-owner-private"),
			Type:        model.ChannelTypePrivate,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), privateChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		_, _, err = e.ServerAdminClient.GetChannelMember(context.Background(), privateChannel.Id, e.RegularUser2.Id, "")
		require.Error(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run in existing private channel",
			OwnerUserID: e.RegularUser2.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   privateChannel.Id,
		})
		if err != nil {
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
			assert.Nil(t, run)
			return
		}

		require.NotNil(t, run)
		_, _, err = e.ServerAdminClient.GetChannelMember(context.Background(), privateChannel.Id, e.RegularUser2.Id, "")
		require.Error(t, err, "expected different owner to remain outside the channel when run creation succeeds")
	})

	t.Run("does not add different owner to existing public channel when requester lacks manage-members", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
		defer e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		e.Permissions.RemovePermissionFromRole(t, model.PermissionManagePublicChannelMembers.Id, model.TeamUserRoleId)
		e.Permissions.RemovePermissionFromRole(t, model.PermissionManagePublicChannelMembers.Id, model.ChannelUserRoleId)

		publicChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "different_owner_public",
			Name:        e.resourceName("different-owner-public"),
			Type:        model.ChannelTypeOpen,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), publicChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		_, _, err = e.ServerAdminClient.GetChannelMember(context.Background(), publicChannel.Id, e.RegularUser2.Id, "")
		require.Error(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run in existing public channel",
			OwnerUserID: e.RegularUser2.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   publicChannel.Id,
		})
		if err != nil {
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
			assert.Nil(t, run)
			return
		}

		require.NotNil(t, run)
		_, _, err = e.ServerAdminClient.GetChannelMember(context.Background(), publicChannel.Id, e.RegularUser2.Id, "")
		require.Error(t, err, "expected different owner to remain outside the channel when run creation succeeds")
	})

	t.Run("does not add different owner to checklist run without playbook when requester lacks manage-members", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
		defer e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		e.Permissions.RemovePermissionFromRole(t, model.PermissionManagePublicChannelMembers.Id, model.TeamUserRoleId)
		e.Permissions.RemovePermissionFromRole(t, model.PermissionManagePublicChannelMembers.Id, model.ChannelUserRoleId)

		publicChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "different_owner_checklist",
			Name:        e.resourceName("different-owner-checklist"),
			Type:        model.ChannelTypeOpen,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), publicChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		_, _, err = e.ServerAdminClient.GetChannelMember(context.Background(), publicChannel.Id, e.RegularUser2.Id, "")
		require.Error(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "checklist run in existing channel",
			OwnerUserID: e.RegularUser2.Id,
			TeamID:      e.BasicTeam.Id,
			ChannelID:   publicChannel.Id,
		})
		if err != nil {
			requireErrorWithStatusCode(t, err, http.StatusForbidden)
			assert.Nil(t, run)
			return
		}

		require.NotNil(t, run)
		_, _, err = e.ServerAdminClient.GetChannelMember(context.Background(), publicChannel.Id, e.RegularUser2.Id, "")
		require.Error(t, err, "expected different owner to remain outside the checklist run channel when run creation succeeds")
	})

	t.Run("adds different owner to existing channel when requester can manage members", func(t *testing.T) {
		defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
		defer e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
		e.Permissions.AddPermissionToRole(t, model.PermissionManagePublicChannelMembers.Id, model.TeamUserRoleId)
		e.Permissions.AddPermissionToRole(t, model.PermissionManagePublicChannelMembers.Id, model.ChannelUserRoleId)

		publicChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "managed_owner_public",
			Name:        e.resourceName("managed-owner-public"),
			Type:        model.ChannelTypeOpen,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), publicChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		_, _, err = e.ServerAdminClient.GetChannelMember(context.Background(), publicChannel.Id, e.RegularUser2.Id, "")
		require.Error(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run in managed existing channel",
			OwnerUserID: e.RegularUser2.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   publicChannel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		_, _, err = e.ServerAdminClient.GetChannelMember(context.Background(), publicChannel.Id, e.RegularUser2.Id, "")
		require.NoError(t, err, "expected different owner to be added to the channel")
	})

	t.Run("create a run using dialog requests", func(t *testing.T) {
		dialogRequest := model.SubmitDialogRequest{
			TeamId: e.BasicTeam.Id,
			UserId: e.RegularUser.Id,
			State:  "{}",
			Submission: map[string]any{
				app.DialogFieldPlaybookIDKey: playbookID,
				app.DialogFieldNameKey:       "run number 1",
			},
		}
		dialogRequestBytes, err := json.Marshal(dialogRequest)
		assert.NoError(t, err)

		result, err := e.doPluginRequest(e.ServerClient, context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/dialog", string(dialogRequestBytes), nil)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, result.StatusCode)

		url, err := result.Location()
		assert.NoError(t, err)
		runID := url.Path[strings.LastIndex(url.Path, "/")+1:]
		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), runID)
		assert.NoError(t, err)
		assert.Equal(t, e.BasicPublicChannel.Id, run.ChannelID)
	})
}

func TestCreateInvalidRuns(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("fails if summary is longer than 4096", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "test run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			Summary:     strings.Repeat("A", 4097),
		})
		requireErrorWithStatusCode(t, err, http.StatusInternalServerError)
		assert.Nil(t, run)
	})

	t.Run("checklist title way too long", func(t *testing.T) {
		run := e.BasicRun
		require.Len(t, run.Checklists, 0)

		// Create a valid checklist
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: strings.Repeat("T", 257*1024),
			Items: []client.ChecklistItem{},
		})
		t.Logf("Error: %v", err)
		require.Error(t, err)
	})
}

func TestCreateRunWithNewChannelOnlyPlaybook(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Create a playbook with NewChannelOnly=true
	pbCreateOptions := client.PlaybookCreateOptions{
		Public:         true,
		Title:          "New Channel Only Playbook",
		TeamID:         e.BasicTeam.Id,
		ChannelMode:    client.PlaybookRunCreateNewChannel,
		NewChannelOnly: true,
	}
	playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), pbCreateOptions)
	require.NoError(t, err)

	t.Run("run creation without channel_id succeeds", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run without channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		assert.NotNil(t, run)
		assert.NotEmpty(t, run.ChannelID)
	})

	t.Run("run creation with explicit channel_id fails", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "run with channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   e.BasicPublicChannel.Id,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		assert.Nil(t, run)
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
		require.NoError(t, err)
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
		require.NoError(t, err)
		require.Len(t, list.Items, 2)

		list, err = e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:   e.BasicTeam.Id,
			Statuses: []client.Status{client.StatusInProgress},
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)

		list, err = e.PlaybooksAdminClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:  e.BasicTeam.Id,
			OwnerID: e.RegularUser.Id,
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
	})

	t.Run("checklist autocomplete", func(t *testing.T) {
		resp, err := e.doPluginRequest(e.ServerClient, context.Background(), "GET", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/checklist-autocomplete?channel_id="+e.BasicPrivateChannel.Id, "", nil)
		assert.Error(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("can't get cross team", func(t *testing.T) {
		_, err := e.PlaybooksClientNotInTeam.PlaybookRuns.Get(context.Background(), e.BasicRun.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("can't list cross team", func(t *testing.T) {
		list, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam.Id,
		})
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(list.Items), 1)
		list2, err2 := e.PlaybooksClientNotInTeam.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam.Id,
		})
		assert.NoError(t, err2)
		assert.Len(t, list2.Items, 0)
	})

	t.Run("filter by channel id", func(t *testing.T) {
		// Create another run to verify filtering works
		otherRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Another run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.NotEqual(t, e.BasicRun.ChannelID, otherRun.ChannelID)

		// We need to make sure the user has permission to the channel to test the filter
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), e.BasicRun.ChannelID, e.RegularUser.Id)
		require.NoError(t, err)

		// Test filtering by channel_id
		list, err := e.PlaybooksClient.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:    e.BasicTeam.Id,
			ChannelID: e.BasicRun.ChannelID,
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, e.BasicRun.ID, list.Items[0].ID)

		// Skip test with non-existent channel_id as it requires permissions to the channel
		// which we can't add for a non-existent channel

		// Test channel_id filter with no permission
		// Make sure user2 is on the team
		_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicTeam.Id, e.RegularUser2.Id)
		require.NoError(t, err)

		// Try to filter by a channel the user doesn't have access to
		_, err = e.PlaybooksClient2.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID:    e.BasicTeam.Id,
			ChannelID: e.BasicPrivateChannel.Id,
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		// Clean up to not affect other tests
		err = e.PlaybooksAdminClient.PlaybookRuns.Finish(context.Background(), otherRun.ID)
		require.NoError(t, err)
	})
}

func TestRunPostStatusUpdateDialog(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("post an update", func(t *testing.T) {
		dialogRequest := model.SubmitDialogRequest{
			TeamId: e.BasicTeam.Id,
			UserId: e.RegularUser.Id,
			State:  "{}",
			Submission: map[string]any{
				app.DialogFieldMessageKey:           "someupdate",
				app.DialogFieldReminderInSecondsKey: "100000",
				app.DialogFieldFinishRun:            false,
			},
		}
		dialogRequestBytes, err := json.Marshal(dialogRequest)
		require.NoError(t, err)

		result, err := e.doPluginRequest(e.ServerClient, context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/"+e.BasicRun.ID+"/update-status-dialog", string(dialogRequestBytes), nil)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, result.StatusCode)
	})

	t.Run("no permissions to team", func(t *testing.T) {
		_, err := e.ServerAdminClient.RemoveTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)

		dialogRequest := model.SubmitDialogRequest{
			TeamId: e.BasicTeam.Id,
			UserId: e.RegularUser.Id,
			State:  "{}",
			Submission: map[string]any{
				app.DialogFieldMessageKey:           "someupdate",
				app.DialogFieldReminderInSecondsKey: "100000",
				app.DialogFieldFinishRun:            false,
			},
		}
		dialogRequestBytes, err := json.Marshal(dialogRequest)
		require.NoError(t, err)

		result, err := e.doPluginRequest(e.ServerClient, context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/runs/"+e.BasicRun.ID+"/update-status-dialog", string(dialogRequestBytes), nil)
		require.Error(t, err)
		assert.Equal(t, http.StatusForbidden, result.StatusCode)

		_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)
	})
}

func TestRunPostStatusUpdate(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("post an update", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update", 600)
		assert.NoError(t, err)
	})

	t.Run("creates a reminder post", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update", 1)
		assert.NoError(t, err)

		// wait for the scheduler to run the job
		time.Sleep(2 * time.Second)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), e.BasicRun.ID)
		assert.Equal(t, 1*time.Second, run.PreviousReminder)
		assert.NotEmpty(t, run.ReminderPostID)
		assert.NoError(t, err)

		// post created with expected props
		post, _, err := e.ServerClient.GetPost(context.Background(), run.ReminderPostID, "")
		assert.NoError(t, err)
		assert.Equal(t, run.ID, post.GetProp("playbookRunId"))
		assert.Equal(t, e.RegularUser.Username, post.GetProp("targetUsername"))
	})

	t.Run("poar an update with empty message", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "  \t  \r ", 600)
		assert.Error(t, err)
	})

	t.Run("no permissions to run", func(t *testing.T) {
		_, err := e.ServerAdminClient.RemoveTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)
		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update", 600)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)
	})

	t.Run("no permissions to run", func(t *testing.T) {
		_, _, err := e.ServerAdminClient.AddChannelMember(context.Background(), e.BasicRun.ChannelID, e.RegularUser2.Id)
		require.NoError(t, err)
		err = e.PlaybooksClient2.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update", 600)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("test no permissions to broadcast channel", func(t *testing.T) {
		// Create a run with a private channel in the broadcast channels
		e.BasicPlaybook.BroadcastChannelIDs = []string{e.BasicPrivateChannel.Id}
		err := e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *e.BasicPlaybook)
		require.NoError(t, err)
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Poison broadcast channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Update should work even when we don't have access to private broadcast channel
		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), run.ID, "update", 600)
		assert.NoError(t, err)
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

	t.Run("checklist creation - failure: no permissions", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		title := "A new checklist"

		// Create a valid, empty checklist
		err := e.PlaybooksClient2.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: title,
			Items: []client.ChecklistItem{},
		})
		require.Error(t, err)
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

	t.Run("checklist renaming - failure: run is finished", func(t *testing.T) {
		run := createNewRunWithNoChecklists(t)
		oldTitle := "Old Title"
		newTitle := "New Title"

		// Create a new checklist with a known title
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: oldTitle,
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		// Finish the run
		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		// Try to rename the checklist in the finished run
		err = e.PlaybooksClient.PlaybookRuns.RenameChecklist(context.Background(), run.ID, 0, newTitle)
		require.Error(t, err)
		require.Contains(t, err.Error(), "already ended")
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

		// Create two valid checklists
		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "First checklist",
			Items: []client.ChecklistItem{},
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "Second checklist",
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
			[][]string{{"10", "11", "12"}, {"00", "01", "02"}},
			0, 1, 1, 0,
			[][]string{{"00", "02"}, {"01", "10", "11", "12"}},
			nil,
		},
		{
			"Multiple checklists - move to an empty checklist",
			[][]string{{}, {"00", "01"}},
			0, 0, 1, 0,
			[][]string{{"01"}, {"00"}},
			nil,
		},
		{
			"Multiple checklists - leave the original checklist empty",
			[][]string{{"10"}, {"00"}},
			0, 0, 1, 1,
			[][]string{{}, {"10", "00"}},
			nil,
		},
		{
			"One checklist - invalid source checklist: greater than length of checklists",
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
			"One checklist - invalid source item: greater than length of items",
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
			[]string{"1", "0"},
			0, 1,
			[]string{"1", "0"},
			nil,
		},
		{
			"Swap two checklists, moving the second one",
			[]string{"1", "0"},
			1, 0,
			[]string{"1", "0"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - first to second ",
			[]string{"2", "1", "0"},
			0, 1,
			[]string{"1", "0", "2"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - first to third",
			[]string{"2", "1", "0"},
			0, 2,
			[]string{"1", "2", "0"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - second to first",
			[]string{"2", "1", "0"},
			1, 0,
			[]string{"1", "0", "2"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - second to third",
			[]string{"2", "1", "0"},
			1, 2,
			[]string{"0", "2", "1"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - third to first",
			[]string{"2", "1", "0"},
			2, 0,
			[]string{"2", "0", "1"},
			nil,
		},
		{
			"Move a checklist in a list of three checklists - third to second",
			[]string{"2", "1", "0"},
			2, 1,
			[]string{"0", "2", "1"},
			nil,
		},
		{
			"Wrong destination index - greater than length of list",
			[]string{"2", "1", "0"},
			0, 5,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
		{
			"Wrong destination index - negative",
			[]string{"2", "1", "0"},
			0, -5,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
		{
			"Wrong source index - greater than length of list",
			[]string{"2", "1", "0"},
			5, 0,
			[]string{"0", "1", "2"},
			&ExpectedError{500},
		},
		{
			"Wrong source index - negative",
			[]string{"2", "1", "0"},
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

func TestChecklisFailTooLarge(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("checklist creation - failure: too large checklist", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 0)

		err = e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, client.Checklist{
			Title: "My regular title",
			Items: []client.ChecklistItem{
				{Title: "Item title", Description: strings.Repeat("A", (256*1024)+1)},
			},
		})
		require.Error(t, err)
	})
}

func TestIgnoreKeywords(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	botID := e.Srv.Config().PluginSettings.Plugins[manifest.Id]["BotUserID"].(string)

	t.Run("no permission to channel", func(t *testing.T) {
		// Create a bot post in the private channel
		botPost := &model.Post{
			UserId:    botID,
			ChannelId: e.BasicPrivateChannel.Id,
			Message:   "test message",
			Props: model.StringInterface{
				"attachments": []*model.MessageAttachment{
					{
						Actions: []*model.PostAction{
							{
								Id: "ignoreKeywordsButton",
							},
						},
					},
				},
			},
		}
		botPost, err := e.Srv.Store().Post().Save(e.Context, botPost)
		require.NoError(t, err)

		// Create post action request
		req := &model.PostActionIntegrationRequest{
			UserId: e.RegularUser.Id,
			Context: map[string]any{
				"post_id": botPost.Id,
			},
			PostId: botPost.Id,
		}

		// Convert request to JSON
		reqBytes, err := json.Marshal(req)
		require.NoError(t, err)

		// Make the request
		result, err := e.doPluginRequest(e.ServerClient, context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/signal/keywords/ignore-thread", string(reqBytes), nil)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, result.StatusCode)
	})

	t.Run("has permission to channel", func(t *testing.T) {
		// Add user to private channel
		_, _, err := e.ServerAdminClient.AddChannelMember(context.Background(), e.BasicPrivateChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		// Create a bot post in the private channel
		botPost := &model.Post{
			UserId:    botID,
			ChannelId: e.BasicPrivateChannel.Id,
			Message:   "test message",
			Props: model.StringInterface{
				"attachments": []*model.MessageAttachment{
					{
						Actions: []*model.PostAction{
							{
								Id: "ignoreKeywordsButton",
							},
						},
					},
				},
			},
		}
		botPost, err = e.Srv.Store().Post().Save(e.Context, botPost)
		require.NoError(t, err)

		// Create post action request
		req := &model.PostActionIntegrationRequest{
			UserId: e.RegularUser.Id,
			Context: map[string]any{
				"post_id": botPost.Id,
			},
			PostId: botPost.Id,
		}

		// Convert request to JSON
		reqBytes, err := json.Marshal(req)
		require.NoError(t, err)

		// Make the request
		result, err := e.doPluginRequest(e.ServerClient, context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/signal/keywords/ignore-thread", string(reqBytes), nil)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, result.StatusCode)
	})
}

func TestRunGetStatusUpdates(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("public - get no updates", func(t *testing.T) {
		statusUpdates, err := e.PlaybooksClient.PlaybookRuns.GetStatusUpdates(context.Background(), e.BasicRun.ID)
		assert.NoError(t, err)
		assert.Len(t, statusUpdates, 0)
	})

	t.Run("public - get 2 updates as participant", func(t *testing.T) {
		err := e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update 1", 5000)
		require.NoError(t, err)
		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), e.BasicRun.ID, "update 2", 10000)
		require.NoError(t, err)

		statusUpdates, err := e.PlaybooksClient.PlaybookRuns.GetStatusUpdates(context.Background(), e.BasicRun.ID)
		require.NoError(t, err)
		assert.Len(t, statusUpdates, 2)
		assert.Equal(t, "update 2", statusUpdates[0].Message)
		assert.Equal(t, "update 1", statusUpdates[1].Message)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[0].AuthorUserName)
	})

	t.Run("public - get 2 updates as viewer", func(t *testing.T) {
		statusUpdates, err := e.PlaybooksClient2.PlaybookRuns.GetStatusUpdates(context.Background(), e.BasicRun.ID)
		require.NoError(t, err)
		assert.Len(t, statusUpdates, 2)
		assert.Equal(t, "update 2", statusUpdates[0].Message)
		assert.Equal(t, "update 1", statusUpdates[1].Message)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[0].AuthorUserName)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[1].AuthorUserName)
	})

	t.Run("public - fails because not in team", func(t *testing.T) {
		statusUpdates, err := e.PlaybooksClientNotInTeam.PlaybookRuns.GetStatusUpdates(context.Background(), e.BasicRun.ID)
		require.Error(t, err)
		assert.Len(t, statusUpdates, 0)
	})

	t.Run("private - get no updates", func(t *testing.T) {
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		assert.NoError(t, err)

		statusUpdates, err := e.PlaybooksClient.PlaybookRuns.GetStatusUpdates(context.Background(), privateRun.ID)
		assert.NoError(t, err)
		assert.Len(t, statusUpdates, 0)
	})

	t.Run("private - get 2 updates as participant", func(t *testing.T) {
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		assert.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), privateRun.ID, "update 1", 5000)
		require.NoError(t, err)
		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), privateRun.ID, "update 2", 10000)
		require.NoError(t, err)

		statusUpdates, err := e.PlaybooksClient.PlaybookRuns.GetStatusUpdates(context.Background(), privateRun.ID)
		require.NoError(t, err)
		assert.Len(t, statusUpdates, 2)
		assert.Equal(t, "update 2", statusUpdates[0].Message)
		assert.Equal(t, "update 1", statusUpdates[1].Message)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[0].AuthorUserName)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[1].AuthorUserName)
	})

	t.Run("private - get 2 updates as viewer", func(t *testing.T) {
		privatePlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "TestPrivatePlaybook custom",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		privatePlaybook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), privatePlaybookID)
		require.NoError(e.T, err)

		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybook.ID,
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), privateRun.ID, "update 1", 5000)
		require.NoError(t, err)
		err = e.PlaybooksClient.PlaybookRuns.UpdateStatus(context.Background(), privateRun.ID, "update 2", 10000)
		require.NoError(t, err)

		statusUpdates, err := e.PlaybooksClient2.PlaybookRuns.GetStatusUpdates(context.Background(), privateRun.ID)
		require.NoError(t, err)
		assert.Len(t, statusUpdates, 2)
		assert.Equal(t, "update 2", statusUpdates[0].Message)
		assert.Equal(t, "update 1", statusUpdates[1].Message)
		assert.Equal(t, e.RegularUser.Username, statusUpdates[0].AuthorUserName)
	})

	t.Run("private - fails because not in playbook members", func(t *testing.T) {
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		require.NoError(t, err)

		statusUpdates, err := e.PlaybooksClient2.PlaybookRuns.GetStatusUpdates(context.Background(), privateRun.ID)
		require.Error(t, err)
		assert.Len(t, statusUpdates, 0)
	})
}

func TestRequestUpdate(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("private - no viewer access ", func(t *testing.T) {
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		assert.NoError(t, err)

		err = e.PlaybooksClient2.PlaybookRuns.RequestUpdate(context.Background(), privateRun.ID, e.RegularUser2.Id)
		assert.Error(t, err)

		err = e.PlaybooksClientNotInTeam.PlaybookRuns.RequestUpdate(context.Background(), privateRun.ID, e.RegularUserNotInTeam.Id)
		assert.Error(t, err)
	})

	t.Run("private - viewer access ", func(t *testing.T) {
		privatePlaybookID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "TestPrivatePlaybook custom",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		privatePlaybook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), privatePlaybookID)
		require.NoError(e.T, err)

		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybookID,
		})
		assert.NoError(t, err)

		// No access, RegularUser2 is not a Viewer
		err = e.PlaybooksClient2.PlaybookRuns.RequestUpdate(context.Background(), privateRun.ID, e.RegularUser2.Id)
		assert.Error(t, err)

		// Add RegularUser2 as a Viewer
		privatePlaybook.Members = append(privatePlaybook.Members, client.PlaybookMember{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}})
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *privatePlaybook)
		assert.NoError(t, err)

		// Gained Viewer access
		err = e.PlaybooksClient2.PlaybookRuns.RequestUpdate(context.Background(), privateRun.ID, e.RegularUser2.Id)
		assert.NoError(t, err)

		// Assert that timeline event is created
		privateRun, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), privateRun.ID)
		assert.NoError(t, err)
		assert.NotEmpty(t, privateRun.TimelineEvents)
		lastEvent := privateRun.TimelineEvents[len(privateRun.TimelineEvents)-1]
		assert.Equal(t, client.StatusUpdateRequested, lastEvent.EventType)
		assert.Equal(t, e.RegularUser2.Id, lastEvent.SubjectUserID)
		assert.Equal(t, e.RegularUser2.Id, lastEvent.CreatorUserID)
		assert.NotZero(t, lastEvent.PostID)
		assert.Equal(t, fmt.Sprintf("@%s requested a status update", e.RegularUser2.Username), lastEvent.Summary)
	})

	t.Run("public - viewer access ", func(t *testing.T) {
		publicRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Basic create",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		assert.NoError(t, err)

		err = e.PlaybooksClient2.PlaybookRuns.RequestUpdate(context.Background(), publicRun.ID, e.RegularUser2.Id)
		assert.NoError(t, err)

		// Assert that timeline event is created
		publicRun, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), publicRun.ID)
		assert.NoError(t, err)
		assert.NotEmpty(t, publicRun.TimelineEvents)
		lastEvent := publicRun.TimelineEvents[len(publicRun.TimelineEvents)-1]
		assert.Equal(t, client.StatusUpdateRequested, lastEvent.EventType)
		assert.Equal(t, e.RegularUser2.Id, lastEvent.SubjectUserID)
		assert.Equal(t, fmt.Sprintf("@%s requested a status update", e.RegularUser2.Username), lastEvent.Summary)

		err = e.PlaybooksClientNotInTeam.PlaybookRuns.RequestUpdate(context.Background(), publicRun.ID, e.RegularUserNotInTeam.Id)
		assert.Error(t, err)
	})
}

func TestReminderReset(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("reminder reset - timeline event created", func(t *testing.T) {
		payload := client.ReminderResetPayload{
			NewReminderSeconds: 100,
		}
		err := e.PlaybooksClient.Reminders.Reset(context.Background(), e.BasicRun.ID, payload)
		assert.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), e.BasicRun.ID)
		assert.Equal(t, 100*time.Second, run.PreviousReminder)
		assert.NoError(t, err)

		statusSnoozed := make([]client.TimelineEvent, 0)
		for _, te := range run.TimelineEvents {
			if te.EventType == "status_update_snoozed" {
				statusSnoozed = append(statusSnoozed, te)
			}
		}
		require.Len(t, statusSnoozed, 1)
	})

	t.Run("reminder reset - reminder post created", func(t *testing.T) {
		payload := client.ReminderResetPayload{
			NewReminderSeconds: 1,
		}
		err := e.PlaybooksClient.Reminders.Reset(context.Background(), e.BasicRun.ID, payload)
		assert.NoError(t, err)

		// wait for scheduler to run the job
		time.Sleep(2 * time.Second)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), e.BasicRun.ID)
		assert.Equal(t, 1*time.Second, run.PreviousReminder)
		assert.NotEmpty(t, run.ReminderPostID)
		assert.NoError(t, err)

		// post created with expected props
		post, _, err := e.ServerClient.GetPost(context.Background(), run.ReminderPostID, "")
		assert.NoError(t, err)
		assert.Equal(t, run.ID, post.GetProp("playbookRunId"))
		assert.Equal(t, e.RegularUser.Username, post.GetProp("targetUsername"))
	})
}

func TestChecklisItem_SetAssignee(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	addSimpleChecklistToTun := func(t *testing.T, runID string) *client.PlaybookRun {
		checklist := client.Checklist{
			Title: "Test Checklist",
			Items: []client.ChecklistItem{
				{
					Title: "Test Item",
				},
			},
		}

		err := e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), runID, checklist)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), runID)
		require.NoError(t, err)
		require.Len(t, run.Checklists, 1)
		require.Len(t, run.Checklists[0].Items, 1)
		return run
	}

	t.Run("set assignee and participant", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 0)

		run = addSimpleChecklistToTun(t, run.ID)

		// assignee is not set and user is not participant (before)
		require.Empty(t, run.Checklists[0].Items[0].AssigneeID)
		require.Len(t, run.ParticipantIDs, 1)
		require.NotContains(t, run.ParticipantIDs, e.RegularUser2.Id)

		// set assignee
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser2.Id)
		require.NoError(t, err)

		// assignee is not set and user is not participant (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, e.RegularUser2.Id, run.Checklists[0].Items[0].AssigneeID)
		require.Contains(t, run.ParticipantIDs, e.RegularUser2.Id)
	})

	t.Run("set and unset", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 0)

		run = addSimpleChecklistToTun(t, run.ID)

		// set assignee
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser.Id)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, e.RegularUser.Id, run.Checklists[0].Items[0].AssigneeID)

		// unset assignee
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, "")
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, "", run.Checklists[0].Items[0].AssigneeID)
	})

	t.Run("idempotent action", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 0)

		run = addSimpleChecklistToTun(t, run.ID)

		// set assignee
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser.Id)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, e.RegularUser.Id, run.Checklists[0].Items[0].AssigneeID)

		// unset assignee
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser.Id)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, e.RegularUser.Id, run.Checklists[0].Items[0].AssigneeID)
	})

	t.Run("set role assignee dispatches to SetRoleAssignee", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		run = addSimpleChecklistToTun(t, run.ID)

		// Pre-seed a specific assignee so we can verify role assignment overwrites it
		// with the resolved role-user (the owner), not leaves the prior explicit value.
		err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser2.Id)
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.SetItemRoleAssignee(context.Background(), run.ID, 0, 0, app.AssigneeTypeOwner)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, app.AssigneeTypeOwner, run.Checklists[0].Items[0].AssigneeType)
		// SetRoleAssignee resolves AssigneeID to the role's concrete user immediately
		// (see playbook_run_service.go SetRoleAssignee), so AssigneeID is the owner,
		// not empty and not the previously explicit RegularUser2.
		require.Equal(t, run.OwnerUserID, run.Checklists[0].Items[0].AssigneeID)
		require.NotEqual(t, e.RegularUser2.Id, run.Checklists[0].Items[0].AssigneeID)
		require.Empty(t, run.Checklists[0].Items[0].AssigneePropertyFieldID)
	})

	t.Run("set property_user assignee dispatches to SetPropertyUserAssignee", func(t *testing.T) {
		e.SetEnterpriseLicence()

		// Create a playbook with a user-type property field so we have a valid field ID.
		pbID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Dispatch Test Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		require.NoError(t, err)

		playbookField, err := e.PlaybooksClient.Playbooks.CreatePropertyField(
			context.Background(),
			pbID,
			client.PropertyFieldRequest{Name: "Lead", Type: "user"},
		)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)
		run = addSimpleChecklistToTun(t, run.ID)

		// Resolve the run-level copy of the playbook field — its ID differs from playbookField.ID.
		runFields, err := e.PlaybooksClient.PlaybookRuns.GetPropertyFields(context.Background(), run.ID)
		require.NoError(t, err)
		var runUserFieldID string
		for _, f := range runFields {
			if f.Name == "Lead" && f.Type == "user" {
				runUserFieldID = f.ID
				break
			}
		}
		require.NotEmpty(t, runUserFieldID, "run-level 'Lead' user field not found")
		require.NotEqual(t, playbookField.ID, runUserFieldID, "run-level field ID must differ from playbook-level field ID")

		// Happy path: valid run-level user field — dispatch must succeed and persist the run field ID.
		err = e.PlaybooksClient.PlaybookRuns.SetItemPropertyUserAssignee(context.Background(), run.ID, 0, 0, runUserFieldID)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, runUserFieldID, run.Checklists[0].Items[0].AssigneePropertyFieldID)

		// Passing the playbook-level field ID must also succeed and must store the
		// run-level field ID (not the playbook-level one) on the item.
		err = e.PlaybooksClient.PlaybookRuns.SetItemPropertyUserAssignee(context.Background(), run.ID, 0, 0, playbookField.ID)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, runUserFieldID, run.Checklists[0].Items[0].AssigneePropertyFieldID)

		// A non-existent property field must not silently succeed; if dispatch
		// drops the field the handler would return 200 OK with no change.
		err = e.PlaybooksClient.PlaybookRuns.SetItemPropertyUserAssignee(context.Background(), run.ID, 0, 0, "nonexistent000000000000000")
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		// Field ID from the successful call must still be set (error did not reset it).
		assert.Equal(t, runUserFieldID, run.Checklists[0].Items[0].AssigneePropertyFieldID)
	})

	t.Run("invalid role assignee type rejected with 400", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		run = addSimpleChecklistToTun(t, run.ID)

		body, err := json.Marshal(map[string]string{
			"assignee_type": "member",
		})
		require.NoError(t, err)

		url := e.ServerClient.URL + "/plugins/" + manifest.Id + "/api/v0/runs/" + run.ID + "/checklists/0/item/0/assignee"
		resp, err := e.doPluginRequest(e.ServerClient, context.Background(), http.MethodPut, url, string(body), nil)
		require.Error(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("property field of non-user type rejected", func(t *testing.T) {
		e.SetEnterpriseLicence()

		freshPlaybookID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "PropType Test Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		require.NoError(t, err)

		selectField, err := e.PlaybooksClient.Playbooks.CreatePropertyField(
			context.Background(),
			freshPlaybookID,
			client.PropertyFieldRequest{
				Name: "Status",
				Type: "select",
				Attrs: &client.PropertyFieldAttrsInput{
					Options: &[]client.PropertyOptionInput{{Name: "Active"}},
				},
			},
		)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  freshPlaybookID,
		})
		require.NoError(t, err)
		run = addSimpleChecklistToTun(t, run.ID)

		err = e.PlaybooksClient.PlaybookRuns.SetItemPropertyUserAssignee(context.Background(), run.ID, 0, 0, selectField.ID)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Empty(t, run.Checklists[0].Items[0].AssigneePropertyFieldID)
	})

	t.Run("SetRoleAssignee creates AssigneeChanged timeline event", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		run = addSimpleChecklistToTun(t, run.ID)

		err = e.PlaybooksClient.PlaybookRuns.SetItemRoleAssignee(context.Background(), run.ID, 0, 0, app.AssigneeTypeOwner)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.NotEmpty(t, run.TimelineEvents)
		lastEvent := run.TimelineEvents[len(run.TimelineEvents)-1]
		assert.Equal(t, client.AssigneeChanged, lastEvent.EventType)
		assert.Equal(t, e.RegularUser.Id, lastEvent.SubjectUserID)
	})

	t.Run("SetPropertyUserAssignee creates AssigneeChanged timeline event", func(t *testing.T) {
		e.SetEnterpriseLicence()

		freshPlaybookID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "PropUser Timeline Test Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		require.NoError(t, err)

		_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(
			context.Background(),
			freshPlaybookID,
			client.PropertyFieldRequest{
				Name: "Manager",
				Type: "user",
			},
		)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  freshPlaybookID,
		})
		require.NoError(t, err)
		run = addSimpleChecklistToTun(t, run.ID)

		// Resolve the run-level copy of the "Manager" field.
		runFields, err := e.PlaybooksClient.PlaybookRuns.GetPropertyFields(context.Background(), run.ID)
		require.NoError(t, err)
		var runManagerFieldID string
		for _, f := range runFields {
			if f.Name == "Manager" && f.Type == "user" {
				runManagerFieldID = f.ID
				break
			}
		}
		require.NotEmpty(t, runManagerFieldID, "run-level 'Manager' user field not found")

		// Seed the Manager property so the assignee resolves to a known user.
		managerValue, err := json.Marshal(e.RegularUser.Id)
		require.NoError(t, err)
		_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(context.Background(), run.ID, runManagerFieldID,
			client.PropertyValueRequest{Value: managerValue})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.SetItemPropertyUserAssignee(context.Background(), run.ID, 0, 0, runManagerFieldID)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.NotEmpty(t, run.TimelineEvents)
		lastEvent := run.TimelineEvents[len(run.TimelineEvents)-1]
		assert.Equal(t, client.AssigneeChanged, lastEvent.EventType)
		assert.Equal(t, e.RegularUser.Id, lastEvent.SubjectUserID)
	})

	t.Run("mutually exclusive fields rejected with 400", func(t *testing.T) {
		e.SetEnterpriseLicence()

		// Create a playbook with a user-type property field so we have a valid field ID to use.
		mePbID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Mutual Exclusion Test Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		require.NoError(t, err)

		meField, err := e.PlaybooksClient.Playbooks.CreatePropertyField(
			context.Background(),
			mePbID,
			client.PropertyFieldRequest{Name: "Reviewer", Type: "user"},
		)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  mePbID,
		})
		require.NoError(t, err)
		run = addSimpleChecklistToTun(t, run.ID)

		url := e.ServerClient.URL + "/plugins/" + manifest.Id + "/api/v0/runs/" + run.ID + "/checklists/0/item/0/assignee"

		// assignee_id + assignee_type together must be rejected.
		body, err := json.Marshal(map[string]string{
			"assignee_id":   e.RegularUser.Id,
			"assignee_type": app.AssigneeTypeOwner,
		})
		require.NoError(t, err)
		resp, err := e.doPluginRequest(e.ServerClient, context.Background(), http.MethodPut, url, string(body), nil)
		require.Error(t, err)
		require.NotNil(t, resp)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		// assignee_id + assignee_property_field_id together must also be rejected.
		body2, err := json.Marshal(map[string]string{
			"assignee_id":                e.RegularUser.Id,
			"assignee_property_field_id": meField.ID,
		})
		require.NoError(t, err)
		resp2, err := e.doPluginRequest(e.ServerClient, context.Background(), http.MethodPut, url, string(body2), nil)
		require.Error(t, err)
		require.NotNil(t, resp2)
		assert.Equal(t, http.StatusBadRequest, resp2.StatusCode)
	})
}

// TestSetAssignee_ClearsRoleType verifies that calling SetItemAssignee with a concrete user ID
// on an item that previously had a role-based assignee type (owner / creator / property_user)
// clears AssigneeType and AssigneePropertyFieldID. Without this, the role badge would persist
// in the UI even though the user explicitly switched to a specific person.
func TestSetAssignee_ClearsRoleType(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createRunWithRoleItem := func(t *testing.T, assigneeType string) (*client.PlaybookRun, string) {
		t.Helper()
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Clear Role Type Playbook " + assigneeType,
			TeamID: e.BasicTeam.Id,
			Public: true,
			Checklists: []client.Checklist{
				{Title: "Tasks", Items: []client.ChecklistItem{
					{Title: "Role task", AssigneeType: assigneeType},
				}},
			},
		})
		require.NoError(t, err)
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Clear Role Type Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)
		return run, pbID
	}

	t.Run("SetAssignee on owner-type item clears assignee_type", func(t *testing.T) {
		run, _ := createRunWithRoleItem(t, app.AssigneeTypeOwner)
		require.Equal(t, app.AssigneeTypeOwner, run.Checklists[0].Items[0].AssigneeType)

		err := e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser.Id)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, "", run.Checklists[0].Items[0].AssigneeType,
			"AssigneeType must be cleared when switching from role to specific user")
		assert.Equal(t, e.RegularUser.Id, run.Checklists[0].Items[0].AssigneeID)
	})

	t.Run("SetAssignee on creator-type item clears assignee_type", func(t *testing.T) {
		run, _ := createRunWithRoleItem(t, app.AssigneeTypeCreator)
		require.Equal(t, app.AssigneeTypeCreator, run.Checklists[0].Items[0].AssigneeType)

		err := e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 0, e.RegularUser.Id)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, "", run.Checklists[0].Items[0].AssigneeType,
			"AssigneeType must be cleared when switching from creator role to specific user")
		assert.Equal(t, e.RegularUser.Id, run.Checklists[0].Items[0].AssigneeID)
	})
}

// TestSetAssignee_SiblingRoleTasksUnaffected verifies that editing one checklist item's
// assignee does not wipe the role metadata (assignee_type / assignee_property_field_id)
// from sibling items in the same checklist. This was a pre-existing bug: updating a single
// item's assignee would rewrite the whole checklist, losing role fields on other items.
func TestSetAssignee_SiblingRoleTasksUnaffected(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Sibling Role Preservation Playbook",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Checklists: []client.Checklist{
			{Title: "Tasks", Items: []client.ChecklistItem{
				{Title: "Owner task", AssigneeType: app.AssigneeTypeOwner},
				{Title: "Creator task", AssigneeType: app.AssigneeTypeCreator},
				{Title: "Plain task", AssigneeType: ""},
			}},
		},
	})
	require.NoError(t, err)

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Sibling Preservation Run",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  pbID,
	})
	require.NoError(t, err)
	require.Equal(t, app.AssigneeTypeOwner, run.Checklists[0].Items[0].AssigneeType)
	require.Equal(t, app.AssigneeTypeCreator, run.Checklists[0].Items[1].AssigneeType)

	// Edit the plain task (index 2) by assigning a specific user.
	err = e.PlaybooksClient.PlaybookRuns.SetItemAssignee(context.Background(), run.ID, 0, 2, e.RegularUser2.Id)
	require.NoError(t, err)

	run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
	require.NoError(t, err)

	assert.Equal(t, app.AssigneeTypeOwner, run.Checklists[0].Items[0].AssigneeType,
		"owner-type sibling must keep its assignee_type after a different item is edited")
	assert.Equal(t, e.RegularUser.Id, run.Checklists[0].Items[0].AssigneeID,
		"owner-type sibling must keep its resolved assignee_id")
	assert.Equal(t, app.AssigneeTypeCreator, run.Checklists[0].Items[1].AssigneeType,
		"creator-type sibling must keep its assignee_type after a different item is edited")
	assert.Equal(t, e.RegularUser.Id, run.Checklists[0].Items[1].AssigneeID,
		"creator-type sibling must keep its resolved assignee_id")
	assert.Equal(t, e.RegularUser2.Id, run.Checklists[0].Items[2].AssigneeID,
		"edited item must have the new assignee_id")
}

func TestChecklisItem_SetCommand(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Run name",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
	})
	require.NoError(t, err)
	require.Len(t, run.Checklists, 0)

	checklist := client.Checklist{
		Title: "Test Checklist",
		Items: []client.ChecklistItem{
			{
				Title: "Test Item",
			},
		},
	}

	err = e.PlaybooksClient.PlaybookRuns.CreateChecklist(context.Background(), run.ID, checklist)
	require.NoError(t, err)

	run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
	require.NoError(t, err)
	require.Len(t, run.Checklists, 1)
	require.Len(t, run.Checklists[0].Items, 1)

	t.Run("set command", func(t *testing.T) {
		// command and commandlastrun are not set (before)
		require.Empty(t, run.Checklists[0].Items[0].CommandLastRun)
		require.Empty(t, run.Checklists[0].Items[0].Command)

		// set command
		err = e.PlaybooksClient.PlaybookRuns.SetItemCommand(context.Background(), run.ID, 0, 0, "/playbook todo")
		require.NoError(t, err)

		// command and commandlastrun are set (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, "/playbook todo", run.Checklists[0].Items[0].Command)
		require.Equal(t, int64(0), run.Checklists[0].Items[0].CommandLastRun)
	})

	t.Run("run command", func(t *testing.T) {
		// command and commandlastrun are not set (before)
		require.Empty(t, run.Checklists[0].Items[0].CommandLastRun)

		// run command
		err = e.PlaybooksClient.PlaybookRuns.RunItemCommand(context.Background(), run.ID, 0, 0)
		require.NoError(t, err)

		// command and commandlastrun are set (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, "/playbook todo", run.Checklists[0].Items[0].Command)
		require.NotZero(t, run.Checklists[0].Items[0].CommandLastRun)
	})

	t.Run("can't run if not member", func(t *testing.T) {
		// run command
		err = e.PlaybooksClient2.PlaybookRuns.RunItemCommand(context.Background(), run.ID, 0, 0)
		require.Error(t, err)
	})

	t.Run("rerun command", func(t *testing.T) {
		lastRun := run.Checklists[0].Items[0].CommandLastRun

		// rerun command
		err = e.PlaybooksClient.PlaybookRuns.RunItemCommand(context.Background(), run.ID, 0, 0)
		require.NoError(t, err)

		// command and commandlastrun are set (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Less(t, lastRun, run.Checklists[0].Items[0].CommandLastRun)
	})

	t.Run("set a the same command", func(t *testing.T) {
		lastRun := run.Checklists[0].Items[0].CommandLastRun

		// set command
		err = e.PlaybooksClient.PlaybookRuns.SetItemCommand(context.Background(), run.ID, 0, 0, "/playbook todo")
		require.NoError(t, err)

		// command and commandlastrun are set (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, "/playbook todo", run.Checklists[0].Items[0].Command)
		require.Equal(t, lastRun, run.Checklists[0].Items[0].CommandLastRun)
	})

	t.Run("set a different command", func(t *testing.T) {
		// set command
		err = e.PlaybooksClient.PlaybookRuns.SetItemCommand(context.Background(), run.ID, 0, 0, "/playbook finish")
		require.NoError(t, err)

		// command and commandlastrun are set (after)
		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Equal(t, "/playbook finish", run.Checklists[0].Items[0].Command)
		require.Zero(t, run.Checklists[0].Items[0].CommandLastRun)
	})
}

func TestGetByChannelID(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("single run in channel", func(t *testing.T) {
		// Create a run
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Single run in channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Get the run by channel ID
		retrievedRun, err := e.PlaybooksClient.PlaybookRuns.GetByChannelID(context.Background(), run.ChannelID)
		require.NoError(t, err)
		require.NotNil(t, retrievedRun)
		require.Equal(t, run.ID, retrievedRun.ID)
	})

	t.Run("multiple runs in channel", func(t *testing.T) {
		// Create a channel
		channel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "Multiple Runs Channel",
			Name:        "multiple-runs-channel",
			Type:        model.ChannelTypeOpen,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Add user to channel
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), channel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		// Create first run with specific channel
		run1, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "First run in channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			ChannelID:   channel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run1)
		require.Equal(t, channel.Id, run1.ChannelID)

		// Create second run with same channel
		run2, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Second run in channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			ChannelID:   channel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run2)
		require.Equal(t, channel.Id, run2.ChannelID)

		// Try to get run by channel ID - should fail with multiple runs
		_, err = e.PlaybooksClient.PlaybookRuns.GetByChannelID(context.Background(), channel.Id)
		require.Error(t, err)
		require.Contains(t, err.Error(), "multiple runs in the channel")
	})

	t.Run("no run in channel", func(t *testing.T) {
		// Create a channel with no runs
		channel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "Empty Channel",
			Name:        "empty-channel",
			Type:        model.ChannelTypeOpen,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Add regular user to the channel so the ChannelView check passes
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), channel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		// Try to get run by channel ID - should fail with not found
		_, err = e.PlaybooksClient.PlaybookRuns.GetByChannelID(context.Background(), channel.Id)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Not found")
	})

	t.Run("With access to channel cannot access private playbook", func(t *testing.T) {
		// Create a private channel
		privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "Private Channel",
			Name:        "private-channel",
			Type:        model.ChannelTypePrivate,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Add user to channel
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), privateChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		// Create run in private channel, private playbook
		privatePlaybookID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "TestPrivatePlaybook custom",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run in private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybookID,
			ChannelID:   privateChannel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Equal(t, privateChannel.Id, run.ChannelID)

		// Try to get run by channel ID with a user who doesn't have access to channel or private playbook
		run, err = e.PlaybooksClient2.PlaybookRuns.GetByChannelID(context.Background(), privateChannel.Id)
		require.Error(t, err)
		require.Nil(t, run)
	})

	t.Run("no access to channel, public playbook", func(t *testing.T) {
		// Create a private channel
		privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "Private Channel-two",
			Name:        "private-channel-two",
			Type:        model.ChannelTypePrivate,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Add user to channel
		_, _, err = e.ServerAdminClient.AddChannelMember(context.Background(), privateChannel.Id, e.RegularUser.Id)
		require.NoError(t, err)

		// Create run in private channel
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run in private channel",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			ChannelID:   privateChannel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Equal(t, privateChannel.Id, run.ChannelID)

		// Try to get run by channel ID with a user who doesn't have access to channel
		// ChannelView permission check should block access even if the playbook is public
		_, err = e.PlaybooksClient2.PlaybookRuns.GetByChannelID(context.Background(), privateChannel.Id)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Not authorized")
	})

	t.Run("guest user cannot access public playbook run", func(t *testing.T) {
		// Create a run with a public playbook
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Public run for guest test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		e.CreateGuest()
		// Try to get run by channel ID with a guest user - guest lacks ChannelView permission
		_, err = e.PlaybooksClientGuest.PlaybookRuns.GetByChannelID(context.Background(), run.ChannelID)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Not authorized")
	})
}

func TestGetOwners(t *testing.T) {
	// GetOwners returns owners across all runs on the server, so this test
	// requires a globally-empty database.
	e := SetupIsolated(t)
	e.CreateBasic()

	ownerFromUser := func(u *model.User) client.OwnerInfo {
		return client.OwnerInfo{
			UserID:    u.Id,
			Username:  u.Username,
			FirstName: u.FirstName,
			LastName:  u.LastName,
			Nickname:  u.Nickname,
		}
	}

	_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Run name",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
	})
	require.NoError(t, err)

	_, err = e.PlaybooksClient2.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Run name",
		OwnerUserID: e.RegularUser2.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  e.BasicPlaybook.ID,
	})
	require.NoError(t, err)

	fullOwner1 := ownerFromUser(e.RegularUser)
	fullOwner2 := ownerFromUser(e.RegularUser2)
	partialOwner1 := fullOwner1
	partialOwner1.FirstName = ""
	partialOwner1.LastName = ""
	partialOwner2 := fullOwner2
	partialOwner2.FirstName = ""
	partialOwner2.LastName = ""
	for _, tc := range []struct {
		Name         string
		ShowFullName bool
		Client       *client.Client
		MustContain  []client.OwnerInfo
	}{
		{
			Name:         "showfullname set to true",
			ShowFullName: true,
			Client:       e.PlaybooksClient,
			MustContain:  []client.OwnerInfo{fullOwner1, fullOwner2},
		},
		{
			Name:         "showfullname set to false",
			ShowFullName: false,
			Client:       e.PlaybooksClient,
			MustContain:  []client.OwnerInfo{partialOwner1, partialOwner2},
		},
		{
			Name:         "showfullname set to false and sysadmin",
			ShowFullName: false,
			Client:       e.PlaybooksAdminClient,
			MustContain:  []client.OwnerInfo{fullOwner1, fullOwner2},
		},
	} {
		t.Run(tc.Name, func(t *testing.T) {
			cfg := e.Srv.Config()
			cfg.PrivacySettings.ShowFullName = testPtr(tc.ShowFullName)
			_, _, err = e.ServerAdminClient.UpdateConfig(context.Background(), cfg)
			require.NoError(t, err)

			owners, err := tc.Client.PlaybookRuns.GetOwners(context.Background())
			require.NoError(t, err)
			require.Len(t, owners, len(tc.MustContain))
			for _, mc := range tc.MustContain {
				require.Contains(t, owners, mc)
			}
		})
	}
}

func TestUpdatePlaybookRun(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("update run name", func(t *testing.T) {
		// Create a fresh run for this test
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Original Run Name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		originalName := testRun.Name
		newName := "Updated Run Name"

		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Name: &newName,
		})
		require.NoError(t, err)
		require.Equal(t, newName, updatedRun.Name)

		// Verify the update persisted
		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), testRun.ID)
		require.NoError(t, err)
		require.Equal(t, newName, run.Name)
		require.NotEqual(t, originalName, run.Name)
	})

	t.Run("update run name with empty string fails", func(t *testing.T) {
		emptyName := ""
		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), e.BasicRun.ID, client.PlaybookRunUpdateOptions{
			Name: &emptyName,
		})
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update run name with whitespace-only string fails", func(t *testing.T) {
		whitespaceName := "   \t  "
		_, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), e.BasicRun.ID, client.PlaybookRunUpdateOptions{
			Name: &whitespaceName,
		})
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update run name with name exceeding 64 characters succeeds", func(t *testing.T) {
		// Create a fresh run for this test
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Test Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		longName := strings.Repeat("a", 65) // 65 characters
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Name: &longName,
		})
		require.NoError(t, err)
		require.Equal(t, longName, updatedRun.Name)
	})

	t.Run("update finished run name fails", func(t *testing.T) {
		// Create and finish a run
		finishedRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run to finish",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), finishedRun.ID)
		require.NoError(t, err)

		newName := "Cannot update finished run"
		_, err = e.PlaybooksClient.PlaybookRuns.Update(context.Background(), finishedRun.ID, client.PlaybookRunUpdateOptions{
			Name: &newName,
		})
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update run without name field returns existing run", func(t *testing.T) {
		// Create a fresh run for this test
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Test Run Name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		originalName := testRun.Name

		// Update without name field
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, originalName, updatedRun.Name)
	})

	t.Run("update run summary", func(t *testing.T) {
		// Create a fresh run
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Test Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Equal(t, "", testRun.Summary) // Initially empty

		oldSummaryModifiedAt := testRun.SummaryModifiedAt

		newSummary := "## Incident Summary\n\nThis is a test description."
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Summary: &newSummary,
		})
		require.NoError(t, err)
		require.Equal(t, newSummary, updatedRun.Summary)
		require.Greater(t, updatedRun.SummaryModifiedAt, oldSummaryModifiedAt)

		// Verify persistence
		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), testRun.ID)
		require.NoError(t, err)
		require.Equal(t, newSummary, run.Summary)
	})

	t.Run("update run name and summary together", func(t *testing.T) {
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Original Name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		newName := "Updated Name"
		newSummary := "Updated description"
		oldSummaryModifiedAt := testRun.SummaryModifiedAt

		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Name:    &newName,
			Summary: &newSummary,
		})
		require.NoError(t, err)
		require.Equal(t, newName, updatedRun.Name)
		require.Equal(t, newSummary, updatedRun.Summary)
		require.Greater(t, updatedRun.SummaryModifiedAt, oldSummaryModifiedAt)
	})

	t.Run("update run with empty summary succeeds", func(t *testing.T) {
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Test Run",
			Summary:     "Initial description",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.Equal(t, "Initial description", testRun.Summary)

		emptySummary := ""
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Summary: &emptySummary,
		})
		require.NoError(t, err)
		require.Equal(t, "", updatedRun.Summary)

		// Verify persistence
		run, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), testRun.ID)
		require.NoError(t, err)
		require.Equal(t, "", run.Summary)
	})

	t.Run("update run summary trims whitespace", func(t *testing.T) {
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Test Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		summaryWithWhitespace := "  Test description  \n\t"
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Summary: &summaryWithWhitespace,
		})
		require.NoError(t, err)
		require.Equal(t, "Test description", updatedRun.Summary)
	})

	t.Run("update finished run summary fails", func(t *testing.T) {
		// Create and finish a run
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run to finish",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), testRun.ID)
		require.NoError(t, err)

		newSummary := "Updated description for finished run"
		_, err = e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Summary: &newSummary,
		})
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update name only does not change SummaryModifiedAt", func(t *testing.T) {
		testRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Original Name",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)

		oldSummaryModifiedAt := testRun.SummaryModifiedAt

		newName := "Updated Name"
		updatedRun, err := e.PlaybooksClient.PlaybookRuns.Update(context.Background(), testRun.ID, client.PlaybookRunUpdateOptions{
			Name: &newName,
		})
		require.NoError(t, err)
		require.Equal(t, newName, updatedRun.Name)
		require.Equal(t, oldSummaryModifiedAt, updatedRun.SummaryModifiedAt) // Should NOT change
	})

	t.Run("no permissions to update run", func(t *testing.T) {
		// Remove user from team to revoke permissions
		_, err := e.ServerAdminClient.RemoveTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)

		newName := "Should fail"
		_, err = e.PlaybooksClient.PlaybookRuns.Update(context.Background(), e.BasicRun.ID, client.PlaybookRunUpdateOptions{
			Name: &newName,
		})
		require.Error(t, err)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)

		// Restore team membership
		_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicRun.TeamID, e.RegularUser.Id)
		require.NoError(t, err)
	})

}

func TestRunGetMetadata(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("public - get metadata as participant", func(t *testing.T) {
		metadata, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), e.BasicRun.ID)
		require.NoError(t, err)
		assert.NotEmpty(t, metadata.ChannelName)
		assert.NotEmpty(t, metadata.ChannelDisplayName)
		assert.NotEmpty(t, metadata.TeamName)
	})

	t.Run("public - get metadata as non-member should hide channel info but include num participants", func(t *testing.T) {
		metadata, err := e.PlaybooksClient2.PlaybookRuns.GetMetadata(context.Background(), e.BasicRun.ID)
		require.NoError(t, err)
		assert.Empty(t, metadata.ChannelName)
		assert.Empty(t, metadata.ChannelDisplayName)
		assert.Zero(t, metadata.TotalPosts)
		assert.NotZero(t, metadata.NumParticipants) // Participants count should be included
		assert.NotEmpty(t, metadata.TeamName)       // Team name should still be available
	})

	t.Run("public - fails because not in team", func(t *testing.T) {
		metadata, err := e.PlaybooksClientNotInTeam.PlaybookRuns.GetMetadata(context.Background(), e.BasicRun.ID)
		require.Error(t, err)
		assert.Nil(t, metadata)
	})

	t.Run("private channel - get metadata as participant", func(t *testing.T) {
		// Create a run with private channel
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Private channel run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		require.NoError(t, err)

		metadata, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.NoError(t, err)
		assert.NotEmpty(t, metadata.ChannelName)
		assert.NotEmpty(t, metadata.ChannelDisplayName)
		assert.NotZero(t, metadata.NumParticipants)
		assert.NotEmpty(t, metadata.TeamName)
	})

	t.Run("private channel - get metadata as non-member should hide channel info but include participants", func(t *testing.T) {
		// Create private playbook and run
		privatePlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "TestPrivatePlaybook custom",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Private channel run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybookID,
		})
		require.NoError(t, err)

		// RegularUser2 is a playbook member but not channel member
		metadata, err := e.PlaybooksClient2.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.NoError(t, err)
		assert.Empty(t, metadata.ChannelName)
		assert.Empty(t, metadata.ChannelDisplayName)
		assert.Zero(t, metadata.TotalPosts)
		assert.NotZero(t, metadata.NumParticipants) // Number of participants should be included
		assert.NotEmpty(t, metadata.TeamName)       // Team name should still be available
	})

	t.Run("private channel - not a member of playbook", func(t *testing.T) {
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Private channel run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPrivatePlaybook.ID,
		})
		require.NoError(t, err)

		metadata, err := e.PlaybooksClient2.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.Error(t, err)
		assert.Nil(t, metadata)
	})

	t.Run("invalid run ID", func(t *testing.T) {
		metadata, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), "invalid_id")
		require.Error(t, err)
		assert.Nil(t, metadata)
	})
	t.Run("metadata filtering for different user roles", func(t *testing.T) {
		// Create a private playbook
		privatePlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Private Playbook for Metadata Test",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		// Create a playbook run with a private channel
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Private Run for Metadata Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybookID,
		})
		require.NoError(t, err)

		// 1. Test as channel member (owner) - should see all metadata
		metadata, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.NoError(t, err)
		require.NotEmpty(t, metadata.ChannelName)
		require.NotEmpty(t, metadata.ChannelDisplayName)
		require.NotEmpty(t, metadata.TeamName)
		// Total posts might be 0 at creation, but the field should exist
		require.Zero(t, metadata.TotalPosts)

		// Add RegularUser2 as a playbook member so they can access the run but not the channel
		playbook, err := e.PlaybooksClient.Playbooks.Get(context.Background(), privatePlaybookID)
		require.NoError(t, err)
		playbook.Members = append(playbook.Members, client.PlaybookMember{
			UserID: e.RegularUser2.Id,
			Roles:  []string{app.PlaybookRoleMember},
		})
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *playbook)
		require.NoError(t, err)

		// 2. Test as non-channel member but with run access
		metadata, err = e.PlaybooksClient2.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.NoError(t, err)
		// These fields should be empty/zero for non-channel members
		require.Empty(t, metadata.ChannelName)
		require.Empty(t, metadata.ChannelDisplayName)
		require.Zero(t, metadata.TotalPosts)
		// But team name should still be available
		require.NotEmpty(t, metadata.TeamName)
		// Followers should be accessible regardless of channel membership
		require.NotNil(t, metadata.Followers)

		// 3. Test with system admin - should still follow permission rules
		metadata, err = e.PlaybooksAdminClient.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.NoError(t, err)
		// Admin should have all info since they are a playbook member with channel access
		require.NotEmpty(t, metadata.ChannelName)
		require.NotEmpty(t, metadata.ChannelDisplayName)
		require.NotEmpty(t, metadata.TeamName)
	})

	t.Run("unable to access run metadata without permissions", func(t *testing.T) {
		// Create a private playbook with no members other than creator
		privatePlaybookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Restricted Private Playbook",
			TeamID: e.BasicTeam.Id,
			Public: false,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		// Create a run
		privateRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Restricted Private Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  privatePlaybookID,
		})
		require.NoError(t, err)

		// Test as non-member - should not be able to access metadata at all
		_, err = e.PlaybooksClient2.PlaybookRuns.GetMetadata(context.Background(), privateRun.ID)
		require.Error(t, err)
	})

	t.Run("DM checklist - TeamName is empty", func(t *testing.T) {
		dmChannel, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.RegularUser2.Id)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "DM Checklist",
			OwnerUserID: e.RegularUser.Id,
			PlaybookID:  "",
			ChannelID:   dmChannel.Id,
		})
		require.NoError(t, err)

		metadata, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Empty(t, metadata.TeamName, "DM checklist should have no TeamName")
		// DM channels store no display_name in the DB (it's computed client-side); the key assertion is TeamName == "".
		assert.Empty(t, metadata.ChannelDisplayName)
	})

	t.Run("GM checklist - TeamName is empty", func(t *testing.T) {
		gmChannel, _, err := e.ServerAdminClient.CreateGroupChannel(context.Background(), []string{e.RegularUser.Id, e.RegularUser2.Id, e.AdminUser.Id})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "GM Checklist",
			OwnerUserID: e.RegularUser.Id,
			PlaybookID:  "",
			ChannelID:   gmChannel.Id,
		})
		require.NoError(t, err)

		metadata, err := e.PlaybooksClient.PlaybookRuns.GetMetadata(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Empty(t, metadata.TeamName, "GM checklist should have no TeamName")
	})
}

// TestGuestCannotAccessPrivateChannelTasks tests that guests cannot access
// tasks from runs linked to private channels they don't have membership in.
// MM-65795
func TestGuestCannotAccessPrivateChannelTasks(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	e.CreateGuest()

	// Create a private channel that the guest is NOT a member of
	privateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
		TeamId:      e.BasicTeam.Id,
		Name:        "private-test-channel",
		DisplayName: "Private Test Channel",
		Type:        model.ChannelTypePrivate,
	})
	require.NoError(t, err)

	// Create a public playbook (guests should not see runs from it if they're not in the channel)
	publicPlaybook, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Public Playbook for Guest Test",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Checklists: []client.Checklist{
			{
				Title: "Test Checklist",
				Items: []client.ChecklistItem{
					{
						Title: "Sensitive Task",
					},
				},
			},
		},
	})
	require.NoError(t, err)

	// Create a run in the private channel that the guest is not a member of
	run, err := e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Run in Private Channel",
		OwnerUserID: e.AdminUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  publicPlaybook,
		ChannelID:   privateChannel.Id,
	})
	require.NoError(t, err)

	t.Run("guest cannot access run data through GetPlaybookRuns", func(t *testing.T) {
		// Guest should not see the run as they are not a member of the channel
		runs, err := e.PlaybooksClientGuest.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Verify the run from the private channel is not in the results
		for _, r := range runs.Items {
			assert.NotEqual(t, run.ID, r.ID, "Guest should not see run from private channel they are not a member of")
		}
	})

	t.Run("guest cannot access run in private channel even if they know the channel ID", func(t *testing.T) {
		// Try to get the run by channel ID - should fail with 404 (not 403) to avoid leaking channel existence
		_, err := e.PlaybooksClientGuest.PlaybookRuns.GetByChannelID(context.Background(), privateChannel.Id)
		require.Error(t, err, "Guest should not be able to access run in private channel")
		// Note: Returns 404 instead of 403 to avoid information disclosure about private channel existence
	})

	t.Run("guest cannot access run when channel is deleted or invalid", func(t *testing.T) {
		// Create another private channel
		anotherPrivateChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      e.BasicTeam.Id,
			Name:        "private-to-delete",
			DisplayName: "Private Channel To Delete",
			Type:        model.ChannelTypePrivate,
		})
		require.NoError(t, err)

		// Create a run in this channel
		runWithDeletedChannel, err := e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with Channel to be Deleted",
			OwnerUserID: e.AdminUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  publicPlaybook,
			ChannelID:   anotherPrivateChannel.Id,
		})
		require.NoError(t, err)

		// Delete the channel (this tests the edge case where ChannelId might reference a non-existent channel)
		_, err = e.ServerAdminClient.DeleteChannel(context.Background(), anotherPrivateChannel.Id)
		require.NoError(t, err)

		// Guest should still not be able to access the run even though the channel is deleted
		// The permission check should handle NULL/invalid channel IDs gracefully
		runs, err := e.PlaybooksClientGuest.PlaybookRuns.List(context.Background(), 0, 100, client.PlaybookRunListOptions{
			TeamID: e.BasicTeam.Id,
		})
		require.NoError(t, err)

		// Verify the run with the deleted channel is not in the results
		for _, r := range runs.Items {
			assert.NotEqual(t, runWithDeletedChannel.ID, r.ID, "Guest should not see run when associated channel is deleted")
		}

		// Also test direct access by run ID should fail
		_, err = e.PlaybooksClientGuest.PlaybookRuns.Get(context.Background(), runWithDeletedChannel.ID)
		require.Error(t, err, "Guest should not be able to directly access run with deleted channel")
	})
}

// TestMemberCannotCreateRunWithoutPlaybookIDToBypassPermissions tests that members
// cannot bypass run creation permissions by omitting the playbook_id.
// MM-66249
func TestMemberCannotCreateRunWithoutPlaybookIDToBypassPermissions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Get the default team member role
	roles, _, err := e.ServerAdminClient.GetRolesByNames(context.Background(), []string{"team_user"})
	require.NoError(t, err)
	require.Len(t, roles, 1)

	memberRole := roles[0]

	// Store original permissions for cleanup
	originalPermissions := memberRole.Permissions

	// Remove run_create permission
	updatedPermissions := []string{}
	for _, perm := range memberRole.Permissions {
		if perm != model.PermissionRunCreate.Id {
			updatedPermissions = append(updatedPermissions, perm)
		}
	}

	_, _, err = e.ServerAdminClient.PatchRole(context.Background(), memberRole.Id, &model.RolePatch{
		Permissions: &updatedPermissions,
	})
	require.NoError(t, err)

	// Clean up: restore permissions after test
	defer func() {
		_, _, _ = e.ServerAdminClient.PatchRole(context.Background(), memberRole.Id, &model.RolePatch{
			Permissions: &originalPermissions,
		})
	}()

	t.Run("member cannot create run without playbook_id and without channel_id", func(t *testing.T) {
		// No playbook and no channel: blocked (MM-66249 - no orphan runs; MM-67648 Option A requires channel)
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run without playbook",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  "",
			// No ChannelID - should fail with 403 (current) or 400 (Option A)
		})
		require.Error(t, err)
	})

	t.Run("member CAN still create run with playbook_id if they have playbook-level permission", func(t *testing.T) {
		// Even with team-level run_create removed, playbook-level permissions still work
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Run with playbook",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err, "Playbook-level permissions should still allow run creation")
	})

	t.Run("member CAN create run without playbook when providing ChannelID", func(t *testing.T) {
		// MM-67648: With ChannelID, channel permissions gate access; no run_create needed
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Channel checklist",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			ChannelID:   e.BasicPublicChannel.Id,
			PlaybookID:  "",
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		assert.Equal(t, app.RunTypeChannelChecklist, run.Type)
		assert.Equal(t, e.BasicPublicChannel.Id, run.ChannelID)
	})

	t.Run("member cannot create checklist in channel where they cannot post", func(t *testing.T) {
		// Create a channel but do not add RegularUser; they won't have CreatePost there.
		channel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			DisplayName: "No-post channel",
			Name:        "no-post-channel-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      e.BasicTeam.Id,
		})
		require.NoError(t, err)
		// Do not add RegularUser to the channel.
		_, err = e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Checklist in channel I cannot post to",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			ChannelID:   channel.Id,
			PlaybookID:  "",
		})
		require.Error(t, err, "creating a checklist in a channel where the user cannot post should fail")
	})
}

// TestCrossTeamRunCreationPermission verifies that a user cannot bypass team-level
// run_create permissions by referencing a playbook from a different team.
// MM-67867
func TestCrossTeamRunCreationPermission(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Remove run_create from the default team_user role so that team-level
	// permission is absent; only playbook-level membership grants run_create.
	roles, _, err := e.ServerAdminClient.GetRolesByNames(context.Background(), []string{model.TeamUserRoleId})
	require.NoError(t, err)
	require.Len(t, roles, 1)
	memberRole := roles[0]
	originalPermissions := memberRole.Permissions

	updatedPermissions := []string{}
	for _, perm := range memberRole.Permissions {
		if perm != model.PermissionRunCreate.Id {
			updatedPermissions = append(updatedPermissions, perm)
		}
	}
	_, _, err = e.ServerAdminClient.PatchRole(context.Background(), memberRole.Id, &model.RolePatch{
		Permissions: &updatedPermissions,
	})
	require.NoError(t, err)
	defer func() {
		_, _, _ = e.ServerAdminClient.PatchRole(context.Background(), memberRole.Id, &model.RolePatch{
			Permissions: &originalPermissions,
		})
	}()

	t.Run("same-team run creation still works via playbook membership", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Same-team run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
	})

	t.Run("cross-team run creation is blocked without target team permission", func(t *testing.T) {
		// BasicPlaybook belongs to BasicTeam. RegularUser has playbook-level
		// run_create via membership. But BasicTeam2 has no team-level run_create
		// (removed above) and no playbook-level grant, so this must fail.
		_, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Cross-team run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam2.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.Error(t, err, "should not be able to create a run in a team where user lacks run_create permission")
	})
}

// TestCrossTeamRunCreationWithPermission verifies that cross-team run creation
// succeeds when the user has run_create permission in the target team.
// By default team_user does not have run_create (it lives on playbook_member),
// so we grant it before any run creation to avoid role-cache timing issues.
// MM-67867
func TestCrossTeamRunCreationWithPermission(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Grant run_create at the team level before any run operations so the
	// server's role cache is primed before the plugin checks permissions.
	defaultRolePermissions := e.Permissions.SaveDefaultRolePermissions(t)
	defer e.Permissions.RestoreDefaultRolePermissions(t, defaultRolePermissions)
	e.Permissions.AddPermissionToRole(t, model.PermissionRunCreate.Id, model.TeamUserRoleId)

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Cross-team run with team-level permission",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam2.Id,
		PlaybookID:  e.BasicPlaybook.ID,
	})
	require.NoError(t, err, "cross-team run creation should succeed when user has run_create in the target team")
	require.NotNil(t, run)
	assert.Equal(t, e.BasicTeam2.Id, run.TeamID)
}

// playbookWithRetro is a minimal struct used to PUT a playbook body that includes
// retrospective_enabled, which is not present in the exported client.Playbook type.
type playbookWithRetro struct {
	client.Playbook
	RetrospectiveEnabled bool `json:"retrospective_enabled"`
}

// setRetrospectiveEnabledAsAdmin performs a raw PUT /plugins/playbooks/api/v0/playbooks/{id}
// with the retrospective_enabled flag set. Always acts as the system admin user.
func setRetrospectiveEnabledAsAdmin(t *testing.T, e *TestEnvironment, playbookID string, enabled bool) {
	t.Helper()

	pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
	require.NoError(t, err)

	body := playbookWithRetro{
		Playbook:             *pb,
		RetrospectiveEnabled: enabled,
	}
	bodyBytes, err := json.Marshal(body)
	require.NoError(t, err)

	siteURL := fmt.Sprintf("http://localhost:%v", e.A.Srv().ListenAddr.Port)
	endpoint := fmt.Sprintf("%s/plugins/playbooks/api/v0/playbooks/%s", siteURL, playbookID)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPut, endpoint, bytes.NewReader(bodyBytes))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Mattermost-User-ID", e.AdminUser.Id)
	req.Header.Set("Authorization", "Bearer "+e.ServerAdminClient.AuthToken)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("setRetrospectiveEnabledAsAdmin failed: status=%d body=%s", resp.StatusCode, string(body))
	}
}

// toggleRunRetrospective performs a raw PUT /plugins/playbooks/api/v0/runs/{runID}/retrospective-enabled
// as the given user, returning the HTTP status code.
func toggleRunRetrospective(t *testing.T, e *TestEnvironment, runID, userID, authToken string, enabled bool) int {
	t.Helper()

	bodyBytes, err := json.Marshal(map[string]bool{"retrospective_enabled": enabled})
	require.NoError(t, err)

	siteURL := fmt.Sprintf("http://localhost:%v", e.A.Srv().ListenAddr.Port)
	endpoint := fmt.Sprintf("%s/plugins/playbooks/api/v0/runs/%s/retrospective-enabled", siteURL, runID)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPut, endpoint, bytes.NewReader(bodyBytes))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Mattermost-User-ID", userID)
	req.Header.Set("Authorization", "Bearer "+authToken)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	return resp.StatusCode
}

// TestRunFinish_OwnerGroupOnlyActions tests the OwnerGroupOnlyActions playbook flag that restricts
// who is allowed to finish (end) a run.
func TestOwnerGroupOnlyActions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("owner can finish when OwnerGroupOnlyActions true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "OwnerGroupOnlyActions Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		// RegularUser is the run owner
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Owner Finish Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Owner finishes the run — should succeed
		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		finished, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, string(client.StatusFinished), finished.CurrentStatus)
	})

	t.Run("non-owner gets 403 on finish when OwnerGroupOnlyActions true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "OwnerGroupOnlyActions Playbook Non-Owner",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			// Invite RegularUser2 so they become a run participant. Without this, the
			// 403 below could come from the base participant check in
			// runManagePropertiesWithPlaybookRun rather than from the
			// OwnerGroupOnlyActions rule being tested.
			InvitedUserIDs:                          []string{e.RegularUser2.Id},
			InviteUsersEnabled:                      true,
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		// RegularUser is the run owner; RegularUser2 is a participant (via invite) but not the owner
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Non-Owner Finish Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Contains(t, run.ParticipantIDs, e.RegularUser2.Id, "RegularUser2 must be a run participant so the 403 proves OwnerGroupOnlyActions enforcement")

		// Non-owner (RegularUser2) tries to finish — should get 403
		err = e.PlaybooksClient2.PlaybookRuns.Finish(context.Background(), run.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("any participant can finish when OwnerGroupOnlyActions false", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "AnyFinish Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			InvitedUserIDs:                          []string{e.RegularUser2.Id},
			InviteUsersEnabled:                      true,
			OwnerGroupOnlyActions:                   false,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		// RegularUser is the owner; RegularUser2 will finish
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Any Participant Finish Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Contains(t, run.ParticipantIDs, e.RegularUser2.Id, "RegularUser2 must be a run participant for this test to prove the flag-disabled path is correct")

		// Non-owner participant can finish when OwnerGroupOnlyActions is false
		err = e.PlaybooksClient2.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		finished, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, string(client.StatusFinished), finished.CurrentStatus)
	})

	t.Run("admin can finish when OwnerGroupOnlyActions true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "AdminFinish Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		// RegularUser is the owner
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Admin Finish Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Admin can always finish even when OwnerGroupOnlyActions is true
		err = e.PlaybooksAdminClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		finished, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, string(client.StatusFinished), finished.CurrentStatus)
	})

	t.Run("playbook admin who is not a participant gets 403 on finish", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "PB Admin Not Participant Finish",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "PB Admin Not Participant Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Playbook admin (RegularUser2) who is NOT a participant is blocked by
		// checkEditPermissions middleware (RunManageProperties) — gets 403.
		err = e.PlaybooksClient2.PlaybookRuns.Finish(context.Background(), run.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("playbook admin who is not a participant CAN change owner when OwnerGroupOnlyActions is set", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "PB Admin Not Participant ChangeOwner",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "PB Admin Not Participant ChangeOwner Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.NotContains(t, run.ParticipantIDs, e.RegularUser2.Id, "RegularUser2 must NOT be a participant so the success proves the playbook-admin bypass path, not the participant path")
		require.NotContains(t, run.ParticipantIDs, e.AdminUser.Id, "AdminUser must NOT be a participant initially")

		// Playbook admin (RegularUser2) with OwnerGroupOnlyActions enabled can reassign ownership
		// to a different user as a handoff mechanism even when not a run participant.
		err = e.PlaybooksClient2.PlaybookRuns.ChangeOwner(context.Background(), run.ID, e.AdminUser.Id)
		require.NoError(t, err)

		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, e.AdminUser.Id, updated.OwnerUserID)
	})

	t.Run("playbook admin who is not a participant gets 403 on restore", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "PB Admin Not Participant Restore",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "PB Admin Not Participant Restore Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Owner finishes first
		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		// Playbook admin (RegularUser2) who is NOT a participant — blocked by middleware.
		err = e.PlaybooksClient2.PlaybookRuns.Restore(context.Background(), run.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("owner can restore when OwnerGroupOnlyActions true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "OwnerOnlyRestore Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Owner Restore Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Owner finishes first
		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		// Owner restores — should succeed
		err = e.PlaybooksClient.PlaybookRuns.Restore(context.Background(), run.ID)
		require.NoError(t, err)

		restored, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, string(client.StatusInProgress), restored.CurrentStatus)
	})

	t.Run("non-owner gets 403 on restore when OwnerGroupOnlyActions true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "NonOwnerRestore Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			// Invite RegularUser2 so they become a run participant; without this the
			// 403 could come from the base participant check rather than from the
			// OwnerGroupOnlyActions restore gate.
			InvitedUserIDs:                          []string{e.RegularUser2.Id},
			InviteUsersEnabled:                      true,
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Non-Owner Restore Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Contains(t, run.ParticipantIDs, e.RegularUser2.Id, "RegularUser2 must be a run participant so the 403 proves OwnerGroupOnlyActions enforcement")

		// Admin finishes the run so we can test restore
		err = e.PlaybooksAdminClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		// Non-owner tries to restore — should get 403
		err = e.PlaybooksClient2.PlaybookRuns.Restore(context.Background(), run.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("admin can restore when OwnerGroupOnlyActions true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "AdminRestore Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		// RegularUser is the owner
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Admin Restore Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Owner finishes first
		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		// Admin can always restore even when OwnerGroupOnlyActions is true
		err = e.PlaybooksAdminClient.PlaybookRuns.Restore(context.Background(), run.ID)
		require.NoError(t, err)

		restored, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, string(client.StatusInProgress), restored.CurrentStatus)
	})

	t.Run("owner can change owner when OwnerGroupOnlyActions true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "OwnerChangeOwner Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Change Owner by Owner",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Current owner changes owner to RegularUser2 — should succeed
		err = e.PlaybooksClient.PlaybookRuns.ChangeOwner(context.Background(), run.ID, e.RegularUser2.Id)
		require.NoError(t, err)

		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, e.RegularUser2.Id, updated.OwnerUserID)
	})

	t.Run("non-owner gets 403 on change-owner when OwnerGroupOnlyActions true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "NonOwnerChangeOwner Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			// Invite RegularUser2 so they become a run participant; without this the
			// 403 could come from the base participant check rather than from the
			// OwnerGroupOnlyActions change-owner gate.
			InvitedUserIDs:                          []string{e.RegularUser2.Id},
			InviteUsersEnabled:                      true,
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Change Owner by Non-Owner",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Contains(t, run.ParticipantIDs, e.RegularUser2.Id, "RegularUser2 must be a run participant so the 403 proves OwnerGroupOnlyActions enforcement")

		// Non-owner (RegularUser2) tries to change the owner — should get 403
		err = e.PlaybooksClient2.PlaybookRuns.ChangeOwner(context.Background(), run.ID, e.RegularUser2.Id)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("any participant can change owner when OwnerGroupOnlyActions false", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "AnyChangeOwner Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			InvitedUserIDs:                          []string{e.RegularUser2.Id},
			InviteUsersEnabled:                      true,
			OwnerGroupOnlyActions:                   false,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Any Participant Change Owner",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// Non-owner (RegularUser2) can change the owner when OwnerGroupOnlyActions is false
		err = e.PlaybooksClient2.PlaybookRuns.ChangeOwner(context.Background(), run.ID, e.RegularUser2.Id)
		require.NoError(t, err)

		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, e.RegularUser2.Id, updated.OwnerUserID)
	})

	t.Run("self-promotion blocked when OwnerGroupOnlyActions true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "SelfPromotion Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			InvitedUserIDs:                          []string{e.RegularUser2.Id},
			InviteUsersEnabled:                      true,
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Self Promotion Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Contains(t, run.ParticipantIDs, e.RegularUser2.Id, "RegularUser2 must be a run participant so the 403 proves OwnerGroupOnlyActions enforcement")

		// Non-owner (RegularUser2) tries to make themselves owner — should get 403
		err = e.PlaybooksClient2.PlaybookRuns.ChangeOwner(context.Background(), run.ID, e.RegularUser2.Id)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("ChangeOwner rejects new owner who is not a team member", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "NonTeamMember ChangeOwner Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "NonTeamMember ChangeOwner Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		// RegularUserNotInTeam is a valid Mattermost account but has no team membership.
		// Attempting to assign them as owner must be rejected — if it weren't, with
		// OwnerGroupOnlyActions=true they could hold owner status without channel access,
		// locking the run for all other participants.
		err = e.PlaybooksAdminClient.PlaybookRuns.ChangeOwner(context.Background(), run.ID, e.RegularUserNotInTeam.Id)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)

		// Owner must be unchanged.
		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, e.RegularUser.Id, updated.OwnerUserID)
	})

	t.Run("non-admin member cannot toggle OwnerGroupOnlyActions via playbook update", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "ToggleGate Non-Admin Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
		require.NoError(t, err)

		// RegularUser (non-admin member) tries to toggle the flag — should be blocked
		pb.OwnerGroupOnlyActions = true
		err = e.PlaybooksClient.Playbooks.Update(context.Background(), *pb)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("playbook admin can toggle OwnerGroupOnlyActions via playbook update", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "ToggleGate Admin Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
		})
		require.NoError(t, err)

		pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
		require.NoError(t, err)

		// Playbook admin (AdminUser via PlaybooksAdminClient) toggles the flag — should succeed
		pb.OwnerGroupOnlyActions = true
		err = e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
		require.NoError(t, err)

		updated, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), playbookID)
		require.NoError(t, err)
		assert.True(t, updated.OwnerGroupOnlyActions)
	})

	t.Run("non-owner cannot finish via status update dialog when OwnerGroupOnlyActions true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "StatusDialogFinish Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.RegularUser2.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			InvitedUserIDs:                          []string{e.RegularUser2.Id},
			InviteUsersEnabled:                      true,
			OwnerGroupOnlyActions:                   true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		// RegularUser is the owner; RegularUser2 is a participant but not the owner
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Status Dialog Finish Test",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Contains(t, run.ParticipantIDs, e.RegularUser2.Id, "RegularUser2 must be a participant so the 403 proves OwnerGroupOnlyActions enforcement")

		// Build an authenticated client for RegularUser2 to submit the dialog
		serverClient2 := model.NewAPIv4Client(e.ServerClient.URL)
		_, _, err = serverClient2.Login(context.Background(), e.RegularUser2.Email, testUserPassword)
		require.NoError(t, err)

		dialogRequest := model.SubmitDialogRequest{
			TeamId: e.BasicTeam.Id,
			UserId: e.RegularUser2.Id,
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldMessageKey:           "status update with finish",
				app.DialogFieldReminderInSecondsKey: "100000",
				app.DialogFieldFinishRun:            true,
			},
		}
		dialogRequestBytes, err := json.Marshal(dialogRequest)
		require.NoError(t, err)

		// Non-owner submitting the dialog with FinishRun=true should get 403
		result, err := e.doPluginRequest(serverClient2, context.Background(), "POST",
			serverClient2.URL+"/plugins/"+manifest.Id+"/api/v0/runs/"+run.ID+"/update-status-dialog",
			string(dialogRequestBytes), nil)
		require.Error(t, err)
		assert.Equal(t, http.StatusForbidden, result.StatusCode)

		// Run must remain active
		still, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, string(client.StatusInProgress), still.CurrentStatus)
	})
}

// TestRetrospective verifies retrospective toggle, run-creation inheritance, and finish behavior.
func TestRetrospective(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	createRunOwnedBy := func(t *testing.T, name, ownerID string) *client.PlaybookRun {
		t.Helper()
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  name + " Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)
		setRetrospectiveEnabledAsAdmin(t, e, playbookID, true)

		var creator *client.Client
		if ownerID == e.AdminUser.Id {
			creator = e.PlaybooksAdminClient
		} else {
			creator = e.PlaybooksClient
		}
		run, err := creator.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        name + " Run",
			OwnerUserID: ownerID,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.True(t, run.RetrospectiveEnabled, "run should start with retro enabled")
		return run
	}

	t.Run("owner can toggle retrospective off and it persists", func(t *testing.T) {
		run := createRunOwnedBy(t, "Owner Off", e.RegularUser.Id)

		status := toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, false)
		assert.Equal(t, http.StatusOK, status)

		fetched, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.False(t, fetched.RetrospectiveEnabled)
	})

	t.Run("owner can toggle retrospective back on", func(t *testing.T) {
		run := createRunOwnedBy(t, "Owner On", e.RegularUser.Id)

		// Disable first, then re-enable
		require.Equal(t, http.StatusOK, toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, false))
		require.Equal(t, http.StatusOK, toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, true))

		fetched, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.True(t, fetched.RetrospectiveEnabled)
	})

	t.Run("sysadmin can toggle a run they don't own", func(t *testing.T) {
		run := createRunOwnedBy(t, "Sysadmin Toggle", e.RegularUser.Id)

		status := toggleRunRetrospective(t, e, run.ID, e.AdminUser.Id, e.ServerAdminClient.AuthToken, false)
		assert.Equal(t, http.StatusOK, status)

		fetched, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.False(t, fetched.RetrospectiveEnabled)
	})

	t.Run("non-owner non-admin is forbidden", func(t *testing.T) {
		// Run is owned by AdminUser; RegularUser tries to toggle.
		run := createRunOwnedBy(t, "Non Owner Forbidden", e.AdminUser.Id)

		status := toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, false)
		assert.Equal(t, http.StatusForbidden, status)

		fetched, err := e.PlaybooksAdminClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.True(t, fetched.RetrospectiveEnabled, "retro must remain enabled after forbidden toggle attempt")
	})

	t.Run("disabled state persists after the run is finished", func(t *testing.T) {
		run := createRunOwnedBy(t, "Persist After Finish", e.RegularUser.Id)

		require.Equal(t, http.StatusOK, toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, false))

		require.NoError(t, e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID))

		fetched, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, app.StatusFinished, fetched.CurrentStatus)
		assert.False(t, fetched.RetrospectiveEnabled)
	})

	t.Run("toggling off creates a RetrospectiveDisabled timeline event", func(t *testing.T) {
		run := createRunOwnedBy(t, "Timeline Disable", e.RegularUser.Id)

		require.Equal(t, http.StatusOK, toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, false))

		fetched, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.NotEmpty(t, fetched.TimelineEvents)
		lastEvent := fetched.TimelineEvents[len(fetched.TimelineEvents)-1]
		assert.Equal(t, client.RetrospectiveDisabled, lastEvent.EventType)
		assert.Equal(t, e.RegularUser.Id, lastEvent.SubjectUserID)
	})

	t.Run("toggling on creates a RetrospectiveEnabled timeline event", func(t *testing.T) {
		run := createRunOwnedBy(t, "Timeline Enable", e.RegularUser.Id)

		// Disable first so we can test re-enable
		require.Equal(t, http.StatusOK, toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, false))
		require.Equal(t, http.StatusOK, toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, true))

		fetched, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.NotEmpty(t, fetched.TimelineEvents)
		lastEvent := fetched.TimelineEvents[len(fetched.TimelineEvents)-1]
		assert.Equal(t, client.RetrospectiveEnabled, lastEvent.EventType)
		assert.Equal(t, e.RegularUser.Id, lastEvent.SubjectUserID)
	})

	t.Run("idempotent: same value returns 200 and creates no new timeline event", func(t *testing.T) {
		run := createRunOwnedBy(t, "Idempotent Same Value", e.RegularUser.Id)

		// Run starts with retro enabled; count events before the no-op toggle
		before, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		eventCountBefore := len(before.TimelineEvents)

		// Toggle to the same value (enabled → enabled)
		status := toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, true)
		assert.Equal(t, http.StatusOK, status)

		after, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.True(t, after.RetrospectiveEnabled)
		assert.Equal(t, eventCountBefore, len(after.TimelineEvents), "no-op toggle must not create a timeline event")
	})

	t.Run("re-enabling on a finished unpublished run persists and creates timeline event", func(t *testing.T) {
		run := createRunOwnedBy(t, "Re-enable Finished", e.RegularUser.Id)

		// Disable retro, then finish the run (retro is off so no reminder fires on finish)
		require.Equal(t, http.StatusOK, toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, false))
		require.NoError(t, e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID))

		// Re-enable retro on the finished, unpublished run — exercises the scheduler
		// restart branch in ToggleRetrospectiveEnabled (playbook_run_service.go:1598-1608)
		require.Equal(t, http.StatusOK, toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, true))

		fetched, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Equal(t, app.StatusFinished, fetched.CurrentStatus)
		assert.True(t, fetched.RetrospectiveEnabled)
		require.NotEmpty(t, fetched.TimelineEvents)
		lastEvent := fetched.TimelineEvents[len(fetched.TimelineEvents)-1]
		assert.Equal(t, client.RetrospectiveEnabled, lastEvent.EventType)
	})

	t.Run("owner removed from channel is forbidden", func(t *testing.T) {
		run := createRunOwnedBy(t, "Ex-member Owner", e.RegularUser.Id)

		// Remove the owner from the run's channel; they remain OwnerUserID in the DB.
		_, err := e.ServerAdminClient.RemoveUserFromChannel(context.Background(), run.ChannelID, e.RegularUser.Id)
		require.NoError(t, err)

		status := toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, false)
		assert.Equal(t, http.StatusForbidden, status)

		fetched, err := e.PlaybooksAdminClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.True(t, fetched.RetrospectiveEnabled, "retro must remain enabled after forbidden toggle attempt")
	})

	t.Run("toggle is blocked on an archived channel", func(t *testing.T) {
		run := createRunOwnedBy(t, "Archived Channel", e.RegularUser.Id)

		// Archive the run's channel.
		_, err := e.ServerAdminClient.DeleteChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)

		// Non-admin owner is blocked by the archived-channel guard; sysadmins bypass it.
		statusOwner := toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, false)
		assert.Equal(t, http.StatusBadRequest, statusOwner)

		statusAdmin := toggleRunRetrospective(t, e, run.ID, e.AdminUser.Id, e.ServerAdminClient.AuthToken, false)
		assert.Equal(t, http.StatusOK, statusAdmin)
	})

	t.Run("re-enabling on a finished published run does not post a new reminder", func(t *testing.T) {
		run := createRunOwnedBy(t, "Re-enable Published", e.RegularUser.Id)

		// Finish the run with retro enabled — the initial reminder fires.
		require.NoError(t, e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID))

		// Publish the retrospective.
		require.NoError(t, e.PlaybooksClient.PlaybookRuns.PublishRetrospective(context.Background(), run.ID, e.RegularUser.Id, client.RetrospectiveUpdate{}))

		// Confirm the retrospective is now published.
		published, err := e.PlaybooksAdminClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.NotZero(t, published.RetrospectivePublishedAt, "retrospective must be published before this sub-test is meaningful")

		// Disable retro on the published run.
		require.Equal(t, http.StatusOK, toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, false))

		// Count retro reminder posts before re-enable.
		countRetroRemPosts := func() int {
			posts, _, err := e.ServerAdminClient.GetPostsForChannel(context.Background(), run.ChannelID, 0, 100, "", false, false)
			require.NoError(t, err)
			n := 0
			for _, p := range posts.Posts {
				if p.Type == "custom_retro_rem" || p.Type == "custom_retro_rem_first" {
					n++
				}
			}
			return n
		}
		countBefore := countRetroRemPosts()

		// Re-enable on a PUBLISHED run — must NOT post a new reminder.
		require.Equal(t, http.StatusOK, toggleRunRetrospective(t, e, run.ID, e.RegularUser.Id, e.ServerClient.AuthToken, true))

		countAfter := countRetroRemPosts()
		assert.Equal(t, countBefore, countAfter, "re-enabling on a published run must not post a new retrospective reminder")

		fetched, err := e.PlaybooksAdminClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.True(t, fetched.RetrospectiveEnabled)
	})

	t.Run("run inherits retrospective_enabled=false from playbook", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Retro Disabled Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		setRetrospectiveEnabledAsAdmin(t, e, playbookID, false)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Retro Disabled Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		fetched, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.False(t, fetched.RetrospectiveEnabled, "run should inherit retrospective_enabled=false from playbook")
	})

	t.Run("run inherits retrospective_enabled=true from playbook", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Retro Enabled Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)

		setRetrospectiveEnabledAsAdmin(t, e, playbookID, true)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Retro Enabled Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)

		fetched, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.True(t, fetched.RetrospectiveEnabled, "run should inherit retrospective_enabled=true from playbook")
	})

	t.Run("finishing a run with retrospective disabled posts no retro reminder", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "No Retro Finish Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
		})
		require.NoError(t, err)
		setRetrospectiveEnabledAsAdmin(t, e, playbookID, false)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "No Retro Finish Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.False(t, run.RetrospectiveEnabled)

		require.NoError(t, e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID))

		posts, _, err := e.ServerAdminClient.GetPostsForChannel(context.Background(), run.ChannelID, 0, 100, "", false, false)
		require.NoError(t, err)
		for _, p := range posts.Posts {
			assert.NotEqual(t, "custom_retro_rem_first", p.Type,
				"no retro reminder post expected when retrospective is disabled")
		}
	})
}

func TestAutoArchiveChannel(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("channel is archived after run finish when AutoArchiveChannel=true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Auto Archive Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
			AutoArchiveChannel:                      true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Auto Archive Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.NotEmpty(t, run.ChannelID)

		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		channel, _, err := e.ServerAdminClient.GetChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)
		assert.NotEqual(t, int64(0), channel.DeleteAt,
			"channel must be archived (DeleteAt != 0) after finishing a run with AutoArchiveChannel=true")

		assertHasTimelineEvent(t, e.PlaybooksClient, run.ID, client.ChannelArchived)
	})

	t.Run("channel is not archived after run finish when AutoArchiveChannel=false", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "No Auto Archive Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
			AutoArchiveChannel:                      false,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "No Auto Archive Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.NotEmpty(t, run.ChannelID)

		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		channel, _, err := e.ServerAdminClient.GetChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), channel.DeleteAt,
			"channel must not be archived after finishing a run with AutoArchiveChannel=false")

		assertNoTimelineEvent(t, e.PlaybooksClient, run.ID, client.ChannelArchived)
	})

	t.Run("linked channel is not archived after run finish even when AutoArchiveChannel=true", func(t *testing.T) {
		// Create a pre-existing channel to link to the run.
		existingChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      e.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "existing-channel-" + model.NewId(),
			DisplayName: "Existing Channel",
		})
		require.NoError(t, err)

		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Auto Archive Linked Channel Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun: true,
			AutoArchiveChannel:      true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Auto Archive Linked Channel Run",
			OwnerUserID: e.AdminUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
			ChannelID:   existingChannel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.Equal(t, existingChannel.Id, run.ChannelID)

		err = e.PlaybooksAdminClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		channel, _, err := e.ServerAdminClient.GetChannel(context.Background(), existingChannel.Id)
		require.NoError(t, err)
		assert.Equal(t, int64(0), channel.DeleteAt,
			"pre-existing linked channel must not be archived even when AutoArchiveChannel=true")

		assertNoTimelineEvent(t, e.PlaybooksAdminClient, run.ID, client.ChannelArchived)
	})

	t.Run("channel swapped via UpdateRun is not archived after run finish", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Auto Archive Swap Channel Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun: true,
			AutoArchiveChannel:      true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksAdminClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Auto Archive Swap Channel Run",
			OwnerUserID: e.AdminUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		originalChannelID := run.ChannelID

		victimChannel, _, err := e.ServerAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      e.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			Name:        "victim-channel-" + model.NewId(),
			DisplayName: "Victim Channel",
		})
		require.NoError(t, err)

		resp, err := updateRun(e.PlaybooksAdminClient, run.ID, map[string]interface{}{
			"channelID": victimChannel.Id,
		})
		require.NoError(t, err)
		require.Empty(t, resp.Errors)

		err = e.PlaybooksAdminClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		// ChannelCreatedByRun was cleared when ChannelID was swapped, so auto-archive must not fire.
		channel, _, err := e.ServerAdminClient.GetChannel(context.Background(), victimChannel.Id)
		require.NoError(t, err)
		assert.Equal(t, int64(0), channel.DeleteAt,
			"victim channel must not be archived after ChannelID was swapped via UpdateRun")

		origChannel, _, err := e.ServerAdminClient.GetChannel(context.Background(), originalChannelID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), origChannel.DeleteAt,
			"original channel must not be archived after ChannelID was swapped away")

		assertNoTimelineEvent(t, e.PlaybooksAdminClient, run.ID, client.ChannelArchived)
	})

	t.Run("channel is unarchived after run restore when AutoArchiveChannel=true", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Auto Archive Restore Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
			AutoArchiveChannel:                      true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Auto Archive Restore Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.NotEmpty(t, run.ChannelID)

		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		channel, _, err := e.ServerAdminClient.GetChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)
		require.NotEqual(t, int64(0), channel.DeleteAt,
			"channel must be archived before restore")

		err = e.PlaybooksClient.PlaybookRuns.Restore(context.Background(), run.ID)
		require.NoError(t, err)

		channel, _, err = e.ServerAdminClient.GetChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), channel.DeleteAt,
			"channel must be unarchived (DeleteAt == 0) after restoring a run with AutoArchiveChannel=true")

		assertHasTimelineEvent(t, e.PlaybooksClient, run.ID, client.ChannelUnarchived)
	})

	t.Run("channel is not touched after run restore when AutoArchiveChannel=false", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "No Auto Archive Restore Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
			AutoArchiveChannel:                      false,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "No Auto Archive Restore Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		require.NotEmpty(t, run.ChannelID)

		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		err = e.PlaybooksClient.PlaybookRuns.Restore(context.Background(), run.ID)
		require.NoError(t, err)

		channel, _, err := e.ServerAdminClient.GetChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), channel.DeleteAt,
			"channel must remain unarchived after restoring a run that was not auto-archived")

		assertNoTimelineEvent(t, e.PlaybooksClient, run.ID, client.ChannelUnarchived)
	})

	t.Run("manual unarchive before restore clears AutoArchivedChannel so next finish re-archives", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Auto Archive Manual Unarchive Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Members: []client.PlaybookMember{
				{UserID: e.RegularUser.Id, Roles: []string{app.PlaybookRoleMember}},
				{UserID: e.AdminUser.Id, Roles: []string{app.PlaybookRoleAdmin, app.PlaybookRoleMember}},
			},
			CreatePublicPlaybookRun:                 true,
			CreateChannelMemberOnNewParticipant:     true,
			RemoveChannelMemberOnRemovedParticipant: true,
			AutoArchiveChannel:                      true,
		})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Auto Archive Manual Unarchive Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.NotEmpty(t, run.ChannelID)

		// Finish the run — channel gets auto-archived.
		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		channel, _, err := e.ServerAdminClient.GetChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)
		require.NotEqual(t, int64(0), channel.DeleteAt, "channel must be archived before manual unarchive")

		// Manually unarchive the channel (simulating an admin un-archiving outside of Playbooks).
		_, _, err = e.ServerAdminClient.RestoreChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)

		channel, _, err = e.ServerAdminClient.GetChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)
		require.Equal(t, int64(0), channel.DeleteAt, "channel must be unarchived after manual restore")

		// Restore the run — even though the channel was already unarchived manually, the run
		// must restore cleanly and clear AutoArchivedChannel so the next finish starts fresh.
		err = e.PlaybooksClient.PlaybookRuns.Restore(context.Background(), run.ID)
		require.NoError(t, err)

		channel, _, err = e.ServerAdminClient.GetChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), channel.DeleteAt,
			"channel must remain unarchived after run restore (it was already unarchived manually)")

		// Finish the run a second time — auto-archive must trigger again.
		err = e.PlaybooksClient.PlaybookRuns.Finish(context.Background(), run.ID)
		require.NoError(t, err)

		channel, _, err = e.ServerAdminClient.GetChannel(context.Background(), run.ChannelID)
		require.NoError(t, err)
		assert.NotEqual(t, int64(0), channel.DeleteAt,
			"channel must be archived again on second finish — AutoArchivedChannel flag was correctly cleared on restore")
	})
}

// assertHasTimelineEvent fetches the run and asserts that at least one timeline event of the
// given type exists.
func assertHasTimelineEvent(t *testing.T, c *client.Client, runID string, eventType client.TimelineEventType) {
	t.Helper()
	run, err := c.PlaybookRuns.Get(context.Background(), runID)
	require.NoError(t, err)
	for _, ev := range run.TimelineEvents {
		if ev.EventType == eventType {
			return
		}
	}
	assert.Failf(t, "missing timeline event", "expected a %q timeline event on run %s", eventType, runID)
}

// assertNoTimelineEvent fetches the run and asserts that no timeline event of the given type
// exists.
func assertNoTimelineEvent(t *testing.T, c *client.Client, runID string, eventType client.TimelineEventType) {
	t.Helper()
	run, err := c.PlaybookRuns.Get(context.Background(), runID)
	require.NoError(t, err)
	for _, ev := range run.TimelineEvents {
		if ev.EventType == eventType {
			assert.Failf(t, "unexpected timeline event", "did not expect a %q timeline event on run %s", eventType, runID)
			return
		}
	}
}

// TestRunCreationFromPlaybook_AssigneeTypePropagation verifies that checklist items
// with role-based AssigneeType (owner, creator) are copied from the playbook template
// to the run, and that their AssigneeID is resolved to the concrete user at creation time.
func TestRunCreationFromPlaybook_AssigneeTypePropagation(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("assignee types propagated from template", func(t *testing.T) {
		playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Role Assignee Template Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
			Checklists: []client.Checklist{
				{
					Title: "Tasks",
					Items: []client.ChecklistItem{
						{Title: "Explicit user task", AssigneeType: ""},
						{Title: "Owner task", AssigneeType: app.AssigneeTypeOwner},
						{Title: "Creator task", AssigneeType: app.AssigneeTypeCreator},
					},
				},
			},
		})
		require.NoError(t, err)

		// Create the run as RegularUser (creator) with AdminUser as the explicit owner,
		// so owner and creator resolve to distinct IDs and both paths are independently verified.
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Role Assignee Run",
			OwnerUserID: e.AdminUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  playbookID,
		})
		require.NoError(t, err)
		require.Len(t, run.Checklists, 1)
		require.Len(t, run.Checklists[0].Items, 3)

		explicit := run.Checklists[0].Items[0]
		ownerItem := run.Checklists[0].Items[1]
		creatorItem := run.Checklists[0].Items[2]

		assert.Equal(t, "", explicit.AssigneeType)
		assert.Empty(t, explicit.AssigneeID)

		assert.Equal(t, app.AssigneeTypeOwner, ownerItem.AssigneeType)
		assert.Equal(t, e.AdminUser.Id, ownerItem.AssigneeID,
			"owner-type item must be resolved to the run owner at creation time")

		assert.Equal(t, app.AssigneeTypeCreator, creatorItem.AssigneeType)
		assert.Equal(t, e.RegularUser.Id, creatorItem.AssigneeID,
			"creator-type item must be resolved to the run creator at creation time")
	})

	t.Run("owner falls back to creator when not provided", func(t *testing.T) {
		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Ownerless Run",
			OwnerUserID: "", // intentionally empty — should fall back to creator
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
		})
		require.NoError(t, err)
		assert.Equal(t, e.RegularUser.Id, run.OwnerUserID,
			"owner must fall back to the creator when OwnerUserID is not provided")
	})
}

// TestRunCreationFromPlaybook_PropertyUserAssigneeType verifies that a checklist item
// with AssigneeType "property_user" is carried over from the playbook template to the
// run, with AssigneePropertyFieldID remapped to the run-level field copy.
// At creation time no property value exists yet, so AssigneeID starts empty.
// It is resolved later when someone sets the property value via SetRunPropertyValue.
func TestRunCreationFromPlaybook_PropertyUserAssigneeType(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	e.SetEnterpriseLicence()

	// Create a playbook with a user-type property field and a property_user checklist item.
	pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Property User Assignee Playbook",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)

	pbField, err := e.PlaybooksAdminClient.Playbooks.CreatePropertyField(
		context.Background(),
		pbID,
		client.PropertyFieldRequest{Name: "Reviewer", Type: "user"},
	)
	require.NoError(t, err)

	// Update the playbook to add a checklist item that references the new field.
	pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pbID)
	require.NoError(t, err)
	pb.Checklists = []client.Checklist{
		{
			Title: "Tasks",
			Items: []client.ChecklistItem{
				{
					Title:                   "Review task",
					AssigneeType:            app.AssigneeTypePropertyUser,
					AssigneePropertyFieldID: pbField.ID,
				},
			},
		},
	}
	err = e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
	require.NoError(t, err)

	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Property User Run",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  pbID,
	})
	require.NoError(t, err)
	require.Len(t, run.Checklists, 1)
	require.Len(t, run.Checklists[0].Items, 1)

	item := run.Checklists[0].Items[0]
	assert.Equal(t, app.AssigneeTypePropertyUser, item.AssigneeType,
		"AssigneeType must be preserved from playbook template")
	assert.NotEmpty(t, item.AssigneePropertyFieldID,
		"AssigneePropertyFieldID must be remapped to the run-level field copy")
	assert.NotEqual(t, pbField.ID, item.AssigneePropertyFieldID,
		"run-level field ID must differ from the playbook-level field ID")
	assert.Empty(t, item.AssigneeID,
		"AssigneeID starts empty at creation — resolved later when a property value is set")
}

// TestDMGMChannelSupport verifies the gate that rejects playbook runs (PlaybookID != "")
// in DM/GM channels while allowing plain checklists (PlaybookID == "") in the same channels.
// MM-66962
func TestDMGMChannelSupport(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("playbook run rejected in DM channel", func(t *testing.T) {
		dmChannel, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.RegularUser2.Id)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "playbook run in DM",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			ChannelID:   dmChannel.Id,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		assert.Nil(t, run)
	})

	t.Run("checklist accepted in DM channel", func(t *testing.T) {
		dmChannel, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.RegularUser2.Id)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "checklist in DM",
			OwnerUserID: e.RegularUser.Id,
			PlaybookID:  "",
			ChannelID:   dmChannel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		assert.Equal(t, dmChannel.Id, run.ChannelID)
	})

	t.Run("playbook run rejected in GM channel", func(t *testing.T) {
		gmChannel, _, err := e.ServerAdminClient.CreateGroupChannel(context.Background(), []string{e.RegularUser.Id, e.RegularUser2.Id, e.AdminUser.Id})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "playbook run in GM",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  e.BasicPlaybook.ID,
			ChannelID:   gmChannel.Id,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		assert.Nil(t, run)
	})

	t.Run("checklist accepted in GM channel", func(t *testing.T) {
		gmChannel, _, err := e.ServerAdminClient.CreateGroupChannel(context.Background(), []string{e.RegularUser.Id, e.RegularUser2.Id, e.AdminUser.Id})
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "checklist in GM",
			OwnerUserID: e.RegularUser.Id,
			PlaybookID:  "",
			ChannelID:   gmChannel.Id,
		})
		require.NoError(t, err)
		require.NotNil(t, run)
		assert.Equal(t, gmChannel.Id, run.ChannelID)
	})
}

func TestDMGMParticipants(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("DM channel member can be added as run participant", func(t *testing.T) {
		dmChannel, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.RegularUser2.Id)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "DM Checklist",
			OwnerUserID: e.RegularUser.Id,
			PlaybookID:  "",
			ChannelID:   dmChannel.Id,
		})
		require.NoError(t, err)

		resp, err := addParticipants(e.PlaybooksClient, run.ID, []string{e.RegularUser2.Id})
		require.NoError(t, err)
		assert.Empty(t, resp.Errors)

		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Contains(t, updated.ParticipantIDs, e.RegularUser2.Id)
	})

	t.Run("user not in DM channel is silently excluded from participants", func(t *testing.T) {
		// DM between RegularUser and RegularUser2 only — AdminUser is not a member
		dmChannel, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.RegularUser2.Id)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "DM Checklist",
			OwnerUserID: e.RegularUser.Id,
			PlaybookID:  "",
			ChannelID:   dmChannel.Id,
		})
		require.NoError(t, err)

		resp, err := addParticipants(e.PlaybooksClient, run.ID, []string{e.AdminUser.Id})
		require.NoError(t, err)
		assert.Empty(t, resp.Errors, "request itself should succeed")

		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.NotContains(t, updated.ParticipantIDs, e.AdminUser.Id, "non-DM-member should not be added as participant")
	})

	t.Run("removing participant from DM run does not remove DM channel membership", func(t *testing.T) {
		dmChannel, _, err := e.ServerAdminClient.CreateDirectChannel(context.Background(), e.RegularUser.Id, e.RegularUser2.Id)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "DM Checklist",
			OwnerUserID: e.RegularUser.Id,
			PlaybookID:  "",
			ChannelID:   dmChannel.Id,
		})
		require.NoError(t, err)

		resp, err := addParticipants(e.PlaybooksClient, run.ID, []string{e.RegularUser2.Id})
		require.NoError(t, err)
		require.Empty(t, resp.Errors)

		resp, err = removeParticipants(e.PlaybooksClient, run.ID, []string{e.RegularUser2.Id})
		require.NoError(t, err)
		assert.Empty(t, resp.Errors)

		updated, err := e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.NotContains(t, updated.ParticipantIDs, e.RegularUser2.Id, "user should no longer be a run participant")

		// DM membership is implicit — user should still be in the DM channel
		members, _, err := e.ServerAdminClient.GetChannelMembers(context.Background(), dmChannel.Id, 0, 100, "")
		require.NoError(t, err)
		memberIDs := make([]string, len(members))
		for i, m := range members {
			memberIDs[i] = m.UserId
		}
		assert.Contains(t, memberIDs, e.RegularUser2.Id, "DM membership should not be removed when leaving the run")
	})
}

// TestChangeOwner_EmitsAssigneeChangedForOwnerRoleTasks verifies that changing the run owner
// creates AssigneeChanged timeline events for every checklist item whose assignee type is
// AssigneeTypeOwner (i.e., those that track the run owner automatically).
func TestChangeOwner_EmitsAssigneeChangedForOwnerRoleTasks(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Create a playbook whose template has one owner-role task and one regular task.
	playbookID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Owner Role Task Playbook",
		TeamID: e.BasicTeam.Id,
		Public: true,
		Checklists: []client.Checklist{
			{
				Title: "Tasks",
				Items: []client.ChecklistItem{
					{Title: "Owner task", AssigneeType: app.AssigneeTypeOwner},
					{Title: "Regular task", AssigneeType: ""},
				},
			},
		},
	})
	require.NoError(t, err)

	// Create the run as RegularUser with AdminUser as owner so they are distinct.
	run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
		Name:        "Owner Change Run",
		OwnerUserID: e.AdminUser.Id,
		TeamID:      e.BasicTeam.Id,
		PlaybookID:  playbookID,
	})
	require.NoError(t, err)
	require.Equal(t, e.AdminUser.Id, run.OwnerUserID)

	eventCountBefore := len(run.TimelineEvents)

	// Change owner: RegularUser (actor) changes owner from AdminUser to RegularUser2 (new owner).
	// Using three distinct users makes the SubjectUserID/CreatorUserID assertions discriminating.
	err = e.PlaybooksClient.PlaybookRuns.ChangeOwner(context.Background(), run.ID, e.RegularUser2.Id)
	require.NoError(t, err)

	run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
	require.NoError(t, err)
	require.Equal(t, e.RegularUser2.Id, run.OwnerUserID)

	// Expect one OwnerChanged event plus one AssigneeChanged event for the owner-role task.
	newEvents := run.TimelineEvents[eventCountBefore:]
	var ownerChangedCount, assigneeChangedCount int
	var ownerChangedEvent client.TimelineEvent
	for _, ev := range newEvents {
		switch ev.EventType {
		case client.OwnerChanged:
			ownerChangedCount++
			ownerChangedEvent = ev
		case client.AssigneeChanged:
			assigneeChangedCount++
		}
	}
	assert.Equal(t, 1, ownerChangedCount, "expected exactly one OwnerChanged event")
	assert.Equal(t, 1, assigneeChangedCount, "expected one AssigneeChanged event for the owner-role task")
	// Regression: SubjectUserID must be the NEW owner; CreatorUserID must be the actor (distinct from new owner).
	assert.Equal(t, e.RegularUser2.Id, ownerChangedEvent.SubjectUserID,
		"OwnerChanged SubjectUserID must be the new owner")
	assert.Equal(t, e.RegularUser.Id, ownerChangedEvent.CreatorUserID,
		"OwnerChanged CreatorUserID must be the actor who triggered the change")

	// The owner-role task must be re-assigned to the new owner.
	ownerItem := run.Checklists[0].Items[0]
	assert.Equal(t, e.RegularUser2.Id, ownerItem.AssigneeID,
		"owner-role item must be re-assigned to the new owner")
	// The regular task must be unaffected.
	regularItem := run.Checklists[0].Items[1]
	assert.Empty(t, regularItem.AssigneeID,
		"non-owner-role item must be unaffected by the owner change")
}

// TestSetRunPropertyValue_UserField covers three related scenarios for user-type property
// fields under a single server setup (enterprise license required for property fields).
func TestSetRunPropertyValue_UserField(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()
	e.SetEnterpriseLicence()

	// re-resolves: verifies the wiring from SetRunPropertyValue →
	// resolvePropertyUserAssignmentsFromRun → store update.
	// Unit tests in task_assignment_test.go cover the helper in isolation; this
	// integration test proves the full service path is connected.
	t.Run("re-resolves property_user tasks on value change", func(t *testing.T) {
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Property Re-resolve Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		require.NoError(t, err)

		pbField, err := e.PlaybooksAdminClient.Playbooks.CreatePropertyField(
			context.Background(),
			pbID,
			client.PropertyFieldRequest{Name: "Manager", Type: "user"},
		)
		require.NoError(t, err)

		pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pbID)
		require.NoError(t, err)
		pb.Checklists = []client.Checklist{
			{
				Title: "Tasks",
				Items: []client.ChecklistItem{
					{
						Title:                   "Manager task",
						AssigneeType:            app.AssigneeTypePropertyUser,
						AssigneePropertyFieldID: pbField.ID,
					},
				},
			},
		}
		err = e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Property Re-resolve Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		runFields, err := e.PlaybooksClient.PlaybookRuns.GetPropertyFields(context.Background(), run.ID)
		require.NoError(t, err)
		var runManagerFieldID string
		for _, f := range runFields {
			if f.Name == "Manager" && f.Type == "user" {
				runManagerFieldID = f.ID
				break
			}
		}
		require.NotEmpty(t, runManagerFieldID, "run-level Manager field not found")

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		assert.Empty(t, run.Checklists[0].Items[0].AssigneeID, "AssigneeID starts empty before any property value is set")

		_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(
			context.Background(),
			run.ID,
			runManagerFieldID,
			client.PropertyValueRequest{Value: []byte(`"` + e.AdminUser.Id + `"`)},
		)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		item := run.Checklists[0].Items[0]
		assert.Equal(t, e.AdminUser.Id, item.AssigneeID,
			"AssigneeID must be resolved to AdminUser after setting Manager property")
		assert.Equal(t, app.AssigneeTypePropertyUser, item.AssigneeType,
			"AssigneeType must be preserved as property_user after resolution")

		_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(
			context.Background(),
			run.ID,
			runManagerFieldID,
			client.PropertyValueRequest{Value: []byte(`"` + e.RegularUser2.Id + `"`)},
		)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		item = run.Checklists[0].Items[0]
		assert.Equal(t, e.RegularUser2.Id, item.AssigneeID,
			"AssigneeID must re-resolve to RegularUser2 after Manager property change")
		assert.Equal(t, app.AssigneeTypePropertyUser, item.AssigneeType,
			"AssigneeType must remain property_user after re-resolution")
	})

	// rejects non-team-member: without this guard, an attacker with property-write access
	// could add arbitrary users as run participants via addAssigneeParticipantAndDM.
	t.Run("rejects non-team-member", func(t *testing.T) {
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Non-member Rejection Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		require.NoError(t, err)

		_, err = e.PlaybooksAdminClient.Playbooks.CreatePropertyField(
			context.Background(),
			pbID,
			client.PropertyFieldRequest{Name: "Assignee", Type: "user"},
		)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Non-member Rejection Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		runFields, err := e.PlaybooksClient.PlaybookRuns.GetPropertyFields(context.Background(), run.ID)
		require.NoError(t, err)
		var runFieldID string
		for _, f := range runFields {
			if f.Name == "Assignee" && f.Type == "user" {
				runFieldID = f.ID
				break
			}
		}
		require.NotEmpty(t, runFieldID, "run-level Assignee field not found")

		outsider, _, err := e.ServerAdminClient.CreateUser(context.Background(), &model.User{
			Email:    "outsider-" + model.NewId() + "@example.com",
			Username: "outsider" + model.NewId(),
			Password: testUserPassword,
		})
		require.NoError(t, err)

		_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(
			context.Background(),
			run.ID,
			runFieldID,
			client.PropertyValueRequest{Value: []byte(`"` + outsider.Id + `"`)},
		)
		require.Error(t, err, "setting a user-type property to a non-team-member must be rejected")

		_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(
			context.Background(),
			run.ID,
			runFieldID,
			client.PropertyValueRequest{Value: []byte(`"` + e.AdminUser.Id + `"`)},
		)
		require.NoError(t, err, "setting a user-type property to a team member must succeed")
	})

	// participant cannot add new member: setting a user-type field auto-adds the chosen user
	// as a run participant, so only the run owner or a system admin may trigger that side effect.
	t.Run("participant cannot add new member", func(t *testing.T) {
		pbID, err := e.PlaybooksAdminClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
			Title:  "Participant Cannot Add Member Playbook",
			TeamID: e.BasicTeam.Id,
			Public: true,
		})
		require.NoError(t, err)

		pbField, err := e.PlaybooksAdminClient.Playbooks.CreatePropertyField(
			context.Background(),
			pbID,
			client.PropertyFieldRequest{Name: "Assignee", Type: "user"},
		)
		require.NoError(t, err)

		// addAssigneeParticipantAndDM is only triggered when a task's resolved assignee changes —
		// without this item the property value update has no task to re-resolve and the auto-add
		// side effect never fires.
		pb, err := e.PlaybooksAdminClient.Playbooks.Get(context.Background(), pbID)
		require.NoError(t, err)
		pb.Checklists = []client.Checklist{
			{Title: "Tasks", Items: []client.ChecklistItem{
				{
					Title:                   "Assignee task",
					AssigneeType:            app.AssigneeTypePropertyUser,
					AssigneePropertyFieldID: pbField.ID,
				},
			}},
		}
		err = e.PlaybooksAdminClient.Playbooks.Update(context.Background(), *pb)
		require.NoError(t, err)

		run, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{
			Name:        "Participant Cannot Add Member Run",
			OwnerUserID: e.RegularUser.Id,
			TeamID:      e.BasicTeam.Id,
			PlaybookID:  pbID,
		})
		require.NoError(t, err)

		_, err = addParticipants(e.PlaybooksClient, run.ID, []string{e.RegularUser2.Id})
		require.NoError(t, err)

		targetUser, _, err := e.ServerAdminClient.CreateUser(context.Background(), &model.User{
			Email:    "target-" + model.NewId() + "@example.com",
			Username: "target" + model.NewId(),
			Password: testUserPassword,
		})
		require.NoError(t, err)
		_, _, err = e.ServerAdminClient.AddTeamMember(context.Background(), e.BasicTeam.Id, targetUser.Id)
		require.NoError(t, err)

		runFields, err := e.PlaybooksClient.PlaybookRuns.GetPropertyFields(context.Background(), run.ID)
		require.NoError(t, err)
		var runFieldID string
		for _, f := range runFields {
			if f.Name == "Assignee" && f.Type == "user" {
				runFieldID = f.ID
				break
			}
		}
		require.NotEmpty(t, runFieldID)

		_, err = e.PlaybooksClient2.PlaybookRuns.SetPropertyValue(
			context.Background(),
			run.ID,
			runFieldID,
			client.PropertyValueRequest{Value: []byte(`"` + targetUser.Id + `"`)},
		)
		require.NoError(t, err, "non-owner participant must be allowed to set a user-type property")

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.NotContains(t, run.ParticipantIDs, targetUser.Id,
			"non-owner participant must not be able to add a new member to the run via property assignment")

		_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(
			context.Background(),
			run.ID,
			runFieldID,
			client.PropertyValueRequest{Value: []byte(`""`)},
		)
		require.NoError(t, err)

		_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(
			context.Background(),
			run.ID,
			runFieldID,
			client.PropertyValueRequest{Value: []byte(`"` + targetUser.Id + `"`)},
		)
		require.NoError(t, err)

		run, err = e.PlaybooksClient.PlaybookRuns.Get(context.Background(), run.ID)
		require.NoError(t, err)
		require.Contains(t, run.ParticipantIDs, targetUser.Id,
			"run owner must be able to add a new member to the run via property assignment")
	})
}
