package incident_test

import (
	"testing"

	"github.com/golang/mock/gomock"
	mock_poster "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	mock_config "github.com/mattermost/mattermost-plugin-incident-response/server/config/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	mock_incident "github.com/mattermost/mattermost-plugin-incident-response/server/incident/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/telemetry"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestCreateIncident(t *testing.T) {
	t.Run("invalid channel name has only invalid characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_poster.NewMockPoster(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Header: incident.Header{
				Name:   "###",
				TeamID: teamID,
			},
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.display_name.app_error"})

		s := incident.NewService(client, store, poster, configService, telemetryService)

		_, err := s.CreateIncident(incdnt, true)
		require.Equal(t, err, incident.ErrChannelDisplayNameInvalid)
	})

	t.Run("invalid channel name has only invalid characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_poster.NewMockPoster(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Header: incident.Header{
				Name:   "###",
				TeamID: teamID,
			},
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.2_or_more.app_error"})

		s := incident.NewService(client, store, poster, configService, telemetryService)

		_, err := s.CreateIncident(incdnt, true)
		require.Equal(t, err, incident.ErrChannelDisplayNameInvalid)
	})

	t.Run("channel name already exists, fixed on second try", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_poster.NewMockPoster(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Header: incident.Header{
				Name:            "###",
				TeamID:          teamID,
				CommanderUserID: "user_id",
			},
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", &model.Channel{
			TeamId:      teamID,
			Type:        model.CHANNEL_PRIVATE,
			DisplayName: "###",
			Name:        "",
			Header:      "The channel was created by the Incident Response plugin.",
		}).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"})
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been started by @%s", "username")

		s := incident.NewService(client, store, poster, configService, telemetryService)

		_, err := s.CreateIncident(incdnt, true)
		require.NoError(t, err)
	})

	t.Run("channel name already exists, failed second try", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_poster.NewMockPoster(controller)
		configService := mock_config.NewMockService(controller)
		telemetryService := &telemetry.NoopTelemetry{}

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Header: incident.Header{
				Name:            "###",
				TeamID:          teamID,
				CommanderUserID: "user_id",
			},
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})

		s := incident.NewService(client, store, poster, configService, telemetryService)

		_, err := s.CreateIncident(incdnt, true)
		require.EqualError(t, err, "failed to create incident channel: : , ")
	})
}

