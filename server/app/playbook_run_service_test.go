package app_test

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-plugin-playbooks/server/telemetry"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	mock_app "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"
	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	mock_config "github.com/mattermost/mattermost-plugin-playbooks/server/config/mocks"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestCreatePlaybookRun(t *testing.T) {
	t.Run("invalid channel name has only invalid characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		teamID := model.NewId()
		playbookRun := &app.PlaybookRun{
			Name:   "###",
			TeamID: teamID,
		}

		store.EXPECT().CreatePlaybookRun(gomock.Any()).Return(playbookRun, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.display_name.app_error"})
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		_, err := s.CreatePlaybookRun(playbookRun, nil, "testUserID", true)
		require.Equal(t, err, app.ErrChannelDisplayNameInvalid)
	})

	t.Run("invalid channel name has only invalid characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		teamID := model.NewId()
		playbookRun := &app.PlaybookRun{
			Name:   "###",
			TeamID: teamID,
		}

		store.EXPECT().CreatePlaybookRun(gomock.Any()).Return(playbookRun, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.2_or_more.app_error"})

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		_, err := s.CreatePlaybookRun(playbookRun, nil, "testUserID", true)
		require.Equal(t, err, app.ErrChannelDisplayNameInvalid)
	})

	t.Run("channel name already exists, fixed on second try", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		teamID := model.NewId()
		playbookRun := &app.PlaybookRun{
			Name:                "###",
			TeamID:              teamID,
			OwnerUserID:         "user_id",
			ReporterUserID:      "user_id",
			BroadcastChannelIDs: []string{},
		}

		playbookRunWithID := *playbookRun
		playbookRunWithID.ID = model.NewId()

		store.EXPECT().CreatePlaybookRun(gomock.Any()).Return(&playbookRunWithID, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		pluginAPI.On("CreateChannel", &model.Channel{
			TeamId:      teamID,
			Type:        model.ChannelTypePrivate,
			DisplayName: "###",
			Name:        "",
			Header:      "The channel was created by the Playbooks plugin.",
		}).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", fmt.Sprintf("%s %s", model.ChannelAdminRoleId, model.ChannelUserRoleId)).Return(nil, nil)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()
		store.EXPECT().UpdatePlaybookRun(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("playbook_run_updated", gomock.Any(), "channel_id")
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)

		store.EXPECT().GetBroadcastChannelIDsToRootIDs(playbookRunWithID.ID).Return(map[string]string{}, nil)
		poster.EXPECT().PostMessage("channel_id", "This run has been started by @username.").
			Return(&model.Post{Id: "testPostId"}, nil)
		store.EXPECT().SetBroadcastChannelIDsToRootID(playbookRunWithID.ID, map[string]string{"channel_id": "testPostId"}).Return(nil)

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		_, err := s.CreatePlaybookRun(playbookRun, nil, "user_id", true)
		require.NoError(t, err)
	})

	t.Run("channel name already exists, failed second try", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		teamID := model.NewId()
		playbookRun := &app.PlaybookRun{
			Name:        "###",
			TeamID:      teamID,
			OwnerUserID: "user_id",
		}

		store.EXPECT().CreatePlaybookRun(gomock.Any()).Return(playbookRun, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		_, err := s.CreatePlaybookRun(playbookRun, nil, "user_id", true)
		require.EqualError(t, err, "failed to create channel: : , ")
	})

	t.Run("channel admin fails promotion fails", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		teamID := model.NewId()
		playbookRun := &app.PlaybookRun{
			Name:           "###",
			TeamID:         teamID,
			OwnerUserID:    "user_id",
			ReporterUserID: "user_id",
		}

		playbookRunWithID := *playbookRun
		playbookRunWithID.ID = model.NewId()

		store.EXPECT().CreatePlaybookRun(gomock.Any()).Return(&playbookRunWithID, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", fmt.Sprintf("%s %s", model.ChannelAdminRoleId, model.ChannelUserRoleId)).Return(nil, &model.AppError{Id: "api.channel.update_channel_member_roles.scheme_role.app_error"})
		pluginAPI.On("LogWarn", "failed to promote owner to admin", "ChannelID", "channel_id", "OwnerUserID", "user_id", "err", ": , ")
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()
		store.EXPECT().UpdatePlaybookRun(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("playbook_run_updated", gomock.Any(), "channel_id")
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)

		store.EXPECT().GetBroadcastChannelIDsToRootIDs(playbookRunWithID.ID).Return(map[string]string{}, nil)
		poster.EXPECT().PostMessage("channel_id", "This run has been started by @username.").
			Return(&model.Post{Id: "testPostId"}, nil)
		store.EXPECT().SetBroadcastChannelIDsToRootID(playbookRunWithID.ID, map[string]string{"channel_id": "testPostId"}).Return(nil)

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		_, err := s.CreatePlaybookRun(playbookRun, nil, "user_id", true)
		require.NoError(t, err)
	})

	t.Run("channel name has multibyte characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		teamID := model.NewId()
		playbookRun := &app.PlaybookRun{
			Name:           "ททททท",
			TeamID:         teamID,
			OwnerUserID:    "user_id",
			ReporterUserID: "user_id",
		}

		playbookRunWithID := *playbookRun
		playbookRunWithID.ID = model.NewId()

		store.EXPECT().CreatePlaybookRun(gomock.Any()).Return(&playbookRunWithID, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.MatchedBy(func(channel *model.Channel) bool {
			return channel.Name != ""
		})).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)

		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", fmt.Sprintf("%s %s", model.ChannelAdminRoleId, model.ChannelUserRoleId)).Return(nil, nil)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()
		store.EXPECT().UpdatePlaybookRun(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("playbook_run_updated", gomock.Any(), "channel_id")

		store.EXPECT().GetBroadcastChannelIDsToRootIDs(playbookRunWithID.ID).Return(map[string]string{}, nil)
		store.EXPECT().SetBroadcastChannelIDsToRootID(playbookRunWithID.ID, map[string]string{"channel_id": "testPostId"}).Return(nil)

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		_, err := s.CreatePlaybookRun(playbookRun, nil, "user_id", true)
		pluginAPI.AssertExpectations(t)
		require.NoError(t, err)
	})

	t.Run("webhook is sent on playbook run create", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		type webhookPayload struct {
			app.PlaybookRun
			ChannelURL string `json:"channel_url"`
			DetailsURL string `json:"details_url"`
		}

		webhookChan := make(chan webhookPayload)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := ioutil.ReadAll(r.Body)
			require.NoError(t, err)

			var p webhookPayload
			err = json.Unmarshal(body, &p)
			require.NoError(t, err)

			webhookChan <- p
		}))

		teamID := model.NewId()
		playbookRun := &app.PlaybookRun{
			ID:                    model.NewId(),
			Name:                  "Name",
			TeamID:                teamID,
			OwnerUserID:           "user_id",
			ReporterUserID:        "user_id",
			WebhookOnCreationURLs: []string{server.URL},
		}

		playbookRunWithID := *playbookRun
		playbookRunWithID.ID = model.NewId()

		store.EXPECT().CreatePlaybookRun(gomock.Any()).Return(&playbookRunWithID, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		store.EXPECT().UpdatePlaybookRun(gomock.Any()).Return(nil)

		configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "playbooks"}).Times(2)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()

		poster.EXPECT().PublishWebsocketEventToChannel("playbook_run_updated", gomock.Any(), "channel_id")

		store.EXPECT().GetBroadcastChannelIDsToRootIDs(playbookRunWithID.ID).Return(map[string]string{}, nil)
		store.EXPECT().SetBroadcastChannelIDsToRootID(playbookRunWithID.ID, map[string]string{"channel_id": "testPostId"}).Return(nil)

		siteURL := "http://example.com"
		pluginAPI.On("GetConfig").Return(&model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL:                             &siteURL,
				AllowedUntrustedInternalConnections: model.NewString("localhost,127.0.0.1"),
			},
		})
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", mock.Anything).Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", Name: "channel-name"}, nil)

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		createdPlaybookRun, err := s.CreatePlaybookRun(playbookRun, nil, "user_id", true)
		require.NoError(t, err)

		select {
		case payload := <-webhookChan:
			require.Equal(t, *createdPlaybookRun, payload.PlaybookRun)
			require.Equal(t,
				"http://example.com/ad-1/channels/channel-name",
				payload.ChannelURL)
			require.Equal(t,
				"http://example.com/playbooks/runs/"+createdPlaybookRun.ID,
				payload.DetailsURL)

		case <-time.After(time.Second * 5):
			require.Fail(t, "did not receive webhook")
		}

		pluginAPI.AssertExpectations(t)
	})
}

