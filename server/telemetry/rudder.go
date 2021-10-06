package telemetry

import (
	"sync"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"

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
	eventPlaybookRun               = "incident"
	actionCreate                   = "create"
	actionEnd                      = "end"
	actionRestart                  = "restart"
	actionChangeOwner              = "change_commander"
	actionUpdateStatus             = "update_status"
	actionAddTimelineEventFromPost = "add_timeline_event_from_post"
	actionUpdateRetrospective      = "update_retrospective"
	actionPublishRetrospective     = "publish_retrospective"
	actionRemoveTimelineEvent      = "remove_timeline_event"

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

	eventFrontend = "frontend"

	eventNotifyAdmins = "notify_admins"

	eventStartTrial = "start_trial"

	// telemetryKeyPlaybookRunID records the legacy name used to identify a playbook run via telemetry.
	telemetryKeyPlaybookRunID = "IncidentID"
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

func playbookRunProperties(playbookRun *app.PlaybookRun, userID string) map[string]interface{} {
	totalChecklistItems := 0
	for _, checklist := range playbookRun.Checklists {
		totalChecklistItems += len(checklist.Items)
	}

	return map[string]interface{}{
		"UserActualID":            userID,
		telemetryKeyPlaybookRunID: playbookRun.ID,
		"HasDescription":          playbookRun.Description != "",
		"CommanderUserID":         playbookRun.OwnerUserID,
		"ReporterUserID":          playbookRun.ReporterUserID,
		"TeamID":                  playbookRun.TeamID,
		"ChannelID":               playbookRun.ChannelID,
		"CreateAt":                playbookRun.CreateAt,
		"EndAt":                   playbookRun.EndAt,
		"DeleteAt":                playbookRun.DeleteAt, //nolint
		"PostID":                  playbookRun.PostID,
		"PlaybookID":              playbookRun.PlaybookID,
		"NumChecklists":           len(playbookRun.Checklists),
		"TotalChecklistItems":     totalChecklistItems,
		"NumStatusPosts":          len(playbookRun.StatusPosts),
		"CurrentStatus":           playbookRun.CurrentStatus,
		"PreviousReminder":        playbookRun.PreviousReminder,
		"NumTimelineEvents":       len(playbookRun.TimelineEvents),
	}
}

// CreatePlaybookRun tracks the creation of the playbook run passed.
func (t *RudderTelemetry) CreatePlaybookRun(playbookRun *app.PlaybookRun, userID string, public bool) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionCreate
	properties["Public"] = public
	t.track(eventPlaybookRun, properties)
}

// FinishPlaybookRun tracks the end of the playbook run passed.
func (t *RudderTelemetry) FinishPlaybookRun(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionEnd
	t.track(eventPlaybookRun, properties)
}

// RestartPlaybookRun tracks the restart of the playbook run.
func (t *RudderTelemetry) RestartPlaybookRun(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionRestart
	t.track(eventPlaybookRun, properties)
}

// ChangeOwner tracks changes in owner
func (t *RudderTelemetry) ChangeOwner(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionChangeOwner
	t.track(eventPlaybookRun, properties)
}

func (t *RudderTelemetry) UpdateStatus(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionUpdateStatus
	properties["ReminderTimerSeconds"] = int(playbookRun.PreviousReminder)
	t.track(eventPlaybookRun, properties)
}

func (t *RudderTelemetry) FrontendTelemetryForPlaybookRun(playbookRun *app.PlaybookRun, userID, action string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = action
	t.track(eventFrontend, properties)
}

// AddPostToTimeline tracks userID creating a timeline event from a post.
func (t *RudderTelemetry) AddPostToTimeline(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionAddTimelineEventFromPost
	t.track(eventPlaybookRun, properties)
}

// RemoveTimelineEvent tracks userID removing a timeline event.
func (t *RudderTelemetry) RemoveTimelineEvent(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionRemoveTimelineEvent
	t.track(eventPlaybookRun, properties)
}

func taskProperties(playbookRunID, userID string, task app.ChecklistItem) map[string]interface{} {
	return map[string]interface{}{
		telemetryKeyPlaybookRunID: playbookRunID,
		"UserActualID":            userID,
		"TaskID":                  task.ID,
		"State":                   task.State,
		"AssigneeID":              task.AssigneeID,
		"HasCommand":              task.Command != "",
		"CommandLastRun":          task.CommandLastRun,
		"HasDescription":          task.Description != "",
	}
}

// AddTask tracks the creation of a new checklist item by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) AddTask(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionAddTask
	t.track(eventTasks, properties)
}

// RemoveTask tracks the removal of a checklist item by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) RemoveTask(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionRemoveTask
	t.track(eventTasks, properties)
}

// RenameTask tracks the update of a checklist item by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) RenameTask(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionRenameTask
	t.track(eventTasks, properties)
}

// ModifyCheckedState tracks the checking and unchecking of items by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) ModifyCheckedState(playbookRunID, userID string, task app.ChecklistItem, wasOwner bool) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionModifyTaskState
	properties["NewState"] = task.State
	properties["WasCommander"] = wasOwner
	properties["WasAssignee"] = task.AssigneeID == userID
	t.track(eventTasks, properties)
}

