package telemetry

import (
	"strings"
	"sync"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"

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
	eventIncident                  = "incident"
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

	eventNotifyAdmins                            = "notify_admins"
	actionNotifyAdminsToViewTimeline             = "notify_admins_to_view_timeline"
	actionNotifyAdminsToAddMessageToTimeline     = "notify_admins_to_add_message_to_timeline"
	actionNotifyAdminsToCreatePlaybook           = "notify_admins_to_create_playbook"
	actionNotifyAdminsToRestrictPlaybookCreation = "notify_admins_to_restrict_playbook_creation"
	actionNotifyAdminsToRestrictPlaybookAccess   = "notify_admins_to_restrict_playbook_access"

	eventStartTrial                            = "start_trial"
	actionStartTrialToViewTimeline             = "start_trial_to_view_timeline"
	actionStartTrialToAddMessageToTimeline     = "start_trial_to_add_message_to_timeline"
	actionStartTrialToCreatePlaybook           = "start_trial_to_create_playbook"
	actionStartTrialToRestrictPlaybookCreation = "start_trial_to_restrict_playbook_creation"
	actionStartTrialToRestrictPlaybookAccess   = "start_trial_to_restrict_playbook_access"
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

func incidentProperties(incident *app.Incident, userID string) map[string]interface{} {
	totalChecklistItems := 0
	for _, checklist := range incident.Checklists {
		totalChecklistItems += len(checklist.Items)
	}

	return map[string]interface{}{
		"UserActualID":        userID,
		"IncidentID":          incident.ID,
		"HasDescription":      incident.Description != "",
		"CommanderUserID":     incident.OwnerUserID,
		"ReporterUserID":      incident.ReporterUserID,
		"TeamID":              incident.TeamID,
		"ChannelID":           incident.ChannelID,
		"CreateAt":            incident.CreateAt,
		"EndAt":               incident.EndAt,
		"DeleteAt":            incident.DeleteAt,
		"PostID":              incident.PostID,
		"PlaybookID":          incident.PlaybookID,
		"NumChecklists":       len(incident.Checklists),
		"TotalChecklistItems": totalChecklistItems,
		"NumStatusPosts":      len(incident.StatusPosts),
		"CurrentStatus":       incident.CurrentStatus,
		"PreviousReminder":    incident.PreviousReminder,
		"NumTimelineEvents":   len(incident.TimelineEvents),
	}
}

// CreateIncident tracks the creation of the incident passed.
func (t *RudderTelemetry) CreateIncident(incident *app.Incident, userID string, public bool) {
	properties := incidentProperties(incident, userID)
	properties["Action"] = actionCreate
	properties["Public"] = public
	t.track(eventIncident, properties)
}

// EndIncident tracks the end of the incident passed.
func (t *RudderTelemetry) EndIncident(incident *app.Incident, userID string) {
	properties := incidentProperties(incident, userID)
	properties["Action"] = actionEnd
	t.track(eventIncident, properties)
}

// RestartIncident tracks the restart of the incident.
func (t *RudderTelemetry) RestartIncident(incident *app.Incident, userID string) {
	properties := incidentProperties(incident, userID)
	properties["Action"] = actionRestart
	t.track(eventIncident, properties)
}

// ChangeOwner tracks changes in owner
func (t *RudderTelemetry) ChangeOwner(incident *app.Incident, userID string) {
	properties := incidentProperties(incident, userID)
	properties["Action"] = actionChangeOwner
	t.track(eventIncident, properties)
}

func (t *RudderTelemetry) UpdateStatus(incident *app.Incident, userID string) {
	properties := incidentProperties(incident, userID)
	properties["Action"] = actionUpdateStatus
	properties["ReminderTimerSeconds"] = int(incident.PreviousReminder)
	t.track(eventIncident, properties)
}

func (t *RudderTelemetry) FrontendTelemetryForIncident(incident *app.Incident, userID, action string) {
	properties := incidentProperties(incident, userID)
	properties["Action"] = action
	t.track(eventFrontend, properties)
}

// AddPostToTimeline tracks userID creating a timeline event from a post.
func (t *RudderTelemetry) AddPostToTimeline(incident *app.Incident, userID string) {
	properties := incidentProperties(incident, userID)
	properties["Action"] = actionAddTimelineEventFromPost
	t.track(eventIncident, properties)
}

// RemoveTimelineEvent tracks userID removing a timeline event.
func (t *RudderTelemetry) RemoveTimelineEvent(incident *app.Incident, userID string) {
	properties := incidentProperties(incident, userID)
	properties["Action"] = actionRemoveTimelineEvent
	t.track(eventIncident, properties)
}

func taskProperties(incidentID, userID string, task app.ChecklistItem) map[string]interface{} {
	return map[string]interface{}{
		"IncidentID":     incidentID,
		"UserActualID":   userID,
		"TaskID":         task.ID,
		"State":          task.State,
		"AssigneeID":     task.AssigneeID,
		"HasCommand":     task.Command != "",
		"CommandLastRun": task.CommandLastRun,
		"HasDescription": task.Description != "",
	}
}

// AddTask tracks the creation of a new checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) AddTask(incidentID, userID string, task app.ChecklistItem) {
	properties := taskProperties(incidentID, userID, task)
	properties["Action"] = actionAddTask
	t.track(eventTasks, properties)
}

