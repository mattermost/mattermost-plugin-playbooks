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
	"github.com/sirupsen/logrus"
	stripmd "github.com/writeas/go-strip-markdown"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-plugin-playbooks/server/httptools"
	"github.com/mattermost/mattermost-plugin-playbooks/server/metrics"
	"github.com/mattermost/mattermost-plugin-playbooks/server/timeutils"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

const checklistItemDescriptionCharLimit = 4000

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
	scheduler       JobOnceScheduler
	telemetry       PlaybookRunTelemetry
	api             plugin.API
	playbookService PlaybookService
	actionService   ChannelActionService
	permissions     *PermissionsService
	licenseChecker  LicenseChecker
	metricsService  *metrics.Metrics
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
	configService config.Service,
	scheduler JobOnceScheduler,
	telemetry PlaybookRunTelemetry,
	api plugin.API,
	playbookService PlaybookService,
	channelActionService ChannelActionService,
	licenseChecker LicenseChecker,
	metricsService *metrics.Metrics,
) *PlaybookRunServiceImpl {
	service := &PlaybookRunServiceImpl{
		pluginAPI:       pluginAPI,
		store:           store,
		poster:          poster,
		configService:   configService,
		scheduler:       scheduler,
		telemetry:       telemetry,
		httpClient:      httptools.MakeClient(pluginAPI),
		api:             api,
		playbookService: playbookService,
		actionService:   channelActionService,
		licenseChecker:  licenseChecker,
		metricsService:  metricsService,
	}

	service.permissions = NewPermissionsService(service.playbookService, service, service.pluginAPI, service.configService, service.licenseChecker)

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

func (s *PlaybookRunServiceImpl) buildPlaybookRunCreationMessageTemplate(playbookTitle, playbookID string, playbookRun *PlaybookRun, reporter *model.User) (string, error) {
	return fmt.Sprintf(
		"##### [%s](%s%s)\n@%s ran the [%s](%s) playbook.",
		playbookRun.Name,
		GetRunDetailsRelativeURL(playbookRun.ID),
		"%s", // for the telemetry data injection
		reporter.Username,
		playbookTitle,
		GetPlaybookDetailsRelativeURL(playbookID),
	), nil
}

// PlaybookRunWebhookPayload is the body of the payload sent via playbook run webhooks.
type PlaybookRunWebhookPayload struct {
	PlaybookRun

	// ChannelURL is the absolute URL of the playbook run channel.
	ChannelURL string `json:"channel_url"`

	// DetailsURL is the absolute URL of the playbook run overview page.
	DetailsURL string `json:"details_url"`

	// Event is metadata concerning the event that triggered this webhook.
	Event PlaybookRunWebhookEvent `json:"event"`
}

type PlaybookRunWebhookEvent struct {
	// Type is the type of event emitted.
	Type timelineEventType `json:"type"`

	// At is the time when the event occurred.
	At int64 `json:"at"`

	// UserId is the user who triggered the event.
	UserID string `json:"user_id"`

	// Payload is optional, event-specific metadata.
	Payload interface{} `json:"payload"`
}

// sendWebhooksOnCreation sends a POST request to the creation webhook URL.
// It blocks until a response is received.
func (s *PlaybookRunServiceImpl) sendWebhooksOnCreation(playbookRun PlaybookRun) {
	siteURL := s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	if siteURL == nil {
		logrus.Error("cannot send webhook on creation, please set siteURL")
		return
	}

	team, err := s.pluginAPI.Team.Get(playbookRun.TeamID)
	if err != nil {
		logrus.WithError(err).Error("cannot send webhook on creation, not able to get playbookRun.TeamID")
		return
	}

	channel, err := s.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		logrus.WithError(err).Error("cannot send webhook on creation, not able to get playbookRun.ChannelID")
		return
	}

	channelURL := getChannelURL(*siteURL, team.Name, channel.Name)

	detailsURL := getRunDetailsURL(*siteURL, playbookRun.ID)

	event := PlaybookRunWebhookEvent{
		Type:   PlaybookRunCreated,
		At:     playbookRun.CreateAt,
		UserID: playbookRun.ReporterUserID,
	}

	payload := PlaybookRunWebhookPayload{
		PlaybookRun: playbookRun,
		ChannelURL:  channelURL,
		DetailsURL:  detailsURL,
		Event:       event,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		logrus.WithError(err).Error("cannot send webhook on creation, unable to marshal payload")
		return
	}

	triggerWebhooks(s, playbookRun.WebhookOnCreationURLs, body)
}

