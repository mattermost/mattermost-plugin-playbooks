package telemetry

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
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
	ID:              "id",
	Name:            "name",
	Description:     "description",
	CommanderUserID: "commander_user_id",
	ReporterUserID:  "reporter_user_id",
	TeamID:          "team_id",
	ChannelID:       "channel_id_1",
	CreateAt:        1234,
	EndAt:           5678,
	DeleteAt:        9999,
	PostID:          "post_id",
	PlaybookID:      "playbookID1",
	Checklists: []playbook.Checklist{
		{
			Title: "Checklist",
			Items: []playbook.ChecklistItem{
				{
					ID:                     "task_id_1",
					Title:                  "Test Item",
					State:                  "",
					StateModified:          1234,
					StateModifiedPostID:    "state_modified_post_id",
					AssigneeID:             "assignee_id",
					AssigneeModified:       5678,
					AssigneeModifiedPostID: "assignee_modified_post_id",
					Command:                "command",
					CommandLastRun:         100000,
					Description:            "description",
				},
			},
		},
		{
			Title: "Checklist 2",
			Items: []playbook.ChecklistItem{
				{Title: "Test Item 2"},
				{Title: "Test Item 3"},
			},
		},
	},
	StatusPosts: []incident.StatusPost{
		{ID: "status_post_1", Status: incident.StatusActive},
		{ID: "status_post_2", Status: incident.StatusReported},
	},
	PreviousReminder: 5 * time.Second,
	TimelineEvents: []incident.TimelineEvent{
		{ID: "timeline_event_1"},
		{ID: "timeline_event_2"},
		{ID: "timeline_event_3"},
	},
}

var dummyTask = dummyIncident.Checklists[0].Items[0]

