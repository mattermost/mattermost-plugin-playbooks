package app_test

import (
	"testing"

	"github.com/golang/mock/gomock"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest"
	"github.com/stretchr/testify/mock"

	mock_app "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"
	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	mock_config "github.com/mattermost/mattermost-plugin-playbooks/server/config/mocks"
)

func TestMessageHasBeenPosted(t *testing.T) {
	var controller *gomock.Controller
	var pluginAPI *plugintest.API
	var client *pluginapi.Client
	var store *mock_app.MockChannelActionStore
	var logger *mock_bot.MockLogger
	var poster *mock_bot.MockPoster
	var configService *mock_config.MockService
	var keywordsIgnorer *mock_app.MockKeywordsThreadIgnorer
	var playbookService *mock_app.MockPlaybookService
	var channelActionService app.ChannelActionService

	reset := func(t *testing.T) {
		t.Helper()

		controller = gomock.NewController(t)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store = mock_app.NewMockChannelActionStore(controller)
		logger = mock_bot.NewMockLogger(controller)
		poster = mock_bot.NewMockPoster(controller)
		configService = mock_config.NewMockService(controller)
		keywordsIgnorer = mock_app.NewMockKeywordsThreadIgnorer(controller)
		playbookService = mock_app.NewMockPlaybookService(controller)

		channelActionService = app.NewChannelActionsService(client, logger, poster, configService, store, playbookService, keywordsIgnorer)
	}

	t.Run("message is ignored", func(t *testing.T) {
		reset(t)

		sessionID := model.NewId()
		post := &model.Post{UserId: model.NewId(), Message: "message", RootId: ""}

		keywordsIgnorer.EXPECT().IsIgnored(post.RootId, post.UserId).Return(true)
		poster.EXPECT().IsFromPoster(post).Return(false)
		channelActionService.MessageHasBeenPosted(sessionID, post)
	})

	t.Run("no suggestions", func(t *testing.T) {
		reset(t)

		sessionID := model.NewId()
		post := &model.Post{UserId: model.NewId(), Message: "some message", RootId: "", ChannelId: model.NewId()}

		keywordsIgnorer.EXPECT().IsIgnored(post.RootId, post.UserId).Return(false)
		poster.EXPECT().IsFromPoster(post).Return(false)

		actions := []app.GenericChannelAction{}
		store.EXPECT().GetChannelActions(post.ChannelId, app.GetChannelActionOptions{
			ActionType:  app.ActionTypePromptRunPlaybook,
			TriggerType: app.TriggerTypeKeywordsPosted,
		}).Return(actions, nil)

		channelActionService.MessageHasBeenPosted(sessionID, post)
		pluginAPI.AssertNotCalled(t, "GetSession", mock.Anything)
	})

	t.Run("can't get session", func(t *testing.T) {
		reset(t)

		sessionID := model.NewId()
		userID := model.NewId()
		post := &model.Post{UserId: userID, Message: "some message", RootId: "", ChannelId: model.NewId()}

		keywordsIgnorer.EXPECT().IsIgnored(post.RootId, post.UserId).Return(false)
		poster.EXPECT().IsFromPoster(post).Return(false)

		actions := []app.GenericChannelAction{}
		store.EXPECT().GetChannelActions(post.ChannelId, app.GetChannelActionOptions{
			ActionType:  app.ActionTypePromptRunPlaybook,
			TriggerType: app.TriggerTypeKeywordsPosted,
		}).Return(actions, nil)

		pluginAPI.On("GetSession", sessionID).Return(nil, &model.AppError{Id: "someID"})
		pluginAPI.On("LogError", "can't get session", "sessionID", sessionID, "err", mock.Anything)

		channelActionService.MessageHasBeenPosted(sessionID, post)
	})

	t.Run("suggest a playbook", func(t *testing.T) {
		reset(t)

		sessionID := model.NewId()
		userID := model.NewId()
		channelID := model.NewId()
		post := &model.Post{UserId: userID, Message: "some message", RootId: "", ChannelId: channelID}

		keywordsIgnorer.EXPECT().IsIgnored(post.RootId, post.UserId).Return(false)
		poster.EXPECT().IsFromPoster(post).Return(false)

		playbookID := model.NewId()
		playbook := app.Playbook{
			ID:    playbookID,
			Title: "A playbook",
		}

		actions := []app.GenericChannelAction{
			{
				GenericChannelActionWithoutPayload: app.GenericChannelActionWithoutPayload{
					ChannelID:   post.ChannelId,
					Enabled:     true,
					DeleteAt:    0,
					ActionType:  app.ActionTypePromptRunPlaybook,
					TriggerType: app.TriggerTypeKeywordsPosted,
				},
				Payload: app.PromptRunPlaybookFromKeywordsPayload{
					Keywords:   []string{"some"},
					PlaybookID: playbookID,
				},
			},
		}
		store.EXPECT().GetChannelActions(post.ChannelId, app.GetChannelActionOptions{
			ActionType:  app.ActionTypePromptRunPlaybook,
			TriggerType: app.TriggerTypeKeywordsPosted,
		}).Return(actions, nil)

		playbookService.EXPECT().Get(playbook.ID).Return(playbook, nil)

		pluginAPI.On("GetSession", sessionID).Return(&model.Session{}, nil)

		configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "id"}).AnyTimes()
		siteURL := "site"
		pluginAPI.On("GetConfig").Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: &siteURL}})

		poster.EXPECT().PostMessageToThread(gomock.Any(), gomock.Any())
		channelActionService.MessageHasBeenPosted(sessionID, post)
	})
}
