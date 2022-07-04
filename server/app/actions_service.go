package app

import (
	"fmt"
	"strings"
	"sync"
	"time"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mitchellh/mapstructure"
	"github.com/pkg/errors"
)

type PlaybookGetter interface {
	Get(id string) (Playbook, error)
}

type channelActionServiceImpl struct {
	logger                bot.Logger
	poster                bot.Poster
	configService         config.Service
	store                 ChannelActionStore
	api                   *pluginapi.Client
	playbookGetter        PlaybookGetter
	keywordsThreadIgnorer KeywordsThreadIgnorer
	telemetry             ChannelActionTelemetry
}

func NewChannelActionsService(api *pluginapi.Client, logger bot.Logger, poster bot.Poster, configService config.Service, store ChannelActionStore, playbookGetter PlaybookGetter, keywordsThreadIgnorer KeywordsThreadIgnorer, telemetry ChannelActionTelemetry) ChannelActionService {
	return &channelActionServiceImpl{
		logger:                logger,
		poster:                poster,
		configService:         configService,
		store:                 store,
		api:                   api,
		playbookGetter:        playbookGetter,
		keywordsThreadIgnorer: keywordsThreadIgnorer,
		telemetry:             telemetry,
	}
}

// setViewedChannelForEveryMember mark channelID as viewed for all its existing members
func (a *channelActionServiceImpl) setViewedChannelForEveryMember(channelID string) error {
	// TODO: this is a magic number, we should load test this function to find a
	// good threshold to share the workload between the goroutines
	perPage := 200

	page := 0
	var wg sync.WaitGroup
	var goroutineErr error

	for {
		members, err := a.api.Channel.ListMembers(channelID, page, perPage)
		if err != nil {
			return fmt.Errorf("unable to retrieve members of channel with ID %q", channelID)
		}

		if len(members) == 0 {
			break
		}

		wg.Add(1)
		go func() {
			defer wg.Done()

			userIDs := make([]string, 0, len(members))
			for _, member := range members {
				userIDs = append(userIDs, member.UserId)
			}

			if err := a.store.SetMultipleViewedChannel(userIDs, channelID); err != nil {
				// We don't care whether multiple goroutines assign this value, as we're
				// only interested in knowing if there was at least one error
				goroutineErr = errors.Wrapf(err, "unable to mark channel with ID %q as viewed for users %v", channelID, userIDs)
			}
		}()

		page++
	}

	wg.Wait()

	return goroutineErr
}

func (a *channelActionServiceImpl) Create(action GenericChannelAction) (string, error) {
	actions, err := a.store.GetChannelActions(action.ChannelID, GetChannelActionOptions{
		ActionType:  action.ActionType,
		TriggerType: action.TriggerType,
	})
	if err != nil {
		return "", err
	}

	if len(actions) > 0 {
		return "", fmt.Errorf("only one action of action type %q and trigger type %q is allowed", string(action.ActionType), string(action.TriggerType))
	}

	if action.ActionType == ActionTypeWelcomeMessage && action.Enabled {
		if err := a.setViewedChannelForEveryMember(action.ChannelID); err != nil {
			return "", err
		}
	}

	return a.store.Create(action)
}

func (a *channelActionServiceImpl) Get(id string) (GenericChannelAction, error) {
	return a.store.Get(id)
}

func (a *channelActionServiceImpl) GetChannelActions(channelID string, options GetChannelActionOptions) ([]GenericChannelAction, error) {
	return a.store.GetChannelActions(channelID, options)
}

func (a *channelActionServiceImpl) Validate(action GenericChannelAction) error {
	// Validate the trigger type and action types
	switch action.TriggerType {
	case TriggerTypeNewMemberJoins:
		switch action.ActionType {
		case ActionTypeWelcomeMessage:
			break
		case ActionTypeCategorizeChannel:
			break
		default:
			return fmt.Errorf("action type %q is not valid for trigger type %q", action.ActionType, action.TriggerType)
		}
	case TriggerTypeKeywordsPosted:
		if action.ActionType != ActionTypePromptRunPlaybook {
			return fmt.Errorf("action type %q is not valid for trigger type %q", action.ActionType, action.TriggerType)
		}
	default:
		return fmt.Errorf("trigger type %q not recognized", action.TriggerType)
	}

	// Validate the payload depending on the action type
	switch action.ActionType {
	case ActionTypeWelcomeMessage:
		var payload WelcomeMessagePayload
		if err := mapstructure.Decode(action.Payload, &payload); err != nil {
			return fmt.Errorf("unable to decode payload from action")
		}
	case ActionTypePromptRunPlaybook:
		var payload PromptRunPlaybookFromKeywordsPayload
		if err := mapstructure.Decode(action.Payload, &payload); err != nil {
			return fmt.Errorf("unable to decode payload from action")
		}
		if err := checkValidPromptRunPlaybookFromKeywordsPayload(payload); err != nil {
			return err
		}
	case ActionTypeCategorizeChannel:
		var payload CategorizeChannelPayload
		if err := mapstructure.Decode(action.Payload, &payload); err != nil {
			return fmt.Errorf("unable to decode payload from action")
		}

	default:
		return fmt.Errorf("action type %q not recognized", action.ActionType)
	}

	return nil
}

