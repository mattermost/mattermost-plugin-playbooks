// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testRunID        = "abcdefghijklmnopqrstuvwxyz"
	testPlaybookID   = "bcdefghijklmnopqrstuvwxyza"
	testTeamID       = "cdefghijklmnopqrstuvwxyzab"
	testRunChannelID = "defghijklmnopqrstuvwxyzabc"
	testUserID       = "efghijklmnopqrstuvwxyzabcd"
	testCurrentUser  = "abcdefghijklmnopqrstuvwxy0"
)

func TestToolRunPlaybookBuildsCreateBody(t *testing.T) {
	tests := []struct {
		name       string
		playbook   playbookForRun
		args       RunPlaybookArgs
		wantBody   map[string]any
		absentKeys []string
	}{
		{
			name:     "defaults team from the playbook and creates a new channel",
			playbook: playbookForRun{ID: testPlaybookID, Title: "Sev1", TeamID: testTeamID, ChannelMode: channelModeCreateNew},
			args:     RunPlaybookArgs{PlaybookID: testPlaybookID, Name: " Sev1 — checkout ", Summary: "Checkout is down"},
			wantBody: map[string]any{
				"playbook_id": testPlaybookID,
				"name":        "Sev1 — checkout",
				"team_id":     testTeamID,
				"summary":     "Checkout is down",
			},
			absentKeys: []string{"channel_id", "owner_user_id", "create_public_run"},
		},
		{
			// POST /runs never reads the playbook's channel_mode, so a
			// link-existing-channel playbook silently creates a new channel
			// unless the tool passes the playbook's channel through.
			name:     "passes the playbook channel when the playbook links an existing channel",
			playbook: playbookForRun{ID: testPlaybookID, Title: "Release", TeamID: testTeamID, ChannelMode: channelModeLinkExisting, ChannelID: testRunChannelID},
			args:     RunPlaybookArgs{PlaybookID: testPlaybookID, Name: "Release 9.4"},
			wantBody: map[string]any{
				"playbook_id": testPlaybookID,
				"name":        "Release 9.4",
				"channel_id":  testRunChannelID,
			},
			// The server derives the team from the channel and rejects a
			// conflicting team_id, so none is defaulted in link mode.
			absentKeys: []string{"team_id"},
		},
		{
			name:     "link mode without a configured channel still creates a new channel",
			playbook: playbookForRun{ID: testPlaybookID, Title: "Release", TeamID: testTeamID, ChannelMode: channelModeLinkExisting},
			args:     RunPlaybookArgs{PlaybookID: testPlaybookID, Name: "Release 9.4"},
			wantBody: map[string]any{
				"playbook_id": testPlaybookID,
				"team_id":     testTeamID,
			},
			absentKeys: []string{"channel_id"},
		},
		{
			name:     "caller channel overrides the playbook channel",
			playbook: playbookForRun{ID: testPlaybookID, Title: "Release", TeamID: testTeamID, ChannelMode: channelModeLinkExisting, ChannelID: "zzzzzzzzzzzzzzzzzzzzzzzzzz"},
			args:     RunPlaybookArgs{PlaybookID: testPlaybookID, Name: "Release 9.4", ChannelID: testRunChannelID},
			wantBody: map[string]any{
				"playbook_id": testPlaybookID,
				"channel_id":  testRunChannelID,
			},
		},
		{
			name:     "resolves me to the current user as owner",
			playbook: playbookForRun{ID: testPlaybookID, Title: "Sev1", TeamID: testTeamID},
			args:     RunPlaybookArgs{PlaybookID: testPlaybookID, Name: "Sev1", OwnerUserID: "me"},
			wantBody: map[string]any{
				"playbook_id":   testPlaybookID,
				"owner_user_id": testCurrentUser,
			},
		},
		{
			name:     "omits the name when the playbook has a locked channel-name template",
			playbook: playbookForRun{ID: testPlaybookID, Title: "Sev1", TeamID: testTeamID, ChannelNameTemplate: "{SEQ} incident", ChannelNameTemplateLocked: true},
			args:     RunPlaybookArgs{PlaybookID: testPlaybookID},
			wantBody: map[string]any{
				"playbook_id": testPlaybookID,
				"team_id":     testTeamID,
			},
			absentKeys: []string{"name"},
		},
		{
			name:     "forwards an explicit create_public_run",
			playbook: playbookForRun{ID: testPlaybookID, Title: "Sev1", TeamID: testTeamID},
			args:     RunPlaybookArgs{PlaybookID: testPlaybookID, Name: "Sev1", CreatePublicRun: boolPtr(false)},
			wantBody: map[string]any{
				"playbook_id":       testPlaybookID,
				"create_public_run": false,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{
				runPlaybook: tt.playbook,
				run:         playbookRunDetail{ID: testRunID, Name: "Created run"},
			}

			_, err := toolRunPlaybook(context.Background(), client, tt.args)
			require.NoError(t, err)

			assert.Equal(t, "playbooks/"+testPlaybookID, client.getEndpoint, "expected the playbook to be fetched first")
			require.Equal(t, "runs", client.postEndpoint)
			require.IsType(t, map[string]any{}, client.postBody)
			body := client.postBody.(map[string]any)
			for key, want := range tt.wantBody {
				assert.Equal(t, want, body[key], "body key %q", key)
			}
			for _, key := range tt.absentKeys {
				assert.NotContains(t, body, key)
			}
		})
	}
}

