package telemetry

import "github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"

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

// CreatePlaybookRun does nothing
func (t *NoopTelemetry) CreatePlaybookRun(*app.PlaybookRun, string, bool) {
}

// EndPlaybookRun does nothing
func (t *NoopTelemetry) EndPlaybookRun(*app.PlaybookRun, string) {
}

// RestartPlaybookRun does nothing
func (t *NoopTelemetry) RestartPlaybookRun(*app.PlaybookRun, string) {
}

// UpdateStatus does nothing
func (t *NoopTelemetry) UpdateStatus(*app.PlaybookRun, string) {
}

// FrontendTelemetryForPlaybookRun does nothing
func (t *NoopTelemetry) FrontendTelemetryForPlaybookRun(*app.PlaybookRun, string, string) {
}

// AddPostToTimeline does nothing
func (t *NoopTelemetry) AddPostToTimeline(*app.PlaybookRun, string) {
}

// RemoveTimelineEvent does nothing
func (t *NoopTelemetry) RemoveTimelineEvent(*app.PlaybookRun, string) {
}

// AddTask does nothing.
func (t *NoopTelemetry) AddTask(string, string, app.ChecklistItem) {
}

// RemoveTask does nothing.
func (t *NoopTelemetry) RemoveTask(string, string, app.ChecklistItem) {
}

// RenameTask does nothing.
func (t *NoopTelemetry) RenameTask(string, string, app.ChecklistItem) {
}

// ModifyCheckedState does nothing.
func (t *NoopTelemetry) ModifyCheckedState(string, string, app.ChecklistItem, bool) {
}

// SetAssignee does nothing.
func (t *NoopTelemetry) SetAssignee(string, string, app.ChecklistItem) {
}

// MoveTask does nothing.
func (t *NoopTelemetry) MoveTask(string, string, app.ChecklistItem) {
}

// CreatePlaybook does nothing.
func (t *NoopTelemetry) CreatePlaybook(app.Playbook, string) {
}

// UpdatePlaybook does nothing.
func (t *NoopTelemetry) UpdatePlaybook(app.Playbook, string) {
}

// DeletePlaybook does nothing.
func (t *NoopTelemetry) DeletePlaybook(app.Playbook, string) {
}

// ChangeOwner does nothing
func (t *NoopTelemetry) ChangeOwner(*app.PlaybookRun, string) {
}

// RunTaskSlashCommand does nothing
func (t *NoopTelemetry) RunTaskSlashCommand(string, string, app.ChecklistItem) {
}

func (t *NoopTelemetry) UpdateRetrospective(playbookRun *app.PlaybookRun, userID string) {
}

func (t *NoopTelemetry) PublishRetrospective(playbookRun *app.PlaybookRun, userID string) {
}

// StartTrialToViewTimeline does nothing.
func (t *NoopTelemetry) StartTrialToViewTimeline(userID string) {
}

// StartTrialToAddMessageToTimeline does nothing.
func (t *NoopTelemetry) StartTrialToAddMessageToTimeline(userID string) {
}

// StartTrialToCreatePlaybook does nothing.
func (t *NoopTelemetry) StartTrialToCreatePlaybook(userID string) {
}

// StartTrialToRestrictPlaybookCreation does nothing.
func (t *NoopTelemetry) StartTrialToRestrictPlaybookCreation(userID string) {
}

// StartTrialToRestrictPlaybookAccess does nothing.
func (t *NoopTelemetry) StartTrialToRestrictPlaybookAccess(userID string) {
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
