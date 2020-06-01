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
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	mock_poster "github.com/mattermost/mattermost-plugin-incident-response/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"
	mock_pluginkvstore "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks"
	"github.com/mattermost/mattermost-plugin-incident-response/server/telemetry"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func jsonPlaybookReader(playbook playbook.Playbook) io.Reader {
	jsonBytes, err := json.Marshal(playbook)
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
	}
	playbooktestBytes, err := json.Marshal(&playbooktest)
	require.NoError(t, err)

	var mockCtrl *gomock.Controller
	var mockkvapi *mock_pluginkvstore.MockKVAPI
	var handler *Handler
	var store *pluginkvstore.PlaybookStore
	var poster *mock_poster.MockPoster
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
		NewPlaybookHandler(handler.APIRouter, playbookService, client)
	}

	t.Run("create playbook", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		mockkvapi.EXPECT().Set(gomock.Any(), gomock.Any()).Return(true, nil)
		playbookIndex := struct {
			PlaybookIDs []string `json:"playbook_ids"`
		}{
			PlaybookIDs: []string{
				"playbookid1",
			},
		}
		mockkvapi.EXPECT().Get(pluginkvstore.IndexKey, gomock.Any()).Return(nil).SetArg(1, playbookIndex)
		mockkvapi.EXPECT().Set(pluginkvstore.IndexKey, gomock.Any(), gomock.Any()).Return(true, nil)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		poster.EXPECT().PublishWebsocketEventToTeam("playbook_created", gomock.Any(), "testteamid")

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/playbooks", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("get playbook", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		playbookIndex := struct {
			PlaybookIDs []string `json:"playbook_ids"`
		}{
			PlaybookIDs: []string{
				"testplaybookid",
			}}
		mockkvapi.EXPECT().Get(pluginkvstore.IndexKey, gomock.Any()).Return(nil).SetArg(1, playbookIndex)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, playbooktest)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)
		assert.NoError(t, err)
		assert.Equal(t, playbooktestBytes, result)
	})

	t.Run("get playbooks", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

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
		mockkvapi.EXPECT().Get(pluginkvstore.IndexKey, gomock.Any()).Return(nil).SetArg(1, playbookIndex)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookid1", gomock.Any()).Return(nil).SetArg(1, playbooktest)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"playbookid2", gomock.Any()).Return(nil).SetArg(1, playbooktest)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)
		assert.NoError(t, err)
		playbooks := []playbook.Playbook{playbooktest, playbooktest}
		playbooksBytes, err := json.Marshal(&playbooks)
		require.NoError(t, err)
		assert.Equal(t, playbooksBytes, result)
	})

	t.Run("update playbook", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v1/playbooks/testplaybookid", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookIndex := struct {
			PlaybookIDs []string `json:"playbook_ids"`
		}{
			PlaybookIDs: []string{
				"testplaybookid",
			},
		}
		mockkvapi.EXPECT().Get(pluginkvstore.IndexKey, gomock.Any()).Return(nil).SetArg(1, playbookIndex)
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, playbooktest)
		mockkvapi.EXPECT().Set(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(true, nil)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		poster.EXPECT().PublishWebsocketEventToTeam("playbook_updated", gomock.Any(), "testteamid")

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)

		require.NoError(t, err)
		assert.Equal(t, []byte(`{"status": "OK"}`), result)
	})

	t.Run("delete playbook", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("DELETE", "/api/v1/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookIndex := struct {
			PlaybookIDs []string `json:"playbook_ids"`
		}{
			PlaybookIDs: []string{
				"playbookid1",
				"testplaybookid",
				"playbookid2",
			},
		}
		mockkvapi.EXPECT().Get(pluginkvstore.IndexKey, gomock.Any()).Return(nil).SetArg(1, playbookIndex).AnyTimes()
		mockkvapi.EXPECT().Set(pluginkvstore.IndexKey, gomock.Any()).Return(true, nil)

		mockkvapi.EXPECT().Set(pluginkvstore.PlaybookKey+"testplaybookid", nil).Return(true, nil)

		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, withid)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(true)
		poster.EXPECT().PublishWebsocketEventToTeam("playbook_deleted", gomock.Any(), "testteamid")

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)

		require.NoError(t, err)
		assert.Equal(t, []byte(`{"status": "OK"}`), result)
	})

	t.Run("delete playbook no permission", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("DELETE", "/api/v1/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookIndex := struct {
			PlaybookIDs []string `json:"playbook_ids"`
		}{
			PlaybookIDs: []string{
				"testplaybookid",
			},
		}
		mockkvapi.EXPECT().Get(pluginkvstore.IndexKey, gomock.Any()).Return(nil).SetArg(1, playbookIndex).AnyTimes()
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, withid)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("create playbook no permission", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/playbooks", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get playbook no permission", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookIndex := struct {
			PlaybookIDs []string `json:"playbook_ids"`
		}{
			PlaybookIDs: []string{
				"testplaybookid",
			},
		}
		mockkvapi.EXPECT().Get(pluginkvstore.IndexKey, gomock.Any()).Return(nil).SetArg(1, playbookIndex).AnyTimes()
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, playbooktest)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("get playbooks no permission", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks?teamid=testteamid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("update playbooks no permission", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v1/playbooks/testplaybookid", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookIndex := struct {
			PlaybookIDs []string `json:"playbook_ids"`
		}{
			PlaybookIDs: []string{
				"testplaybookid",
			},
		}
		mockkvapi.EXPECT().Get(pluginkvstore.IndexKey, gomock.Any()).Return(nil).SetArg(1, playbookIndex).AnyTimes()
		mockkvapi.EXPECT().Get(pluginkvstore.PlaybookKey+"testplaybookid", gomock.Any()).Return(nil).SetArg(1, playbooktest)
		pluginAPI.On("HasPermissionToTeam", "testuserid", "testteamid", model.PERMISSION_VIEW_TEAM).Return(false)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("create playbook playbook with ID", func(t *testing.T) {
		reset()
		defer mockCtrl.Finish()

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/playbooks", jsonPlaybookReader(withid))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}