// CreatePlaybookRun creates a new playbook run. userID is the user who initiated the CreatePlaybookRun.
func (s *PlaybookRunServiceImpl) CreatePlaybookRun(playbookRun *PlaybookRun, pb *Playbook, userID string, public bool) (*PlaybookRun, error) {
	if playbookRun.DefaultOwnerID != "" {
		// Check if the user is a member of the team to which the playbook run belongs.
		if !IsMemberOfTeam(playbookRun.DefaultOwnerID, playbookRun.TeamID, s.pluginAPI) {
			logrus.WithFields(logrus.Fields{
				"user_id": playbookRun.DefaultOwnerID,
				"team_id": playbookRun.TeamID,
			}).Warn("default owner specified, but it is not a member of the playbook run's team")
		} else {
			playbookRun.OwnerUserID = playbookRun.DefaultOwnerID
		}
	}

	playbookRun.ReporterUserID = userID
	playbookRun.ID = model.NewId()

	logger := logrus.WithField("playbook_run_id", playbookRun.ID)

	var err error
	var channel *model.Channel

	if playbookRun.ChannelID == "" {
		header := "This channel was created as part of a playbook run. To view more information, select the shield icon then select *Tasks* or *Overview*."
		if pb != nil {
			overviewURL := GetRunDetailsRelativeURL(playbookRun.ID)
			playbookURL := GetPlaybookDetailsRelativeURL(pb.ID)
			header = fmt.Sprintf("This channel was created as part of the [%s](%s) playbook. Visit [the overview page](%s) for more information.",
				pb.Title, playbookURL, overviewURL)
		}

		if playbookRun.Name == "" {
			playbookRun.Name = pb.ChannelNameTemplate
		}

		channel, err = s.createPlaybookRunChannel(playbookRun, header, public)
		if err != nil {
			return nil, err
		}

		playbookRun.ChannelID = channel.Id
	} else {
		existingPlaybookRunID, err := s.GetPlaybookRunIDForChannel(playbookRun.ChannelID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return nil, err
		} else if existingPlaybookRunID != "" {
			return nil, errors.Wrapf(ErrMalformedPlaybookRun, "playbook run %s already exists for channel %s", existingPlaybookRunID, playbookRun.ChannelID)
		}

		channel, err = s.pluginAPI.Channel.Get(playbookRun.ChannelID)
		if err != nil {
			return nil, err
		}

		playbookRun.Name = channel.Name
	}

	if pb != nil && pb.MessageOnJoinEnabled && pb.MessageOnJoin != "" {
		welcomeAction := GenericChannelAction{
			GenericChannelActionWithoutPayload: GenericChannelActionWithoutPayload{
				ChannelID:   playbookRun.ChannelID,
				Enabled:     true,
				ActionType:  ActionTypeWelcomeMessage,
				TriggerType: TriggerTypeNewMemberJoins,
			},
			Payload: WelcomeMessagePayload{
				Message: pb.MessageOnJoin,
			},
		}

		if _, err := s.actionService.Create(welcomeAction); err != nil {
			logger.WithError(err).WithField("channel_id", playbookRun.ChannelID).Error("unable to create welcome action for new run in channel")
		}
	}

	if pb != nil && pb.CategorizeChannelEnabled && pb.CategoryName != "" {
		categorizeChannelAction := GenericChannelAction{
			GenericChannelActionWithoutPayload: GenericChannelActionWithoutPayload{
				ChannelID:   playbookRun.ChannelID,
				Enabled:     true,
				ActionType:  ActionTypeCategorizeChannel,
				TriggerType: TriggerTypeNewMemberJoins,
			},
			Payload: CategorizeChannelPayload{
				CategoryName: pb.CategoryName,
			},
		}

		if _, err := s.actionService.Create(categorizeChannelAction); err != nil {
			logger.WithError(err).WithField("channel_id", playbookRun.ChannelID).Error("unable to create welcome action for new run in channel")
		}
	}

	now := model.GetMillis()
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
	s.metricsService.IncrementRunsCreatedCount(1)

	// Add users to channel after creating playbook run so that all automations trigger.
	err = s.addPlaybookRunUsers(playbookRun, channel)
	if err != nil {
		return nil, errors.Wrap(err, "failed to add users to playbook run channel")
	}

	invitedUserIDs := playbookRun.InvitedUserIDs

	for _, groupID := range playbookRun.InvitedGroupIDs {
		groupLogger := logger.WithField("group_id", groupID)

		var group *model.Group
		group, err = s.pluginAPI.Group.Get(groupID)
		if err != nil {
			groupLogger.WithError(err).Error("failed to query group")
			continue
		}

		if !group.AllowReference {
			groupLogger.Warn("group that does not allow references")
			continue
		}

		perPage := 1000
		for page := 0; ; page++ {
			var users []*model.User
			users, err = s.pluginAPI.Group.GetMemberUsers(groupID, page, perPage)
			if err != nil {
				groupLogger.WithError(err).Error("failed to query group")
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

	var reporter *model.User
	reporter, err = s.pluginAPI.User.Get(playbookRun.ReporterUserID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to resolve user %s", playbookRun.ReporterUserID)
	}

	// Do we send a DM to the new owner?
	if playbookRun.OwnerUserID != playbookRun.ReporterUserID {
		startMessage := fmt.Sprintf("You have been assigned ownership of the run: [%s](%s), reported by @%s.",
			playbookRun.Name, GetRunDetailsRelativeURL(playbookRun.ID), reporter.Username)

		if err = s.poster.DM(playbookRun.OwnerUserID, &model.Post{Message: startMessage}); err != nil {
			return nil, errors.Wrapf(err, "failed to send DM on CreatePlaybookRun")
		}
	}

	if pb != nil {
		var messageTemplate string
		messageTemplate, err = s.buildPlaybookRunCreationMessageTemplate(pb.Title, pb.ID, playbookRun, reporter)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to build the playbook run creation message")
		}

		if playbookRun.StatusUpdateBroadcastChannelsEnabled {
			s.broadcastPlaybookRunMessageToChannels(playbookRun.BroadcastChannelIDs, &model.Post{Message: fmt.Sprintf(messageTemplate, "")}, creationMessage, playbookRun, logger)
			s.telemetry.RunAction(playbookRun, userID, TriggerTypeStatusUpdatePosted, ActionTypeBroadcastChannels, len(playbookRun.BroadcastChannelIDs))
		}

		// dm to users who are auto-following the playbook
		telemetryString := fmt.Sprintf("?telem_action=follower_clicked_run_started_dm&telem_run_id=%s", playbookRun.ID)
		err := s.dmPostToAutoFollows(&model.Post{Message: fmt.Sprintf(messageTemplate, telemetryString)}, pb.ID, playbookRun.ID, userID)
		if err != nil {
			logger.WithError(err).Error("failed to dm post to auto follows")
		}
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
				logger.WithError(err).WithFields(logrus.Fields{
					"playbook_run_id": playbookRun.ID,
					"auto_follow":     autoFollow,
				}).Warn("failed to follow the playbook run")
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
func (s *PlaybookRunServiceImpl) OpenCreatePlaybookRunDialog(teamID, requesterID, triggerID, postID, clientID string, playbooks []Playbook, isMobileApp bool, promptPostID string) error {

	filteredPlaybooks := make([]Playbook, 0, len(playbooks))
	for _, playbook := range playbooks {
		if err := s.permissions.RunCreate(requesterID, playbook); err == nil {
			filteredPlaybooks = append(filteredPlaybooks, playbook)
		}
	}

	dialog, err := s.newPlaybookRunDialog(teamID, requesterID, postID, clientID, filteredPlaybooks, isMobileApp, promptPostID)
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
				Type:        "textarea",
				Default:     "",
				Optional:    true,
				MaxLength:   checklistItemDescriptionCharLimit,
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

	if err = s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
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

	if err = s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
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
func (s *PlaybookRunServiceImpl) sendWebhooksOnUpdateStatus(playbookRunID string, event *PlaybookRunWebhookEvent) {
	logger := logrus.WithField("playbook_run_id", playbookRunID)

	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		logger.WithError(err).Error("cannot send webhook on update, not able to get playbookRun")
		return
	}

	siteURL := s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL
	if siteURL == nil {
		logger.Error("cannot send webhook on update, please set siteURL")
		return
	}

	team, err := s.pluginAPI.Team.Get(playbookRun.TeamID)
	if err != nil {
		logger.WithField("team_id", playbookRun.TeamID).Error("cannot send webhook on update, not able to get playbookRun.TeamID")
		return
	}

	channel, err := s.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		logger.WithField("channel_id", playbookRun.ChannelID).Error("cannot send webhook on update, not able to get playbookRun.ChannelID")
		return
	}

	channelURL := getChannelURL(*siteURL, team.Name, channel.Name)

	detailsURL := getRunDetailsURL(*siteURL, playbookRun.ID)

	payload := PlaybookRunWebhookPayload{
		PlaybookRun: *playbookRun,
		ChannelURL:  channelURL,
		DetailsURL:  detailsURL,
		Event:       *event,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		logger.WithError(err).Error("cannot send webhook on update, unable to marshal payload")
		return
	}

	triggerWebhooks(s, playbookRun.WebhookOnStatusUpdateURLs, body)
}

// UpdateStatus updates a playbook run's status.
func (s *PlaybookRunServiceImpl) UpdateStatus(playbookRunID, userID string, options StatusUpdateOptions) error {
	logger := logrus.WithField("playbook_run_id", playbookRunID)

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
		return errors.Wrap(err, "failed to write status post to store. there is now inconsistent state")
	}

	if playbookRunToModify.StatusUpdateBroadcastChannelsEnabled {
		s.broadcastPlaybookRunMessageToChannels(playbookRunToModify.BroadcastChannelIDs, originalPost.Clone(), statusUpdateMessage, playbookRunToModify, logger)
		s.telemetry.RunAction(playbookRunToModify, userID, TriggerTypeStatusUpdatePosted, ActionTypeBroadcastChannels, len(playbookRunToModify.BroadcastChannelIDs))
	}

	err = s.dmPostToRunFollowers(originalPost.Clone(), statusUpdateMessage, playbookRunID, userID)
	if err != nil {
		logger.WithError(err).Error("failed to dm post to run followers")
	}

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

	if err = s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
		return err
	}

	if playbookRunToModify.StatusUpdateBroadcastWebhooksEnabled {

		webhookEvent := PlaybookRunWebhookEvent{
			Type:    StatusUpdated,
			At:      channelPost.CreateAt,
			UserID:  userID,
			Payload: options,
		}

		s.sendWebhooksOnUpdateStatus(playbookRunID, &webhookEvent)
		s.telemetry.RunAction(playbookRunToModify, userID, TriggerTypeStatusUpdatePosted, ActionTypeBroadcastWebhooks, len(playbookRunToModify.WebhookOnStatusUpdateURLs))
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
	telemetryString := fmt.Sprintf("?telem_action=follower_clicked_run_finished_dm&telem_run_id=%s", playbookRun.ID)
	announcementMsg := fmt.Sprintf(
		"### Run finished: [%s](%s%s)\n",
		playbookRun.Name,
		GetRunDetailsRelativeURL(playbookRun.ID),
		telemetryString,
	)
	announcementMsg += fmt.Sprintf(
		"@%s just marked [%s](%s%s) as finished. Visit the link above for more information.",
		userName,
		playbookRun.Name,
		GetRunDetailsRelativeURL(playbookRun.ID),
		telemetryString,
	)

	return announcementMsg
}

func (s *PlaybookRunServiceImpl) buildStatusUpdateMessage(playbookRun *PlaybookRun, userName string, status string) string {
	telemetryString := fmt.Sprintf("?telem_run_id=%s", playbookRun.ID)
	announcementMsg := fmt.Sprintf(
		"### Run status update %s : [%s](%s%s)\n",
		status,
		playbookRun.Name,
		GetRunDetailsRelativeURL(playbookRun.ID),
		telemetryString,
	)
	announcementMsg += fmt.Sprintf(
		"@%s %s status update for [%s](%s%s). Visit the link above for more information.",
		userName,
		status,
		playbookRun.Name,
		GetRunDetailsRelativeURL(playbookRun.ID),
		telemetryString,
	)

	return announcementMsg
}

// FinishPlaybookRun changes a run's state to Finished. If run is already in Finished state, the call is a noop.
func (s *PlaybookRunServiceImpl) FinishPlaybookRun(playbookRunID, userID string) error {
	logger := logrus.WithField("playbook_run_id", playbookRunID)

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
		logger.WithError(err).WithField("channel_id", playbookRunToModify.ChannelID).Error("failed to post the status update to channel")
	} else {
		postID = post.Id
	}

	if playbookRunToModify.StatusUpdateBroadcastChannelsEnabled {
		s.broadcastPlaybookRunMessageToChannels(playbookRunToModify.BroadcastChannelIDs, &model.Post{Message: message}, finishMessage, playbookRunToModify, logger)
		s.telemetry.RunAction(playbookRunToModify, userID, TriggerTypeStatusUpdatePosted, ActionTypeBroadcastChannels, len(playbookRunToModify.BroadcastChannelIDs))
	}

	runFinishedMessage := s.buildRunFinishedMessage(playbookRunToModify, user.Username)
	err = s.dmPostToRunFollowers(&model.Post{Message: runFinishedMessage}, finishMessage, playbookRunToModify.ID, userID)
	if err != nil {
		logger.WithError(err).Error("failed to dm post to run followers")
	}

	// Remove pending reminder (if any), even if current reminder was set to "none" (0 minutes)
	s.RemoveReminder(playbookRunID)

	err = s.resetReminderTimer(playbookRunID)
	if err != nil {
		logger.WithError(err).Error("failed to reset the reminder timer when updating status to Archived")
	}

	// We are resolving the playbook run. Send the reminder to fill out the retrospective
	// Also start the recurring reminder if enabled.
	if s.licenseChecker.RetrospectiveAllowed() {
		if playbookRunToModify.RetrospectiveEnabled && playbookRunToModify.RetrospectivePublishedAt == 0 {
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
	s.metricsService.IncrementRunsFinishedCount(1)

	if err = s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
		return errors.Wrap(err, "failed to send playbook run to client")
	}

	if playbookRunToModify.StatusUpdateBroadcastWebhooksEnabled {

		webhookEvent := PlaybookRunWebhookEvent{
			Type:   RunFinished,
			At:     endAt,
			UserID: userID,
		}

		s.sendWebhooksOnUpdateStatus(playbookRunID, &webhookEvent)
		s.telemetry.RunAction(playbookRunToModify, userID, TriggerTypeStatusUpdatePosted, ActionTypeBroadcastWebhooks, len(playbookRunToModify.WebhookOnStatusUpdateURLs))
	}

	return nil
}

func (s *PlaybookRunServiceImpl) UpdatePlaybookRunStatusUpdate(playbookRunID, userID string, enable bool) error {

	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	updateAt := model.GetMillis()
	if err = s.store.UpdatePlaybookStatusUpdateEnable(playbookRunID, enable); err != nil {
		return err
	}

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return errors.Wrapf(err, "failed to to resolve user %s", userID)
	}

	statusUpdate := "enabled"
	eventType := StatusUpdateEnabled

	if enable == false {
		statusUpdate = "disabled"
		eventType = StatusUpdateDisabled
	}

	message := fmt.Sprintf("@%s %s the status update for this run", user.Username, statusUpdate)
	postID := ""
	post, err := s.poster.PostMessage(playbookRunToModify.ChannelID, message)
	if err != nil {
		s.pluginAPI.Log.Warn("failed to post the status update to channel", "ChannelID", playbookRunToModify.ChannelID)
	} else {
		postID = post.Id
	}

	if playbookRunToModify.StatusUpdateBroadcastChannelsEnabled {
		s.broadcastPlaybookRunMessageToChannels(playbookRunToModify.BroadcastChannelIDs, &model.Post{Message: message}, statusUpdateMessage, playbookRunToModify)
		s.telemetry.RunAction(playbookRunToModify, userID, TriggerTypeStatusUpdatePosted, ActionTypeBroadcastChannels, len(playbookRunToModify.BroadcastChannelIDs))
	}

	runStatusUpdateMessage := s.buildStatusUpdateMessage(playbookRunToModify, user.Username, statusUpdate)
	s.dmPostToRunFollowers(&model.Post{Message: runStatusUpdateMessage}, statusUpdateMessage, playbookRunToModify.ID, userID)

	// Remove pending reminder (if any), even if current reminder was set to "none" (0 minutes)
	s.RemoveReminder(playbookRunID)

	err = s.resetReminderTimer(playbookRunID)
	if err != nil {
		s.pluginAPI.Log.Warn("failed to reset the reminder timer when updating status to Archived", "playbook ID", playbookRunToModify.ID, "error", err)
	}

	// We are resolving the playbook run. Send the reminder to fill out the retrospective
	// Also start the recurring reminder if enabled.
	if s.licenseChecker.RetrospectiveAllowed() {
		if playbookRunToModify.RetrospectiveEnabled && playbookRunToModify.RetrospectivePublishedAt == 0 {
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
	}

	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      updateAt,
		EventAt:       updateAt,
		EventType:     eventType,
		PostID:        postID,
		SubjectUserID: userID,
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	if err = s.sendPlaybookRunToClient(playbookRunID); err != nil {
		return err
	}

	if playbookRunToModify.StatusUpdateBroadcastWebhooksEnabled {

		webhookEvent := PlaybookRunWebhookEvent{
			Type:   eventType,
			At:     updateAt,
			UserID: userID,
		}

		s.sendWebhooksOnUpdateStatus(playbookRunID, &webhookEvent)
		s.telemetry.RunAction(playbookRunToModify, userID, TriggerTypeStatusUpdatePosted, ActionTypeBroadcastWebhooks, len(playbookRunToModify.WebhookOnStatusUpdateURLs))
	}

	return nil
}

// RestorePlaybookRun reverts a run from the Finished state. If run was not in Finished state, the call is a noop.
func (s *PlaybookRunServiceImpl) RestorePlaybookRun(playbookRunID, userID string) error {
	logger := logrus.WithField("playbook_run_id", playbookRunID)

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
		logger.WithField("channel_id", playbookRunToRestore.ChannelID).Error("failed to post the status update to channel")
	} else {
		postID = post.Id
	}

	if playbookRunToRestore.StatusUpdateBroadcastChannelsEnabled {
		s.broadcastPlaybookRunMessageToChannels(playbookRunToRestore.BroadcastChannelIDs, &model.Post{Message: message}, restoreMessage, playbookRunToRestore, logger)
		s.telemetry.RunAction(playbookRunToRestore, userID, TriggerTypeStatusUpdatePosted, ActionTypeBroadcastChannels, len(playbookRunToRestore.BroadcastChannelIDs))
	}

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

	if err = s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
		return err
	}

	if playbookRunToRestore.StatusUpdateBroadcastWebhooksEnabled {

		webhookEvent := PlaybookRunWebhookEvent{
			Type:   RunRestored,
			At:     restoreAt,
			UserID: userID,
		}

		s.sendWebhooksOnUpdateStatus(playbookRunID, &webhookEvent)
		s.telemetry.RunAction(playbookRunToRestore, userID, TriggerTypeStatusUpdatePosted, ActionTypeBroadcastWebhooks, len(playbookRunToRestore.WebhookOnStatusUpdateURLs))
	}

	return nil
}

