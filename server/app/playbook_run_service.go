package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	stripmd "github.com/writeas/go-strip-markdown"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-plugin-playbooks/server/httptools"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

const (
	// PlaybookRunCreatedWSEvent is for playbook run creation.
	PlaybookRunCreatedWSEvent = "playbook_run_created"
	playbookRunUpdatedWSEvent = "playbook_run_updated"
	noAssigneeName            = "No Assignee"
)

// PlaybookRunServiceImpl holds the information needed by the PlaybookRunService's methods to complete their functions.
type PlaybookRunServiceImpl struct {
	pluginAPI       *pluginapi.Client
	httpClient      *http.Client
	configService   config.Service
	store           PlaybookRunStore
	poster          bot.Poster
	logger          bot.Logger
	scheduler       JobOnceScheduler
	telemetry       PlaybookRunTelemetry
	api             plugin.API
	playbookService PlaybookService
	permissions     *PermissionsService
}

var allNonSpaceNonWordRegex = regexp.MustCompile(`[^\w\s]`)

// DialogFieldPlaybookIDKey is the key for the playbook ID field used in OpenCreatePlaybookRunDialog.
const DialogFieldPlaybookIDKey = "playbookID"

// DialogFieldNameKey is the key for the playbook run name field used in OpenCreatePlaybookRunDialog.
const DialogFieldNameKey = "playbookRunName"

// DialogFieldDescriptionKey is the key for the description textarea field used in UpdatePlaybookRunDialog
const DialogFieldDescriptionKey = "description"

// DialogFieldMessageKey is the key for the message textarea field used in UpdatePlaybookRunDialog
const DialogFieldMessageKey = "message"

// DialogFieldReminderInSecondsKey is the key for the reminder select field used in UpdatePlaybookRunDialog
const DialogFieldReminderInSecondsKey = "reminder"

// DialogFieldFinishRun is the key for the "Finish run" bool field used in UpdatePlaybookRunDialog
const DialogFieldFinishRun = "finish_run"

// DialogFieldPlaybookRunKey is the key for the playbook run chosen in AddToTimelineDialog
const DialogFieldPlaybookRunKey = "playbook_run"

// DialogFieldSummary is the key for the summary in AddToTimelineDialog
const DialogFieldSummary = "summary"

// DialogFieldItemName is the key for the playbook run name in AddChecklistItemDialog
const DialogFieldItemNameKey = "name"

// DialogFieldDescriptionKey is the key for the description in AddChecklistItemDialog
const DialogFieldItemDescriptionKey = "description"

// DialogFieldCommandKey is the key for the command in AddChecklistItemDialog
const DialogFieldItemCommandKey = "command"

// NewPlaybookRunService creates a new PlaybookRunServiceImpl.
func NewPlaybookRunService(
	pluginAPI *pluginapi.Client,
	store PlaybookRunStore,
	poster bot.Poster,
	logger bot.Logger,
	configService config.Service,
	scheduler JobOnceScheduler,
	telemetry PlaybookRunTelemetry,
	api plugin.API,
	playbookService PlaybookService,
) *PlaybookRunServiceImpl {
	service := &PlaybookRunServiceImpl{
		pluginAPI:       pluginAPI,
		store:           store,
		poster:          poster,
		logger:          logger,
		configService:   configService,
		scheduler:       scheduler,
		telemetry:       telemetry,
		httpClient:      httptools.MakeClient(pluginAPI),
		api:             api,
		playbookService: playbookService,
	}

	service.permissions = NewPermissionsService(service.playbookService, service, service.pluginAPI, service.configService)

	return service
}

// GetPlaybookRuns returns filtered playbook runs and the total count before paging.
func (s *PlaybookRunServiceImpl) GetPlaybookRuns(requesterInfo RequesterInfo, options PlaybookRunFilterOptions) (*GetPlaybookRunsResults, error) {
	results, err := s.store.GetPlaybookRuns(requesterInfo, options)
	if err != nil {
		return nil, errors.Wrap(err, "can't get playbook runs from the store")
	}
	return &GetPlaybookRunsResults{
		TotalCount: results.TotalCount,
		PageCount:  results.PageCount,
		HasMore:    results.HasMore,
		Items:      results.Items,
	}, nil
}

func (s *PlaybookRunServiceImpl) buildPlaybookRunCreationMessage(playbookTitle, playbookID string, playbookRun *PlaybookRun, owner *model.User) (string, error) {
	playbookRunChannel, err := s.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		return "", errors.Wrap(err, "failed to get playbook run channel")
	}

	announcementMsg := fmt.Sprintf(
		"### New run started: [%s](%s)\n",
		playbookRun.Name,
		getRunDetailsRelativeURL(playbookRun.ID),
	)
	announcementMsg += fmt.Sprintf(
		"@%s just ran the [%s](%s) playbook.",
		owner.Username,
		playbookTitle,
		getPlaybookDetailsRelativeURL(playbookID),
	)

	if playbookRunChannel.Type == model.ChannelTypeOpen {
		announcementMsg += fmt.Sprintf(
			" Visit the link above for more information or join ~%v to participate.",
			playbookRunChannel.Name,
		)
	} else {
		announcementMsg += " Visit the link above for more information."
	}

	return announcementMsg, nil
}

// PlaybookRunWebhookPayload is the body of the payload sent via playbook run webhooks.
type PlaybookRunWebhookPayload struct {
	PlaybookRun

	// ChannelURL is the absolute URL of the playbook run channel.
	ChannelURL string `json:"channel_url"`

	// DetailsURL is the absolute URL of the playbook run overview page.
	DetailsURL string `json:"details_url"`
}

// sendWebhooksOnCreation sends a POST request to the creation webhook URL.
// It blocks until a response is received.
func (s *PlaybookRunServiceImpl) sendWebhooksOnCreation(playbookRun PlaybookRun) {
	siteURL := s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	if siteURL == nil {
		s.pluginAPI.Log.Warn("cannot send webhook on creation, please set siteURL")
		return
	}

	team, err := s.pluginAPI.Team.Get(playbookRun.TeamID)
	if err != nil {
		s.pluginAPI.Log.Warn("cannot send webhook on creation, not able to get playbookRun.TeamID")
		return
	}

	channel, err := s.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		s.pluginAPI.Log.Warn("cannot send webhook on creation, not able to get playbookRun.ChannelID")
		return
	}

	channelURL := getChannelURL(*siteURL, team.Name, channel.Name)

	detailsURL := getRunDetailsURL(*siteURL, playbookRun.ID)

	payload := PlaybookRunWebhookPayload{
		PlaybookRun: playbookRun,
		ChannelURL:  channelURL,
		DetailsURL:  detailsURL,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		s.pluginAPI.Log.Warn("cannot send webhook on creation, unable to marshal payload")
		return
	}

	triggerWebhooks(s, playbookRun.WebhookOnCreationURLs, body)
}

// CreatePlaybookRun creates a new playbook run. userID is the user who initiated the CreatePlaybookRun.
func (s *PlaybookRunServiceImpl) CreatePlaybookRun(playbookRun *PlaybookRun, pb *Playbook, userID string, public bool) (*PlaybookRun, error) {
	if playbookRun.DefaultOwnerID != "" {
		// Check if the user is a member of the team to which the playbook run belongs.
		if !IsMemberOfTeam(playbookRun.DefaultOwnerID, playbookRun.TeamID, s.pluginAPI) {
			s.pluginAPI.Log.Warn("default owner specified, but it is not a member of the playbook run's team", "userID", playbookRun.DefaultOwnerID, "teamID", playbookRun.TeamID)
		} else {
			playbookRun.OwnerUserID = playbookRun.DefaultOwnerID
		}
	}

	playbookRun.ReporterUserID = userID
	playbookRun.ID = model.NewId()

	header := "This channel was created as part of a playbook run. To view more information, select the shield icon then select *Tasks* or *Overview*."
	if pb != nil {
		overviewURL := getRunDetailsRelativeURL(playbookRun.ID)
		playbookURL := getPlaybookDetailsRelativeURL(pb.ID)
		header = fmt.Sprintf("This channel was created as part of the [%s](%s) playbook. Visit [the overview page](%s) for more information.",
			pb.Title, playbookURL, overviewURL)
	}

	if playbookRun.Name == "" {
		playbookRun.Name = pb.ChannelNameTemplate
	}

	// Try to create the channel first
	channel, err := s.createPlaybookRunChannel(playbookRun, header, public)
	if err != nil {
		return nil, err
	}

	now := model.GetMillis()
	playbookRun.ChannelID = channel.Id
	playbookRun.CreateAt = now
	playbookRun.LastStatusUpdateAt = now
	playbookRun.CurrentStatus = StatusInProgress

	// Start with a blank playbook with one empty checklist if one isn't provided
	if playbookRun.PlaybookID == "" {
		playbookRun.Checklists = []Checklist{
			{
				Title: "Checklist",
				Items: []ChecklistItem{},
			},
		}
	}

	playbookRun, err = s.store.CreatePlaybookRun(playbookRun)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create playbook run")
	}

	s.telemetry.CreatePlaybookRun(playbookRun, userID, public)

	// Add users to channel after creating playbook run so that all automations trigger.
	err = s.addPlaybookRunUsers(playbookRun, channel)
	if err != nil {
		return nil, errors.Wrap(err, "failed to add users to playbook run channel")
	}

	invitedUserIDs := playbookRun.InvitedUserIDs

	for _, groupID := range playbookRun.InvitedGroupIDs {
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
		// Check if the user is a member of the team to which the playbook run belongs.
		_, err = s.pluginAPI.Team.GetMember(playbookRun.TeamID, userID)
		if err != nil {
			usersFailedToInvite = append(usersFailedToInvite, userID)
			continue
		}

		_, err = s.pluginAPI.Channel.AddUser(playbookRun.ChannelID, userID, s.configService.GetConfiguration().BotUserID)
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
			return nil, errors.Wrapf(err, "failed to post to channel")
		}
	}

	// Do we send a DM to the new owner?
	if playbookRun.OwnerUserID != playbookRun.ReporterUserID {
		var reporter *model.User
		reporter, err = s.pluginAPI.User.Get(playbookRun.ReporterUserID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to resolve user %s", playbookRun.ReporterUserID)
		}

		startMessage := fmt.Sprintf("You have been assigned ownership of the run: [%s](%s), reported by @%s.",
			playbookRun.Name, getRunDetailsRelativeURL(playbookRun.ID), reporter.Username)

		if err = s.poster.DM(playbookRun.OwnerUserID, &model.Post{Message: startMessage}); err != nil {
			return nil, errors.Wrapf(err, "failed to send DM on CreatePlaybookRun")
		}
	}

	if pb != nil {
		var owner *model.User
		owner, err = s.pluginAPI.User.Get(playbookRun.OwnerUserID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to resolve user %s", playbookRun.OwnerUserID)
		}

		var message string
		message, err = s.buildPlaybookRunCreationMessage(pb.Title, pb.ID, playbookRun, owner)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to build the playbook run creation message")
		}

		s.broadcastPlaybookRunMessageToChannels(pb.BroadcastChannelIDs, &model.Post{Message: message}, creationMessage, playbookRun)

		// dm to users who are auto-following the playbook
		s.dmPostToAutoFollows(&model.Post{Message: message}, pb.ID, playbookRun.ID, userID)
	}

	event := &TimelineEvent{
		PlaybookRunID: playbookRun.ID,
		CreateAt:      playbookRun.CreateAt,
		EventAt:       playbookRun.CreateAt,
		EventType:     PlaybookRunCreated,
		SubjectUserID: playbookRun.ReporterUserID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return playbookRun, errors.Wrap(err, "failed to create timeline event")
	}
	playbookRun.TimelineEvents = append(playbookRun.TimelineEvents, *event)

	//auto-follow playbook run
	if pb != nil {
		autoFollows, err := s.playbookService.GetAutoFollows(pb.ID)
		if err != nil {
			return playbookRun, errors.Wrapf(err, "failed to get autoFollows of the playbook `%s`", pb.ID)
		}
		for _, autoFollow := range autoFollows {
			if err := s.Follow(playbookRun.ID, autoFollow); err != nil {
				s.pluginAPI.Log.Warn("failed to follow the playbook run",
					"playbookRunID", playbookRun.ID, "autoFollow", autoFollow, "error", err.Error())
			}
		}
	}

	if len(playbookRun.WebhookOnCreationURLs) != 0 {
		s.sendWebhooksOnCreation(*playbookRun)
	}

	if playbookRun.PostID == "" {
		return playbookRun, nil
	}

	// Post the content and link of the original post
	post, err := s.pluginAPI.Post.GetPost(playbookRun.PostID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get original post")
	}

	postURL := fmt.Sprintf("/_redirect/pl/%s", playbookRun.PostID)
	postMessage := fmt.Sprintf("[Original Post](%s)\n > %s", postURL, post.Message)

	_, err = s.poster.PostMessage(channel.Id, postMessage)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to post to channel")
	}

	return playbookRun, nil
}

