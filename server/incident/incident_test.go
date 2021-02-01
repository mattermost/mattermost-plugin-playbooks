package incident

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIncident_MarshalJSON(t *testing.T) {
	testIncident := &Incident{}
	result, err := json.Marshal(testIncident)
	require.NoError(t, err)
	// Should not contain null. Triggering this?
	// Add your new nullable thing to one of the MarshalJSONs in incident/incident.go
	require.NotContains(t, string(result), "null")
}