func checkValidPromptRunPlaybookFromKeywordsPayload(payload PromptRunPlaybookFromKeywordsPayload) error {
	for _, keyword := range payload.Keywords {
		if keyword == "" {
			return fmt.Errorf("payload field 'keywords' must contain only non-empty keywords")
		}
	}

	if payload.PlaybookID != "" && !model.IsValidId(payload.PlaybookID) {
		return fmt.Errorf("payload field 'playbook_id' must be a valid ID")
	}

	return nil
}

func (a *channelActionServiceImpl) Update(action GenericChannelAction, userID string) error {
	oldAction, err := a.Get(action.ID)
	if err != nil {
		return fmt.Errorf("unable to retrieve existing action with ID %q", action.ID)
	}

	if action.ActionType == ActionTypeWelcomeMessage && !oldAction.Enabled && action.Enabled {
		if err := a.setViewedChannelForEveryMember(action.ChannelID); err != nil {
			return err
		}
	}

	if err := a.store.Update(action); err != nil {
		return err
	}

	a.telemetry.UpdateChannelAction(action, userID)

	return nil
}

// UserHasJoinedChannel is called when userID has joined channelID. If actorID is not blank, userID
// was invited by actorID.
func (a *channelActionServiceImpl) UserHasJoinedChannel(userID, channelID, actorID string) {
	user, err := a.api.User.Get(userID)
	if err != nil {
		a.logger.Errorf("failed to resolve user for userID '%s'; error: %s", userID, err.Error())
		return
	}

	channel, err := a.api.Channel.Get(channelID)
	if err != nil {
		a.logger.Errorf("failed to resolve channel for channelID '%s'; error: %s", channelID, err.Error())
		return
	}

	if user.IsBot {
		return
	}

	actions, err := a.GetChannelActions(channelID, GetChannelActionOptions{
		ActionType:  ActionTypeCategorizeChannel,
		TriggerType: TriggerTypeNewMemberJoins,
	})
	if err != nil {
		a.logger.Errorf("failed to get the channel actions for channelID %q; error: %s", channelID, err.Error())
		return
	}

	if len(actions) > 1 {
		a.logger.Errorf("only one action of action type %s and trigger type %s is expected, but %d were retrieved", ActionTypeCategorizeChannel, TriggerTypeNewMemberJoins, len(actions))
	}

	if len(actions) != 1 {
		return
	}

	action := actions[0]
	if !action.Enabled {
		return
	}

	var payload CategorizeChannelPayload
	if err := mapstructure.Decode(action.Payload, &payload); err != nil {
		a.logger.Errorf("unable to decode payload of CategorizeChannelPayload")
		return
	}

	if payload.CategoryName != "" {
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

			err = a.createOrUpdatePlaybookRunSidebarCategory(userID, channelID, channel.TeamId, payload.CategoryName)
			if err != nil {
				a.logger.Errorf("failed to categorize channel; error: %s", err.Error())
			}

			a.telemetry.RunChannelAction(action, userID)
		}()
	}
}