// OpenCreatePlaybookRunDialog opens a interactive dialog to start a new playbook run.
func (s *PlaybookRunServiceImpl) OpenCreatePlaybookRunDialog(teamID, requesterID, triggerID, postID, clientID string, playbooks []Playbook, isMobileApp bool) error {

	filteredPlaybooks := make([]Playbook, 0, len(playbooks))
	for _, playbook := range playbooks {
		if err := s.permissions.RunCreate(requesterID, playbook); err == nil {
			filteredPlaybooks = append(filteredPlaybooks, playbook)
		}
	}

	dialog, err := s.newPlaybookRunDialog(teamID, requesterID, postID, clientID, filteredPlaybooks, isMobileApp)
	if err != nil {
		return errors.Wrapf(err, "failed to create new playbook run dialog")
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/runs/dialog",
			s.configService.GetManifest().Id),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrapf(err, "failed to open new playbook run dialog")
	}

	return nil
}

func (s *PlaybookRunServiceImpl) OpenUpdateStatusDialog(playbookRunID, triggerID string) error {
	currentPlaybookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	message := ""
	newestPostID := findNewestNonDeletedPostID(currentPlaybookRun.StatusPosts)
	if newestPostID != "" {
		var post *model.Post
		post, err = s.pluginAPI.Post.GetPost(newestPostID)
		if err != nil {
			return errors.Wrap(err, "failed to find newest post")
		}
		message = post.Message
	} else {
		message = currentPlaybookRun.ReminderMessageTemplate
	}

	dialog, err := s.newUpdatePlaybookRunDialog(currentPlaybookRun.Summary, message, len(currentPlaybookRun.BroadcastChannelIDs), currentPlaybookRun.PreviousReminder)
	if err != nil {
		return errors.Wrap(err, "failed to create update status dialog")
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/runs/%s/update-status-dialog",
			s.configService.GetManifest().Id,
			playbookRunID),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrap(err, "failed to open update status dialog")
	}

	return nil
}

func (s *PlaybookRunServiceImpl) OpenAddToTimelineDialog(requesterInfo RequesterInfo, postID, teamID, triggerID string) error {
	options := PlaybookRunFilterOptions{
		TeamID:        teamID,
		ParticipantID: requesterInfo.UserID,
		Sort:          SortByCreateAt,
		Direction:     DirectionDesc,
		Page:          0,
		PerPage:       PerPageDefault,
	}

	result, err := s.GetPlaybookRuns(requesterInfo, options)
	if err != nil {
		return errors.Wrap(err, "Error retrieving the playbook runs: %v")
	}

	dialog, err := s.newAddToTimelineDialog(result.Items, postID)
	if err != nil {
		return errors.Wrap(err, "failed to create add to timeline dialog")
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/runs/add-to-timeline-dialog",
			s.configService.GetManifest().Id),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrap(err, "failed to open update status dialog")
	}

	return nil
}

func (s *PlaybookRunServiceImpl) OpenAddChecklistItemDialog(triggerID, playbookRunID string, checklist int) error {
	dialog := &model.Dialog{
		Title: "Add new task",
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
		SubmitLabel:    "Add task",
		NotifyOnCancel: false,
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/runs/%s/checklists/%v/add-dialog",
			s.configService.GetManifest().Id, playbookRunID, checklist),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrap(err, "failed to open update status dialog")
	}

	return nil
}

func (s *PlaybookRunServiceImpl) AddPostToTimeline(playbookRunID, userID, postID, summary string) error {
	post, err := s.pluginAPI.Post.GetPost(postID)
	if err != nil {
		return errors.Wrap(err, "failed to find post")
	}

	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
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

	playbookRunModified, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	s.telemetry.AddPostToTimeline(playbookRunModified, userID)

	if err = s.sendPlaybookRunToClient(playbookRunID); err != nil {
		return errors.Wrap(err, "failed to send playbook run to client")
	}

	return nil
}

// RemoveTimelineEvent removes the timeline event (sets the DeleteAt to the current time).
func (s *PlaybookRunServiceImpl) RemoveTimelineEvent(playbookRunID, userID, eventID string) error {
	event, err := s.store.GetTimelineEvent(playbookRunID, eventID)
	if err != nil {
		return err
	}

	event.DeleteAt = model.GetMillis()
	if err = s.store.UpdateTimelineEvent(event); err != nil {
		return err
	}

	playbookRunModified, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	s.telemetry.RemoveTimelineEvent(playbookRunModified, userID)

	if err = s.sendPlaybookRunToClient(playbookRunID); err != nil {
		return errors.Wrap(err, "failed to send playbook run to client")
	}

	return nil
}

func (s *PlaybookRunServiceImpl) buildStatusUpdatePost(statusUpdate, playbookRunID, authorID string) (*model.Post, error) {
	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve playbook run for id '%s'", playbookRunID)
	}

	authorUser, err := s.pluginAPI.User.Get(authorID)
	if err != nil {
		return nil, errors.Wrapf(err, "error when trying to get the author user with ID '%s'", authorID)
	}

	numTasks := 0
	numTasksChecked := 0
	for _, checklist := range playbookRun.Checklists {
		numTasks += len(checklist.Items)
		for _, task := range checklist.Items {
			if task.State == ChecklistItemStateClosed {
				numTasksChecked++
			}
		}
	}

	return &model.Post{
		Message: statusUpdate,
		Type:    "custom_run_update",
		Props: map[string]interface{}{
			"numTasksChecked": numTasksChecked,
			"numTasks":        numTasks,
			"participantIds":  playbookRun.ParticipantIDs,
			"authorUsername":  authorUser.Username,
			"playbookRunId":   playbookRun.ID,
			"runName":         playbookRun.Name,
		},
	}, nil
}

// sendWebhooksOnUpdateStatus sends a POST request to the status update webhook URL.
// It blocks until a response is received.
func (s *PlaybookRunServiceImpl) sendWebhooksOnUpdateStatus(playbookRunID string) {
	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		s.pluginAPI.Log.Warn("cannot send webhook on update, not able to get playbookRun")
		return
	}

	siteURL := s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	if siteURL == nil {
		s.pluginAPI.Log.Warn("cannot send webhook on update, please set siteURL")
		return
	}

	team, err := s.pluginAPI.Team.Get(playbookRun.TeamID)
	if err != nil {
		s.pluginAPI.Log.Warn("cannot send webhook on update, not able to get playbookRun.TeamID")
		return
	}

	channel, err := s.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		s.pluginAPI.Log.Warn("cannot send webhook on update, not able to get playbookRun.TeamID")
		return
	}

	channelURL := getChannelURL(*siteURL, team.Name, channel.Name)

	detailsURL := getRunDetailsURL(*siteURL, playbookRun.ID)

	payload := PlaybookRunWebhookPayload{
		PlaybookRun: *playbookRun,
		ChannelURL:  channelURL,
		DetailsURL:  detailsURL,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		s.pluginAPI.Log.Warn("cannot send webhook on update, unable to marshal payload")
		return
	}

	triggerWebhooks(s, playbookRun.WebhookOnStatusUpdateURLs, body)
}

