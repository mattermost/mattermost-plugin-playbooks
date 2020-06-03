package incident_test

import (
	"testing"

	"github.com/golang/mock/gomock"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
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
)

func TestCreateIncident(t *testing.T) {
	t.Run("invalid channel name has only invalid characters", func(t *testing.T) {
		controller := gomock.NewController(t)
		pluginAPI := &plugintest.API{}
		client := pluginapi.NewClient(pluginAPI)
		store := mock_incident.NewMockStore(controller)
		poster := mock_poster.NewMockPoster(controller)
		configService := mock_config.NewMockService(controller)
		telemetry := &telemetry.NoopTelemetry{}

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Header: incident.Header{
				Name:   "###",
				TeamID: teamID,
			},
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.display_name.app_error"})

		s := incident.NewService(client, store, poster, configService, telemetry)

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
		telemetry := &telemetry.NoopTelemetry{}

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Header: incident.Header{
				Name:   "###",
				TeamID: teamID,
			},
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.2_or_more.app_error"})

		s := incident.NewService(client, store, poster, configService, telemetry)

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
		telemetry := &telemetry.NoopTelemetry{}

		teamID := model.NewId()
		incdnt := &incident.Incident{
			Header: incident.Header{
				Name:            "###",
				TeamID:          teamID,
				CommanderUserID: "user_id",
			},
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", &model.Channel{TeamId: teamID, Type: model.CHANNEL_PRIVATE, DisplayName: "###", Name: "", Header: "The channel was created by the Incident Response plugin."}).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"})
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToTeam("incident_updated", gomock.Any(), teamID)
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been started by @%s", "username")

		s := incident.NewService(client, store, poster, configService, telemetry)

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
		telemetry := &telemetry.NoopTelemetry{}

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

		s := incident.NewService(client, store, poster, configService, telemetry)

		_, err := s.CreateIncident(incdnt, true)
		require.EqualError(t, err, "failed to create incident channel: : , ")
	})
}

var id1 = incident.Incident{
	Header: incident.Header{
		ID:              "id1",
		Name:            "incident one",
		IsActive:        false,
		CommanderUserID: "c1",
		TeamID:          "team1",
	},
}

var id2 = incident.Incident{
	Header: incident.Header{
		ID:              "id2",
		Name:            "incident two",
		IsActive:        true,
		CommanderUserID: "c2",
		TeamID:          "team1",
	},
}

var id3 = incident.Incident{
	Header: incident.Header{
		ID:              "id3",
		Name:            "incident three",
		IsActive:        true,
		CommanderUserID: "c2",
		TeamID:          "team1",
	},
}

var id4 = incident.Incident{
	Header: incident.Header{
		ID:              "id4",
		Name:            "incident four",
		IsActive:        false,
		CommanderUserID: "c2",
		TeamID:          "team1",
	},
}

var id5 = incident.Incident{
	Header: incident.Header{
		ID:              "id5",
		Name:            "incident five",
		IsActive:        true,
		CommanderUserID: "c1",
		TeamID:          "team2",
	},
}

var id6 = incident.Incident{
	Header: incident.Header{
		ID:              "id6",
		Name:            "incident six",
		IsActive:        false,
		CommanderUserID: "c1",
		TeamID:          "team2",
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
					Return(incident.GetIncidentsResults{
						Incidents:  []incident.Incident{id1, id2, id3, id4, id5, id6},
						TotalCount: 6,
					}, nil)
			},
			want: []incident.CommanderInfo{
				{UserID: "c1", Username: "comm one"},
				{UserID: "c2", Username: "comm two"},
			},
		},
		{
			name: "get commanders on team2",
			args: args{teamID: "team2"},
			prepStore: func(store *mock_incident.MockStore) {
				store.EXPECT().
					GetIncidents(gomock.Any()).
					Return(incident.GetIncidentsResults{
						Incidents:  []incident.Incident{id5, id6},
						TotalCount: 2,
					}, nil)
			},
			want: []incident.CommanderInfo{
				{UserID: "c1", Username: "comm one"},
			},
		},
		{
			name: "get commanders on team1",
			args: args{teamID: "team1"},
			prepStore: func(store *mock_incident.MockStore) {
				store.EXPECT().
					GetIncidents(gomock.Any()).
					Return(incident.GetIncidentsResults{
						Incidents:  []incident.Incident{id1, id2, id3, id4},
						TotalCount: 4,
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
			telemetry := &telemetry.NoopTelemetry{}

			s := incident.NewService(client, store, poster, configService, telemetry)

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
