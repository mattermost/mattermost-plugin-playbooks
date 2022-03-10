package app

import (
	"fmt"
	"sync"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mitchellh/mapstructure"
	"github.com/pkg/errors"
)

type channelActionServiceImpl struct {
	logger bot.Logger
	poster bot.Poster
	store  ChannelActionStore
	api    *pluginapi.Client
}

func NewChannelActionsService(api *pluginapi.Client, logger bot.Logger, poster bot.Poster, store ChannelActionStore) ChannelActionService {
	return &channelActionServiceImpl{
		logger: logger,
		poster: poster,
		store:  store,
		api:    api,
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
		if action.ActionType != ActionTypeWelcomeMessage {
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
		if err := checkValidWelcomeMessagePayload(payload); err != nil {
			return err
		}

	default:
		return fmt.Errorf("action type %q not recognized", action.ActionType)
	}

	return nil
}

func checkValidWelcomeMessagePayload(payload WelcomeMessagePayload) error {
	if payload.Message == "" {
		return fmt.Errorf("payload field 'message' must be non-empty")
	}

	return nil
}

func (a *channelActionServiceImpl) Update(action GenericChannelAction) error {
	oldAction, err := a.Get(action.ID)
	if err != nil {
		return fmt.Errorf("unable to retrieve existing action with ID %q", action.ID)
	}

	if action.ActionType == ActionTypeWelcomeMessage && !oldAction.Enabled && action.Enabled {
		if err := a.setViewedChannelForEveryMember(action.ChannelID); err != nil {
			return err
		}
	}

	return a.store.Update(action)
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

			a.poster.SystemEphemeralPost(userID, channelID, &model.Post{
				Message: payload.Message,
			})
		}
	}

	return true
}
