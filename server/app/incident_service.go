package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/pkg/errors"
	stripmd "github.com/writeas/go-strip-markdown"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/timeutils"
	"github.com/mattermost/mattermost-server/v5/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

const (
	// IncidentCreatedWSEvent is for incident creation.
	IncidentCreatedWSEvent = "incident_created"
	incidentUpdatedWSEvent = "incident_updated"
	noAssigneeName         = "No Assignee"
)

// IncidentServiceImpl holds the information needed by the IncidentService's methods to complete their functions.
type IncidentServiceImpl struct {
	pluginAPI     *pluginapi.Client
	httpClient    *http.Client
	configService config.Service
	store         IncidentStore
	poster        bot.Poster
	logger        bot.Logger
	scheduler     JobOnceScheduler
	telemetry     IncidentTelemetry
}

var allNonSpaceNonWordRegex = regexp.MustCompile(`[^\w\s]`)

// DialogFieldPlaybookIDKey is the key for the playbook ID field used in OpenCreateIncidentDialog.
const DialogFieldPlaybookIDKey = "playbookID"

// DialogFieldNameKey is the key for the incident name field used in OpenCreateIncidentDialog.
const DialogFieldNameKey = "incidentName"

// DialogFieldDescriptionKey is the key for the description textarea field used in UpdateIncidentDialog
const DialogFieldDescriptionKey = "description"

// DialogFieldMessageKey is the key for the message textarea field used in UpdateIncidentDialog
const DialogFieldMessageKey = "message"

// DialogFieldReminderInSecondsKey is the key for the reminder select field used in UpdateIncidentDialog
const DialogFieldReminderInSecondsKey = "reminder"

// DialogFieldStatusKey is the key for the status select field used in UpdateIncidentDialog
const DialogFieldStatusKey = "status"

// DialogFieldIncidentKey is the key for the incident chosen in AddToTimelineDialog
const DialogFieldIncidentKey = "incident"

// DialogFieldSummary is the key for the summary in AddToTimelineDialog
const DialogFieldSummary = "summary"

// DialogFieldItemName is the key for the name in AddChecklistItemDialog
const DialogFieldItemNameKey = "name"

// DialogFieldDescriptionKey is the key for the description in AddChecklistItemDialog
const DialogFieldItemDescriptionKey = "description"

// DialogFieldCommandKey is the key for the command in AddChecklistItemDialog
const DialogFieldItemCommandKey = "command"

// NewIncidentService creates a new incident IncidentServiceImpl.
func NewIncidentService(pluginAPI *pluginapi.Client, store IncidentStore, poster bot.Poster, logger bot.Logger,
	configService config.Service, scheduler JobOnceScheduler, telemetry IncidentTelemetry) *IncidentServiceImpl {
	return &IncidentServiceImpl{
		pluginAPI:     pluginAPI,
		store:         store,
		poster:        poster,
		logger:        logger,
		configService: configService,
		scheduler:     scheduler,
		telemetry:     telemetry,
		httpClient:    &http.Client{Timeout: 30 * time.Second},
	}
}

// GetIncidents returns filtered incidents and the total count before paging.
func (s *IncidentServiceImpl) GetIncidents(requesterInfo RequesterInfo, options IncidentFilterOptions) (*GetIncidentsResults, error) {
	return s.store.GetIncidents(requesterInfo, options)
}

func (s *IncidentServiceImpl) broadcastIncidentCreation(incident *Incident, owner *model.User) error {
	incidentChannel, err := s.pluginAPI.Channel.Get(incident.ChannelID)
	if err != nil {
		return err
	}

	if err := IsChannelActiveInTeam(incident.AnnouncementChannelID, incident.TeamID, s.pluginAPI); err != nil {
		return err
	}

	announcementMsg := fmt.Sprintf("#### New Incident: ~%s\n", incidentChannel.Name)
	announcementMsg += fmt.Sprintf("**Owner**: @%s\n", owner.Username)

	if _, err := s.poster.PostMessage(incident.AnnouncementChannelID, announcementMsg); err != nil {
		return err
	}

	return nil
}

// sendWebhookOnCreation sends a POST request to the creation webhook URL.
// It blocks until a response is received.
func (s *IncidentServiceImpl) sendWebhookOnCreation(incident Incident) error {
	siteURL := s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	if siteURL == nil {
		s.pluginAPI.Log.Warn("cannot send webhook on creation, please set siteURL")
		return errors.New("Could not send webhook, please set siteURL")
	}

	team, err := s.pluginAPI.Team.Get(incident.TeamID)
	if err != nil {
		return err
	}

	channel, err := s.pluginAPI.Channel.Get(incident.ChannelID)
	if err != nil {
		return err
	}

	channelURL := getChannelURL(*siteURL, team.Name, channel.Name)

	detailsURL := getDetailsURL(*siteURL, team.Name, s.configService.GetManifest().Id, incident.ID)

	payload := struct {
		Incident
		ChannelURL string `json:"channel_url"`
		DetailsURL string `json:"details_url"`
	}{
		Incident:   incident,
		ChannelURL: channelURL,
		DetailsURL: detailsURL,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", incident.WebhookOnCreationURL, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return errors.Errorf("response code is %d; expected a status code in the 2xx range", resp.StatusCode)
	}

	return nil
}

