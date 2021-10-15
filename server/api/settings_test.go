package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/golang/mock/gomock"
	icClient "github.com/mattermost/mattermost-plugin-playbooks/client"
	mock_poster "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	mock_config "github.com/mattermost/mattermost-plugin-playbooks/server/config/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestGetSettings(t *testing.T) {
	var mockCtrl *gomock.Controller
	var handler *Handler
	var logger *mock_poster.MockLogger
	var configService *mock_config.MockService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	mattermostUserID := "testuserid"

	// mattermostHandler simulates the Mattermost server routing HTTP requests to a plugin.
	mattermostHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/plugins/playbooks")
		r.Header.Add("Mattermost-User-ID", mattermostUserID)

		handler.ServeHTTP(w, r)
	})

	server := httptest.NewServer(mattermostHandler)
	t.Cleanup(server.Close)

	c, err := icClient.New(&model.Client4{URL: server.URL})
	require.NoError(t, err)

	reset := func(t *testing.T) {
		t.Helper()

		mattermostUserID = "testuserid"
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		logger = mock_poster.NewMockLogger(mockCtrl)
		handler = NewHandler(client, configService, logger)
		logger = mock_poster.NewMockLogger(mockCtrl)

		NewSettingsHandler(handler.APIRouter, client, logger, configService)
	}

	t.Run("get settings, unauthenticated", func(t *testing.T) {
		reset(t)
		mattermostUserID = ""

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		settings, err := c.Settings.Get(context.TODO())
		requireErrorWithStatusCode(t, err, http.StatusUnauthorized)
		require.Nil(t, settings)
	})

	t.Run("get settings, empty", func(t *testing.T) {
		reset(t)

		expectedSettings := &icClient.GlobalSettings{
			PlaybookCreatorsUserIds:    []string{},
			EnableExperimentalFeatures: false,
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&config.Configuration{
				PlaybookCreatorsUserIds:    expectedSettings.PlaybookCreatorsUserIds,
				EnableExperimentalFeatures: expectedSettings.EnableExperimentalFeatures,
			})

		settings, err := c.Settings.Get(context.TODO())
		require.NoError(t, err)
		require.Equal(t, expectedSettings, settings)
	})

	t.Run("get settings, populated", func(t *testing.T) {
		reset(t)

		expectedSettings := &icClient.GlobalSettings{
			PlaybookCreatorsUserIds:    []string{model.NewId(), model.NewId()},
			EnableExperimentalFeatures: true,
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&config.Configuration{
				PlaybookCreatorsUserIds:    expectedSettings.PlaybookCreatorsUserIds,
				EnableExperimentalFeatures: expectedSettings.EnableExperimentalFeatures,
			})

		settings, err := c.Settings.Get(context.TODO())
		require.NoError(t, err)
		require.Equal(t, expectedSettings, settings)
	})
}

