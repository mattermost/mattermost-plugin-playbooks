package telemetry

import (
	"sync"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
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
	eventCreateIncident           = "CreateIncident"
	eventEndIncident              = "EndIncident"
	eventRestartIncident          = "RestartIncident"
	eventAddChecklistItem         = "AddChecklistItem"
	eventRemoveChecklistItem      = "RemoveChecklistItem"
	eventRenameChecklistItem      = "RenameChecklistItem"
	eventModifyStateChecklistItem = "ModifyStateChecklistItem"
	eventMoveChecklistItem        = "MoveChecklistItem"
	eventSetAssignee              = "SetAssignee"
	eventCreatePlaybook           = "CreatePlaybook"
	eventUpdatePlaybook           = "UpdatePlaybook"
	eventDeletePlaybook           = "DeletePlaybook"
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

func incidentProperties(incdnt *incident.Incident) map[string]interface{} {
	totalChecklistItems := 0
	for _, checklist := range incdnt.Playbook.Checklists {
		totalChecklistItems += len(checklist.Items)
	}

	return map[string]interface{}{
		"IncidentID":          incdnt.ID,
		"IsActive":            incdnt.IsActive,
		"CommanderUserID":     incdnt.CommanderUserID,
		"TeamID":              incdnt.TeamID,
		"CreatedAt":           incdnt.CreatedAt,
		"PostID":              incdnt.PostID,
		"NumChecklists":       len(incdnt.Playbook.Checklists),
		"TotalChecklistItems": totalChecklistItems,
	}
}

// CreateIncident tracks the creation of the incident passed.
func (t *RudderTelemetry) CreateIncident(incdnt *incident.Incident, public bool) {
	properties := incidentProperties(incdnt)
	properties["Public"] = public
	t.track(eventCreateIncident, properties)
}

// EndIncident tracks the end of the incident passed.
func (t *RudderTelemetry) EndIncident(incdnt *incident.Incident) {
	t.track(eventEndIncident, incidentProperties(incdnt))
}

// RestartIncident tracks the restart of the incident.
func (t *RudderTelemetry) RestartIncident(incdnt *incident.Incident) {
	t.track(eventRestartIncident, incidentProperties(incdnt))
}

func checklistItemProperties(incidentID, userID string) map[string]interface{} {
	return map[string]interface{}{
		"IncidentID":   incidentID,
		"UserActualID": userID,
	}
}

// AddChecklistItem tracks the creation of a new checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) AddChecklistItem(incidentID, userID string) {
	t.track(eventAddChecklistItem, checklistItemProperties(incidentID, userID))
}

// RemoveChecklistItem tracks the removal of a checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) RemoveChecklistItem(incidentID, userID string) {
	t.track(eventRemoveChecklistItem, checklistItemProperties(incidentID, userID))
}

// RenameChecklistItem tracks the update of a checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) RenameChecklistItem(incidentID, userID string) {
	t.track(eventRenameChecklistItem, checklistItemProperties(incidentID, userID))
}

// ModifyCheckedState tracks the checking and unchecking of items by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) ModifyCheckedState(incidentID, userID, newState string) {
	t.track(eventModifyStateChecklistItem, checklistItemProperties(incidentID, userID))
}

// SetAssignee tracks the changing of an assignee on an item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) SetAssignee(incidentID, userID string) {
	t.track(eventSetAssignee, checklistItemProperties(incidentID, userID))
}

// MoveChecklistItem tracks the movement of checklist items by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) MoveChecklistItem(incidentID, userID string) {
	t.track(eventMoveChecklistItem, checklistItemProperties(incidentID, userID))
}

func playbookProperties(pbook playbook.Playbook) map[string]interface{} {
	totalChecklistItems := 0
	for _, checklist := range pbook.Checklists {
		totalChecklistItems += len(checklist.Items)
	}

	return map[string]interface{}{
		"PlaybookID":          pbook.ID,
		"TeamID":              pbook.TeamID,
		"NumChecklists":       len(pbook.Checklists),
		"TotalChecklistItems": totalChecklistItems,
	}
}

// CreatePlaybook tracks the creation of a playbook.
func (t *RudderTelemetry) CreatePlaybook(pbook playbook.Playbook) {
	t.track(eventCreatePlaybook, playbookProperties(pbook))
}

// UpdatePlaybook tracks the update of a playbook.
func (t *RudderTelemetry) UpdatePlaybook(pbook playbook.Playbook) {
	t.track(eventUpdatePlaybook, playbookProperties(pbook))
}

// DeletePlaybook tracks the deletion of a playbook.
func (t *RudderTelemetry) DeletePlaybook(pbook playbook.Playbook) {
	t.track(eventDeletePlaybook, playbookProperties(pbook))
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