// RemoveTask tracks the removal of a checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) RemoveTask(incidentID, userID string, task app.ChecklistItem) {
	properties := taskProperties(incidentID, userID, task)
	properties["Action"] = actionRemoveTask
	t.track(eventTasks, properties)
}

// RenameTask tracks the update of a checklist item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) RenameTask(incidentID, userID string, task app.ChecklistItem) {
	properties := taskProperties(incidentID, userID, task)
	properties["Action"] = actionRenameTask
	t.track(eventTasks, properties)
}

// ModifyCheckedState tracks the checking and unchecking of items by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) ModifyCheckedState(incidentID, userID string, task app.ChecklistItem, wasOwner bool) {
	properties := taskProperties(incidentID, userID, task)
	properties["Action"] = actionModifyTaskState
	properties["NewState"] = task.State
	properties["WasCommander"] = wasOwner
	properties["WasAssignee"] = task.AssigneeID == userID
	t.track(eventTasks, properties)
}

// SetAssignee tracks the changing of an assignee on an item by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) SetAssignee(incidentID, userID string, task app.ChecklistItem) {
	properties := taskProperties(incidentID, userID, task)
	properties["Action"] = actionSetAssigneeForTask
	t.track(eventTasks, properties)
}

// MoveTask tracks the movement of checklist items by the user
// identified by userID in the incident identified by incidentID.
func (t *RudderTelemetry) MoveTask(incidentID, userID string, task app.ChecklistItem) {
	properties := taskProperties(incidentID, userID, task)
	properties["Action"] = actionMoveTask
	t.track(eventTasks, properties)
}

// RunTaskSlashCommand tracks the execution of a slash command on a checklist item.
func (t *RudderTelemetry) RunTaskSlashCommand(incidentID, userID string, task app.ChecklistItem) {
	properties := taskProperties(incidentID, userID, task)
	properties["Action"] = actionRunTaskSlashCommand
	t.track(eventTasks, properties)
}

func (t *RudderTelemetry) UpdateRetrospective(incident *app.Incident, userID string) {
	properties := incidentProperties(incident, userID)
	properties["Action"] = actionUpdateRetrospective
	t.track(eventTasks, properties)
}