// UpdateRunActions updates status update broadcast settings
func (s *PlaybookRunServiceImpl) UpdateRunActions(playbookRunID, userID string, settings RunAction) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return err
	}

	playbookRunToModify.BroadcastChannelIDs = settings.BroadcastChannelIDs
	playbookRunToModify.StatusUpdateBroadcastChannelsEnabled = settings.StatusUpdateBroadcastChannelsEnabled
	playbookRunToModify.WebhookOnStatusUpdateURLs = settings.WebhookOnStatusUpdateURLs
	playbookRunToModify.StatusUpdateBroadcastWebhooksEnabled = settings.StatusUpdateBroadcastWebhooksEnabled

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.telemetry.UpdateRunActions(playbookRunToModify, userID)
	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)

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
			subjectUser.Username, playbookRunToModify.Name, GetRunDetailsRelativeURL(playbookRunToModify.ID),
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

	if err = s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
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

	if err = s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
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

		channelURL := fmt.Sprintf("[%s](/%s/channels/%s?telem_action=dm_assignedtask_clicked&telem_run_id=%s&forceRHSOpen)",
			channel.DisplayName, team.Name, channel.Name, playbookRunID)
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

	if err = s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
		return errors.Wrap(err, "failed to send playbook run to client")
	}

	return nil
}

