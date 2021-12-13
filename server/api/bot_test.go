package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/golang/mock/gomock"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	mock_app "github.com/mattermost/mattermost-plugin-playbooks/v2/server/app/mocks"
	mock_poster "github.com/mattermost/mattermost-plugin-playbooks/v2/server/bot/mocks"
	mock_config "github.com/mattermost/mattermost-plugin-playbooks/v2/server/config/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestCanStartTrialLicense(t *testing.T) {
	var mockCtrl *gomock.Controller
	var handler *Handler
	var client *pluginapi.Client
	var configService *mock_config.MockService
	var playbookRunService *mock_app.MockPlaybookRunService
	var poster *mock_poster.MockPoster
	var logger *mock_poster.MockLogger
	var userInfoStore *mock_app.MockUserInfoStore
	var pluginAPI *plugintest.API

	mattermostUserID := "testUserID"

	// mattermostHandler simulates the Mattermost server routing HTTP requests to a plugin.
	mattermostHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/plugins/playbooks")
		r.Header.Add("Mattermost-User-ID", mattermostUserID)

		handler.ServeHTTP(w, r)
	})

	server := httptest.NewServer(mattermostHandler)
	t.Cleanup(server.Close)

	reset := func(t *testing.T) {
		t.Helper()
		mattermostUserID = "testUserID"
		mockCtrl = gomock.NewController(t)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		configService = mock_config.NewMockService(mockCtrl)
		poster = mock_poster.NewMockPoster(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		handler = NewHandler(client, configService, logger)
		playbookRunService = mock_app.NewMockPlaybookRunService(mockCtrl)
		userInfoStore = mock_app.NewMockUserInfoStore(mockCtrl)
		NewBotHandler(handler.APIRouter, client, poster, logger, configService, playbookRunService, userInfoStore)
	}

	t.Run("request trial license without permissions", func(t *testing.T) {
		reset(t)

		userID := "testUserID"
		postID := "postID"

		dialogRequest := model.PostActionIntegrationRequest{
			UserId: "testUserID",
			PostId: postID,
			Context: map[string]interface{}{
				"users":                 10,
				"termsAccepted":         true,
				"receiveEmailsAccepted": true,
			},
		}

		pluginAPI.On("HasPermissionTo", userID, model.PermissionManageLicenseInformation).Return(false)
		logger.EXPECT().Warnf(gomock.Any(), "no permission to start a trial license", gomock.Any())

		testrecorder := httptest.NewRecorder()
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		testreq, err := http.NewRequest("POST", "/api/v0/bot/notify-admins/button-start-trial", bytes.NewBuffer(dialogRequestBytes))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("request trial license with permissions", func(t *testing.T) {
		reset(t)

		userID := "testUserID"
		postID := "postID"

		dialogRequest := model.PostActionIntegrationRequest{
			UserId: "testUserID",
			PostId: postID,
			Context: map[string]interface{}{
				"users":                 10,
				"termsAccepted":         true,
				"receiveEmailsAccepted": true,
			},
		}

		originalPost := &model.Post{Id: postID}
		updatedPost := &model.Post{Id: postID}

		pluginAPI.On("HasPermissionTo", userID, model.PermissionManageLicenseInformation).Return(true)
		pluginAPI.On("GetPost", postID).Return(originalPost, nil)
		pluginAPI.On("UpdatePost", originalPost).Return(updatedPost, nil).Times(1)
		pluginAPI.On("GetServerVersion").Return("5.36.0")
		pluginAPI.On("RequestTrialLicense", userID,
			dialogRequest.Context["users"],
			dialogRequest.Context["termsAccepted"],
			dialogRequest.Context["receiveEmailsAccepted"],
		).Return(nil)
		pluginAPI.On("UpdatePost", mock.Anything).Return(updatedPost, nil).Times(1)

		testrecorder := httptest.NewRecorder()
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		testreq, err := http.NewRequest("POST", "/api/v0/bot/notify-admins/button-start-trial", bytes.NewBuffer(dialogRequestBytes))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
