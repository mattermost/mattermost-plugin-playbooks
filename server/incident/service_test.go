package incident_test

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/telemetry"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	mock_bot "github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot/mocks"
	mock_config "github.com/mattermost/mattermost-plugin-incident-collaboration/server/config/mocks"
	mock_incident "github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident/mocks"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestCreateIncident(t *testing.T) {
	t.Run("invalid channel name has only invalid characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_incident.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Name:   "###",
			TeamID: teamID,
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.display_name.app_error"})
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "testUserID", true)
		require.Equal(t, err, incident.ErrChannelDisplayNameInvalid)
	})

	t.Run("invalid channel name has only invalid characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_incident.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Name:   "###",
			TeamID: teamID,
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.2_or_more.app_error"})

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "testUserID", true)
		require.Equal(t, err, incident.ErrChannelDisplayNameInvalid)
	})

	t.Run("channel name already exists, fixed on second try", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_incident.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Name:            "###",
			TeamID:          teamID,
			CommanderUserID: "user_id",
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&incident.TimelineEvent{}))
		pluginAPI.On("CreateChannel", &model.Channel{
			TeamId:      teamID,
			Type:        model.CHANNEL_PRIVATE,
			DisplayName: "###",
			Name:        "",
			Header:      "The channel was created by the Incident Collaboration plugin.",
		}).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", fmt.Sprintf("%s %s", model.CHANNEL_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID)).Return(nil, nil)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been started and is commanded by @username.").
			Return(&model.Post{Id: "testId"}, nil)

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "user_id", true)
		require.NoError(t, err)
	})

	t.Run("channel name already exists, failed second try", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_incident.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Name:            "###",
			TeamID:          teamID,
			CommanderUserID: "user_id",
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "user_id", true)
		require.EqualError(t, err, "failed to create incident channel: : , ")
	})

	t.Run("channel admin fails promotion fails", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_incident.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Name:            "###",
			TeamID:          teamID,
			CommanderUserID: "user_id",
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&incident.TimelineEvent{}))
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", fmt.Sprintf("%s %s", model.CHANNEL_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID)).Return(nil, &model.AppError{Id: "api.channel.update_channel_member_roles.scheme_role.app_error"})
		pluginAPI.On("LogWarn", "failed to promote commander to admin", "ChannelID", "channel_id", "CommanderUserID", "user_id", "err", ": , ")
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been started and is commanded by @username.").
			Return(&model.Post{Id: "testid"}, nil)

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "user_id", true)
		require.NoError(t, err)
	})

	t.Run("channel name has multibyte characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_incident.NewMockJobOnceScheduler(controller)

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Name:            "ททททท",
			TeamID:          teamID,
			CommanderUserID: "user_id",
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&incident.TimelineEvent{}))
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("CreateChannel", mock.MatchedBy(func(channel *model.Channel) bool {
			return channel.Name != ""
		})).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)

		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", fmt.Sprintf("%s %s", model.CHANNEL_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID)).Return(nil, nil)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been started and is commanded by @username.").
			Return(&model.Post{Id: "testId"}, nil)

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, nil, "user_id", true)
		pluginAPI.AssertExpectations(t)
		require.NoError(t, err)
	})

	t.Run("webhook is sent", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_incident.NewMockJobOnceScheduler(controller)

		type webhookPayload struct {
			incident.Incident
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
		incdnt := &incident.Incident{
			ID:                   "incidentID",
			Name:                 "Incident Name",
			TeamID:               teamID,
			CommanderUserID:      "user_id",
			WebhookOnCreationURL: server.URL,
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&incident.TimelineEvent{}))
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)

		configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "com.mattermost.plugin-incident-management"}).Times(2)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"}).AnyTimes()

		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		poster.EXPECT().PostMessage("channel_id", gomock.Any()).Return(&model.Post{Id: "testId"}, nil)

		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		siteURL := "http://example.com"
		mattermostConfig.ServiceSettings.SiteURL = &siteURL
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", TeamId: "team_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", mock.Anything).Return(nil, nil)
		pluginAPI.On("CreateTeamMember", "team_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("AddChannelMember", "channel_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", Name: "incident-channel-name"}, nil)

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		createdIncident, err := s.CreateIncident(incdnt, nil, "user_id", true)
		require.NoError(t, err)

		select {
		case payload := <-webhookChan:
			require.Equal(t, *createdIncident, payload.Incident)
			require.Equal(t,
				"http://example.com/ad-1/channels/incident-channel-name",
				payload.ChannelURL)
			require.Equal(t,
				"http://example.com/ad-1/com.mattermost.plugin-incident-management/incidents/"+createdIncident.ID,
				payload.DetailsURL)

		case <-time.After(time.Second * 5):
			require.Fail(t, "did not receive webhook")
		}

		pluginAPI.AssertExpectations(t)
	})
}