func TestUpdateStatus(t *testing.T) {
	t.Run("webhook is sent on status update; status messages are broadcast", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		type webhookPayload struct {
			app.PlaybookRun
			ChannelURL   string                  `json:"channel_url"`
			DetailsURL   string                  `json:"details_url"`
			StatusUpdate app.StatusUpdateOptions `json:"status_update"`
		}

		webhookChan := make(chan webhookPayload)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := ioutil.ReadAll(r.Body)
			require.NoError(t, err)

			var p webhookPayload
			err = json.Unmarshal(body, &p)
			require.NoError(t, err)

			webhookChan <- p
		}))

		playbookRunID := model.NewId()
		teamID := model.NewId()
		homeChannelID := "home_channel_id"
		broadcastChannelID1 := "broadcast_channel_id"
		broadcastChannelID2 := "broadcast_channel_id_2"
		playbookRun := &app.PlaybookRun{
			ID:                        playbookRunID,
			Name:                      "Name",
			TeamID:                    teamID,
			ChannelID:                 homeChannelID,
			BroadcastChannelIDs:       []string{broadcastChannelID1, broadcastChannelID2},
			OwnerUserID:               "user_id",
			ReporterUserID:            "user_id",
			CurrentStatus:             app.StatusInProgress,
			CreateAt:                  1620018358404,
			WebhookOnStatusUpdateURLs: []string{server.URL},
		}
		statusUpdateOptions := app.StatusUpdateOptions{
			Message:  "latest-message",
			Reminder: 0,
		}
		siteURL := "http://example.com"

		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		store.EXPECT().UpdatePlaybookRun(gomock.AssignableToTypeOf(&app.PlaybookRun{})).Return(nil)
		store.EXPECT().UpdateStatus(gomock.AssignableToTypeOf(&app.SQLStatusPost{})).Return(nil)
		store.EXPECT().GetPlaybookRun(gomock.Any()).Return(playbookRun, nil).Times(5)
		store.EXPECT().GetFollowers(gomock.Any()).Return([]string{}, nil)

		configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "playbooks"}).Times(2)

		poster.EXPECT().PublishWebsocketEventToChannel("playbook_run_updated", gomock.Any(), homeChannelID).Times(2)

		// there is an existing rootID stored, so no call to set.
		store.EXPECT().GetBroadcastChannelIDsToRootIDs(playbookRunID).
			Return(map[string]string{
				homeChannelID:       "homeRootPostID",
				broadcastChannelID1: "broadcastRootPostID1",
				broadcastChannelID2: "broadcastRootPostID2",
			}, nil).Times(3)
		poster.EXPECT().PostMessage(homeChannelID, statusUpdateOptions.Message).
			Return(&model.Post{Id: "testPostId", RootId: "homeRootPostID"}, nil)
		poster.EXPECT().PostMessageToThread("broadcastRootPostID1", gomock.Any()).
			// Set thet post RootID to the expected root ID from the map, so SetBroadcastChannelIDsToRootIDs is not called
			SetArg(1, model.Post{RootId: "broadcastRootPostID1"}).
			Return(nil)
		poster.EXPECT().PostMessageToThread("broadcastRootPostID2", gomock.Any()).
			// Set thet post RootID to the expected root ID from the map, so SetBroadcastChannelIDsToRootIDs is not called
			SetArg(1, model.Post{RootId: "broadcastRootPostID2"}).
			Return(nil)
		poster.EXPECT().Post(gomock.Any()).
			Return(nil)

		scheduler.EXPECT().Cancel(playbookRun.ID)

		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		mattermostConfig.ServiceSettings.SiteURL = &siteURL
		pluginAPI.On("CreatePost", mock.Anything).Return(&model.Post{}, nil)
		pluginAPI.On("GetChannel", homeChannelID).Return(&model.Channel{Id: homeChannelID, Name: "channel_name"}, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "team_name"}, nil)
		pluginAPI.On("GetUser", "user_id").Return(&model.User{}, nil)
		pluginAPI.On("GetConfig").Return(&model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL:                             &siteURL,
				AllowedUntrustedInternalConnections: model.NewString("localhost,127.0.0.1"),
			},
		})

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		err := s.UpdateStatus(playbookRun.ID, "user_id", statusUpdateOptions)
		require.NoError(t, err)

		select {
		case payload := <-webhookChan:
			require.Equal(t, *playbookRun, payload.PlaybookRun)
			require.Equal(t,
				"http://example.com/team_name/channels/channel_name",
				payload.ChannelURL)
			require.Equal(t,
				fmt.Sprintf("http://example.com/playbooks/runs/%s", playbookRunID),
				payload.DetailsURL)

		case <-time.After(time.Second * 5):
			require.Fail(t, "did not receive webhook on status update")
		}
	})
}

