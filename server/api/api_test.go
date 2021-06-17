package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	mock_poster "github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot/mocks"

	"github.com/golang/mock/gomock"
	icClient "github.com/mattermost/mattermost-plugin-incident-collaboration/client"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	mock_config "github.com/mattermost/mattermost-plugin-incident-collaboration/server/config/mocks"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
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
			client := pluginapi.NewClient(pluginAPI)
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

func toAPIIncident(internalIncident app.Incident) icClient.Incident {
	var apiIncident icClient.Incident

	incidentBytes, _ := json.Marshal(internalIncident)
	err := json.Unmarshal(incidentBytes, &apiIncident)
	if err != nil {
		panic(err)
	}

	return apiIncident
}

func toInternalIncident(apiIncident icClient.Incident) app.Incident {
	var internalIncident app.Incident

	incidentBytes, _ := json.Marshal(apiIncident)
	err := json.Unmarshal(incidentBytes, &internalIncident)
	if err != nil {
		panic(err)
	}

	return internalIncident
}

func toInternalIncidentMetadata(apiIncidentMetadata icClient.IncidentMetadata) app.Metadata {
	var internalIncidentMetadata app.Metadata

	incidentBytes, _ := json.Marshal(apiIncidentMetadata)
	err := json.Unmarshal(incidentBytes, &internalIncidentMetadata)
	if err != nil {
		panic(err)
	}

	return internalIncidentMetadata
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