func TestOpenCreateIncidentDialog(t *testing.T) {
	siteURL := "https://mattermost.example.com"

	type args struct {
		teamID      string
		commanderID string
		triggerID   string
		postID      string
		clientID    string
		playbooks   []playbook.Playbook
		isMobileApp bool
	}
	tests := []struct {
		name      string
		args      args
		prepMocks func(t *testing.T, store *mock_incident.MockStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService)
		wantErr   bool
	}{
		{
			name: "successful webapp invocation without SiteURL",
			args: args{
				teamID:      "teamID",
				commanderID: "commanderID",
				triggerID:   "triggerID",
				postID:      "postID",
				clientID:    "clientID",
				playbooks:   []playbook.Playbook{},
				isMobileApp: false,
			},
			prepMocks: func(t *testing.T, store *mock_incident.MockStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService) {
				api.On("GetTeam", "teamID").
					Return(&model.Team{Id: "teamID", Name: "Team"}, nil)
				api.On("GetUser", "commanderID").
					Return(&model.User{Id: "commanderID", Username: "User"}, nil)
				api.On("GetConfig").
					Return(&model.Config{ServiceSettings: model.ServiceSettings{SiteURL: model.NewString("")}})
				configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "pluginId"}).Times(2)
				api.On("OpenInteractiveDialog", mock.AnythingOfType("model.OpenDialogRequest")).Return(nil).Run(func(args mock.Arguments) {
					dialogRequest := args.Get(0).(model.OpenDialogRequest)
					assert.NotContains(t, dialogRequest.Dialog.IntroductionText, "Create a playbook")
				})
			},
			wantErr: false,
		},
		{
			name: "successful webapp invocation",
			args: args{
				teamID:      "teamID",
				commanderID: "commanderID",
				triggerID:   "triggerID",
				postID:      "postID",
				clientID:    "clientID",
				playbooks:   []playbook.Playbook{},
				isMobileApp: false,
			},
			prepMocks: func(t *testing.T, store *mock_incident.MockStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService) {
				api.On("GetTeam", "teamID").
					Return(&model.Team{Id: "teamID", Name: "Team"}, nil)
				api.On("GetUser", "commanderID").
					Return(&model.User{Id: "commanderID", Username: "User"}, nil)
				api.On("GetConfig").
					Return(&model.Config{
						ServiceSettings: model.ServiceSettings{
							SiteURL: &siteURL,
						},
					})
				configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "pluginId"}).Times(2)
				api.On("OpenInteractiveDialog", mock.AnythingOfType("model.OpenDialogRequest")).Return(nil).Run(func(args mock.Arguments) {
					dialogRequest := args.Get(0).(model.OpenDialogRequest)
					assert.Contains(t, dialogRequest.Dialog.IntroductionText, "Create a playbook")
				})
			},
			wantErr: false,
		},
		{
			name: "successful mobile app invocation",
			args: args{
				teamID:      "teamID",
				commanderID: "commanderID",
				triggerID:   "triggerID",
				postID:      "postID",
				clientID:    "clientID",
				playbooks:   []playbook.Playbook{},
				isMobileApp: true,
			},
			prepMocks: func(t *testing.T, store *mock_incident.MockStore, poster *mock_bot.MockPoster, api *plugintest.API, configService *mock_config.MockService) {
				api.On("GetTeam", "teamID").
					Return(&model.Team{Id: "teamID", Name: "Team"}, nil)
				api.On("GetUser", "commanderID").
					Return(&model.User{Id: "commanderID", Username: "User"}, nil)
				api.On("GetConfig").
					Return(&model.Config{
						ServiceSettings: model.ServiceSettings{
							SiteURL: &siteURL,
						},
					})
				configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "pluginId"}).Times(2)
				api.On("OpenInteractiveDialog", mock.AnythingOfType("model.OpenDialogRequest")).Return(nil).Run(func(args mock.Arguments) {
					dialogRequest := args.Get(0).(model.OpenDialogRequest)
					assert.NotContains(t, dialogRequest.Dialog.IntroductionText, "Create a playbook")
				})
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			controller := gomock.NewController(t)
			api := &plugintest.API{}
			client := pluginapi.NewClient(api)
			store := mock_incident.NewMockStore(controller)
			poster := mock_bot.NewMockPoster(controller)
			logger := mock_bot.NewMockLogger(controller)
			configService := mock_config.NewMockService(controller)
			telemetryService := &telemetry.NoopTelemetry{}
			scheduler := mock_incident.NewMockJobOnceScheduler(controller)
			service := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

			tt.prepMocks(t, store, poster, api, configService)

			err := service.OpenCreateIncidentDialog(tt.args.teamID, tt.args.commanderID, tt.args.triggerID, tt.args.postID, tt.args.clientID, tt.args.playbooks, tt.args.isMobileApp)
			if (err != nil) != tt.wantErr {
				t.Errorf("OpenCreateIncidentDialog() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}

func TestUpdateStatus(t *testing.T) {

	// send webhook on status archived
	t.Run("webhook is sent", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_bot.NewMockPoster(controller)
		logger := mock_bot.NewMockLogger(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}
		scheduler := mock_incident.NewMockJobOnceScheduler(controller)

		type webhookPayload struct {
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
		incdnt := &incident.Incident{
			ID:                  "incidentID",
			Name:                "Incident Name",
			TeamID:              teamID,
			CommanderUserID:     "user_id",
			ChannelID:           "channel_id",
			WebhookOnArchiveURL: server.URL,
		}

		options := incident.StatusUpdateOptions{
			Status: incident.StatusArchived,
		}
		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		store.EXPECT().CreateTimelineEvent(gomock.AssignableToTypeOf(&incident.TimelineEvent{}))
		store.EXPECT().GetIncident(incdnt.ID).Return(incdnt, nil).Times(2)
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		store.EXPECT().UpdateStatus(gomock.Any()).Return(nil)
		store.EXPECT().CreateTimelineEvent(gomock.Any()).Return(&incident.TimelineEvent{}, nil)

		configService.EXPECT().GetManifest().Return(&model.Manifest{Id: "com.mattermost.plugin-incident-management"}).Times(2)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"})

		scheduler.EXPECT().Cancel(gomock.Any())

		poster.EXPECT().PostMessage(gomock.Any(), gomock.Any()).Return(&model.Post{UserId: "user_id", ChannelId: "channel_id"}, nil).Times(2)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")

		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		siteURL := "http://example.com"
		mattermostConfig.ServiceSettings.SiteURL = &siteURL
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		pluginAPI.On("GetTeam", teamID).Return(&model.Team{Id: teamID, Name: "ad-1"}, nil)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{Id: "channel_id", Name: "incident-channel-name"}, nil)
		pluginAPI.On("CreatePost", &model.Post{UserId: "user_id", ChannelId: "channel_id"}).Return(&model.Post{UserId: "user_id", ChannelId: "channel_id"}, nil)

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		err := s.UpdateStatus(incdnt.ID, "user_id", options)
		require.NoError(t, err)

		select {
		case payload := <-webhookChan:
			require.Equal(t,
				"http://example.com/ad-1/channels/incident-channel-name",
				payload.ChannelURL)
			require.Equal(t,
				"http://example.com/ad-1/com.mattermost.plugin-incident-management/incidents/incidentID",
				payload.DetailsURL)

		case <-time.After(time.Second * 5):
			require.Fail(t, "did not receive webhook")
		}

		pluginAPI.AssertExpectations(t)
	})
}
