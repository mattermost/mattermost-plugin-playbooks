package telemetry

import (
	"sync"

	"github.com/mattermost/mattermost-plugin-incident-management/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-management/server/playbook"
	"github.com/pkg/errors"
	rudder "github.com/rudderlabs/analytics-go"
)

// RudderTelemetry implements Telemetry using a Rudder backend.
type RudderTelemetry struct {
	client        rudder.Client
	diagnosticID  string
	pluginVersion string
	serverVersion string
	writeKey      string
	dataPlaneURL  string
	enabled       bool
	mutex         sync.RWMutex
}

// Unique strings that identify each of the tracked events
const (
	eventIncident         = "incident"
	actionCreate          = "create"
	actionEnd             = "end"
	actionRestart         = "restart"
	actionChangeStage     = "change_stage"
	actionChangeCommander = "change_commander"
	actionUpdateStatus    = "update_status"

	eventTasks                = "tasks"
	actionAddTask             = "add_task"
	actionRemoveTask          = "remove_task"
	actionRenameTask          = "rename_task"
	actionModifyTaskState     = "modify_task_state"
	actionMoveTask            = "move_task"
	actionSetAssigneeForTask  = "set_assignee_for_task"
	actionRunTaskSlashCommand = "run_task_slash_command"

	eventPlaybook = "playbook"
	actionUpdate  = "update"
	actionDelete  = "delete"
)

// NewRudder builds a new RudderTelemetry client that will send the events to
// dataPlaneURL with the writeKey, identified with the diagnosticID. The
// version of the server is also sent with every event tracked.
// If either diagnosticID or serverVersion are empty, an error is returned.
func NewRudder(dataPlaneURL, writeKey, diagnosticID, pluginVersion, serverVersion string) (*RudderTelemetry, error) {
	if diagnosticID == "" {
		return nil, errors.New("diagnosticID should not be empty")
	}

	if pluginVersion == "" {
		return nil, errors.New("pluginVersion should not be empty")
	}

	if serverVersion == "" {
		return nil, errors.New("serverVersion should not be empty")
	}

	client, err := rudder.NewWithConfig(writeKey, dataPlaneURL, rudder.Config{})
	if err != nil {
		return nil, err
	}

	return &RudderTelemetry{
		client:        client,
		diagnosticID:  diagnosticID,
		pluginVersion: pluginVersion,
		serverVersion: serverVersion,
		writeKey:      writeKey,
		dataPlaneURL:  dataPlaneURL,
		enabled:       true,
	}, nil
}

func (t *RudderTelemetry) track(event string, properties map[string]interface{}) {
	t.mutex.RLock()
	defer t.mutex.RUnlock()

	if !t.enabled {
		return
	}

	properties["PluginVersion"] = t.pluginVersion
	properties["ServerVersion"] = t.serverVersion

	_ = t.client.Enqueue(rudder.Track{
		UserId:     t.diagnosticID,
		Event:      event,
		Properties: properties,
	})
}

func incidentProperties(incdnt *incident.Incident, userID string) map[string]interface{} {
	totalChecklistItems := 0
	for _, checklist := range incdnt.Checklists {
		totalChecklistItems += len(checklist.Items)
	}

	return map[string]interface{}{
		"UserActualID":        userID,
		"IncidentID":          incdnt.ID,
		"IsActive":            incdnt.IsActive,
		"CommanderUserID":     incdnt.CommanderUserID,
		"TeamID":              incdnt.TeamID,
		"CreateAt":            incdnt.CreateAt,
		"PostID":              incdnt.PostID,
		"PlaybookID":          incdnt.PlaybookID,
		"NumChecklists":       len(incdnt.Checklists),
		"TotalChecklistItems": totalChecklistItems,
		"ActiveStage":         incdnt.ActiveStage,
	}
}

// CreateIncident tracks the creation of the incident passed.
func (t *RudderTelemetry) CreateIncident(incdnt *incident.Incident, userID string, public bool) {
	properties := incidentProperties(incdnt, userID)
	properties["Action"] = actionCreate
	properties["Public"] = public
	t.track(eventIncident, properties)
}

// EndIncident tracks the end of the incident passed.
func (t *RudderTelemetry) EndIncident(incdnt *incident.Incident, userID string) {
	properties := incidentProperties(incdnt, userID)
	properties["Action"] = actionEnd
	t.track(eventIncident, properties)
}

// RestartIncident tracks the restart of the incident.
func (t *RudderTelemetry) RestartIncident(incdnt *incident.Incident, userID string) {
	properties := incidentProperties(incdnt, userID)
	properties["Action"] = actionRestart
	t.track(eventIncident, properties)
}

// ChangeCommander tracks changes in commander
func (t *RudderTelemetry) ChangeCommander(incdnt *incident.Incident, userID string) {
	properties := incidentProperties(incdnt, userID)
	properties["Action"] = actionChangeCommander
	t.track(eventIncident, properties)
}

