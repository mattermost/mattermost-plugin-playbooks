package api

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	mock_poster "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"
	mock_pluginkvstore "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/telemetry"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
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

	var mockCtrl *gomock.Controller
	var mockkvapi *mock_pluginkvstore.MockKVAPI
	var handler *Handler
	var store *pluginkvstore.PlaybookStore
	var poster *mock_poster.MockPoster
	var logger *mock_poster.MockLogger
	var playbookService playbook.Service
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
		pluginAPI = &plugintest.API{}
		client = pluginapi.NewClient(pluginAPI)
		logger = mock_poster.NewMockLogger(mockCtrl)
		NewPlaybookHandler(handler.APIRouter, playbookService, client, logger)
	}

	t.Run("create playbook", func(t *testing.T) {
		reset()

		mockkvapi.EXPECT().Set(gomock.Any(), gomock.Any()).Return(true, nil)
		mockkvapi.EXPECT().SetAtomicWithRetries(pluginkvstore.PlaybookIndexKey, gomock.Any()).Return(nil)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/playbooks", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("get playbook", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, withid)

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
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks?teamid=testteamid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookIndex := struct {
			PlaybookIDs []string `json:"playbook_ids"`
		}{
			PlaybookIDs: []string{
				"playbookid1",
				"playbookid2",
			},
		}
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookIndexKey, gomock.Any()).Return(nil).SetArg(1, playbookIndex)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookid1", gomock.Any()).Return(nil).SetArg(1, playbooktest)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookid2", gomock.Any()).Return(nil).SetArg(1, playbooktest)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
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
		testreq, err := http.NewRequest("PUT", "/api/v1/playbooks/testplaybookid", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, withid).Times(1)
		mockkvapi.EXPECT().SetAtomicWithRetries(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).Times(1)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)

		require.NoError(t, err)
		assert.Equal(t, []byte(`{"status": "OK"}`), result)
	})

	t.Run("delete playbook", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("DELETE", "/api/v1/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		mockkvapi.EXPECT().SetAtomicWithRetries(pluginkvstore.PlaybookIndexKey, gomock.Any()).Return(nil).Times(1)

		mockkvapi.EXPECT().Set(pluginkvstore.PlaybookKey+"testplaybookid", nil).Return(true, nil)

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, withid)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(true)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)

		require.NoError(t, err)
		assert.Equal(t, []byte(`{"status": "OK"}`), result)
	})

	t.Run("delete playbook no team permission", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("DELETE", "/api/v1/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, withid)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("create playbook no team permission", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/playbooks", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get playbook no team permission", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, withid)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get playbooks no team permission", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks?teamid=testteamid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("update playbooks no team permission", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v1/playbooks/testplaybookid", jsonPlaybookReader(withid))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, withid)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("create playbook playbook with ID", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/playbooks", jsonPlaybookReader(withid))
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
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks/playbookwithmember", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookwithmember", gomock.Any()).Return(nil).SetArg(1, withMember)

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
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks/playbookwithmember", nil)
		testreq.Header.Add("Mattermost-User-ID", "unknownMember")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "unknownMember", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "unknownMember", model.PERMISSION_MANAGE_SYSTEM).Return(false)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookwithmember", gomock.Any()).Return(nil).SetArg(1, withMember)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("update playbook by member", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v1/playbooks/playbookwithmember", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookwithmember", gomock.Any()).Return(nil).SetArg(1, withMember).Times(1)
		mockkvapi.EXPECT().SetAtomicWithRetries(pluginkvstore.PlaybookKey+"playbookwithmember", gomock.Any()).Return(nil).Times(1)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)

		require.NoError(t, err)
		assert.Equal(t, []byte(`{"status": "OK"}`), result)
	})

	t.Run("update playbook by non-member", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v1/playbooks/playbookwithmember", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "unknownMember")
		require.NoError(t, err)

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookwithmember", gomock.Any()).Return(nil).SetArg(1, withMember).Times(1)
		mockkvapi.EXPECT().SetAtomicWithRetries(pluginkvstore.PlaybookKey+"playbookwithmember", gomock.Any()).Return(nil).Times(1)
		pluginAPI.On("HasPermissionToTeam", "unknownMember", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "unknownMember", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("delete playbook by member", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("DELETE", "/api/v1/playbooks/playbookwithmember", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		mockkvapi.EXPECT().SetAtomicWithRetries(pluginkvstore.PlaybookIndexKey, gomock.Any()).Return(nil).Times(1)

		mockkvapi.EXPECT().Set(pluginkvstore.PlaybookKey+"playbookwithmember", nil).Return(true, nil)

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookwithmember", gomock.Any()).Return(nil).SetArg(1, withMember)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "testuserid", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)

		require.NoError(t, err)
		assert.Equal(t, []byte(`{"status": "OK"}`), result)
	})

	t.Run("delete playbook by non-member", func(t *testing.T) {
		reset()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("DELETE", "/api/v1/playbooks/playbookwithmember", nil)
		testreq.Header.Add("Mattermost-User-ID", "unknownMember")
		require.NoError(t, err)

		mockkvapi.EXPECT().SetAtomicWithRetries(pluginkvstore.PlaybookIndexKey, gomock.Any()).Return(nil).Times(1)

		mockkvapi.EXPECT().Set(pluginkvstore.PlaybookKey+"playbookwithmember", nil).Return(true, nil)

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookwithmember", gomock.Any()).Return(nil).SetArg(1, withMember)
		pluginAPI.On("HasPermissionToTeam", "unknownMember", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		pluginAPI.On("HasPermissionTo", "unknownMember", model.PERMISSION_MANAGE_SYSTEM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get playbooks", func(t *testing.T) {
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
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks?teamid=testteamid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookIndex := struct {
			PlaybookIDs []string `json:"playbook_ids"`
		}{
			PlaybookIDs: []string{
				"playbookid1",
				"playbookid2",
			},
		}
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookIndexKey, gomock.Any()).Return(nil).SetArg(1, playbookIndex)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookid1", gomock.Any()).Return(nil).SetArg(1, playbooktest)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookid2", gomock.Any()).Return(nil).SetArg(1, withMember)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
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