func TestToolRunPlaybookRejectsBadInput(t *testing.T) {
	tests := []struct {
		name     string
		playbook playbookForRun
		args     RunPlaybookArgs
		wantErr  string
	}{
		{
			name:    "rejects an invalid playbook id",
			args:    RunPlaybookArgs{PlaybookID: "invalid"},
			wantErr: "playbook_id must be a valid Mattermost ID",
		},
		{
			name:    "rejects an invalid team id",
			args:    RunPlaybookArgs{PlaybookID: testPlaybookID, TeamID: "invalid"},
			wantErr: "team_id must be a valid Mattermost ID",
		},
		{
			name:    "rejects an invalid channel id",
			args:    RunPlaybookArgs{PlaybookID: testPlaybookID, ChannelID: "invalid"},
			wantErr: "channel_id must be a valid Mattermost ID",
		},
		{
			name:    "rejects an invalid owner id",
			args:    RunPlaybookArgs{PlaybookID: testPlaybookID, OwnerUserID: "invalid"},
			wantErr: "owner_user_id must be a valid Mattermost ID",
		},
		{
			name:     "rejects an archived playbook",
			playbook: playbookForRun{ID: testPlaybookID, Title: "Old", TeamID: testTeamID, DeleteAt: 1717200000000},
			args:     RunPlaybookArgs{PlaybookID: testPlaybookID, Name: "Attempt"},
			wantErr:  "is archived",
		},
		{
			name:     "requires a name when a new channel will be created",
			playbook: playbookForRun{ID: testPlaybookID, Title: "Sev1", TeamID: testTeamID},
			args:     RunPlaybookArgs{PlaybookID: testPlaybookID},
			wantErr:  "name is required",
		},
		{
			// An unlocked template is only a prefill suggestion; the API will
			// not apply it, so a name is still required.
			name:     "requires a name when the channel-name template is not locked",
			playbook: playbookForRun{ID: testPlaybookID, Title: "Sev1", TeamID: testTeamID, ChannelNameTemplate: "{SEQ} incident"},
			args:     RunPlaybookArgs{PlaybookID: testPlaybookID},
			wantErr:  "name is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{runPlaybook: tt.playbook}

			_, err := toolRunPlaybook(context.Background(), client, tt.args)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
			assert.Empty(t, client.postEndpoint, "expected no run to be created")
		})
	}
}

func TestToolRunPlaybookReturnsRunSummaryAndURL(t *testing.T) {
	client := &fakeAPIClient{
		runPlaybook: playbookForRun{ID: testPlaybookID, Title: "Sev1 Incident", TeamID: testTeamID},
		run: playbookRunDetail{
			ID:           testRunID,
			Name:         "Sev1 — checkout 500s",
			SequentialID: "INC-00042",
			OwnerUserID:  testUserID,
			ChannelID:    testRunChannelID,
			Checklists:   []checklist{{Title: "Triage", Items: []checklistItem{{Title: "Page on-call"}, {Title: "Declare", State: "closed"}}}},
		},
	}

	out, err := toolRunPlaybook(context.Background(), client, RunPlaybookArgs{PlaybookID: testPlaybookID, Name: "Sev1 — checkout 500s"})
	require.NoError(t, err)

	assert.Contains(t, out, "Sev1 — checkout 500s")
	assert.Contains(t, out, testRunID)
	assert.Contains(t, out, "INC-00042")
	assert.Contains(t, out, testRunChannelID)
	assert.Contains(t, out, testUserID)
	assert.Contains(t, out, "1/2 complete")
	assert.Contains(t, out, "https://mattermost.example.com/playbooks/runs/"+testRunID)
}