// ChangeStage tracks changes in stage
func (t *RudderTelemetry) ChangeStage(incdnt *incident.Incident, userID string) {
	properties := incidentProperties(incdnt, userID)
	properties["Action"] = actionChangeStage
	t.track(eventIncident, properties)
}

func (t *RudderTelemetry) UpdateStatus(incdnt *incident.Incident, userID string) {
	properties := incidentProperties(incdnt, userID)
	properties["Action"] = actionUpdateStatus
	t.track(eventIncident, properties)
}

func taskProperties(incidentID, userID string) map[string]interface{} {
	return map[string]interface{}{
		"IncidentID":   incidentID,
		"UserActualID": userID,
	}
}

// AddTask tracks the creation of a new checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) AddTask(incidentID, userID string) {
	properties := taskProperties(incidentID, userID)
	properties["Action"] = actionAddTask
	t.track(eventTasks, properties)
}

// RemoveTask tracks the removal of a checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) RemoveTask(incidentID, userID string) {
	properties := taskProperties(incidentID, userID)
	properties["Action"] = actionRemoveTask
	t.track(eventTasks, properties)
}

// RenameTask tracks the update of a checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) RenameTask(incidentID, userID string) {
	properties := taskProperties(incidentID, userID)
	properties["Action"] = actionRenameTask
	t.track(eventTasks, properties)
}

// ModifyCheckedState tracks the checking and unchecking of items by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) ModifyCheckedState(incidentID, userID, newState string, wasCommander, wasAssignee bool) {
	properties := taskProperties(incidentID, userID)
	properties["Action"] = actionModifyTaskState
	properties["NewState"] = newState
	properties["WasCommander"] = wasCommander
	properties["WasAssignee"] = wasAssignee
	t.track(eventTasks, properties)
}

// SetAssignee tracks the changing of an assignee on an item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) SetAssignee(incidentID, userID string) {
	properties := taskProperties(incidentID, userID)
	properties["Action"] = actionSetAssigneeForTask
	t.track(eventTasks, properties)
}

// MoveTask tracks the movement of checklist items by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) MoveTask(incidentID, userID string) {
	properties := taskProperties(incidentID, userID)
	properties["Action"] = actionMoveTask
	t.track(eventTasks, properties)
}

// RunTaskSlashCommand tracks the execution of a slash command on a checklist item.
func (t *RudderTelemetry) RunTaskSlashCommand(incidentID, userID string) {
	properties := taskProperties(incidentID, userID)
	properties["Action"] = actionRunTaskSlashCommand
	t.track(eventTasks, properties)
}

func playbookProperties(pbook playbook.Playbook, userID string) map[string]interface{} {
	totalChecklistItems := 0
	totalChecklistItemsWithCommands := 0
	for _, checklist := range pbook.Checklists {
		totalChecklistItems += len(checklist.Items)
		for _, item := range checklist.Items {
			if item.Command != "" {
				totalChecklistItemsWithCommands++
			}
		}
	}

	return map[string]interface{}{
		"UserActualID":        userID,
		"PlaybookID":          pbook.ID,
		"TeamID":              pbook.TeamID,
		"NumChecklists":       len(pbook.Checklists),
		"TotalChecklistItems": totalChecklistItems,
		"IsPublic":            pbook.CreatePublicIncident,
		"NumMembers":          len(pbook.MemberIDs),
		"NumSlashCommands":    totalChecklistItemsWithCommands,
	}
}

// CreatePlaybook tracks the creation of a playbook.
func (t *RudderTelemetry) CreatePlaybook(pbook playbook.Playbook, userID string) {
	properties := playbookProperties(pbook, userID)
	properties["Action"] = actionCreate
	t.track(eventPlaybook, properties)
}

// UpdatePlaybook tracks the update of a playbook.
func (t *RudderTelemetry) UpdatePlaybook(pbook playbook.Playbook, userID string) {
	properties := playbookProperties(pbook, userID)
	properties["Action"] = actionUpdate
	t.track(eventPlaybook, properties)
}

// DeletePlaybook tracks the deletion of a playbook.
func (t *RudderTelemetry) DeletePlaybook(pbook playbook.Playbook, userID string) {
	properties := playbookProperties(pbook, userID)
	properties["Action"] = actionDelete
	t.track(eventPlaybook, properties)
}

// Enable creates a new client to track all future events. It does nothing if
// a client is already enabled.
func (t *RudderTelemetry) Enable() error {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	if t.enabled {
		return nil
	}

	newClient, err := rudder.NewWithConfig(t.writeKey, t.dataPlaneURL, rudder.Config{})
	if err != nil {
		return errors.Wrap(err, "creating a new Rudder client in Enable failed")
	}

	t.client = newClient
	t.enabled = true
	return nil
}

// Disable disables telemetry for all future events. It does nothing if the
// client is already disabled.
func (t *RudderTelemetry) Disable() error {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	if !t.enabled {
		return nil
	}

	if err := t.client.Close(); err != nil {
		return errors.Wrap(err, "closing the Rudder client in Disable failed")
	}

	t.enabled = false
	return nil
}