// UpdateStatus updates a playbook run's status.
func (s *PlaybookRunServiceImpl) UpdateStatus(playbookRunID, userID string, options StatusUpdateOptions) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	originalPost, err := s.buildStatusUpdatePost(options.Message, playbookRunID, userID)
	if err != nil {
		return err
	}
	originalPost.ChannelId = playbookRunToModify.ChannelID

	channelPost := originalPost.Clone()
	if err = s.poster.Post(channelPost); err != nil {
		return errors.Wrap(err, "failed to post update status message")
	}

	// Add the status manually for the broadcasts
	playbookRunToModify.StatusPosts = append(playbookRunToModify.StatusPosts,
		StatusPost{
			ID:       channelPost.Id,
			CreateAt: channelPost.CreateAt,
			DeleteAt: channelPost.DeleteAt,
		})

	if err = s.store.UpdateStatus(&SQLStatusPost{
		PlaybookRunID: playbookRunID,
		PostID:        channelPost.Id,
	}); err != nil {
		return errors.Wrap(err, "failed to write status post to store: there is now inconsistent state")
	}

	s.broadcastPlaybookRunMessageToChannels(playbookRunToModify.BroadcastChannelIDs, originalPost.Clone(), statusUpdateMessage, playbookRunToModify)

	s.dmPostToRunFollowers(originalPost.Clone(), statusUpdateMessage, playbookRunID, userID)

	// Remove pending reminder (if any), even if current reminder was set to "none" (0 minutes)
	if err = s.SetNewReminder(playbookRunID, options.Reminder); err != nil {
		return errors.Wrapf(err, "failed to set new reminder")
	}

	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      channelPost.CreateAt,
		EventAt:       channelPost.CreateAt,
		EventType:     StatusUpdated,
		PostID:        channelPost.Id,
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	s.telemetry.UpdateStatus(playbookRunToModify, userID)

	if err = s.sendPlaybookRunToClient(playbookRunID); err != nil {
		return err
	}

	if len(playbookRunToModify.WebhookOnStatusUpdateURLs) != 0 {
		s.sendWebhooksOnUpdateStatus(playbookRunID)
	}

	return nil
}

func (s *PlaybookRunServiceImpl) OpenFinishPlaybookRunDialog(playbookRunID, triggerID string) error {
	currentPlaybookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	numOutstanding := 0
	for _, c := range currentPlaybookRun.Checklists {
		for _, item := range c.Items {
			if item.State == ChecklistItemStateOpen || item.State == ChecklistItemStateInProgress {
				numOutstanding++
			}
		}
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v0/runs/%s/finish-dialog",
			s.configService.GetManifest().Id,
			playbookRunID),
		Dialog:    *s.newFinishPlaybookRunDialog(numOutstanding),
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrap(err, "failed to open finish run dialog")
	}

	return nil
}

func (s *PlaybookRunServiceImpl) buildRunFinishedMessage(playbookRun *PlaybookRun, userName string) string {
	announcementMsg := fmt.Sprintf(
		"### Run finished: [%s](%s)\n",
		playbookRun.Name,
		getRunDetailsRelativeURL(playbookRun.ID),
	)
	announcementMsg += fmt.Sprintf(
		"@%s just marked [%s](%s) as finished. Visit the link above for more information.",
		userName,
		playbookRun.Name,
		getRunDetailsRelativeURL(playbookRun.ID),
	)

	return announcementMsg
}

// FinishPlaybookRun changes a run's state to Finished. If run is already in Finished state, the call is a noop.
func (s *PlaybookRunServiceImpl) FinishPlaybookRun(playbookRunID, userID string) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	if playbookRunToModify.CurrentStatus == StatusFinished {
		return nil
	}

	endAt := model.GetMillis()
	if err = s.store.FinishPlaybookRun(playbookRunID, endAt); err != nil {
		return err
	}

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", userID)
	}

	message := fmt.Sprintf("@%s marked this run as finished.", user.Username)
	postID := ""
	post, err := s.poster.PostMessage(playbookRunToModify.ChannelID, message)
	if err != nil {
		s.pluginAPI.Log.Warn("failed to post the status update to channel", "ChannelID", playbookRunToModify.ChannelID)
	} else {
		postID = post.Id
	}

	s.broadcastPlaybookRunMessageToChannels(playbookRunToModify.BroadcastChannelIDs, &model.Post{Message: message}, finishMessage, playbookRunToModify)

	runFinishedMessage := s.buildRunFinishedMessage(playbookRunToModify, user.Username)
	s.dmPostToRunFollowers(&model.Post{Message: runFinishedMessage}, finishMessage, playbookRunToModify.ID, userID)

	// Remove pending reminder (if any), even if current reminder was set to "none" (0 minutes)
	s.RemoveReminder(playbookRunID)

	err = s.ResetReminderTimer(playbookRunID)
	if err != nil {
		s.pluginAPI.Log.Warn("failed to reset the reminder timer when updating status to Archived", "playbook ID", playbookRunToModify.ID, "error", err)
	}

	// We are resolving the playbook run. Send the reminder to fill out the retrospective
	// Also start the recurring reminder if enabled.
	if playbookRunToModify.RetrospectiveEnabled && playbookRunToModify.RetrospectivePublishedAt == 0 && s.configService.IsAtLeastE10Licensed() {
		if err = s.postRetrospectiveReminder(playbookRunToModify, true); err != nil {
			return errors.Wrap(err, "couldn't post retrospective reminder")
		}
		s.scheduler.Cancel(RetrospectivePrefix + playbookRunID)
		if playbookRunToModify.RetrospectiveReminderIntervalSeconds != 0 {
			if err = s.SetReminder(RetrospectivePrefix+playbookRunID, time.Duration(playbookRunToModify.RetrospectiveReminderIntervalSeconds)*time.Second); err != nil {
				return errors.Wrap(err, "failed to set the retrospective reminder for playbook run")
			}
		}
	}

	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      endAt,
		EventAt:       endAt,
		EventType:     RunFinished,
		PostID:        postID,
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	s.telemetry.FinishPlaybookRun(playbookRunToModify, userID)

	if err = s.sendPlaybookRunToClient(playbookRunID); err != nil {
		return err
	}

	if len(playbookRunToModify.WebhookOnStatusUpdateURLs) != 0 {
		s.sendWebhooksOnUpdateStatus(playbookRunID)
	}

	return nil
}

// RestorePlaybookRun reverts a run from the Finished state. If run was not in Finished state, the call is a noop.
func (s *PlaybookRunServiceImpl) RestorePlaybookRun(playbookRunID, userID string) error {
	playbookRunToRestore, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	if playbookRunToRestore.CurrentStatus != StatusFinished {
		return nil
	}

	restoreAt := model.GetMillis()
	if err = s.store.RestorePlaybookRun(playbookRunID, restoreAt); err != nil {
		return err
	}

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", userID)
	}

	message := fmt.Sprintf("@%s changed this run's status from Finished to In Progress.", user.Username)
	postID := ""
	post, err := s.poster.PostMessage(playbookRunToRestore.ChannelID, message)
	if err != nil {
		s.pluginAPI.Log.Warn("failed to post the status update to channel", "ChannelID", playbookRunToRestore.ChannelID)
	} else {
		postID = post.Id
	}

	s.broadcastPlaybookRunMessageToChannels(playbookRunToRestore.BroadcastChannelIDs, &model.Post{Message: message}, restoreMessage, playbookRunToRestore)

	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      restoreAt,
		EventAt:       restoreAt,
		EventType:     RunRestored,
		PostID:        postID,
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	s.telemetry.RestorePlaybookRun(playbookRunToRestore, userID)

	if err = s.sendPlaybookRunToClient(playbookRunID); err != nil {
		return err
	}

	if len(playbookRunToRestore.WebhookOnStatusUpdateURLs) != 0 {
		s.sendWebhooksOnUpdateStatus(playbookRunID)
	}

	return nil
}

func (s *PlaybookRunServiceImpl) postRetrospectiveReminder(playbookRun *PlaybookRun, isInitial bool) error {
	retrospectiveURL := getRunRetrospectiveURL("", playbookRun.ID)

	attachments := []*model.SlackAttachment{
		{
			Actions: []*model.PostAction{
				{
					Type: "button",
					Name: "No Retrospective",
					Integration: &model.PostActionIntegration{
						URL: fmt.Sprintf("/plugins/%s/api/v0/runs/%s/no-retrospective-button",
							s.configService.GetManifest().Id,
							playbookRun.ID),
					},
				},
			},
		},
	}

	customPostType := "custom_retro_rem"
	if isInitial {
		customPostType = "custom_retro_rem_first"
	}

	if _, err := s.poster.PostCustomMessageWithAttachments(playbookRun.ChannelID, customPostType, attachments, "@channel Reminder to [fill out the retrospective](%s).", retrospectiveURL); err != nil {
		return errors.Wrap(err, "failed to post retro reminder to channel")
	}

	return nil
}

// GetPlaybookRun gets a playbook run by ID. Returns error if it could not be found.
func (s *PlaybookRunServiceImpl) GetPlaybookRun(playbookRunID string) (*PlaybookRun, error) {
	return s.store.GetPlaybookRun(playbookRunID)
}

// GetPlaybookRunMetadata gets ancillary metadata about a playbook run.
func (s *PlaybookRunServiceImpl) GetPlaybookRunMetadata(playbookRunID string) (*Metadata, error) {
	playbookRun, err := s.GetPlaybookRun(playbookRunID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve playbook run '%s'", playbookRunID)
	}

	// Get main channel details
	channel, err := s.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve channel id '%s'", playbookRun.ChannelID)
	}
	team, err := s.pluginAPI.Team.Get(channel.TeamId)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve team id '%s'", channel.TeamId)
	}

	numParticipants, err := s.store.GetHistoricalPlaybookRunParticipantsCount(playbookRun.ChannelID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get the count of playbook run members for channel id '%s'", playbookRun.ChannelID)
	}

	followers, err := s.GetFollowers(playbookRunID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get followers of playbook run %s", playbookRunID)
	}

	return &Metadata{
		ChannelName:        channel.Name,
		ChannelDisplayName: channel.DisplayName,
		TeamName:           team.Name,
		TotalPosts:         channel.TotalMsgCount,
		NumParticipants:    numParticipants,
		Followers:          followers,
	}, nil
}

