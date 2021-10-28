package app_test

import (
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/telemetry"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	mock_playbook "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"
	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	mock_config "github.com/mattermost/mattermost-plugin-playbooks/server/config/mocks"
)

func TestGetSuggestedPlaybooks(t *testing.T) {
	t.Run("can't get time last updated", func(t *testing.T) {
		s, store, pluginAPI, _ := getMockPlaybookService(t)

		store.EXPECT().GetTimeLastUpdated(true).Return(int64(0), errors.New("store error"))
		pluginAPI.On("LogError", "can't update playbooks", "err", mock.Anything)

		playbooks, triggers := s.GetSuggestedPlaybooks("teamID", "userID", "message")
		require.Len(t, playbooks, 0)
		require.Len(t, triggers, 0)
	})

	t.Run("can't get playbooks with keywords", func(t *testing.T) {
		s, store, pluginAPI, _ := getMockPlaybookService(t)

		store.EXPECT().GetTimeLastUpdated(true).Return(int64(1000), nil)
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(nil, errors.New("store error"))
		pluginAPI.On("LogError", "can't update playbooks", "err", mock.Anything)

		playbooks, triggers := s.GetSuggestedPlaybooks("teamID", "userID", "message")
		require.Len(t, playbooks, 0)
		require.Len(t, triggers, 0)
	})

	t.Run("no playbooks have been triggered", func(t *testing.T) {
		s, store, _, _ := getMockPlaybookService(t)

		teamID := model.NewId()

		store.EXPECT().GetTimeLastUpdated(true).Return(int64(1000), nil)
		playbooks := []app.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdateAt:          100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdateAt:          1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdateAt:          900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{" some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)

		cachedPlaybooks, triggers := s.GetSuggestedPlaybooks(teamID, "userID", "message")
		require.Len(t, cachedPlaybooks, 0)
		require.Len(t, triggers, 0)
	})

	t.Run("can't get playbookIDs", func(t *testing.T) {
		s, store, pluginAPI, _ := getMockPlaybookService(t)

		teamID := model.NewId()

		store.EXPECT().GetTimeLastUpdated(true).Return(int64(1000), nil)
		playbooks := []app.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdateAt:          100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"some", "bla"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)

		userID := model.NewId()
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return(nil, errors.New("store error"))
		pluginAPI.On("LogError", "can't get playbookIDs", "userID", userID, "err", mock.Anything)

		cachedPlaybooks, triggers := s.GetSuggestedPlaybooks(teamID, "userID", "message")
		require.Len(t, cachedPlaybooks, 0)
		require.Len(t, triggers, 0)
	})

	t.Run("user has no playbooks", func(t *testing.T) {
		s, store, _, _ := getMockPlaybookService(t)

		teamID := model.NewId()

		store.EXPECT().GetTimeLastUpdated(true).Return(int64(1000), nil)
		playbooks := []app.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdateAt:          100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdateAt:          1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdateAt:          900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)
		userID := model.NewId()
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return([]string{"some_dummy_id"}, nil)
		cachedPlaybooks, triggers := s.GetSuggestedPlaybooks(teamID, userID, "message")
		require.Len(t, cachedPlaybooks, 0)
		require.Len(t, triggers, 0)
	})

	t.Run("trigger single playbook", func(t *testing.T) {
		s, store, _, _ := getMockPlaybookService(t)

		teamID := model.NewId()

		store.EXPECT().GetTimeLastUpdated(true).Return(int64(1000), nil)
		playbooks := []app.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdateAt:          100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdateAt:          1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdateAt:          900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)
		userID := model.NewId()
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return([]string{playbooks[1].ID, playbooks[2].ID}, nil)
		cachedPlaybooks, triggers := s.GetSuggestedPlaybooks(teamID, userID, "some message")
		require.Len(t, cachedPlaybooks, 1)
		require.Equal(t, cachedPlaybooks[0], &app.CachedPlaybook{
			ID:                playbooks[2].ID,
			Title:             playbooks[2].Title,
			TeamID:            playbooks[2].TeamID,
			SignalAnyKeywords: playbooks[2].SignalAnyKeywords,
		})
		require.Equal(t, triggers, []string{"some"})
	})

	t.Run("same call should not trigger the GetPlaybooksWithKeywords second time", func(t *testing.T) {
		s, store, _, _ := getMockPlaybookService(t)

		teamID := model.NewId()

		firstCall := store.EXPECT().GetTimeLastUpdated(true).Return(int64(1000), nil)
		store.EXPECT().GetTimeLastUpdated(true).Return(int64(1100), nil).After(firstCall)
		playbooks := []app.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdateAt:          100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdateAt:          1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdateAt:          900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil).Times(1)
		userID := model.NewId()
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return([]string{playbooks[1].ID, playbooks[2].ID}, nil).Times(2)
		cachedPlaybooks, triggers := s.GetSuggestedPlaybooks(teamID, userID, "some message")
		require.Len(t, cachedPlaybooks, 1)
		require.Equal(t, cachedPlaybooks[0], &app.CachedPlaybook{
			ID:                playbooks[2].ID,
			Title:             playbooks[2].Title,
			TeamID:            playbooks[2].TeamID,
			SignalAnyKeywords: playbooks[2].SignalAnyKeywords,
		})
		require.Equal(t, triggers, []string{"some"})

		cachedPlaybooks, triggers = s.GetSuggestedPlaybooks(teamID, userID, "some message")
		require.Len(t, cachedPlaybooks, 1)
		require.Equal(t, cachedPlaybooks[0], &app.CachedPlaybook{
			ID:                playbooks[2].ID,
			Title:             playbooks[2].Title,
			TeamID:            playbooks[2].TeamID,
			SignalAnyKeywords: playbooks[2].SignalAnyKeywords,
		})
		require.Equal(t, triggers, []string{"some"})
	})

	t.Run("same call should trigger the GetPlaybooksWithKeywords", func(t *testing.T) {
		s, store, _, _ := getMockPlaybookService(t)

		teamID := model.NewId()

		firstCall := store.EXPECT().GetTimeLastUpdated(true).Return(int64(1000), nil)
		store.EXPECT().GetTimeLastUpdated(true).Return(int64(1200), nil).After(firstCall)
		playbook1 := app.Playbook{
			ID:                model.NewId(),
			Title:             "playbook 1",
			UpdateAt:          100,
			TeamID:            "",
			SignalAnyKeywords: []string{"some", "bla"},
		}
		playbook2 := app.Playbook{
			ID:                model.NewId(),
			Title:             "playbook 2",
			UpdateAt:          1100,
			TeamID:            teamID,
			SignalAnyKeywords: []string{"bla", "something"},
		}
		playbook3 := app.Playbook{
			ID:                model.NewId(),
			Title:             "playbook 3",
			UpdateAt:          900,
			TeamID:            teamID,
			SignalAnyKeywords: []string{"some", "other"},
		}

		playbook4 := app.Playbook{
			ID:                playbook2.ID,
			Title:             playbook2.Title,
			UpdateAt:          1200,
			TeamID:            playbook2.TeamID,
			SignalAnyKeywords: []string{"bla", "message"},
		}
		playbooks1 := []app.Playbook{playbook1, playbook2, playbook3}
		playbooks2 := []app.Playbook{playbook1, playbook4, playbook3}

		firstGetPlaybooks := store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks1, nil)
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks2, nil).After(firstGetPlaybooks)

		userID := model.NewId()
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return([]string{playbooks1[1].ID, playbooks1[2].ID}, nil).Times(2)
		cachedPlaybooks, triggers := s.GetSuggestedPlaybooks(teamID, userID, "some message")
		require.Len(t, cachedPlaybooks, 1)
		require.Equal(t, cachedPlaybooks[0], &app.CachedPlaybook{
			ID:                playbook3.ID,
			Title:             playbook3.Title,
			TeamID:            playbook3.TeamID,
			SignalAnyKeywords: playbook3.SignalAnyKeywords,
		})
		require.Equal(t, triggers, []string{"some"})

		cachedPlaybooks, triggers = s.GetSuggestedPlaybooks(teamID, userID, "some message")
		require.Len(t, cachedPlaybooks, 2)
		require.Equal(t, cachedPlaybooks[0], &app.CachedPlaybook{
			ID:                playbook4.ID,
			Title:             playbook4.Title,
			TeamID:            playbook4.TeamID,
			SignalAnyKeywords: playbook4.SignalAnyKeywords,
		})
		require.Equal(t, cachedPlaybooks[1], &app.CachedPlaybook{
			ID:                playbook3.ID,
			Title:             playbook3.Title,
			TeamID:            playbook3.TeamID,
			SignalAnyKeywords: playbook3.SignalAnyKeywords,
		})
		require.ElementsMatch(t, triggers, []string{"some", "message"})
	})
}