// SetAssignee tracks the changing of an assignee on an item by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) SetAssignee(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionSetAssigneeForTask
	t.track(eventTasks, properties)
}

// MoveTask tracks the movement of checklist items by the user
// identified by userID in the given playbook run.
func (t *RudderTelemetry) MoveTask(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionMoveTask
	t.track(eventTasks, properties)
}

// RunTaskSlashCommand tracks the execution of a slash command on a checklist item.
func (t *RudderTelemetry) RunTaskSlashCommand(playbookRunID, userID string, task app.ChecklistItem) {
	properties := taskProperties(playbookRunID, userID, task)
	properties["Action"] = actionRunTaskSlashCommand
	t.track(eventTasks, properties)
}

func (t *RudderTelemetry) UpdateRetrospective(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionUpdateRetrospective
	t.track(eventTasks, properties)
}

func (t *RudderTelemetry) PublishRetrospective(playbookRun *app.PlaybookRun, userID string) {
	properties := playbookRunProperties(playbookRun, userID)
	properties["Action"] = actionPublishRetrospective
	t.track(eventTasks, properties)
}

func playbookProperties(playbook app.Playbook, userID string) map[string]interface{} {
	totalChecklistItems := 0
	totalChecklistItemsWithCommands := 0
	for _, checklist := range playbook.Checklists {
		totalChecklistItems += len(checklist.Items)
		for _, item := range checklist.Items {
			if item.Command != "" {
				totalChecklistItemsWithCommands++
			}
		}
	}

	return map[string]interface{}{
		"UserActualID":                userID,
		"PlaybookID":                  playbook.ID,
		"HasDescription":              playbook.Description != "",
		"TeamID":                      playbook.TeamID,
		"IsPublic":                    playbook.CreatePublicPlaybookRun,
		"CreateAt":                    playbook.CreateAt,
		"DeleteAt":                    playbook.DeleteAt,
		"NumChecklists":               len(playbook.Checklists),
		"TotalChecklistItems":         totalChecklistItems,
		"NumSlashCommands":            totalChecklistItemsWithCommands,
		"NumMembers":                  len(playbook.MemberIDs),
		"UsesReminderMessageTemplate": playbook.ReminderMessageTemplate != "",
		"ReminderTimerDefaultSeconds": playbook.ReminderTimerDefaultSeconds,
		"NumInvitedUserIDs":           len(playbook.InvitedUserIDs),
		"NumInvitedGroupIDs":          len(playbook.InvitedGroupIDs),
		"InviteUsersEnabled":          playbook.InviteUsersEnabled,
		"DefaultCommanderID":          playbook.DefaultOwnerID,
		"DefaultCommanderEnabled":     playbook.DefaultOwnerEnabled,
		"BroadcastChannelIDs":         playbook.BroadcastChannelIDs,
		"BroadcastEnabled":            playbook.BroadcastEnabled,
		"NumWebhookOnCreationURLs":    len(playbook.WebhookOnCreationURLs),
		"WebhookOnCreationEnabled":    playbook.WebhookOnCreationEnabled,
		"SignalAnyKeywordsEnabled":    playbook.SignalAnyKeywordsEnabled,
		"NumSignalAnyKeywords":        len(playbook.SignalAnyKeywords),
	}
}

func playbookTemplateProperties(templateName string, userID string) map[string]interface{} {
	return map[string]interface{}{
		"UserActualID": userID,
		"TemplateName": templateName,
	}
}

// CreatePlaybook tracks the creation of a playbook.
func (t *RudderTelemetry) CreatePlaybook(playbook app.Playbook, userID string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = actionCreate
	t.track(eventPlaybook, properties)
}

// UpdatePlaybook tracks the update of a playbook.
func (t *RudderTelemetry) UpdatePlaybook(playbook app.Playbook, userID string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = actionUpdate
	t.track(eventPlaybook, properties)
}

// DeletePlaybook tracks the deletion of a playbook.
func (t *RudderTelemetry) DeletePlaybook(playbook app.Playbook, userID string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = actionDelete
	t.track(eventPlaybook, properties)
}

// FrontendTelemetryForPlaybook tracks an event originating from the frontend
func (t *RudderTelemetry) FrontendTelemetryForPlaybook(playbook app.Playbook, userID, action string) {
	properties := playbookProperties(playbook, userID)
	properties["Action"] = action
	t.track(eventFrontend, properties)
}

// FrontendTelemetryForPlaybookTemplate tracks a playbook template event originating from the frontend
func (t *RudderTelemetry) FrontendTelemetryForPlaybookTemplate(templateName string, userID, action string) {
	properties := playbookTemplateProperties(templateName, userID)
	properties["Action"] = action
	t.track(eventFrontend, properties)
}

func commonProperties(userID string) map[string]interface{} {
	return map[string]interface{}{
		"UserActualID": userID,
	}
}

func (t *RudderTelemetry) StartTrial(userID string, action string) {
	properties := commonProperties(userID)
	properties["Action"] = action
	t.track(eventStartTrial, properties)
}

func (t *RudderTelemetry) NotifyAdmins(userID string, action string) {
	properties := commonProperties(userID)
	properties["Action"] = action
	t.track(eventNotifyAdmins, properties)
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