// GetPlaybookRunIDForChannel get the playbookRunID associated with this channel. Returns ErrNotFound
// if there is no playbook run associated with this channel.
func (s *PlaybookRunServiceImpl) GetPlaybookRunIDForChannel(channelID string) (string, error) {
	playbookRunID, err := s.store.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		return "", err
	}
	return playbookRunID, nil
}

// GetOwners returns all the owners of the playbook runs selected by options
func (s *PlaybookRunServiceImpl) GetOwners(requesterInfo RequesterInfo, options PlaybookRunFilterOptions) ([]OwnerInfo, error) {
	owners, err := s.store.GetOwners(requesterInfo, options)
	if err != nil {
		return nil, errors.Wrap(err, "can't get owners from the store")
	}
	return owners, nil
}

// IsOwner returns true if the userID is the owner for playbookRunID.
func (s *PlaybookRunServiceImpl) IsOwner(playbookRunID, userID string) bool {
	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return false
	}
	return playbookRun.OwnerUserID == userID
}

// ChangeOwner processes a request from userID to change the owner for playbookRunID
// to ownerID. Changing to the same ownerID is a no-op.
func (s *PlaybookRunServiceImpl) ChangeOwner(playbookRunID, userID, ownerID string) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return err
	}

	if playbookRunToModify.OwnerUserID == ownerID {
		return nil
	}

	oldOwner, err := s.pluginAPI.User.Get(playbookRunToModify.OwnerUserID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", playbookRunToModify.OwnerUserID)
	}
	newOwner, err := s.pluginAPI.User.Get(ownerID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", ownerID)
	}
	subjectUser, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", userID)
	}

	playbookRunToModify.OwnerUserID = ownerID
	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	// Do we send a DM to the new owner?
	if ownerID != userID {
		msg := fmt.Sprintf("@%s changed the owner for run: [%s](%s) from **@%s** to **@%s**",
			subjectUser.Username, playbookRunToModify.Name, getRunDetailsRelativeURL(playbookRunToModify.ID),
			oldOwner.Username, newOwner.Username)
		if err = s.poster.DM(ownerID, &model.Post{Message: msg}); err != nil {
			return errors.Wrapf(err, "failed to send DM in ChangeOwner")
		}
	}

	eventTime := model.GetMillis()
	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      eventTime,
		EventAt:       eventTime,
		EventType:     OwnerChanged,
		Summary:       fmt.Sprintf("@%s to @%s", oldOwner.Username, newOwner.Username),
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	s.telemetry.ChangeOwner(playbookRunToModify, userID)

	if err = s.sendPlaybookRunToClient(playbookRunID); err != nil {
		return errors.Wrap(err, "failed to send playbook run to client")
	}

	return nil
}

// ModifyCheckedState checks or unchecks the specified checklist item. Idempotent, will not perform
// any action if the checklist item is already in the given checked state
func (s *PlaybookRunServiceImpl) ModifyCheckedState(playbookRunID, userID, newState string, checklistNumber, itemNumber int) error {
	playbookRunToModify, err := s.checklistItemParamsVerify(playbookRunID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !IsValidChecklistItemIndex(playbookRunToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indicies")
	}

	itemToCheck := playbookRunToModify.Checklists[checklistNumber].Items[itemNumber]
	if newState == itemToCheck.State {
		return nil
	}

	modifyMessage := fmt.Sprintf("checked off checklist item **%v**", stripmd.Strip(itemToCheck.Title))
	if newState == ChecklistItemStateOpen {
		modifyMessage = fmt.Sprintf("unchecked checklist item **%v**", stripmd.Strip(itemToCheck.Title))
	}
	if newState == ChecklistItemStateSkipped {
		modifyMessage = fmt.Sprintf("skipped checklist item **%v**", stripmd.Strip(itemToCheck.Title))
	}
	if itemToCheck.State == ChecklistItemStateSkipped && newState == ChecklistItemStateOpen {
		modifyMessage = fmt.Sprintf("restored checklist item **%v**", stripmd.Strip(itemToCheck.Title))
	}

	itemToCheck.State = newState
	itemToCheck.StateModified = model.GetMillis()
	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber] = itemToCheck

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run, is now in inconsistent state")
	}

	s.telemetry.ModifyCheckedState(playbookRunID, userID, itemToCheck, playbookRunToModify.OwnerUserID == userID)

	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      itemToCheck.StateModified,
		EventAt:       itemToCheck.StateModified,
		EventType:     TaskStateModified,
		Summary:       modifyMessage,
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	if err = s.sendPlaybookRunToClient(playbookRunID); err != nil {
		return errors.Wrap(err, "failed to send playbook run to client")
	}

	return nil
}

// ToggleCheckedState checks or unchecks the specified checklist item
func (s *PlaybookRunServiceImpl) ToggleCheckedState(playbookRunID, userID string, checklistNumber, itemNumber int) error {
	playbookRunToModify, err := s.checklistItemParamsVerify(playbookRunID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !IsValidChecklistItemIndex(playbookRunToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indices")
	}

	isOpen := playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].State == ChecklistItemStateOpen
	newState := ChecklistItemStateOpen
	if isOpen {
		newState = ChecklistItemStateClosed
	}

	return s.ModifyCheckedState(playbookRunID, userID, newState, checklistNumber, itemNumber)
}

// SetAssignee sets the assignee for the specified checklist item
// Idempotent, will not perform any actions if the checklist item is already assigned to assigneeID
func (s *PlaybookRunServiceImpl) SetAssignee(playbookRunID, userID, assigneeID string, checklistNumber, itemNumber int) error {
	playbookRunToModify, err := s.checklistItemParamsVerify(playbookRunID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !IsValidChecklistItemIndex(playbookRunToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indices")
	}

	itemToCheck := playbookRunToModify.Checklists[checklistNumber].Items[itemNumber]
	if assigneeID == itemToCheck.AssigneeID {
		return nil
	}

	newAssigneeUserAtMention := noAssigneeName
	if assigneeID != "" {
		var newUser *model.User
		newUser, err = s.pluginAPI.User.Get(assigneeID)
		if err != nil {
			return errors.Wrapf(err, "failed to to resolve user %s", assigneeID)
		}
		newAssigneeUserAtMention = "@" + newUser.Username
	}

	oldAssigneeUserAtMention := noAssigneeName
	if itemToCheck.AssigneeID != "" {
		var oldUser *model.User
		oldUser, err = s.pluginAPI.User.Get(itemToCheck.AssigneeID)
		if err != nil {
			return errors.Wrapf(err, "failed to to resolve user %s", assigneeID)
		}
		oldAssigneeUserAtMention = "@" + oldUser.Username
	}

	itemToCheck.AssigneeID = assigneeID
	itemToCheck.AssigneeModified = model.GetMillis()
	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber] = itemToCheck

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run; it is now in an inconsistent state")
	}

	// Do we send a DM to the new assignee?
	if itemToCheck.AssigneeID != "" && itemToCheck.AssigneeID != userID {
		var subjectUser *model.User
		subjectUser, err = s.pluginAPI.User.Get(userID)
		if err != nil {
			return errors.Wrapf(err, "failed to to resolve user %s", assigneeID)
		}

		var channel *model.Channel
		channel, err = s.pluginAPI.Channel.Get(playbookRunToModify.ChannelID)
		if err != nil {
			return errors.Wrapf(err, "failed to get channel")
		}

		var team *model.Team
		team, err = s.pluginAPI.Team.Get(playbookRunToModify.TeamID)
		if err != nil {
			return errors.Wrapf(err, "failed to get team")
		}

		channelURL := fmt.Sprintf("[%s](/%s/channels/%s?telem=dm_assignedtask_clicked&forceRHSOpen)",
			channel.DisplayName, team.Name, channel.Name)
		modifyMessage := fmt.Sprintf("@%s assigned you the task **%s** (previously assigned to %s) for the run: %s   #taskassigned",
			subjectUser.Username, stripmd.Strip(itemToCheck.Title), oldAssigneeUserAtMention, channelURL)

		if err = s.poster.DM(itemToCheck.AssigneeID, &model.Post{Message: modifyMessage}); err != nil {
			return errors.Wrapf(err, "failed to send DM in SetAssignee")
		}
	}

	s.telemetry.SetAssignee(playbookRunID, userID, itemToCheck)

	modifyMessage := fmt.Sprintf("changed assignee of checklist item **%s** from **%s** to **%s**",
		stripmd.Strip(itemToCheck.Title), oldAssigneeUserAtMention, newAssigneeUserAtMention)
	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      itemToCheck.AssigneeModified,
		EventAt:       itemToCheck.AssigneeModified,
		EventType:     AssigneeChanged,
		Summary:       modifyMessage,
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	if err = s.sendPlaybookRunToClient(playbookRunID); err != nil {
		return errors.Wrap(err, "failed to send playbook run to client")
	}

	return nil
}