// CreateIncident creates a new incident. userID is the user who initiated the CreateIncident.
func (s *IncidentServiceImpl) CreateIncident(incident *Incident, pb *Playbook, userID string, public bool) (*Incident, error) {
	if incident.DefaultOwnerID != "" {
		// Check if the user is a member of the incident's team
		if !IsMemberOfTeamID(incident.DefaultOwnerID, incident.TeamID, s.pluginAPI) {
			s.pluginAPI.Log.Warn("default owner specified, but it is not a member of the incident's team", "userID", incident.DefaultOwnerID, "teamID", incident.TeamID)
		} else {
			incident.OwnerUserID = incident.DefaultOwnerID
		}
	}

	incident.ReporterUserID = userID
	incident.ID = model.NewId()

	team, err := s.pluginAPI.Team.Get(incident.TeamID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to fetch team")
	}

	siteURL := model.SERVICE_SETTINGS_DEFAULT_SITE_URL
	if s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL != nil {
		siteURL = *s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	}
	overviewURL := ""
	playbookURL := ""

	header := "This is an incident channel. To view more information, select the shield icon then select *Tasks* or *Overview*."
	if siteURL != "" && pb != nil {
		overviewURL = fmt.Sprintf("%s/%s/%s/incidents/%s", siteURL, team.Name, s.configService.GetManifest().Id, incident.ID)
		playbookURL = fmt.Sprintf("%s/%s/%s/playbooks/%s", siteURL, team.Name, s.configService.GetManifest().Id, pb.ID)
		header = fmt.Sprintf("This channel was created as part of the [%s](%s) playbook. Visit [the overview page](%s) for more information.",
			pb.Title, playbookURL, overviewURL)
	}

	// Try to create the channel first
	channel, err := s.createIncidentChannel(incident, header, public)
	if err != nil {
		return nil, err
	}

	now := model.GetMillis()
	incident.ChannelID = channel.Id
	incident.CreateAt = now
	incident.LastStatusUpdateAt = now
	incident.CurrentStatus = StatusReported
	if pb != nil {
		incident.ExportChannelOnArchiveEnabled = pb.ExportChannelOnArchiveEnabled
	}

	// Start with a blank playbook with one empty checklist if one isn't provided
	if incident.PlaybookID == "" {
		incident.Checklists = []Checklist{
			{
				Title: "Checklist",
				Items: []ChecklistItem{},
			},
		}
	}

	incident, err = s.store.CreateIncident(incident)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to create incident")
	}

	s.telemetry.CreateIncident(incident, userID, public)

	invitedUserIDs := incident.InvitedUserIDs

	for _, groupID := range incident.InvitedGroupIDs {
		var group *model.Group
		group, err = s.pluginAPI.Group.Get(groupID)
		if err != nil {
			s.pluginAPI.Log.Warn("failed to query group", "group_id", groupID)
			continue
		}

		if !group.AllowReference {
			s.pluginAPI.Log.Warn("group that does not allow references", "group_id", groupID)
			continue
		}

		perPage := 1000
		for page := 0; ; page++ {
			var users []*model.User
			users, err = s.pluginAPI.Group.GetMemberUsers(groupID, page, perPage)
			if err != nil {
				s.pluginAPI.Log.Warn("failed to query group", "group_id", groupID, "err", err)
				break
			}
			for _, user := range users {
				invitedUserIDs = append(invitedUserIDs, user.Id)
			}

			if len(users) < perPage {
				break
			}
		}
	}

	usersFailedToInvite := []string{}
	for _, userID := range invitedUserIDs {
		// Check if the user is a member of the incident's team
		_, err = s.pluginAPI.Team.GetMember(incident.TeamID, userID)
		if err != nil {
			usersFailedToInvite = append(usersFailedToInvite, userID)
			continue
		}

		_, err = s.pluginAPI.Channel.AddUser(incident.ChannelID, userID, s.configService.GetConfiguration().BotUserID)
		if err != nil {
			usersFailedToInvite = append(usersFailedToInvite, userID)
			continue
		}
	}

	if len(usersFailedToInvite) != 0 {
		usernames := make([]string, 0, len(usersFailedToInvite))
		numDeletedUsers := 0
		for _, userID := range usersFailedToInvite {
			user, userErr := s.pluginAPI.User.Get(userID)
			if userErr != nil {
				// User does not exist anymore
				numDeletedUsers++
				continue
			}

			usernames = append(usernames, "@"+user.Username)
		}

		deletedUsersMsg := ""
		if numDeletedUsers > 0 {
			deletedUsersMsg = fmt.Sprintf(" %d users from the original list have been deleted since the creation of the playbook.", numDeletedUsers)
		}

		if _, err = s.poster.PostMessage(channel.Id, "Failed to invite the following users: %s. %s", strings.Join(usernames, ", "), deletedUsersMsg); err != nil {
			return nil, errors.Wrapf(err, "failed to post to incident channel")
		}
	}

	reporter, err := s.pluginAPI.User.Get(incident.ReporterUserID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to resolve user %s", incident.ReporterUserID)
	}

	owner, err := s.pluginAPI.User.Get(incident.OwnerUserID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to resolve user %s", incident.OwnerUserID)
	}

	startMessage := fmt.Sprintf("This incident has been started and is commanded by @%s.", reporter.Username)
	if incident.OwnerUserID != incident.ReporterUserID {
		startMessage = fmt.Sprintf("This incident has been started by @%s and is commanded by @%s.", reporter.Username, owner.Username)
	}

	newPost, err := s.poster.PostMessage(channel.Id, startMessage)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to post to incident channel")
	}

	if incident.AnnouncementChannelID != "" {
		if err2 := s.broadcastIncidentCreation(incident, owner); err2 != nil {
			s.pluginAPI.Log.Warn("failed to broadcast the incident creation to channel", "ChannelID", incident.AnnouncementChannelID)

			if _, err = s.poster.PostMessage(channel.Id, "Failed to announce the creation of this incident in the configured channel."); err != nil {
				return nil, errors.Wrapf(err, "failed to post to incident channel")
			}
		}
	}

	event := &TimelineEvent{
		IncidentID:    incident.ID,
		CreateAt:      incident.CreateAt,
		EventAt:       incident.CreateAt,
		EventType:     IncidentCreated,
		PostID:        newPost.Id,
		SubjectUserID: incident.ReporterUserID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return incident, errors.Wrap(err, "failed to create timeline event")
	}
	incident.TimelineEvents = append(incident.TimelineEvents, *event)

	if incident.WebhookOnCreationURL != "" {
		go func() {
			if err = s.sendWebhookOnCreation(*incident); err != nil {
				s.pluginAPI.Log.Warn("failed to send a POST request to the creation webhook URL", "webhook URL", incident.WebhookOnCreationURL, "error", err)
				_, _ = s.poster.PostMessage(channel.Id, "Incident creation announcement through the outgoing webhook failed. Contact your System Admin for more information.")
			}
		}()
	}

	if incident.PostID == "" {
		return incident, nil
	}

	// Post the content and link of the original post
	post, err := s.pluginAPI.Post.GetPost(incident.PostID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get incident original post")
	}

	postURL := fmt.Sprintf("%s/_redirect/pl/%s", siteURL, incident.PostID)
	postMessage := fmt.Sprintf("[Original Post](%s)\n > %s", postURL, post.Message)

	_, err = s.poster.PostMessage(channel.Id, postMessage)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to post to incident channel")
	}

	return incident, nil
}

// OpenCreateIncidentDialog opens a interactive dialog to start a new incident.
func (s *IncidentServiceImpl) OpenCreateIncidentDialog(teamID, ownerID, triggerID, postID, clientID string, playbooks []Playbook, isMobileApp bool) error {
	dialog, err := s.newIncidentDialog(teamID, ownerID, postID, clientID, playbooks, isMobileApp)
	if err != nil {
		return errors.Wrapf(err, "failed to create new incident dialog")
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/incidents/dialog",
			s.configService.GetManifest().Id),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrapf(err, "failed to open new incident dialog")
	}

	return nil
}

func (s *IncidentServiceImpl) OpenUpdateStatusDialog(incidentID string, triggerID string) error {
	currentIncident, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident")
	}

	message := ""
	newestPostID := findNewestNonDeletedPostID(currentIncident.StatusPosts)
	if newestPostID != "" {
		var post *model.Post
		post, err = s.pluginAPI.Post.GetPost(newestPostID)
		if err != nil {
			return errors.Wrap(err, "failed to find newest post")
		}
		message = post.Message
	} else {
		message = currentIncident.ReminderMessageTemplate
	}

	dialog, err := s.newUpdateIncidentDialog(currentIncident.Description, message, currentIncident.BroadcastChannelID, currentIncident.CurrentStatus, currentIncident.PreviousReminder)
	if err != nil {
		return errors.Wrap(err, "failed to create update status dialog")
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/incidents/%s/update-status-dialog",
			s.configService.GetManifest().Id,
			incidentID),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrap(err, "failed to open update status dialog")
	}

	return nil
}

func (s *IncidentServiceImpl) OpenAddToTimelineDialog(requesterInfo RequesterInfo, postID, teamID, triggerID string) error {
	options := IncidentFilterOptions{
		TeamID:    teamID,
		MemberID:  requesterInfo.UserID,
		Sort:      SortByCreateAt,
		Direction: DirectionDesc,
		Statuses:  []string{StatusReported, StatusActive, StatusResolved},
		Page:      0,
		PerPage:   PerPageDefault,
	}

	result, err := s.GetIncidents(requesterInfo, options)
	if err != nil {
		return errors.Wrap(err, "Error retrieving the incidents: %v")
	}

	dialog, err := s.newAddToTimelineDialog(result.Items, postID)
	if err != nil {
		return errors.Wrap(err, "failed to create add to timeline dialog")
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/incidents/add-to-timeline-dialog",
			s.configService.GetManifest().Id),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrap(err, "failed to open update status dialog")
	}

	return nil
}

func (s *IncidentServiceImpl) OpenAddChecklistItemDialog(triggerID, incidentID string, checklist int) error {
	dialog := &model.Dialog{
		Title: "Add New Task",
		Elements: []model.DialogElement{
			{
				DisplayName: "Name",
				Name:        DialogFieldItemNameKey,
				Type:        "text",
				Default:     "",
			},
			{
				DisplayName: "Description",
				Name:        DialogFieldItemDescriptionKey,
				Type:        "text",
				Default:     "",
				Optional:    true,
			},
		},
		SubmitLabel:    "Add Task",
		NotifyOnCancel: false,
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/incidents/%s/checklists/%v/add-dialog",
			s.configService.GetManifest().Id, incidentID, checklist),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrap(err, "failed to open update status dialog")
	}

	return nil
}

