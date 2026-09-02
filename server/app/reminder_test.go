// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/mattermost/mattermost/server/public/pluginapi/cluster"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

func TestMdLinkText(t *testing.T) {
	tests := []struct {
		input  string
		expect string
	}{
		{"no special chars", "no special chars"},
		{"[brackets]", `\[brackets\]`},
		{`back\slash`, `back\\slash`},
		{`[combo\]`, `\[combo\\\]`},
		{"nested [a [b] c]", `nested \[a \[b\] c\]`},
		{"", ""},
	}
	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			require.Equal(t, tc.expect, mdLinkText(tc.input))
		})
	}
}

func TestBuildOverdueStatusUpdateMessage(t *testing.T) {
	t.Run("DM channel produces /<team>/messages/<channelId> URL using owner's team", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		svc := &PlaybookRunServiceImpl{pluginAPI: pluginapi.NewClient(api, &plugintest.Driver{})}

		ownerID := model.NewId()
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:          channelID,
			Type:        model.ChannelTypeDirect,
			TeamId:      "",
			DisplayName: "alice, bob",
		}, (*model.AppError)(nil))
		api.On("GetTeamsForUser", ownerID).Return([]*model.Team{
			{Id: model.NewId(), Name: "myteam"},
		}, (*model.AppError)(nil))

		run := &PlaybookRun{ID: model.NewId(), ChannelID: channelID, OwnerUserID: ownerID}
		msg, err := svc.buildOverdueStatusUpdateMessage(run, "alice")
		require.NoError(t, err)
		require.Contains(t, msg, "/myteam/messages/"+channelID)
		require.NotContains(t, msg, "/channels/")
	})

	t.Run("team channel produces team/channel URL", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		svc := &PlaybookRunServiceImpl{pluginAPI: pluginapi.NewClient(api, &plugintest.Driver{})}

		teamID := model.NewId()
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:          channelID,
			TeamId:      teamID,
			Name:        "incident-channel",
			DisplayName: "Incident Channel",
		}, (*model.AppError)(nil))
		api.On("GetTeam", teamID).Return(&model.Team{
			Id:   teamID,
			Name: "myteam",
		}, (*model.AppError)(nil))

		run := &PlaybookRun{ID: model.NewId(), ChannelID: channelID}
		msg, err := svc.buildOverdueStatusUpdateMessage(run, "alice")
		require.NoError(t, err)
		require.Contains(t, msg, "/myteam/channels/incident-channel")
		require.NotContains(t, msg, "/messages/")
	})

	t.Run("display name with brackets is escaped in link text", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		svc := &PlaybookRunServiceImpl{pluginAPI: pluginapi.NewClient(api, &plugintest.Driver{})}

		ownerID := model.NewId()
		channelID := model.NewId()
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:          channelID,
			Type:        model.ChannelTypeDirect,
			TeamId:      "",
			DisplayName: "[alice], [bob]",
		}, (*model.AppError)(nil))
		api.On("GetTeamsForUser", ownerID).Return([]*model.Team{
			{Id: model.NewId(), Name: "myteam"},
		}, (*model.AppError)(nil))

		run := &PlaybookRun{ID: model.NewId(), ChannelID: channelID, OwnerUserID: ownerID}
		msg, err := svc.buildOverdueStatusUpdateMessage(run, "alice")
		require.NoError(t, err)
		require.Contains(t, msg, `\[alice\]`)
		require.NotContains(t, msg, "[alice],")
	})
}

// --- fakes for SetNewReminder -------------------------------------------------------------
//
// PlaybookRunServiceImpl's collaborators are interfaces with no generated mocks in this
// package, and importing server/app/mocks from an internal test file would create an import
// cycle. Embedding each interface gives a fake that satisfies it while implementing only the
// methods SetNewReminder actually reaches; anything else panics loudly rather than silently
// passing.