func TestServiceImpl_RestartIncident(t *testing.T) {
	type args struct {
		incidentID string
		userID     string
	}
	tests := []struct {
		name      string
		args      args
		prepMocks func(store *mock_incident.MockStore, poster *mock_poster.MockPoster, api *plugintest.API)
		wantErr   bool
	}{
		{
			name: "restart incident",
			args: args{
				incidentID: "incidentID1",
				userID:     "userID1",
			},
			prepMocks: func(store *mock_incident.MockStore, poster *mock_poster.MockPoster, api *plugintest.API) {
				testIncident := incident.Incident{
					Header: incident.Header{
						ID:              "incidentID",
						CommanderUserID: "testUserID",
						TeamID:          "testTeamID",
						Name:            "incidentName",
						ChannelID:       "channelID",
						IsActive:        false,
					},
					PostID:     "",
					Checklists: nil,
				}

				store.EXPECT().
					GetIncident("incidentID1").
					Return(&testIncident, nil).Times(1)

				testIncident2 := testIncident
				testIncident2.IsActive = true
				testIncident2.EndAt = 0

				store.EXPECT().
					UpdateIncident(&testIncident2).
					Return(nil).Times(1)

				poster.EXPECT().
					PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channelID").
					Times(1)

				api.On("GetUser", "userID1").
					Return(&model.User{Username: "testuser"}, nil)

				poster.EXPECT().
					PostMessage("channelID", "This incident has been restarted by @%v", "testuser").
					Return("messageID", nil).
					Times(1)
			},
			wantErr: false,
		},
		{
			name: "restart incident - incident is active",
			args: args{
				incidentID: "incidentID1",
				userID:     "userID1",
			},
			prepMocks: func(store *mock_incident.MockStore, poster *mock_poster.MockPoster, api *plugintest.API) {
				testIncident := incident.Incident{
					Header: incident.Header{
						ID:              "incidentID",
						CommanderUserID: "testUserID",
						TeamID:          "testTeamID",
						Name:            "incidentName",
						ChannelID:       "channelID",
						IsActive:        true,
					},
					PostID:     "",
					Checklists: nil,
				}

				store.EXPECT().
					GetIncident("incidentID1").
					Return(&testIncident, nil).Times(1)
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			controller := gomock.NewController(t)
			api := &plugintest.API{}
			client := pluginapi.NewClient(api)
			store := mock_incident.NewMockStore(controller)
			poster := mock_poster.NewMockPoster(controller)
			configService := mock_config.NewMockService(controller)
			telemetryService := &telemetry.NoopTelemetry{}
			service := incident.NewService(client, store, poster, configService, telemetryService)

			tt.prepMocks(store, poster, api)

			err := service.RestartIncident(tt.args.incidentID, tt.args.userID)
			if (err != nil) != tt.wantErr {
				t.Errorf("RestartIncident() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}

func TestChangeActiveStage(t *testing.T) {
	type args struct {
		incidentID string
		userID     string
	}
	tests := []struct {
		name      string
		args      args
		prepMocks func(store *mock_incident.MockStore, poster *mock_poster.MockPoster, api *plugintest.API)
		wantErr   bool
	}{
		{
			name: "ongoing incident",
			args: args{
				incidentID: "incidentID",
				userID:     "userID1",
			},
			prepMocks: func(store *mock_incident.MockStore, poster *mock_poster.MockPoster, api *plugintest.API) {
				testIncident := incident.Incident{
					Header: incident.Header{
						ID:              "incidentID",
						CommanderUserID: "testUserID",
						TeamID:          "testTeamID",
						Name:            "incidentName",
						ChannelID:       "channelID",
						IsActive:        true,
					},
					PostID: "",
					Checklists: []playbook.Checklist{
						{Title: "Stage 1"},
						{Title: "Stage 2"},
					},
				}

				store.EXPECT().
					GetIncident("incidentID").
					Return(&testIncident, nil).Times(1)

				updatedIncident := testIncident
				updatedIncident.ActiveStage = 1

				store.EXPECT().
					UpdateIncident(&updatedIncident).
					Return(nil).Times(1)

				poster.EXPECT().
					PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channelID").
					Times(1)

				api.On("GetUser", "userID1").
					Return(&model.User{Username: "testuser"}, nil)

				poster.EXPECT().
					PostMessage("channelID", "testuser changed the active stage from **Stage 1** to **Stage 2**.").
					Return("messageID", nil).
					Times(1)
			},
			wantErr: false,
		},
		{
			name: "ended incident",
			args: args{
				incidentID: "incidentID",
				userID:     "userID1",
			},
			prepMocks: func(store *mock_incident.MockStore, poster *mock_poster.MockPoster, api *plugintest.API) {
				testIncident := incident.Incident{
					Header: incident.Header{
						ID:              "incidentID",
						CommanderUserID: "testUserID",
						TeamID:          "testTeamID",
						Name:            "incidentName",
						ChannelID:       "channelID",
						IsActive:        false,
					},
					PostID: "",
					Checklists: []playbook.Checklist{
						{Title: "Stage 1"},
						{Title: "Stage 2"},
					},
				}

				store.EXPECT().
					GetIncident("incidentID").
					Return(&testIncident, nil).Times(1)

				updatedIncident := testIncident
				updatedIncident.ActiveStage = 1

				store.EXPECT().
					UpdateIncident(&updatedIncident).
					Return(nil).Times(1)

				poster.EXPECT().
					PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channelID").
					Times(1)

				api.On("GetUser", "userID1").
					Return(&model.User{Username: "testuser"}, nil)

				poster.EXPECT().
					PostMessage("channelID", "testuser changed the active stage from **Stage 1** to **Stage 2**.").
					Return("messageID", nil).
					Times(1)
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
			poster := mock_poster.NewMockPoster(controller)
			configService := mock_config.NewMockService(controller)
			telemetryService := &telemetry.NoopTelemetry{}
			service := incident.NewService(client, store, poster, configService, telemetryService)

			tt.prepMocks(store, poster, api)

			_, err := service.ChangeActiveStage(tt.args.incidentID, tt.args.userID, 1)
			if (err != nil) != tt.wantErr {
				t.Errorf("RestartIncident() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}
