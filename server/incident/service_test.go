package incident_test

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-plugin-incident-management/server/config"
	"github.com/mattermost/mattermost-plugin-incident-management/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-management/server/telemetry"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	mock_bot "github.com/mattermost/mattermost-plugin-incident-management/server/bot/mocks"
	mock_config "github.com/mattermost/mattermost-plugin-incident-management/server/config/mocks"
	mock_incident "github.com/mattermost/mattermost-plugin-incident-management/server/incident/mocks"

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
			Header: incident.Header{
				Name:   "###",
				TeamID: teamID,
			},
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.display_name.app_error"})

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, "testUserID", true)
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
			Header: incident.Header{
				Name:   "###",
				TeamID: teamID,
			},
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "model.channel.is_valid.2_or_more.app_error"})

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, "testUserID", true)
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
			Header:      "The channel was created by the Incident Management plugin.",
		}).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})
		mattermostConfig := &model.Config{}
		mattermostConfig.SetDefaults()
		pluginAPI.On("GetConfig").Return(mattermostConfig)
		pluginAPI.On("CreateChannel", mock.Anything).Return(&model.Channel{Id: "channel_id"}, nil)
		pluginAPI.On("AddUserToChannel", "channel_id", "user_id", "bot_user_id").Return(nil, nil)
		pluginAPI.On("UpdateChannelMemberRoles", "channel_id", "user_id", model.CHANNEL_ADMIN_ROLE_ID).Return(nil, nil)
		configService.EXPECT().GetConfiguration().Return(&config.Configuration{BotUserID: "bot_user_id"})
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been started by @%s", "username")

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, "user_id", true)
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
			Header: incident.Header{
				Name:            "###",
				TeamID:          teamID,
				CommanderUserID: "user_id",
			},
		}

		store.EXPECT().CreateIncident(gomock.Any()).Return(incdnt, nil)
		pluginAPI.On("CreateChannel", mock.Anything).Return(nil, &model.AppError{Id: "store.sql_channel.save_channel.exists.app_error"})

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		_, err := s.CreateIncident(incdnt, "user_id", true)
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
		prepMocks func(store *mock_incident.MockStore, poster *mock_bot.MockPoster, api *plugintest.API)
		wantErr   bool
	}{
		{
			name: "restart incident",
			args: args{
				incidentID: "incidentID1",
				userID:     "userID1",
			},
			prepMocks: func(store *mock_incident.MockStore, poster *mock_bot.MockPoster, api *plugintest.API) {
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
			prepMocks: func(store *mock_incident.MockStore, poster *mock_bot.MockPoster, api *plugintest.API) {
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
			poster := mock_bot.NewMockPoster(controller)
			logger := mock_bot.NewMockLogger(controller)
			configService := mock_config.NewMockService(controller)
			telemetryService := &telemetry.NoopTelemetry{}
			scheduler := mock_incident.NewMockJobOnceScheduler(controller)
			service := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

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
	testIncident := incident.Incident{
		Header: incident.Header{
			ID:               "incidentID",
			CommanderUserID:  "testUserID",
			TeamID:           "testTeamID",
			Name:             "incidentName",
			ChannelID:        "channelID",
			IsActive:         true,
			ActiveStage:      0,
			ActiveStageTitle: "Stage 2",
		},
		PostID: "",
		Checklists: []playbook.Checklist{
			{Title: "Stage 1"},
			{Title: "Stage 2"},
		},
	}

	type args struct {
		incidentID string
		userID     string
	}
	tests := []struct {
		name      string
		args      args
		prepMocks func(store *mock_incident.MockStore, poster *mock_bot.MockPoster, api *plugintest.API)
		wantErr   bool
	}{
		{
			name: "ongoing incident",
			args: args{
				incidentID: "incidentID",
				userID:     "userID1",
			},
			prepMocks: func(store *mock_incident.MockStore, poster *mock_bot.MockPoster, api *plugintest.API) {
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
			prepMocks: func(store *mock_incident.MockStore, poster *mock_bot.MockPoster, api *plugintest.API) {
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
			poster := mock_bot.NewMockPoster(controller)
			logger := mock_bot.NewMockLogger(controller)
			configService := mock_config.NewMockService(controller)
			telemetryService := &telemetry.NoopTelemetry{}
			scheduler := mock_incident.NewMockJobOnceScheduler(controller)
			service := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

			tt.prepMocks(store, poster, api)

			changedIncident, err := service.ChangeActiveStage(tt.args.incidentID, tt.args.userID, 1)
			if (err != nil) != tt.wantErr {
				t.Errorf("ChangeActiveStage() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			require.Equal(t, changedIncident.ActiveStage, 1)
			require.Equal(t, changedIncident.ActiveStageTitle, "Stage 2")
		})
	}
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

func TestEndIncident(t *testing.T) {
	t.Run("error fetching", func(t *testing.T) {
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
			Header: incident.Header{
				ID:     model.NewId(),
				Name:   "###",
				TeamID: teamID,
			},
		}

		store.EXPECT().GetIncident(incdnt.Header.ID).Return(nil, errors.New("error"))

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		err := s.EndIncident(incdnt.Header.ID, "testUserID")
		require.Error(t, err)
	})

	t.Run("non-existent", func(t *testing.T) {
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
			Header: incident.Header{
				ID:     model.NewId(),
				Name:   "###",
				TeamID: teamID,
			},
		}

		store.EXPECT().GetIncident(incdnt.Header.ID).Return(nil, nil)

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		err := s.EndIncident(incdnt.Header.ID, "testUserID")
		require.Error(t, err)
	})

	t.Run("already ended", func(t *testing.T) {
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
			Header: incident.Header{
				ID:       model.NewId(),
				Name:     "###",
				TeamID:   teamID,
				IsActive: false,
			},
		}

		store.EXPECT().GetIncident(incdnt.Header.ID).Return(incdnt, nil)

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		err := s.EndIncident(incdnt.Header.ID, "testUserID")
		require.Equal(t, incident.ErrIncidentNotActive, err)
	})

	t.Run("successful, no reminder", func(t *testing.T) {
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
			Header: incident.Header{
				ID:        model.NewId(),
				Name:      "###",
				TeamID:    teamID,
				IsActive:  true,
				ChannelID: "channel_id",
			},
			ReminderPostID: "",
		}

		store.EXPECT().GetIncident(incdnt.Header.ID).Return(incdnt, nil)
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		scheduler.EXPECT().Cancel(incdnt.Header.ID)
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been closed by @%v", "username")

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		err := s.EndIncident(incdnt.Header.ID, "user_id")
		require.NoError(t, err)
	})

	t.Run("successful, reminder", func(t *testing.T) {
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
			Header: incident.Header{
				ID:        model.NewId(),
				Name:      "###",
				TeamID:    teamID,
				IsActive:  true,
				ChannelID: "channel_id",
			},
			ReminderPostID: "post_id",
		}

		store.EXPECT().GetIncident(incdnt.Header.ID).Return(incdnt, nil)
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PublishWebsocketEventToChannel("incident_updated", gomock.Any(), "channel_id")
		scheduler.EXPECT().Cancel(incdnt.Header.ID)
		pluginAPI.On("GetUser", "user_id").Return(&model.User{Id: "user_id", Username: "username"}, nil)
		pluginAPI.On("GetPost", "post_id").Return(&model.Post{Id: "post_id"}, nil)
		pluginAPI.On("DeletePost", "post_id").Return(nil)
		store.EXPECT().UpdateIncident(gomock.Any()).Return(nil)
		poster.EXPECT().PostMessage("channel_id", "This incident has been closed by @%v", "username")

		s := incident.NewService(client, store, poster, logger, configService, scheduler, telemetryService)

		err := s.EndIncident(incdnt.Header.ID, "user_id")
		require.NoError(t, err)
	})
}