// SetCommandToChecklistItem sets command to checklist item
func (s *PlaybookRunServiceImpl) SetCommandToChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int, newCommand string) error {
	playbookRunToModify, err := s.checklistItemParamsVerify(playbookRunID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !IsValidChecklistItemIndex(playbookRunToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indices")
	}

	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].Command = newCommand

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)

	return nil
}

// SetDueDate sets absolute due date timestamp for the specified checklist item
func (s *PlaybookRunServiceImpl) SetDueDate(playbookRunID, userID string, duedate int64, checklistNumber, itemNumber int) error {
	playbookRunToModify, err := s.checklistItemParamsVerify(playbookRunID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if !IsValidChecklistItemIndex(playbookRunToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indices")
	}

	itemToCheck := playbookRunToModify.Checklists[checklistNumber].Items[itemNumber]
	itemToCheck.DueDate = duedate
	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber] = itemToCheck

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run; it is now in an inconsistent state")
	}

	if err = s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
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

	if err = s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
		return "", errors.Wrap(err, "failed to send playbook run to client")
	}

	return cmdResponse.TriggerId, nil
}

func (s *PlaybookRunServiceImpl) DuplicateChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int) error {
	playbookRunToModify, err := s.checklistParamsVerify(playbookRunID, userID, checklistNumber)
	if err != nil {
		return err
	}

	if !IsValidChecklistItemIndex(playbookRunToModify.Checklists, checklistNumber, itemNumber) {
		return errors.New("invalid checklist item indicies")
	}

	checklistItem := playbookRunToModify.Checklists[checklistNumber].Items[itemNumber]
	checklistItem.ID = ""

	playbookRunToModify.Checklists[checklistNumber].Items = append(
		playbookRunToModify.Checklists[checklistNumber].Items[:itemNumber+1],
		playbookRunToModify.Checklists[checklistNumber].Items[itemNumber:]...)
	playbookRunToModify.Checklists[checklistNumber].Items[itemNumber+1] = checklistItem

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.AddTask(playbookRunID, userID, checklistItem)

	return nil
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

	playbookRunToModify.Checklists = append(playbookRunToModify.Checklists, checklist)
	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.AddChecklist(playbookRunID, userID, checklist)

	return nil
}