func TestToolUpdateRunPatchesProvidedFields(t *testing.T) {
	name := " Renamed run "
	summary := ""

	tests := []struct {
		name       string
		args       UpdateRunArgs
		wantBody   map[string]any
		absentKeys []string
	}{
		{
			name:       "renames only",
			args:       UpdateRunArgs{RunID: testRunID, Name: &name},
			wantBody:   map[string]any{"name": "Renamed run"},
			absentKeys: []string{"summary"},
		},
		{
			name:       "clears the summary only",
			args:       UpdateRunArgs{RunID: testRunID, Summary: &summary},
			wantBody:   map[string]any{"summary": ""},
			absentKeys: []string{"name"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{}

			_, err := toolUpdateRun(context.Background(), client, tt.args)
			require.NoError(t, err)

			require.Equal(t, "runs/"+testRunID, client.patchEndpoint)
			require.IsType(t, map[string]any{}, client.patchBody)
			body := client.patchBody.(map[string]any)
			for key, want := range tt.wantBody {
				assert.Equal(t, want, body[key], "body key %q", key)
			}
			for _, key := range tt.absentKeys {
				assert.NotContains(t, body, key)
			}
		})
	}
}

func TestToolUpdateRunValidation(t *testing.T) {
	empty := "   "

	tests := []struct {
		name    string
		args    UpdateRunArgs
		wantErr string
	}{
		{
			name:    "rejects an invalid run id",
			args:    UpdateRunArgs{RunID: "invalid"},
			wantErr: "run_id must be a valid Mattermost ID",
		},
		{
			name:    "requires at least one field",
			args:    UpdateRunArgs{RunID: testRunID},
			wantErr: "at least one field (name or summary) must be provided",
		},
		{
			name:    "rejects a blank name",
			args:    UpdateRunArgs{RunID: testRunID, Name: &empty},
			wantErr: "name must not be empty",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{}

			_, err := toolUpdateRun(context.Background(), client, tt.args)
			require.EqualError(t, err, tt.wantErr)
			assert.Empty(t, client.patchEndpoint, "expected no update call")
		})
	}
}

func TestRunLifecycleToolEndpoints(t *testing.T) {
	t.Run("restore run", func(t *testing.T) {
		client := &fakeAPIClient{}
		_, err := toolRestoreRun(context.Background(), client, RunIDArgs{RunID: testRunID})
		require.NoError(t, err)
		assert.Equal(t, "runs/"+testRunID+"/restore", client.putEndpoint)
		assert.Nil(t, client.putBody)
	})

	t.Run("request status update", func(t *testing.T) {
		client := &fakeAPIClient{}
		_, err := toolRequestStatusUpdate(context.Background(), client, RunIDArgs{RunID: testRunID})
		require.NoError(t, err)
		assert.Equal(t, "runs/"+testRunID+"/request-update", client.postEndpoint)
		assert.Nil(t, client.postBody)
	})

	t.Run("follow run", func(t *testing.T) {
		client := &fakeAPIClient{}
		_, err := toolFollowRun(context.Background(), client, RunIDArgs{RunID: testRunID})
		require.NoError(t, err)
		assert.Equal(t, "runs/"+testRunID+"/followers", client.putEndpoint)
	})

	t.Run("unfollow run", func(t *testing.T) {
		client := &fakeAPIClient{}
		_, err := toolUnfollowRun(context.Background(), client, RunIDArgs{RunID: testRunID})
		require.NoError(t, err)
		assert.Equal(t, "runs/"+testRunID+"/followers", client.deleteEndpoint)
	})
}

