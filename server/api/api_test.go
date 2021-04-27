package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	icClient "github.com/mattermost/mattermost-plugin-incident-collaboration/client"
	mock_config "github.com/mattermost/mattermost-plugin-incident-collaboration/server/config/mocks"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
			handler := NewHandler(client, configService)

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

func toAPIIncident(internalIncident incident.Incident) icClient.Incident {
	var apiIncident icClient.Incident

	incidentBytes, _ := json.Marshal(internalIncident)
	err := json.Unmarshal(incidentBytes, &apiIncident)
	if err != nil {
		panic(err)
	}

	return apiIncident
}

func toInternalIncident(apiIncident icClient.Incident) incident.Incident {
	var internalIncident incident.Incident

	incidentBytes, _ := json.Marshal(apiIncident)
	err := json.Unmarshal(incidentBytes, &internalIncident)
	if err != nil {
		panic(err)
	}

	return internalIncident
}

func toInternalIncidentMetadata(apiIncidentMetadata icClient.IncidentMetadata) incident.Metadata {
	var internalIncidentMetadata incident.Metadata

	incidentBytes, _ := json.Marshal(apiIncidentMetadata)
	err := json.Unmarshal(incidentBytes, &internalIncidentMetadata)
	if err != nil {
		panic(err)
	}

	return internalIncidentMetadata
}

func toAPIPlaybook(internalPlaybook playbook.Playbook) icClient.Playbook {
	var apiPlaybook icClient.Playbook

	playbookBytes, _ := json.Marshal(internalPlaybook)
	err := json.Unmarshal(playbookBytes, &apiPlaybook)
	if err != nil {
		panic(err)
	}

	return apiPlaybook
}

func toAPIPlaybooks(internalPlaybooks []playbook.Playbook) []icClient.Playbook {
	apiPlaybooks := []icClient.Playbook{}

	for _, internalPlaybook := range internalPlaybooks {
		apiPlaybooks = append(apiPlaybooks, toAPIPlaybook(internalPlaybook))
	}

	return apiPlaybooks
}

func toInternalPlaybook(apiPlaybook icClient.Playbook) playbook.Playbook {
	var internalPlaybook playbook.Playbook

	playbookBytes, _ := json.Marshal(apiPlaybook)
	err := json.Unmarshal(playbookBytes, &internalPlaybook)
	if err != nil {
		panic(err)
	}

	return internalPlaybook
}

func toAPIChecklists(internalChecklists []playbook.Checklist) []icClient.Checklist {
	var apiChecklists []icClient.Checklist

	checklistBytes, _ := json.Marshal(internalChecklists)
	err := json.Unmarshal(checklistBytes, &apiChecklists)
	if err != nil {
		panic(err)
	}

	return apiChecklists
}
