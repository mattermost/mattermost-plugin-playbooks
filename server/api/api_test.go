package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	icClient "github.com/mattermost/mattermost-plugin-incident-collaboration/client"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
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
			handler := NewHandler()
			writer := httptest.NewRecorder()
			tc.test(t, handler, writer)
		})
	}
}

func requireErrorWithStatusCode(t *testing.T, err error, statusCode int) {
	t.Helper()

	require.Error(t, err)

	var errResponse *icClient.ErrorResponse
	require.True(t, errors.As(err, &errResponse))
	require.Equal(t, statusCode, errResponse.StatusCode)
}

func toApiIncident(internalIncident incident.Incident) icClient.Incident {
	var apiIncident icClient.Incident

	incidentBytes, _ := json.Marshal(internalIncident)
	json.Unmarshal(incidentBytes, &apiIncident)

	return apiIncident
}

func toInternalIncident(apiIncident icClient.Incident) incident.Incident {
	var internalIncident incident.Incident

	incidentBytes, _ := json.Marshal(apiIncident)
	json.Unmarshal(incidentBytes, &internalIncident)

	return internalIncident
}

func toApiIncidentMetadata(internalIncidentMetadata incident.Metadata) icClient.IncidentMetadata {
	var apiIncidentMetadata icClient.IncidentMetadata

	incidentBytes, _ := json.Marshal(internalIncidentMetadata)
	json.Unmarshal(incidentBytes, &apiIncidentMetadata)

	return apiIncidentMetadata
}

func toInternalIncidentMetadata(apiIncidentMetadata icClient.IncidentMetadata) incident.Metadata {
	var internalIncidentMetadata incident.Metadata

	incidentBytes, _ := json.Marshal(apiIncidentMetadata)
	json.Unmarshal(incidentBytes, &internalIncidentMetadata)

	return internalIncidentMetadata
}
