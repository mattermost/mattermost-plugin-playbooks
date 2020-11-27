package telemetry

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mattermost/mattermost-plugin-incident-management/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"
	rudder "github.com/rudderlabs/analytics-go"
	"github.com/stretchr/testify/require"
)

var (
	diagnosticID    = "dummy_diagnostic_id"
	pluginVersion   = "dummy_plugin_version"
	serverVersion   = "dummy_server_version"
	dummyIncidentID = "dummy_incident_id"
	dummyUserID     = "dummy_user_id"
)

func TestNewRudder(t *testing.T) {
	r, err := NewRudder("dummy_key", "dummy_url", diagnosticID, pluginVersion, serverVersion)
	require.Equal(t, r.diagnosticID, diagnosticID)
	require.Equal(t, r.serverVersion, serverVersion)
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

	writeKey := "dummy_key"
	client, err := rudder.NewWithConfig(writeKey, server.URL, rudder.Config{
		BatchSize: 1,
		Interval:  1 * time.Millisecond,
		Verbose:   true,
	})
	require.NoError(t, err)

	return &RudderTelemetry{
		client:        client,
		diagnosticID:  diagnosticID,
		pluginVersion: pluginVersion,
		serverVersion: serverVersion,
		writeKey:      writeKey,
		dataPlaneURL:  server.URL,
		enabled:       true,
	}, server
}

var dummyIncident = &incident.Incident{
	Header: incident.Header{
		ID:              "id",
		Name:            "name",
		IsActive:        true,
		CommanderUserID: "commander_user_id",
		TeamID:          "team_id",
		CreateAt:        1234,
		ChannelID:       "channel_id_1",
	},
	PostID:     "post_id",
	PlaybookID: "playbookID1",
	Checklists: []playbook.Checklist{
		{
			Title: "Checklist",
			Items: []playbook.ChecklistItem{
				{Title: "Test Item"},
			},
		},
	},
}

func assertPayload(t *testing.T, actual rudderPayload, expectedEvent string, expectedAction string) {
	t.Helper()

	incidentFromProperties := func(properties map[string]interface{}) *incident.Incident {
		require.Contains(t, properties, "PostID")

		require.Contains(t, properties, "IncidentID")
		require.Contains(t, properties, "IsActive")
		require.Contains(t, properties, "CommanderUserID")
		require.Contains(t, properties, "TeamID")
		require.Contains(t, properties, "CreateAt")
		require.Contains(t, properties, "NumChecklists")
		require.Contains(t, properties, "TotalChecklistItems")
		require.Contains(t, properties, "ActiveStage")

		return &incident.Incident{
			Header: incident.Header{
				ID:              properties["IncidentID"].(string),
				Name:            dummyIncident.Name, // not included in the tracked event
				IsActive:        properties["IsActive"].(bool),
				CommanderUserID: properties["CommanderUserID"].(string),
				TeamID:          properties["TeamID"].(string),
				CreateAt:        int64(properties["CreateAt"].(float64)),
				ChannelID:       "channel_id_1",
			},
			PostID:     properties["PostID"].(string),
			PlaybookID: dummyIncident.PlaybookID,
			Checklists: dummyIncident.Checklists, // not included as self in tracked event
		}
	}

	require.Len(t, actual.Batch, 1)
	require.Equal(t, diagnosticID, actual.Batch[0].UserID)
	require.Equal(t, expectedEvent, actual.Batch[0].Event)

	properties := actual.Batch[0].Properties
	require.Equal(t, expectedAction, properties["Action"])
	require.Contains(t, properties, "ServerVersion")
	require.Equal(t, properties["ServerVersion"], serverVersion)
	require.Contains(t, properties, "PluginVersion")
	require.Equal(t, properties["PluginVersion"], pluginVersion)

	if expectedEvent == eventIncident && expectedAction == actionCreate {
		require.Contains(t, properties, "Public")
	}

	if expectedEvent == eventIncident && (expectedAction == actionCreate || expectedAction == actionEnd) {
		require.Equal(t, dummyIncident, incidentFromProperties(properties))
	} else {
		require.Contains(t, properties, "IncidentID")
		require.Equal(t, properties["IncidentID"], dummyIncidentID)
		require.Contains(t, properties, "UserActualID")
		require.Equal(t, properties["UserActualID"], dummyUserID)
	}
}

