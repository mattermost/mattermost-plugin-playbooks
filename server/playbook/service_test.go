package playbook_test

import (
	"testing"

	"github.com/golang/mock/gomock"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/telemetry"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	mock_bot "github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot/mocks"
	mock_playbook "github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook/mocks"
)

func TestGetSuggestedPlaybooks(t *testing.T) {
	t.Run("can't get channel", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_playbook.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		s := playbook.NewService(store, poster, telemetryService, client)

		channelID := model.NewId()
		pluginAPI.On("GetChannel", channelID).Return(nil, &model.AppError{Id: "model.channel.is_valid.display_name.app_error"})
		pluginAPI.On("LogError", "can't get channel", "err", mock.Anything)

		playbooks := s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID})
		require.Len(t, playbooks, 0)
	})

	t.Run("can't get time last updated", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_playbook.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		s := playbook.NewService(store, poster, telemetryService, client)

		channelID := model.NewId()
		teamID := model.NewId()
		channel := model.Channel{Id: channelID, TeamId: teamID}
		pluginAPI.On("GetChannel", channelID).Return(&channel, nil)

		store.EXPECT().GetTimeLastUpdated().Return(int64(0), errors.New("store error"))
		pluginAPI.On("LogError", "can't update playbooks", "err", mock.Anything)

		playbooks := s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID})
		require.Len(t, playbooks, 0)
	})

	t.Run("can't get playbooks with keywords", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_playbook.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		s := playbook.NewService(store, poster, telemetryService, client)

		channelID := model.NewId()
		teamID := model.NewId()
		channel := model.Channel{Id: channelID, TeamId: teamID}
		pluginAPI.On("GetChannel", channelID).Return(&channel, nil)

		store.EXPECT().GetTimeLastUpdated().Return(int64(1000), nil)
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(nil, errors.New("store error"))
		pluginAPI.On("LogError", "can't update playbooks", "err", mock.Anything)

		playbooks := s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID})
		require.Len(t, playbooks, 0)
	})

	t.Run("no playbooks have been triggered", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_playbook.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		s := playbook.NewService(store, poster, telemetryService, client)

		channelID := model.NewId()
		teamID := model.NewId()
		channel := model.Channel{Id: channelID, TeamId: teamID}
		pluginAPI.On("GetChannel", channelID).Return(&channel, nil)

		store.EXPECT().GetTimeLastUpdated().Return(int64(1000), nil)
		playbooks := []playbook.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdatedAt:         100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdatedAt:         1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdatedAt:         900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{" some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)

		cachedPlaybooks := s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID})
		require.Len(t, cachedPlaybooks, 0)
	})

	t.Run("can't get playbookIDs", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_playbook.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		s := playbook.NewService(store, poster, telemetryService, client)

		channelID := model.NewId()
		teamID := model.NewId()
		channel := model.Channel{Id: channelID, TeamId: teamID}
		pluginAPI.On("GetChannel", channelID).Return(&channel, nil)

		store.EXPECT().GetTimeLastUpdated().Return(int64(1000), nil)
		playbooks := []playbook.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdatedAt:         100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"some", "bla"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)

		userID := model.NewId()
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return(nil, errors.New("store error"))
		pluginAPI.On("LogError", "can't get playbookIDs", "userID", userID, "err", mock.Anything)

		cachedPlaybooks := s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID, UserId: userID})
		require.Len(t, cachedPlaybooks, 0)
	})

	t.Run("user has no playbooks", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_playbook.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		s := playbook.NewService(store, poster, telemetryService, client)

		channelID := model.NewId()
		teamID := model.NewId()
		channel := model.Channel{Id: channelID, TeamId: teamID}
		pluginAPI.On("GetChannel", channelID).Return(&channel, nil)

		store.EXPECT().GetTimeLastUpdated().Return(int64(1000), nil)
		playbooks := []playbook.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdatedAt:         100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdatedAt:         1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdatedAt:         900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)
		userID := model.NewId()
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return([]string{"some_dummy_id"}, nil)
		cachedPlaybooks := s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID, UserId: userID})
		require.Len(t, cachedPlaybooks, 0)
	})

	t.Run("trigger single playbook", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_playbook.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		s := playbook.NewService(store, poster, telemetryService, client)

		channelID := model.NewId()
		teamID := model.NewId()
		channel := model.Channel{Id: channelID, TeamId: teamID}
		pluginAPI.On("GetChannel", channelID).Return(&channel, nil)

		store.EXPECT().GetTimeLastUpdated().Return(int64(1000), nil)
		playbooks := []playbook.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdatedAt:         100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdatedAt:         1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdatedAt:         900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)
		userID := model.NewId()
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return([]string{playbooks[1].ID, playbooks[2].ID}, nil)
		cachedPlaybooks := s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID, UserId: userID})
		require.Len(t, cachedPlaybooks, 1)
		require.Equal(t, cachedPlaybooks[0], &playbook.CachedPlaybook{
			ID:                playbooks[2].ID,
			Title:             playbooks[2].Title,
			TeamID:            playbooks[2].TeamID,
			SignalAnyKeywords: playbooks[2].SignalAnyKeywords,
		})
	})

	t.Run("same call should not trigger the GetPlaybooksWithKeywords second time", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_playbook.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		s := playbook.NewService(store, poster, telemetryService, client)

		channelID := model.NewId()
		teamID := model.NewId()
		channel := model.Channel{Id: channelID, TeamId: teamID}
		pluginAPI.On("GetChannel", channelID).Return(&channel, nil)

		firstCall := store.EXPECT().GetTimeLastUpdated().Return(int64(1000), nil)
		store.EXPECT().GetTimeLastUpdated().Return(int64(1100), nil).After(firstCall)
		playbooks := []playbook.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdatedAt:         100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdatedAt:         1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdatedAt:         900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil).Times(1)
		userID := model.NewId()
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return([]string{playbooks[1].ID, playbooks[2].ID}, nil).Times(2)
		cachedPlaybooks := s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID, UserId: userID})
		require.Len(t, cachedPlaybooks, 1)
		require.Equal(t, cachedPlaybooks[0], &playbook.CachedPlaybook{
			ID:                playbooks[2].ID,
			Title:             playbooks[2].Title,
			TeamID:            playbooks[2].TeamID,
			SignalAnyKeywords: playbooks[2].SignalAnyKeywords,
		})

		cachedPlaybooks = s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID, UserId: userID})
		require.Len(t, cachedPlaybooks, 1)
		require.Equal(t, cachedPlaybooks[0], &playbook.CachedPlaybook{
			ID:                playbooks[2].ID,
			Title:             playbooks[2].Title,
			TeamID:            playbooks[2].TeamID,
			SignalAnyKeywords: playbooks[2].SignalAnyKeywords,
		})
	})

	t.Run("same call should trigger the GetPlaybooksWithKeywords", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_playbook.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		s := playbook.NewService(store, poster, telemetryService, client)

		channelID := model.NewId()
		teamID := model.NewId()
		channel := model.Channel{Id: channelID, TeamId: teamID}
		pluginAPI.On("GetChannel", channelID).Return(&channel, nil)

		firstCall := store.EXPECT().GetTimeLastUpdated().Return(int64(1000), nil)
		store.EXPECT().GetTimeLastUpdated().Return(int64(1200), nil).After(firstCall)
		playbook1 := playbook.Playbook{
			ID:                model.NewId(),
			Title:             "playbook 1",
			UpdatedAt:         100,
			TeamID:            "",
			SignalAnyKeywords: []string{"some", "bla"},
		}
		playbook2 := playbook.Playbook{
			ID:                model.NewId(),
			Title:             "playbook 2",
			UpdatedAt:         1100,
			TeamID:            teamID,
			SignalAnyKeywords: []string{"bla", "something"},
		}
		playbook3 := playbook.Playbook{
			ID:                model.NewId(),
			Title:             "playbook 3",
			UpdatedAt:         900,
			TeamID:            teamID,
			SignalAnyKeywords: []string{"some", "other"},
		}

		playbook4 := playbook.Playbook{
			ID:                playbook2.ID,
			Title:             playbook2.Title,
			UpdatedAt:         1200,
			TeamID:            playbook2.TeamID,
			SignalAnyKeywords: []string{"bla", "message"},
		}
		playbooks1 := []playbook.Playbook{playbook1, playbook2, playbook3}
		playbooks2 := []playbook.Playbook{playbook1, playbook4, playbook3}

		firstGetPlaybooks := store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks1, nil)
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks2, nil).After(firstGetPlaybooks)

		userID := model.NewId()
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return([]string{playbooks1[1].ID, playbooks1[2].ID}, nil).Times(2)
		cachedPlaybooks := s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID, UserId: userID})
		require.Len(t, cachedPlaybooks, 1)
		require.Equal(t, cachedPlaybooks[0], &playbook.CachedPlaybook{
			ID:                playbook3.ID,
			Title:             playbook3.Title,
			TeamID:            playbook3.TeamID,
			SignalAnyKeywords: playbook3.SignalAnyKeywords,
		})

		cachedPlaybooks = s.GetSuggestedPlaybooks(&model.Post{Message: "some message", ChannelId: channelID, UserId: userID})
		require.Len(t, cachedPlaybooks, 2)
		require.Equal(t, cachedPlaybooks[0], &playbook.CachedPlaybook{
			ID:                playbook4.ID,
			Title:             playbook4.Title,
			TeamID:            playbook4.TeamID,
			SignalAnyKeywords: playbook4.SignalAnyKeywords,
		})
		require.Equal(t, cachedPlaybooks[1], &playbook.CachedPlaybook{
			ID:                playbook3.ID,
			Title:             playbook3.Title,
			TeamID:            playbook3.TeamID,
			SignalAnyKeywords: playbook3.SignalAnyKeywords,
		})
	})
}