func TestSetSettings(t *testing.T) {
	var mockCtrl *gomock.Controller
	var handler *Handler
	var logger *mock_poster.MockLogger
	var configService *mock_config.MockService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	mattermostUserID := "testuserid"

	// mattermostHandler simulates the Mattermost server routing HTTP requests to a plugin.
	mattermostHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/plugins/playbooks")
		r.Header.Add("Mattermost-User-ID", mattermostUserID)

		handler.ServeHTTP(w, r)
	})

	server := httptest.NewServer(mattermostHandler)
	t.Cleanup(server.Close)

	c, err := icClient.New(&model.Client4{URL: server.URL})
	require.NoError(t, err)

	reset := func(t *testing.T) {
		t.Helper()

		mattermostUserID = "testuserid"
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		logger = mock_poster.NewMockLogger(mockCtrl)
		handler = NewHandler(client, configService, logger)
		logger = mock_poster.NewMockLogger(mockCtrl)

		NewSettingsHandler(handler.APIRouter, client, logger, configService)
	}

	t.Run("unauthenticated", func(t *testing.T) {
		reset(t)
		mattermostUserID = ""

		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds:    []string{},
			EnableExperimentalFeatures: false,
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		err := c.Settings.Update(context.TODO(), settings)
		requireErrorWithStatusCode(t, err, http.StatusUnauthorized)
	})

	t.Run("not a playbook creator", func(t *testing.T) {
		reset(t)

		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{model.NewId()},
			EnableExperimentalFeatures: false,
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: append(
				existingConfiguration.PlaybookCreatorsUserIds,
				mattermostUserID,
			),
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(false)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		err := c.Settings.Update(context.TODO(), settings)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("not licensed, no-op settings change, but not an admin", func(t *testing.T) {
		reset(t)

		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(false)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(false)
		pluginAPI.On("GetPluginConfig").Return(map[string]interface{}{})
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{},
		}).Return(nil)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		err := c.Settings.Update(context.TODO(), settings)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("not licensed, no-op settings change, as an admin", func(t *testing.T) {
		reset(t)

		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(true)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(false)
		pluginAPI.On("GetPluginConfig").Return(map[string]interface{}{})
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{},
		}).Return(nil)

		err := c.Settings.Update(context.TODO(), settings)
		require.NoError(t, err)
	})

	t.Run("not licensed, trying to set playbook creators for first time", func(t *testing.T) {
		reset(t)

		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{mattermostUserID},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(false)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(false)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		err := c.Settings.Update(context.TODO(), settings)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("set settings, licensed, settings playbook creators for the first time, not an admin", func(t *testing.T) {
		reset(t)

		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{mattermostUserID},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(false)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true)
		pluginAPI.On("GetPluginConfig").Return(make(map[string]interface{}))
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{mattermostUserID},
		}).Return(nil)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		err := c.Settings.Update(context.TODO(), settings)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("set settings, licensed, settings playbook creators for the first time, as an admin", func(t *testing.T) {
		reset(t)

		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{mattermostUserID},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(true)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true)
		pluginAPI.On("GetPluginConfig").Return(make(map[string]interface{}))
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{mattermostUserID},
		}).Return(nil)

		err := c.Settings.Update(context.TODO(), settings)
		require.NoError(t, err)
	})

	t.Run("set settings, licensed, adding another user, not an admin", func(t *testing.T) {
		reset(t)

		newUserID := model.NewId()
		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{mattermostUserID},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{mattermostUserID, newUserID},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(false)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true)
		pluginAPI.On("GetPluginConfig").Return(make(map[string]interface{}))
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{mattermostUserID, newUserID},
		}).Return(nil)

		err := c.Settings.Update(context.TODO(), settings)
		require.NoError(t, err)
	})

	t.Run("set settings, licensed, adding another user, as an admin", func(t *testing.T) {
		reset(t)

		newUserID := model.NewId()
		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{mattermostUserID},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{mattermostUserID, newUserID},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(true)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true)
		pluginAPI.On("GetPluginConfig").Return(make(map[string]interface{}))
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{mattermostUserID, newUserID},
		}).Return(nil)

		err := c.Settings.Update(context.TODO(), settings)
		require.NoError(t, err)
	})

	t.Run("set settings, licensed, adding another user, as an admin not in the list", func(t *testing.T) {
		reset(t)

		newUserID := model.NewId()
		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{newUserID},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{mattermostUserID, newUserID},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(true)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true)
		pluginAPI.On("GetPluginConfig").Return(make(map[string]interface{}))
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{mattermostUserID, newUserID},
		}).Return(nil)

		err := c.Settings.Update(context.TODO(), settings)
		require.NoError(t, err)
	})

	t.Run("set settings, licensed, assigning to someone else, not an admin", func(t *testing.T) {
		reset(t)

		otherUserID := model.NewId()
		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{mattermostUserID},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{otherUserID},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(false)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true)
		pluginAPI.On("GetPluginConfig").Return(make(map[string]interface{}))
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{otherUserID},
		}).Return(nil)

		err := c.Settings.Update(context.TODO(), settings)
		require.NoError(t, err)
	})

	t.Run("set settings, licensed, assigning to someone else, as an admin", func(t *testing.T) {
		reset(t)

		otherUserID := model.NewId()
		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{mattermostUserID},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{otherUserID},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(true)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true)
		pluginAPI.On("GetPluginConfig").Return(make(map[string]interface{}))
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{otherUserID},
		}).Return(nil)

		err := c.Settings.Update(context.TODO(), settings)
		require.NoError(t, err)
	})

	t.Run("set settings, licensed, assigning to someone else, as an admin not in the list", func(t *testing.T) {
		reset(t)

		otherUserID := model.NewId()
		otherUserID2 := model.NewId()
		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{otherUserID},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{otherUserID2},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(true)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true)
		pluginAPI.On("GetPluginConfig").Return(make(map[string]interface{}))
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{otherUserID2},
		}).Return(nil)

		err := c.Settings.Update(context.TODO(), settings)
		require.NoError(t, err)
	})

	t.Run("set settings, licensed, removing all users, not an admin but in the list", func(t *testing.T) {
		reset(t)

		otherUserID := model.NewId()
		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{mattermostUserID, otherUserID},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(false)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true)
		pluginAPI.On("GetPluginConfig").Return(make(map[string]interface{}))
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{},
		}).Return(nil)

		err := c.Settings.Update(context.TODO(), settings)
		require.NoError(t, err)
	})

	t.Run("set settings, licensed, removing all users, as an admin not in the list", func(t *testing.T) {
		reset(t)

		otherUserID := model.NewId()
		existingConfiguration := config.Configuration{
			PlaybookCreatorsUserIds:    []string{otherUserID},
			EnableExperimentalFeatures: false,
			AllowedUserIDs:             []string{},
		}
		settings := icClient.GlobalSettings{
			PlaybookCreatorsUserIds: []string{},
		}

		NewSettingsHandler(handler.APIRouter, client, logger, configService)

		pluginAPI.On("HasPermissionTo", mattermostUserID, model.PermissionManageSystem).Return(true)
		configService.EXPECT().
			GetConfiguration().
			AnyTimes().
			Return(&existingConfiguration)
		configService.EXPECT().
			IsAtLeastE20Licensed().
			Return(true)
		pluginAPI.On("GetPluginConfig").Return(make(map[string]interface{}))
		pluginAPI.On("SavePluginConfig", map[string]interface{}{
			"PlaybookCreatorsUserIds": []string{},
		}).Return(nil)

		err := c.Settings.Update(context.TODO(), settings)
		require.NoError(t, err)
	})
}