func TestRunLifecycleToolsRejectInvalidRunID(t *testing.T) {
	tests := []struct {
		name    string
		runTool func(context.Context, APIClient) (string, error)
	}{
		{"restore run", func(ctx context.Context, c APIClient) (string, error) {
			return toolRestoreRun(ctx, c, RunIDArgs{RunID: "invalid"})
		}},
		{"request status update", func(ctx context.Context, c APIClient) (string, error) {
			return toolRequestStatusUpdate(ctx, c, RunIDArgs{RunID: "invalid"})
		}},
		{"follow run", func(ctx context.Context, c APIClient) (string, error) {
			return toolFollowRun(ctx, c, RunIDArgs{RunID: "invalid"})
		}},
		{"unfollow run", func(ctx context.Context, c APIClient) (string, error) {
			return toolUnfollowRun(ctx, c, RunIDArgs{RunID: "invalid"})
		}},
		{"get status updates", func(ctx context.Context, c APIClient) (string, error) {
			return toolGetStatusUpdates(ctx, c, GetStatusUpdatesArgs{RunID: "invalid"})
		}},
		{"get run metadata", func(ctx context.Context, c APIClient) (string, error) {
			return toolGetRunMetadata(ctx, c, RunIDArgs{RunID: "invalid"})
		}},
		{"add run participants", func(ctx context.Context, c APIClient) (string, error) {
			return toolAddRunParticipants(ctx, c, AddRunParticipantsArgs{RunID: "invalid", UserIDs: []string{"me"}})
		}},
		{"remove run participant", func(ctx context.Context, c APIClient) (string, error) {
			return toolRemoveRunParticipant(ctx, c, RemoveRunParticipantArgs{RunID: "invalid", UserID: "me"})
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{}
			_, err := tt.runTool(context.Background(), client)
			require.EqualError(t, err, "run_id must be a valid Mattermost ID")
			assert.Empty(t, client.postEndpoint)
			assert.Empty(t, client.putEndpoint)
			assert.Empty(t, client.deleteEndpoint)
			assert.Empty(t, client.getEndpoint)
		})
	}
}

func TestToolGetStatusUpdatesFormatsNewestFirst(t *testing.T) {
	client := &fakeAPIClient{
		statusUpdates: []runStatusUpdate{
			{ID: "p3", CreateAt: 300, Message: "Third", AuthorUserName: "carol"},
			{ID: "p2", CreateAt: 200, Message: "Second", AuthorUserName: "bob"},
			{ID: "p1", CreateAt: 100, Message: "First", AuthorUserName: "alice"},
		},
	}

	out, err := toolGetStatusUpdates(context.Background(), client, GetStatusUpdatesArgs{RunID: testRunID, Limit: 2})
	require.NoError(t, err)

	assert.Equal(t, "runs/"+testRunID+"/status-updates", client.getEndpoint)
	assert.Contains(t, out, "@carol")
	assert.Contains(t, out, "Third")
	assert.Contains(t, out, "Second")
	assert.NotContains(t, out, "First")
	assert.Contains(t, out, "1 older update(s) not shown")
}

func TestToolGetStatusUpdatesTruncatesToTheNewestRegardlessOfAPIOrder(t *testing.T) {
	client := &fakeAPIClient{
		statusUpdates: []runStatusUpdate{
			{ID: "p1", CreateAt: 100, Message: "Oldest", AuthorUserName: "alice"},
			{ID: "p2", CreateAt: 200, Message: "Newest", AuthorUserName: "bob"},
		},
	}

	out, err := toolGetStatusUpdates(context.Background(), client, GetStatusUpdatesArgs{RunID: testRunID, Limit: 1})
	require.NoError(t, err)

	assert.Contains(t, out, "Newest")
	assert.NotContains(t, out, "Oldest")
}

func TestToolGetStatusUpdatesSkipsDeletedAndEmpty(t *testing.T) {
	t.Run("skips deleted updates", func(t *testing.T) {
		client := &fakeAPIClient{
			statusUpdates: []runStatusUpdate{
				{ID: "p2", CreateAt: 200, DeleteAt: 250, Message: "Retracted", AuthorUserName: "bob"},
				{ID: "p1", CreateAt: 100, Message: "Kept", AuthorUserName: "alice"},
			},
		}

		out, err := toolGetStatusUpdates(context.Background(), client, GetStatusUpdatesArgs{RunID: testRunID})
		require.NoError(t, err)
		assert.Contains(t, out, "Kept")
		assert.NotContains(t, out, "Retracted")
	})

	t.Run("reports when there are none", func(t *testing.T) {
		client := &fakeAPIClient{}

		out, err := toolGetStatusUpdates(context.Background(), client, GetStatusUpdatesArgs{RunID: testRunID})
		require.NoError(t, err)
		assert.Contains(t, out, "No status updates")
	})
}

