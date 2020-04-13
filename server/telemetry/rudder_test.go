package telemetry

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	rudder "github.com/rudderlabs/analytics-go"
	"github.com/stretchr/testify/require"
)

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

var diagnosticID = "dummy_diagnostic_id"

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

	return &RudderTelemetry{client, diagnosticID}, server
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
		require.Contains(t, properties, "Header")

		header := properties["Header"].(map[string]interface{})
		require.Contains(t, header, "ID")
		require.Contains(t, header, "Name")
		require.Contains(t, header, "IsActive")
		require.Contains(t, header, "CommanderUserID")
		require.Contains(t, header, "TeamID")
		require.Contains(t, header, "CreatedAt")

		ids := properties["ChannelIDs"].([]interface{})
		channelIDs := make([]string, len(ids))
		for i, id := range ids {
			channelIDs[i] = id.(string)
		}

		return &incident.Incident{
			Header: incident.Header{
				ID:              header["ID"].(string),
				Name:            header["Name"].(string),
				IsActive:        header["IsActive"].(bool),
				CommanderUserID: header["CommanderUserID"].(string),
				TeamID:          header["TeamID"].(string),
				CreatedAt:       int64(header["CreatedAt"].(float64)),
			},
			ChannelIDs: channelIDs,
			PostID:     properties["PostID"].(string),
		}
	}

	require.Len(t, actual.Batch, 1)
	require.Equal(t, diagnosticID, actual.Batch[0].UserID)
	require.Equal(t, expectedEvent, actual.Batch[0].Event)
	require.Equal(t, dummyIncident, incidentFromProperties(actual.Batch[0].Properties))
}

func TestRudderTelemetryTrackIncidentNew(t *testing.T) {
	data := make(chan rudderPayload, 100)
	rudderClient, rudderServer := setupRudder(t, data)
	defer rudderServer.Close()

	rudderClient.TrackIncidentNew(dummyIncident)

	select {
	case payload := <-data:
		assertPayload(t, payload, EventIncidentNew)
	case <-time.After(time.Second * 1):
		require.Fail(t, "Did not receive Event message")
	}
}

func TestRudderTelemetryTrackIncidentEnd(t *testing.T) {
	data := make(chan rudderPayload, 100)
	rudderClient, rudderServer := setupRudder(t, data)
	defer rudderServer.Close()

	rudderClient.TrackIncidentEnd(dummyIncident)

	select {
	case payload := <-data:
		assertPayload(t, payload, EventIncidentEnd)
	case <-time.After(time.Second * 1):
		require.Fail(t, "Did not receive Event message")
	}
}

func TestNewRudder(t *testing.T) {
	rudder, err := NewRudder("dummy_key", "dummy_url", diagnosticID)
	require.Equal(t, rudder.diagnosticID, diagnosticID)
	require.NoError(t, err)
}
