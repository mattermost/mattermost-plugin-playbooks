package app_test

import (
	"testing"

	"github.com/golang/mock/gomock"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/telemetry"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest"
	"github.com/stretchr/testify/mock"

	mock_playbook "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"
	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	mock_config "github.com/mattermost/mattermost-plugin-playbooks/server/config/mocks"
)

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

		message := fmt.Sprintf("`some` is a trigger for the [%s](%s) playbook, would you like to run it?", playbooks[2].Title, fmt.Sprintf("/playbooks/playbooks/%s", playbooks[2].ID))
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