func (t *RudderTelemetry) PublishRetrospective(incident *app.Incident, userID string) {
	properties := incidentProperties(incident, userID)
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
		"IsPublic":                    playbook.CreatePublicIncident,
		"CreateAt":                    playbook.CreateAt,
		"DeleteAt":                    playbook.DeleteAt,
		"NumChecklists":               len(playbook.Checklists),
		"TotalChecklistItems":         totalChecklistItems,
		"NumSlashCommands":            totalChecklistItemsWithCommands,
		"NumMembers":                  len(playbook.MemberIDs),
		"BroadcastChannelID":          playbook.BroadcastChannelID,
		"UsesReminderMessageTemplate": playbook.ReminderMessageTemplate != "",
		"ReminderTimerDefaultSeconds": playbook.ReminderTimerDefaultSeconds,
		"NumInvitedUserIDs":           len(playbook.InvitedUserIDs),
		"NumInvitedGroupIDs":          len(playbook.InvitedGroupIDs),
		"InviteUsersEnabled":          playbook.InviteUsersEnabled,
		"DefaultCommanderID":          playbook.DefaultOwnerID,
		"DefaultCommanderEnabled":     playbook.DefaultOwnerEnabled,
		"AnnouncementChannelID":       playbook.AnnouncementChannelID,
		"AnnouncementChannelEnabled":  playbook.AnnouncementChannelEnabled,
		"NumWebhookOnCreationURLs":    len(strings.Split(playbook.WebhookOnCreationURL, "\n")),
		"WebhookOnCreationEnabled":    playbook.WebhookOnCreationEnabled,
		"SignalAnyKeywordsEnabled":    playbook.SignalAnyKeywordsEnabled,
		"NumSignalAnyKeywords":        len(playbook.SignalAnyKeywords),
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

func commonProperties(userID string) map[string]interface{} {
	return map[string]interface{}{
		"UserActualID": userID,
	}
}

func (t *RudderTelemetry) StartTrialToViewTimeline(userID string) {
	properties := commonProperties(userID)
	properties["Action"] = actionStartTrialToViewTimeline
	t.track(eventStartTrial, properties)
}

func (t *RudderTelemetry) StartTrialToAddMessageToTimeline(userID string) {
	properties := commonProperties(userID)
	properties["Action"] = actionStartTrialToAddMessageToTimeline
	t.track(eventStartTrial, properties)
}

func (t *RudderTelemetry) StartTrialToCreatePlaybook(userID string) {
	properties := commonProperties(userID)
	properties["Action"] = actionStartTrialToCreatePlaybook
	t.track(eventStartTrial, properties)
}

func (t *RudderTelemetry) StartTrialToRestrictPlaybookCreation(userID string) {
	properties := commonProperties(userID)
	properties["Action"] = actionStartTrialToRestrictPlaybookCreation
	t.track(eventStartTrial, properties)
}

func (t *RudderTelemetry) StartTrialToRestrictPlaybookAccess(userID string) {
	properties := commonProperties(userID)
	properties["Action"] = actionStartTrialToRestrictPlaybookAccess
	t.track(eventStartTrial, properties)
}

func (t *RudderTelemetry) NotifyAdminsToViewTimeline(userID string) {
	properties := commonProperties(userID)
	properties["Action"] = actionNotifyAdminsToViewTimeline
	t.track(eventNotifyAdmins, properties)

}

func (t *RudderTelemetry) NotifyAdminsToAddMessageToTimeline(userID string) {
	properties := commonProperties(userID)
	properties["Action"] = actionNotifyAdminsToAddMessageToTimeline
	t.track(eventNotifyAdmins, properties)

}

func (t *RudderTelemetry) NotifyAdminsToCreatePlaybook(userID string) {
	properties := commonProperties(userID)
	properties["Action"] = actionNotifyAdminsToCreatePlaybook
	t.track(eventNotifyAdmins, properties)

}

func (t *RudderTelemetry) NotifyAdminsToRestrictPlaybookCreation(userID string) {
	properties := commonProperties(userID)
	properties["Action"] = actionNotifyAdminsToRestrictPlaybookCreation
	t.track(eventNotifyAdmins, properties)

}

func (t *RudderTelemetry) NotifyAdminsToRestrictPlaybookAccess(userID string) {
	properties := commonProperties(userID)
	properties["Action"] = actionNotifyAdminsToRestrictPlaybookAccess
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
