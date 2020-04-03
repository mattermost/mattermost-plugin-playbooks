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
	mockCtrl := gomock.NewController(t)
	defer mockCtrl.Finish()

	mockkvapi := mock_pluginkvstore.NewMockKVAPI(mockCtrl)

	handler := NewHandler()
	store := pluginkvstore.NewPlaybookStore(mockkvapi)
	playbookService := playbook.NewService(store)
	NewPlaybookHandler(handler.APIRouter, playbookService)

	playbooktest := playbook.Playbook{
		Title: "My Playbook",
		Checklists: []playbook.Checklist{
			playbook.Checklist{
				Title: "Do these things",
				Items: []playbook.ChecklistItem{
					playbook.ChecklistItem{
						Title: "Do this",
					},
				},
			},
		},
	}
	playbooktestBytes, err := json.Marshal(&playbooktest)
	require.NoError(t, err)

	t.Run("create playbook", func(t *testing.T) {
		mockkvapi.EXPECT().Set(gomock.Any(), gomock.Any()).Return(true, nil)

		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("POST", "/api/v1/playbooks", jsonPlaybookReader(playbooktest))
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)
		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("get playbook", func(t *testing.T) {
		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks/testplaybookid", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		mockkvapi.EXPECT().Get("testplaybookid", gomock.Any()).Return(nil).SetArg(1, playbooktest)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)
		assert.Equal(t, playbooktestBytes, result)
	})

	t.Run("get playbooks", func(t *testing.T) {
		testrecorder := httptest.NewRecorder()
		testreq, err := http.NewRequest("GET", "/api/v1/playbooks", nil)
		testreq.Header.Add("Mattermost-User-ID", "testuserid")
		require.NoError(t, err)

		playbookIndex := struct {
			Playbooks []string `json:"playbooks"`
		}{
			Playbooks: []string{
				"playbookid1",
				"playbookid2",
			},
		}
		mockkvapi.EXPECT().Get("playbookindex", gomock.Any()).Return(nil).SetArg(1, playbookIndex)
		mockkvapi.EXPECT().Get("playbookid1", gomock.Any()).Return(nil).SetArg(1, playbooktest)
		mockkvapi.EXPECT().Get("playbookid2", gomock.Any()).Return(nil).SetArg(1, playbooktest)

		handler.ServeHTTP(testrecorder, testreq, "testpluginid")

		resp := testrecorder.Result()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		result, err := ioutil.ReadAll(resp.Body)

		playbooks := []playbook.Playbook{playbooktest, playbooktest}
		playbooksBytes, err := json.Marshal(&playbooks)
		require.NoError(t, err)
		assert.Equal(t, playbooksBytes, result)
	})
}