// DuplicateChecklist duplicates a checklist
func (s *PlaybookRunServiceImpl) DuplicateChecklist(playbookRunID, userID string, checklistNumber int) error {
	playbookRunToModify, err := s.checklistParamsVerify(playbookRunID, userID, checklistNumber)
	if err != nil {
		return err
	}

	duplicate := playbookRunToModify.Checklists[checklistNumber].Clone()
	playbookRunToModify.Checklists = append(playbookRunToModify.Checklists, duplicate)
	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.AddChecklist(playbookRunID, userID, duplicate)

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

// SkipChecklist skips the checklist
func (s *PlaybookRunServiceImpl) SkipChecklist(playbookRunID, userID string, checklistNumber int) error {
	playbookRunToModify, err := s.checklistParamsVerify(playbookRunID, userID, checklistNumber)
	if err != nil {
		return err
	}

	for itemNumber := 0; itemNumber < len(playbookRunToModify.Checklists[checklistNumber].Items); itemNumber++ {
		playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].LastSkipped = model.GetMillis()
		playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].State = ChecklistItemStateSkipped
	}

	checklist := playbookRunToModify.Checklists[checklistNumber]

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.SkipChecklist(playbookRunID, userID, checklist)

	return nil
}

// RestoreChecklist restores the skipped checklist
func (s *PlaybookRunServiceImpl) RestoreChecklist(playbookRunID, userID string, checklistNumber int) error {
	playbookRunToModify, err := s.checklistParamsVerify(playbookRunID, userID, checklistNumber)
	if err != nil {
		return err
	}

	for itemNumber := 0; itemNumber < len(playbookRunToModify.Checklists[checklistNumber].Items); itemNumber++ {
		playbookRunToModify.Checklists[checklistNumber].Items[itemNumber].State = ChecklistItemStateOpen
	}

	checklist := playbookRunToModify.Checklists[checklistNumber]

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.RestoreChecklist(playbookRunID, userID, checklist)

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

// buildTodoDigestMessage
// gathers the list of assigned tasks, participating runs, and overdue updates and builds a combined message with them
func (s *PlaybookRunServiceImpl) buildTodoDigestMessage(userID string, force bool) (*model.Post, error) {
	runsOverdue, err := s.GetOverdueUpdateRuns(userID)
	if err != nil {
		return nil, err
	}

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return nil, err
	}
	part1 := buildRunsOverdueMessage(runsOverdue, user.Locale)

	runsAssigned, err := s.GetRunsWithAssignedTasks(userID)
	if err != nil {
		return nil, err
	}

	// get user timezone
	timezone, err := timeutils.GetUserTimezone(user)
	if err != nil {
		return nil, err
	}

	part2 := buildAssignedTaskMessageSummary(runsAssigned, user.Locale, timezone, !force)

	if force {
		runsInProgress, err := s.GetParticipatingRuns(userID)
		if err != nil {
			return nil, err
		}
		part3 := buildRunsInProgressMessage(runsInProgress, user.Locale)

		return &model.Post{Message: part1 + part2 + part3}, nil
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
		return nil, nil
	}

	return &model.Post{Message: message}, nil
}

// EphemeralPostTodoDigestToUser
// builds todo digest message and sends an ephemeral post to userID, channelID. Use force = true to send post even if there are no items.
func (s *PlaybookRunServiceImpl) EphemeralPostTodoDigestToUser(userID string, channelID string, force bool) error {
	todoDigestMessage, err := s.buildTodoDigestMessage(userID, force)
	if err != nil {
		return err
	}

	if todoDigestMessage != nil {
		s.poster.EphemeralPost(userID, channelID, todoDigestMessage)
		return nil
	}

	return nil
}

// DMTodoDigestToUser
// DMs the message to userID. Use force = true to DM even if there are no items.
func (s *PlaybookRunServiceImpl) DMTodoDigestToUser(userID string, force bool) error {
	todoDigestMessage, err := s.buildTodoDigestMessage(userID, force)
	if err != nil {
		return err
	}

	if todoDigestMessage != nil {
		return s.poster.DM(userID, todoDigestMessage)
	}

	return nil
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
		logrus.WithError(err).WithField("user_id", userID).Error("failed to resolve user")
		return
	}

	channel, err := s.pluginAPI.Channel.Get(channelID)
	if err != nil {
		logrus.WithError(err).WithField("channel_id", channelID).Error("failed to resolve channel")
		return
	}

	if err := s.addChannelJoinTimelineEvent(user, channel, actorID, playbookRunID, userID); err != nil {
		logrus.WithError(err).Error("failed to add channel join timeline event")
	}

	if !user.IsBot {
		if err := s.Follow(playbookRunID, user.Id); err != nil {
			logrus.WithError(err).Errorf("user `%s` was not able to follow the run `%s`", user.Id, playbookRunID)
		}
	}

	// Automatically participate if you join the channel
	// To be removed when separating members and participants is complete.
	if err := s.AddParticipants(playbookRunID, []string{user.Id}, user.Id); err != nil {
		logrus.WithError(err).Errorf("failed to add participant that joined channel for run '%s', user '%s'", playbookRunID, user.Id)
	}

	if err := s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
		logrus.WithError(err).Errorf("failed to to send run '%s' through ws, user '%s'", playbookRunID, user.Id)
	}
}

func (s *PlaybookRunServiceImpl) addChannelJoinTimelineEvent(user *model.User, channel *model.Channel, actorID string, playbookRunID string, userID string) error {
	title := fmt.Sprintf("@%s joined the channel", user.Username)

	summary := fmt.Sprintf("@%s joined ~%s", user.Username, channel.Name)
	if actorID != "" {
		actor, err := s.pluginAPI.User.Get(actorID)
		if err != nil {
			return errors.Wrapf(err, "failed to resolve user for userID '%s'", actorID)
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

	if _, err := s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	return nil
}

func (s *PlaybookRunServiceImpl) UpdateDescription(playbookRunID, description string) error {
	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "unable to get playbook run")
	}

	playbookRun.Summary = description
	playbookRun.SummaryModifiedAt = model.GetMillis()
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
		logrus.WithError(err).WithField("user_id", userID).Error("failed to resolve user")
		return
	}

	channel, err := s.pluginAPI.Channel.Get(channelID)
	if err != nil {
		logrus.WithError(err).WithField("channel_id", channelID).Error("failed to resolve channel")
		return
	}

	if err := s.addChannelLeaveTimelineEvent(user, channel, actorID, playbookRunID, userID); err != nil {
		logrus.WithError(err).Error("failed to add channel leave timeline event")
	}

	// Automatically leave run if you leave the channel
	// To be removed when separating members and participants is complete.
	if err := s.RemoveParticipants(playbookRunID, []string{user.Id}); err != nil {
		logrus.WithError(err).Errorf("faied to remove participant that left channel for run '%s', user '%s'", playbookRunID, user.Id)
	}

	if err := s.Unfollow(playbookRunID, user.Id); err != nil {
		logrus.WithError(err).Errorf("failed to make participant to unfollow the run '%s', user '%s'", playbookRunID, user.Id)
	}

	if err := s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
		logrus.WithError(err).Errorf("failed to send the run '%s' through ws, user '%s'", playbookRunID, user.Id)
	}
}