func TestRudderTelemetry(t *testing.T) {
	data := make(chan rudderPayload)
	rudderClient, rudderServer := setupRudder(t, data)
	defer rudderServer.Close()

	for name, tc := range map[string]struct {
		ExpectedEvent  string
		ExpectedAction string
		FuncToTest     func()
	}{
		"create incident": {eventIncident, actionCreate, func() {
			rudderClient.CreateIncident(dummyIncident, dummyUserID, true)
		}},
		"end incident": {eventIncident, actionEnd, func() {
			rudderClient.EndIncident(dummyIncident, dummyUserID)
		}},
		"add checklist item": {eventTasks, actionAddTask, func() {
			rudderClient.AddTask(dummyIncidentID, dummyUserID)
		}},
		"remove checklist item": {eventTasks, actionRemoveTask, func() {
			rudderClient.RemoveTask(dummyIncidentID, dummyUserID)
		}},
		"rename checklist item": {eventTasks, actionRenameTask, func() {
			rudderClient.RenameTask(dummyIncidentID, dummyUserID)
		}},
		"modify checked checklist item": {eventTasks, actionModifyTaskState, func() {
			rudderClient.ModifyCheckedState(dummyIncidentID, dummyUserID, playbook.ChecklistItemStateOpen, true, false)
		}},
		"move checklist item": {eventTasks, actionMoveTask, func() {
			rudderClient.MoveTask(dummyIncidentID, dummyUserID)
		}},
	} {
		t.Run(name, func(t *testing.T) {
			tc.FuncToTest()

			select {
			case payload := <-data:
				assertPayload(t, payload, tc.ExpectedEvent, tc.ExpectedAction)
			case <-time.After(time.Second * 1):
				require.Fail(t, "Did not receive Event message")
			}
		})
	}
}

func TestDisableTelemetry(t *testing.T) {
	t.Run("disable client", func(t *testing.T) {
		data := make(chan rudderPayload)
		rudderClient, rudderServer := setupRudder(t, data)
		defer rudderServer.Close()

		err := rudderClient.Disable()
		require.NoError(t, err)

		rudderClient.CreateIncident(dummyIncident, dummyUserID, true)

		select {
		case <-data:
			require.Fail(t, "Received Event message while being disabled")
		case <-time.After(time.Second * 1):
			break
		}
	})

	t.Run("disable client is idempotent", func(t *testing.T) {
		data := make(chan rudderPayload)
		rudderClient, rudderServer := setupRudder(t, data)
		defer rudderServer.Close()

		err := rudderClient.Disable()
		require.NoError(t, err)

		err = rudderClient.Disable()
		require.NoError(t, err)

		rudderClient.CreateIncident(dummyIncident, dummyUserID, true)

		select {
		case <-data:
			require.Fail(t, "Received Event message while being disabled")
		case <-time.After(time.Second * 1):
			break
		}
	})

	t.Run("re-disable client", func(t *testing.T) {
		data := make(chan rudderPayload)
		rudderClient, rudderServer := setupRudder(t, data)
		defer rudderServer.Close()

		// Make sure it's enabled before disabling
		err := rudderClient.Enable()
		require.NoError(t, err)

		err = rudderClient.Disable()
		require.NoError(t, err)

		rudderClient.CreateIncident(dummyIncident, dummyUserID, true)

		select {
		case <-data:
			require.Fail(t, "Received Event message while being disabled")
		case <-time.After(time.Second * 1):
			break
		}
	})

	t.Run("re-enable client", func(t *testing.T) {
		// The default timeout in a new Rudder client is 5s. When enabling a
		// disabled client, the config is reset to these defaults.
		// We could replace the client directly in the test, but that kind of
		// defeats the purpose of testing Enable.
		if testing.Short() {
			t.Skip("Skipping re-enable client test: takes at least 6 seconds")
		}

		data := make(chan rudderPayload)
		rudderClient, rudderServer := setupRudder(t, data)
		defer rudderServer.Close()

		// Make sure it's disabled before enabling
		err := rudderClient.Disable()
		require.NoError(t, err)

		err = rudderClient.Enable()
		require.NoError(t, err)

		rudderClient.CreateIncident(dummyIncident, dummyUserID, true)

		select {
		case payload := <-data:
			assertPayload(t, payload, eventIncident, actionCreate)
		case <-time.After(time.Second * 6):
			require.Fail(t, "Did not receive Event message")
		}
	})
}

func TestIncidentProperties(t *testing.T) {
	properties := incidentProperties(dummyIncident, dummyUserID)

	// ID field is reserved by Rudder to uniquely identify every event
	require.NotContains(t, properties, "ID")

	expectedProperties := map[string]interface{}{
		"UserActualID":        dummyUserID,
		"IncidentID":          dummyIncident.ID,
		"IsActive":            dummyIncident.IsActive,
		"CommanderUserID":     dummyIncident.CommanderUserID,
		"TeamID":              dummyIncident.TeamID,
		"CreateAt":            dummyIncident.CreateAt,
		"PlaybookID":          dummyIncident.PlaybookID,
		"PostID":              dummyIncident.PostID,
		"NumChecklists":       1,
		"TotalChecklistItems": 1,
		"ActiveStage":         dummyIncident.ActiveStage,
	}

	require.Equal(t, expectedProperties, properties)
}