// RunChecklistItemSlashCommand executes the slash command associated with the specified checklist
// item.
func (s *PlaybookRunServiceImpl) RunChecklistItemSlashCommand(playbookRunID, userID string, checklistNumber, itemNumber int) (string, error) {
	playbookRun, err := s.checklistItemParamsVerify(playbookRunID, userID, checklistNumber, itemNumber)
	if err != nil {
		return "", err
	}

	if !IsValidChecklistItemIndex(playbookRun.Checklists, checklistNumber, itemNumber) {
		return "", errors.New("invalid checklist item indices")
	}

	itemToRun := playbookRun.Checklists[checklistNumber].Items[itemNumber]
	if strings.TrimSpace(itemToRun.Command) == "" {
		return "", errors.New("no slash command associated with this checklist item")
	}

	cmdResponse, err := s.pluginAPI.SlashCommand.Execute(&model.CommandArgs{
		Command:   itemToRun.Command,
		UserId:    userID,
		TeamId:    playbookRun.TeamID,
		ChannelId: playbookRun.ChannelID,
	})
	if err == pluginapi.ErrNotFound {
		trigger := strings.Fields(itemToRun.Command)[0]
		s.poster.EphemeralPost(userID, playbookRun.ChannelID, &model.Post{Message: fmt.Sprintf("Failed to find slash command **%s**", trigger)})

		return "", errors.Wrap(err, "failed to find slash command")
	} else if err != nil {
		s.poster.EphemeralPost(userID, playbookRun.ChannelID, &model.Post{Message: fmt.Sprintf("Failed to execute slash command **%s**", itemToRun.Command)})

		return "", errors.Wrap(err, "failed to run slash command")
	}

	// Record the last (successful) run time.
	playbookRun.Checklists[checklistNumber].Items[itemNumber].CommandLastRun = model.GetMillis()
	if err = s.store.UpdatePlaybookRun(playbookRun); err != nil {
		return "", errors.Wrapf(err, "failed to update playbook run recording run of slash command")
	}

	s.telemetry.RunTaskSlashCommand(playbookRunID, userID, itemToRun)

	eventTime := model.GetMillis()
	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      eventTime,
		EventAt:       eventTime,
		EventType:     RanSlashCommand,
		Summary:       fmt.Sprintf("ran the slash command: `%s`", itemToRun.Command),
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return "", errors.Wrap(err, "failed to create timeline event")
	}

	if err = s.sendPlaybookRunToClient(playbookRunID); err != nil {
		return "", errors.Wrap(err, "failed to send playbook run to client")
	}

	return cmdResponse.TriggerId, nil
}

// AddChecklist adds a checklist to the specified run
func (s *PlaybookRunServiceImpl) AddChecklist(playbookRunID, userID string, checklist Checklist) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve playbook run")
	}

	if !s.hasPermissionToModifyPlaybookRun(playbookRunToModify, userID) {
		return errors.New("user does not have permission to modify playbook run")
	}

	if !s.hasPermissionToModifyPlaybookRun(playbookRunToModify, userID) {
		return errors.New("user does not have permission to modify playbook run")
	}

	playbookRunToModify.Checklists = append([]Checklist{checklist}, playbookRunToModify.Checklists...)
	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.AddChecklist(playbookRunID, userID, checklist)

	return nil
}

// RemoveChecklist removes the specified checklist
func (s *PlaybookRunServiceImpl) RemoveChecklist(playbookRunID, userID string, checklistNumber int) error {
	playbookRunToModify, err := s.checklistParamsVerify(playbookRunID, userID, checklistNumber)
	if err != nil {
		return err
	}

	oldChecklist := playbookRunToModify.Checklists[checklistNumber]

	playbookRunToModify.Checklists = append(playbookRunToModify.Checklists[:checklistNumber], playbookRunToModify.Checklists[checklistNumber+1:]...)
	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.RemoveChecklist(playbookRunID, userID, oldChecklist)

	return nil
}

// RenameChecklist adds a checklist to the specified run
func (s *PlaybookRunServiceImpl) RenameChecklist(playbookRunID, userID string, checklistNumber int, newTitle string) error {
	playbookRunToModify, err := s.checklistParamsVerify(playbookRunID, userID, checklistNumber)
	if err != nil {
		return err
	}

	playbookRunToModify.Checklists[checklistNumber].Title = newTitle
	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.RenameChecklist(playbookRunID, userID, playbookRunToModify.Checklists[checklistNumber])

	return nil
}

// AddChecklistItem adds an item to the specified checklist
func (s *PlaybookRunServiceImpl) AddChecklistItem(playbookRunID, userID string, checklistNumber int, checklistItem ChecklistItem) error {
	playbookRunToModify, err := s.checklistParamsVerify(playbookRunID, userID, checklistNumber)
	if err != nil {
		return err
	}

	playbookRunToModify.Checklists[checklistNumber].Items = append(playbookRunToModify.Checklists[checklistNumber].Items, checklistItem)

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.AddTask(playbookRunID, userID, checklistItem)

	return nil
}

// RemoveChecklistItem removes the item at the given index from the given checklist
func (s *PlaybookRunServiceImpl) RemoveChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int) error {
	playbookRunToModify, err := s.checklistItemParamsVerify(playbookRunID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	checklistItem := playbookRunToModify.Checklists[checklistNumber].Items[itemNumber]
	playbookRunToModify.Checklists[checklistNumber].Items = append(
		playbookRunToModify.Checklists[checklistNumber].Items[:itemNumber],
		playbookRunToModify.Checklists[checklistNumber].Items[itemNumber+1:]...,
	)

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.RemoveTask(playbookRunID, userID, checklistItem)

	return nil
}

// SkipChecklistItem skips the item at the given index from the given checklist
func (s *PlaybookRunServiceImpl) SkipChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int) error {
	playbookRunToModify, err := s.checklistItemParamsVerify(playbookRunID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].LastSkipped = model.GetMillis()
	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].State = ChecklistItemStateSkipped

	checklistItem := playbookRunToModify.Checklists[checklistNumber].Items[itemNumber]

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.SkipTask(playbookRunID, userID, checklistItem)

	return nil
}

// RestoreChecklistItem restores the item at the given index from the given checklist
func (s *PlaybookRunServiceImpl) RestoreChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int) error {
	playbookRunToModify, err := s.checklistItemParamsVerify(playbookRunID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].State = ChecklistItemStateOpen

	checklistItem := playbookRunToModify.Checklists[checklistNumber].Items[itemNumber]

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.RestoreTask(playbookRunID, userID, checklistItem)

	return nil
}

// EditChecklistItem changes the title of a specified checklist item
func (s *PlaybookRunServiceImpl) EditChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int, newTitle, newCommand, newDescription string) error {
	playbookRunToModify, err := s.checklistItemParamsVerify(playbookRunID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].Title = newTitle
	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].Command = newCommand
	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].Description = newDescription
	checklistItem := playbookRunToModify.Checklists[checklistNumber].Items[itemNumber]

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.RenameTask(playbookRunID, userID, checklistItem)

	return nil
}

// MoveChecklist moves a checklist to a new location
func (s *PlaybookRunServiceImpl) MoveChecklist(playbookRunID, userID string, sourceChecklistIdx, destChecklistIdx int) error {
	playbookRunToModify, err := s.checklistParamsVerify(playbookRunID, userID, sourceChecklistIdx)
	if err != nil {
		return err
	}

	if destChecklistIdx < 0 || destChecklistIdx >= len(playbookRunToModify.Checklists) {
		return errors.New("invalid destChecklist")
	}

	// Get checklist to move
	checklistMoved := playbookRunToModify.Checklists[sourceChecklistIdx]

	// Delete checklist to move
	copy(playbookRunToModify.Checklists[sourceChecklistIdx:], playbookRunToModify.Checklists[sourceChecklistIdx+1:])
	playbookRunToModify.Checklists[len(playbookRunToModify.Checklists)-1] = Checklist{}

	// Insert checklist in new location
	copy(playbookRunToModify.Checklists[destChecklistIdx+1:], playbookRunToModify.Checklists[destChecklistIdx:])
	playbookRunToModify.Checklists[destChecklistIdx] = checklistMoved

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.MoveChecklist(playbookRunID, userID, checklistMoved)

	return nil
}

// MoveChecklistItem moves a checklist item to a new location
func (s *PlaybookRunServiceImpl) MoveChecklistItem(playbookRunID, userID string, sourceChecklistIdx, sourceItemIdx, destChecklistIdx, destItemIdx int) error {
	playbookRunToModify, err := s.checklistItemParamsVerify(playbookRunID, userID, sourceChecklistIdx, sourceItemIdx)
	if err != nil {
		return err
	}

	if destChecklistIdx < 0 || destChecklistIdx >= len(playbookRunToModify.Checklists) {
		return errors.New("invalid destChecklist")
	}

	lenDestItems := len(playbookRunToModify.Checklists[destChecklistIdx].Items)
	if (destItemIdx < 0) || (sourceChecklistIdx == destChecklistIdx && destItemIdx >= lenDestItems) || (destItemIdx > lenDestItems) {
		return errors.New("invalid destItem")
	}

	// Moved item
	sourceChecklist := playbookRunToModify.Checklists[sourceChecklistIdx].Items
	itemMoved := sourceChecklist[sourceItemIdx]

	// Delete item to move
	sourceChecklist = append(sourceChecklist[:sourceItemIdx], sourceChecklist[sourceItemIdx+1:]...)

	// Insert item in new location
	destChecklist := playbookRunToModify.Checklists[destChecklistIdx].Items
	if sourceChecklistIdx == destChecklistIdx {
		destChecklist = sourceChecklist
	}

	destChecklist = append(destChecklist, ChecklistItem{})
	copy(destChecklist[destItemIdx+1:], destChecklist[destItemIdx:])
	destChecklist[destItemIdx] = itemMoved

	// Update the playbookRunToModify checklists. If the source and destination indices
	// are the same, we only need to update the checklist to its final state (destChecklist)
	if sourceChecklistIdx == destChecklistIdx {
		playbookRunToModify.Checklists[sourceChecklistIdx].Items = destChecklist
	} else {
		playbookRunToModify.Checklists[sourceChecklistIdx].Items = sourceChecklist
		playbookRunToModify.Checklists[destChecklistIdx].Items = destChecklist
	}

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.MoveTask(playbookRunID, userID, itemMoved)

	return nil
}

// GetChecklistAutocomplete returns the list of checklist items for playbookRunID to be used in autocomplete
func (s *PlaybookRunServiceImpl) GetChecklistAutocomplete(playbookRunID string) ([]model.AutocompleteListItem, error) {
	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve playbook run")
	}

	ret := make([]model.AutocompleteListItem, 0)

	for i, checklist := range playbookRun.Checklists {
		ret = append(ret, model.AutocompleteListItem{
			Item: fmt.Sprintf("%d", i),
			Hint: fmt.Sprintf("\"%s\"", stripmd.Strip(checklist.Title)),
		})
	}

	return ret, nil
}