// createOrUpdatePlaybookRunSidebarCategory creates or updates a "Playbook Runs" sidebar category if
// it does not already exist and adds the channel within the sidebar category
func (a *channelActionServiceImpl) createOrUpdatePlaybookRunSidebarCategory(userID, channelID, teamID, categoryName string) error {
	sidebar, err := a.api.Channel.GetSidebarCategories(userID, teamID)
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
		err = a.api.Channel.CreateSidebarCategory(userID, teamID, &model.SidebarCategoryWithChannels{
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

	err = a.api.Channel.UpdateSidebarCategories(userID, teamID, sidebar.Categories)
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
func (a *channelActionServiceImpl) CheckAndSendMessageOnJoin(userID, channelID string) bool {
	hasViewed := a.store.HasViewedChannel(userID, channelID)

	if hasViewed {
		return true
	}

	actions, err := a.store.GetChannelActions(channelID, GetChannelActionOptions{
		TriggerType: TriggerTypeNewMemberJoins,
	})
	if err != nil {
		a.logger.Errorf("failed to resolve actions for channelID %q and trigger type %q; error: %q", channelID, TriggerTypeNewMemberJoins, err.Error())
		return false
	}

	if err = a.store.SetViewedChannel(userID, channelID); err != nil {
		// If duplicate entry, userID has viewed channelID. If not a duplicate, assume they haven't.
		return errors.Is(err, ErrDuplicateEntry)
	}

	// Look for the ActionTypeWelcomeMessage action
	for _, action := range actions {
		if action.ActionType == ActionTypeWelcomeMessage {
			var payload WelcomeMessagePayload
			if err := mapstructure.Decode(action.Payload, &payload); err != nil {
				a.logger.Errorf("payload of action of type %q is not valid", action.ActionType)
			}

			// Run the action
			a.poster.SystemEphemeralPost(userID, channelID, &model.Post{
				Message: payload.Message,
			})

			a.telemetry.RunChannelAction(action, userID)
		}
	}

	return true
}

func (a *channelActionServiceImpl) MessageHasBeenPosted(sessionID string, post *model.Post) {
	if post.IsSystemMessage() || a.keywordsThreadIgnorer.IsIgnored(post.RootId, post.UserId) || a.poster.IsFromPoster(post) {
		return
	}

	actions, err := a.GetChannelActions(post.ChannelId, GetChannelActionOptions{
		TriggerType: TriggerTypeKeywordsPosted,
		ActionType:  ActionTypePromptRunPlaybook,
	})
	if err != nil {
		a.api.Log.Error("unable to retrieve channel actions", "channelID", post.ChannelId, "triggerType", TriggerTypeKeywordsPosted)
		return
	}

	// Finish early if there are no actions to prompt running a playbook
	if len(actions) == 0 {
		return
	}

	session, err := a.api.Session.Get(sessionID)
	if err != nil {
		a.api.Log.Error("can't get session", "sessionID", sessionID, "err", err.Error())
		return
	}

	triggeredPlaybooksMap := make(map[string]Playbook)
	presentTriggers := []string{}
	for _, action := range actions {
		if !action.Enabled {
			continue
		}

		var payload PromptRunPlaybookFromKeywordsPayload
		if err := mapstructure.Decode(action.Payload, &payload); err != nil {
			a.api.Log.Error("unable to decode payload from action", "payload", payload, "actionType", action.ActionType, "triggerType", action.TriggerType)
			continue
		}

		if len(payload.Keywords) == 0 || payload.PlaybookID == "" {
			continue
		}

		suggestedPlaybook, err := a.playbookGetter.Get(payload.PlaybookID)
		if err != nil {
			a.api.Log.Error("unable to get playbook to run action", "playbookID", payload.PlaybookID)
			continue
		}

		triggers := payload.Keywords
		actionExecuted := false
		for _, trigger := range triggers {
			if strings.Contains(post.Message, trigger) || containsAttachments(post.Attachments(), trigger) {
				triggeredPlaybooksMap[payload.PlaybookID] = suggestedPlaybook
				presentTriggers = append(presentTriggers, trigger)
				actionExecuted = true
			}
		}

		if actionExecuted {
			a.telemetry.RunChannelAction(action, session.UserId)
		}
	}

	if len(triggeredPlaybooksMap) == 0 {
		return
	}

	triggeredPlaybooks := []Playbook{}
	for _, playbook := range triggeredPlaybooksMap {
		triggeredPlaybooks = append(triggeredPlaybooks, playbook)
	}

	message := getPlaybookSuggestionsMessage(triggeredPlaybooks, presentTriggers)
	attachment := getPlaybookSuggestionsSlackAttachment(triggeredPlaybooks, post.Id, session.IsMobileApp(), a.configService.GetManifest().Id)

	rootID := post.RootId
	if rootID == "" {
		rootID = post.Id
	}

	newPost := &model.Post{
		Message:   message,
		ChannelId: post.ChannelId,
	}
	model.ParseSlackAttachment(newPost, []*model.SlackAttachment{attachment})
	if err := a.poster.PostMessageToThread(rootID, newPost); err != nil {
		a.api.Log.Error("unable to post message with suggestions to run playbooks", "error", err)
	}
}

func getPlaybookSuggestionsMessage(suggestedPlaybooks []Playbook, triggers []string) string {
	message := ""
	triggerMessage := ""
	if len(triggers) == 1 {
		triggerMessage = fmt.Sprintf("`%s` is a trigger", triggers[0])
	} else {
		triggerMessage = fmt.Sprintf("`%s` are triggers", strings.Join(triggers, "`, `"))
	}

	if len(suggestedPlaybooks) == 1 {
		playbookURL := fmt.Sprintf("[%s](%s)", suggestedPlaybooks[0].Title, GetPlaybookDetailsRelativeURL(suggestedPlaybooks[0].ID))
		message = fmt.Sprintf("%s for the %s playbook, would you like to run it?", triggerMessage, playbookURL)
	} else {
		message = fmt.Sprintf("%s for the multiple playbooks, would you like to run one of them?", triggerMessage)
	}

	return message
}

func getPlaybookSuggestionsSlackAttachment(playbooks []Playbook, postID string, isMobile bool, pluginID string) *model.SlackAttachment {
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
			Text:    "Open Channel Actions in the channel header to view and edit keywords.",
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

func containsAttachments(attachments []*model.SlackAttachment, trigger string) bool {
	// Check PreText, Title, Text and Footer SlackAttachments fields for trigger.
	for _, attachment := range attachments {
		switch {
		case strings.Contains(attachment.Pretext, trigger):
			return true
		case strings.Contains(attachment.Title, trigger):
			return true
		case strings.Contains(attachment.Text, trigger):
			return true
		case strings.Contains(attachment.Footer, trigger):
			return true
		default:
			continue
		}
	}
	return false
}