func (s *IncidentServiceImpl) AddPostToTimeline(incidentID, userID, postID, summary string) error {
	post, err := s.pluginAPI.Post.GetPost(postID)
	if err != nil {
		return errors.Wrap(err, "failed to find post")
	}

	event := &TimelineEvent{
		IncidentID:    incidentID,
		CreateAt:      model.GetMillis(),
		DeleteAt:      0,
		EventAt:       post.CreateAt,
		EventType:     EventFromPost,
		Summary:       summary,
		Details:       "",
		PostID:        postID,
		SubjectUserID: post.UserId,
		CreatorUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	incidentModified, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident")
	}

	s.telemetry.AddPostToTimeline(incidentModified, userID)

	if err = s.sendIncidentToClient(incidentID); err != nil {
		return err
	}

	return nil
}

// RemoveTimelineEvent removes the timeline event (sets the DeleteAt to the current time).
func (s *IncidentServiceImpl) RemoveTimelineEvent(incidentID, userID, eventID string) error {
	event, err := s.store.GetTimelineEvent(incidentID, eventID)
	if err != nil {
		return err
	}

	event.DeleteAt = model.GetMillis()
	if err = s.store.UpdateTimelineEvent(event); err != nil {
		return err
	}

	incidentModified, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident")
	}

	s.telemetry.RemoveTimelineEvent(incidentModified, userID)

	if err = s.sendIncidentToClient(incidentID); err != nil {
		return err
	}

	return nil
}

func (s *IncidentServiceImpl) broadcastStatusUpdate(statusUpdate string, incident *Incident, authorID, originalPostID string) error {
	incidentChannel, err := s.pluginAPI.Channel.Get(incident.ChannelID)
	if err != nil {
		return err
	}

	incidentTeam, err := s.pluginAPI.Team.Get(incident.TeamID)
	if err != nil {
		return err
	}

	author, err := s.pluginAPI.User.Get(authorID)
	if err != nil {
		return err
	}

	duration := timeutils.DurationString(timeutils.GetTimeForMillis(incident.CreateAt), time.Now())

	broadcastedMsg := fmt.Sprintf("# Incident Update: [%s](/%s/pl/%s)\n", incidentChannel.DisplayName, incidentTeam.Name, originalPostID)
	broadcastedMsg += fmt.Sprintf("By @%s | Duration: %s | Status: %s\n", author.Username, duration, incident.CurrentStatus)
	broadcastedMsg += "***\n"
	broadcastedMsg += statusUpdate

	if _, err := s.poster.PostMessage(incident.BroadcastChannelID, broadcastedMsg); err != nil {
		return err
	}

	return nil
}

// sendWebhookOnUpdateStatus sends a POST request to the status update webhook URL.
// It blocks until a response is received.
func (s *IncidentServiceImpl) sendWebhookOnUpdateStatus(incident Incident) error {
	siteURL := s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	if siteURL == nil {
		s.pluginAPI.Log.Warn("cannot send webhook on update, please set siteURL")
		return errors.New("siteURL not set")
	}

	team, err := s.pluginAPI.Team.Get(incident.TeamID)
	if err != nil {
		return err
	}

	channel, err := s.pluginAPI.Channel.Get(incident.ChannelID)
	if err != nil {
		return err
	}

	channelURL := getChannelURL(*siteURL, team.Name, channel.Name)

	detailsURL := getDetailsURL(*siteURL, team.Name, s.configService.GetManifest().Id, incident.ID)

	payload := struct {
		Incident
		ChannelURL string `json:"channel_url"`
		DetailsURL string `json:"details_url"`
	}{
		Incident:   incident,
		ChannelURL: channelURL,
		DetailsURL: detailsURL,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", incident.WebhookOnStatusUpdateURL, bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return errors.Errorf("response code is %d; expected a status code in the 2xx range", resp.StatusCode)
	}

	return nil
}

// UpdateStatus updates an incident's status.
func (s *IncidentServiceImpl) UpdateStatus(incidentID, userID string, options StatusUpdateOptions) error {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident")
	}

	previousStatus := incidentToModify.CurrentStatus
	incidentToModify.CurrentStatus = options.Status

	post := model.Post{
		Message:   options.Message,
		UserId:    userID,
		ChannelId: incidentToModify.ChannelID,
	}
	if err = s.pluginAPI.Post.CreatePost(&post); err != nil {
		return errors.Wrap(err, "failed to post update status message")
	}

	// Add the status manually for the broadcasts
	incidentToModify.StatusPosts = append(incidentToModify.StatusPosts,
		StatusPost{
			ID:       post.Id,
			Status:   options.Status,
			CreateAt: post.CreateAt,
			DeleteAt: post.DeleteAt,
		})

	incidentToModify.PreviousReminder = options.Reminder
	incidentToModify.Description = options.Description
	incidentToModify.LastStatusUpdateAt = post.CreateAt

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrap(err, "failed to update incident")
	}

	if err = s.store.UpdateStatus(&SQLStatusPost{
		IncidentID: incidentToModify.ID,
		PostID:     post.Id,
		Status:     options.Status,
		EndAt:      incidentToModify.ResolvedAt(),
	}); err != nil {
		return errors.Wrap(err, "failed to write status post to store. There is now inconsistent state.")
	}

	if err2 := s.broadcastStatusUpdate(options.Message, incidentToModify, userID, post.Id); err2 != nil {
		s.pluginAPI.Log.Warn("failed to broadcast the status update to channel", "ChannelID", incidentToModify.BroadcastChannelID)
	}

	// If we are resolving the incident, send the reminder to fill out the retrospective
	// Also start the recurring reminder if enabled.
	if incidentToModify.RetrospectivePublishedAt == 0 &&
		options.Status == StatusResolved &&
		previousStatus != StatusArchived &&
		previousStatus != StatusResolved &&
		s.configService.GetConfiguration().EnableExperimentalFeatures {
		if err = s.postRetrospectiveReminder(incidentToModify, true); err != nil {
			return errors.Wrap(err, "couldn't post retrospective reminder")
		}
		s.scheduler.Cancel(RetrospectivePrefix + incidentID)
		if incidentToModify.RetrospectiveReminderIntervalSeconds != 0 {
			if err = s.SetReminder(RetrospectivePrefix+incidentID, time.Duration(incidentToModify.RetrospectiveReminderIntervalSeconds)*time.Second); err != nil {
				return errors.Wrap(err, "failed to set the retrospective reminder for incident")
			}
		}
	}

	// Remove pending reminder (if any), even if current reminder was set to "none" (0 minutes)
	s.RemoveReminder(incidentID)

	if options.Reminder != 0 && options.Status != StatusArchived {
		if err = s.SetReminder(incidentID, options.Reminder); err != nil {
			return errors.Wrap(err, "failed to set the reminder for incident")
		}
	}

	if err = s.removeReminderPost(incidentToModify); err != nil {
		return errors.Wrap(err, "failed to remove reminder post")
	}

	summary := ""
	if previousStatus != options.Status {
		summary = fmt.Sprintf("%s to %s", previousStatus, options.Status)
	}
	event := &TimelineEvent{
		IncidentID:    incidentID,
		CreateAt:      post.CreateAt,
		EventAt:       post.CreateAt,
		EventType:     StatusUpdated,
		Summary:       summary,
		PostID:        post.Id,
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	s.telemetry.UpdateStatus(incidentToModify, userID)

	if err = s.sendIncidentToClient(incidentID); err != nil {
		return err
	}

	if incidentToModify.WebhookOnStatusUpdateURL != "" {
		go func() {
			if err := s.sendWebhookOnUpdateStatus(*incidentToModify); err != nil {
				s.pluginAPI.Log.Warn("failed to send a POST request to the update status webhook URL", "webhook URL", incidentToModify.WebhookOnStatusUpdateURL, "error", err)
				_, _ = s.poster.PostMessage(incidentToModify.ChannelID, "Incident update announcement through the outgoing webhook failed. Contact your System Admin for more information.")
			}
		}()
	}

	if options.Status == StatusArchived && incidentToModify.ExportChannelOnArchiveEnabled {
		// set url and query string
		exportPluginUrl := fmt.Sprintf("plugins/com.mattermost.plugin-channel-export/api/v1/export?format=csv&channel_id=%s", incidentToModify.ChannelID)

		req, err := http.NewRequest(http.MethodGet, exportPluginUrl, nil)
		req.Header.Add("Mattermost-User-ID", incidentToModify.OwnerUserID)
		if err != nil {
			s.pluginAPI.Log.Warn("failed to create request for exporting channel", "plugin", "channel-export", "error", err)
			// return errors.Wrap(err, "failed to create request for exporting channel")
		}

		res := s.pluginAPI.Plugin.HTTP(req)
		if res.StatusCode == http.StatusOK {
			bodyBytes, err := ioutil.ReadAll(res.Body)
			if err != nil {
				s.pluginAPI.Log.Warn("failed to read content from response body", "plugin", "channel-export", "error", err)
				// return errors.Wrap(err, "failed to read content from response body")
			}
			res.Body.Close()
			res.Body = nil
			fileResult := string(bodyBytes)

			if err = s.poster.DM(incidentToModify.OwnerUserID, "Here are the link for exported channel %s", fileResult); err != nil {
				return errors.Wrap(err, "failed to send exported channel to incident's commander")
			}

		}

	}

	return nil
}

