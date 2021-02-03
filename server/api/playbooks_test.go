package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	mock_poster "github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	mock_playbook "github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func jsonPlaybookReader(pbook playbook.Playbook) io.Reader {
	jsonBytes, err := json.Marshal(pbook)
	if err != nil {
		panic(err)
	}
	return bytes.NewReader(jsonBytes)
}

func TestPlaybooks(t *testing.T) {
	playbooktest := playbook.Playbook{
		Title:  "My Playbook",
		TeamID: "testteamid",
		Checklists: []playbook.Checklist{
			{
				Title: "Do these things",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this",
					},
				},
			},
		},
		MemberIDs: []string{},
	}
	withid := playbook.Playbook{
		ID:     "testplaybookid",
		Title:  "My Playbook",
		TeamID: "testteamid",
		Checklists: []playbook.Checklist{
			{
				Title: "Do these things",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this",
					},
				},
			},
		},
		MemberIDs: []string{},
	}
	withidBytes, err := json.Marshal(&withid)
	require.NoError(t, err)

	withMember := playbook.Playbook{
		ID:     "playbookwithmember",
		Title:  "My Playbook",
		TeamID: "testteamid",
		Checklists: []playbook.Checklist{
			{
				Title: "Do these things",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this",
					},
				},
			},
		},
		MemberIDs: []string{"testuserid"},
	}
	withMemberBytes, err := json.Marshal(&withMember)
	require.NoError(t, err)
	withBroadcastChannel := playbook.Playbook{
		ID:     "testplaybookid",
		Title:  "My Playbook",
		TeamID: "testteamid",
		Checklists: []playbook.Checklist{
			{
				Title: "Do these things",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this",
					},
				},
			},
		},
		MemberIDs:          []string{},
		BroadcastChannelID: "nonemptychannelid",
	}
	withBroadcastChannelNoID := playbook.Playbook{
		Title:  "My Playbook",
		TeamID: "testteamid",
		Checklists: []playbook.Checklist{
			{
				Title: "Do these things",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this",
					},
				},
			},
		},
		MemberIDs:          []string{},
		BroadcastChannelID: "nonemptychannelid",
	}

	var mockCtrl *gomock.Controller
	var handler *Handler
	var logger *mock_poster.MockLogger
	var playbookService *mock_playbook.MockService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	reset := func() {
		mockCtrl = gomock.NewController(t)
		handler = NewHandler()
		playbookService = mock_playbook.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI)
		logger = mock_poster.NewMockLogger(mockCtrl)
		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger)
	}

	t.Run("create playbook", func(t *testing.T) {
		reset()

		playbookService.EXPECT().
			Create(playbooktest, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/playbooks", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("create playbook, no premissions to broadcast channel", func(t *testing.T) {
		reset()

		playbookService.EXPECT().
			Create(playbooktest, "testuserid").
			Return(model.NewId(), nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionToChannel", "testuserid", withBroadcastChannelNoID.BroadcastChannelID, model.PERMISSION_CREATE_POST).Return(false)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/playbooks", jsonPlaybookReader(withBroadcastChannelNoID))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get playbook", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withid, nil).
			Times(1)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)
		assert.NoError(t, err)
		assert.Equal(t, withidBytes, result)
	})

	t.Run("get playbooks", func(t *testing.T) {
		reset()

		playbookResult := struct {
			TotalCount int                 `json:"total_count"`
			PageCount  int                 `json:"page_count"`
			HasMore    bool                `json:"has_more"`
			Items      []playbook.Playbook `json:"items"`
		}{
			TotalCount: 2,
			PageCount:  1,
			HasMore:    false,
			Items:      []playbook.Playbook{playbooktest, playbooktest},
		}

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/playbooks?team_id=testteamid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			GetPlaybooksForTeam(
				playbook.RequesterInfo{
					UserID:          "testuserid",
					TeamID:          "testteamid",
					UserIDtoIsAdmin: map[string]bool{"testuserid": true},
				},
				"testteamid",
				gomock.Any(),
			).
			Return(playbookResult, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)
		assert.NoError(t, err)
		playbooksBytes, err := json.Marshal(&playbookResult)
		require.NoError(t, err)
		assert.Equal(t, playbooksBytes, result)
	})

	t.Run("update playbook", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v0/playbooks/testplaybookid", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(playbooktest, nil).
			Times(1)

		playbookService.EXPECT().
			Update(withid, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("update playbook but no premissions in broadcast channel", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v0/playbooks/testplaybookid", jsonPlaybookReader(withBroadcastChannel))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(playbooktest, nil).
			Times(1)

		playbookService.EXPECT().
			Update(withid, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		pluginAPI.On("HasPermissionToChannel", "testuserid", withBroadcastChannel.BroadcastChannelID, model.PERMISSION_CREATE_POST).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("update playbook but no premissions in broadcast channel, but no edit", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v0/playbooks/testplaybookid", jsonPlaybookReader(withBroadcastChannel))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withBroadcastChannel, nil).
			Times(1)

		playbookService.EXPECT().
			Update(withBroadcastChannel, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("delete playbook", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("DELETE", "/api/v0/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withid, nil).
			Times(1)

		playbookService.EXPECT().
			Delete(withid, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	})

	t.Run("delete playbook no team permission", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("DELETE", "/api/v0/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withid, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("create playbook no team permission", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/playbooks", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get playbook no team permission", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withid, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get playbooks no team permission", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/playbooks?team_id=testteamid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("update playbooks no team permission", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v0/playbooks/testplaybookid", jsonPlaybookReader(withid))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("testplaybookid").
			Return(withid, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("create playbook playbook with ID", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v0/playbooks", jsonPlaybookReader(withid))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("get playbook by member", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/playbooks/playbookwithmember", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)
		assert.NoError(t, err)
		assert.Equal(t, withMemberBytes, result)
	})

	t.Run("get playbook by non-member", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/playbooks/playbookwithmember", nil)
		testreq.Header.Add("Mattermost-User-ID", "unknownMember")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "unknownMember", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "unknownMember", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("update playbook by member", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v0/playbooks/playbookwithmember", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		updatedPlaybook := playbooktest
		updatedPlaybook.ID = "playbookwithmember"

		playbookService.EXPECT().
			Update(updatedPlaybook, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("update playbook by non-member", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v0/playbooks/playbookwithmember", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "unknownMember")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		updatedPlaybook := playbooktest
		updatedPlaybook.ID = "playbookwithmember"

		playbookService.EXPECT().
			Update(updatedPlaybook, "testUserID").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "unknownMember", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "unknownMember", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("delete playbook by member", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("DELETE", "/api/v0/playbooks/playbookwithmember", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		playbookService.EXPECT().
			Delete(withMember, "testuserid").
			Return(nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	})

	t.Run("delete playbook by non-member", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("DELETE", "/api/v0/playbooks/playbookwithmember", nil)
		testreq.Header.Add("Mattermost-User-ID", "unknownMember")
		require.NoError(t, err)

		playbookService.EXPECT().
			Get("playbookwithmember").
			Return(withMember, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "unknownMember", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "unknownMember", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get playbooks with members", func(t *testing.T) {
		reset()

		playbookResult := struct {
			TotalCount int                 `json:"total_count"`
			PageCount  int                 `json:"page_count"`
			HasMore    bool                `json:"has_more"`
			Items      []playbook.Playbook `json:"items"`
		}{
			TotalCount: 1,
			PageCount:  1,
			HasMore:    false,
			Items:      []playbook.Playbook{withMember},
		}

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v0/playbooks?team_id=testteamid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookService.EXPECT().
			GetPlaybooksForTeam(
				playbook.RequesterInfo{
					UserID:          "testuserid",
					TeamID:          "testteamid",
					UserIDtoIsAdmin: map[string]bool{"testuserid": false},
				},
				"testteamid",
				gomock.Any(),
			).
			Return(playbookResult, nil).
			Times(1)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)
		assert.NoError(t, err)
		playbooksBytes, err := json.Marshal(&playbookResult)
		require.NoError(t, err)
		assert.Equal(t, playbooksBytes, result)
	})
}

func TestSortingPlaybooks(t *testing.T) {
	playbooktest1 := playbook.Playbook{
		Title:  "A",
		TeamID: "testteamid",
		Checklists: []playbook.Checklist{
			{
				Title: "A",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this1",
					},
				},
			},
		},
	}
	playbooktest2 := playbook.Playbook{
		Title:  "B",
		TeamID: "testteamid",
		Checklists: []playbook.Checklist{
			{
				Title: "B",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
				},
			},
			{
				Title: "B",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
				},
			},
		},
	}
	playbooktest3 := playbook.Playbook{
		Title:  "C",
		TeamID: "testteamid",
		Checklists: []playbook.Checklist{
			{
				Title: "C",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
			{
				Title: "C",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
			{
				Title: "C",
				Items: []playbook.ChecklistItem{
					{
						Title: "Do this1",
					},
					{
						Title: "Do this2",
					},
					{
						Title: "Do this3",
					},
				},
			},
		},
	}

	var mockCtrl *gomock.Controller
	var handler *Handler
	var logger *mock_poster.MockLogger
	var playbookService *mock_playbook.MockService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	reset := func() {
		mockCtrl = gomock.NewController(t)
		handler = NewHandler()
		playbookService = mock_playbook.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI)
		logger = mock_poster.NewMockLogger(mockCtrl)
		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger)
	}

	testData := []struct {
		testName           string
		sortField          string
		sortDirection      string
		expectedList       []playbook.Playbook
		expectedErr        error
		expectedStatusCode int
	}{
		{
			testName:           "get playbooks with invalid sort field",
			sortField:          "test",
			sortDirection:      "",
			expectedList:       nil,
			expectedErr:        errors.New("bad parameter 'sort' (test)"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with invalid sort direction",
			sortField:          "",
			sortDirection:      "test",
			expectedList:       nil,
			expectedErr:        errors.New("bad parameter 'direction' (test)"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with no sort fields",
			sortField:          "",
			sortDirection:      "",
			expectedList:       []playbook.Playbook{playbooktest1, playbooktest2, playbooktest3},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=title direction=asc",
			sortField:          "title",
			sortDirection:      "asc",
			expectedList:       []playbook.Playbook{playbooktest1, playbooktest2, playbooktest3},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=title direction=desc",
			sortField:          "title",
			sortDirection:      "desc",
			expectedList:       []playbook.Playbook{playbooktest3, playbooktest2, playbooktest1},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=stages direction=asc",
			sortField:          "stages",
			sortDirection:      "asc",
			expectedList:       []playbook.Playbook{playbooktest1, playbooktest2, playbooktest3},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=stages direction=desc",
			sortField:          "stages",
			sortDirection:      "desc",
			expectedList:       []playbook.Playbook{playbooktest3, playbooktest2, playbooktest1},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=steps direction=asc",
			sortField:          "steps",
			sortDirection:      "asc",
			expectedList:       []playbook.Playbook{playbooktest1, playbooktest2, playbooktest3},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName:           "get playbooks with sort=steps direction=desc",
			sortField:          "steps",
			sortDirection:      "desc",
			expectedList:       []playbook.Playbook{playbooktest3, playbooktest2, playbooktest1},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
	}

	for _, data := range testData {
		t.Run(data.testName, func(t *testing.T) {
			reset()

			playbookResult := struct {
				TotalCount int                 `json:"total_count"`
				PageCount  int                 `json:"page_count"`
				HasMore    bool                `json:"has_more"`
				Items      []playbook.Playbook `json:"items"`
			}{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      data.expectedList,
			}

			testrecorder := httptest.NewRecorder()
			testreq, err := http.NewRequest("GET", fmt.Sprintf("/api/v0/playbooks?team_id=testteamid&sort=%s&direction=%s", data.sortField, data.sortDirection), nil)
			testreq.Header.Add("Mattermost-User-ID", "testuserid")
			require.NoError(t, err)

			playbookService.EXPECT().
				GetPlaybooksForTeam(
					playbook.RequesterInfo{
						UserID:          "testuserid",
						TeamID:          "testteamid",
						UserIDtoIsAdmin: map[string]bool{"testuserid": true},
					},
					"testteamid",
					gomock.Any(),
				).
				Return(playbookResult, nil).
				Times(1)

			pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
			pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

			handler.ServeHTTP(testrecorder, testreq, "testpluginid")
			resp := testrecorder.Result()
			defer resp.Body.Close()

			assert.Equal(t, data.expectedStatusCode, resp.StatusCode)
			if data.expectedErr == nil {
				result, err := ioutil.ReadAll(resp.Body)
				assert.NoError(t, err)
				playbooksBytes, err := json.Marshal(&playbookResult)
				require.NoError(t, err)
				assert.Equal(t, playbooksBytes, result)
			} else {
				result, err := ioutil.ReadAll(resp.Body)
				assert.NoError(t, err)

				errorResult := struct {
					Error string `json:"error"`
				}{}

				err = json.Unmarshal(result, &errorResult)
				require.NoError(t, err)
				assert.Contains(t, errorResult.Error, data.expectedErr.Error())
			}
		})
	}
}

func TestPagingPlaybooks(t *testing.T) {
	playbooktest1 := playbook.Playbook{
		Title:      "A",
		TeamID:     "testteamid",
		Checklists: []playbook.Checklist{},
		MemberIDs:  []string{},
	}
	playbooktest2 := playbook.Playbook{
		Title:      "B",
		TeamID:     "testteamid",
		Checklists: []playbook.Checklist{},
		MemberIDs:  []string{},
	}
	playbooktest3 := playbook.Playbook{
		Title:      "C",
		TeamID:     "testteamid",
		Checklists: []playbook.Checklist{},
		MemberIDs:  []string{},
	}

	var mockCtrl *gomock.Controller
	var handler *Handler
	var logger *mock_poster.MockLogger
	var playbookService *mock_playbook.MockService
	var pluginAPI *plugintest.API
	var client *pluginapi.Client

	reset := func() {
		mockCtrl = gomock.NewController(t)
		handler = NewHandler()
		playbookService = mock_playbook.NewMockService(mockCtrl)
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI)
		logger = mock_poster.NewMockLogger(mockCtrl)
		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger)
	}

	testData := []struct {
		testName           string
		page               string
		perPage            string
		expectedResult     playbook.GetPlaybooksResults
		emptyStore         bool
		expectedErr        error
		expectedStatusCode int
	}{
		{
			testName:           "get playbooks with invalid page values",
			page:               "test",
			perPage:            "test",
			expectedResult:     playbook.GetPlaybooksResults{},
			expectedErr:        errors.New("bad parameter"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName:           "get playbooks with negative page values",
			page:               "-1",
			perPage:            "-1",
			expectedResult:     playbook.GetPlaybooksResults{},
			expectedErr:        errors.New("bad parameter"),
			expectedStatusCode: http.StatusBadRequest,
		},
		{
			testName: "get playbooks with page=0 per_page=0 with empty store",
			page:     "0",
			perPage:  "0",
			expectedResult: playbook.GetPlaybooksResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []playbook.Playbook{},
			},
			emptyStore:         true,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=1 per_page=1 with empty store",
			page:     "1",
			perPage:  "1",
			expectedResult: playbook.GetPlaybooksResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []playbook.Playbook{},
			},
			emptyStore:         true,
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=0 per_page=0",
			page:     "0",
			perPage:  "0",
			expectedResult: playbook.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{playbooktest1, playbooktest2, playbooktest3},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=0 per_page=3",
			page:     "0",
			perPage:  "3",
			expectedResult: playbook.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  1,
				HasMore:    false,
				Items:      []playbook.Playbook{playbooktest1, playbooktest2, playbooktest3},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=0 per_page=2",
			page:     "0",
			perPage:  "2",
			expectedResult: playbook.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  2,
				HasMore:    true,
				Items:      []playbook.Playbook{playbooktest1, playbooktest2},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=1 per_page=2",
			page:     "1",
			perPage:  "2",
			expectedResult: playbook.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  2,
				HasMore:    false,
				Items:      []playbook.Playbook{playbooktest3},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=2 per_page=2",
			page:     "2",
			perPage:  "2",
			expectedResult: playbook.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  2,
				HasMore:    false,
				Items:      []playbook.Playbook{},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
		{
			testName: "get playbooks with page=9999 per_page=2",
			page:     "9999",
			perPage:  "2",
			expectedResult: playbook.GetPlaybooksResults{
				TotalCount: 3,
				PageCount:  2,
				HasMore:    false,
				Items:      []playbook.Playbook{},
			},
			expectedErr:        nil,
			expectedStatusCode: http.StatusOK,
		},
	}

	for _, data := range testData {
		t.Run(data.testName, func(t *testing.T) {
			reset()

			testrecorder := httptest.NewRecorder()
			testreq, err := http.NewRequest("GET", fmt.Sprintf("/api/v0/playbooks?team_id=testteamid&page=%s&per_page=%s", data.page, data.perPage), nil)
			testreq.Header.Add("Mattermost-User-ID", "testuserid")
			require.NoError(t, err)

			playbookService.EXPECT().
				GetPlaybooksForTeam(
					playbook.RequesterInfo{
						UserID:          "testuserid",
						TeamID:          "testteamid",
						UserIDtoIsAdmin: map[string]bool{"testuserid": true},
					},
					"testteamid",
					gomock.Any(),
				).
				Return(data.expectedResult, nil).
				Times(1)

			pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_LIST_TEAM_CHANNELS).Return(true)
			pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

			handler.ServeHTTP(testrecorder, testreq, "testpluginid")
			resp := testrecorder.Result()
			defer resp.Body.Close()

			assert.Equal(t, data.expectedStatusCode, resp.StatusCode)
			if data.expectedErr == nil {
				actualList := playbook.GetPlaybooksResults{}
				err = json.NewDecoder(resp.Body).Decode(&actualList)
				require.NoError(t, err)
				assert.Equal(t, data.expectedResult, actualList)
			} else {
				result, err := ioutil.ReadAll(resp.Body)
				assert.NoError(t, err)

				errorResult := struct {
					Error string `json:"error"`
				}{}

				err = json.Unmarshal(result, &errorResult)
				require.NoError(t, err)
				assert.Contains(t, errorResult.Error, data.expectedErr.Error())
			}
		})
	}
}