func TestMessageHasBeenPosted(t *testing.T) {
	t.Run("message is ignored", func(t *testing.T) {
		s, _, _, keywordsIgnorer := getMockPlaybookService(t)

		sessionID := model.NewId()
		post := &model.Post{UserId: model.NewId(), Message: "message", RootId: ""}

		keywordsIgnorer.EXPECT().IsIgnored(post.RootId, post.UserId).Return(true)
		s.MessageHasBeenPosted(sessionID, post)
	})

	t.Run("can't get channel", func(t *testing.T) {
		s, _, pluginAPI, keywordsIgnorer := getMockPlaybookService(t)

		sessionID := model.NewId()
		post := &model.Post{UserId: model.NewId(), Message: "message", RootId: "", ChannelId: model.NewId()}

		keywordsIgnorer.EXPECT().IsIgnored(post.RootId, post.UserId).Return(false)

		pluginAPI.On("GetChannel", post.ChannelId).Return(nil, &model.AppError{Id: "someID"})
		pluginAPI.On("LogError", "can't get channel", "err", mock.Anything)

		s.MessageHasBeenPosted(sessionID, post)
	})

	t.Run("no suggestions", func(t *testing.T) {
		s, store, pluginAPI, keywordsIgnorer := getMockPlaybookService(t)

		sessionID := model.NewId()
		post := &model.Post{UserId: model.NewId(), Message: "some message", RootId: "", ChannelId: model.NewId()}

		keywordsIgnorer.EXPECT().IsIgnored(post.RootId, post.UserId).Return(false)

		teamID := model.NewId()
		pluginAPI.On("GetChannel", post.ChannelId).Return(&model.Channel{TeamId: teamID}, nil)

		store.EXPECT().GetTimeLastUpdated(true).Return(int64(1000), nil)
		playbooks := []app.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdateAt:          100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdateAt:          1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdateAt:          900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{" some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)
		s.MessageHasBeenPosted(sessionID, post)
		pluginAPI.AssertNotCalled(t, "GetSession", mock.Anything)
	})

	t.Run("can't get session", func(t *testing.T) {
		s, store, pluginAPI, keywordsIgnorer := getMockPlaybookService(t)

		sessionID := model.NewId()
		userID := model.NewId()
		post := &model.Post{UserId: userID, Message: "some message", RootId: "", ChannelId: model.NewId()}

		keywordsIgnorer.EXPECT().IsIgnored(post.RootId, post.UserId).Return(false)

		teamID := model.NewId()
		pluginAPI.On("GetChannel", post.ChannelId).Return(&model.Channel{TeamId: teamID}, nil)

		store.EXPECT().GetTimeLastUpdated(true).Return(int64(1000), nil)
		playbooks := []app.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdateAt:          100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdateAt:          1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdateAt:          900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return([]string{playbooks[1].ID, playbooks[2].ID}, nil)
		pluginAPI.On("GetSession", sessionID).Return(nil, &model.AppError{Id: "someID"})
		pluginAPI.On("LogError", "can't get session", "sessionID", sessionID, "err", mock.Anything)

		s.MessageHasBeenPosted(sessionID, post)
	})

	t.Run("suggest a playbook", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_playbook.NewMockPlaybookStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		configService := mock_config.NewMockService(controller)
		keywordsIgnorer := mock_playbook.NewMockKeywordsThreadIgnorer(controller)
		s := app.NewPlaybookService(store, poster, telemetryService, client, configService, keywordsIgnorer)

		sessionID := model.NewId()
		userID := model.NewId()
		channelID := model.NewId()
		post := &model.Post{UserId: userID, Message: "some message", RootId: "", ChannelId: channelID}

		keywordsIgnorer.EXPECT().IsIgnored(post.RootId, post.UserId).Return(false)

		teamID := model.NewId()
		pluginAPI.On("GetChannel", channelID).Return(&model.Channel{TeamId: teamID}, nil)

		store.EXPECT().GetTimeLastUpdated(true).Return(int64(1000), nil)
		playbooks := []app.Playbook{
			{
				ID:                model.NewId(),
				Title:             "playbook 1",
				UpdateAt:          100,
				TeamID:            "",
				SignalAnyKeywords: []string{"some", "bla"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 2",
				UpdateAt:          1100,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"bla", "something"},
			},
			{
				ID:                model.NewId(),
				Title:             "playbook 3",
				UpdateAt:          900,
				TeamID:            teamID,
				SignalAnyKeywords: []string{"some", "other"},
			},
		}
		store.EXPECT().GetPlaybooksWithKeywords(gomock.Any()).Return(playbooks, nil)
		store.EXPECT().GetPlaybookIDsForUser(userID, teamID).Return([]string{playbooks[1].ID, playbooks[2].ID}, nil)
		pluginAPI.On("GetSession", sessionID).Return(&model.Session{}, nil)

		configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "id"}).AnyTimes()
		siteURL := "site"
		pluginAPI.On("GetConfig").Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: &siteURL}})

		message := fmt.Sprintf("`some` is a trigger for the [%s](%s) playbook, would you like to run it?", playbooks[2].Title, fmt.Sprintf("site/playbooks/playbooks/%s", playbooks[2].ID))
		poster.EXPECT().EphemeralPostWithAttachments(userID, channelID, post.Id, gomock.Any(), message)
		s.MessageHasBeenPosted(sessionID, post)
	})
}

func getMockPlaybookService(t *testing.T) (app.PlaybookService, *mock_playbook.MockPlaybookStore, *plugintest.API, *mock_playbook.MockKeywordsThreadIgnorer) {
	controller := gomock.NewController(t)
	pluginAPI := &plugintest.API{}
	client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
	store := mock_playbook.NewMockPlaybookStore(controller)
	poster := mock_bot.NewMockPoster(controller)
	telemetryService := &telemetry.NoopTelemetry{}
	configService := mock_config.NewMockService(controller)
	keywordsIgnorer := mock_playbook.NewMockKeywordsThreadIgnorer(controller)
	return app.NewPlaybookService(store, poster, telemetryService, client, configService, keywordsIgnorer), store, pluginAPI, keywordsIgnorer
}