func (s *IncidentServiceImpl) postRetrospectiveReminder(incident *Incident, isInitial bool) error {
	team, err := s.pluginAPI.Team.Get(incident.TeamID)
	if err != nil {
		return err
	}

	retrospectiveURL := fmt.Sprintf("/%s/%s/incidents/%s/retrospective",
		team.Name,
		s.configService.GetManifest().Id,
		incident.ID,
	)

	attachments := []*model.SlackAttachment{
		{
			Actions: []*model.PostAction{
				{
					Type: "button",
					Name: "No Retrospective",
					Integration: &model.PostActionIntegration{
						URL: fmt.Sprintf("/plugins/%s/api/v0/incidents/%s/no-retrospective-button",
							s.configService.GetManifest().Id,
							incident.ID),
					},
				},
			},
		},
	}

	customPostType := "custom_retro_rem"
	if isInitial {
		customPostType = "custom_retro_rem_first"
	}

	if _, err = s.poster.PostCustomMessageWithAttachments(incident.ChannelID, customPostType, attachments, "@channel Reminder to [fill out the retrospective](%s).", retrospectiveURL); err != nil {
		return errors.Wrap(err, "failed to post retro reminder to channel")
	}

	return nil
}

// GetIncident gets an incident by ID. Returns error if it could not be found.
func (s *IncidentServiceImpl) GetIncident(incidentID string) (*Incident, error) {
	return s.store.GetIncident(incidentID)
}

// GetIncidentMetadata gets ancillary metadata about an incident.
func (s *IncidentServiceImpl) GetIncidentMetadata(incidentID string) (*Metadata, error) {
	incident, err := s.GetIncident(incidentID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve incident '%s'", incidentID)
	}

	// Get main channel details
	channel, err := s.pluginAPI.Channel.Get(incident.ChannelID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve channel id '%s'", incident.ChannelID)
	}
	team, err := s.pluginAPI.Team.Get(channel.TeamId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve team id '%s'", channel.TeamId)
	}

	numMembers, err := s.store.GetAllIncidentMembersCount(incident.ChannelID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get the count of incident members for channel id '%s'", incident.ChannelID)
	}

	return &Metadata{
		ChannelName:        channel.Name,
		ChannelDisplayName: channel.DisplayName,
		TeamName:           team.Name,
		TotalPosts:         channel.TotalMsgCount,
		NumMembers:         numMembers,
	}, nil
}

// GetIncidentIDForChannel get the incidentID associated with this channel. Returns ErrNotFound
// if there is no incident associated with this channel.
func (s *IncidentServiceImpl) GetIncidentIDForChannel(channelID string) (string, error) {
	incidentID, err := s.store.GetIncidentIDForChannel(channelID)
	if err != nil {
		return "", err
	}
	return incidentID, nil
}

// GetOwners returns all the owners of the incidents selected by options
func (s *IncidentServiceImpl) GetOwners(requesterInfo RequesterInfo, options IncidentFilterOptions) ([]OwnerInfo, error) {
	return s.store.GetOwners(requesterInfo, options)
}

// IsOwner returns true if the userID is the owner for incidentID.
func (s *IncidentServiceImpl) IsOwner(incidentID, userID string) bool {
	incident, err := s.store.GetIncident(incidentID)
	if err != nil {
		return false
	}
	return incident.OwnerUserID == userID
}

// ChangeOwner processes a request from userID to change the owner for incidentID
// to ownerID. Changing to the same ownerID is a no-op.
func (s *IncidentServiceImpl) ChangeOwner(incidentID, userID, ownerID string) error {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return err
	}

	if incidentToModify.OwnerUserID == ownerID {
		return nil
	}

	oldOwner, err := s.pluginAPI.User.Get(incidentToModify.OwnerUserID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", incidentToModify.OwnerUserID)
	}
	newOwner, err := s.pluginAPI.User.Get(ownerID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", ownerID)
	}

	incidentToModify.OwnerUserID = ownerID
	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident")
	}

	mainChannelID := incidentToModify.ChannelID
	modifyMessage := fmt.Sprintf("changed the incident owner from **@%s** to **@%s**.",
		oldOwner.Username, newOwner.Username)
	post, err := s.modificationMessage(userID, mainChannelID, modifyMessage)
	if err != nil {
		return err
	}

	event := &TimelineEvent{
		IncidentID:    incidentID,
		CreateAt:      post.CreateAt,
		EventAt:       post.CreateAt,
		EventType:     OwnerChanged,
		Summary:       fmt.Sprintf("@%s to @%s", oldOwner.Username, newOwner.Username),
		PostID:        post.Id,
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	s.telemetry.ChangeOwner(incidentToModify, userID)

	if err = s.sendIncidentToClient(incidentID); err != nil {
		return err
	}

	return nil
}

// ModifyCheckedState checks or unchecks the specified checklist item. Idempotent, will not perform
// any action if the checklist item is already in the given checked state
func (s *IncidentServiceImpl) ModifyCheckedState(incidentID, userID, newState string, checklistNumber, itemNumber int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !IsValidChecklistItemIndex(incidentToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indicies")
	}

	itemToCheck := incidentToModify.Checklists[checklistNumber].Items[itemNumber]
	if newState == itemToCheck.State {
		return nil
	}

	// Send modification message before the actual modification because we need the postID
	// from the notification message.
	mainChannelID := incidentToModify.ChannelID
	modifyMessage := fmt.Sprintf("checked off checklist item **%v**", stripmd.Strip(itemToCheck.Title))
	if newState == ChecklistItemStateOpen {
		modifyMessage = fmt.Sprintf("unchecked checklist item **%v**", stripmd.Strip(itemToCheck.Title))
	}
	post, err := s.modificationMessage(userID, mainChannelID, modifyMessage)
	if err != nil {
		return err
	}

	itemToCheck.State = newState
	itemToCheck.StateModified = model.GetMillis()
	itemToCheck.StateModifiedPostID = post.Id
	incidentToModify.Checklists[checklistNumber].Items[itemNumber] = itemToCheck

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident, is now in inconsistent state")
	}

	s.telemetry.ModifyCheckedState(incidentID, userID, itemToCheck, incidentToModify.OwnerUserID == userID)

	event := &TimelineEvent{
		IncidentID:    incidentID,
		CreateAt:      itemToCheck.StateModified,
		EventAt:       itemToCheck.StateModified,
		EventType:     TaskStateModified,
		Summary:       modifyMessage,
		PostID:        post.Id,
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	if err = s.sendIncidentToClient(incidentID); err != nil {
		return err
	}

	return nil
}

