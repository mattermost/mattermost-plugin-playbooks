package telemetry

import (
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
)

// NoopTelemetry satisfies the Telemetry interface with no-op implementations.
type NoopTelemetry struct{}

// CreateIncident does nothing
func (t *NoopTelemetry) CreateIncident(incdnt *incident.Incident, public bool) {
}

// EndIncident does nothing
func (t *NoopTelemetry) EndIncident(*incident.Incident) {
}

// AddChecklistItem does nothing.
func (t *NoopTelemetry) AddChecklistItem(incidentID, userID string) {
}

// RemoveChecklistItem does nothing.
func (t *NoopTelemetry) RemoveChecklistItem(incidentID, userID string) {
}

// RenameChecklistItem does nothing.
func (t *NoopTelemetry) RenameChecklistItem(incidentID, userID string) {
}

// ModifyCheckedState does nothing.
func (t *NoopTelemetry) ModifyCheckedState(incidentID, userID string, newState bool) {
}

// MoveChecklistItem does nothing.
func (t *NoopTelemetry) MoveChecklistItem(incidentID, userID string) {
}

// CreatePlaybook does nothing.
func (t *NoopTelemetry) CreatePlaybook(pbook playbook.Playbook) {
}

// UpdatePlaybook does nothing.
func (t *NoopTelemetry) UpdatePlaybook(pbook playbook.Playbook) {
}

// DeletePlaybook does nothing.
func (t *NoopTelemetry) DeletePlaybook(pbook playbook.Playbook) {
}