type fakeReminderRunStore struct {
	PlaybookRunStore
	run     *PlaybookRun
	updated *PlaybookRun
}

func (f *fakeReminderRunStore) GetPlaybookRun(string) (*PlaybookRun, error) {
	return f.run, nil
}

func (f *fakeReminderRunStore) UpdatePlaybookRun(run *PlaybookRun) (*PlaybookRun, error) {
	f.updated = run
	return run, nil
}

type fakeReminderConfigService struct {
	config.Service
}

func (f *fakeReminderConfigService) IsIncrementalUpdatesEnabled() bool { return false }

type fakeReminderPoster struct {
	bot.Poster
}

func (f *fakeReminderPoster) PublishWebsocketEventToChannel(string, interface{}, string) {}
func (f *fakeReminderPoster) PublishWebsocketEventToUser(string, interface{}, string)    {}

type fakeScheduler struct {
	scheduledKeys []string
	scheduledAt   []time.Time
	cancelledKeys []string
}

func (f *fakeScheduler) Start() error                        { return nil }
func (f *fakeScheduler) SetCallback(func(string, any)) error { return nil }
func (f *fakeScheduler) ListScheduledJobs() ([]cluster.JobOnceMetadata, error) {
	return nil, nil
}
func (f *fakeScheduler) ScheduleOnce(key string, runAt time.Time, _ any) (*cluster.JobOnce, error) {
	f.scheduledKeys = append(f.scheduledKeys, key)
	f.scheduledAt = append(f.scheduledAt, runAt)
	return nil, nil
}
func (f *fakeScheduler) Cancel(key string) {
	f.cancelledKeys = append(f.cancelledKeys, key)
}

// TestSetNewReminder_NeverSkipsScheduling locks in the guard that makes the "Never" status-update
// option (MM-46380) actually mean never: a zero reminder must cancel any pending job and schedule
// nothing. Without this, a regression would silently re-arm reminders for runs whose owner
// explicitly turned them off.
func TestSetNewReminder_NeverSkipsScheduling(t *testing.T) {
	newService := func() (*PlaybookRunServiceImpl, *fakeScheduler, *fakeReminderRunStore) {
		api := &plugintest.API{}
		api.On("LogWarn", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Maybe()
		api.On("GetChannelMembersByIds", mock.Anything, mock.Anything).
			Return(nil, model.NewAppError("", "", nil, "", 500)).Maybe()

		scheduler := &fakeScheduler{}
		store := &fakeReminderRunStore{run: &PlaybookRun{
			ID:        "run-1",
			ChannelID: "chan-1",
		}}

		return &PlaybookRunServiceImpl{
			pluginAPI:     pluginapi.NewClient(api, &plugintest.Driver{}),
			store:         store,
			scheduler:     scheduler,
			poster:        &fakeReminderPoster{},
			configService: &fakeReminderConfigService{},
		}, scheduler, store
	}

	t.Run("zero reminder cancels the pending job and schedules nothing", func(t *testing.T) {
		svc, scheduler, store := newService()

		require.NoError(t, svc.SetNewReminder("run-1", 0))

		require.Equal(t, []string{"run-1"}, scheduler.cancelledKeys, "pending reminder must be cancelled")
		require.Empty(t, scheduler.scheduledKeys, "a zero reminder must not schedule a job")
		require.EqualValues(t, 0, store.updated.PreviousReminder, "PreviousReminder must persist as 0")
	})

	t.Run("positive reminder still schedules a job", func(t *testing.T) {
		svc, scheduler, store := newService()

		require.NoError(t, svc.SetNewReminder("run-1", 24*time.Hour))

		require.Equal(t, []string{"run-1"}, scheduler.scheduledKeys, "a positive reminder must schedule a job")
		require.WithinDuration(t, time.Now().Add(24*time.Hour), scheduler.scheduledAt[0], time.Minute)
		require.EqualValues(t, 24*time.Hour, store.updated.PreviousReminder)
	})
}