// ToggleCheckedState checks or unchecks the specified checklist item
func (s *IncidentServiceImpl) ToggleCheckedState(incidentID, userID string, checklistNumber, itemNumber int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !IsValidChecklistItemIndex(incidentToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indices")
	}

	isOpen := incidentToModify.Checklists[checklistNumber].Items[itemNumber].State == ChecklistItemStateOpen
	newState := ChecklistItemStateOpen
	if isOpen {
		newState = ChecklistItemStateClosed
	}

	return s.ModifyCheckedState(incidentID, userID, newState, checklistNumber, itemNumber)
}

// SetAssignee sets the assignee for the specified checklist item
// Idempotent, will not perform any actions if the checklist item is already assigned to assigneeID
func (s *IncidentServiceImpl) SetAssignee(incidentID, userID, assigneeID string, checklistNumber, itemNumber int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !IsValidChecklistItemIndex(incidentToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indices")
	}

	itemToCheck := incidentToModify.Checklists[checklistNumber].Items[itemNumber]
	if assigneeID == itemToCheck.AssigneeID {
		return nil
	}

	newAssigneeUsername := noAssigneeName
	if assigneeID != "" {
		newUser, err2 := s.pluginAPI.User.Get(assigneeID)
		if err2 != nil {
			return errors.Wrapf(err, "failed to to resolve user %s", assigneeID)
		}
		newAssigneeUsername = "@" + newUser.Username
	}

	oldAssigneeUsername := noAssigneeName
	if itemToCheck.AssigneeID != "" {
		oldUser, err2 := s.pluginAPI.User.Get(itemToCheck.AssigneeID)
		if err2 != nil {
			return errors.Wrapf(err, "failed to to resolve user %s", assigneeID)
		}
		oldAssigneeUsername = oldUser.Username
	}

	mainChannelID := incidentToModify.ChannelID
	modifyMessage := fmt.Sprintf("changed assignee of checklist item **%s** from **%s** to **%s**",
		stripmd.Strip(itemToCheck.Title), oldAssigneeUsername, newAssigneeUsername)

	// Send modification message before the actual modification because we need the postID
	// from the notification message.
	post, err := s.modificationMessage(userID, mainChannelID, modifyMessage)
	if err != nil {
		return err
	}

	itemToCheck.AssigneeID = assigneeID
	itemToCheck.AssigneeModified = model.GetMillis()
	itemToCheck.AssigneeModifiedPostID = post.Id
	incidentToModify.Checklists[checklistNumber].Items[itemNumber] = itemToCheck

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident; it is now in an inconsistent state")
	}

	s.telemetry.SetAssignee(incidentID, userID, itemToCheck)

	event := &TimelineEvent{
		IncidentID:    incidentID,
		CreateAt:      itemToCheck.AssigneeModified,
		EventAt:       itemToCheck.AssigneeModified,
		EventType:     AssigneeChanged,
		Summary:       modifyMessage,
		PostID:        post.Id,
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	if err = s.sendIncidentToClient(incidentID); err != nil {
		return err
	}

	return nil
}

// RunChecklistItemSlashCommand executes the slash command associated with the specified checklist
// item.
func (s *IncidentServiceImpl) RunChecklistItemSlashCommand(incidentID, userID string, checklistNumber, itemNumber int) (string, error) {
	incident, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return "", err
	}

	if !IsValidChecklistItemIndex(incident.Checklists, checklistNumber, itemNumber) {
		return "", errors.New("invalid checklist item indices")
	}

	itemToRun := incident.Checklists[checklistNumber].Items[itemNumber]
	if strings.TrimSpace(itemToRun.Command) == "" {
		return "", errors.New("no slash command associated with this checklist item")
	}

	cmdResponse, err := s.pluginAPI.SlashCommand.Execute(&model.CommandArgs{
		Command:   itemToRun.Command,
		UserId:    userID,
		TeamId:    incident.TeamID,
		ChannelId: incident.ChannelID,
	})
	if err == pluginapi.ErrNotFound {
		trigger := strings.Fields(itemToRun.Command)[0]
		s.poster.EphemeralPost(userID, incident.ChannelID, &model.Post{Message: fmt.Sprintf("Failed to find slash command **%s**", trigger)})

		return "", errors.Wrap(err, "failed to find slash command")
	} else if err != nil {
		s.poster.EphemeralPost(userID, incident.ChannelID, &model.Post{Message: fmt.Sprintf("Failed to execute slash command **%s**", itemToRun.Command)})

		return "", errors.Wrap(err, "failed to run slash command")
	}

	// Record the last (successful) run time.
	incident.Checklists[checklistNumber].Items[itemNumber].CommandLastRun = model.GetMillis()
	if err = s.store.UpdateIncident(incident); err != nil {
		return "", errors.Wrapf(err, "failed to update incident recording run of slash command")
	}

	s.telemetry.RunTaskSlashCommand(incidentID, userID, itemToRun)

	eventTime := model.GetMillis()
	event := &TimelineEvent{
		IncidentID:    incidentID,
		CreateAt:      eventTime,
		EventAt:       eventTime,
		EventType:     RanSlashCommand,
		Summary:       fmt.Sprintf("ran the slash command: `%s`", itemToRun.Command),
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return "", errors.Wrap(err, "failed to create timeline event")
	}

	if err = s.sendIncidentToClient(incidentID); err != nil {
		return "", err
	}

	return cmdResponse.TriggerId, nil
}

// AddChecklistItem adds an item to the specified checklist
func (s *IncidentServiceImpl) AddChecklistItem(incidentID, userID string, checklistNumber int, checklistItem ChecklistItem) error {
	incidentToModify, err := s.checklistParamsVerify(incidentID, userID, checklistNumber)
	if err != nil {
		return err
	}

	incidentToModify.Checklists[checklistNumber].Items = append(incidentToModify.Checklists[checklistNumber].Items, checklistItem)

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.AddTask(incidentID, userID, checklistItem)

	return nil
}

// RemoveChecklistItem removes the item at the given index from the given checklist
func (s *IncidentServiceImpl) RemoveChecklistItem(incidentID, userID string, checklistNumber, itemNumber int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	checklistItem := incidentToModify.Checklists[checklistNumber].Items[itemNumber]
	incidentToModify.Checklists[checklistNumber].Items = append(
		incidentToModify.Checklists[checklistNumber].Items[:itemNumber],
		incidentToModify.Checklists[checklistNumber].Items[itemNumber+1:]...,
	)

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.RemoveTask(incidentID, userID, checklistItem)

	return nil
}

// EditChecklistItem changes the title of a specified checklist item
func (s *IncidentServiceImpl) EditChecklistItem(incidentID, userID string, checklistNumber, itemNumber int, newTitle, newCommand, newDescription string) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	incidentToModify.Checklists[checklistNumber].Items[itemNumber].Title = newTitle
	incidentToModify.Checklists[checklistNumber].Items[itemNumber].Command = newCommand
	incidentToModify.Checklists[checklistNumber].Items[itemNumber].Description = newDescription
	checklistItem := incidentToModify.Checklists[checklistNumber].Items[itemNumber]

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.RenameTask(incidentID, userID, checklistItem)

	return nil
}