func TestToolGetRunMetadataFormatsChannelAndFollowers(t *testing.T) {
	client := &fakeAPIClient{
		metadata: runMetadata{
			ChannelName:        "incident-42",
			ChannelDisplayName: "Incident 42",
			TeamName:           "core",
			NumParticipants:    3,
			TotalPosts:         17,
			Followers:          []string{testUserID},
		},
	}

	out, err := toolGetRunMetadata(context.Background(), client, RunIDArgs{RunID: testRunID})
	require.NoError(t, err)

	assert.Equal(t, "runs/"+testRunID+"/metadata", client.getEndpoint)
	assert.Contains(t, out, "Incident 42 (~incident-42)")
	assert.Contains(t, out, "Team: core")
	assert.Contains(t, out, "Participants: 3")
	assert.Contains(t, out, "Posts in channel: 17")
	assert.Contains(t, out, "Followers: 1")
}

func TestToolAddRunParticipantsResolvesMeAndDeduplicates(t *testing.T) {
	client := &fakeAPIClient{}

	_, err := toolAddRunParticipants(context.Background(), client, AddRunParticipantsArgs{
		RunID:             testRunID,
		UserIDs:           []string{"me", testUserID, testCurrentUser},
		ForceAddToChannel: true,
	})
	require.NoError(t, err)

	require.Equal(t, "runs/"+testRunID+"/participants", client.postEndpoint)
	require.IsType(t, map[string]any{}, client.postBody)
	body := client.postBody.(map[string]any)
	assert.Equal(t, []string{testCurrentUser, testUserID}, body["user_ids"])
	assert.Equal(t, true, body["force_add_to_channel"])
}

func TestToolAddRunParticipantsValidation(t *testing.T) {
	tests := []struct {
		name    string
		client  *fakeAPIClient
		args    AddRunParticipantsArgs
		wantErr string
	}{
		{
			name:    "requires at least one user",
			client:  &fakeAPIClient{},
			args:    AddRunParticipantsArgs{RunID: testRunID},
			wantErr: "user_ids is required; pass 'me' to join the run yourself",
		},
		{
			name:    "rejects an invalid user id",
			client:  &fakeAPIClient{},
			args:    AddRunParticipantsArgs{RunID: testRunID, UserIDs: []string{"invalid"}},
			wantErr: "user_ids[0] must be a valid Mattermost ID",
		},
		{
			name:    "surfaces a failure to resolve the current user",
			client:  &fakeAPIClient{currentUserErr: errors.New("missing Mattermost user ID")},
			args:    AddRunParticipantsArgs{RunID: testRunID, UserIDs: []string{"me"}},
			wantErr: `failed to resolve "me" for user_ids[0]: missing Mattermost user ID`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := toolAddRunParticipants(context.Background(), tt.client, tt.args)
			require.EqualError(t, err, tt.wantErr)
			assert.Empty(t, tt.client.postEndpoint, "expected no participants call")
		})
	}
}

func TestToolRemoveRunParticipant(t *testing.T) {
	t.Run("resolves me and deletes", func(t *testing.T) {
		client := &fakeAPIClient{run: playbookRunDetail{ID: testRunID, ParticipantIDs: []string{testCurrentUser, testUserID}}}

		_, err := toolRemoveRunParticipant(context.Background(), client, RemoveRunParticipantArgs{RunID: testRunID, UserID: "me"})
		require.NoError(t, err)

		assert.Equal(t, "runs/"+testRunID, client.getEndpoint)
		assert.Equal(t, "runs/"+testRunID+"/participants/"+testCurrentUser, client.deleteEndpoint)
	})

	t.Run("is a no-op for a non-participant", func(t *testing.T) {
		client := &fakeAPIClient{run: playbookRunDetail{ID: testRunID, ParticipantIDs: []string{testCurrentUser}}}

		out, err := toolRemoveRunParticipant(context.Background(), client, RemoveRunParticipantArgs{RunID: testRunID, UserID: testUserID})
		require.NoError(t, err)

		assert.Contains(t, out, "is not a participant")
		assert.Contains(t, out, testCurrentUser)
		assert.Empty(t, client.deleteEndpoint, "expected no delete for a non-participant")
	})

	t.Run("refuses to remove the run owner", func(t *testing.T) {
		client := &fakeAPIClient{run: playbookRunDetail{ID: testRunID, OwnerUserID: testUserID, ParticipantIDs: []string{testUserID}}}

		_, err := toolRemoveRunParticipant(context.Background(), client, RemoveRunParticipantArgs{RunID: testRunID, UserID: testUserID})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "change_run_owner")
		assert.Empty(t, client.deleteEndpoint, "expected no delete for the run owner")
	})

	t.Run("requires a user id", func(t *testing.T) {
		client := &fakeAPIClient{}

		_, err := toolRemoveRunParticipant(context.Background(), client, RemoveRunParticipantArgs{RunID: testRunID})
		require.EqualError(t, err, "user_id is required; pass 'me' to leave the run yourself")
		assert.Empty(t, client.deleteEndpoint)
	})
}

