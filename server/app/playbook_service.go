package app

import (
	"fmt"
	"strings"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-server/v6/model"
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
	keywordsCacher        KeywordsCacher
	keywordsThreadIgnorer KeywordsThreadIgnorer
	telemetry             PlaybookTelemetry
	api                   *pluginapi.Client
	configService         config.Service
}

// NewPlaybookService returns a new playbook service
func NewPlaybookService(store PlaybookStore, poster bot.Poster, telemetry PlaybookTelemetry, api *pluginapi.Client, configService config.Service, keywordsThreadIgnorer KeywordsThreadIgnorer) PlaybookService {
	return &playbookService{
		store:                 store,
		poster:                poster,
		keywordsCacher:        NewPlaybookKeywordsCacher(store, api.Log),
		keywordsThreadIgnorer: keywordsThreadIgnorer,
		telemetry:             telemetry,
		api:                   api,
		configService:         configService,
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
	if post.IsSystemMessage() || s.keywordsThreadIgnorer.IsIgnored(post.RootId, post.UserId) {
		return
	}

	channel, channelErr := s.api.Channel.Get(post.ChannelId)
	if channelErr != nil {
		s.api.Log.Error("can't get channel", "err", channelErr.Error())
		return
	}
	teamID := channel.TeamId

	suggestedPlaybooks, triggers := s.GetSuggestedPlaybooks(teamID, post.UserId, post.Message)
	if len(suggestedPlaybooks) == 0 {
		return
	}

	session, err := s.api.Session.Get(sessionID)
	if err != nil {
		s.api.Log.Error("can't get session", "sessionID", sessionID, "err", err.Error())
		return
	}

	message := s.getPlaybookSuggestionsMessage(suggestedPlaybooks, triggers)
	attachment := s.getPlaybookSuggestionsSlackAttachment(suggestedPlaybooks, post.Id, session.IsMobileApp())

	rootID := post.RootId
	if rootID == "" {
		rootID = post.Id
	}
	s.poster.EphemeralPostWithAttachments(post.UserId, post.ChannelId, rootID, []*model.SlackAttachment{attachment}, message)
}

func (s *playbookService) getPlaybookSuggestionsMessage(suggestedPlaybooks []*CachedPlaybook, triggers []string) string {
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

func (s *playbookService) getPlaybookSuggestionsSlackAttachment(playbooks []*CachedPlaybook, postID string, isMobile bool) *model.SlackAttachment {
	pluginID := s.configService.GetManifest().Id

	ignoreButton := &model.PostAction{
		Id:   "ignoreKeywordsButton",
		Name: "No, ignore",
		Type: model.PostActionTypeButton,
		Integration: &model.PostActionIntegration{
			URL: fmt.Sprintf("/plugins/%s/api/v0/signal/keywords/ignore-thread", pluginID),
			Context: map[string]interface{}{
				"postID": postID,
			},
		},
		Style: "primary",
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
			Text:    fmt.Sprintf("You can configure the trigger and actions for the playbook [here](%s)", getActionsTabRelativeURL(playbooks[0].ID)),
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
		Text:    fmt.Sprintf("You can access these playbooks to configure their triggers and actions [here](%s)", PlaybooksPath),
	}
	return attachment
}

type cachedPlaybookTriggers struct {
	playbook *CachedPlaybook
	triggers []string
}

func (s *playbookService) GetSuggestedPlaybooks(teamID, userID, message string) ([]*CachedPlaybook, []string) {
	triggeredPlaybooks := []cachedPlaybookTriggers{}

	playbooks := s.keywordsCacher.GetPlaybooks()
	for i := range playbooks {
		if playbooks[i].TeamID != teamID {
			continue
		}

		triggers := getPlaybookTriggersForAMessage(playbooks[i], message)
		if len(triggers) == 0 {
			continue
		}

		triggeredPlaybooks = append(triggeredPlaybooks, cachedPlaybookTriggers{
			playbook: playbooks[i],
			triggers: triggers,
		})
	}

	// return early if no triggered playbooks
	if len(triggeredPlaybooks) == 0 {
		return nil, nil
	}

	return s.getPlaybooksAndTriggersByAccess(triggeredPlaybooks, userID, teamID)
}

// filters out playbooks user has no access to and returns playbooks with
func (s *playbookService) getPlaybooksAndTriggersByAccess(triggeredPlaybooks []cachedPlaybookTriggers, userID, teamID string) ([]*CachedPlaybook, []string) {
	resultPlaybooks := []*CachedPlaybook{}
	resultTriggers := []string{}

	playbookIDs, err := s.store.GetPlaybookIDsForUser(userID, teamID)
	if err != nil {
		s.api.Log.Error("can't get playbookIDs", "userID", userID, "err", err.Error())
		return nil, nil
	}

	playbookIDsMap := sliceToMap(playbookIDs)

	for i := range triggeredPlaybooks {
		if ok := playbookIDsMap[triggeredPlaybooks[i].playbook.ID]; ok {
			resultPlaybooks = append(resultPlaybooks, triggeredPlaybooks[i].playbook)
			resultTriggers = append(resultTriggers, triggeredPlaybooks[i].triggers...)
		}
	}

	return resultPlaybooks, removeDuplicates(resultTriggers)
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

// IsAutoFollowing returns weather user is auto-following a playbook
func (s *playbookService) IsAutoFollowing(playbookID, userID string) (bool, error) {
	isAutoFollowing, err := s.store.IsAutoFollowing(playbookID, userID)
	if err != nil {
		return false, errors.Wrapf(err, "failed to get if user follows for the playbook `%s`", playbookID)
	}

	return isAutoFollowing, nil
}

// Duplicate duplicates a playbook
func (s *playbookService) Duplicate(playbook Playbook, userID string) (string, error) {
	newPlaybook := playbook.Clone()
	newPlaybook.ID = ""
	newPlaybook.Title = "Copy of " + playbook.Title

	return s.Create(newPlaybook, userID)
}

func getPlaybookTriggersForAMessage(playbook *CachedPlaybook, message string) []string {
	triggers := []string{}
	for _, keyword := range playbook.SignalAnyKeywords {
		if strings.Contains(message, keyword) {
			triggers = append(triggers, keyword)
		}
	}
	return removeDuplicates(triggers)
}

func sliceToMap(strs []string) map[string]bool {
	res := make(map[string]bool, len(strs))
	for _, s := range strs {
		res[s] = true
	}
	return res
}

func removeDuplicates(a []string) []string {
	items := make(map[string]bool)
	for _, item := range a {
		items[item] = true
	}
	res := make([]string, 0, len(items))
	for item := range items {
		res = append(res, item)
	}
	return res
}