// MoveChecklistItem moves a checklist item to a new location
func (s *IncidentServiceImpl) MoveChecklistItem(incidentID, userID string, checklistNumber, itemNumber, newLocation int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if newLocation >= len(incidentToModify.Checklists[checklistNumber].Items) {
		return errors.New("invalid targetNumber")
	}

	// Move item
	checklist := incidentToModify.Checklists[checklistNumber].Items
	itemMoved := checklist[itemNumber]
	// Delete item to move
	checklist = append(checklist[:itemNumber], checklist[itemNumber+1:]...)
	// Insert item in new location
	checklist = append(checklist, ChecklistItem{})
	copy(checklist[newLocation+1:], checklist[newLocation:])
	checklist[newLocation] = itemMoved
	incidentToModify.Checklists[checklistNumber].Items = checklist

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.MoveTask(incidentID, userID, itemMoved)

	return nil
}

// GetChecklistAutocomplete returns the list of checklist items for incidentID to be used in autocomplete
func (s *IncidentServiceImpl) GetChecklistAutocomplete(incidentID string) ([]model.AutocompleteListItem, error) {
	incident, err := s.store.GetIncident(incidentID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve incident")
	}

	ret := make([]model.AutocompleteListItem, 0)

	for i, checklist := range incident.Checklists {
		ret = append(ret, model.AutocompleteListItem{
			Item: fmt.Sprintf("%d", i),
			Hint: fmt.Sprintf("\"%s\"", stripmd.Strip(checklist.Title)),
		})
	}

	return ret, nil
}

// GetChecklistAutocomplete returns the list of checklist items for incidentID to be used in autocomplete
func (s *IncidentServiceImpl) GetChecklistItemAutocomplete(incidentID string) ([]model.AutocompleteListItem, error) {
	incident, err := s.store.GetIncident(incidentID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve incident")
	}

	ret := make([]model.AutocompleteListItem, 0)

	for i, checklist := range incident.Checklists {
		for j, item := range checklist.Items {
			ret = append(ret, model.AutocompleteListItem{
				Item: fmt.Sprintf("%d %d", i, j),
				Hint: fmt.Sprintf("\"%s\"", stripmd.Strip(item.Title)),
			})
		}
	}

	return ret, nil
}

func (s *IncidentServiceImpl) checklistParamsVerify(incidentID, userID string, checklistNumber int) (*Incident, error) {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve incident")
	}

	if !s.hasPermissionToModifyIncident(incidentToModify, userID) {
		return nil, errors.New("user does not have permission to modify incident")
	}

	if checklistNumber >= len(incidentToModify.Checklists) {
		return nil, errors.New("invalid checklist number")
	}

	return incidentToModify, nil
}

func (s *IncidentServiceImpl) modificationMessage(userID, channelID, message string) (*model.Post, error) {
	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to to resolve user %s", userID)
	}

	post, err := s.poster.PostMessage(channelID, user.Username+" "+message)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to post modification messsage")
	}

	return post, nil
}

func (s *IncidentServiceImpl) checklistItemParamsVerify(incidentID, userID string, checklistNumber, itemNumber int) (*Incident, error) {
	incidentToModify, err := s.checklistParamsVerify(incidentID, userID, checklistNumber)
	if err != nil {
		return nil, err
	}

	if itemNumber >= len(incidentToModify.Checklists[checklistNumber].Items) {
		return nil, errors.New("invalid item number")
	}

	return incidentToModify, nil
}

// NukeDB removes all incident related data.
func (s *IncidentServiceImpl) NukeDB() error {
	return s.store.NukeDB()
}

// ChangeCreationDate changes the creation date of the incident.
func (s *IncidentServiceImpl) ChangeCreationDate(incidentID string, creationTimestamp time.Time) error {
	return s.store.ChangeCreationDate(incidentID, creationTimestamp)
}

// UserHasJoinedChannel is called when userID has joined channelID. If actorID is not blank, userID
// was invited by actorID.
func (s *IncidentServiceImpl) UserHasJoinedChannel(userID, channelID, actorID string) {
	incidentID, err := s.store.GetIncidentIDForChannel(channelID)

	if err != nil {
		// This is not an incident channel
		return
	}

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		s.logger.Errorf("failed to resolve user for userID: %s; error: %s", userID, err.Error())
		return
	}

	channel, err := s.pluginAPI.Channel.Get(channelID)
	if err != nil {
		s.logger.Errorf("failed to resolve channel for channelID: %s; error: %s", channelID, err.Error())
		return
	}

	title := fmt.Sprintf("@%s joined the channel", user.Username)

	summary := fmt.Sprintf("@%s joined ~%s", user.Username, channel.Name)
	if actorID != "" {
		actor, err2 := s.pluginAPI.User.Get(actorID)
		if err2 != nil {
			s.logger.Errorf("failed to resolve user for userID: %s; error: %s", actorID, err2.Error())
			return
		}

		summary = fmt.Sprintf("@%s added @%s to ~%s", actor.Username, user.Username, channel.Name)
	}
	now := model.GetMillis()
	event := &TimelineEvent{
		IncidentID:    incidentID,
		CreateAt:      now,
		EventAt:       now,
		EventType:     UserJoinedLeft,
		Summary:       summary,
		Details:       fmt.Sprintf(`{"action": "joined", "title": "%s"}`, title),
		SubjectUserID: userID,
		CreatorUserID: actorID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		s.logger.Errorf("failed to create timeline event; error: %s", err.Error())
	}

	_ = s.sendIncidentToClient(incidentID)
}

// CheckAndSendMessageOnJoin checks if userID has viewed channelID and sends
// incident.MessageOnJoin if it exists. Returns true if the message was sent.
func (s *IncidentServiceImpl) CheckAndSendMessageOnJoin(userID, givenIncidentID, channelID string) bool {
	hasViewed := s.store.HasViewedChannel(userID, channelID)

	if hasViewed {
		return true
	}

	incidentID, err := s.store.GetIncidentIDForChannel(channelID)
	if err != nil {
		s.logger.Errorf("failed to resolve incident for channelID: %s; error: %s", channelID, err.Error())
		return false
	}

	if incidentID != givenIncidentID {
		s.logger.Errorf("endpoint's incidentID does not match channelID's incidentID")
		return false
	}

	incident, err := s.store.GetIncident(incidentID)
	if err != nil {
		s.logger.Errorf("failed to resolve incident for incidentID: %s; error: %s", incidentID, err.Error())
		return false
	}

	if err = s.store.SetViewedChannel(userID, channelID); err != nil {
		// If duplicate entry, userID has viewed channelID. If not a duplicate, assume they haven't.
		return errors.Is(err, ErrDuplicateEntry)
	}

	if incident.MessageOnJoin != "" {
		s.poster.EphemeralPost(userID, channelID, &model.Post{
			Message: incident.MessageOnJoin,
		})
	}

	return true
}

// UserHasLeftChannel is called when userID has left channelID. If actorID is not blank, userID
// was removed from the channel by actorID.
func (s *IncidentServiceImpl) UserHasLeftChannel(userID, channelID, actorID string) {
	incidentID, err := s.store.GetIncidentIDForChannel(channelID)

	if err != nil {
		// This is not an incident channel
		return
	}

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		s.logger.Errorf("failed to resolve user for userID: %s; error: %s", userID, err.Error())
		return
	}

	channel, err := s.pluginAPI.Channel.Get(channelID)
	if err != nil {
		s.logger.Errorf("failed to resolve channel for channelID: %s; error: %s", channelID, err.Error())
		return
	}

	title := fmt.Sprintf("@%s left the channel", user.Username)

	summary := fmt.Sprintf("@%s left ~%s", user.Username, channel.Name)
	if actorID != "" {
		actor, err2 := s.pluginAPI.User.Get(actorID)
		if err2 != nil {
			s.logger.Errorf("failed to resolve user for userID: %s; error: %s", actorID, err2.Error())
			return
		}

		summary = fmt.Sprintf("@%s removed @%s from ~%s", actor.Username, user.Username, channel.Name)
	}
	now := model.GetMillis()
	event := &TimelineEvent{
		IncidentID:    incidentID,
		CreateAt:      now,
		EventAt:       now,
		EventType:     UserJoinedLeft,
		Summary:       summary,
		Details:       fmt.Sprintf(`{"action": "left", "title": "%s"}`, title),
		SubjectUserID: userID,
		CreatorUserID: actorID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		s.logger.Errorf("failed to create timeline event; error: %s", err.Error())
	}

	_ = s.sendIncidentToClient(incidentID)
}