func TestToolUpdateRunStatusDefaultsReminderFromRun(t *testing.T) {
	const oneDayNanos = int64(86400) * 1_000_000_000

	tests := []struct {
		name         string
		run          playbookRunDetail
		args         UpdateRunStatusArgs
		wantReminder int64
		wantRunFetch bool
	}{
		{
			name:         "uses the run's previous reminder converted from nanoseconds",
			run:          playbookRunDetail{ID: testRunID, PreviousReminder: oneDayNanos, ReminderTimerDefaultSeconds: 1800},
			args:         UpdateRunStatusArgs{RunID: testRunID, Message: "Update"},
			wantReminder: 86400,
			wantRunFetch: true,
		},
		{
			name:         "falls back to the playbook's default interval",
			run:          playbookRunDetail{ID: testRunID, ReminderTimerDefaultSeconds: 1800},
			args:         UpdateRunStatusArgs{RunID: testRunID, Message: "Update"},
			wantReminder: 1800,
			wantRunFetch: true,
		},
		{
			name:         "falls back to one hour when the run carries neither",
			run:          playbookRunDetail{ID: testRunID},
			args:         UpdateRunStatusArgs{RunID: testRunID, Message: "Update"},
			wantReminder: 3600,
			wantRunFetch: true,
		},
		{
			name:         "keeps an explicit reminder without fetching the run",
			run:          playbookRunDetail{ID: testRunID, PreviousReminder: oneDayNanos},
			args:         UpdateRunStatusArgs{RunID: testRunID, Message: "Update", ReminderSeconds: 900},
			wantReminder: 900,
		},
		{
			name:         "sends no reminder when finishing the run",
			run:          playbookRunDetail{ID: testRunID, PreviousReminder: oneDayNanos},
			args:         UpdateRunStatusArgs{RunID: testRunID, Message: "All done", FinishRun: true},
			wantReminder: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{run: tt.run}

			_, err := toolUpdateRunStatus(context.Background(), client, tt.args)
			require.NoError(t, err)

			require.Equal(t, "runs/"+testRunID+"/status", client.postEndpoint)
			require.IsType(t, map[string]any{}, client.postBody)
			body := client.postBody.(map[string]any)
			assert.Equal(t, tt.wantReminder, body["reminder"])
			if tt.wantRunFetch {
				assert.Equal(t, "runs/"+testRunID, client.getEndpoint, "expected the run to be fetched for its cadence")
			} else {
				assert.Empty(t, client.getEndpoint, "expected no run fetch")
			}
		})
	}
}

func TestToolListRunsForwardsFilters(t *testing.T) {
	client := &fakeAPIClient{}

	_, err := toolListRuns(context.Background(), client, ListRunsArgs{
		TeamID:        testTeamID,
		ChannelID:     testRunChannelID,
		Status:        "InProgress",
		OwnerUserID:   "me",
		ParticipantID: "me",
		PlaybookID:    testPlaybookID,
		SearchTerm:    "  checkout  ",
		OmitEnded:     true,
		Types:         []string{"playbook"},
		PerPage:       5,
	})
	require.NoError(t, err)

	require.Equal(t, "runs", client.getEndpoint)
	params := client.getParams
	assert.Equal(t, testTeamID, params.Get("team_id"))
	assert.Equal(t, testRunChannelID, params.Get("channel_id"))
	assert.Equal(t, "InProgress", params.Get("statuses"))
	// The list endpoint resolves "me" itself for both user filters.
	assert.Equal(t, "me", params.Get("owner_user_id"))
	assert.Equal(t, "me", params.Get("participant_id"))
	assert.Equal(t, testPlaybookID, params.Get("playbook_id"))
	assert.Equal(t, "checkout", params.Get("search_term"))
	assert.Equal(t, "true", params.Get("omit_ended"))
	assert.Equal(t, []string{"playbook"}, params["types"])
	assert.Equal(t, "5", params.Get("per_page"))
}