// GetChecklistAutocomplete returns the list of checklist items for playbookRunID to be used in autocomplete
func (s *PlaybookRunServiceImpl) GetChecklistItemAutocomplete(playbookRunID string) ([]model.AutocompleteListItem, error) {
	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve playbook run")
	}

	ret := make([]model.AutocompleteListItem, 0)

	for i, checklist := range playbookRun.Checklists {
		for j, item := range checklist.Items {
			ret = append(ret, model.AutocompleteListItem{
				Item: fmt.Sprintf("%d %d", i, j),
				Hint: fmt.Sprintf("\"%s\"", stripmd.Strip(item.Title)),
			})
		}
	}

	return ret, nil
}

// DMTodoDigestToUser gathers the list of assigned tasks, participating runs, and overdue updates,
// and DMs the message to userID. Use force = true to DM even if there are no items.
func (s *PlaybookRunServiceImpl) DMTodoDigestToUser(userID string, force bool) error {
	runsOverdue, err := s.GetOverdueUpdateRuns(userID)
	if err != nil {
		return err
	}

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return err
	}
	part1 := buildRunsOverdueMessage(runsOverdue, user.Locale)

	runsAssigned, err := s.GetRunsWithAssignedTasks(userID)
	if err != nil {
		return err
	}
	part2 := buildAssignedTaskMessageAndTotal(runsAssigned, user.Locale)

	if force {
		runsInProgress, err := s.GetParticipatingRuns(userID)
		if err != nil {
			return err
		}
		part3 := buildRunsInProgressMessage(runsInProgress, user.Locale)

		return s.poster.DM(userID, &model.Post{Message: part1 + part2 + part3})
	}

	// !force, so only return sections that have information.
	var message string
	if len(runsOverdue) != 0 {
		message += part1
	}
	if len(runsAssigned) != 0 {
		message += part2
	}
	if message == "" {
		return nil
	}
	return s.poster.DM(userID, &model.Post{Message: message})
}

// GetRunsWithAssignedTasks returns the list of runs that have tasks assigned to userID
func (s *PlaybookRunServiceImpl) GetRunsWithAssignedTasks(userID string) ([]AssignedRun, error) {
	return s.store.GetRunsWithAssignedTasks(userID)
}

// GetParticipatingRuns returns the list of active runs with userID as a participant
func (s *PlaybookRunServiceImpl) GetParticipatingRuns(userID string) ([]RunLink, error) {
	return s.store.GetParticipatingRuns(userID)
}

// GetOverdueUpdateRuns returns the list of userID's runs that have overdue updates
func (s *PlaybookRunServiceImpl) GetOverdueUpdateRuns(userID string) ([]RunLink, error) {
	return s.store.GetOverdueUpdateRuns(userID)
}

func (s *PlaybookRunServiceImpl) checklistParamsVerify(playbookRunID, userID string, checklistNumber int) (*PlaybookRun, error) {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to retrieve playbook run")
	}

	if !s.hasPermissionToModifyPlaybookRun(playbookRunToModify, userID) {
		return nil, errors.New("user does not have permission to modify playbook run")
	}

	if checklistNumber < 0 || checklistNumber >= len(playbookRunToModify.Checklists) {
		return nil, errors.New("invalid checklist number")
	}

	return playbookRunToModify, nil
}

func (s *PlaybookRunServiceImpl) checklistItemParamsVerify(playbookRunID, userID string, checklistNumber, itemNumber int) (*PlaybookRun, error) {
	playbookRunToModify, err := s.checklistParamsVerify(playbookRunID, userID, checklistNumber)
	if err != nil {
		return nil, err
	}

	if itemNumber < 0 || itemNumber >= len(playbookRunToModify.Checklists[checklistNumber].Items) {
		return nil, errors.New("invalid item number")
	}

	return playbookRunToModify, nil
}

// NukeDB removes all playbook run related data.
func (s *PlaybookRunServiceImpl) NukeDB() error {
	return s.store.NukeDB()
}

// ChangeCreationDate changes the creation date of the playbook run.
func (s *PlaybookRunServiceImpl) ChangeCreationDate(playbookRunID string, creationTimestamp time.Time) error {
	return s.store.ChangeCreationDate(playbookRunID, creationTimestamp)
}

// UserHasJoinedChannel is called when userID has joined channelID. If actorID is not blank, userID
// was invited by actorID.
func (s *PlaybookRunServiceImpl) UserHasJoinedChannel(userID, channelID, actorID string) {
	playbookRunID, err := s.store.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		// This is not a playbook run channel
		return
	}

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		s.logger.Errorf("failed to resolve user for userID '%s'; error: %s", userID, err.Error())
		return
	}

	channel, err := s.pluginAPI.Channel.Get(channelID)
	if err != nil {
		s.logger.Errorf("failed to resolve channel for channelID '%s'; error: %s", channelID, err.Error())
		return
	}

	title := fmt.Sprintf("@%s joined the channel", user.Username)

	summary := fmt.Sprintf("@%s joined ~%s", user.Username, channel.Name)
	if actorID != "" {
		actor, err2 := s.pluginAPI.User.Get(actorID)
		if err2 != nil {
			s.logger.Errorf("failed to resolve user for userID '%s'; error: %s", actorID, err2.Error())
			return
		}

		summary = fmt.Sprintf("@%s added @%s to ~%s", actor.Username, user.Username, channel.Name)
	}
	now := model.GetMillis()
	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
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

	_ = s.sendPlaybookRunToClient(playbookRunID)

	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return
	}

	if user.IsBot {
		return
	}

	if err := s.Follow(playbookRun.ID, userID); err != nil {
		s.logger.Errorf("user `%s` was not able to follow the run `%s`; error: %s", userID, playbookRun.ID, err.Error())
	}

	if playbookRun.CategoryName != "" {
		// Update sidebar category in the go-routine not to block the UserHasJoinedChannel hook
		go func() {
			// Wait for 5 seconds(a magic number) for the webapp to get the `user_added` event,
			// finish channel categorization and update it's state in redux.
			// Currently there is no way to detect when webapp finishes the job.
			// After that we can update the categories safely.
			// Technically if user starts multiple runs simultaneously we will still get the race condition
			// on category update. Since that's not realistic at the moment we are not adding the
			// distributed lock here.
			time.Sleep(5 * time.Second)

			err = s.createOrUpdatePlaybookRunSidebarCategory(userID, channelID, channel.TeamId, playbookRun.CategoryName)
			if err != nil {
				s.logger.Errorf("failed to categorize channel; error: %s", err.Error())
			}
		}()
	}
}

// createOrUpdatePlaybookRunSidebarCategory creates or updates a "Playbook Runs" sidebar category if
// it does not already exist and adds the channel within the sidebar category
func (s *PlaybookRunServiceImpl) createOrUpdatePlaybookRunSidebarCategory(userID, channelID, teamID, categoryName string) error {
	sidebar, err := s.pluginAPI.Channel.GetSidebarCategories(userID, teamID)
	if err != nil {
		return err
	}

	var categoryID string
	for _, category := range sidebar.Categories {
		if strings.EqualFold(category.DisplayName, categoryName) {
			categoryID = category.Id
			if !sliceContains(category.Channels, channelID) {
				category.Channels = append(category.Channels, channelID)
			}
			break
		}
	}

	if categoryID == "" {
		err = s.pluginAPI.Channel.CreateSidebarCategory(userID, teamID, &model.SidebarCategoryWithChannels{
			SidebarCategory: model.SidebarCategory{
				UserId:      userID,
				TeamId:      teamID,
				DisplayName: categoryName,
				Muted:       false,
			},
			Channels: []string{channelID},
		})
		if err != nil {
			return err
		}

		return nil
	}

	// remove channel from previous category
	for _, category := range sidebar.Categories {
		if strings.EqualFold(category.DisplayName, categoryName) {
			continue
		}
		for i, channel := range category.Channels {
			if channel == channelID {
				category.Channels = append(category.Channels[:i], category.Channels[i+1:]...)
				break
			}
		}
	}

	err = s.pluginAPI.Channel.UpdateSidebarCategories(userID, teamID, sidebar.Categories)
	if err != nil {
		return err
	}

	return nil
}

func sliceContains(strs []string, target string) bool {
	for _, s := range strs {
		if s == target {
			return true
		}
	}
	return false
}

// CheckAndSendMessageOnJoin checks if userID has viewed channelID and sends
// playbookRun.MessageOnJoin if it exists. Returns true if the message was sent.
func (s *PlaybookRunServiceImpl) CheckAndSendMessageOnJoin(userID, givenPlaybookRunID, channelID string) bool {
	hasViewed := s.store.HasViewedChannel(userID, channelID)

	if hasViewed {
		return true
	}

	playbookRunID, err := s.store.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		s.logger.Errorf("failed to resolve playbook run for channelID '%s'; error: %s", channelID, err.Error())
		return false
	}

	if playbookRunID != givenPlaybookRunID {
		s.logger.Errorf("endpoint's playbookRunID does not match channelID's playbookRunID")
		return false
	}

	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		s.logger.Errorf("failed to resolve playbook run for playbookRunID '%s'; error: %s", playbookRunID, err.Error())
		return false
	}

	if err = s.store.SetViewedChannel(userID, channelID); err != nil {
		// If duplicate entry, userID has viewed channelID. If not a duplicate, assume they haven't.
		return errors.Is(err, ErrDuplicateEntry)
	}

	if playbookRun.MessageOnJoin != "" {
		s.poster.EphemeralPost(userID, channelID, &model.Post{
			Message: playbookRun.MessageOnJoin,
		})
	}

	return true
}

func (s *PlaybookRunServiceImpl) UpdateDescription(playbookRunID, description string) error {
	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "unable to get playbook run")
	}

	playbookRun.Summary = description
	if err = s.store.UpdatePlaybookRun(playbookRun); err != nil {
		return errors.Wrap(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRun, playbookRun.ChannelID)

	return nil
}

