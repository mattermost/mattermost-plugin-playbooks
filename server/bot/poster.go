package bot

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

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

func (b *Bot) NotifyAdmins(messageType, authorUserID string) error {
	author, err := b.pluginAPI.User.Get(authorUserID)
	if err != nil {
		return errors.Wrap(err, "unable to find author user")
	}

	admins, err := b.pluginAPI.User.List(&model.UserGetOptions{
		Role:    string(model.SYSTEM_ADMIN_ROLE_ID),
		Page:    0,
		PerPage: 1000,
	})

	if err != nil {
		return errors.Wrap(err, "unable to find all admin users")
	}

	if len(admins) == 0 {
		return fmt.Errorf("no admins found")
	}

	var message, title, text string

	footer := "[Learn more](example.com).\n\nWhen you select **Start 30-day trial**, you agree to the [Mattermost Software Evaluation Agreement](https://mattermost.com/software-evaluation-agreement/), [Privacy Policy](https://mattermost.com/privacy-policy/), and receiving product emails."

	switch messageType {
	case "playbook":
		message = fmt.Sprintf("@%s requested access to create more playbooks in Incident Collaboration.", author.Username)
		title = "Create multiple playbooks in Incident Collaboration with Mattermost Enterprise Edition E10"
		text = "Playbooks are workflows that provide guidance through an incident. Each playbook can be customized and refined over time, to improve time to resolution. In Enterprise Edition E10 you can create an unlimited number of playbooks for your team.\n" + footer

	case "message_to_timeline", "view_timeline":
		message = fmt.Sprintf("@%s requested access to the timeline in Incident Collaboration.", author.Username)
		title = "Keep all your incident events in one place with Mattermost Enterprise Edition E10"
		text = "Your timeline lists all the events in your incident, separated by type. You can download your timeline and use it for your retrospectives to improve how you respond to incidents. Enterprise Edition E10 includes access to timeline features such as adding messages from within the incident channel.\n" + footer
	}

	attachments := []*model.SlackAttachment{
		{
			Title: title,
			Text:  text,
			Actions: []*model.PostAction{
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
			},
		},
	}

	for _, admin := range admins {
		go func(adminID string) {
			post := &model.Post{Message: message}
			model.ParseSlackAttachment(post, attachments)

			if err := b.dm(adminID, post); err != nil {
				b.pluginAPI.Log.Warn("failed to send a DM to user", "user ID", adminID, "error", err)
			}
		}(admin.Id)
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