func TestToolListRunsValidatesFilters(t *testing.T) {
	tests := []struct {
		name    string
		args    ListRunsArgs
		wantErr string
	}{
		{
			name:    "rejects a negative page",
			args:    ListRunsArgs{Page: -1},
			wantErr: "page must be >= 0",
		},
		{
			name:    "rejects an invalid playbook id",
			args:    ListRunsArgs{PlaybookID: "invalid"},
			wantErr: "playbook_id must be a valid Mattermost ID",
		},
		{
			name:    "rejects an unknown run type",
			args:    ListRunsArgs{Types: []string{"nope"}},
			wantErr: "types entries must be one of playbook or channelChecklist",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &fakeAPIClient{}
			_, err := toolListRuns(context.Background(), client, tt.args)
			require.EqualError(t, err, tt.wantErr)
			assert.Empty(t, client.getEndpoint)
		})
	}
}

func TestFormatRunDetailRendersCompactSummary(t *testing.T) {
	run := playbookRunDetail{
		ID:                          testRunID,
		Name:                        "Sev1 — checkout 500s",
		Summary:                     "Checkout is returning 500s.",
		CurrentStatus:               "InProgress",
		OwnerUserID:                 testUserID,
		ReporterUserID:              testCurrentUser,
		TeamID:                      testTeamID,
		ChannelID:                   testRunChannelID,
		PlaybookID:                  testPlaybookID,
		Type:                        runTypePlaybook,
		SequentialID:                "INC-00042",
		RunNumber:                   42,
		CreateAt:                    1717200000000,
		TaskTotal:                   3,
		TaskCompleted:               1,
		ParticipantIDs:              []string{testUserID, testCurrentUser},
		StatusUpdateEnabled:         true,
		PreviousReminder:            int64(3600) * 1_000_000_000,
		ReminderTimerDefaultSeconds: 86400,
		RetrospectiveEnabled:        true,
		StatusPosts:                 []runStatusPost{{ID: "post1"}},
		TimelineEvents:              []runTimelineEvent{{ID: "ev1", EventType: "incident_created"}, {ID: "ev2"}},
		Checklists: []checklist{{
			Title: "Triage",
			Items: []checklistItem{
				{Title: "Page the on-call", State: "closed", AssigneeID: testUserID},
				{Title: "Declare severity", AssigneeType: "owner"},
				{Title: "Notify comms", State: "skipped", LastSkipped: 1717200500000, DueDate: 1717300000000},
			},
		}},
	}

	out := formatRunDetail(run)

	assert.Contains(t, out, "**Sev1 — checkout 500s** (run_id: "+testRunID+")")
	assert.Contains(t, out, "Run number: INC-00042")
	assert.Contains(t, out, "Status: InProgress")
	assert.Contains(t, out, "Reporter: "+testCurrentUser)
	assert.Contains(t, out, "Started from playbook: "+testPlaybookID)
	assert.Contains(t, out, "Tasks: 1/3 complete")
	assert.Contains(t, out, "Status updates: enabled")
	assert.Contains(t, out, "next reminder in 3600s")
	assert.Contains(t, out, "Retrospective: enabled, not published yet")
	assert.Contains(t, out, "Checkout is returning 500s.")
	assert.Contains(t, out, "Participants (2)")
	// Indexes must match writeRunChecklists so they stay usable across tools.
	assert.Contains(t, out, "[0][0] Page the on-call (closed) — assignee: "+testUserID)
	assert.Contains(t, out, "[0][1] Declare severity (open) — assignee: by role (owner)")
	assert.Contains(t, out, "[0][2] Notify comms (skipped)")
	assert.Contains(t, out, "due: 1717300000000")
	assert.Contains(t, out, "skipped at 1717200500000")
	assert.Contains(t, out, "1 status update(s) posted — call get_status_updates")
	assert.Contains(t, out, "2 timeline event(s) recorded")
	// The timeline itself must not be dumped.
	assert.NotContains(t, out, "incident_created")
}

func TestFormatRunDetailCountsTasksWhenServerCountersAreAbsent(t *testing.T) {
	run := playbookRunDetail{
		ID:   testRunID,
		Name: "Ad-hoc checklist",
		Checklists: []checklist{{
			Items: []checklistItem{{State: "closed"}, {State: "skipped"}, {}},
		}},
	}

	assert.Contains(t, formatRunDetail(run), "Tasks: 2/3 complete")
}

func boolPtr(v bool) *bool {
	return &v
}
