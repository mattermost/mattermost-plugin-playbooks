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
func (t *NoopTelemetry) AddTask(string, string, playbook.ChecklistItem) {
}

// RemoveTask does nothing.
func (t *NoopTelemetry) RemoveTask(string, string, playbook.ChecklistItem) {
}

// RenameTask does nothing.
func (t *NoopTelemetry) RenameTask(string, string, playbook.ChecklistItem) {
}

// ModifyCheckedState does nothing.
func (t *NoopTelemetry) ModifyCheckedState(string, string, playbook.ChecklistItem, bool) {
}

// SetAssignee does nothing.
func (t *NoopTelemetry) SetAssignee(string, string, playbook.ChecklistItem) {
}

// MoveTask does nothing.
func (t *NoopTelemetry) MoveTask(string, string, playbook.ChecklistItem) {
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
func (t *NoopTelemetry) RunTaskSlashCommand(string, string, playbook.ChecklistItem) {
}

func (t *NoopTelemetry) UpdateRetrospective(incident *incident.Incident, userID string) {
}

func (t *NoopTelemetry) PublishRetrospective(incident *incident.Incident, userID string) {
}

// NotifyAdminsToViewTimeline does nothing.
func (t *NoopTelemetry) NotifyAdminsToViewTimeline(userID string) {

}

// NotifyAdminsToAddMessageToTimeline does nothing.
func (t *NoopTelemetry) NotifyAdminsToAddMessageToTimeline(userID string) {

}

// NotifyAdminsToCreatePlaybook does nothing.
func (t *NoopTelemetry) NotifyAdminsToCreatePlaybook(userID string) {

}

// NotifyAdminsToRestrictPlaybookCreation does nothing.
func (t *NoopTelemetry) NotifyAdminsToRestrictPlaybookCreation(userID string) {

}

// NotifyAdminsToRestrictPlaybookAccess does nothing.
func (t *NoopTelemetry) NotifyAdminsToRestrictPlaybookAccess(userID string) {

}
