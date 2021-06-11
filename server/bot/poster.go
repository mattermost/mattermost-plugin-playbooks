package bot

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const maxAdminsToQueryForNotification = 1000

// PostMessage posts a message to a specified channel.
func (b *Bot) PostMessage(channelID, format string, args ...interface{}) (*model.Post, error) {
	post := &model.Post{
		Message:   fmt.Sprintf(format, args...),
		UserId:    b.botUserID,
		ChannelId: channelID,
	}
	if err := b.pluginAPI.Post.CreatePost(post); err != nil {
		return nil, err
	}
	return post, nil
}

// PostMessage posts a message with slack attachments to channelID. Returns the post id if
// posting was successful. Often used to include post actions.
func (b *Bot) PostMessageWithAttachments(channelID string, attachments []*model.SlackAttachment, format string, args ...interface{}) (*model.Post, error) {
	post := &model.Post{
		Message:   fmt.Sprintf(format, args...),
		UserId:    b.botUserID,
		ChannelId: channelID,
	}
	model.ParseSlackAttachment(post, attachments)
	if err := b.pluginAPI.Post.CreatePost(post); err != nil {
		return nil, err
	}
	return post, nil
}

func (b *Bot) PostCustomMessageWithAttachments(channelID, customType string, attachments []*model.SlackAttachment, format string, args ...interface{}) (*model.Post, error) {
	post := &model.Post{
		Message:   fmt.Sprintf(format, args...),
		UserId:    b.botUserID,
		ChannelId: channelID,
		Type:      customType,
	}
	model.ParseSlackAttachment(post, attachments)
	if err := b.pluginAPI.Post.CreatePost(post); err != nil {
		return nil, err
	}
	return post, nil
}

// DM posts a simple Direct Message to the specified user
func (b *Bot) DM(userID, format string, args ...interface{}) error {
	return b.dm(userID, &model.Post{
		Message: fmt.Sprintf(format, args...),
	})
}

// DMWithAttachments posts a Direct Message that contains Slack attachments.
// Often used to include post actions.
func (b *Bot) DMWithAttachments(userID string, attachments ...*model.SlackAttachment) error {
	post := model.Post{}
	model.ParseSlackAttachment(&post, attachments)
	return b.dm(userID, &post)
}

// Ephemeral sends an ephemeral message to a user
func (b *Bot) EphemeralPost(userID, channelID string, post *model.Post) {
	post.UserId = b.botUserID
	post.ChannelId = channelID

	b.pluginAPI.Post.SendEphemeralPost(userID, post)
}

// PublishWebsocketEventToTeam sends a websocket event with payload to teamID
func (b *Bot) PublishWebsocketEventToTeam(event string, payload interface{}, teamID string) {
	payloadMap := b.makePayloadMap(payload)
	b.pluginAPI.Frontend.PublishWebSocketEvent(event, payloadMap, &model.WebsocketBroadcast{
		TeamId: teamID,
	})
}

// PublishWebsocketEventToChannel sends a websocket event with payload to channelID
func (b *Bot) PublishWebsocketEventToChannel(event string, payload interface{}, channelID string) {
	payloadMap := b.makePayloadMap(payload)
	b.pluginAPI.Frontend.PublishWebSocketEvent(event, payloadMap, &model.WebsocketBroadcast{
		ChannelId: channelID,
	})
}

// PublishWebsocketEventToUser sends a websocket event with payload to userID
func (b *Bot) PublishWebsocketEventToUser(event string, payload interface{}, userID string) {
	payloadMap := b.makePayloadMap(payload)
	b.pluginAPI.Frontend.PublishWebSocketEvent(event, payloadMap, &model.WebsocketBroadcast{
		UserId: userID,
	})
}

