package telemetry

import (
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
)

// NoopTelemetry satisfies the Telemetry interface with no-op implementations.
type NoopTelemetry struct{}

// Enable does nothing, returning always nil.
func (t *NoopTelemetry) Enable() error {
	return nil
}

// Disable does nothing, returning always nil.
func (t *NoopTelemetry) Disable() error {
	return nil
}

// CreateIncident does nothing
func (t *NoopTelemetry) CreateIncident(*incident.Incident, string, bool) {
}

// EndIncident does nothing
func (t *NoopTelemetry) EndIncident(*incident.Incident, string) {
}

// RestartIncident does nothing
func (t *NoopTelemetry) RestartIncident(*incident.Incident, string) {
}

// AddChecklistItem does nothing.
func (t *NoopTelemetry) AddChecklistItem(string, string) {
}

// RemoveChecklistItem does nothing.
func (t *NoopTelemetry) RemoveChecklistItem(string, string) {
}

// RenameChecklistItem does nothing.
func (t *NoopTelemetry) RenameChecklistItem(string, string) {
}

// ModifyCheckedState does nothing.
func (t *NoopTelemetry) ModifyCheckedState(string, string, string, bool, bool) {
}

// SetAssignee does nothing.
func (t *NoopTelemetry) SetAssignee(string, string) {
}

// MoveChecklistItem does nothing.
func (t *NoopTelemetry) MoveChecklistItem(string, string) {
}

// CreatePlaybook does nothing.
func (t *NoopTelemetry) CreatePlaybook(playbook.Playbook, string) {
}

// UpdatePlaybook does nothing.
func (t *NoopTelemetry) UpdatePlaybook(playbook.Playbook, string) {
}

// DeletePlaybook does nothing.
func (t *NoopTelemetry) DeletePlaybook(playbook.Playbook, string) {
}

// ChangeCommander does nothing
func (t *NoopTelemetry) ChangeCommander(*incident.Incident, string) {
}

// ChangeStage does nothing
func (t *NoopTelemetry) ChangeStage(*incident.Incident, string) {
}

// RunChecklistItemSlashCommand does nothing
func (t *NoopTelemetry) RunChecklistItemSlashCommand(string, string) {
}