// UserHasLeftChannel is called when userID has left channelID. If actorID is not blank, userID
// was removed from the channel by actorID.
func (s *PlaybookRunServiceImpl) UserHasLeftChannel(userID, channelID, actorID string) {
	playbookRunID, err := s.store.GetPlaybookRunIDForChannel(channelID)

	if err != nil {
		// This is not a playbook run channel
		return
	}

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		s.logger.Errorf("failed to resolve user for userID '%s'; error: %s", userID, err.Error())
		return
	}

	channel, err := s.pluginAPI.Channel.Get(channelID)
	if err != nil {
		s.logger.Errorf("failed to resolve channel for channelID '%s'; error: %s", channelID, err.Error())
		return
	}

	title := fmt.Sprintf("@%s left the channel", user.Username)

	summary := fmt.Sprintf("@%s left ~%s", user.Username, channel.Name)
	if actorID != "" {
		actor, err2 := s.pluginAPI.User.Get(actorID)
		if err2 != nil {
			s.logger.Errorf("failed to resolve user for userID '%s'; error: %s", actorID, err2.Error())
			return
		}

		summary = fmt.Sprintf("@%s removed @%s from ~%s", actor.Username, user.Username, channel.Name)
	}
	now := model.GetMillis()
	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
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

	_ = s.sendPlaybookRunToClient(playbookRunID)
}

func (s *PlaybookRunServiceImpl) hasPermissionToModifyPlaybookRun(playbookRun *PlaybookRun, userID string) bool {
	// PlaybookRun main channel membership is required to modify playbook run
	return s.pluginAPI.User.HasPermissionToChannel(userID, playbookRun.ChannelID, model.PermissionReadChannel)
}

func (s *PlaybookRunServiceImpl) createPlaybookRunChannel(playbookRun *PlaybookRun, header string, public bool) (*model.Channel, error) {
	channelType := model.ChannelTypePrivate
	if public {
		channelType = model.ChannelTypeOpen
	}

	channel := &model.Channel{
		TeamId:      playbookRun.TeamID,
		Type:        channelType,
		DisplayName: playbookRun.Name,
		Name:        cleanChannelName(playbookRun.Name),
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
			return nil, errors.Wrapf(err, "failed to create channel")
		}
	}

	return channel, nil
}

func (s *PlaybookRunServiceImpl) addPlaybookRunUsers(playbookRun *PlaybookRun, channel *model.Channel) error {
	if _, err := s.pluginAPI.Team.CreateMember(channel.TeamId, s.configService.GetConfiguration().BotUserID); err != nil {
		return errors.Wrapf(err, "failed to add bot to the team")
	}

	if _, err := s.pluginAPI.Channel.AddMember(channel.Id, s.configService.GetConfiguration().BotUserID); err != nil {
		return errors.Wrapf(err, "failed to add bot to the channel")
	}

	if _, err := s.pluginAPI.Channel.AddUser(channel.Id, playbookRun.ReporterUserID, s.configService.GetConfiguration().BotUserID); err != nil {
		return errors.Wrapf(err, "failed to add reporter to the channel")
	}

	if playbookRun.OwnerUserID != playbookRun.ReporterUserID {
		if _, err := s.pluginAPI.Channel.AddUser(channel.Id, playbookRun.OwnerUserID, s.configService.GetConfiguration().BotUserID); err != nil {
			return errors.Wrapf(err, "failed to add owner to channel")
		}
	}

	if _, err := s.pluginAPI.Channel.UpdateChannelMemberRoles(channel.Id, playbookRun.OwnerUserID, fmt.Sprintf("%s %s", model.ChannelAdminRoleId, model.ChannelUserRoleId)); err != nil {
		s.pluginAPI.Log.Warn("failed to promote owner to admin", "ChannelID", channel.Id, "OwnerUserID", playbookRun.OwnerUserID, "err", err.Error())
	}

	return nil
}

func (s *PlaybookRunServiceImpl) newFinishPlaybookRunDialog(outstanding int) *model.Dialog {
	message := "Are you sure you want to finish the run?"
	if outstanding == 1 {
		message = "There is **1 outstanding task**. Are you sure you want to finish the run?"
	} else if outstanding > 1 {
		message = "There are **" + strconv.Itoa(outstanding) + " outstanding tasks**. Are you sure you want to finish the run?"
	}

	return &model.Dialog{
		Title:            "Confirm finish run",
		IntroductionText: message,
		SubmitLabel:      "Finish run",
		NotifyOnCancel:   false,
	}
}

func (s *PlaybookRunServiceImpl) newPlaybookRunDialog(teamID, ownerID, postID, clientID string, playbooks []Playbook, isMobileApp bool) (*model.Dialog, error) {
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

	newPlaybookMarkdown := ""
	if !isMobileApp {
		url := getPlaybooksNewRelativeURL()
		newPlaybookMarkdown = fmt.Sprintf("[Click here](%s) to create your own playbook.", url)
	}

	introText := fmt.Sprintf("**Owner:** %v\n\n%s", getUserDisplayName(user), newPlaybookMarkdown)

	defaultPlaybookID := ""
	defaultChannelNameTemplate := ""
	if len(playbooks) == 1 {
		defaultPlaybookID = playbooks[0].ID
		defaultChannelNameTemplate = playbooks[0].ChannelNameTemplate
	}

	return &model.Dialog{
		Title:            "Run playbook",
		IntroductionText: introText,
		Elements: []model.DialogElement{
			{
				DisplayName: "Playbook",
				Name:        DialogFieldPlaybookIDKey,
				Type:        "select",
				Options:     options,
				Default:     defaultPlaybookID,
			},
			{
				DisplayName: "Run name",
				Name:        DialogFieldNameKey,
				Type:        "text",
				MinLength:   2,
				MaxLength:   64,
				Default:     defaultChannelNameTemplate,
			},
		},
		SubmitLabel:    "Start run",
		NotifyOnCancel: false,
		State:          string(state),
	}, nil
}

func (s *PlaybookRunServiceImpl) newUpdatePlaybookRunDialog(description, message string, broadcastChannelNum int, reminderTimer time.Duration) (*model.Dialog, error) {
	introductionText := "Provide an update to the stakeholders."

	if broadcastChannelNum > 0 {
		plural := ""
		if broadcastChannelNum > 1 {
			plural = "s"
		}

		introductionText += fmt.Sprintf(" This post will be broadcasted to %d channel%s.", broadcastChannelNum, plural)
	}

	reminderOptions := []*model.PostActionOptions{
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
		{
			Text:  "1Week",
			Value: "604800",
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
		Title:            "Status update",
		IntroductionText: introductionText,
		Elements: []model.DialogElement{
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
			{
				DisplayName: "Finish run",
				Name:        DialogFieldFinishRun,
				Placeholder: "Also mark the run as finished",
				Type:        "bool",
				Optional:    true,
			},
		},
		SubmitLabel:    "Update status",
		NotifyOnCancel: false,
	}, nil
}

func (s *PlaybookRunServiceImpl) newAddToTimelineDialog(playbookRuns []PlaybookRun, postID string) (*model.Dialog, error) {
	var options []*model.PostActionOptions
	for _, i := range playbookRuns {
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

	defaultPlaybookRunID, err := s.GetPlaybookRunIDForChannel(post.ChannelId)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return nil, errors.Wrapf(err, "failed to get playbookRunID for channel")
	}

	return &model.Dialog{
		Title: "Add to run timeline",
		Elements: []model.DialogElement{
			{
				DisplayName: "Playbook Run",
				Name:        DialogFieldPlaybookRunKey,
				Type:        "select",
				Options:     options,
				Default:     defaultPlaybookRunID,
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
		SubmitLabel:    "Add to run timeline",
		NotifyOnCancel: false,
		State:          string(state),
	}, nil
}

func (s *PlaybookRunServiceImpl) sendPlaybookRunToClient(playbookRunID string) error {
	playbookRunToSend, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToSend, playbookRunToSend.ChannelID)

	return nil
}

func (s *PlaybookRunServiceImpl) UpdateRetrospective(playbookRunID, updaterID, newRetrospective string) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	playbookRunToModify.Retrospective = newRetrospective

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrap(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.UpdateRetrospective(playbookRunToModify, updaterID)

	return nil
}

func (s *PlaybookRunServiceImpl) PublishRetrospective(playbookRunID, text, publisherID string) error {
	playbookRunToPublish, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	now := model.GetMillis()

	// Update the text to keep syncronized
	playbookRunToPublish.Retrospective = text
	playbookRunToPublish.RetrospectivePublishedAt = now
	playbookRunToPublish.RetrospectiveWasCanceled = false
	if err = s.store.UpdatePlaybookRun(playbookRunToPublish); err != nil {
		return errors.Wrap(err, "failed to update playbook run")
	}

	publisherUser, err := s.pluginAPI.User.Get(publisherID)
	if err != nil {
		return errors.Wrap(err, "failed to get publisher user")
	}

	retrospectiveURL := getRunRetrospectiveURL("", playbookRunToPublish.ID)
	if _, err = s.poster.PostMessage(playbookRunToPublish.ChannelID, "@channel Retrospective has been published by @%s\n[See the full retrospective](%s)\n%s", publisherUser.Username, retrospectiveURL, text); err != nil {
		return errors.Wrap(err, "failed to post to channel")
	}

	retrospectivePublishedMessage := fmt.Sprintf("@%s published the retrospective report for [%s](%s).\n%s", publisherUser.Username, playbookRunToPublish.Name, retrospectiveURL, text)
	s.dmPostToRunFollowers(&model.Post{Message: retrospectivePublishedMessage}, retroMessage, playbookRunToPublish.ID, publisherID)

	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      now,
		EventAt:       now,
		EventType:     PublishedRetrospective,
		SubjectUserID: publisherID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	if err := s.sendPlaybookRunToClient(playbookRunID); err != nil {
		s.logger.Errorf("failed send websocket event; error: %s", err.Error())
	}
	s.telemetry.PublishRetrospective(playbookRunToPublish, publisherID)

	return nil
}

func (s *PlaybookRunServiceImpl) CancelRetrospective(playbookRunID, cancelerID string) error {
	playbookRunToCancel, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	now := model.GetMillis()

	// Update the text to keep syncronized
	playbookRunToCancel.Retrospective = "No retrospective for this run."
	playbookRunToCancel.RetrospectivePublishedAt = now
	playbookRunToCancel.RetrospectiveWasCanceled = true
	if err = s.store.UpdatePlaybookRun(playbookRunToCancel); err != nil {
		return errors.Wrap(err, "failed to update playbook run")
	}

	cancelerUser, err := s.pluginAPI.User.Get(cancelerID)
	if err != nil {
		return errors.Wrap(err, "failed to get canceler user")
	}

	if _, err = s.poster.PostMessage(playbookRunToCancel.ChannelID, "@channel Retrospective has been canceled by @%s\n", cancelerUser.Username); err != nil {
		return errors.Wrap(err, "failed to post to channel")
	}

	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      now,
		EventAt:       now,
		EventType:     CanceledRetrospective,
		SubjectUserID: cancelerID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	if err := s.sendPlaybookRunToClient(playbookRunID); err != nil {
		s.logger.Errorf("failed send websocket event; error: %s", err.Error())
	}

	return nil
}

func (s *PlaybookRunServiceImpl) postMessageToThreadAndSaveRootID(playbookRunID, channelID string, post *model.Post) error {
	channelIDsToRootIDs, err := s.store.GetBroadcastChannelIDsToRootIDs(playbookRunID)
	if err != nil {
		return errors.Wrapf(err, "error when trying to retrieve ChannelIDsToRootIDs map for playbookRunId '%s'", playbookRunID)
	}

	err = s.poster.PostMessageToThread(channelIDsToRootIDs[channelID], post)
	if err != nil {
		return errors.Wrapf(err, "failed to PostMessageToThread for channelID '%s'", channelID)
	}

	newRootID := post.RootId
	if newRootID == "" {
		newRootID = post.Id
	}

	if newRootID != channelIDsToRootIDs[channelID] {
		channelIDsToRootIDs[channelID] = newRootID
		if err = s.store.SetBroadcastChannelIDsToRootID(playbookRunID, channelIDsToRootIDs); err != nil {
			return errors.Wrapf(err, "failed to SetBroadcastChannelIDsToRootID for playbookID '%s'", playbookRunID)
		}
	}

	return nil
}

// Follow method lets user follow a specific playbook run
func (s *PlaybookRunServiceImpl) Follow(playbookRunID, userID string) error {
	if err := s.store.Follow(playbookRunID, userID); err != nil {
		return errors.Wrapf(err, "user `%s` failed to follow the run `%s`", userID, playbookRunID)
	}

	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}
	s.telemetry.Follow(playbookRun, userID)

	return nil
}

// UnFollow method lets user unfollow a specific playbook run
func (s *PlaybookRunServiceImpl) Unfollow(playbookRunID, userID string) error {
	if err := s.store.Unfollow(playbookRunID, userID); err != nil {
		return errors.Wrapf(err, "user `%s` failed to unfollow the run `%s`", userID, playbookRunID)
	}

	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}
	s.telemetry.Unfollow(playbookRun, userID)

	return nil
}

