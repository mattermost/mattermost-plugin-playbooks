package telemetry

import (
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
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

// UpdateStatus does nothing
func (t *NoopTelemetry) UpdateStatus(*incident.Incident, string) {
}

// FrontendTelemetryForIncident does nothing
func (t *NoopTelemetry) FrontendTelemetryForIncident(*incident.Incident, string, string) {
}

// AddPostToTimeline does nothing
func (t *NoopTelemetry) AddPostToTimeline(*incident.Incident, string) {
}

// RemoveTimelineEvent does nothing
func (t *NoopTelemetry) RemoveTimelineEvent(*incident.Incident, string) {
}

// AddTask does nothing.
func (t *NoopTelemetry) AddTask(string, string) {
}

// RemoveTask does nothing.
func (t *NoopTelemetry) RemoveTask(string, string) {
}

// RenameTask does nothing.
func (t *NoopTelemetry) RenameTask(string, string) {
}

// ModifyCheckedState does nothing.
func (t *NoopTelemetry) ModifyCheckedState(string, string, string, bool, bool) {
}

// SetAssignee does nothing.
func (t *NoopTelemetry) SetAssignee(string, string) {
}

// MoveTask does nothing.
func (t *NoopTelemetry) MoveTask(string, string) {
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

// RunTaskSlashCommand does nothing
func (t *NoopTelemetry) RunTaskSlashCommand(string, string) {
}