func (s *PlaybookRunServiceImpl) addChannelLeaveTimelineEvent(user *model.User, channel *model.Channel, actorID string, playbookRunID string, userID string) error {
	title := fmt.Sprintf("@%s left the channel", user.Username)

	summary := fmt.Sprintf("@%s left ~%s", user.Username, channel.Name)
	if actorID != "" {
		actor, err := s.pluginAPI.User.Get(actorID)
		if err != nil {
			return errors.Wrapf(err, "failed to resolve user for userID '%s'", actorID)
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

	if _, err := s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}
	return nil
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
				appErr.Id == "model.channel.is_valid.1_or_more.app_error" {
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

	_, userRoleID, adminRoleID := s.GetSchemeRolesForChannel(channel)
	if _, err := s.pluginAPI.Channel.UpdateChannelMemberRoles(channel.Id, playbookRun.OwnerUserID, fmt.Sprintf("%s %s", userRoleID, adminRoleID)); err != nil {
		logrus.WithError(err).WithFields(logrus.Fields{
			"channel_id":    channel.Id,
			"owner_user_id": playbookRun.OwnerUserID,
		}).Warn("failed to promote owner to admin")
	}

	return nil
}

func (s *PlaybookRunServiceImpl) GetSchemeRolesForChannel(channel *model.Channel) (string, string, string) {
	// get channel roles
	if guestRole, userRole, adminRole, err := s.store.GetSchemeRolesForChannel(channel.Id); err == nil {
		return guestRole, userRole, adminRole
	}

	// get team roles if channel roles are not available
	if guestRole, userRole, adminRole, err := s.store.GetSchemeRolesForTeam(channel.TeamId); err == nil {
		return guestRole, userRole, adminRole
	}

	// return default roles
	return model.ChannelGuestRoleId, model.ChannelUserRoleId, model.ChannelAdminRoleId
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

func (s *PlaybookRunServiceImpl) newPlaybookRunDialog(teamID, ownerID, postID, clientID string, playbooks []Playbook, isMobileApp bool, promptPostID string) (*model.Dialog, error) {
	user, err := s.pluginAPI.User.Get(ownerID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to fetch owner user")
	}

	state, err := json.Marshal(DialogState{
		PostID:       postID,
		ClientID:     clientID,
		PromptPostID: promptPostID,
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
				MinLength:   1,
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

// sendPlaybookRunToClient send Run to users via websocket
// Two cases will be handled:
// - one message as broadcast channel-id based
// - additional messages user-id based (one per userid passed)
func (s *PlaybookRunServiceImpl) sendPlaybookRunToClient(playbookRunID string, userIDs []string) error {
	playbookRunToSend, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToSend, playbookRunToSend.ChannelID)

	// Additional explicit users (not channelid based)
	// Temporary workaround until we have GQL real time mechanism
	for _, userID := range userIDs {
		s.poster.PublishWebsocketEventToUser(playbookRunUpdatedWSEvent, playbookRunToSend, userID)
	}

	return nil
}

func (s *PlaybookRunServiceImpl) UpdateRetrospective(playbookRunID, updaterID string, newRetrospective RetrospectiveUpdate) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	playbookRunToModify.Retrospective = newRetrospective.Text
	playbookRunToModify.MetricsData = newRetrospective.Metrics

	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrap(err, "failed to update playbook run")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)
	s.telemetry.UpdateRetrospective(playbookRunToModify, updaterID)

	return nil
}

func (s *PlaybookRunServiceImpl) PublishRetrospective(playbookRunID, publisherID string, retrospective RetrospectiveUpdate) error {
	logger := logrus.WithField("playbook_run_id", playbookRunID)

	playbookRunToPublish, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	now := model.GetMillis()

	// Update the text to keep syncronized
	playbookRunToPublish.Retrospective = retrospective.Text
	playbookRunToPublish.MetricsData = retrospective.Metrics
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
	post, err := s.buildRetrospectivePost(playbookRunToPublish, publisherUser, retrospectiveURL)
	if err != nil {
		return err
	}

	if err = s.poster.Post(post); err != nil {
		return errors.Wrap(err, "failed to post to channel")
	}

	telemetryString := fmt.Sprintf("?telem_action=follower_clicked_retrospective_dm&telem_run_id=%s", playbookRunToPublish.ID)
	retrospectivePublishedMessage := fmt.Sprintf("@%s published the retrospective report for [%s](%s%s).\n%s", publisherUser.Username, playbookRunToPublish.Name, retrospectiveURL, telemetryString, retrospective.Text)
	err = s.dmPostToRunFollowers(&model.Post{Message: retrospectivePublishedMessage}, retroMessage, playbookRunToPublish.ID, publisherID)
	if err != nil {
		logger.WithError(err).Error("failed to dm post to run followers")
	}

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

	if err := s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
		logrus.WithError(err).Error("failed to send websocket event")
	}
	s.telemetry.PublishRetrospective(playbookRunToPublish, publisherID)

	return nil
}

func (s *PlaybookRunServiceImpl) buildRetrospectivePost(playbookRunToPublish *PlaybookRun, publisherUser *model.User, retrospectiveURL string) (*model.Post, error) {
	props := map[string]interface{}{
		"metricsData":       "null",
		"metricsConfigs":    "null",
		"retrospectiveText": playbookRunToPublish.Retrospective,
	}

	// If run has metrics data, get playbooks metrics configs and include them in custom post
	if len(playbookRunToPublish.MetricsData) > 0 {
		playbook, err := s.playbookService.Get(playbookRunToPublish.PlaybookID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get playbook")
		}

		metricsConfigs, err := json.Marshal(playbook.Metrics)
		if err != nil {
			return nil, errors.Wrap(err, "unable to marshal metrics configs")
		}

		metricsData, err := json.Marshal(playbookRunToPublish.MetricsData)
		if err != nil {
			return nil, errors.Wrap(err, "cannot post retro, unable to marshal metrics data")
		}
		props["metricsData"] = string(metricsData)
		props["metricsConfigs"] = string(metricsConfigs)
	}

	return &model.Post{
		Message:   fmt.Sprintf("@channel Retrospective has been published by @%s\n[See the full retrospective](%s)\n", publisherUser.Username, retrospectiveURL),
		Type:      "custom_retro",
		ChannelId: playbookRunToPublish.ChannelID,
		Props:     props,
	}, nil
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

	if err := s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
		logrus.WithError(err).Error("failed send websocket event")
	}

	return nil
}

// RequestJoinChannel posts a channel-join request message in the run's channel
func (s *PlaybookRunServiceImpl) RequestJoinChannel(playbookRunID, requesterID string) error {
	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	// avoid sending request if user is already a member of the channel
	if s.pluginAPI.User.HasPermissionToChannel(requesterID, playbookRun.ChannelID, model.PermissionReadChannel) {
		return fmt.Errorf("user %s is already a member of the channel %s", requesterID, playbookRunID)
	}

	requesterUser, err := s.pluginAPI.User.Get(requesterID)
	if err != nil {
		return errors.Wrap(err, "failed to get requester user")
	}

	T := i18n.GetUserTranslations(requesterUser.Locale)
	data := map[string]interface{}{
		"Name": requesterUser.Username,
	}

	_, err = s.poster.PostMessage(playbookRun.ChannelID, T("app.user.run.request_join_channel", data))
	if err != nil {
		return errors.Wrap(err, "failed to post to channel")
	}
	return nil
}

// RequestUpdate posts a status update request message in the run's channel
func (s *PlaybookRunServiceImpl) RequestUpdate(playbookRunID, requesterID string) error {
	logger := logrus.WithField("playbook_run_id", playbookRunID)

	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	requesterUser, err := s.pluginAPI.User.Get(requesterID)
	if err != nil {
		return errors.Wrap(err, "failed to get requester user")
	}

	T := i18n.GetUserTranslations(requesterUser.Locale)
	data := map[string]interface{}{
		"Name": requesterUser.Username,
	}

	post, err := s.poster.PostMessage(playbookRun.ChannelID, T("app.user.run.request_update", data))
	if err != nil {
		return errors.Wrap(err, "failed to post to channel")
	}

	// create timeline event
	event := &TimelineEvent{
		PlaybookRunID: playbookRunID,
		CreateAt:      post.CreateAt,
		EventAt:       post.CreateAt,
		EventType:     StatusUpdateRequested,
		PostID:        post.Id,
		SubjectUserID: requesterID,
		CreatorUserID: requesterID,
		Summary:       fmt.Sprintf("@%s requested a status update", requesterUser.Username),
	}

	if _, err = s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrap(err, "failed to create timeline event")
	}

	// send updated run through websocket
	if err := s.sendPlaybookRunToClient(playbookRunID, []string{}); err != nil {
		logger.WithError(err).Warn("failed send websocket event")
	}

	return nil
}