func (s *IncidentServiceImpl) hasPermissionToModifyIncident(incident *Incident, userID string) bool {
	// Incident main channel membership is required to modify incident
	return s.pluginAPI.User.HasPermissionToChannel(userID, incident.ChannelID, model.PERMISSION_READ_CHANNEL)
}

func (s *IncidentServiceImpl) createIncidentChannel(incident *Incident, header string, public bool) (*model.Channel, error) {
	channelType := model.CHANNEL_PRIVATE
	if public {
		channelType = model.CHANNEL_OPEN
	}

	channel := &model.Channel{
		TeamId:      incident.TeamID,
		Type:        channelType,
		DisplayName: incident.Name,
		Name:        cleanChannelName(incident.Name),
		Header:      header,
	}

	if channel.Name == "" {
		channel.Name = model.NewId()
	}

	// Prefer the channel name the user chose. But if it already exists, add some random bits
	// and try exactly once more.
	err := s.pluginAPI.Channel.Create(channel)
	if err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			// Let the user correct display name errors:
			if appErr.Id == "model.channel.is_valid.display_name.app_error" ||
				appErr.Id == "model.channel.is_valid.2_or_more.app_error" {
				return nil, ErrChannelDisplayNameInvalid
			}

			// We can fix channel Name errors:
			if appErr.Id == "store.sql_channel.save_channel.exists.app_error" {
				channel.Name = addRandomBits(channel.Name)
				err = s.pluginAPI.Channel.Create(channel)
			}
		}

		if err != nil {
			return nil, errors.Wrapf(err, "failed to create incident channel")
		}
	}

	if _, err := s.pluginAPI.Team.CreateMember(channel.TeamId, s.configService.GetConfiguration().BotUserID); err != nil {
		return nil, errors.Wrapf(err, "failed to add bot to the team")
	}

	if _, err := s.pluginAPI.Channel.AddMember(channel.Id, s.configService.GetConfiguration().BotUserID); err != nil {
		return nil, errors.Wrapf(err, "failed to add bot to the channel")
	}

	if _, err := s.pluginAPI.Channel.AddUser(channel.Id, incident.ReporterUserID, s.configService.GetConfiguration().BotUserID); err != nil {
		return nil, errors.Wrapf(err, "failed to add reporter to the channel")
	}

	if incident.OwnerUserID != incident.ReporterUserID {
		if _, err := s.pluginAPI.Channel.AddUser(channel.Id, incident.OwnerUserID, s.configService.GetConfiguration().BotUserID); err != nil {
			return nil, errors.Wrapf(err, "failed to add owner to channel")
		}
	}

	if _, err := s.pluginAPI.Channel.UpdateChannelMemberRoles(channel.Id, incident.OwnerUserID, fmt.Sprintf("%s %s", model.CHANNEL_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID)); err != nil {
		s.pluginAPI.Log.Warn("failed to promote owner to admin", "ChannelID", channel.Id, "OwnerUserID", incident.OwnerUserID, "err", err.Error())
	}

	return channel, nil
}

func (s *IncidentServiceImpl) newIncidentDialog(teamID, ownerID, postID, clientID string, playbooks []Playbook, isMobileApp bool) (*model.Dialog, error) {
	team, err := s.pluginAPI.Team.Get(teamID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to fetch team")
	}

	user, err := s.pluginAPI.User.Get(ownerID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to fetch owner user")
	}

	state, err := json.Marshal(DialogState{
		PostID:   postID,
		ClientID: clientID,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal DialogState")
	}

	var options []*model.PostActionOptions
	for _, playbook := range playbooks {
		options = append(options, &model.PostActionOptions{
			Text:  playbook.Title,
			Value: playbook.ID,
		})
	}

	siteURL := model.SERVICE_SETTINGS_DEFAULT_SITE_URL
	if s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL != nil {
		siteURL = *s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	}
	newPlaybookMarkdown := ""
	if siteURL != "" && !isMobileApp {
		url := fmt.Sprintf("%s/%s/%s/playbooks/new", siteURL, team.Name, s.configService.GetManifest().Id)
		newPlaybookMarkdown = fmt.Sprintf(" [Create a playbook.](%s)", url)
	}

	introText := fmt.Sprintf("**Owner:** %v\n\nPlaybooks are necessary to start an incident.%s", getUserDisplayName(user), newPlaybookMarkdown)

	defaultOption := ""

	if len(options) == 1 {
		defaultOption = options[0].Value
	}

	return &model.Dialog{
		Title:            "Incident Details",
		IntroductionText: introText,
		Elements: []model.DialogElement{
			{
				DisplayName: "Playbook",
				Name:        DialogFieldPlaybookIDKey,
				Type:        "select",
				Options:     options,
				Default:     defaultOption,
			},
			{
				DisplayName: "Incident Name",
				Name:        DialogFieldNameKey,
				Type:        "text",
				MinLength:   2,
				MaxLength:   64,
			},
		},
		SubmitLabel:    "Start Incident",
		NotifyOnCancel: false,
		State:          string(state),
	}, nil
}

func (s *IncidentServiceImpl) newUpdateIncidentDialog(description, message, broadcastChannelID, status string, reminderTimer time.Duration) (*model.Dialog, error) {
	introductionText := "Update your incident status."

	broadcastChannel, err := s.pluginAPI.Channel.Get(broadcastChannelID)
	if err == nil {
		if broadcastChannel.Type == model.CHANNEL_OPEN {
			team, err := s.pluginAPI.Team.Get(broadcastChannel.TeamId)
			if err != nil {
				return nil, err
			}

			introductionText += fmt.Sprintf(" This post will be broadcasted to [%s](/%s/channels/%s).", broadcastChannel.DisplayName, team.Name, broadcastChannel.Id)
		} else {
			introductionText += " This post will be broadcasted to a private channel."
		}

	}

	reminderOptions := []*model.PostActionOptions{
		{
			Text:  "None",
			Value: "0",
		},
		{
			Text:  "15min",
			Value: "900",
		},
		{
			Text:  "30min",
			Value: "1800",
		},
		{
			Text:  "60min",
			Value: "3600",
		},
		{
			Text:  "4hr",
			Value: "14400",
		},
		{
			Text:  "24hr",
			Value: "86400",
		},
	}

	statusOptions := []*model.PostActionOptions{
		{
			Text:  "Reported",
			Value: "Reported",
		},
		{
			Text:  "Active",
			Value: "Active",
		},
		{
			Text:  "Resolved",
			Value: "Resolved",
		},
		{
			Text:  "Archived",
			Value: "Archived",
		},
	}

	if s.configService.IsConfiguredForDevelopmentAndTesting() {
		reminderOptions = append(reminderOptions, nil)
		copy(reminderOptions[2:], reminderOptions[1:])
		reminderOptions[1] = &model.PostActionOptions{
			Text:  "10sec",
			Value: "10",
		}
	}

	return &model.Dialog{
		Title:            "Update Incident Status",
		IntroductionText: introductionText,
		Elements: []model.DialogElement{
			{
				DisplayName: "Status",
				Name:        DialogFieldStatusKey,
				Type:        "select",
				Options:     statusOptions,
				Optional:    false,
				Default:     status,
			},
			{
				DisplayName: "Description",
				Name:        DialogFieldDescriptionKey,
				Type:        "textarea",
				Default:     description,
			},
			{
				DisplayName: "Change since last update",
				Name:        DialogFieldMessageKey,
				Type:        "textarea",
				Default:     message,
			},
			{
				DisplayName: "Reminder for next update",
				Name:        DialogFieldReminderInSecondsKey,
				Type:        "select",
				Options:     reminderOptions,
				Optional:    true,
				Default:     fmt.Sprintf("%d", reminderTimer/time.Second),
			},
		},
		SubmitLabel:    "Update Status",
		NotifyOnCancel: false,
	}, nil
}

func (s *IncidentServiceImpl) newAddToTimelineDialog(incidents []Incident, postID string) (*model.Dialog, error) {
	var options []*model.PostActionOptions
	for _, i := range incidents {
		options = append(options, &model.PostActionOptions{
			Text:  i.Name,
			Value: i.ID,
		})
	}

	state, err := json.Marshal(DialogStateAddToTimeline{
		PostID: postID,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal DialogState")
	}

	post, err := s.pluginAPI.Post.GetPost(postID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal DialogState")
	}
	defaultSummary := ""
	if len(post.Message) > 0 {
		end := min(40, len(post.Message))
		defaultSummary = post.Message[:end]
		if len(post.Message) > end {
			defaultSummary += "..."
		}
	}

	defaultIncidentID, err := s.GetIncidentIDForChannel(post.ChannelId)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return nil, errors.Wrapf(err, "failed to get incidentID for channel")
	}

	return &model.Dialog{
		Title: "Add to Incident Timeline",
		Elements: []model.DialogElement{
			{
				DisplayName: "Incident",
				Name:        DialogFieldIncidentKey,
				Type:        "select",
				Options:     options,
				Default:     defaultIncidentID,
			},
			{
				DisplayName: "Summary",
				Name:        DialogFieldSummary,
				Type:        "text",
				MaxLength:   64,
				Placeholder: "Short summary shown in the timeline",
				Default:     defaultSummary,
				HelpText:    "Max 64 chars",
			},
		},
		SubmitLabel:    "Add to Timeline",
		NotifyOnCancel: false,
		State:          string(state),
	}, nil
}

func (s *IncidentServiceImpl) sendIncidentToClient(incidentID string) error {
	incidentToSend, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToSend, incidentToSend.ChannelID)

	return nil
}

