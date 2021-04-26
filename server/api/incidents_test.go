package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	icClient "github.com/mattermost/mattermost-plugin-incident-collaboration/client"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	mock_poster "github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	mock_config "github.com/mattermost/mattermost-plugin-incident-collaboration/server/config/mocks"
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
	var configService *mock_config.MockService
	var playbookService *mock_playbook.MockService
	var incidentService *mock_incident.MockService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client
	telemetryService := &telemetry.NoopTelemetry{}

	// mattermostHandler simulates the Mattermost server routing HTTP requests to a plugin.
	mattermostHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/plugins/com.mattermost.plugin-incident-management")
		r.Header.Add("Mattermost-User-ID", "testUserID")

		handler.ServeHTTP(w, r)
	})

	server := httptest.NewServer(mattermostHandler)
	t.Cleanup(server.Close)

	c, err := icClient.New(&model.Client4{Url: server.URL})
	require.NoError(t, err)

	reset := func(t *testing.T) {
		t.Helper()

		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI)
		handler = NewHandler(client, configService)
		poster = mock_poster.NewMockPoster(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		playbookService = mock_playbook.NewMockService(mockCtrl)
		incidentService = mock_incident.NewMockService(mockCtrl)
		telemetryService = &telemetry.NoopTelemetry{}
		NewIncidentHandler(handler.APIRouter, incidentService, playbookService, client, poster, logger, telemetryService, configService)
	}

	setDefaultExpectations := func(t *testing.T) {
		t.Helper()

		configService.EXPECT().
			IsLicensed().
			Return(true)

		configService.EXPECT().
			GetConfiguration().
			Return(&config.Configuration{
				EnabledTeams: []string{},
			})
	}

	t.Run("create valid incident, unlicensed", func(t *testing.T) {
		reset(t)

		configService.EXPECT().
			IsLicensed().
			Return(false)

		setDefaultExpectations(t)

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

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("create valid incident, but it's disabled on this team", func(t *testing.T) {
		reset(t)

		configService.EXPECT().
			GetConfiguration().
			Return(&config.Configuration{
				EnabledTeams: []string{"notthisteam"},
			})

		setDefaultExpectations(t)

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

		incidentJSON, err := json.Marshal(testIncident)
		require.NoError(t, err)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents", bytes.NewBuffer(incidentJSON))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("create valid incident from dialog", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			Description:          "description",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
			InviteUsersEnabled:   false,
			InvitedUserIDs:       []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:      []string{"testInvitedGroupID1", "testInvitedGroupID2"},
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
			Description:     "description",
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
		}
		retI := i.Clone()
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)
		poster.EXPECT().PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())
		poster.EXPECT().EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any())
		incidentService.EXPECT().CreateIncident(&i, "testUserID", true).Return(retI, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("create valid incident from dialog with description", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			Description:          "description",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
			InviteUsersEnabled:   false,
			InvitedUserIDs:       []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:      []string{"testInvitedGroupID1", "testInvitedGroupID2"},
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
			Description:     "description",
			PlaybookID:      withid.ID,
			Checklists:      withid.Checklists,
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)
		poster.EXPECT().PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())
		poster.EXPECT().EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any())
		incidentService.EXPECT().CreateIncident(&i, "testUserID", true).Return(&retI, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("create incident from dialog - no permissions for public channels", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
			InviteUsersEnabled:   false,
			InvitedUserIDs:       []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:      []string{"testInvitedGroupID1", "testInvitedGroupID2"},
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
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

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
		reset(t)
		setDefaultExpectations(t)

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: false,
			MemberIDs:            []string{"testUserID"},
			InviteUsersEnabled:   false,
			InvitedUserIDs:       []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:      []string{"testInvitedGroupID1", "testInvitedGroupID2"},
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
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PRIVATE_CHANNEL).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

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
		reset(t)
		setDefaultExpectations(t)

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
			InviteUsersEnabled:   false,
			InvitedUserIDs:       []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:      []string{"testInvitedGroupID1", "testInvitedGroupID2"},
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
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		var res struct{ Error string }
		err = json.NewDecoder(resp.Body).Decode(&res)
		assert.NoError(t, err)
		assert.Equal(t, "interactive dialog's userID must be the same as the requester's userID", res.Error)
	})

	t.Run("create valid incident with missing playbookID from dialog", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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

		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create incident from dialog -- user does not have permission for the original postID's channel", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			Description:          "description",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
			InviteUsersEnabled:   false,
			InvitedUserIDs:       []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:      []string{"testInvitedGroupID1", "testInvitedGroupID2"},
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
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetPost", "privatePostID").Return(&model.Post{ChannelId: "privateChannelId"}, nil)
		pluginAPI.On("HasPermissionToChannel", "testUserID", "privateChannelId", model.PERMISSION_READ_CHANNEL).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create incident from dialog -- user is not a member of the playbook", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		withid := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			CreatePublicIncident: true,
			MemberIDs:            []string{"some_other_id"},
			InviteUsersEnabled:   false,
			InvitedUserIDs:       []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:      []string{"testInvitedGroupID1", "testInvitedGroupID2"},
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
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("GetPost", "privatePostID").Return(&model.Post{ChannelId: "privateChannelId"}, nil)
		pluginAPI.On("HasPermissionToChannel", "testUserID", "privateChannelId", model.PERMISSION_READ_CHANNEL).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/incidents/dialog", bytes.NewBuffer(dialogRequest.ToJson()))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create valid incident", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testPlaybook := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			Description:          "description",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
			InviteUsersEnabled:   false,
			InvitedUserIDs:       []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:      []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		testIncident := incident.Incident{
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			Description:     "description",
			PlaybookID:      testPlaybook.ID,
			Checklists:      testPlaybook.Checklists,
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(testPlaybook, nil).
			Times(1)

		retI := testIncident
		retI.ID = "incidentID"
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)
		incidentService.EXPECT().CreateIncident(&testIncident, "testUserID", true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		resultIncident, err := c.Incidents.Create(context.TODO(), icClient.IncidentCreateOptions{
			Name:            testIncident.Name,
			CommanderUserID: testIncident.CommanderUserID,
			TeamID:          testIncident.TeamID,
			Description:     testIncident.Description,
			PlaybookID:      testIncident.PlaybookID,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultIncident.ID)
	})

	t.Run("create valid incident, invite users enabled", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testPlaybook := playbook.Playbook{
			ID:                   "playbookid1",
			Title:                "My Playbook",
			TeamID:               "testTeamID",
			Description:          "description",
			CreatePublicIncident: true,
			MemberIDs:            []string{"testUserID"},
			InviteUsersEnabled:   true,
			InvitedUserIDs:       []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:      []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		testIncident := incident.Incident{
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			Description:     "description",
			PlaybookID:      testPlaybook.ID,
			Checklists:      testPlaybook.Checklists,
			InvitedUserIDs:  []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs: []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(testPlaybook, nil).
			Times(1)

		retI := testIncident
		retI.ID = "incidentID"
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)
		incidentService.EXPECT().CreateIncident(&testIncident, "testUserID", true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		resultIncident, err := c.Incidents.Create(context.TODO(), icClient.IncidentCreateOptions{
			Name:            testIncident.Name,
			CommanderUserID: testIncident.CommanderUserID,
			TeamID:          testIncident.TeamID,
			Description:     testIncident.Description,
			PlaybookID:      testIncident.PlaybookID,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultIncident.ID)
	})

	t.Run("create valid incident without playbook", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)
		incidentService.EXPECT().CreateIncident(&testIncident, "testUserID", true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		resultIncident, err := c.Incidents.Create(context.TODO(), icClient.IncidentCreateOptions{
			Name:            testIncident.Name,
			CommanderUserID: testIncident.CommanderUserID,
			TeamID:          testIncident.TeamID,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultIncident.ID)
	})

	t.Run("create invalid incident - missing commander", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			TeamID: "testTeamID",
			Name:   "incidentName",
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)

		resultIncident, err := c.Incidents.Create(context.TODO(), icClient.IncidentCreateOptions{
			Name:   testIncident.Name,
			TeamID: testIncident.TeamID,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		require.Nil(t, resultIncident)
	})

	t.Run("create invalid incident - missing team", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			CommanderUserID: "testUserID",
			Name:            "incidentName",
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)

		resultIncident, err := c.Incidents.Create(context.TODO(), icClient.IncidentCreateOptions{
			Name:            testIncident.Name,
			CommanderUserID: testIncident.CommanderUserID,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		require.Nil(t, resultIncident)
	})

	t.Run("create invalid incident - missing name", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_CREATE_PUBLIC_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", "testTeamID", model.PERMISSION_VIEW_TEAM).Return(true)

		resultIncident, err := c.Incidents.Create(context.TODO(), icClient.IncidentCreateOptions{
			Name:            "",
			TeamID:          testIncident.TeamID,
			CommanderUserID: testIncident.CommanderUserID,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		require.Nil(t, resultIncident)
	})

	t.Run("get incident by channel id", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			Checklists:      []playbook.Checklist{},
			StatusPosts:     []incident.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []incident.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)

		incidentService.EXPECT().GetIncidentIDForChannel("channelID").Return("incidentID", nil)
		incidentService.EXPECT().GetIncident("incidentID").Return(&testIncident, nil)

		resultIncident, err := c.Incidents.GetByChannelID(context.TODO(), testIncident.ChannelID)
		require.NoError(t, err)
		assert.Equal(t, testIncident, toInternalIncident(*resultIncident))
	})

	t.Run("get incident by channel id - not found", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
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

		resultIncident, err := c.Incidents.GetByChannelID(context.TODO(), testIncident.ChannelID)
		requireErrorWithStatusCode(t, err, http.StatusNotFound)
		require.Nil(t, resultIncident)
	})

	t.Run("get incident by channel id - not authorized", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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

		resultIncident, err := c.Incidents.GetByChannelID(context.TODO(), testIncident.ChannelID)
		requireErrorWithStatusCode(t, err, http.StatusNotFound)
		require.Nil(t, resultIncident)
	})

	t.Run("get private incident - not part of channel", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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

		resultIncident, err := c.Incidents.Get(context.TODO(), testIncident.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		require.Nil(t, resultIncident)
	})

	t.Run("get private incident - part of channel", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
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

		resultIncident, err := c.Incidents.Get(context.TODO(), testIncident.ID)
		require.NoError(t, err)
		assert.Equal(t, testIncident, toInternalIncident(*resultIncident))
	})

	t.Run("get public incident - not part of channel or team", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
			PostID:          "",
			PlaybookID:      "",
			Checklists:      nil,
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
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

		resultIncident, err := c.Incidents.Get(context.TODO(), testIncident.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		require.Nil(t, resultIncident)
	})

	t.Run("get public incident - not part of channel, but part of team", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
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

		resultIncident, err := c.Incidents.Get(context.TODO(), testIncident.ID)
		require.NoError(t, err)
		assert.Equal(t, testIncident, toInternalIncident(*resultIncident))
	})

	t.Run("get public incident - part of channel", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
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

		resultIncident, err := c.Incidents.Get(context.TODO(), testIncident.ID)
		require.NoError(t, err)
		assert.Equal(t, testIncident, toInternalIncident(*resultIncident))
	})

	t.Run("get private incident metadata - not part of channel", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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

		resultIncidentMetadata, err := c.Incidents.GetMetadata(context.TODO(), testIncident.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		require.Nil(t, resultIncidentMetadata)
	})

	t.Run("get private incident metadata - part of channel", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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

		resultIncidentMetadata, err := c.Incidents.GetMetadata(context.TODO(), testIncident.ID)
		require.NoError(t, err)
		assert.Equal(t, testIncidentMetadata, toInternalIncidentMetadata(*resultIncidentMetadata))
	})

	t.Run("get public incident metadata - not part of channel or team", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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

		resultIncidentMetadata, err := c.Incidents.GetMetadata(context.TODO(), testIncident.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		require.Nil(t, resultIncidentMetadata)
	})

	t.Run("get public incident metadata - not part of channel, but part of team", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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

		resultIncidentMetadata, err := c.Incidents.GetMetadata(context.TODO(), testIncident.ID)
		require.NoError(t, err)
		assert.Equal(t, testIncidentMetadata, toInternalIncidentMetadata(*resultIncidentMetadata))
	})

	t.Run("get public incident metadata - part of channel", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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

		resultIncidentMetadata, err := c.Incidents.GetMetadata(context.TODO(), testIncident.ID)
		require.NoError(t, err)
		assert.Equal(t, testIncidentMetadata, toInternalIncidentMetadata(*resultIncidentMetadata))
	})

	t.Run("get incidents", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		incident1 := incident.Incident{
			ID:              "incidentID1",
			CommanderUserID: "testUserID1",
			TeamID:          "testTeamID1",
			Name:            "incidentName1",
			ChannelID:       "channelID1",
			Checklists:      []playbook.Checklist{},
			StatusPosts:     []incident.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []incident.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("GetUser", "testUserID").Return(&model.User{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_VIEW_TEAM).Return(true)
		result := &incident.GetIncidentsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []incident.Incident{incident1},
		}
		incidentService.EXPECT().GetIncidents(gomock.Any(), gomock.Any()).Return(result, nil)

		actualList, err := c.Incidents.List(context.TODO(), 0, 200, icClient.IncidentListOptions{
			TeamID: "testTeamID1",
		})
		require.NoError(t, err)

		expectedList := &icClient.GetIncidentsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []icClient.Incident{toAPIIncident(incident1)},
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("get empty list of incidents", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_VIEW_TEAM).Return(false)

		resultIncident, err := c.Incidents.List(context.TODO(), 0, 100, icClient.IncidentListOptions{
			TeamID: "non-existent",
		})
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		require.Nil(t, resultIncident)
	})

	t.Run("get disabled list of incidents", func(t *testing.T) {
		reset(t)

		configService.EXPECT().
			GetConfiguration().
			Return(&config.Configuration{
				EnabledTeams: []string{"notthisteam"},
			})

		setDefaultExpectations(t)

		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PERMISSION_VIEW_TEAM).Return(true)

		actualList, err := c.Incidents.List(context.TODO(), 0, 100, icClient.IncidentListOptions{
			TeamID: "notonlist",
		})
		require.NoError(t, err)

		expectedList := &icClient.GetIncidentsResults{
			Disabled: true,
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("checklist autocomplete for a channel without permission to view", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

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
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("update incident status", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		incidentService.EXPECT().GetIncidentIDForChannel(testIncident.ChannelID).Return(testIncident.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		incidentService.EXPECT().GetIncident(testIncident.ID).Return(&testIncident, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_CREATE_POST).Return(true)

		updateOptions := incident.StatusUpdateOptions{
			Status:      "Active",
			Message:     "test message",
			Description: "test description",
			Reminder:    600 * time.Second,
		}
		incidentService.EXPECT().UpdateStatus("incidentID", "testUserID", updateOptions).Return(nil)

		err := c.Incidents.UpdateStatus(context.TODO(), "incidentID", icClient.StatusActive, "test description", "test message", 600)
		require.NoError(t, err)
	})

	t.Run("update incident status, bad status", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		incidentService.EXPECT().GetIncidentIDForChannel(testIncident.ChannelID).Return(testIncident.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		incidentService.EXPECT().GetIncident(testIncident.ID).Return(&testIncident, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_CREATE_POST).Return(true)

		err := c.Incidents.UpdateStatus(context.TODO(), "incidentID", "Arrrrrrrctive", "test description", "test message", 600)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update incident status, no permission to post", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		incidentService.EXPECT().GetIncidentIDForChannel(testIncident.ChannelID).Return(testIncident.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		incidentService.EXPECT().GetIncident(testIncident.ID).Return(&testIncident, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_CREATE_POST).Return(false)

		err := c.Incidents.UpdateStatus(context.TODO(), "incidentID", icClient.StatusActive, "test description", "test message", 600)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("update incident status, message empty", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		incidentService.EXPECT().GetIncidentIDForChannel(testIncident.ChannelID).Return(testIncident.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		incidentService.EXPECT().GetIncident(testIncident.ID).Return(&testIncident, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_CREATE_POST).Return(true)

		err := c.Incidents.UpdateStatus(context.TODO(), "incidentID", icClient.StatusActive, "test description", "  \t   \r   \t  \r\r  ", 600)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update incident status, status empty", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		incidentService.EXPECT().GetIncidentIDForChannel(testIncident.ChannelID).Return(testIncident.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		incidentService.EXPECT().GetIncident(testIncident.ID).Return(&testIncident, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_CREATE_POST).Return(true)

		err := c.Incidents.UpdateStatus(context.TODO(), "incidentID", "\t   \r  ", "test description", "test message", 600)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})

	t.Run("update incident status, description empty", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		testIncident := incident.Incident{
			ID:              "incidentID",
			CommanderUserID: "testUserID",
			TeamID:          "testTeamID",
			Name:            "incidentName",
			ChannelID:       "channelID",
		}

		incidentService.EXPECT().GetIncidentIDForChannel(testIncident.ChannelID).Return(testIncident.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PERMISSION_MANAGE_SYSTEM).Return(false)
		incidentService.EXPECT().GetIncident(testIncident.ID).Return(&testIncident, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_READ_CHANNEL).Return(true)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PERMISSION_CREATE_POST).Return(true)

		err := c.Incidents.UpdateStatus(context.TODO(), "incidentID", "Active", "  \r \n  ", "test message", 600)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})
}
