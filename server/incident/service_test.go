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

		_, err := s.CreateIncident(incdnt)
		require.Equal(t, err, incident.ErrChannelDisplayNameLong)
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

		_, err := s.CreateIncident(incdnt)
		require.Equal(t, err, incident.ErrChannelDisplayNameLong)
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
		poster.EXPECT().PublishWebsocketEventToTeam("incident_update", gomock.Any(), teamID)
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been started by @%s", "username")

		s := incident.NewService(client, store, poster, configService, telemetry)

		_, err := s.CreateIncident(incdnt)
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

		_, err := s.CreateIncident(incdnt)
		require.EqualError(t, err, "failed to create incident channel: : , ")
	})
}
