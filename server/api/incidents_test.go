package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	mock_poster "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	mock_incident "github.com/mattermost/mattermost-plugin-incident-response/server/incident/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	mock_playbook "github.com/mattermost/mattermost-plugin-incident-response/server/playbook/mocks"
)

func TestIncidents(t *testing.T) {
	var mockCtrl *gomock.Controller
	var handler *Handler
	var poster *mock_poster.MockPoster
	var logger *mock_poster.MockLogger
	var playbookService *mock_playbook.MockService
	var incidentService *mock_incident.MockService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	reset := func() {
		mockCtrl = gomock.NewController(t)
		handler = NewHandler()
		poster = mock_poster.NewMockPoster(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		playbookService = mock_playbook.NewMockService(mockCtrl)
		incidentService = mock_incident.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI)
		NewIncidentHandler(handler.APIRouter, incidentService, playbookService, client, poster, logger)
	}

	t.Run("create valid incident from dialog", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: "testTeamID",
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				incident.DialogFieldPlaybookIDKey: "playbookid1",
				incident.DialogFieldNameKey:       "incidentName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		i := incident.Incident{
			Header: incident.Header{
				CommanderUserID: dialogRequest.UserId,
				TeamID:          dialogRequest.TeamId,
				Name:            "incidentName",
			},
			PlaybookID: "playbookid1",
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		poster.EXPECT().PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())
		poster.EXPECT().EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any())
		incidentService.EXPECT().CreateIncident(&i, true).Return(&retI, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("create valid incident from dialog with description", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: "testTeamID",
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				incident.DialogFieldPlaybookIDKey:  "playbookid1",
				incident.DialogFieldNameKey:        "incidentName",
				incident.DialogFieldDescriptionKey: "description",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		i := incident.Incident{
			Header: incident.Header{
				CommanderUserID: dialogRequest.UserId,
				TeamID:          dialogRequest.TeamId,
				Name:            "incidentName",
				Description:     "description",
			},
			PlaybookID: withid.ID,
			Checklists: withid.Checklists,
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		poster.EXPECT().PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())
		poster.EXPECT().EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any())
		incidentService.EXPECT().CreateIncident(&i, true).Return(&retI, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("create incident from dialog - no permissions for public channels", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: "testTeamID",
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				incident.DialogFieldPlaybookIDKey: "playbookid1",
				incident.DialogFieldNameKey:       "incidentName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		i := incident.Incident{
			Header: incident.Header{
				CommanderUserID: dialogRequest.UserId,
				TeamID:          dialogRequest.TeamId,
				Name:            "incidentName",
			},
			PlaybookID: withid.ID,
			Checklists: withid.Checklists,
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var dialogResp model.SubmitDialogResponse
		err = json.NewDecoder(resp.Body).Decode(&dialogResp)
		require.Nil(t, err)

		expectedDialogResp := model.SubmitDialogResponse{
			Errors: map[string]string{
				"incidentName": "You are not able to create a public channel: permissions error",
			},
		}

		require.Equal(t, expectedDialogResp, dialogResp)
	})

	t.Run("create incident from dialog - no permissions for public channels", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: false,
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: "testTeamID",
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				incident.DialogFieldPlaybookIDKey: "playbookid1",
				incident.DialogFieldNameKey:       "incidentName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		i := incident.Incident{
			Header: incident.Header{
				CommanderUserID: dialogRequest.UserId,
				TeamID:          dialogRequest.TeamId,
				Name:            "incidentName",
			},
			PlaybookID: withid.ID,
			Checklists: withid.Checklists,
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PRIVATE_CHANNEL).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var dialogResp model.SubmitDialogResponse
		err = json.NewDecoder(resp.Body).Decode(&dialogResp)
		require.Nil(t, err)

		expectedDialogResp := model.SubmitDialogResponse{
			Errors: map[string]string{
				"incidentName": "You are not able to create a private channel: permissions error",
			},
		}

		require.Equal(t, expectedDialogResp, dialogResp)
	})

	t.Run("create valid incident with missing playbookID from dialog", func(t *testing.T) {
		reset()

		dialogRequest := model.SubmitDialogRequest{
			TeamId: "testTeamID",
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				incident.DialogFieldPlaybookIDKey: "playbookid1",
				incident.DialogFieldNameKey:       "incidentName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(
				playbook.Playbook{},
				errors.Wrap(playbook.ErrNotFound, "playbook does not exist for id 'playbookid1'"),
			).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create valid incident", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
		}

		testIncident := incident.Incident{
			Header: incident.Header{
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
			},
			PlaybookID: withid.ID,
			Checklists: withid.Checklists,
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		retI := testIncident
		retI.ID = "incidentID"
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		incidentService.EXPECT().CreateIncident(&testIncident, true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultIncident incident.Incident
		err = json.NewDecoder(resp.Body).Decode(&resultIncident)
		require.NoError(t, err)
		assert.NotEmpty(t, resultIncident.ID)
	})

	t.Run("create valid incident without playbook", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
			},
		}

		retI := testIncident
		retI.ID = "incidentID"
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		incidentService.EXPECT().CreateIncident(&testIncident, true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultIncident incident.Incident
		err = json.NewDecoder(resp.Body).Decode(&resultIncident)
		require.NoError(t, err)
		assert.NotEmpty(t, resultIncident.ID)
	})

	t.Run("create invalid incident - missing commander", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				TeamID: "testTeamID",
				Name:   "incidentName",
			},
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create invalid incident - missing team", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				CommanderUserID: "testUserID",
				Name:            "incidentName",
			},
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create invalid incident - channel id already set", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				TeamID:    "testTeamID",
				Name:      "incidentName",
				ChannelID: "channelID",
			},
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("get incident by channel id", func(t *testing.T) {
		reset()

		testIncidentHeader := incident.Header{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		testIncident := incident.Incident{
			Header:     testIncidentHeader,
			Checklists: []playbook.Checklist{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)

		incidentService.EXPECT().GetIncidentIDForChannel("channelID").Return("incidentID", nil)
		incidentService.EXPECT().GetIncident("incidentID").Return(&testIncident, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/channel/"+testIncidentHeader.ChannelID, nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultIncident incident.Incident
		err = json.NewDecoder(resp.Body).Decode(&resultIncident)
		require.NoError(t, err)
		assert.Equal(t, testIncident, resultIncident)
	})

	t.Run("get incident by channel id - not found", func(t *testing.T) {
		reset()
		userID := "testUserID"

		testIncidentHeader := incident.Header{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)

		incidentService.EXPECT().GetIncidentIDForChannel("channelID").Return("", incident.ErrNotFound)
		logger.EXPECT().Warnf("User %s does not have permissions to get incident for channel %s", userID, testIncidentHeader.ChannelID)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/channel/"+testIncidentHeader.ChannelID, nil)
		testreq.Header.Add("Mattermost-User-ID", userID)
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("get incident by channel id - not authorized", func(t *testing.T) {
		reset()

		testIncidentHeader := incident.Header{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(false)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		incidentService.EXPECT().GetIncidentIDForChannel(testIncidentHeader.ChannelID).Return(testIncidentHeader.ID, nil)
		incidentService.EXPECT().GetIncident(testIncidentHeader.ID).Return(&incident.Incident{Header: testIncidentHeader}, nil)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/channel/"+testIncidentHeader.ChannelID, nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("get private incident - not part of channel", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID",
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
				ChannelID:       "channelID",
			},
			PostID:     "",
			PlaybookID: "",
			Checklists: nil,
		}

		pluginAPI.On("GetChannel", testIncident.ChannelID).
			Return(&model.Channel{Type: model.CHANNEL_PRIVATE}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testIncident.ChannelID, model.PERMISSION_READ_CHANNEL).
			Return(false)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		incidentService.EXPECT().
			GetIncident("incidentID").
			Return(&testIncident, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/"+testIncident.ID, nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get private incident - part of channel", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID",
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
				ChannelID:       "channelID",
			},
			PostID:     "",
			PlaybookID: "",
			Checklists: []playbook.Checklist{},
		}

		pluginAPI.On("GetChannel", testIncident.ChannelID).
			Return(&model.Channel{Type: model.CHANNEL_PRIVATE}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testIncident.ChannelID, model.PERMISSION_READ_CHANNEL).
			Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		incidentService.EXPECT().
			GetIncident("incidentID").
			Return(&testIncident, nil).Times(2)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/"+testIncident.ID, nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultIncident incident.Incident
		err = json.NewDecoder(resp.Body).Decode(&resultIncident)
		require.NoError(t, err)
		assert.Equal(t, testIncident, resultIncident)
	})

	t.Run("get public incident - not part of channel or team", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID",
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
				ChannelID:       "channelID",
			},
			PostID:     "",
			PlaybookID: "",
			Checklists: nil,
		}

		pluginAPI.On("GetChannel", testIncident.ChannelID).
			Return(&model.Channel{Type: model.CHANNEL_OPEN, TeamId: testIncident.TeamID}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testIncident.ChannelID, model.PERMISSION_READ_CHANNEL).
			Return(false)
		pluginAPI.On("HasPermissionToTeam", "testUserID", testIncident.TeamID, model.PERMISSION_LIST_TEAM_CHANNELS).
			Return(false)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		incidentService.EXPECT().
			GetIncident("incidentID").
			Return(&testIncident, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/"+testIncident.ID, nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get public incident - not part of channel, but part of team", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID",
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
				ChannelID:       "channelID",
			},
			PostID:     "",
			PlaybookID: "",
			Checklists: []playbook.Checklist{},
		}

		pluginAPI.On("GetChannel", testIncident.ChannelID).
			Return(&model.Channel{Type: model.CHANNEL_OPEN, TeamId: testIncident.TeamID}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testIncident.ChannelID, model.PERMISSION_READ_CHANNEL).
			Return(false)
		pluginAPI.On("HasPermissionToTeam", "testUserID", testIncident.TeamID, model.PERMISSION_LIST_TEAM_CHANNELS).
			Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		incidentService.EXPECT().
			GetIncident("incidentID").
			Return(&testIncident, nil).Times(2)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/"+testIncident.ID, nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultIncident incident.Incident
		err = json.NewDecoder(resp.Body).Decode(&resultIncident)
		require.NoError(t, err)
		assert.Equal(t, testIncident, resultIncident)
	})

	t.Run("get public incident - part of channel", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID",
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
				ChannelID:       "channelID",
			},
			PostID:     "",
			PlaybookID: "",
			Checklists: []playbook.Checklist{},
		}

		pluginAPI.On("GetChannel", testIncident.ChannelID).
			Return(&model.Channel{Type: model.CHANNEL_OPEN, TeamId: testIncident.TeamID}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testIncident.ChannelID, model.PERMISSION_READ_CHANNEL).
			Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		incidentService.EXPECT().
			GetIncident("incidentID").
			Return(&testIncident, nil).Times(2)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/"+testIncident.ID, nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultIncident incident.Incident
		err = json.NewDecoder(resp.Body).Decode(&resultIncident)
		require.NoError(t, err)
		assert.Equal(t, testIncident, resultIncident)
	})

	t.Run("get private incident details - not part of channel", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID",
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
				ChannelID:       "channelID",
			},
			PostID:     "",
			PlaybookID: "",
			Checklists: nil,
		}

		pluginAPI.On("GetChannel", testIncident.ChannelID).
			Return(&model.Channel{Type: model.CHANNEL_PRIVATE}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testIncident.ChannelID, model.PERMISSION_READ_CHANNEL).
			Return(false)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		incidentService.EXPECT().
			GetIncident("incidentID").
			Return(&testIncident, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/"+testIncident.ID+"/details", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get private incident details - part of channel", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID",
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
				ChannelID:       "channelID",
			},
			PostID:     "",
			PlaybookID: "",
			Checklists: []playbook.Checklist{},
		}

		testIncidentDetails := incident.WithDetails{
			Incident: testIncident,
			Details: incident.Details{
				ChannelName:        "theChannelName",
				ChannelDisplayName: "theChannelDisplayName",
				TeamName:           "ourAwesomeTeam",
				NumMembers:         11,
				TotalPosts:         42,
			},
		}

		pluginAPI.On("GetChannel", testIncident.ChannelID).
			Return(&model.Channel{Type: model.CHANNEL_PRIVATE}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testIncident.ChannelID, model.PERMISSION_READ_CHANNEL).
			Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		incidentService.EXPECT().
			GetIncident("incidentID").
			Return(&testIncident, nil)

		incidentService.EXPECT().
			GetIncidentWithDetails("incidentID").
			Return(&testIncidentDetails, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/"+testIncident.ID+"/details", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultDetails incident.WithDetails
		err = json.NewDecoder(resp.Body).Decode(&resultDetails)
		require.NoError(t, err)
		assert.Equal(t, testIncidentDetails, resultDetails)
	})

	t.Run("get public incident details - not part of channel or team", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID",
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
				ChannelID:       "channelID",
			},
			PostID:     "",
			PlaybookID: "",
			Checklists: nil,
		}

		pluginAPI.On("GetChannel", testIncident.ChannelID).
			Return(&model.Channel{Type: model.CHANNEL_OPEN, TeamId: testIncident.TeamID}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testIncident.ChannelID, model.PERMISSION_READ_CHANNEL).
			Return(false)
		pluginAPI.On("HasPermissionToTeam", "testUserID", testIncident.TeamID, model.PERMISSION_LIST_TEAM_CHANNELS).
			Return(false)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		incidentService.EXPECT().
			GetIncident("incidentID").
			Return(&testIncident, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/"+testIncident.ID+"/details", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get public incident details - not part of channel, but part of team", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID",
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
				ChannelID:       "channelID",
			},
			PostID:     "",
			PlaybookID: "",
			Checklists: []playbook.Checklist{},
		}

		testIncidentDetails := incident.WithDetails{
			Incident: testIncident,
			Details: incident.Details{
				ChannelName:        "theChannelName",
				ChannelDisplayName: "theChannelDisplayName",
				TeamName:           "ourAwesomeTeam",
				NumMembers:         11,
				TotalPosts:         42,
			},
		}

		pluginAPI.On("GetChannel", testIncident.ChannelID).
			Return(&model.Channel{Type: model.CHANNEL_OPEN, TeamId: testIncident.TeamID}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testIncident.ChannelID, model.PERMISSION_READ_CHANNEL).
			Return(false)
		pluginAPI.On("HasPermissionToTeam", "testUserID", testIncident.TeamID, model.PERMISSION_LIST_TEAM_CHANNELS).
			Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		incidentService.EXPECT().
			GetIncident("incidentID").
			Return(&testIncident, nil)

		incidentService.EXPECT().
			GetIncidentWithDetails("incidentID").
			Return(&testIncidentDetails, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/"+testIncident.ID+"/details", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultDetails incident.WithDetails
		err = json.NewDecoder(resp.Body).Decode(&resultDetails)
		require.NoError(t, err)
		assert.Equal(t, testIncidentDetails, resultDetails)
	})

	t.Run("get public incident details - part of channel", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID",
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
				ChannelID:       "channelID",
			},
			PostID:     "",
			PlaybookID: "",
			Checklists: []playbook.Checklist{},
		}

		testIncidentDetails := incident.WithDetails{
			Incident: testIncident,
			Details: incident.Details{
				ChannelName:        "theChannelName",
				ChannelDisplayName: "theChannelDisplayName",
				TeamName:           "ourAwesomeTeam",
				NumMembers:         11,
				TotalPosts:         42,
			},
		}

		pluginAPI.On("GetChannel", testIncident.ChannelID).
			Return(&model.Channel{Type: model.CHANNEL_OPEN, TeamId: testIncident.TeamID}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testIncident.ChannelID, model.PERMISSION_READ_CHANNEL).
			Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		incidentService.EXPECT().
			GetIncident("incidentID").
			Return(&testIncident, nil)

		incidentService.EXPECT().
			GetIncidentWithDetails("incidentID").
			Return(&testIncidentDetails, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents/"+testIncident.ID+"/details", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultDetails incident.WithDetails
		err = json.NewDecoder(resp.Body).Decode(&resultDetails)
		require.NoError(t, err)
		assert.Equal(t, testIncidentDetails, resultDetails)
	})

	t.Run("get incidents", func(t *testing.T) {
		reset()

		incident1 := incident.Incident{
			Header: incident.Header{
				ID:              "incidentID1",
				CommanderUserID: "testUserID1",
				TeamID:          "testTeamID1",
				Name:            "incidentName1",
				ChannelID:       "channelID1",
			},
			Checklists: []playbook.Checklist{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		result := &incident.GetIncidentsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []incident.Incident{incident1},
		}
		incidentService.EXPECT().GetIncidents(gomock.Any(), gomock.Any()).Return(result, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents?team_id=testTeamID1", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var actualList incident.GetIncidentsResults
		err = json.NewDecoder(resp.Body).Decode(&actualList)
		require.NoError(t, err)
		expectedList := incident.GetIncidentsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []incident.Incident{incident1},
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("get empty list of incidents", func(t *testing.T) {
		reset()

		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_LIST_TEAM_CHANNELS).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/incidents?team_id=non-existent", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestChangeActiveStage(t *testing.T) {
	var mockCtrl *gomock.Controller
	var handler *Handler
	var poster *mock_poster.MockPoster
	var logger *mock_poster.MockLogger
	var playbookService *mock_playbook.MockService
	var incidentService *mock_incident.MockService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	reset := func() {
		mockCtrl = gomock.NewController(t)
		handler = NewHandler()
		poster = mock_poster.NewMockPoster(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		playbookService = mock_playbook.NewMockService(mockCtrl)
		incidentService = mock_incident.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI)
		NewIncidentHandler(handler.APIRouter, incidentService, playbookService, client, poster, logger)
	}

	pInt := func(n int) *int {
		return &n
	}

	header := incident.Header{
		ID:              "incidentid",
		CommanderUserID: "userid",
		TeamID:          "teamid",
		Name:            "incidentName",
		ActiveStage:     0,
	}

	playbookWithChecklists := func(num int) *playbook.Playbook {
		checklists := make([]playbook.Checklist, num)
		for i := 0; i < num; i++ {
			checklists[i] = playbook.Checklist{
				Title: fmt.Sprintf("Title - %d", i),
				Items: []playbook.ChecklistItem{},
			}
		}

		return &playbook.Playbook{
			ID:                   "playbookid",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
			Checklists:           checklists,
		}
	}

	testData := []struct {
		testName             string
		oldIncident          incident.Incident
		updateOptions        incident.UpdateOptions
		getExpectedIncident  func(incident.Incident) *incident.Incident
		changeActiveStageErr error
		expectedStatus       int
	}{
		{
			testName: "change to a valid active stage",
			oldIncident: incident.Incident{
				Header:     header,
				PlaybookID: playbookWithChecklists(2).ID,
				Checklists: playbookWithChecklists(2).Checklists,
			},
			updateOptions: incident.UpdateOptions{ActiveStage: pInt(1)},
			getExpectedIncident: func(old incident.Incident) *incident.Incident {
				old.ActiveStage = 1
				return &old
			},
			changeActiveStageErr: nil,
			expectedStatus:       http.StatusOK,
		},
		{
			testName: "change to the same active stage",
			oldIncident: incident.Incident{
				Header:     header,
				PlaybookID: playbookWithChecklists(2).ID,
				Checklists: playbookWithChecklists(2).Checklists,
			},
			updateOptions: incident.UpdateOptions{ActiveStage: pInt(0)},
			getExpectedIncident: func(old incident.Incident) *incident.Incident {
				return &old
			},
			changeActiveStageErr: nil,
			expectedStatus:       http.StatusOK,
		},
		{
			testName: "change to an invalid stage",
			oldIncident: incident.Incident{
				Header:     header,
				PlaybookID: playbookWithChecklists(1).ID,
				Checklists: playbookWithChecklists(1).Checklists,
			},
			updateOptions: incident.UpdateOptions{ActiveStage: pInt(10)},
			getExpectedIncident: func(old incident.Incident) *incident.Incident {
				return &old
			},
			changeActiveStageErr: errors.Errorf("index %d out of bounds: incident %s has %d stages", 10, header.ID, 1),
			expectedStatus:       http.StatusInternalServerError,
		},
		{
			testName: "change with nil update value",
			oldIncident: incident.Incident{
				Header:     header,
				PlaybookID: playbookWithChecklists(1).ID,
				Checklists: playbookWithChecklists(1).Checklists,
			},
			updateOptions: incident.UpdateOptions{ActiveStage: nil},
			getExpectedIncident: func(old incident.Incident) *incident.Incident {
				return &old
			},
			changeActiveStageErr: errors.Errorf("index %d out of bounds: incident %s has %d stages", 10, header.ID, 1),
			expectedStatus:       http.StatusOK,
		},
	}

	for _, data := range testData {
		t.Run(data.testName, func(t *testing.T) {
			reset()

			// Mock underlying plugin API calls, granting all permissions
			pluginAPI.On("GetChannel", mock.Anything).
				Return(&model.Channel{}, nil)
			pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
			pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).
				Return(true)
			pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_LIST_TEAM_CHANNELS).
				Return(true)

			// Verify that the websocket event is published and that the ephemeral post is sent
			poster.EXPECT().
				PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())
			poster.EXPECT().
				EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any())

			// Mock retrieval of the old incident
			incidentService.EXPECT().
				GetIncident(data.oldIncident.ID).
				Return(&data.oldIncident, nil).
				AnyTimes()

			// Mock the main call to ChangeActiveStage iff the passed ActiveStage is set
			expectedIncident := data.getExpectedIncident(data.oldIncident)
			if data.updateOptions.ActiveStage != nil {
				incidentService.EXPECT().
					ChangeActiveStage(data.oldIncident.ID, "testUserID", *data.updateOptions.ActiveStage).
					Return(expectedIncident, data.changeActiveStageErr).
					Times(1)
			}

			// Finally, make the request with all data provided
			testrecorder := httptest.NewRecorder()
			updatesJSON, err := json.Marshal(data.updateOptions)
			require.NoError(t, err)
			testreq, err := http.NewRequest("PATCH", "/api/v1/incidents/"+data.oldIncident.ID, bytes.NewBuffer(updatesJSON))
			testreq.Header.Add("Mattermost-User-ID", "testUserID")
			require.NoError(t, err)
			handler.ServeHTTP(testrecorder, testreq, "testpluginid")

			// Read the response
			resp := testrecorder.Result()
			defer resp.Body.Close()
			assert.Equal(t, data.expectedStatus, resp.StatusCode)

			// Verify that the response equals the expected data in successful requests
			if data.expectedStatus == http.StatusOK {
				var returnedIncident incident.Incident
				err = json.NewDecoder(resp.Body).Decode(&returnedIncident)
				require.NoError(t, err)
				assert.Equal(t, *expectedIncident, returnedIncident)
			}
		})
	}
}
