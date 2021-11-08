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
	icClient "github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_app "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"
	mock_poster "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	mock_config "github.com/mattermost/mattermost-plugin-playbooks/server/config/mocks"
)

func TestPlaybookRuns(t *testing.T) {
	var mockCtrl *gomock.Controller
	var handler *Handler
	var poster *mock_poster.MockPoster
	var logger *mock_poster.MockLogger
	var configService *mock_config.MockService
	var playbookService *mock_app.MockPlaybookService
	var playbookRunService *mock_app.MockPlaybookRunService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	mattermostUserID := "testUserID"

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

		mattermostUserID = "testUserID"
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		poster = mock_poster.NewMockPoster(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		handler = NewHandler(client, configService, logger)
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		playbookRunService = mock_app.NewMockPlaybookRunService(mockCtrl)
		NewPlaybookRunHandler(handler.APIRouter, playbookRunService, playbookService, client, poster, logger, configService)
	}

	setDefaultExpectations := func(t *testing.T) {
		t.Helper()

		configService.EXPECT().
			IsAtLeastE10Licensed().
			Return(true).AnyTimes()

		configService.EXPECT().
			GetConfiguration().
			Return(&config.Configuration{}).AnyTimes()
	}

	t.Run("create valid playbook run from dialog", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		withid := app.Playbook{
			ID:                      "playbookid1",
			Title:                   "My Playbook",
			TeamID:                  teamID,
			Description:             "description",
			CreatePublicPlaybookRun: true,
			MemberIDs:               []string{"testUserID"},
			InviteUsersEnabled:      false,
			InvitedUserIDs:          []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:         []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: teamID,
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldPlaybookIDKey: "playbookid1",
				app.DialogFieldNameKey:       "playbookRunName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		i := app.PlaybookRun{
			OwnerUserID:               dialogRequest.UserId,
			TeamID:                    dialogRequest.TeamId,
			Name:                      "playbookRunName",
			PlaybookID:                "playbookid1",
			Description:               "description",
			InvitedUserIDs:            []string{},
			InvitedGroupIDs:           []string{},
			WebhookOnCreationURLs:     []string{},
			WebhookOnStatusUpdateURLs: []string{},
		}
		retI := i.Clone()
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)
		poster.EXPECT().PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())
		poster.EXPECT().EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any())
		playbookRunService.EXPECT().CreatePlaybookRun(&i, &withid, "testUserID", true).Return(retI, nil)

		testrecorder := httptest.NewRecorder()
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		testreq, err := http.NewRequest("POST", "/api/v0/runs/dialog", bytes.NewBuffer(dialogRequestBytes))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("create valid playbook run from dialog with description", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		withid := app.Playbook{
			ID:                      "playbookid1",
			Title:                   "My Playbook",
			TeamID:                  teamID,
			Description:             "description",
			CreatePublicPlaybookRun: true,
			MemberIDs:               []string{"testUserID"},
			InviteUsersEnabled:      false,
			InvitedUserIDs:          []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:         []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: teamID,
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldPlaybookIDKey: "playbookid1",
				app.DialogFieldNameKey:       "playbookRunName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		i := app.PlaybookRun{
			OwnerUserID:               dialogRequest.UserId,
			TeamID:                    dialogRequest.TeamId,
			Name:                      "playbookRunName",
			Description:               "description",
			PlaybookID:                withid.ID,
			Checklists:                withid.Checklists,
			InvitedUserIDs:            []string{},
			InvitedGroupIDs:           []string{},
			WebhookOnCreationURLs:     []string{},
			WebhookOnStatusUpdateURLs: []string{},
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)
		poster.EXPECT().PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())
		poster.EXPECT().EphemeralPost(gomock.Any(), gomock.Any(), gomock.Any())
		playbookRunService.EXPECT().CreatePlaybookRun(&i, &withid, "testUserID", true).Return(&retI, nil)

		testrecorder := httptest.NewRecorder()
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		testreq, err := http.NewRequest("POST", "/api/v0/runs/dialog", bytes.NewBuffer(dialogRequestBytes))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("create playbook run from dialog - no permissions for public channels", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		withid := app.Playbook{
			ID:                      "playbookid1",
			Title:                   "My Playbook",
			TeamID:                  teamID,
			CreatePublicPlaybookRun: true,
			MemberIDs:               []string{"testUserID"},
			InviteUsersEnabled:      false,
			InvitedUserIDs:          []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:         []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: teamID,
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldPlaybookIDKey: "playbookid1",
				app.DialogFieldNameKey:       "playbookRunName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		i := app.PlaybookRun{
			OwnerUserID: dialogRequest.UserId,
			TeamID:      dialogRequest.TeamId,
			Name:        "playbookRunName",
			PlaybookID:  withid.ID,
			Checklists:  withid.Checklists,
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(false)

		testrecorder := httptest.NewRecorder()
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		testreq, err := http.NewRequest("POST", "/api/v0/runs/dialog", bytes.NewBuffer(dialogRequestBytes))
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
				app.DialogFieldNameKey: "You are not able to create a public channel: permissions error",
			},
		}

		require.Equal(t, expectedDialogResp, dialogResp)
	})

	t.Run("create playbook run from dialog - no permissions for public channels", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		withid := app.Playbook{
			ID:                      "playbookid1",
			Title:                   "My Playbook",
			TeamID:                  teamID,
			CreatePublicPlaybookRun: false,
			MemberIDs:               []string{"testUserID"},
			InviteUsersEnabled:      false,
			InvitedUserIDs:          []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:         []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: teamID,
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldPlaybookIDKey: "playbookid1",
				app.DialogFieldNameKey:       "playbookRunName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		i := app.PlaybookRun{
			OwnerUserID: dialogRequest.UserId,
			TeamID:      dialogRequest.TeamId,
			Name:        "playbookRunName",
			PlaybookID:  withid.ID,
			Checklists:  withid.Checklists,
		}
		retI := i
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePrivateChannel).Return(false)

		testrecorder := httptest.NewRecorder()
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		testreq, err := http.NewRequest("POST", "/api/v0/runs/dialog", bytes.NewBuffer(dialogRequestBytes))
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
				app.DialogFieldNameKey: "You are not able to create a private channel: permissions error",
			},
		}

		require.Equal(t, expectedDialogResp, dialogResp)
	})

	t.Run("create playbook run from dialog - dialog request userID doesn't match requester's id", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		teamID := model.NewId()
		withid := app.Playbook{
			ID:                      "playbookid1",
			Title:                   "My Playbook",
			TeamID:                  teamID,
			CreatePublicPlaybookRun: true,
			MemberIDs:               []string{"testUserID"},
			InviteUsersEnabled:      false,
			InvitedUserIDs:          []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:         []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: teamID,
			UserId: "fakeUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldPlaybookIDKey: "playbookid1",
				app.DialogFieldNameKey:       "playbookRunName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		i := app.PlaybookRun{
			OwnerUserID: dialogRequest.UserId,
			TeamID:      dialogRequest.TeamId,
			Name:        "playbookRunName",
			PlaybookID:  withid.ID,
			Checklists:  withid.Checklists,
		}
		retI := i
		retI.ChannelID = "channelID"

		testrecorder := httptest.NewRecorder()
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		testreq, err := http.NewRequest("POST", "/api/v0/runs/dialog", bytes.NewBuffer(dialogRequestBytes))
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

	t.Run("create valid playbook run with missing playbookID from dialog", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		teamID := model.NewId()
		dialogRequest := model.SubmitDialogRequest{
			TeamId: teamID,
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldPlaybookIDKey: "playbookid1",
				app.DialogFieldNameKey:       "playbookRunName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(
				app.Playbook{},
				errors.Wrap(app.ErrNotFound, "playbook does not exist for id 'playbookid1'"),
			).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)

		testrecorder := httptest.NewRecorder()
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		testreq, err := http.NewRequest("POST", "/api/v0/runs/dialog", bytes.NewBuffer(dialogRequestBytes))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create playbook run from dialog -- user does not have permission for the original postID's channel", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		teamID := model.NewId()
		withid := app.Playbook{
			ID:                      "playbookid1",
			Title:                   "My Playbook",
			TeamID:                  teamID,
			Description:             "description",
			CreatePublicPlaybookRun: true,
			MemberIDs:               []string{"testUserID"},
			InviteUsersEnabled:      false,
			InvitedUserIDs:          []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:         []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: teamID,
			UserId: "testUserID",
			State:  `{"post_id": "privatePostID"}`,
			Submission: map[string]interface{}{
				app.DialogFieldPlaybookIDKey: "playbookid1",
				app.DialogFieldNameKey:       "playbookRunName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)
		pluginAPI.On("GetPost", "privatePostID").Return(&model.Post{ChannelId: "privateChannelId"}, nil)
		pluginAPI.On("HasPermissionToChannel", "testUserID", "privateChannelId", model.PermissionReadChannel).Return(false)

		testrecorder := httptest.NewRecorder()
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		testreq, err := http.NewRequest("POST", "/api/v0/runs/dialog", bytes.NewBuffer(dialogRequestBytes))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create playbook run from dialog -- user is not a member of the playbook", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		teamID := model.NewId()
		withid := app.Playbook{
			ID:                      "playbookid1",
			Title:                   "My Playbook",
			TeamID:                  teamID,
			CreatePublicPlaybookRun: true,
			MemberIDs:               []string{"some_other_id"},
			InviteUsersEnabled:      false,
			InvitedUserIDs:          []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:         []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		dialogRequest := model.SubmitDialogRequest{
			TeamId: teamID,
			UserId: "testUserID",
			State:  "{}",
			Submission: map[string]interface{}{
				app.DialogFieldPlaybookIDKey: "playbookid1",
				app.DialogFieldNameKey:       "playbookRunName",
			},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(withid, nil).
			Times(1)

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)
		pluginAPI.On("GetPost", "privatePostID").Return(&model.Post{ChannelId: "privateChannelId"}, nil)
		pluginAPI.On("HasPermissionToChannel", "testUserID", "privateChannelId", model.PermissionReadChannel).Return(false)

		testrecorder := httptest.NewRecorder()
		dialogRequestBytes, _ := json.Marshal(dialogRequest)
		testreq, err := http.NewRequest("POST", "/api/v0/runs/dialog", bytes.NewBuffer(dialogRequestBytes))
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("create valid playbook run", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		testPlaybook := app.Playbook{
			ID:                      "playbookid1",
			Title:                   "My Playbook",
			TeamID:                  teamID,
			Description:             "description",
			CreatePublicPlaybookRun: true,
			MemberIDs:               []string{"testUserID"},
			InviteUsersEnabled:      false,
			InvitedUserIDs:          []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:         []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		testPlaybookRun := app.PlaybookRun{
			OwnerUserID:               "testUserID",
			TeamID:                    teamID,
			Name:                      "playbookRunName",
			Description:               "description",
			PlaybookID:                testPlaybook.ID,
			Checklists:                testPlaybook.Checklists,
			InvitedUserIDs:            []string{},
			InvitedGroupIDs:           []string{},
			WebhookOnCreationURLs:     []string{},
			WebhookOnStatusUpdateURLs: []string{},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(testPlaybook, nil).
			Times(1)

		retI := testPlaybookRun
		retI.ID = "playbookRunID"
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)
		playbookRunService.EXPECT().CreatePlaybookRun(&testPlaybookRun, &testPlaybook, "testUserID", true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.Create(context.TODO(), icClient.PlaybookRunCreateOptions{
			Name:        testPlaybookRun.Name,
			OwnerUserID: testPlaybookRun.OwnerUserID,
			TeamID:      testPlaybookRun.TeamID,
			Description: testPlaybookRun.Description,
			PlaybookID:  testPlaybookRun.PlaybookID,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybookRun.ID)
	})

	t.Run("create valid playbook run, invite users enabled", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		testPlaybook := app.Playbook{
			ID:                      "playbookid1",
			Title:                   "My Playbook",
			TeamID:                  teamID,
			Description:             "description",
			CreatePublicPlaybookRun: true,
			MemberIDs:               []string{"testUserID"},
			InviteUsersEnabled:      true,
			InvitedUserIDs:          []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:         []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		testPlaybookRun := app.PlaybookRun{
			OwnerUserID:               "testUserID",
			TeamID:                    teamID,
			Name:                      "playbookRunName",
			Description:               "description",
			PlaybookID:                testPlaybook.ID,
			Checklists:                testPlaybook.Checklists,
			InvitedUserIDs:            []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:           []string{"testInvitedGroupID1", "testInvitedGroupID2"},
			WebhookOnCreationURLs:     []string{},
			WebhookOnStatusUpdateURLs: []string{},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(testPlaybook, nil).
			Times(1)

		retI := testPlaybookRun
		retI.ID = "playbookRunID"
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)
		playbookRunService.EXPECT().CreatePlaybookRun(&testPlaybookRun, &testPlaybook, "testUserID", true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.Create(context.TODO(), icClient.PlaybookRunCreateOptions{
			Name:        testPlaybookRun.Name,
			OwnerUserID: testPlaybookRun.OwnerUserID,
			TeamID:      testPlaybookRun.TeamID,
			Description: testPlaybookRun.Description,
			PlaybookID:  testPlaybookRun.PlaybookID,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybookRun.ID)
	})

	t.Run("create valid playbook run without playbook", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			OwnerUserID: "testUserID",
			TeamID:      teamID,
			Name:        "playbookRunName",
		}

		retI := testPlaybookRun
		retI.ID = "playbookRunID"
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)
		playbookRunService.EXPECT().CreatePlaybookRun(&testPlaybookRun, nil, "testUserID", true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.Create(context.TODO(), icClient.PlaybookRunCreateOptions{
			Name:        testPlaybookRun.Name,
			OwnerUserID: testPlaybookRun.OwnerUserID,
			TeamID:      testPlaybookRun.TeamID,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybookRun.ID)
	})

	t.Run("create invalid playbook run - missing owner", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			TeamID: teamID,
			Name:   "playbookRunName",
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)

		resultPlaybookRun, err := c.PlaybookRuns.Create(context.TODO(), icClient.PlaybookRunCreateOptions{
			Name:   testPlaybookRun.Name,
			TeamID: testPlaybookRun.TeamID,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		require.Nil(t, resultPlaybookRun)
	})

	t.Run("create invalid playbook run - missing team", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		testPlaybookRun := app.PlaybookRun{
			OwnerUserID: "testUserID",
			Name:        "playbookRunName",
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)

		resultPlaybookRun, err := c.PlaybookRuns.Create(context.TODO(), icClient.PlaybookRunCreateOptions{
			Name:        testPlaybookRun.Name,
			OwnerUserID: testPlaybookRun.OwnerUserID,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		require.Nil(t, resultPlaybookRun)
	})

	t.Run("create invalid playbook run - missing name", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			OwnerUserID: "testUserID",
			TeamID:      teamID,
		}

		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)

		resultPlaybookRun, err := c.PlaybookRuns.Create(context.TODO(), icClient.PlaybookRunCreateOptions{
			Name:        "",
			TeamID:      testPlaybookRun.TeamID,
			OwnerUserID: testPlaybookRun.OwnerUserID,
		})
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
		require.Nil(t, resultPlaybookRun)
	})

	t.Run("create playbook run in unlicensed server with pricing plan differentiation enabled", func(*testing.T) {
		mockCtrl = gomock.NewController(t)
		configService = mock_config.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
		poster = mock_poster.NewMockPoster(mockCtrl)
		logger = mock_poster.NewMockLogger(mockCtrl)
		handler = NewHandler(client, configService, logger)
		playbookService = mock_app.NewMockPlaybookService(mockCtrl)
		playbookRunService = mock_app.NewMockPlaybookRunService(mockCtrl)
		NewPlaybookRunHandler(handler.APIRouter, playbookRunService, playbookService, client, poster, logger, configService)

		configService.EXPECT().
			IsAtLeastE10Licensed().
			Return(false)

		configService.EXPECT().
			GetConfiguration().
			Return(&config.Configuration{})

		teamID := model.NewId()
		testPlaybook := app.Playbook{
			ID:                      "playbookid1",
			Title:                   "My Playbook",
			TeamID:                  teamID,
			Description:             "description",
			CreatePublicPlaybookRun: true,
			MemberIDs:               []string{"testUserID"},
			InviteUsersEnabled:      false,
			InvitedUserIDs:          []string{"testInvitedUserID1", "testInvitedUserID2"},
			InvitedGroupIDs:         []string{"testInvitedGroupID1", "testInvitedGroupID2"},
		}

		testPlaybookRun := app.PlaybookRun{
			OwnerUserID:               "testUserID",
			TeamID:                    teamID,
			Name:                      "playbookRunName",
			Description:               "description",
			PlaybookID:                testPlaybook.ID,
			Checklists:                testPlaybook.Checklists,
			InvitedUserIDs:            []string{},
			InvitedGroupIDs:           []string{},
			WebhookOnCreationURLs:     []string{},
			WebhookOnStatusUpdateURLs: []string{},
		}

		playbookService.EXPECT().
			Get("playbookid1").
			Return(testPlaybook, nil).
			Times(1)

		retI := testPlaybookRun
		retI.ID = "playbookRunID"
		retI.ChannelID = "channelID"
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionCreatePublicChannel).Return(true)
		pluginAPI.On("HasPermissionToTeam", "testUserID", teamID, model.PermissionViewTeam).Return(true)
		playbookRunService.EXPECT().CreatePlaybookRun(&testPlaybookRun, &testPlaybook, "testUserID", true).Return(&retI, nil)

		// Verify that the websocket event is published
		poster.EXPECT().
			PublishWebsocketEventToUser(gomock.Any(), gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.Create(context.TODO(), icClient.PlaybookRunCreateOptions{
			Name:        testPlaybookRun.Name,
			OwnerUserID: testPlaybookRun.OwnerUserID,
			TeamID:      testPlaybookRun.TeamID,
			Description: testPlaybookRun.Description,
			PlaybookID:  testPlaybookRun.PlaybookID,
		})
		require.NoError(t, err)
		assert.NotEmpty(t, resultPlaybookRun.ID)
	})

	t.Run("get playbook run by channel id", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              "playbookRunID",
			OwnerUserID:     "testUserID",
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)

		playbookRunService.EXPECT().GetPlaybookRunIDForChannel("channelID").Return("playbookRunID", nil)
		playbookRunService.EXPECT().GetPlaybookRun("playbookRunID").Return(&testPlaybookRun, nil)

		resultPlaybookRun, err := c.PlaybookRuns.GetByChannelID(context.TODO(), testPlaybookRun.ChannelID)
		require.NoError(t, err)
		assert.Equal(t, testPlaybookRun, toInternalPlaybookRun(*resultPlaybookRun))
	})

	t.Run("get playbook run by channel id - not found", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          "playbookRunID",
			OwnerUserID: "testUserID",
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)

		playbookRunService.EXPECT().GetPlaybookRunIDForChannel("channelID").Return("", app.ErrNotFound)
		logger.EXPECT().Warnf("User %s does not have permissions to get playbook run for channel %s", userID, testPlaybookRun.ChannelID)

		resultPlaybookRun, err := c.PlaybookRuns.GetByChannelID(context.TODO(), testPlaybookRun.ChannelID)
		requireErrorWithStatusCode(t, err, http.StatusNotFound)
		require.Nil(t, resultPlaybookRun)
	})

	t.Run("get playbook run by channel id - not admin, not channel member, private playbook, +not playbook member", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          playbookRunID,
			OwnerUserID: userID,
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
			PlaybookID:  playbookID,
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{"someone_else"},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		playbookRunService.EXPECT().GetPlaybookRunIDForChannel(testPlaybookRun.ChannelID).Return(testPlaybookRun.ID, nil)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.GetByChannelID(context.TODO(), testPlaybookRun.ChannelID)
		requireErrorWithStatusCode(t, err, http.StatusNotFound)
		require.Nil(t, resultPlaybookRun)
	})

	t.Run("get playbook run by channel id - not admin, not channel member, private playbook, +is playbook member", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              playbookRunID,
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			PlaybookID:      playbookID,
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{"someone_else", userID},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		playbookRunService.EXPECT().GetPlaybookRunIDForChannel(testPlaybookRun.ChannelID).Return(testPlaybookRun.ID, nil).Times(2)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil).Times(2)

		resultPlaybookRun, err := c.PlaybookRuns.GetByChannelID(context.TODO(), testPlaybookRun.ChannelID)
		require.NoError(t, err)
		require.Equal(t, testPlaybookRun, toInternalPlaybookRun(*resultPlaybookRun))
	})

	t.Run("get playbook run by channel id - not admin, not channel member, public playbook, +not team member", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          "playbookRunID",
			OwnerUserID: userID,
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
			PlaybookID:  "playbookID",
		}
		testPlaybook := app.Playbook{
			TeamID: teamID,
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		playbookRunService.EXPECT().GetPlaybookRunIDForChannel(testPlaybookRun.ChannelID).Return(testPlaybookRun.ID, nil)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(false)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.GetByChannelID(context.TODO(), testPlaybookRun.ChannelID)
		requireErrorWithStatusCode(t, err, http.StatusNotFound)
		require.Nil(t, resultPlaybookRun)
	})

	t.Run("get playbook run by channel id - not admin, not channel member, public playbook, +is team member", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              playbookRunID,
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			PlaybookID:      playbookID,
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		playbookRunService.EXPECT().GetPlaybookRunIDForChannel(testPlaybookRun.ChannelID).Return(testPlaybookRun.ID, nil).Times(2)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil).Times(2)

		resultPlaybookRun, err := c.PlaybookRuns.GetByChannelID(context.TODO(), testPlaybookRun.ChannelID)
		require.NoError(t, err)
		require.Equal(t, testPlaybookRun, toInternalPlaybookRun(*resultPlaybookRun))
	})

	t.Run("get playbook run by channel id - not admin, +is channel member, public playbook, not team member", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookRunID := "playbookRunID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              playbookRunID,
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			PlaybookID:      "playbookID",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		playbookRunService.EXPECT().GetPlaybookRunIDForChannel(testPlaybookRun.ChannelID).Return(testPlaybookRun.ID, nil).Times(2)
		playbookService.EXPECT().Get(testPlaybookRun.ID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(playbookRunID).Return(&testPlaybookRun, nil)

		resultPlaybookRun, err := c.PlaybookRuns.GetByChannelID(context.TODO(), testPlaybookRun.ChannelID)
		require.NoError(t, err)
		require.Equal(t, testPlaybookRun, toInternalPlaybookRun(*resultPlaybookRun))
	})

	t.Run("get playbook run by channel id - +is admin, not channel member, public playbook, not team member", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookRunID := "playbookRunID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              playbookRunID,
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			PlaybookID:      "playbookID",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(true)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{}, nil)
		playbookRunService.EXPECT().GetPlaybookRunIDForChannel(testPlaybookRun.ChannelID).Return(testPlaybookRun.ID, nil).Times(2)
		playbookService.EXPECT().Get(testPlaybookRun.ID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(playbookRunID).Return(&testPlaybookRun, nil)

		resultPlaybookRun, err := c.PlaybookRuns.GetByChannelID(context.TODO(), testPlaybookRun.ChannelID)
		require.NoError(t, err)
		require.Equal(t, testPlaybookRun, toInternalPlaybookRun(*resultPlaybookRun))
	})

	t.Run("get playbook run by runID - not admin, not channel member, private playbook, +not playbook member", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              playbookRunID,
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			PlaybookID:      playbookID,
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{"someone_else"},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.Get(context.TODO(), testPlaybookRun.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		require.Nil(t, resultPlaybookRun)
	})

	t.Run("get playbook run by runID - not admin, not channel member, private playbook, +is playbook member", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              playbookRunID,
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			PlaybookID:      playbookID,
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{"someone_else", userID},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.Get(context.TODO(), testPlaybookRun.ID)
		require.NoError(t, err)
		require.Equal(t, testPlaybookRun, toInternalPlaybookRun(*resultPlaybookRun))
	})

	t.Run("get playbook run by runID - not admin, not channel member, public playbook, +not team member", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              playbookRunID,
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			PlaybookID:      playbookID,
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(false)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.Get(context.TODO(), testPlaybookRun.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		require.Nil(t, resultPlaybookRun)
	})

	t.Run("get playbook run by runID - not admin, not channel member, public playbook, +is team member ", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              playbookRunID,
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			PlaybookID:      playbookID,
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.Get(context.TODO(), testPlaybookRun.ID)
		require.NoError(t, err)
		require.Equal(t, testPlaybookRun, toInternalPlaybookRun(*resultPlaybookRun))
	})

	t.Run("get playbook run by runID - not admin, +is channel member, private playbook, is team member ", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookID := "playbookRunID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              playbookID,
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			PlaybookID:      "playbookID",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{"someone_else"},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(playbookID).Return(&testPlaybookRun, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		playbookService.EXPECT().Get(testPlaybookRun.ID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(false)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.Get(context.TODO(), testPlaybookRun.ID)
		require.NoError(t, err)
		require.Equal(t, testPlaybookRun, toInternalPlaybookRun(*resultPlaybookRun))
	})

	t.Run("get playbook run by runID - +is admin, not channel member, private playbook, is team member ", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		userID := "testUserID"
		playbookID := "playbookRunID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:              playbookID,
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName",
			ChannelID:       "channelID",
			PlaybookID:      "playbookID",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{"someone_else"},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(true)
		playbookRunService.EXPECT().GetPlaybookRun(playbookID).Return(&testPlaybookRun, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		playbookService.EXPECT().Get(testPlaybookRun.ID).Return(testPlaybook, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(false)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		resultPlaybookRun, err := c.PlaybookRuns.Get(context.TODO(), testPlaybookRun.ID)
		require.NoError(t, err)
		require.Equal(t, testPlaybookRun, toInternalPlaybookRun(*resultPlaybookRun))
	})

	t.Run("get private playbook run metadata - not part of channel, not playbook member", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		userID := "testUserID"
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          playbookRunID,
			OwnerUserID: userID,
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
			PostID:      "",
			PlaybookID:  playbookID,
			Checklists:  nil,
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{"someone_else"},
		}

		pluginAPI.On("GetChannel", testPlaybookRun.ChannelID).
			Return(&model.Channel{Type: model.ChannelTypePrivate}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testPlaybookRun.ChannelID, model.PermissionReadChannel).
			Return(false)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(false)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		playbookRunService.EXPECT().
			GetPlaybookRun("playbookRunID").
			Return(&testPlaybookRun, nil)

		resultPlaybookRunMetadata, err := c.PlaybookRuns.GetMetadata(context.TODO(), testPlaybookRun.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		require.Nil(t, resultPlaybookRunMetadata)
	})

	t.Run("get private playbook run metadata - part of channel", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          "playbookRunID",
			OwnerUserID: "testUserID",
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
			PostID:      "",
			PlaybookID:  "",
			Checklists:  []app.Checklist{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{"someone_else"},
		}

		testPlaybookRunMetadata := app.Metadata{
			ChannelName:        "theChannelName",
			ChannelDisplayName: "theChannelDisplayName",
			TeamName:           "ourAwesomeTeam",
			NumParticipants:    11,
			TotalPosts:         42,
		}

		pluginAPI.On("GetChannel", testPlaybookRun.ChannelID).
			Return(&model.Channel{Type: model.ChannelTypePrivate}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testPlaybookRun.ChannelID, model.PermissionReadChannel).
			Return(true)
		playbookService.EXPECT().Get(testPlaybookRun.ID).Return(testPlaybook, nil)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		playbookRunService.EXPECT().
			GetPlaybookRun("playbookRunID").
			Return(&testPlaybookRun, nil)

		playbookRunService.EXPECT().
			GetPlaybookRunMetadata("playbookRunID").
			Return(&testPlaybookRunMetadata, nil)

		resultPlaybookRunMetadata, err := c.PlaybookRuns.GetMetadata(context.TODO(), testPlaybookRun.ID)
		require.NoError(t, err)
		assert.Equal(t, testPlaybookRunMetadata, toInternalPlaybookRunMetadata(*resultPlaybookRunMetadata))
	})

	t.Run("get public playbook run metadata - not part of channel or team", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          playbookRunID,
			OwnerUserID: "testUserID",
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
			PostID:      "",
			PlaybookID:  playbookID,
			Checklists:  nil,
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{},
		}

		pluginAPI.On("GetChannel", testPlaybookRun.ChannelID).
			Return(&model.Channel{Type: model.ChannelTypeOpen, TeamId: testPlaybookRun.TeamID}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testPlaybookRun.ChannelID, model.PermissionReadChannel).
			Return(false)
		pluginAPI.On("HasPermissionToTeam", "testUserID", testPlaybookRun.TeamID, model.PermissionViewTeam).
			Return(false)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		playbookRunService.EXPECT().
			GetPlaybookRun("playbookRunID").
			Return(&testPlaybookRun, nil)

		resultPlaybookRunMetadata, err := c.PlaybookRuns.GetMetadata(context.TODO(), testPlaybookRun.ID)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
		require.Nil(t, resultPlaybookRunMetadata)
	})

	t.Run("get public playbook run metadata - not part of channel, but part of team", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          playbookRunID,
			OwnerUserID: "testUserID",
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
			PostID:      "",
			PlaybookID:  playbookID,
			Checklists:  []app.Checklist{},
		}

		testPlaybookRunMetadata := app.Metadata{
			ChannelName:        "theChannelName",
			ChannelDisplayName: "theChannelDisplayName",
			TeamName:           "ourAwesomeTeam",
			NumParticipants:    11,
			TotalPosts:         42,
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{},
		}

		pluginAPI.On("GetChannel", testPlaybookRun.ChannelID).
			Return(&model.Channel{Type: model.ChannelTypeOpen, TeamId: testPlaybookRun.TeamID}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testPlaybookRun.ChannelID, model.PermissionReadChannel).
			Return(false)
		pluginAPI.On("HasPermissionToTeam", "testUserID", testPlaybookRun.TeamID, model.PermissionViewTeam).
			Return(true)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		playbookRunService.EXPECT().
			GetPlaybookRun("playbookRunID").
			Return(&testPlaybookRun, nil)

		playbookRunService.EXPECT().
			GetPlaybookRunMetadata("playbookRunID").
			Return(&testPlaybookRunMetadata, nil)

		resultPlaybookRunMetadata, err := c.PlaybookRuns.GetMetadata(context.TODO(), testPlaybookRun.ID)
		require.NoError(t, err)
		assert.Equal(t, testPlaybookRunMetadata, toInternalPlaybookRunMetadata(*resultPlaybookRunMetadata))
	})

	t.Run("get public playbook run metadata - part of channel", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          "playbookRunID",
			OwnerUserID: "testUserID",
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
			PostID:      "",
			PlaybookID:  "",
			Checklists:  []app.Checklist{},
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{},
		}

		testPlaybookRunMetadata := app.Metadata{
			ChannelName:        "theChannelName",
			ChannelDisplayName: "theChannelDisplayName",
			TeamName:           "ourAwesomeTeam",
			NumParticipants:    11,
			TotalPosts:         42,
		}

		pluginAPI.On("GetChannel", testPlaybookRun.ChannelID).
			Return(&model.Channel{Type: model.ChannelTypeOpen, TeamId: testPlaybookRun.TeamID}, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", "testUserID", testPlaybookRun.ChannelID, model.PermissionReadChannel).
			Return(true)
		playbookService.EXPECT().Get(testPlaybookRun.ID).Return(testPlaybook, nil)

		logger.EXPECT().Warnf(gomock.Any(), gomock.Any())

		playbookRunService.EXPECT().
			GetPlaybookRun("playbookRunID").
			Return(&testPlaybookRun, nil)

		playbookRunService.EXPECT().
			GetPlaybookRunMetadata("playbookRunID").
			Return(&testPlaybookRunMetadata, nil)

		resultPlaybookRunMetadata, err := c.PlaybookRuns.GetMetadata(context.TODO(), testPlaybookRun.ID)
		require.NoError(t, err)
		assert.Equal(t, testPlaybookRunMetadata, toInternalPlaybookRunMetadata(*resultPlaybookRunMetadata))
	})

	t.Run("get playbook runs", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		playbookRun1 := app.PlaybookRun{
			ID:              "playbookRunID1",
			OwnerUserID:     "testUserID1",
			TeamID:          teamID,
			Name:            "playbookRunName1",
			ChannelID:       "channelID1",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("GetUser", "testUserID").Return(&model.User{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PermissionViewTeam).Return(true)
		result := &app.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []app.PlaybookRun{playbookRun1},
		}
		playbookRunService.EXPECT().GetPlaybookRuns(gomock.Any(), gomock.Any()).Return(result, nil)

		actualList, err := c.PlaybookRuns.List(context.TODO(), 0, 200, icClient.PlaybookRunListOptions{
			TeamID: teamID,
		})
		require.NoError(t, err)

		expectedList := &icClient.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []icClient.PlaybookRun{toAPIPlaybookRun(playbookRun1)},
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("get empty list of playbook runs", func(t *testing.T) {
		reset(t)

		teamID := model.NewId()

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("GetUser", "testUserID").Return(&model.User{}, nil)

		result := &app.GetPlaybookRunsResults{
			TotalCount: 0,
			PageCount:  0,
			HasMore:    false,
			Items:      []app.PlaybookRun{},
		}
		playbookRunService.EXPECT().GetPlaybookRuns(gomock.Any(), gomock.Any()).Return(result, nil)

		actualList, err := c.PlaybookRuns.List(context.TODO(), 0, 100, icClient.PlaybookRunListOptions{
			TeamID: teamID,
		})
		require.NoError(t, err)

		assert.Len(t, actualList.Items, 0)
	})

	t.Run("get in progress playbook runs", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		playbookRun1 := app.PlaybookRun{
			ID:              "playbookRunID1",
			OwnerUserID:     "testUserID1",
			TeamID:          teamID,
			Name:            "playbookRunName1",
			ChannelID:       "channelID1",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("GetUser", "testUserID").Return(&model.User{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PermissionViewTeam).Return(true)
		result := &app.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []app.PlaybookRun{playbookRun1},
		}
		playbookRunService.EXPECT().GetPlaybookRuns(gomock.Any(), gomock.Any()).Return(result, nil)

		actualList, err := c.PlaybookRuns.List(context.TODO(), 0, 200, icClient.PlaybookRunListOptions{
			TeamID:   teamID,
			Statuses: []icClient.Status{icClient.StatusInProgress},
		})
		require.NoError(t, err)

		expectedList := &icClient.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []icClient.PlaybookRun{toAPIPlaybookRun(playbookRun1)},
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("get playbook runs, invalid status", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		teamID := model.NewId()
		playbookRun1 := app.PlaybookRun{
			ID:              "playbookRunID1",
			OwnerUserID:     "testUserID1",
			TeamID:          teamID,
			Name:            "playbookRunName1",
			ChannelID:       "channelID1",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("GetUser", "testUserID").Return(&model.User{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PermissionViewTeam).Return(true)
		result := &app.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []app.PlaybookRun{playbookRun1},
		}
		playbookRunService.EXPECT().GetPlaybookRuns(gomock.Any(), gomock.Any()).Return(result, nil)

		actualList, err := c.PlaybookRuns.List(context.TODO(), 0, 200, icClient.PlaybookRunListOptions{
			TeamID:   teamID,
			Statuses: []icClient.Status{icClient.Status("invalid")},
		})
		require.Error(t, err)
		assert.Empty(t, actualList)
	})

	t.Run("get playbook runs filtered by owner", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		mattermostUserID = userID
		playbookRun1 := app.PlaybookRun{
			ID:              "playbookRunID1",
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName1",
			ChannelID:       "channelID1",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("GetUser", userID).Return(&model.User{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PermissionViewTeam).Return(true)
		result := &app.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []app.PlaybookRun{playbookRun1},
		}
		playbookRunService.EXPECT().GetPlaybookRuns(
			app.RequesterInfo{
				UserID:  userID,
				IsAdmin: false,
				IsGuest: false,
			},
			gomock.Eq(app.PlaybookRunFilterOptions{
				TeamID:    teamID,
				OwnerID:   userID,
				Page:      0,
				PerPage:   200,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
			}),
		).Return(result, nil)

		actualList, err := c.PlaybookRuns.List(context.TODO(), 0, 200, icClient.PlaybookRunListOptions{
			TeamID:  teamID,
			OwnerID: userID,
		})
		require.NoError(t, err)

		expectedList := &icClient.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []icClient.PlaybookRun{toAPIPlaybookRun(playbookRun1)},
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("get playbook runs filtered by owner=me", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		mattermostUserID = userID
		playbookRun1 := app.PlaybookRun{
			ID:              "playbookRunID1",
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName1",
			ChannelID:       "channelID1",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("GetUser", userID).Return(&model.User{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PermissionViewTeam).Return(true)
		result := &app.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []app.PlaybookRun{playbookRun1},
		}
		playbookRunService.EXPECT().GetPlaybookRuns(
			app.RequesterInfo{
				UserID:  userID,
				IsAdmin: false,
				IsGuest: false,
			},
			app.PlaybookRunFilterOptions{
				TeamID:    teamID,
				OwnerID:   userID,
				Page:      0,
				PerPage:   200,
				Sort:      app.SortByCreateAt,
				Direction: app.DirectionAsc,
			},
		).Return(result, nil)

		actualList, err := c.PlaybookRuns.List(context.TODO(), 0, 200, icClient.PlaybookRunListOptions{
			TeamID:  teamID,
			OwnerID: icClient.Me,
		})
		require.NoError(t, err)

		expectedList := &icClient.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []icClient.PlaybookRun{toAPIPlaybookRun(playbookRun1)},
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("get playbook runs filtered by participant", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		mattermostUserID = userID
		playbookRun1 := app.PlaybookRun{
			ID:              "playbookRunID1",
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName1",
			ChannelID:       "channelID1",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("GetUser", userID).Return(&model.User{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PermissionViewTeam).Return(true)
		result := &app.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []app.PlaybookRun{playbookRun1},
		}
		playbookRunService.EXPECT().GetPlaybookRuns(
			app.RequesterInfo{
				UserID:  userID,
				IsAdmin: false,
				IsGuest: false,
			},
			app.PlaybookRunFilterOptions{
				TeamID:        teamID,
				ParticipantID: userID,
				Page:          0,
				PerPage:       200,
				Sort:          app.SortByCreateAt,
				Direction:     app.DirectionAsc,
			},
		).Return(result, nil)

		actualList, err := c.PlaybookRuns.List(context.TODO(), 0, 200, icClient.PlaybookRunListOptions{
			TeamID:        teamID,
			ParticipantID: userID,
		})
		require.NoError(t, err)

		expectedList := &icClient.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []icClient.PlaybookRun{toAPIPlaybookRun(playbookRun1)},
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("get playbook runs filtered by participant=me", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		mattermostUserID = userID
		playbookRun1 := app.PlaybookRun{
			ID:              "playbookRunID1",
			OwnerUserID:     userID,
			TeamID:          teamID,
			Name:            "playbookRunName1",
			ChannelID:       "channelID1",
			Checklists:      []app.Checklist{},
			StatusPosts:     []app.StatusPost{},
			InvitedUserIDs:  []string{},
			InvitedGroupIDs: []string{},
			TimelineEvents:  []app.TimelineEvent{},
		}

		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("GetUser", userID).Return(&model.User{}, nil)
		pluginAPI.On("HasPermissionToTeam", mock.Anything, mock.Anything, model.PermissionViewTeam).Return(true)
		result := &app.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []app.PlaybookRun{playbookRun1},
		}
		playbookRunService.EXPECT().GetPlaybookRuns(
			app.RequesterInfo{
				UserID:  userID,
				IsAdmin: false,
				IsGuest: false,
			},
			app.PlaybookRunFilterOptions{
				TeamID:        teamID,
				ParticipantID: userID,
				Page:          0,
				PerPage:       200,
				Sort:          app.SortByCreateAt,
				Direction:     app.DirectionAsc,
			},
		).Return(result, nil)

		actualList, err := c.PlaybookRuns.List(context.TODO(), 0, 200, icClient.PlaybookRunListOptions{
			TeamID:        teamID,
			ParticipantID: icClient.Me,
		})
		require.NoError(t, err)

		expectedList := &icClient.GetPlaybookRunsResults{
			TotalCount: 100,
			PageCount:  200,
			HasMore:    true,
			Items:      []icClient.PlaybookRun{toAPIPlaybookRun(playbookRun1)},
		}
		assert.Equal(t, expectedList, actualList)
	})

	t.Run("checklist autocomplete for a channel without permission to view", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())
		playbookRunID := "playbookRunID"
		playbookID := "playbookID"

		teamID := model.NewId()
		userID := "testUserID"
		testPlaybookRun := app.PlaybookRun{
			ID:          playbookRunID,
			OwnerUserID: userID,
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
			PlaybookID:  playbookID,
		}
		testPlaybook := app.Playbook{
			TeamID:    teamID,
			MemberIDs: []string{},
		}

		playbookRunService.EXPECT().GetPlaybookRunIDForChannel(testPlaybookRun.ChannelID).Return(testPlaybookRun.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(false)
		pluginAPI.On("GetChannel", mock.Anything).Return(&model.Channel{Type: model.ChannelTypePrivate}, nil)
		pluginAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(false)
		playbookService.EXPECT().Get(testPlaybookRun.PlaybookID).Return(testPlaybook, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/runs/checklist-autocomplete?channel_id="+testPlaybookRun.ChannelID, nil)
		testreq.Header.Add("Mattermost-User-ID", "testUserID")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq)

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("update playbook run status", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          "playbookRunID",
			OwnerUserID: "testUserID",
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
		}

		playbookRunService.EXPECT().GetPlaybookRunIDForChannel(testPlaybookRun.ChannelID).Return(testPlaybookRun.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionCreatePost).Return(true)

		updateOptions := app.StatusUpdateOptions{
			Message:  "test message",
			Reminder: 600 * time.Second,
		}
		playbookRunService.EXPECT().UpdateStatus("playbookRunID", "testUserID", updateOptions).Return(nil)

		err := c.PlaybookRuns.UpdateStatus(context.TODO(), "playbookRunID", "test message", 600)
		require.NoError(t, err)
	})

	t.Run("update playbook run status, no permission to post", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          "playbookRunID",
			OwnerUserID: "testUserID",
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
		}

		playbookRunService.EXPECT().GetPlaybookRunIDForChannel(testPlaybookRun.ChannelID).Return(testPlaybookRun.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionCreatePost).Return(false)

		err := c.PlaybookRuns.UpdateStatus(context.TODO(), "playbookRunID", "test message", 600)
		requireErrorWithStatusCode(t, err, http.StatusForbidden)
	})

	t.Run("update playbook run status, message empty", func(t *testing.T) {
		reset(t)
		setDefaultExpectations(t)
		logger.EXPECT().Warnf(gomock.Any(), gomock.Any(), gomock.Any())

		teamID := model.NewId()
		testPlaybookRun := app.PlaybookRun{
			ID:          "playbookRunID",
			OwnerUserID: "testUserID",
			TeamID:      teamID,
			Name:        "playbookRunName",
			ChannelID:   "channelID",
		}

		playbookRunService.EXPECT().GetPlaybookRunIDForChannel(testPlaybookRun.ChannelID).Return(testPlaybookRun.ID, nil)
		pluginAPI.On("HasPermissionTo", mock.Anything, model.PermissionManageSystem).Return(false)
		playbookRunService.EXPECT().GetPlaybookRun(testPlaybookRun.ID).Return(&testPlaybookRun, nil).Times(2)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionReadChannel).Return(true)
		pluginAPI.On("HasPermissionToChannel", mock.Anything, mock.Anything, model.PermissionCreatePost).Return(true)

		err := c.PlaybookRuns.UpdateStatus(context.TODO(), "playbookRunID", "  \t   \r   \t  \r\r  ", 600)
		requireErrorWithStatusCode(t, err, http.StatusBadRequest)
	})
}