// GetFollowers returns list of followers for a specific playbook run
func (s *PlaybookRunServiceImpl) GetFollowers(playbookRunID string) ([]string, error) {
	var followers []string
	var err error
	if followers, err = s.store.GetFollowers(playbookRunID); err != nil {
		return nil, errors.Wrapf(err, "failed to get followers for the run `%s`", playbookRunID)
	}

	return followers, nil
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

// Helper function to Trigger webhooks
func triggerWebhooks(s *PlaybookRunServiceImpl, webhooks []string, body []byte) {
	for i := range webhooks {
		url := webhooks[i]

		go func() {
			req, err := http.NewRequest("POST", url, bytes.NewReader(body))

			if err != nil {
				s.pluginAPI.Log.Warn("failed to create a POST request to webhook URL", "webhook URL", url, "error", err.Error())
				return
			}

			req.Header.Set("Content-Type", "application/json")

			resp, err := s.httpClient.Do(req)
			if err != nil {
				s.pluginAPI.Log.Warn("failed to send a POST request to webhook URL", "webhook URL", url, "error", err.Error())
				return
			}

			defer resp.Body.Close()

			if resp.StatusCode < 200 || resp.StatusCode > 299 {
				err := errors.Errorf("response code is %d; expected a status code in the 2xx range", resp.StatusCode)
				s.pluginAPI.Log.Warn("failed to finish a POST request to webhook URL", "webhook URL", url, "error", err.Error())
			}
		}()
	}

}

func buildAssignedTaskMessageAndTotal(runs []AssignedRun, locale string) string {
	T := i18n.GetUserTranslations(locale)
	total := 0
	for _, run := range runs {
		total += len(run.Tasks)
	}

	msg := "##### " + T("app.user.digest.tasks.heading") + "\n"

	if total == 0 {
		return msg + T("app.user.digest.tasks.zero_outstanding") + "\n"
	}

	msg += T("app.user.digest.tasks.num_outstanding", total) + "\n\n"

	for _, run := range runs {
		msg += fmt.Sprintf("[%s](/%s/channels/%s?telem=todo_assignedtask_clicked&forceRHSOpen)\n",
			run.ChannelDisplayName, run.TeamName, run.ChannelName)

		for _, task := range run.Tasks {
			msg += fmt.Sprintf("  - [ ] %s: %s\n", task.ChecklistTitle, task.Title)
		}
	}

	return msg
}

func buildRunsInProgressMessage(runs []RunLink, locale string) string {
	T := i18n.GetUserTranslations(locale)
	total := len(runs)

	msg := "\n"

	msg += "##### " + T("app.user.digest.runs_in_progress.heading") + "\n"
	if total == 0 {
		return msg + T("app.user.digest.runs_in_progress.zero_in_progress") + "\n"
	}

	msg += T("app.user.digest.runs_in_progress.num_in_progress", total) + "\n"

	for _, run := range runs {
		msg += fmt.Sprintf("- [%s](/%s/channels/%s?telem=todo_runsinprogress_clicked&forceRHSOpen)\n",
			run.ChannelDisplayName, run.TeamName, run.ChannelName)
	}

	return msg
}

func buildRunsOverdueMessage(runs []RunLink, locale string) string {
	T := i18n.GetUserTranslations(locale)
	total := len(runs)
	msg := "\n"
	msg += "##### " + T("app.user.digest.overdue_status_updates.heading") + "\n"
	if total == 0 {
		return msg + T("app.user.digest.overdue_status_updates.zero_overdue") + "\n"
	}

	msg += T("app.user.digest.overdue_status_updates.num_overdue", total) + "\n"

	for _, run := range runs {
		values := map[string]interface{}{
			"Username": run.OwnerUserName,
		}
		appended := " " + T("app.user.digest.overdue_status_updates.md_link_item_appended", values)
		msg += fmt.Sprintf("- [%s](/%s/channels/%s?telem=todo_overduestatus_clicked&forceRHSOpen)",
			run.ChannelDisplayName, run.TeamName, run.ChannelName) + appended + "\n"
	}

	return msg
}

type messageType string

const (
	creationMessage            messageType = "creation"
	finishMessage              messageType = "finish"
	overdueStatusUpdateMessage messageType = "overdue status update"
	restoreMessage             messageType = "restore"
	retroMessage               messageType = "retrospective"
	statusUpdateMessage        messageType = "status update"
)

// broadcasting to channels
func (s *PlaybookRunServiceImpl) broadcastPlaybookRunMessageToChannels(channelIDs []string, post *model.Post, mType messageType, playbookRun *PlaybookRun) {
	for _, broadcastChannelID := range channelIDs {
		post.Id = "" // Reset the ID so we avoid cloning the whole object
		if err := s.broadcastPlaybookRunMessage(broadcastChannelID, post, mType, playbookRun); err != nil {
			s.pluginAPI.Log.Warn(fmt.Sprintf("failed to broadcast run %s to channel", mType), "error", err.Error())

			if _, err = s.poster.PostMessage(playbookRun.ChannelID, fmt.Sprintf("Failed to broadcast run %s to the configured channel.", mType)); err != nil {
				s.pluginAPI.Log.Warn("failed to post failure message to the channel", "channelID", playbookRun.ChannelID, "error", err.Error())
			}
		}
	}
}

func (s *PlaybookRunServiceImpl) broadcastPlaybookRunMessage(broadcastChannelID string, post *model.Post, mType messageType, playbookRun *PlaybookRun) error {
	post.ChannelId = broadcastChannelID
	if err := IsChannelActiveInTeam(post.ChannelId, playbookRun.TeamID, s.pluginAPI); err != nil {
		return errors.Wrap(err, "announcement channel is not active")
	}

	if err := s.postMessageToThreadAndSaveRootID(playbookRun.ID, post.ChannelId, post); err != nil {
		return errors.Wrapf(err, "error posting '%s' message, for playbook '%s', to channelID '%s'", mType, playbookRun.ID, post.ChannelId)
	}

	return nil
}

// dm to users who follow

func (s *PlaybookRunServiceImpl) dmPostToRunFollowers(post *model.Post, mType messageType, playbookRunID, authorID string) {
	followers, err := s.GetFollowers(playbookRunID)
	if err != nil {
		s.pluginAPI.Log.Warn(fmt.Sprintf("failed to broadcast run %s to run followers", mType))
		return
	}

	s.dmPostToUsersWithPermission(followers, post, playbookRunID, authorID)
}

func (s *PlaybookRunServiceImpl) dmPostToAutoFollows(post *model.Post, playbookID, playbookRunID, authorID string) {
	autoFollows, err := s.playbookService.GetAutoFollows(playbookID)
	if err != nil {
		s.pluginAPI.Log.Warn("failed to broadcast run creation to auto-follows for the playbook", "PlaybookID", playbookID, "error", err)
		return
	}

	s.dmPostToUsersWithPermission(autoFollows, post, playbookRunID, authorID)
}

func (s *PlaybookRunServiceImpl) dmPostToUsersWithPermission(users []string, post *model.Post, playbookRunID, authorID string) {
	for _, user := range users {
		// Do not send update to the author
		if user == authorID {
			continue
		}

		// Check for access permissions
		if err := s.permissions.RunView(user, playbookRunID); err != nil {
			continue
		}

		post.Id = "" // Reset the ID so we avoid cloning the whole object
		post.RootId = ""
		if err := s.poster.DM(user, post); err != nil {
			s.pluginAPI.Log.Warn("failed to broadcast post to the user",
				"user", user, "error", err.Error())
		}
	}
}
