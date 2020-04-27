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
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore"
	mock_pluginkvstore "github.com/mattermost/mattermost-plugin-incident-response/server/pluginkvstore/mocks"
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
		Title: "My Playbook",
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
	playbooktestBytes, err := json.Marshal(&playbooktest)
	require.NoError(t, err)

	t.Run("create playbook", func(t *testing.T) {
		mockCtrl := gomock.NewController(t)
		defer mockCtrl.Finish()
		mockkvapi := mock_pluginkvstore.NewMockKVAPI(mockCtrl)
		handler := NewHandler()
		store := pluginkvstore.NewPlaybookStore(mockkvapi)
		playbookService := playbook.NewService(store)
		NewPlaybookHandler(handler.APIRouter, playbookService)

		mockkvapi.EXPECT().Set(gomock.Any(), gomock.Any()).Return(true, nil)
		playbookIndex := struct {
			PlaybookIDs []string `json:"playbook_ids"`
		}{
			PlaybookIDs: []string{
				"playbookid1",
			},
		}
		mockkvapi.EXPECT().Get("playbookindex", gomock.Any()).Return(nil).SetArg(1, playbookIndex)
		mockkvapi.EXPECT().Set("playbookindex", gomock.Any(), gomock.Any()).Return(true, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/playbooks", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("get playbook", func(t *testing.T) {
		mockCtrl := gomock.NewController(t)
		defer mockCtrl.Finish()
		mockkvapi := mock_pluginkvstore.NewMockKVAPI(mockCtrl)
		handler := NewHandler()
		store := pluginkvstore.NewPlaybookStore(mockkvapi)
		playbookService := playbook.NewService(store)
		NewPlaybookHandler(handler.APIRouter, playbookService)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		mockkvapi.EXPECT().Get("playbook_testplaybookid", gomock.Any()).Return(nil).SetArg(1, playbooktest)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)
		assert.NoError(t, err)
		assert.Equal(t, playbooktestBytes, result)
	})

	t.Run("get playbooks", func(t *testing.T) {
		mockCtrl := gomock.NewController(t)
		defer mockCtrl.Finish()
		mockkvapi := mock_pluginkvstore.NewMockKVAPI(mockCtrl)
		handler := NewHandler()
		store := pluginkvstore.NewPlaybookStore(mockkvapi)
		playbookService := playbook.NewService(store)
		NewPlaybookHandler(handler.APIRouter, playbookService)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks", nil)
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
		mockkvapi.EXPECT().Get("playbookindex", gomock.Any()).Return(nil).SetArg(1, playbookIndex)
		mockkvapi.EXPECT().Get("playbook_playbookid1", gomock.Any()).Return(nil).SetArg(1, playbooktest)
		mockkvapi.EXPECT().Get("playbook_playbookid2", gomock.Any()).Return(nil).SetArg(1, playbooktest)

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
		mockCtrl := gomock.NewController(t)
		defer mockCtrl.Finish()
		mockkvapi := mock_pluginkvstore.NewMockKVAPI(mockCtrl)
		handler := NewHandler()
		store := pluginkvstore.NewPlaybookStore(mockkvapi)
		playbookService := playbook.NewService(store)
		NewPlaybookHandler(handler.APIRouter, playbookService)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("PUT", "/api/v1/playbooks/testplaybookid", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		mockkvapi.EXPECT().Set("playbook_testplaybookid", gomock.Any()).Return(true, nil)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)

		require.NoError(t, err)
		assert.Equal(t, []byte(`{"status": "OK"}`), result)
	})

	t.Run("delete playbook", func(t *testing.T) {
		mockCtrl := gomock.NewController(t)
		defer mockCtrl.Finish()
		mockkvapi := mock_pluginkvstore.NewMockKVAPI(mockCtrl)
		handler := NewHandler()
		store := pluginkvstore.NewPlaybookStore(mockkvapi)
		playbookService := playbook.NewService(store)
		NewPlaybookHandler(handler.APIRouter, playbookService)

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
		mockkvapi.EXPECT().Get("playbookindex", gomock.Any()).Return(nil).SetArg(1, playbookIndex)
		mockkvapi.EXPECT().Set("playbookindex", gomock.Any()).Return(true, nil)
		mockkvapi.EXPECT().Set("playbook_testplaybookid", nil).Return(true, nil)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)

		require.NoError(t, err)
		assert.Equal(t, []byte(`{"status": "OK"}`), result)
	})
}