func TestRestorePlaybookRun(t *testing.T) {
	t.Run("Restore finished playbook", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		now := model.GetMillis()
		playbookRun := &app.PlaybookRun{
			ID:            "testPlaybookRunID",
			OwnerUserID:   "testUserID",
			CurrentStatus: app.StatusFinished,
			ChannelID:     "testChannelID",
			EndAt:         1,
		}
		post := &model.Post{Id: "testPostID"}
		user := &model.User{Id: "testUserID", Username: "testUsername"}
		event := &app.TimelineEvent{
			PlaybookRunID: playbookRun.ID,
			CreateAt:      now,
			EventAt:       now,
			EventType:     app.RunRestored,
			PostID:        post.Id,
			SubjectUserID: user.Id,
		}

		store.EXPECT().GetPlaybookRun(playbookRun.ID).Return(playbookRun, nil).Times(2)
		pluginAPI.On("GetUser", "testUserID").Return(user, nil)
		store.EXPECT().RestorePlaybookRun(playbookRun.ID, gomock.Any()).Return(nil)
		poster.EXPECT().PostMessage(playbookRun.ChannelID, "@testUsername changed this run's status from Finished to In Progress.").Return(post, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{})).Return(event, nil)
		poster.EXPECT().PublishWebsocketEventToChannel("playbook_run_updated", gomock.Any(), gomock.Any())

		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		err := s.RestorePlaybookRun("testPlaybookRunID", "testUserID")
		require.NoError(t, err)
	})

	t.Run("Restore unfinished playbook", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		playbookRun := &app.PlaybookRun{
			ID:            "testPlaybookRunID",
			OwnerUserID:   "testUserID",
			CurrentStatus: app.StatusInProgress,
			ChannelID:     "testChannelID",
			EndAt:         1,
		}

		store.EXPECT().GetPlaybookRun(playbookRun.ID).Return(playbookRun, nil).Times(1)

		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		err := s.RestorePlaybookRun("testPlaybookRunID", "testUserID")
		require.NoError(t, err)
	})
}

