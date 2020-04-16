package telemetry

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	rudder "github.com/rudderlabs/analytics-go"
	"github.com/stretchr/testify/require"
)

var (
	diagnosticID  = "dummy_diagnostic_id"
	serverVersion = "dummy_server_version"
)

func TestNewRudder(t *testing.T) {
	rudder, err := NewRudder("dummy_key", "dummy_url", diagnosticID, serverVersion)
	require.Equal(t, rudder.diagnosticID, diagnosticID)
	require.Equal(t, rudder.serverVersion, serverVersion)
	require.NoError(t, err)
}

type rudderPayload struct {
	MessageID string
	SentAt    time.Time
	Batch     []struct {
		MessageID  string
		UserID     string
		Event      string
		Timestamp  time.Time
		Properties map[string]interface{}
	}
	Context struct {
		Library struct {
			Name    string
			Version string
		}
	}
}

func setupRudder(t *testing.T, data chan<- rudderPayload) (*RudderTelemetry, *httptest.Server) {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := ioutil.ReadAll(r.Body)
		require.NoError(t, err)

		var p rudderPayload
		err = json.Unmarshal(body, &p)
		require.NoError(t, err)

		data <- p
	}))

	client, err := rudder.NewWithConfig("dummy_key", rudder.Config{
		Endpoint:  server.URL,
		BatchSize: 1,
		Interval:  1 * time.Millisecond,
		Verbose:   true,
	})
	require.NoError(t, err)

	return &RudderTelemetry{client, diagnosticID, serverVersion}, server
}

var dummyIncident = &incident.Incident{
	Header: incident.Header{
		ID:              "id",
		Name:            "name",
		IsActive:        true,
		CommanderUserID: "commander_user_id",
		TeamID:          "team_id",
		CreatedAt:       1234,
	},
	ChannelIDs: []string{"channel_id_1"},
	PostID:     "post_id",
}

func assertPayload(t *testing.T, actual rudderPayload, expectedEvent string) {
	t.Helper()

	incidentFromProperties := func(properties map[string]interface{}) *incident.Incident {
		require.Contains(t, properties, "ChannelIDs")
		require.Contains(t, properties, "PostID")

		require.Contains(t, properties, "ID")
		require.Contains(t, properties, "IsActive")
		require.Contains(t, properties, "CommanderUserID")
		require.Contains(t, properties, "TeamID")
		require.Contains(t, properties, "CreatedAt")

		ids := properties["ChannelIDs"].([]interface{})
		channelIDs := make([]string, len(ids))
		for i, id := range ids {
			channelIDs[i] = id.(string)
		}

		return &incident.Incident{
			Header: incident.Header{
				ID:              properties["ID"].(string),
				Name:            dummyIncident.Name, // not included in the tracked event
				IsActive:        properties["IsActive"].(bool),
				CommanderUserID: properties["CommanderUserID"].(string),
				TeamID:          properties["TeamID"].(string),
				CreatedAt:       int64(properties["CreatedAt"].(float64)),
			},
			ChannelIDs: channelIDs,
			PostID:     properties["PostID"].(string),
		}
	}

	require.Len(t, actual.Batch, 1)
	require.Equal(t, diagnosticID, actual.Batch[0].UserID)
	require.Equal(t, expectedEvent, actual.Batch[0].Event)

	properties := actual.Batch[0].Properties
	require.Contains(t, properties, "ServerVersion")
	require.Equal(t, properties["ServerVersion"], serverVersion)
	require.Contains(t, properties, "PluginVersion")
	require.Equal(t, properties["PluginVersion"], config.Manifest.Version)

	require.Equal(t, dummyIncident, incidentFromProperties(properties))
}

func TestRudderTelemetryCreateIncident(t *testing.T) {
	data := make(chan rudderPayload)
	rudderClient, rudderServer := setupRudder(t, data)
	defer rudderServer.Close()

	rudderClient.CreateIncident(dummyIncident)

	select {
	case payload := <-data:
		assertPayload(t, payload, eventCreateIncident)
	case <-time.After(time.Second * 1):
		require.Fail(t, "Did not receive Event message")
	}
}

func TestRudderTelemetryEndIncident(t *testing.T) {
	data := make(chan rudderPayload)
	rudderClient, rudderServer := setupRudder(t, data)
	defer rudderServer.Close()

	rudderClient.EndIncident(dummyIncident)

	select {
	case payload := <-data:
		assertPayload(t, payload, eventEndIncident)
	case <-time.After(time.Second * 1):
		require.Fail(t, "Did not receive Event message")
	}
}