func (b *Bot) NotifyAdmins(messageType, authorUserID string, isTeamEdition bool) error {
	author, err := b.pluginAPI.User.Get(authorUserID)
	if err != nil {
		return errors.Wrap(err, "unable to find author user")
	}

	admins, err := b.pluginAPI.User.List(&model.UserGetOptions{
		Role:    string(model.SYSTEM_ADMIN_ROLE_ID),
		Page:    0,
		PerPage: maxAdminsToQueryForNotification,
	})

	if err != nil {
		return errors.Wrap(err, "unable to find all admin users")
	}

	if len(admins) == 0 {
		return fmt.Errorf("no admins found")
	}

	var postType, footer string

	isCloud := b.configService.IsCloud()

	separator := "\n\n---\n\n"
	if isCloud {
		postType = "custom_cloud_upgrade"
		footer = separator + "[Upgrade now](https://customers.mattermost.com)."
	} else {
		footer = "[Learn more](https://mattermost.com/pricing).\n\nWhen you select **Start 30-day trial**, you agree to the [Mattermost Software Evaluation Agreement](https://mattermost.com/software-evaluation-agreement/), [Privacy Policy](https://mattermost.com/privacy-policy/), and receiving product emails."

		if isTeamEdition {
			footer = "[Learn more](https://mattermost.com/pricing).\n\n[Convert to Mattermost Starter](https://docs.mattermost.com/install/ee-install.html#converting-team-edition-to-enterprise-edition) to unlock this feature. Then, start a trial or upgrade to Mattermost Professional or Enterprise."
		}
	}

	var message, title, text string

	switch messageType {
	case "start_trial_to_create_playbook":
		message = fmt.Sprintf("@%s requested access to create more playbooks in Incident Collaboration.", author.Username)
		title = "Create multiple playbooks in Incident Collaboration with Mattermost Professional"
		text = "Playbooks are workflows that your teams and tools should follow, including everything from checklists, actions, templates, and retrospectives. Each playbook can be customized and refined over time, to improve time to resolution. In Mattermost Professional you can create an unlimited number of playbooks for your team.\n" + footer
	case "start_trial_to_add_message_to_timeline", "start_trial_to_view_timeline":
		message = fmt.Sprintf("@%s requested access to the timeline in Incident Collaboration.", author.Username)
		title = "Keep a complete record of the playbook run timeline"
		text = "The playbook run timeline automatically tracks key events and messages in chronological order so that they can be traced and reviewed afterwards. Teams use timeline to perform retrospectives and extract lessons for the next time that they run the playbook."
	case "start_trial_to_restrict_playbook_access":
		message = fmt.Sprintf("@%s requested access to configure who can access specific playbooks in Incident Collaboration.", author.Username)
		title = "Control who can access specific playbooks in Incident Collaboration with Mattermost Enterprise"
		text = "Playbooks are workflows that your teams and tools should follow, including everything from checklists, actions, templates, and retrospectives. In Mattermost Enterprise you can set playbook permissions for specific users or set a global permission to control which team members can create playbooks.\n" + footer
	case "start_trial_to_restrict_playbook_creation":
		message = fmt.Sprintf("@%s requested access to configure who can create playbooks in Incident Collaboration.", author.Username)
		title = "Control who can create playbooks in Incident Collaboration with Mattermost Enterprise"
		text = "Playbooks are workflows that your teams and tools should follow, including everything from checklists, actions, templates, and retrospectives. In Mattermost Enterprise you can set playbook permissions for specific users or set a global permission to control which team members can create playbooks.\n" + footer
	}

	actions := []*model.PostAction{
		{

			Id:    "message",
			Name:  "Start 30-day trial",
			Style: "primary",
			Type:  "button",
			Integration: &model.PostActionIntegration{
				URL: fmt.Sprintf("/plugins/%s/api/v0/bot/notify-admins/button-start-trial",
					b.configService.GetManifest().Id),
				Context: map[string]interface{}{
					"users":                 100,
					"termsAccepted":         true,
					"receiveEmailsAccepted": true,
				},
			},
		},
	}

	if isTeamEdition || isCloud {
		actions = []*model.PostAction{}
	}

	attachments := []*model.SlackAttachment{
		{
			Title:   title,
			Text:    separator + text,
			Actions: actions,
		},
	}

	for _, admin := range admins {
		go func(adminID string) {
			channel, err := b.pluginAPI.Channel.GetDirect(adminID, b.botUserID)
			if err != nil {
				b.pluginAPI.Log.Warn("failed to get Direct Message channel between user and bot", "user ID", adminID, "bot ID", b.botUserID, "error", err)
				return
			}

			if _, err := b.PostCustomMessageWithAttachments(channel.Id, postType, attachments, message); err != nil {
				b.pluginAPI.Log.Warn("failed to send a DM to user", "user ID", adminID, "error", err)
			}
		}(admin.Id)
	}

	switch messageType {
	case "start_trial_to_create_playbook":
		b.telemetry.NotifyAdminsToCreatePlaybook(authorUserID)
	case "start_trial_to_view_timeline":
		b.telemetry.NotifyAdminsToViewTimeline(authorUserID)
	case "start_trial_to_add_message_to_timeline":
		b.telemetry.NotifyAdminsToAddMessageToTimeline(authorUserID)
	case "start_trial_to_restrict_playbook_access":
		b.telemetry.NotifyAdminsToRestrictPlaybookAccess(authorUserID)
	case "start_trial_to_restrict_playbook_creation":
		b.telemetry.NotifyAdminsToRestrictPlaybookCreation(authorUserID)
	}

	return nil
}

func (b *Bot) makePayloadMap(payload interface{}) map[string]interface{} {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		b.With(LogContext{
			"payload": payload,
		}).Errorf("could not marshall payload")
		payloadJSON = []byte("null")
	}
	return map[string]interface{}{"payload": string(payloadJSON)}
}

func (b *Bot) dm(userID string, post *model.Post) error {
	channel, err := b.pluginAPI.Channel.GetDirect(userID, b.botUserID)
	if err != nil {
		b.pluginAPI.Log.Info("Couldn't get bot's DM channel", "user_id", userID)
		return err
	}
	post.ChannelId = channel.Id
	post.UserId = b.botUserID
	if err := b.pluginAPI.Post.CreatePost(post); err != nil {
		return err
	}
	return nil
}

// DM posts a simple Direct Message to the specified user
func (b *Bot) dmAdmins(format string, args ...interface{}) error {
	for _, id := range b.configService.GetConfiguration().AllowedUserIDs {
		err := b.dm(id, &model.Post{
			Message: fmt.Sprintf(format, args...),
		})
		if err != nil {
			return err
		}
	}
	return nil
}