// Leave removes user from the run's participants
func (s *PlaybookRunServiceImpl) RemoveParticipants(playbookRunID string, userIDs []string) error {
	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	// Check if any user is the owner
	for _, userID := range userIDs {
		if playbookRun.OwnerUserID == userID {
			return errors.New("owner user can't leave the run")
		}
	}

	if err := s.store.RemoveParticipants(playbookRunID, userIDs); err != nil {
		return errors.Wrapf(err, "users `%+v` failed to remove participation in run `%s`", userIDs, playbookRunID)
	}

	for _, userID := range userIDs {
		s.leaveActions(playbookRun, userID)
	}

	if err := s.sendPlaybookRunToClient(playbookRunID, userIDs); err != nil {
		logrus.WithError(err).Error("failed send websocket event")
	}

	return nil
}

func (s *PlaybookRunServiceImpl) leaveActions(playbookRun *PlaybookRun, userID string) {
	// Don't do anything if the user not a channel member
	member, _ := s.pluginAPI.Channel.GetMember(playbookRun.ChannelID, userID)
	if member == nil {
		return
	}

	// To be added to the UI as an optional action
	if err := s.api.DeleteChannelMember(playbookRun.ChannelID, userID); err != nil {
		logrus.WithError(err).Errorf("failed to remove user from linked channel, userID '%s'", userID)
	}
}

func (s *PlaybookRunServiceImpl) AddParticipants(playbookRunID string, userIDs []string, requesterUserID string) error {
	if err := s.store.AddParticipants(playbookRunID, userIDs); err != nil {
		return errors.Wrapf(err, "users `%+v` failed to participate the run `%s`", userIDs, playbookRunID)
	}

	// TO be done, once actions are implemented
	// return if action is disabled

	playbookRun, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}

	channel, err := s.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		logrus.WithError(err).Errorf("failed to get channel, channelID '%s'", playbookRun.ChannelID)
	}

	requesterUser, err := s.pluginAPI.User.Get(requesterUserID)
	if err != nil {
		return errors.Wrap(err, "failed to get requester user")
	}

	for _, userID := range userIDs {
		user := requesterUser
		if userID != requesterUserID {
			user, err = s.pluginAPI.User.Get(userID)
			if err != nil {
				return errors.Wrap(err, "failed to get requester user")
			}
		}
		s.participateActions(playbookRun, channel, user, requesterUser)
	}

	if err := s.sendPlaybookRunToClient(playbookRunID, userIDs); err != nil {
		logrus.WithError(err).Error("failed send websocket event")
	}

	return nil
}

func (s *PlaybookRunServiceImpl) participateActions(playbookRun *PlaybookRun, channel *model.Channel, user *model.User, requesterUser *model.User) {
	// Don't do anything if the user is a channel member
	member, _ := s.pluginAPI.Channel.GetMember(playbookRun.ChannelID, user.Id)
	if member != nil {
		return
	}

	// Send message to channel if one the following scenarios happens:
	// - channel is private and is a "participate" action )
	// - channel is private and the user adding a new participant has no access to it
	requesterHasAccessToChannel := s.permissions.ChannelActionView(requesterUser.Id, playbookRun.ChannelID) == nil
	isParticipateFlow := requesterUser.Id == user.Id
	if channel.Type == "P" && (isParticipateFlow || !requesterHasAccessToChannel) {
		T := i18n.GetUserTranslations(requesterUser.Locale)
		data := map[string]interface{}{
			"Name":          user.Username,
			"RequesterName": requesterUser.Username,
		}
		msg := T("app.user.run.joined_run_channel_private_add_participant", data)
		if isParticipateFlow {
			msg = T("app.user.run.joined_run_channel_private_participate", data)
		}

		if _, err := s.poster.PostMessage(playbookRun.ChannelID, msg); err != nil {
			logrus.WithError(err).Errorf("participateActions: failed to send message to private channel, userID '%s'", user.Id)
		}
		return
	}

	// Regular add channel member otherwise
	if _, err := s.api.AddChannelMember(playbookRun.ChannelID, user.Id); err != nil {
		logrus.WithError(err).Errorf("participateActions: failed to add user to linked channel, userID '%s'", user.Id)
	}
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
				logrus.WithError(err).WithField("webhook_url", url).Error("failed to create a POST request to webhook URL")
				return
			}

			req.Header.Set("Content-Type", "application/json")

			resp, err := s.httpClient.Do(req)
			if err != nil {
				logrus.WithError(err).WithField("webhook_url", url).Warn("failed to send a POST request to webhook URL")
				return
			}

			defer resp.Body.Close()

			if resp.StatusCode < 200 || resp.StatusCode > 299 {
				err := errors.Errorf("response code is %d; expected a status code in the 2xx range", resp.StatusCode)
				logrus.WithError(err).WithField("webhook_url", url).Warn("failed to finish a POST request to webhook URL")
			}
		}()
	}

}