func TestUpdateStatusWebhookFailure(t *testing.T) {
	controller := gomock.NewController(t)
	pluginAPI := &plugintest.API{}
	client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
	store := mock_app.NewMockPlaybookRunStore(controller)
	poster := mock_bot.NewMockPoster(controller)
	logger := mock_bot.NewMockLogger(controller)
	configService := mock_config.NewMockService(controller)
	telemetryService := &telemetry.NoopTelemetry{}
	scheduler := mock_app.NewMockJobOnceScheduler(controller)
	playbookService := mock_app.NewMockPlaybookService(controller)

	type webhookPayload struct {
		app.PlaybookRun
		ChannelURL   string                  `json:"channel_url"`
		DetailsURL   string                  `json:"details_url"`
		StatusUpdate app.StatusUpdateOptions `json:"status_update"`
	}

	webhookChan := make(chan webhookPayload)

	playbookRunID := model.NewId()
	teamID := model.NewId()
	homeChannelID := "home_channel_id"
	broadcastChannelID1 := "broadcast_channel_id"
	broadcastChannelID2 := "broadcast_channel_id_2"
	playbookRun := &app.PlaybookRun{
		ID:                        playbookRunID,
		Name:                      "Name",
		TeamID:                    teamID,
		ChannelID:                 homeChannelID,
		BroadcastChannelIDs:       []string{broadcastChannelID1, broadcastChannelID2},
		OwnerUserID:               "user_id",
		ReporterUserID:            "user_id",
		CurrentStatus:             app.StatusInProgress,
		CreateAt:                  1620018358404,
		WebhookOnStatusUpdateURLs: []string{"http://localhost"},
	}
	statusUpdateOptions := app.StatusUpdateOptions{
		Message:  "latest-message",
		Reminder: 0,
	}
	siteURL := "http://example.com"

	store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
	store.EXPECT().UpdatePlaybookRun(gomock.AssignableToTypeOf(&app.PlaybookRun{})).Return(nil)
	store.EXPECT().UpdateStatus(gomock.AssignableToTypeOf(&app.SQLStatusPost{})).Return(nil)
	store.EXPECT().GetPlaybookRun(gomock.Any()).Return(playbookRun, nil).Times(5)
	store.EXPECT().GetFollowers(gomock.Any()).Return([]string{}, nil)

	configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "playbooks"}).Times(2)

	poster.EXPECT().PublishWebsocketEventToChannel("playbook_run_updated", gomock.Any(), homeChannelID).Times(2)

	// there is an existing rootID stored, so no call to set.
	store.EXPECT().GetBroadcastChannelIDsToRootIDs(playbookRunID).
		Return(map[string]string{
			homeChannelID:       "homeRootPostID",
			broadcastChannelID1: "broadcastRootPostID1",
			broadcastChannelID2: "broadcastRootPostID2",
		}, nil).Times(3)
	poster.EXPECT().PostMessage(homeChannelID, statusUpdateOptions.Message).
		Return(&model.Post{Id: "testPostId", RootId: "homeRootPostID"}, nil)
	poster.EXPECT().PostMessageToThread("broadcastRootPostID1", gomock.Any()).
		// Set the post RootID to the expected root ID from the map, so SetBroadcastChannelIDsToRootIDs is not called
		SetArg(1, model.Post{RootId: "broadcastRootPostID1"}).
		Return(nil)
	poster.EXPECT().PostMessageToThread("broadcastRootPostID2", gomock.Any()).
		// Set the post RootID to the expected root ID from the map, so SetBroadcastChannelIDsToRootIDs is not called
		SetArg(1, model.Post{RootId: "broadcastRootPostID2"}).
		Return(nil)
	poster.EXPECT().Post(gomock.Any()).
		Return(nil)

	scheduler.EXPECT().Cancel(playbookRun.ID)

	mattermostConfig := &model.Config{}
	mattermostConfig.SetDefaults()
	mattermostConfig.ServiceSettings.SiteURL = &siteURL
	pluginAPI.On("CreatePost", mock.Anything).Return(&model.Post{}, nil)
	pluginAPI.On("GetChannel", homeChannelID).Return(&model.Channel{Id: homeChannelID, Name: "channel_name"}, nil)
	pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "team_name"}, nil)
	pluginAPI.On("GetUser", "user_id").Return(&model.User{}, nil)
	pluginAPI.On("GetConfig").Return(&model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL:                             &siteURL,
			AllowedUntrustedInternalConnections: model.NewString("localhost,127.0.0.1"),
		},
	})
	pluginAPI.On("LogWarn", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	poster.EXPECT().PostMessage(homeChannelID, gomock.Any()).Return(nil, nil)

	s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

	err := s.UpdateStatus(playbookRun.ID, "user_id", statusUpdateOptions)
	require.NoError(t, err)

	select {
	case <-webhookChan:
		require.Fail(t, "recieved webhook when it shouldn't be allowed by AllowedUntrustedInternalConnections")
	case <-time.After(time.Second * 5):
	}
}

