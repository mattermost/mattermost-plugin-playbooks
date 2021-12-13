package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	mock_poster "github.com/mattermost/mattermost-plugin-playbooks/v2/server/bot/mocks"

	"github.com/golang/mock/gomock"
	icClient "github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/v2/server/app"
	mock_config "github.com/mattermost/mattermost-plugin-playbooks/v2/server/config/mocks"
	"github.com/mattermost/mattermost-server/v6/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

func TestAPI(t *testing.T) {
	for name, tc := range map[string]struct {
		test     func(t *testing.T, handler *Handler, writer *httptest.ResponseRecorder)
		authFunc func(string) (bool, error)
	}{
		"404": {
			test: func(t *testing.T, handler *Handler, writer *httptest.ResponseRecorder) {
				req := httptest.NewRequest("POST", "/api/v0/nothing", nil)
				handler.ServeHTTP(writer, req)
				resp := writer.Result()
				defer resp.Body.Close()
				assert.Equal(t, http.StatusNotFound, resp.StatusCode)
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			mockCtrl := gomock.NewController(t)
			configService := mock_config.NewMockService(mockCtrl)
			pluginAPI := &plugintest.API{}
			client := pluginapi.NewClient(pluginAPI, &plugintest.Driver{})
			logger := mock_poster.NewMockLogger(mockCtrl)
			handler := NewHandler(client, configService, logger)

			writer := httptest.NewRecorder()
			tc.test(t, handler, writer)
		})
	}
}

func requireErrorWithStatusCode(t *testing.T, err error, statusCode int) {
	t.Helper()

	require.Error(t, err)

	var errResponse *icClient.ErrorResponse
	require.Truef(t, errors.As(err, &errResponse), "err is not an instance of errResponse: %s", err.Error())
	require.Equal(t, statusCode, errResponse.StatusCode)
}

func toAPIPlaybookRun(internalPlaybookRun app.PlaybookRun) icClient.PlaybookRun {
	var apiPlaybookRun icClient.PlaybookRun

	playbookRunBytes, _ := json.Marshal(internalPlaybookRun)
	err := json.Unmarshal(playbookRunBytes, &apiPlaybookRun)
	if err != nil {
		panic(err)
	}

	return apiPlaybookRun
}

func toInternalPlaybookRun(apiPlaybookRun icClient.PlaybookRun) app.PlaybookRun {
	var internalPlaybookRun app.PlaybookRun

	playbookRunBytes, _ := json.Marshal(apiPlaybookRun)
	err := json.Unmarshal(playbookRunBytes, &internalPlaybookRun)
	if err != nil {
		panic(err)
	}

	return internalPlaybookRun
}

func toInternalPlaybookRunMetadata(apiPlaybookRunMetadata icClient.PlaybookRunMetadata) app.Metadata {
	var internalPlaybookRunMetadata app.Metadata

	playbookRunBytes, _ := json.Marshal(apiPlaybookRunMetadata)
	err := json.Unmarshal(playbookRunBytes, &internalPlaybookRunMetadata)
	if err != nil {
		panic(err)
	}

	return internalPlaybookRunMetadata
}

func toAPIPlaybook(internalPlaybook app.Playbook) icClient.Playbook {
	var apiPlaybook icClient.Playbook

	playbookBytes, _ := json.Marshal(internalPlaybook)
	err := json.Unmarshal(playbookBytes, &apiPlaybook)
	if err != nil {
		panic(err)
	}

	return apiPlaybook
}

func toAPIPlaybooks(internalPlaybooks []app.Playbook) []icClient.Playbook {
	apiPlaybooks := []icClient.Playbook{}

	for _, internalPlaybook := range internalPlaybooks {
		apiPlaybooks = append(apiPlaybooks, toAPIPlaybook(internalPlaybook))
	}

	return apiPlaybooks
}

func toInternalPlaybook(apiPlaybook icClient.Playbook) app.Playbook {
	var internalPlaybook app.Playbook

	playbookBytes, _ := json.Marshal(apiPlaybook)
	err := json.Unmarshal(playbookBytes, &internalPlaybook)
	if err != nil {
		panic(err)
	}

	return internalPlaybook
}

func toAPIChecklists(internalChecklists []app.Checklist) []icClient.Checklist {
	var apiChecklists []icClient.Checklist

	checklistBytes, _ := json.Marshal(internalChecklists)
	err := json.Unmarshal(checklistBytes, &apiChecklists)
	if err != nil {
		panic(err)
	}

	return apiChecklists
}