func buildAssignedTaskMessageSummary(runs []AssignedRun, locale string, timezone *time.Location, onlyDueUntilToday bool) string {
	var msg strings.Builder

	T := i18n.GetUserTranslations(locale)
	total := 0
	for _, run := range runs {
		total += len(run.Tasks)
	}

	msg.WriteString("##### ")
	msg.WriteString(T("app.user.digest.tasks.heading"))
	msg.WriteString("\n")

	if total == 0 {
		msg.WriteString(T("app.user.digest.tasks.zero_assigned"))
		msg.WriteString("\n")
		return msg.String()
	}

	var tasksNoDueDate, tasksDoAfterToday int
	currentTime := timeutils.GetTimeForMillis(model.GetMillis()).In(timezone)
	yesterday := currentTime.Add(-24 * time.Hour)

	var runsInfo strings.Builder
	for _, run := range runs {
		var tasksInfo strings.Builder

		for _, task := range run.Tasks {
			// no due date
			if task.ChecklistItem.DueDate == 0 {
				tasksInfo.WriteString(fmt.Sprintf("  - [ ] %s: %s\n", task.ChecklistTitle, task.Title))
				tasksNoDueDate++
				continue
			}
			dueTime := time.Unix(task.ChecklistItem.DueDate/1000, 0).In(timezone)
			// due today
			if timeutils.IsSameDay(dueTime, currentTime) {
				tasksInfo.WriteString(fmt.Sprintf("  - [ ] %s: %s **`%s`**\n", task.ChecklistTitle, task.Title, T("app.user.digest.tasks.due_today")))
				continue
			}
			// due yesterday
			if timeutils.IsSameDay(dueTime, yesterday) {
				tasksInfo.WriteString(fmt.Sprintf("  - [ ] %s: %s **`%s`**\n", task.ChecklistTitle, task.Title, T("app.user.digest.tasks.due_yesterday")))
				continue
			}
			// due before yesterday
			if dueTime.Before(currentTime) {
				days := timeutils.GetDaysDiff(dueTime, currentTime)
				tasksInfo.WriteString(fmt.Sprintf("  - [ ] %s: %s **`%s`**\n", task.ChecklistTitle, task.Title, T("app.user.digest.tasks.due_x_days_ago", days)))
				continue
			}
			// due after today
			if !onlyDueUntilToday {
				days := timeutils.GetDaysDiff(currentTime, dueTime)
				tasksInfo.WriteString(fmt.Sprintf("  - [ ] %s: %s `%s`\n", task.ChecklistTitle, task.Title, T("app.user.digest.tasks.due_in_x_days", days)))
			}
			tasksDoAfterToday++
		}

		// omit run's title if tasks info is empty
		if tasksInfo.String() != "" {
			runsInfo.WriteString(fmt.Sprintf("[%s](/%s/channels/%s?telem_action=todo_assignedtask_clicked&telem_run_id=%s&forceRHSOpen)\n",
				run.ChannelDisplayName, run.TeamName, run.ChannelName, run.PlaybookRunID))
			runsInfo.WriteString(tasksInfo.String())
		}
	}

	// if there are only tasks that are due after today and we need to show only tasks due now, skip a message
	if onlyDueUntilToday && tasksDoAfterToday == total {
		return ""
	}

	// add title
	if onlyDueUntilToday {
		msg.WriteString(T("app.user.digest.tasks.num_assigned_due_until_today", total-tasksDoAfterToday))
	} else {
		msg.WriteString(T("app.user.digest.tasks.num_assigned", total))
	}

	// add info about tasks
	msg.WriteString("\n\n")
	msg.WriteString(runsInfo.String())

	// add summary info for tasks without a due date or due date after today
	if tasksDoAfterToday > 0 && onlyDueUntilToday {
		msg.WriteString(":information_source: ")
		msg.WriteString(T("app.user.digest.tasks.due_after_today", tasksDoAfterToday))
		msg.WriteString(" ")
		msg.WriteString(T("app.user.digest.tasks.all_tasks_command"))
	}
	return msg.String()
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
		msg += fmt.Sprintf("- [%s](/%s/channels/%s?telem_action=todo_runsinprogress_clicked&telem_run_id=%s&forceRHSOpen)\n",
			run.ChannelDisplayName, run.TeamName, run.ChannelName, run.PlaybookRunID)
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
		msg += fmt.Sprintf("- [%s](/%s/channels/%s?telem_action=todo_overduestatus_clicked&telem_run_id=%s&forceRHSOpen)\n",
			run.ChannelDisplayName, run.TeamName, run.ChannelName, run.PlaybookRunID)
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
	statusUpdateEnabled        messageType = "status update enabled"
	statusUpdateDisabled       messageType = "status update disabled"
)

// broadcasting to channels
func (s *PlaybookRunServiceImpl) broadcastPlaybookRunMessageToChannels(channelIDs []string, post *model.Post, mType messageType, playbookRun *PlaybookRun, logger logrus.FieldLogger) {
	logger = logger.WithField("message_type", mType)

	for _, broadcastChannelID := range channelIDs {
		post.Id = "" // Reset the ID so we avoid cloning the whole object
		if err := s.broadcastPlaybookRunMessage(broadcastChannelID, post, mType, playbookRun); err != nil {
			logger.WithError(err).Error("failed to broadcast run to channel")

			if _, err = s.poster.PostMessage(playbookRun.ChannelID, fmt.Sprintf("Failed to broadcast run %s to the configured channel.", mType)); err != nil {
				logger.WithError(err).WithField("channel_id", playbookRun.ChannelID).Error("failed to post failure message to the channel")
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

func (s *PlaybookRunServiceImpl) dmPostToRunFollowers(post *model.Post, mType messageType, playbookRunID, authorID string) error {
	followers, err := s.GetFollowers(playbookRunID)
	if err != nil {
		return errors.Wrap(err, "failed to get followers")
	}

	s.dmPostToUsersWithPermission(followers, post, playbookRunID, authorID)
	return nil
}

func (s *PlaybookRunServiceImpl) dmPostToAutoFollows(post *model.Post, playbookID, playbookRunID, authorID string) error {
	autoFollows, err := s.playbookService.GetAutoFollows(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to get auto follows")
	}

	s.dmPostToUsersWithPermission(autoFollows, post, playbookRunID, authorID)
	return nil
}

func (s *PlaybookRunServiceImpl) dmPostToUsersWithPermission(users []string, post *model.Post, playbookRunID, authorID string) {
	logger := logrus.WithFields(logrus.Fields{"playbook_run_id": playbookRunID})

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
			logger.WithError(err).WithField("user_id", user).Warn("failed to broadcast post to the user")
		}
	}
}