func TestOpenCreatePlaybookRunDialog(t *testing.T) {
	siteURL := "https://mattermost.example.com"

	type args struct {
		teamID      string
		ownerID     string
		triggerID   string
		postID      string
		clientID    string
		playbooks   []app.Playbook
		isMobileApp bool
	}
	tests := []struct {
		name      string
		args      args
		prepMocks func(t *testing.T, store *mock_app.MockPlaybookRunStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService)
		wantErr   bool
	}{
		{
			name: "successful webapp invocation without SiteURL",
			args: args{
				teamID:      "teamID",
				ownerID:     "ownerID",
				triggerID:   "triggerID",
				postID:      "postID",
				clientID:    "clientID",
				playbooks:   []app.Playbook{},
				isMobileApp: false,
			},
			prepMocks: func(t *testing.T, store *mock_app.MockPlaybookRunStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService) {
				api.On("GetTeam", "teamID").
					Return(&model.Team{Id: "teamID", Name: "Team"}, nil)
				api.On("GetUser", "ownerID").
					Return(&model.User{Id: "ownerID", Username: "User"}, nil)
				api.On("GetConfig").
					Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: model.NewString("")}})
				configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "pluginId"}).Times(2)
				api.On("OpenInteractiveDialog", mock.AnythingOfType("model.OpenDialogRequest")).Return(nil).Run(func(args mock.Arguments) {
					dialogRequest := args.Get(0).(model.OpenDialogRequest)
					assert.NotContains(t, dialogRequest.Dialog.IntroductionText, "create your own playbook")
				})
			},
			wantErr: false,
		},
		{
			name: "successful webapp invocation",
			args: args{
				teamID:      "teamID",
				ownerID:     "ownerID",
				triggerID:   "triggerID",
				postID:      "postID",
				clientID:    "clientID",
				playbooks:   []app.Playbook{},
				isMobileApp: false,
			},
			prepMocks: func(t *testing.T, store *mock_app.MockPlaybookRunStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService) {
				api.On("GetTeam", "teamID").
					Return(&model.Team{Id: "teamID", Name: "Team"}, nil)
				api.On("GetUser", "ownerID").
					Return(&model.User{Id: "ownerID", Username: "User"}, nil)
				api.On("GetConfig").
					Return(&model.Config{
						ServiceSettings: model.ServiceSettings{
							SiteURL: &siteURL,
						},
					})
				configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "pluginId"}).Times(2)
				api.On("OpenInteractiveDialog", mock.AnythingOfType("model.OpenDialogRequest")).Return(nil).Run(func(args mock.Arguments) {
					dialogRequest := args.Get(0).(model.OpenDialogRequest)
					assert.Contains(t, dialogRequest.Dialog.IntroductionText, "create your own playbook")
				})
			},
			wantErr: false,
		},
		{
			name: "successful mobile app invocation",
			args: args{
				teamID:      "teamID",
				ownerID:     "ownerID",
				triggerID:   "triggerID",
				postID:      "postID",
				clientID:    "clientID",
				playbooks:   []app.Playbook{},
				isMobileApp: true,
			},
			prepMocks: func(t *testing.T, store *mock_app.MockPlaybookRunStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService) {
				api.On("GetTeam", "teamID").
					Return(&model.Team{Id: "teamID", Name: "Team"}, nil)
				api.On("GetUser", "ownerID").
					Return(&model.User{Id: "ownerID", Username: "User"}, nil)
				api.On("GetConfig").
					Return(&model.Config{
						ServiceSettings: model.ServiceSettings{
							SiteURL: &siteURL,
						},
					})
				configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "pluginId"}).Times(2)
				api.On("OpenInteractiveDialog", mock.AnythingOfType("model.OpenDialogRequest")).Return(nil).Run(func(args mock.Arguments) {
					dialogRequest := args.Get(0).(model.OpenDialogRequest)
					assert.NotContains(t, dialogRequest.Dialog.IntroductionText, "create your own playbook")
				})
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			controller := gomock.NewController(t)
			api := &plugintest.API{}
			client := pluginapi.NewClient(api, &plugintest.Driver{})
			store := mock_app.NewMockPlaybookRunStore(controller)
			poster := mock_bot.NewMockPoster(controller)
			logger := mock_bot.NewMockLogger(controller)
			configService := mock_config.NewMockService(controller)
			telemetryService := &telemetry.NoopTelemetry{}
			scheduler := mock_app.NewMockJobOnceScheduler(controller)
			tt.prepMocks(t, store, poster, api, configService)
			playbookService := mock_app.NewMockPlaybookService(controller)
			service := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, api, playbookService)

			err := service.OpenCreatePlaybookRunDialog(tt.args.teamID, tt.args.ownerID, tt.args.triggerID, tt.args.postID, tt.args.clientID, tt.args.playbooks, tt.args.isMobileApp)
			if (err != nil) != tt.wantErr {
				t.Errorf("OpenCreatePlaybookRunDialog() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}

func TestUserHasJoinedChannel(t *testing.T) {
	/*
		t.Run("should add the new channel into the 'Playbook Runs' sidebar category if it already exists", func(t *testing.T) {
			controller := gomock.NewController(t)
			pluginAPI := &plugintest.API{}
			client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
			store := mock_app.NewMockPlaybookRunStore(controller)
			poster := mock_bot.NewMockPoster(controller)
			logger := mock_bot.NewMockLogger(controller)
			configService := mock_config.NewMockService(controller)
			telemetryService := &telemetry.NoopTelemetry{}
			scheduler := mock_app.NewMockJobOnceScheduler(controller)

			playbookRun := &app.PlaybookRun{CategoryName: "Playbook Runs"}
			sidebarCategories := []*model.SidebarCategoryWithChannels{
				{
					SidebarCategory: model.SidebarCategory{Id: "sidebar_category_id", DisplayName: "Playbook Runs"},
					Channels:        []string{},
				},
			}
			orderedSidebarCategories := &model.OrderedSidebarCategories{
				Categories: sidebarCategories,
				Order:      []string{},
			}

			store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{})).Return(nil, nil)
			store.EXPECT().GetPlaybookRunIDForChannel(gomock.Any()).Return("playbook_run_id", nil)
			store.EXPECT().GetPlaybookRun("playbook_run_id").Return(playbookRun, nil).Times(2)
			poster.EXPECT().PublishWebsocketEventToChannel(gomock.Any(), gomock.Any(), gomock.Any())
			pluginAPI.On("GetUser", "user_id").Return(&model.User{}, nil)
			pluginAPI.On("GetChannel", "channel_id").Return(&model.Channel{TeamId: "team_id"}, nil)
			pluginAPI.On("KVSetWithOptions", "mutex_playbook_run_categories", mock.Anything, mock.Anything).Return(true, nil)
			pluginAPI.On("GetChannelSidebarCategories", "user_id", "team_id").Return(orderedSidebarCategories, nil)
			pluginAPI.On(
				"UpdateChannelSidebarCategories",
				"user_id",
				"team_id",
				[]*model.SidebarCategoryWithChannels(orderedSidebarCategories.Categories),
			).Return(sidebarCategories, nil)
			pluginAPI.On("GetConfig").Return(&model.Config{})

			s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI)

			userID := "user_id"
			channelID := "channel_id"
			actorID := ""
			s.UserHasJoinedChannel(userID, channelID, actorID)

			assert.Equal(t, len(sidebarCategories[0].Channels), 1)
			assert.Equal(t, sidebarCategories[0].Channels[0], "channel_id")
		})
	*/

	t.Run("should create the 'Playbook Runs' sidebar category and add the channel if it does not exists", func(t *testing.T) {
		// In this test case we only assert that the methods were called with the apt parameters

		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		playbookRun := &app.PlaybookRun{ID: "playbook_run_id", CategoryName: "Playbook Runs"}
		existingSidebarCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{Id: "sidebar_category_id", DisplayName: "Test Category Sidebar"},
			Channels:        []string{},
		}
		orderedSidebarCategories := &model.OrderedSidebarCategories{
			Categories: []*model.SidebarCategoryWithChannels{existingSidebarCategory},
			Order:      []string{},
		}
		newSidebarCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      "user_id",
				TeamId:      "team_id",
				DisplayName: "Playbook Runs",
				Muted:       false,
			},
			Channels: []string{"channel_id"},
		}

		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{})).Return(nil, nil)
		store.EXPECT().GetPlaybookRunIDForChannel(gomock.Any()).Return("playbook_run_id", nil)
		store.EXPECT().GetPlaybookRun("playbook_run_id").Return(playbookRun, nil).Times(3)
		store.EXPECT().Follow("playbook_run_id", "user_id").Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel(gomock.Any(), gomock.Any(), gomock.Any())
		pluginAPI.On("GetUser", "user_id").Return(&model.User{}, nil)
		pluginAPI.On("GetChannel", "channel_id").Return(&model.Channel{TeamId: "team_id"}, nil)
		pluginAPI.On("KVSetWithOptions", "mutex_playbook_run_categories", mock.Anything, mock.Anything).Return(true, nil)
		pluginAPI.On("GetChannelSidebarCategories", "user_id", "team_id").Return(orderedSidebarCategories, nil)
		pluginAPI.On(
			"CreateChannelSidebarCategory",
			"user_id",
			"team_id",
			newSidebarCategory,
		).Return(newSidebarCategory, nil)
		pluginAPI.On("GetConfig").Return(&model.Config{})

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		userID := "user_id"
		channelID := "channel_id"
		actorID := ""

		s.UserHasJoinedChannel(userID, channelID, actorID)
	})

	/*
		t.Run("should add the new channel into the 'Playbook Runs 2' sidebar category if it already exists", func(t *testing.T) {
			controller := gomock.NewController(t)
			pluginAPI := &plugintest.API{}
			client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
			store := mock_app.NewMockPlaybookRunStore(controller)
			poster := mock_bot.NewMockPoster(controller)
			logger := mock_bot.NewMockLogger(controller)
			configService := mock_config.NewMockService(controller)
			telemetryService := &telemetry.NoopTelemetry{}
			scheduler := mock_app.NewMockJobOnceScheduler(controller)

			playbookRun := &app.PlaybookRun{CategoryName: "Playbook Runs 2"}
			sidebarCategories := []*model.SidebarCategoryWithChannels{
				{
					SidebarCategory: model.SidebarCategory{Id: "sidebar_category_id", DisplayName: "Playbook Runs 2"},
					Channels:        []string{},
				},
			}
			orderedSidebarCategories := &model.OrderedSidebarCategories{
				Categories: sidebarCategories,
				Order:      []string{},
			}

			store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{})).Return(nil, nil)
			store.EXPECT().GetPlaybookRunIDForChannel(gomock.Any()).Return("playbook_run_id", nil)
			store.EXPECT().GetPlaybookRun("playbook_run_id").Return(playbookRun, nil).Times(2)
			poster.EXPECT().PublishWebsocketEventToChannel(gomock.Any(), gomock.Any(), gomock.Any())
			pluginAPI.On("GetUser", "user_id").Return(&model.User{}, nil)
			pluginAPI.On("GetChannel", "channel_id").Return(&model.Channel{TeamId: "team_id"}, nil)
			pluginAPI.On("KVSetWithOptions", "mutex_playbook_run_categories", mock.Anything, mock.Anything).Return(true, nil)
			pluginAPI.On("GetChannelSidebarCategories", "user_id", "team_id").Return(orderedSidebarCategories, nil)
			pluginAPI.On(
				"UpdateChannelSidebarCategories",
				"user_id",
				"team_id",
				[]*model.SidebarCategoryWithChannels(orderedSidebarCategories.Categories),
			).Return(sidebarCategories, nil)
			pluginAPI.On("GetConfig").Return(&model.Config{})

			s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI)

			userID := "user_id"
			channelID := "channel_id"
			actorID := ""
			s.UserHasJoinedChannel(userID, channelID, actorID)

			assert.Equal(t, len(sidebarCategories[0].Channels), 1)
			assert.Equal(t, sidebarCategories[0].Channels[0], "channel_id")
		})
	*/

	t.Run("should create the 'Playbook Runs 2' sidebar category and add the channel if it does not exists", func(t *testing.T) {
		// In this test case we only assert that the methods were called with the apt parameters

		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		playbookRun := &app.PlaybookRun{ID: "playbook_run_id", CategoryName: "Playbook Runs 2"}
		existingSidebarCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{Id: "sidebar_category_id", DisplayName: "Test Category Sidebar"},
			Channels:        []string{},
		}
		orderedSidebarCategories := &model.OrderedSidebarCategories{
			Categories: []*model.SidebarCategoryWithChannels{existingSidebarCategory},
			Order:      []string{},
		}
		newSidebarCategory := &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      "user_id",
				TeamId:      "team_id",
				DisplayName: "Playbook Runs 2",
				Muted:       false,
			},
			Channels: []string{"channel_id"},
		}

		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{})).Return(nil, nil)
		store.EXPECT().GetPlaybookRunIDForChannel(gomock.Any()).Return("playbook_run_id", nil)
		store.EXPECT().GetPlaybookRun("playbook_run_id").Return(playbookRun, nil).Times(3)
		store.EXPECT().Follow("playbook_run_id", "user_id").Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel(gomock.Any(), gomock.Any(), gomock.Any())
		pluginAPI.On("GetUser", "user_id").Return(&model.User{}, nil)
		pluginAPI.On("GetChannel", "channel_id").Return(&model.Channel{TeamId: "team_id"}, nil)
		pluginAPI.On("KVSetWithOptions", "mutex_playbook_run_categories", mock.Anything, mock.Anything).Return(true, nil)
		pluginAPI.On("GetChannelSidebarCategories", "user_id", "team_id").Return(orderedSidebarCategories, nil)
		pluginAPI.On(
			"CreateChannelSidebarCategory",
			"user_id",
			"team_id",
			newSidebarCategory,
		).Return(newSidebarCategory, nil)
		pluginAPI.On("GetConfig").Return(&model.Config{})

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		userID := "user_id"
		channelID := "channel_id"
		actorID := ""

		s.UserHasJoinedChannel(userID, channelID, actorID)
	})
}

