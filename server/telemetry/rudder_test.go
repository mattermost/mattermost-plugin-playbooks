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
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	rudder "github.com/rudderlabs/analytics-go"
	"github.com/stretchr/testify/require"
)

var (
	diagnosticID    = "dummy_diagnostic_id"
	serverVersion   = "dummy_server_version"
	dummyIncidentID = "dummy_incident_id"
	dummyUserID     = "dummy_user_id"
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

	client, err := rudder.NewWithConfig("dummy_key", server.URL, rudder.Config{
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
	Playbook: &playbook.Playbook{
		Title: "test",
		Checklists: []playbook.Checklist{
			{
				Title: "Checklist",
				Items: []playbook.ChecklistItem{
					{Title: "Test Item"},
				},
			},
		},
	},
}

func assertPayload(t *testing.T, actual rudderPayload, expectedEvent string) {
	t.Helper()

	incidentFromProperties := func(properties map[string]interface{}) *incident.Incident {
		require.Contains(t, properties, "ChannelIDs")
		require.Contains(t, properties, "PostID")

		require.Contains(t, properties, "IncidentID")
		require.Contains(t, properties, "IsActive")
		require.Contains(t, properties, "CommanderUserID")
		require.Contains(t, properties, "TeamID")
		require.Contains(t, properties, "CreatedAt")
		require.Contains(t, properties, "NumChecklists")
		require.Contains(t, properties, "TotalChecklistItems")

		ids := properties["ChannelIDs"].([]interface{})
		channelIDs := make([]string, len(ids))
		for i, id := range ids {
			channelIDs[i] = id.(string)
		}

		return &incident.Incident{
			Header: incident.Header{
				ID:              properties["IncidentID"].(string),
				Name:            dummyIncident.Name, // not included in the tracked event
				IsActive:        properties["IsActive"].(bool),
				CommanderUserID: properties["CommanderUserID"].(string),
				TeamID:          properties["TeamID"].(string),
				CreatedAt:       int64(properties["CreatedAt"].(float64)),
			},
			ChannelIDs: channelIDs,
			PostID:     properties["PostID"].(string),
			Playbook:   dummyIncident.Playbook, // not included as self in tracked event
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

	if expectedEvent == eventCreateIncident || expectedEvent == eventEndIncident {
		require.Equal(t, dummyIncident, incidentFromProperties(properties))
	} else {
		require.Contains(t, properties, "IncidentID")
		require.Equal(t, properties["IncidentID"], dummyIncidentID)
		require.Contains(t, properties, "UserID")
		require.Equal(t, properties["UserID"], dummyUserID)
	}
}

func TestRudderTelemetry(t *testing.T) {
	data := make(chan rudderPayload)
	rudderClient, rudderServer := setupRudder(t, data)
	defer rudderServer.Close()

	for name, tc := range map[string]struct {
		Event      string
		FuncToTest func()
	}{
		"create incident":                       {eventCreateIncident, func() { rudderClient.CreateIncident(dummyIncident) }},
		"end incident":                          {eventEndIncident, func() { rudderClient.EndIncident(dummyIncident) }},
		"add checklist item":                    {eventAddChecklistItem, func() { rudderClient.AddChecklistItem(dummyIncidentID, dummyUserID) }},
		"remove checklist item":                 {eventRemoveChecklistItem, func() { rudderClient.RemoveChecklistItem(dummyIncidentID, dummyUserID) }},
		"rename checklist item":                 {eventRenameChecklistItem, func() { rudderClient.RenameChecklistItem(dummyIncidentID, dummyUserID) }},
		"modify checked checklist item check":   {eventCheckChecklistItem, func() { rudderClient.ModifyCheckedState(dummyIncidentID, dummyUserID, true) }},
		"modify checked checklist item uncheck": {eventUncheckChecklistItem, func() { rudderClient.ModifyCheckedState(dummyIncidentID, dummyUserID, false) }},
		"move checklist item":                   {eventMoveChecklistItem, func() { rudderClient.MoveChecklistItem(dummyIncidentID, dummyUserID) }},
	} {
		t.Run(name, func(t *testing.T) {
			tc.FuncToTest()

			select {
			case payload := <-data:
				assertPayload(t, payload, tc.Event)
			case <-time.After(time.Second * 1):
				require.Fail(t, "Did not receive Event message")
			}
		})
	}
}

func TestIncidentProperties(t *testing.T) {
	properties := incidentProperties(dummyIncident)

	// ID field is reserved by Rudder to uniquely identify every event
	require.NotContains(t, properties, "ID")

	expectedProperties := map[string]interface{}{
		"IncidentID":          dummyIncident.ID,
		"IsActive":            dummyIncident.IsActive,
		"CommanderUserID":     dummyIncident.CommanderUserID,
		"TeamID":              dummyIncident.TeamID,
		"CreatedAt":           dummyIncident.CreatedAt,
		"ChannelIDs":          dummyIncident.ChannelIDs,
		"PostID":              dummyIncident.PostID,
		"NumChecklists":       1,
		"TotalChecklistItems": 1,
	}

	require.Equal(t, expectedProperties, properties)
}
