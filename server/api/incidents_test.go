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
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	mock_poster "github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	mock_incident "github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident/mocks"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	mock_playbook "github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook/mocks"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/telemetry"
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
	telemetryService := &telemetry.NoopTelemetry{}

	reset := func() {
		mockCtrl = gomock.NewController(t)
		handler = NewHandler()
		poster = mock_poster.NewMockPoster(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		playbookService = mock_playbook.NewMockService(mockCtrl)
		incidentService = mock_incident.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI)
		telemetryService = &telemetry.NoopTelemetry{}
		NewIncidentHandler(handler.APIRouter, incidentService, playbookService, client, poster, logger, telemetryService)
	}

	t.Run("create valid incident from dialog", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
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
			CommanderUserID: dialogRequest.UserId,
			TeamID:          dialogRequest.TeamId,
			Name:            "incidentName",
			PlaybookID:      "playbookid1",
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		poster.EXPECT().PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())
		poster.EXPECT().EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any())
		incidentService.EXPECT().CreateIncident(&i, "testUserID", true).Return(&retI, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("create valid incident from dialog with description", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
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
			CommanderUserID: dialogRequest.UserId,
			TeamID:          dialogRequest.TeamId,
			Name:            "incidentName",
			Description:     "description",
			PlaybookID:      withid.ID,
			Checklists:      withid.Checklists,
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		poster.EXPECT().PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())
		poster.EXPECT().EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any())
		incidentService.EXPECT().CreateIncident(&i, "testUserID", true).Return(&retI, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("create incident from dialog - no permissions for public channels", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
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
			CommanderUserID: dialogRequest.UserId,
			TeamID:          dialogRequest.TeamId,
			Name:            "incidentName",
			PlaybookID:      withid.ID,
			Checklists:      withid.Checklists,
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
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
			MemberIDs:            []string{"testUserID"},
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
			CommanderUserID: dialogRequest.UserId,
			TeamID:          dialogRequest.TeamId,
			Name:            "incidentName",
			PlaybookID:      withid.ID,
			Checklists:      withid.Checklists,
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PRIVATE_CHANNEL).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
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

	t.Run("create incident from dialog - dialog request userID doesn't match requester's id", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: "testTeamID",
			UserId: "fakeUserID",
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
			CommanderUserID: dialogRequest.UserId,
			TeamID:          dialogRequest.TeamId,
			Name:            "incidentName",
			PlaybookID:      withid.ID,
			Checklists:      withid.Checklists,
		}
		retI := i
		retI.ChannelID = "channelID"

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		var res struct{ Error string }
		err = json.NewDecoder(resp.Body).Decode(&res)
		assert.NoError(t, err)
		assert.Equal(t, "interactive dialog's userID must be the same as the requester's userID", res.Error)
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
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create incident from dialog -- user does not have permission for the original postID's channel", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: "testTeamID",
			UserId: "testUserID",
			State:  `{"post_id": "privatePostID"}`,
			Submission: map[string]interface{}{
				incident.DialogFieldPlaybookIDKey: "playbookid1",
				incident.DialogFieldNameKey:       "incidentName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("GetPost", "privatePostID").Return(&model.Post{ChannelId: "privateChannelId"}, nil)
		pluginAPI.On("HasPermissionToChannel", "testUserID", "privateChannelId", model.PERMISSION_READ_CHANNEL).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create incident from dialog -- user is not a member of the playbook", func(t *testing.T) {
		reset()

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
			MemberIDs:            []string{"some_other_id"},
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

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("GetPost", "privatePostID").Return(&model.Post{ChannelId: "privateChannelId"}, nil)
		pluginAPI.On("HasPermissionToChannel", "testUserID", "privateChannelId", model.PERMISSION_READ_CHANNEL).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
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
			MemberIDs:            []string{"testUserID"},
		}

		testIncident := incident.Incident{
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			PlaybookID:      withid.ID,
			Checklists:      withid.Checklists,
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
		incidentService.EXPECT().CreateIncident(&testIncident, "testUserID", true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)

		var resultIncident incident.Incident
		err = json.NewDecoder(resp.Body).Decode(&resultIncident)
		require.NoError(t, err)
		assert.NotEmpty(t, resultIncident.ID)
	})

	t.Run("create valid incident without playbook", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
		}

		retI := testIncident
		retI.ID = "incidentID"
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		incidentService.EXPECT().CreateIncident(&testIncident, "testUserID", true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)

		var resultIncident incident.Incident
		err = json.NewDecoder(resp.Body).Decode(&resultIncident)
		require.NoError(t, err)
		assert.NotEmpty(t, resultIncident.ID)
	})

	t.Run("create invalid incident - missing commander", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			TeamID: "testTeamID",
			Name:   "incidentName",
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("create invalid incident - missing team", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			CommanderUserID: "testUserID",
			Name:            "incidentName",
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("create invalid incident - channel id already set", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			TeamID:    "testTeamID",
			Name:      "incidentName",
			ChannelID: "channelID",
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("get incident by channel id", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			Checklists:      []playbook.Checklist{},
			StatusPosts:     []incident.StatusPost{},
			TimelineEvents:  []incident.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)

		incidentService.EXPECT().GetIncidentIDForChannel("channelID").Return("incidentID", nil)
		incidentService.EXPECT().GetIncident("incidentID").Return(&testIncident, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/channel/"+testIncident.ChannelID, nil)
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

		testIncident := incident.Incident{
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
		logger.EXPECT().Warnf("User %s does not have permissions to get incident for channel %s", userID, testIncident.ChannelID)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/channel/"+testIncident.ChannelID, nil)
		testreq.Header.Add("Mattermost-User-ID", userID)
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("get incident by channel id - not authorized", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(false)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		incidentService.EXPECT().GetIncidentIDForChannel(testIncident.ChannelID).Return(testIncident.ID, nil)
		incidentService.EXPECT().GetIncident(testIncident.ID).Return(&testIncident, nil)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/channel/"+testIncident.ChannelID, nil)
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
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      nil,
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
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/"+testIncident.ID, nil)
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
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      []playbook.Checklist{},
			StatusPosts:     []incident.StatusPost{},
			TimelineEvents:  []incident.TimelineEvent{},
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
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/"+testIncident.ID, nil)
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
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      nil,
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
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/"+testIncident.ID, nil)
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
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      []playbook.Checklist{},
			StatusPosts:     []incident.StatusPost{},
			TimelineEvents:  []incident.TimelineEvent{},
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
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/"+testIncident.ID, nil)
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
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      []playbook.Checklist{},
			StatusPosts:     []incident.StatusPost{},
			TimelineEvents:  []incident.TimelineEvent{},
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
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/"+testIncident.ID, nil)
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

	t.Run("get private incident metadata - not part of channel", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      nil,
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
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/"+testIncident.ID+"/metadata", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get private incident metadata - part of channel", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      []playbook.Checklist{},
		}

		testIncidentMetadata := incident.Metadata{
			ChannelName:        "theChannelName",
			ChannelDisplayName: "theChannelDisplayName",
			TeamName:           "ourAwesomeTeam",
			NumMembers:         11,
			TotalPosts:         42,
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
			GetIncidentMetadata("incidentID").
			Return(&testIncidentMetadata, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/"+testIncident.ID+"/metadata", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultMetadata incident.Metadata
		err = json.NewDecoder(resp.Body).Decode(&resultMetadata)
		require.NoError(t, err)
		assert.Equal(t, testIncidentMetadata, resultMetadata)
	})

	t.Run("get public incident metadata - not part of channel or team", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      nil,
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
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/"+testIncident.ID+"/metadata", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get public incident metadata - not part of channel, but part of team", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      []playbook.Checklist{},
		}

		testIncidentMetadata := incident.Metadata{
			ChannelName:        "theChannelName",
			ChannelDisplayName: "theChannelDisplayName",
			TeamName:           "ourAwesomeTeam",
			NumMembers:         11,
			TotalPosts:         42,
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
			GetIncidentMetadata("incidentID").
			Return(&testIncidentMetadata, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/"+testIncident.ID+"/metadata", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultMetadata incident.Metadata
		err = json.NewDecoder(resp.Body).Decode(&resultMetadata)
		require.NoError(t, err)
		assert.Equal(t, testIncidentMetadata, resultMetadata)
	})

	t.Run("get public incident metadata - part of channel", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      []playbook.Checklist{},
		}

		testIncidentMetadata := incident.Metadata{
			ChannelName:        "theChannelName",
			ChannelDisplayName: "theChannelDisplayName",
			TeamName:           "ourAwesomeTeam",
			NumMembers:         11,
			TotalPosts:         42,
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
			GetIncidentMetadata("incidentID").
			Return(&testIncidentMetadata, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/"+testIncident.ID+"/metadata", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var resultMetadata incident.Metadata
		err = json.NewDecoder(resp.Body).Decode(&resultMetadata)
		require.NoError(t, err)
		assert.Equal(t, testIncidentMetadata, resultMetadata)
	})

	t.Run("get incidents", func(t *testing.T) {
		reset()

		incident1 := incident.Incident{
			ID:              "incidentID1",
			CommanderUserID: "testUserID1",
			TeamID:          "testTeamID1",
			Name:            "incidentName1",
			ChannelID:       "channelID1",
			Checklists:      []playbook.Checklist{},
			StatusPosts:     []incident.StatusPost{},
			TimelineEvents:  []incident.TimelineEvent{},
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
		testreq, err := http.NewRequest("GET", "/api/v0/incidents?team_id=testTeamID1", nil)
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
		testreq, err := http.NewRequest("GET", "/api/v0/incidents?team_id=non-existent", nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("checklist autocomplete for a channel without permission to view", func(t *testing.T) {
		reset()

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		incidentService.EXPECT().GetIncidentIDForChannel(testIncident.ChannelID).Return(testIncident.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		incidentService.EXPECT().GetIncident(testIncident.ID).Return(&testIncident, nil)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(false)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{Type: model.CHANNEL_PRIVATE}, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/incidents/checklist-autocomplete?channel_id="+testIncident.ChannelID, nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}