func TestMultipleWebhooks(t *testing.T) {
	t.Run("multiple webhooks are sent on playbook run create", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		type webhookPayload struct {
			app.PlaybookRun
			ChannelURL string `json:"channel_url"`
			DetailsURL string `json:"details_url"`
		}

		webhookChan := make(chan webhookPayload, 2)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := ioutil.ReadAll(r.Body)
			require.NoError(t, err)

			var p webhookPayload
			err = json.Unmarshal(body, &p)
			require.NoError(t, err)

			webhookChan <- p
		}))

		server2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := ioutil.ReadAll(r.Body)
			require.NoError(t, err)

			var p webhookPayload
			err = json.Unmarshal(body, &p)
			require.NoError(t, err)

			webhookChan <- p
		}))

		teamID := model.NewId()
		playbookRun := &app.PlaybookRun{
			ID:                    model.NewId(),
			Name:                  "Name",
			TeamID:                teamID,
			OwnerUserID:           "user_id",
			ReporterUserID:        "user_id",
			WebhookOnCreationURLs: []string{server.URL, server2.URL},
		}

		store.EXPECT().CreatePlaybookRun(gomock.Any()).Return(playbookRun, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		store.EXPECT().UpdatePlaybookRun(gomock.Any()).Return(nil)

		configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "com.mattermost.plugin-incident-management"}).Times(2)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()

		poster.EXPECT().PublishWebsocketEventToChannel("playbook_run_updated", gomock.Any(), "channel_id")
		poster.EXPECT().PostMessage("channel_id", gomock.Any()).Return(&model.Post{Id: "testId"}, nil)

		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		siteURL := "http://example.com"
		mattermostConfig.ServiceSettings.SiteURL = &siteURL
		mattermostConfig.ServiceSettings.AllowedUntrustedInternalConnections = model.NewString("localhost,127.0.0.1")
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", mock.Anything).Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", Name: "channel-name"}, nil)

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		createdPlaybookRun, err := s.CreatePlaybookRun(playbookRun, nil, "user_id", true)
		require.NoError(t, err)

		for i := 0; i < 2; i++ {
			select {
			case payload := <-webhookChan:
				require.Equal(t, *createdPlaybookRun, payload.PlaybookRun)
				require.Equal(t,
					"http://example.com/ad-1/channels/channel-name",
					payload.ChannelURL)
				require.Equal(t,
					"http://example.com/playbooks/runs/"+createdPlaybookRun.ID,
					payload.DetailsURL)

			case <-time.After(time.Second * 5):
				require.Fail(t, "did not receive webhook")
			}
		}

		pluginAPI.AssertExpectations(t)
	})

	t.Run("multiple webhooks are sent on status update", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		store := mock_app.NewMockPlaybookRunStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_app.NewMockJobOnceScheduler(controller)
		playbookService := mock_app.NewMockPlaybookService(controller)

		type webhookPayload struct {
			app.PlaybookRun
			ChannelURL   string                  `json:"channel_url"`
			DetailsURL   string                  `json:"details_url"`
			StatusUpdate app.StatusUpdateOptions `json:"status_update"`
		}

		webhookChan := make(chan webhookPayload)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := ioutil.ReadAll(r.Body)
			require.NoError(t, err)

			var p webhookPayload
			err = json.Unmarshal(body, &p)
			require.NoError(t, err)

			webhookChan <- p
		}))

		server2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, err := ioutil.ReadAll(r.Body)
			require.NoError(t, err)

			var p webhookPayload
			err = json.Unmarshal(body, &p)
			require.NoError(t, err)

			webhookChan <- p
		}))

		playbookRunID := model.NewId()
		teamID := model.NewId()
		homeChannelID := "home_channel_id"
		broadcastChannelID1 := "broadcast_channel_id"
		broadcastChannelID2 := "broadcast_channel_id_2"
		playbookRun := &app.PlaybookRun{
			ID:                        playbookRunID,
			Name:                      "Name",
			TeamID:                    teamID,
			ChannelID:                 homeChannelID,
			BroadcastChannelIDs:       []string{broadcastChannelID1, broadcastChannelID2},
			OwnerUserID:               "user_id",
			ReporterUserID:            "user_id",
			CurrentStatus:             app.StatusInProgress,
			CreateAt:                  1620018358404,
			WebhookOnStatusUpdateURLs: []string{server.URL, server2.URL},
		}
		statusUpdateOptions := app.StatusUpdateOptions{
			Message:  "latest-message",
			Reminder: 0,
		}
		siteURL := "http://example.com"

		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&app.TimelineEvent{}))
		store.EXPECT().UpdatePlaybookRun(gomock.AssignableToTypeOf(&app.PlaybookRun{})).Return(nil)
		store.EXPECT().UpdateStatus(gomock.AssignableToTypeOf(&app.SQLStatusPost{})).Return(nil)
		store.EXPECT().GetPlaybookRun(gomock.Any()).Return(playbookRun, nil).Times(5)
		store.EXPECT().GetFollowers(gomock.Any()).Return([]string{}, nil)

		configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "com.mattermost.plugin-incident-management"}).Times(2)

		poster.EXPECT().PublishWebsocketEventToChannel("playbook_run_updated", gomock.Any(), homeChannelID).Times(2)

		// there is an existing rootID stored, so no call to set.
		store.EXPECT().GetBroadcastChannelIDsToRootIDs(playbookRunID).
			Return(map[string]string{
				homeChannelID:       "homeRootPostID",
				broadcastChannelID1: "broadcastRootPostID1",
				broadcastChannelID2: "broadcastRootPostID2",
			}, nil).Times(3)
		poster.EXPECT().Post(gomock.Any()).Return(nil)
		poster.EXPECT().PostMessageToThread("broadcastRootPostID1", gomock.Any()).
			// Set the post RootID to the expected root ID from the map, so SetBroadcastChannelIDsToRootIDs is not called
			SetArg(1, model.Post{RootId: "broadcastRootPostID1"}).
			Return(nil)
		poster.EXPECT().PostMessageToThread("broadcastRootPostID2", gomock.Any()).
			// Set the post RootID to the expected root ID from the map, so SetBroadcastChannelIDsToRootIDs is not called
			SetArg(1, model.Post{RootId: "broadcastRootPostID2"}).
			Return(nil)

		scheduler.EXPECT().Cancel(playbookRun.ID)

		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		mattermostConfig.ServiceSettings.SiteURL = &siteURL
		mattermostConfig.ServiceSettings.AllowedUntrustedInternalConnections = model.NewString("localhost,127.0.0.1")
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreatePost", mock.Anything).Return(&model.Post{}, nil)
		pluginAPI.On("GetChannel", homeChannelID).Return(&model.Channel{Id: homeChannelID, Name: "channel_name"}, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "team_name"}, nil)
		pluginAPI.On("GetUser", "user_id").Return(&model.User{}, nil)

		s := app.NewPlaybookRunService(client, store, poster, logger, configService, scheduler, telemetryService, pluginAPI, playbookService)

		err := s.UpdateStatus(playbookRun.ID, "user_id", statusUpdateOptions)
		require.NoError(t, err)

		for i := 0; i < 2; i++ {
			select {
			case payload := <-webhookChan:
				require.Equal(t, *playbookRun, payload.PlaybookRun)
				require.Equal(t,
					"http://example.com/team_name/channels/channel_name",
					payload.ChannelURL)
				require.Equal(t,
					fmt.Sprintf("http://example.com/playbooks/runs/%s", playbookRunID),
					payload.DetailsURL)

			case <-time.After(time.Second * 5):
				require.Fail(t, "did not receive webhook on status update")
			}
		}
	})
}
