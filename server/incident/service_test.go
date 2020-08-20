package incident_test

import (
	"testing"

	"github.com/golang/mock/gomock"
	mock_poster "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	mock_config "github.com/mattermost/mattermost-plugin-incident-response/server/config/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	mock_incident "github.com/mattermost/mattermost-plugin-incident-response/server/incident/mocks"
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

const (
	team1id = "012345678901234567890123t1"
	team2id = "012345678901234567890123t2"
)

var id1 = incident.Incident{
	Header: incident.Header{
		ID:              "id1",
		Name:            "incident one",
		IsActive:        false,
		CommanderUserID: "c1",
		TeamID:          team1id,
	},
}

var id2 = incident.Incident{
	Header: incident.Header{
		ID:              "id2",
		Name:            "incident two",
		IsActive:        true,
		CommanderUserID: "c2",
		TeamID:          team1id,
	},
}

var id3 = incident.Incident{
	Header: incident.Header{
		ID:              "id3",
		Name:            "incident three",
		IsActive:        true,
		CommanderUserID: "c2",
		TeamID:          team1id,
	},
}

var id4 = incident.Incident{
	Header: incident.Header{
		ID:              "id4",
		Name:            "incident four",
		IsActive:        false,
		CommanderUserID: "c2",
		TeamID:          team1id,
	},
}

var id5 = incident.Incident{
	Header: incident.Header{
		ID:              "id5",
		Name:            "incident five",
		IsActive:        true,
		CommanderUserID: "c1",
		TeamID:          team2id,
	},
}

var id6 = incident.Incident{
	Header: incident.Header{
		ID:              "id6",
		Name:            "incident six",
		IsActive:        false,
		CommanderUserID: "c1",
		TeamID:          team2id,
	},
}

func TestServiceImpl_GetCommanders(t *testing.T) {
	type args struct {
		teamID string
	}
	tests := []struct {
		name      string
		args      args
		prepStore func(store *mock_incident.MockStore)
		want      []incident.CommanderInfo
		wantErr   bool
	}{
		{
			name: "get all commanders (eg, user is admin)",
			args: args{},
			prepStore: func(store *mock_incident.MockStore) {
				store.EXPECT().
					GetIncidents(gomock.Any()).
					Return(&incident.GetIncidentsResults{
						TotalCount: 6,
						PageCount:  0,
						HasMore:    false,
						Items:      []incident.Incident{id1, id2, id3, id4, id5, id6},
					}, nil)
			},
			want: []incident.CommanderInfo{
				{UserID: "c1", Username: "comm one"},
				{UserID: "c2", Username: "comm two"},
			},
		},
		{
			name: "get commanders on team2",
			args: args{teamID: team2id},
			prepStore: func(store *mock_incident.MockStore) {
				store.EXPECT().
					GetIncidents(gomock.Any()).
					Return(&incident.GetIncidentsResults{
						TotalCount: 2,
						PageCount:  0,
						HasMore:    false,
						Items:      []incident.Incident{id5, id6},
					}, nil)
			},
			want: []incident.CommanderInfo{
				{UserID: "c1", Username: "comm one"},
			},
		},
		{
			name: "get commanders on team1",
			args: args{teamID: team1id},
			prepStore: func(store *mock_incident.MockStore) {
				store.EXPECT().
					GetIncidents(gomock.Any()).
					Return(&incident.GetIncidentsResults{
						TotalCount: 4,
						PageCount:  0,
						HasMore:    false,
						Items:      []incident.Incident{id1, id2, id3, id4},
					}, nil)
			},
			want: []incident.CommanderInfo{
				{UserID: "c1", Username: "comm one"},
				{UserID: "c2", Username: "comm two"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			controller := gomock.NewController(t)
			defer controller.Finish()

			pluginAPI := &plugintest.API{}
			client := pluginapi.NewClient(pluginAPI)
			store := mock_incident.NewMockStore(controller)
			poster := mock_poster.NewMockPoster(controller)
			configService := mock_config.NewMockService(controller)
			telemetryService := &telemetry.NoopTelemetry{}

			s := incident.NewService(client, store, poster, configService, telemetryService)

			// Mocked calls:
			tt.prepStore(store)
			pluginAPI.On("GetUser", "c1").Return(&model.User{Username: "comm one"}, nil)
			pluginAPI.On("GetUser", "c2").Return(&model.User{Username: "comm two"}, nil)

			options := incident.HeaderFilterOptions{
				TeamID: tt.args.teamID,
			}
			got, err := s.GetCommanders(options)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetCommandersForTeam() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			require.ElementsMatch(t, got, tt.want)
		})
	}
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
