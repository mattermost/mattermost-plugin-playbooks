package api

import (
	"bytes"
	"encoding/json"
	"io"
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
	mockkvapi.EXPECT().Set(gomock.Any(), gomock.Any()).Return(true, nil)

	handler := NewHandler()
	store := pluginkvstore.NewPlaybookStore(mockkvapi)
	playbookService := playbook.NewService(store)
	NewPlaybookHandler(handler.APIRouter, playbookService, nil)

	testrecorder := httptest.NewRecorder()

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
	testreq, err := http.NewRequest("POST", "/api/v1/playbooks", jsonPlaybookReader(playbooktest))
	testreq.Header.Add("Mattermost-User-ID", "testuserid")
	require.NoError(t, err)
	handler.ServeHTTP(testrecorder, testreq, "testpluginid")

	resp := testrecorder.Result()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
