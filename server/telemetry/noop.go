package telemetry

import "github.com/mattermost/mattermost-plugin-playbooks/server/app"

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
func (t *NoopTelemetry) FinishPlaybookRun(*app.PlaybookRun, string) {
}

// RestorePlaybookRun does nothing
func (t *NoopTelemetry) RestorePlaybookRun(*app.PlaybookRun, string) {
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

// SkipTask does nothing.
func (t *NoopTelemetry) SkipTask(string, string, app.ChecklistItem) {
}

// RestoreTask does nothing.
func (t *NoopTelemetry) RestoreTask(string, string, app.ChecklistItem) {
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

// RestorePlaybook does nothing either.
func (t *NoopTelemetry) RestorePlaybook(app.Playbook, string) {
}

// ChangeOwner does nothing
func (t *NoopTelemetry) ChangeOwner(*app.PlaybookRun, string) {
}

// RunTaskSlashCommand does nothing
func (t *NoopTelemetry) RunTaskSlashCommand(string, string, app.ChecklistItem) {
}

// AddChecklist does nothing
func (t *NoopTelemetry) AddChecklist(playbookRunID, userID string, checklist app.Checklist) {
}

// RemoveChecklist does nothing
func (t *NoopTelemetry) RemoveChecklist(playbookRunID, userID string, checklist app.Checklist) {
}

// RenameChecklist does nothing
func (t *NoopTelemetry) RenameChecklist(playbookRunID, userID string, checklist app.Checklist) {
}

func (t *NoopTelemetry) UpdateRetrospective(playbookRun *app.PlaybookRun, userID string) {
}

func (t *NoopTelemetry) PublishRetrospective(playbookRun *app.PlaybookRun, userID string) {
}

// StartTrial does nothing.
func (t *NoopTelemetry) StartTrial(userID string, action string) {
}

// NotifyAdmins does nothing.
func (t *NoopTelemetry) NotifyAdmins(userID string, action string) {
}

// FrontendTelemetryForPlaybook does nothing.
func (t *NoopTelemetry) FrontendTelemetryForPlaybook(playbook app.Playbook, userID, action string) {
}

// FrontendTelemetryForPlaybookTemplate does nothing.
func (t *NoopTelemetry) FrontendTelemetryForPlaybookTemplate(templateName string, userID, action string) {
}

// ChangeDigestSettings does nothing
func (t *NoopTelemetry) ChangeDigestSettings(userID string, old app.DigestNotificationSettings, new app.DigestNotificationSettings) {
}
