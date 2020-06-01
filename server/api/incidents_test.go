package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/assert"
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
		telemetry := &telemetry.NoopTelemetry{}
		playbookService = playbook.NewService(store, poster, telemetry)
		incidentService = mock_incident.NewMockService(mockCtrl)

		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI)
		NewIncidentHandler(handler.APIRouter, incidentService, playbookService, client, poster)
	}

	t.Run("create incident", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		withid := playbook.Playbook{
			ID:     "testplaybookid",
			Title:  "My Playbook",
			TeamID: "testteamid",
		}
		mockkvapi.EXPECT().Get("playbook_aa", gomock.Any()).Return(nil).SetArg(1, withid)

		dialogRequest := model.SubmitDialogRequest{
			TeamId:     "testTeamID",
			UserId:     "testUserID",
			State:      "{}",
			Submission: map[string]interface{}{incident.DialogFieldNameKey: model.NewId(), incident.DialogFieldPlaybookIDKey: "playbookid1"},
		}

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/incidents/create-dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

}