func (s *IncidentServiceImpl) UpdateRetrospective(incidentID, updaterID, newRetrospective string) error {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident")
	}

	incidentToModify.Retrospective = newRetrospective

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrap(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToChannel(incidentUpdatedWSEvent, incidentToModify, incidentToModify.ChannelID)
	s.telemetry.UpdateRetrospective(incidentToModify, updaterID)

	return nil
}

func (s *IncidentServiceImpl) PublishRetrospective(incidentID, text, publisherID string) error {
	incidentToPublish, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident")
	}

	now := model.GetMillis()

	// Update the text to keep syncronized
	incidentToPublish.Retrospective = text
	incidentToPublish.RetrospectivePublishedAt = now
	incidentToPublish.RetrospectiveWasCanceled = false
	if err = s.store.UpdateIncident(incidentToPublish); err != nil {
		return errors.Wrap(err, "failed to update incident")
	}

	publisherUser, err := s.pluginAPI.User.Get(publisherID)
	if err != nil {
		return errors.Wrap(err, "failed to get publisher user")
	}

	team, err := s.pluginAPI.Team.Get(incidentToPublish.TeamID)
	if err != nil {
		return err
	}

	retrospectiveURL := fmt.Sprintf("/%s/%s/incidents/%s/retrospective",
		team.Name,
		s.configService.GetManifest().Id,
		incidentToPublish.ID,
	)
	if _, err = s.poster.PostMessage(incidentToPublish.ChannelID, "@channel Retrospective has been published by @%s\n[See the full retrospective](%s)\n%s", publisherUser.Username, retrospectiveURL, text); err != nil {
		return errors.Wrap(err, "failed to post to channel")
	}

	event := &TimelineEvent{
		IncidentID:    incidentID,
		CreateAt:      now,
		EventAt:       now,
		EventType:     PublishedRetrospective,
		SubjectUserID: publisherID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	if err := s.sendIncidentToClient(incidentID); err != nil {
		s.logger.Errorf("failed send websocket event; error: %s", err.Error())
	}
	s.telemetry.PublishRetrospective(incidentToPublish, publisherID)

	return nil
}

func (s *IncidentServiceImpl) CancelRetrospective(incidentID, cancelerID string) error {
	incidentToCancel, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident")
	}

	now := model.GetMillis()

	// Update the text to keep syncronized
	incidentToCancel.Retrospective = "No retrospective for this incident."
	incidentToCancel.RetrospectivePublishedAt = now
	incidentToCancel.RetrospectiveWasCanceled = true
	if err = s.store.UpdateIncident(incidentToCancel); err != nil {
		return errors.Wrap(err, "failed to update incident")
	}

	cancelerUser, err := s.pluginAPI.User.Get(cancelerID)
	if err != nil {
		return errors.Wrap(err, "failed to get canceler user")
	}

	if _, err = s.poster.PostMessage(incidentToCancel.ChannelID, "@channel Retrospective has been canceled by @%s\n", cancelerUser.Username); err != nil {
		return errors.Wrap(err, "failed to post to channel")
	}

	event := &TimelineEvent{
		IncidentID:    incidentID,
		CreateAt:      now,
		EventAt:       now,
		EventType:     CanceledRetrospective,
		SubjectUserID: cancelerID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	if err := s.sendIncidentToClient(incidentID); err != nil {
		s.logger.Errorf("failed send websocket event; error: %s", err.Error())
	}

	return nil
}

func getUserDisplayName(user *model.User) string {
	if user == nil {
		return ""
	}

	if user.FirstName != "" && user.LastName != "" {
		return fmt.Sprintf("%s %s", user.FirstName, user.LastName)
	}

	return fmt.Sprintf("@%s", user.Username)
}

func getChannelURL(siteURL string, teamName string, channelName string) string {
	return fmt.Sprintf("%s/%s/channels/%s",
		siteURL,
		teamName,
		channelName,
	)
}

func getDetailsURL(siteURL string, teamName string, manifestID string, incidentID string) string {
	return fmt.Sprintf("%s/%s/%s/incidents/%s",
		siteURL,
		teamName,
		manifestID,
		incidentID,
	)
}

func cleanChannelName(channelName string) string {
	// Lower case only
	channelName = strings.ToLower(channelName)
	// Trim spaces
	channelName = strings.TrimSpace(channelName)
	// Change all dashes to whitespace, remove everything that's not a word or whitespace, all space becomes dashes
	channelName = strings.ReplaceAll(channelName, "-", " ")
	channelName = allNonSpaceNonWordRegex.ReplaceAllString(channelName, "")
	channelName = strings.ReplaceAll(channelName, " ", "-")
	// Remove all leading and trailing dashes
	channelName = strings.Trim(channelName, "-")

	return channelName
}

func addRandomBits(name string) string {
	// Fix too long names (we're adding 5 chars):
	if len(name) > 59 {
		name = name[:59]
	}
	randBits := model.NewId()
	return fmt.Sprintf("%s-%s", name, randBits[:4])
}

func findNewestNonDeletedStatusPost(posts []StatusPost) *StatusPost {
	var newest *StatusPost
	for i, p := range posts {
		if p.DeleteAt == 0 && (newest == nil || p.CreateAt > newest.CreateAt) {
			newest = &posts[i]
		}
	}
	return newest
}

func findNewestNonDeletedPostID(posts []StatusPost) string {
	newest := findNewestNonDeletedStatusPost(posts)
	if newest == nil {
		return ""
	}

	return newest.ID
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