func assertPayload(t *testing.T, actual rudderPayload, expectedEvent string, expectedAction string) {
	t.Helper()

	incidentFromProperties := func(properties map[string]interface{}) *incident.Incident {
		require.Contains(t, properties, "IncidentID")
		require.Contains(t, properties, "HasDescription")
		require.Contains(t, properties, "CommanderUserID")
		require.Contains(t, properties, "ReporterUserID")
		require.Contains(t, properties, "TeamID")
		require.Contains(t, properties, "ChannelID")
		require.Contains(t, properties, "CreateAt")
		require.Contains(t, properties, "EndAt")
		require.Contains(t, properties, "DeleteAt")
		require.Contains(t, properties, "PostID")
		require.Contains(t, properties, "PlaybookID")
		require.Contains(t, properties, "NumChecklists")
		require.Contains(t, properties, "TotalChecklistItems")
		require.Contains(t, properties, "NumStatusPosts")
		require.Contains(t, properties, "CurrentStatus")
		require.Contains(t, properties, "PreviousReminder")
		require.Contains(t, properties, "NumTimelineEvents")

		return &incident.Incident{
			ID:               properties["IncidentID"].(string),
			Name:             dummyIncident.Name, // not included in the tracked event
			Description:      dummyIncident.Description,
			CommanderUserID:  properties["CommanderUserID"].(string),
			ReporterUserID:   properties["ReporterUserID"].(string),
			TeamID:           properties["TeamID"].(string),
			CreateAt:         int64(properties["CreateAt"].(float64)),
			EndAt:            int64(properties["EndAt"].(float64)),
			DeleteAt:         int64(properties["DeleteAt"].(float64)),
			ChannelID:        "channel_id_1",
			PostID:           properties["PostID"].(string),
			PlaybookID:       dummyIncident.PlaybookID,
			Checklists:       dummyIncident.Checklists, // not included as self in tracked event
			StatusPosts:      dummyIncident.StatusPosts,
			PreviousReminder: time.Duration((properties["PreviousReminder"]).(float64)),
			TimelineEvents:   dummyIncident.TimelineEvents,
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
			rudderClient.AddTask(dummyIncidentID, dummyUserID, dummyTask)
		}},
		"remove checklist item": {eventTasks, actionRemoveTask, func() {
			rudderClient.RemoveTask(dummyIncidentID, dummyUserID, dummyTask)
		}},
		"rename checklist item": {eventTasks, actionRenameTask, func() {
			rudderClient.RenameTask(dummyIncidentID, dummyUserID, dummyTask)
		}},
		"modify checked checklist item": {eventTasks, actionModifyTaskState, func() {
			rudderClient.ModifyCheckedState(dummyIncidentID, dummyUserID, dummyTask, true)
		}},
		"move checklist item": {eventTasks, actionMoveTask, func() {
			rudderClient.MoveTask(dummyIncidentID, dummyUserID, dummyTask)
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

func TestPlaybookProperties(t *testing.T) {
	var dummyPlaybook = playbook.Playbook{
		ID:                   "id",
		Title:                "title",
		Description:          "description",
		TeamID:               "team_id",
		CreatePublicIncident: true,
		CreateAt:             1234,
		DeleteAt:             9999,
		NumStages:            2,
		NumSteps:             3,
		Checklists: []playbook.Checklist{
			{
				Title: "Checklist",
				Items: []playbook.ChecklistItem{
					{
						ID:                     "task_id_1",
						Title:                  "Test Item",
						State:                  "",
						StateModified:          1234,
						StateModifiedPostID:    "state_modified_post_id",
						AssigneeID:             "assignee_id",
						AssigneeModified:       5678,
						AssigneeModifiedPostID: "assignee_modified_post_id",
						Command:                "command",
						CommandLastRun:         100000,
						Description:            "description",
					},
				},
			},
			{
				Title: "Checklist 2",
				Items: []playbook.ChecklistItem{
					{Title: "Test Item 2"},
					{Title: "Test Item 3"},
				},
			},
		},
		MemberIDs:                   []string{"member_1", "member_2"},
		BroadcastChannelID:          "broadcast_channel_id",
		ReminderMessageTemplate:     "reminder_message_template",
		ReminderTimerDefaultSeconds: 1000,
		InvitedUserIDs:              []string{"invited_user_id_1", "invited_user_id_2"},
		InvitedGroupIDs:             []string{"invited_group_id_1", "invited_group_id_2"},
		InviteUsersEnabled:          true,
		DefaultCommanderID:          "default_commander_id",
		DefaultCommanderEnabled:     false,
		AnnouncementChannelID:       "announcement_channel_id",
		AnnouncementChannelEnabled:  true,
		WebhookOnCreationURL:        "webhook_on_creation_url_1\nwebhook_on_creation_url_2",
		WebhookOnCreationEnabled:    false,
		SignalAnyKeywordsEnabled:    true,
		SignalAnyKeywords:           []string{"SEV1, SEV2"},
	}

	properties := playbookProperties(dummyPlaybook, dummyUserID)

	// ID field is reserved by Rudder to uniquely identify every event
	require.NotContains(t, properties, "ID")

	expectedProperties := map[string]interface{}{
		"UserActualID":                dummyUserID,
		"PlaybookID":                  dummyPlaybook.ID,
		"HasDescription":              true,
		"TeamID":                      dummyPlaybook.TeamID,
		"IsPublic":                    dummyPlaybook.CreatePublicIncident,
		"CreateAt":                    dummyPlaybook.CreateAt,
		"DeleteAt":                    dummyPlaybook.DeleteAt,
		"NumChecklists":               len(dummyPlaybook.Checklists),
		"TotalChecklistItems":         3,
		"NumSlashCommands":            1,
		"NumMembers":                  2,
		"BroadcastChannelID":          dummyPlaybook.BroadcastChannelID,
		"UsesReminderMessageTemplate": true,
		"ReminderTimerDefaultSeconds": dummyPlaybook.ReminderTimerDefaultSeconds,
		"NumInvitedUserIDs":           len(dummyPlaybook.InvitedUserIDs),
		"NumInvitedGroupIDs":          len(dummyPlaybook.InvitedGroupIDs),
		"InviteUsersEnabled":          dummyPlaybook.InviteUsersEnabled,
		"DefaultCommanderID":          dummyPlaybook.DefaultCommanderID,
		"DefaultCommanderEnabled":     dummyPlaybook.DefaultCommanderEnabled,
		"AnnouncementChannelID":       dummyPlaybook.AnnouncementChannelID,
		"AnnouncementChannelEnabled":  dummyPlaybook.AnnouncementChannelEnabled,
		"NumWebhookOnCreationURLs":    2,
		"WebhookOnCreationEnabled":    dummyPlaybook.WebhookOnCreationEnabled,
		"SignalAnyKeywordsEnabled":    dummyPlaybook.SignalAnyKeywordsEnabled,
		"NumSignalAnyKeywords":        len(dummyPlaybook.SignalAnyKeywords),
	}

	require.Equal(t, expectedProperties, properties)
}

func TestIncidentProperties(t *testing.T) {
	properties := incidentProperties(dummyIncident, dummyUserID)

	// ID field is reserved by Rudder to uniquely identify every event
	require.NotContains(t, properties, "ID")

	expectedProperties := map[string]interface{}{
		"UserActualID":        dummyUserID,
		"IncidentID":          dummyIncident.ID,
		"HasDescription":      true,
		"CommanderUserID":     dummyIncident.CommanderUserID,
		"ReporterUserID":      dummyIncident.ReporterUserID,
		"TeamID":              dummyIncident.TeamID,
		"ChannelID":           dummyIncident.ChannelID,
		"CreateAt":            dummyIncident.CreateAt,
		"EndAt":               dummyIncident.EndAt,
		"DeleteAt":            dummyIncident.DeleteAt,
		"PostID":              dummyIncident.PostID,
		"PlaybookID":          dummyIncident.PlaybookID,
		"NumChecklists":       2,
		"TotalChecklistItems": 3,
		"NumStatusPosts":      2,
		"CurrentStatus":       dummyIncident.CurrentStatus,
		"PreviousReminder":    dummyIncident.PreviousReminder,
		"NumTimelineEvents":   len(dummyIncident.TimelineEvents),
	}

	require.Equal(t, expectedProperties, properties)
}

func TestTaskProperties(t *testing.T) {
	properties := taskProperties(dummyIncidentID, dummyUserID, dummyTask)

	// ID field is reserved by Rudder to uniquely identify every event
	require.NotContains(t, properties, "ID")

	expectedProperties := map[string]interface{}{
		"IncidentID":     dummyIncidentID,
		"UserActualID":   dummyUserID,
		"TaskID":         dummyTask.ID,
		"State":          dummyTask.State,
		"AssigneeID":     dummyTask.AssigneeID,
		"HasCommand":     true,
		"CommandLastRun": dummyTask.CommandLastRun,
		"HasDescription": true,
	}

	require.Equal(t, expectedProperties, properties)
}
