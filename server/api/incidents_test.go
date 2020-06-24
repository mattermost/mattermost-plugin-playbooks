package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	mock_poster "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	mock_incident "github.com/mattermost/mattermost-plugin-incident-response/server/incident/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"
	mock_pluginkvstore "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/telemetry"
)

func TestIncidents(t *testing.T) {
	var mockCtrl *gomock.Controller
	var mockkvapi *mock_pluginkvstore.MockKVAPI
	var handler *Handler
	var store *pluginkvstore.PlaybookStore
	var poster *mock_poster.MockPoster
	var logger *mock_poster.MockLogger
	var playbookService playbook.Service
	var incidentService *mock_incident.MockService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	reset := func() {
		mockCtrl = gomock.NewController(t)
		mockkvapi = mock_pluginkvstore.NewMockKVAPI(mockCtrl)
		handler = NewHandler()
		store = pluginkvstore.NewPlaybookStore(mockkvapi)
		poster = mock_poster.NewMockPoster(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		telemetry := &telemetry.NoopTelemetry{}
		playbookService = playbook.NewService(store, poster, telemetry)
		incidentService = mock_incident.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI)
		NewIncidentHandler(handler.APIRouter, incidentService, playbookService, client, poster, logger)
	}

	t.Run("create valid incident from dialog", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testteamid",
			CreatePublicIncident: true,
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: "testTeamID",
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				incident.DialogFieldNameKey:       "incidentName",
				incident.DialogFieldPlaybookIDKey: "playbookid1",
			},
		}

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookid1", gomock.Any()).Return(nil).SetArg(1, withid)
		i := incident.Incident{
			Header: incident.Header{
				CommanderUserID: dialogRequest.UserId,
				TeamID:          dialogRequest.TeamId,
				Name:            "incidentName",
			},
			Playbook: &withid,
		}
		retI := i
		retI.PrimaryChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_VIEW_TEAM).Return(true)
		poster.EXPECT().PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())
		poster.EXPECT().Ephemeral(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any())
		incidentService.EXPECT().CreateIncident(&i, true).Return(&retI, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("create valid incident with missing playbookID from dialog", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		dialogRequest := model.SubmitDialogRequest{
			TeamId: "testTeamID",
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				incident.DialogFieldNameKey:       "incidentName",
				incident.DialogFieldPlaybookIDKey: "playbookid1",
			},
		}

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookid1", gomock.Any()).Return(nil).SetArg(1, playbook.Playbook{})
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_VIEW_TEAM).Return(true)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create valid incident", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testteamid",
			CreatePublicIncident: true,
		}

		testIncident := incident.Incident{
			Header: incident.Header{
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
			},
			Playbook: &withid,
		}

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookid1", gomock.Any()).Return(nil).SetArg(1, withid)

		retI := testIncident
		retI.ID = "incidentID"
		retI.PrimaryChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_VIEW_TEAM).Return(true)
		incidentService.EXPECT().CreateIncident(&testIncident, true).Return(&retI, nil)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultIncident incident.Incident
		err = json.NewDecoder(resp.Body).Decode(&resultIncident)
		require.NoError(t, err)
		assert.NotEmpty(t, resultIncident.ID)
	})

	t.Run("create valid incident without playbook", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testIncident := incident.Incident{
			Header: incident.Header{
				CommanderUserID: "testUserID",
				TeamID:          "testTeamID",
				Name:            "incidentName",
			},
		}

		retI := testIncident
		retI.ID = "incidentID"
		retI.PrimaryChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_VIEW_TEAM).Return(true)
		incidentService.EXPECT().CreateIncident(&testIncident, true).Return(&retI, nil)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultIncident incident.Incident
		err = json.NewDecoder(resp.Body).Decode(&resultIncident)
		require.NoError(t, err)
		assert.NotEmpty(t, resultIncident.ID)
	})

	t.Run("create invalid incident - missing commander", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testIncident := incident.Incident{
			Header: incident.Header{
				TeamID: "testTeamID",
				Name:   "incidentName",
			},
		}

		retI := testIncident
		retI.PrimaryChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_VIEW_TEAM).Return(true)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create invalid incident - missing commander", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testIncident := incident.Incident{
			Header: incident.Header{
				TeamID: "testTeamID",
				Name:   "incidentName",
			},
		}

		retI := testIncident
		retI.PrimaryChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create invalid incident - missing team", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testIncident := incident.Incident{
			Header: incident.Header{
				CommanderUserID: "testUserID",
				Name:            "incidentName",
			},
		}

		retI := testIncident
		retI.PrimaryChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}
