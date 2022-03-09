package app

import (
	"fmt"
	"strings"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mitchellh/mapstructure"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

const (
	playbookCreatedWSEvent  = "playbook_created"
	playbookArchivedWSEvent = "playbook_archived"
	playbookRestoredWSEvent = "playbook_restored"
)

type playbookService struct {
	store                 PlaybookStore
	poster                bot.Poster
	keywordsThreadIgnorer KeywordsThreadIgnorer
	telemetry             PlaybookTelemetry
	api                   *pluginapi.Client
	configService         config.Service
	channelActionService  ChannelActionService
}

// NewPlaybookService returns a new playbook service
func NewPlaybookService(store PlaybookStore, poster bot.Poster, telemetry PlaybookTelemetry, api *pluginapi.Client, configService config.Service, keywordsThreadIgnorer KeywordsThreadIgnorer, channelActionService ChannelActionService) PlaybookService {
	return &playbookService{
		store:                 store,
		poster:                poster,
		keywordsThreadIgnorer: keywordsThreadIgnorer,
		telemetry:             telemetry,
		api:                   api,
		configService:         configService,
		channelActionService:  channelActionService,
	}
}

func (s *playbookService) Create(playbook Playbook, userID string) (string, error) {
	playbook.CreateAt = model.GetMillis()
	playbook.UpdateAt = playbook.CreateAt

	newID, err := s.store.Create(playbook)
	if err != nil {
		return "", err
	}
	playbook.ID = newID

	s.telemetry.CreatePlaybook(playbook, userID)

	s.poster.PublishWebsocketEventToTeam(playbookCreatedWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	return newID, nil
}

func (s *playbookService) Import(playbook Playbook, userID string) (string, error) {
	newID, err := s.Create(playbook, userID)
	if err != nil {
		return "", err
	}
	playbook.ID = newID
	s.telemetry.ImportPlaybook(playbook, userID)
	return newID, nil
}

func (s *playbookService) Get(id string) (Playbook, error) {
	return s.store.Get(id)
}

func (s *playbookService) GetPlaybooks() ([]Playbook, error) {
	return s.store.GetPlaybooks()
}

func (s *playbookService) GetPlaybooksForTeam(requesterInfo RequesterInfo, teamID string, opts PlaybookFilterOptions) (GetPlaybooksResults, error) {
	return s.store.GetPlaybooksForTeam(requesterInfo, teamID, opts)
}

func (s *playbookService) Update(playbook Playbook, userID string) error {
	if playbook.DeleteAt != 0 {
		return errors.New("cannot update a playbook that is archived")
	}

	playbook.UpdateAt = model.GetMillis()

	if err := s.store.Update(playbook); err != nil {
		return err
	}

	s.telemetry.UpdatePlaybook(playbook, userID)

	return nil
}

func (s *playbookService) Archive(playbook Playbook, userID string) error {
	if playbook.ID == "" {
		return errors.New("can't archive a playbook without an ID")
	}

	if err := s.store.Archive(playbook.ID); err != nil {
		return err
	}

	s.telemetry.DeletePlaybook(playbook, userID)

	s.poster.PublishWebsocketEventToTeam(playbookArchivedWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	return nil
}

func (s *playbookService) Restore(playbook Playbook, userID string) error {
	if playbook.ID == "" {
		return errors.New("can't restore a playbook without an ID")
	}

	if playbook.DeleteAt == 0 {
		return nil
	}

	if err := s.store.Restore(playbook.ID); err != nil {
		return err
	}

	s.telemetry.RestorePlaybook(playbook, userID)

	s.poster.PublishWebsocketEventToTeam(playbookRestoredWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	return nil
}

func (s *playbookService) MessageHasBeenPosted(sessionID string, post *model.Post) {
	if post.IsSystemMessage() || s.keywordsThreadIgnorer.IsIgnored(post.RootId, post.UserId) || s.poster.IsFromPoster(post) {
		return
	}

	actions, err := s.channelActionService.GetChannelActions(post.ChannelId, GetChannelActionOptions{
		TriggerType: TriggerTypeKeywordsPosted,
		ActionType:  ActionTypePromptRunPlaybook,
	})
	if err != nil {
		s.api.Log.Error("unable to retrieve channel actions", "channelID", post.ChannelId, "triggerType", TriggerTypeKeywordsPosted)
		return
	}

	// Finish early if there are no actions to prompt running a playbook
	if len(actions) == 0 {
		return
	}

	session, err := s.api.Session.Get(sessionID)
	if err != nil {
		s.api.Log.Error("can't get session", "sessionID", sessionID, "err", err.Error())
		return
	}

	triggeredPlaybooksMap := make(map[string]Playbook)
	presentTriggers := []string{}
	for _, action := range actions {
		var payload PromptRunPlaybookFromKeywordsPayload
		if err := mapstructure.Decode(action.Payload, &payload); err != nil {
			s.api.Log.Error("unable to decode payload from action", "payload", payload, "actionType", action.ActionType, "triggerType", action.TriggerType)
			continue
		}

		suggestedPlaybook, err := s.Get(payload.PlaybookID)
		if err != nil {
			s.api.Log.Error("unable to get playbook to run action", "playbookID", payload.PlaybookID)
			continue
		}

		triggers := payload.Keywords
		for _, trigger := range triggers {
			if strings.Contains(post.Message, trigger) {
				triggeredPlaybooksMap[payload.PlaybookID] = suggestedPlaybook
				presentTriggers = append(presentTriggers, trigger)
			}
		}
	}

	if len(triggeredPlaybooksMap) == 0 {
		return
	}

	triggeredPlaybooks := []Playbook{}
	for _, playbook := range triggeredPlaybooksMap {
		triggeredPlaybooks = append(triggeredPlaybooks, playbook)
	}

	message := s.getPlaybookSuggestionsMessage(triggeredPlaybooks, presentTriggers)
	attachment := s.getPlaybookSuggestionsSlackAttachment(triggeredPlaybooks, post.Id, session.IsMobileApp())

	rootID := post.RootId
	if rootID == "" {
		rootID = post.Id
	}

	newPost := &model.Post{
		Message:   message,
		ChannelId: post.ChannelId,
	}
	model.ParseSlackAttachment(newPost, []*model.SlackAttachment{attachment})
	if err := s.poster.PostMessageToThread(rootID, newPost); err != nil {
		s.api.Log.Error("unable to post message with suggestions to run playbooks", "error", err)
	}
}

func (s *playbookService) getPlaybookSuggestionsMessage(suggestedPlaybooks []Playbook, triggers []string) string {
	message := ""
	triggerMessage := ""
	if len(triggers) == 1 {
		triggerMessage = fmt.Sprintf("`%s` is a trigger", triggers[0])
	} else {
		triggerMessage = fmt.Sprintf("`%s` are triggers", strings.Join(triggers, "`, `"))
	}

	if len(suggestedPlaybooks) == 1 {
		playbookURL := fmt.Sprintf("[%s](%s)", suggestedPlaybooks[0].Title, getPlaybookDetailsRelativeURL(suggestedPlaybooks[0].ID))
		message = fmt.Sprintf("%s for the %s playbook, would you like to run it?", triggerMessage, playbookURL)
	} else {
		message = fmt.Sprintf("%s for the multiple playbooks, would you like to run one of them?", triggerMessage)
	}

	return message
}

func (s *playbookService) getPlaybookSuggestionsSlackAttachment(playbooks []Playbook, postID string, isMobile bool) *model.SlackAttachment {
	pluginID := s.configService.GetManifest().Id

	ignoreButton := &model.PostAction{
		Id:   "ignoreKeywordsButton",
		Name: "No, ignore thread",
		Type: model.PostActionTypeButton,
		Integration: &model.PostActionIntegration{
			URL: fmt.Sprintf("/plugins/%s/api/v0/signal/keywords/ignore-thread", pluginID),
			Context: map[string]interface{}{
				"postID": postID,
			},
		},
	}

	if len(playbooks) == 1 {
		yesButton := &model.PostAction{
			Id:   "runPlaybookButton",
			Name: "Yes, run playbook",
			Type: model.PostActionTypeButton,
			Integration: &model.PostActionIntegration{
				URL: fmt.Sprintf("/plugins/%s/api/v0/signal/keywords/run-playbook", pluginID),
				Context: map[string]interface{}{
					"postID":          postID,
					"selected_option": playbooks[0].ID,
					"isMobile":        isMobile,
				},
			},
			Style: "primary",
		}

		attachment := &model.SlackAttachment{
			Actions: []*model.PostAction{yesButton, ignoreButton},
		}
		return attachment
	}

	options := []*model.PostActionOptions{}
	for _, playbook := range playbooks {
		option := &model.PostActionOptions{
			Value: playbook.ID,
			Text:  playbook.Title,
		}
		options = append(options, option)
	}
	playbookChooser := &model.PostAction{
		Id:   "playbookChooser",
		Name: "Select a playbook to run",
		Type: model.PostActionTypeSelect,
		Integration: &model.PostActionIntegration{
			URL: fmt.Sprintf("/plugins/%s/api/v0/signal/keywords/run-playbook", pluginID),
			Context: map[string]interface{}{
				"isMobile": isMobile,
				"postID":   postID,
			},
		},
		Options: options,
		Style:   "primary",
	}

	attachment := &model.SlackAttachment{
		Actions: []*model.PostAction{playbookChooser, ignoreButton},
	}
	return attachment
}

// AutoFollow method lets user to auto-follow all runs of a specific playbook
func (s *playbookService) AutoFollow(playbookID, userID string) error {
	if err := s.store.AutoFollow(playbookID, userID); err != nil {
		return errors.Wrapf(err, "user `%s` failed to auto-follow the playbook `%s`", userID, playbookID)
	}

	playbook, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}
	s.telemetry.AutoFollowPlaybook(playbook, userID)
	return nil
}

// AutoUnfollow method lets user to not auto-follow the newly created playbook runs
func (s *playbookService) AutoUnfollow(playbookID, userID string) error {
	if err := s.store.AutoUnfollow(playbookID, userID); err != nil {
		return errors.Wrapf(err, "user `%s` failed to auto-unfollow the playbook `%s`", userID, playbookID)
	}

	playbook, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}
	s.telemetry.AutoUnfollowPlaybook(playbook, userID)
	return nil
}

// GetAutoFollows returns list of users who auto-follow a playbook
func (s *playbookService) GetAutoFollows(playbookID string) ([]string, error) {
	autoFollows, err := s.store.GetAutoFollows(playbookID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get auto-follows for the playbook `%s`", playbookID)
	}

	return autoFollows, nil
}

// Duplicate duplicates a playbook
func (s *playbookService) Duplicate(playbook Playbook, userID string) (string, error) {
	newPlaybook := playbook.Clone()
	newPlaybook.ID = ""
	// Empty metric IDs if there are such. Otherwise, metrics will not be saved in the database.
	for i := range newPlaybook.Metrics {
		newPlaybook.Metrics[i].ID = ""
	}
	newPlaybook.Title = "Copy of " + playbook.Title

	return s.Create(newPlaybook, userID)
}
