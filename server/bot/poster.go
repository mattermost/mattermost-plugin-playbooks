package bot

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost-server/v6/model"
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

// Post posts a custom post. The Message and ChannelId fields should be provided in the specified
// post
func (b *Bot) Post(post *model.Post) error {
	if post.Message == "" {
		return fmt.Errorf("the post does not contain a message")
	}

	if !model.IsValidId(post.ChannelId) {
		return fmt.Errorf("the post does not contain a valid ChannelId")
	}

	post.UserId = b.botUserID

	return b.pluginAPI.Post.CreatePost(post)
}

// PostMessageToThread posts a message to a specified thread identified by rootPostID.
// If the rootPostID is blank, or the rootPost is deleted, it will create a standalone post. The
// overwritten post's RootID will be the correct rootID (save that if you want to continue the thread).
func (b *Bot) PostMessageToThread(rootPostID string, post *model.Post) error {
	rootID := ""
	if rootPostID != "" {
		root, err := b.pluginAPI.Post.GetPost(rootPostID)
		if err == nil && root != nil && root.DeleteAt == 0 {
			rootID = root.Id
		}
	}

	post.UserId = b.botUserID
	post.RootId = rootID

	return b.pluginAPI.Post.CreatePost(post)
}

// PostMessageWithAttachments posts a message with slack attachments to channelID. Returns the post id if
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

// DM sends a DM from the plugin bot to the specified user
func (b *Bot) DM(userID string, post *model.Post) error {
	channel, err := b.pluginAPI.Channel.GetDirect(userID, b.botUserID)
	if err != nil {
		b.pluginAPI.Log.Info("Couldn't get bot's DM channel", "user_id", userID)
		return err
	}
	post.ChannelId = channel.Id
	post.UserId = b.botUserID

	return b.pluginAPI.Post.CreatePost(post)
}

// EphemeralPost sends an ephemeral message to a user
func (b *Bot) EphemeralPost(userID, channelID string, post *model.Post) {
	post.UserId = b.botUserID
	post.ChannelId = channelID

	b.pluginAPI.Post.SendEphemeralPost(userID, post)
}

// SystemEphemeralPost sends an ephemeral message to a user authored by the System
func (b *Bot) SystemEphemeralPost(userID, channelID string, post *model.Post) {
	post.ChannelId = channelID

	b.pluginAPI.Post.SendEphemeralPost(userID, post)
}

// EphemeralPostWithAttachments sends an ephemeral message to a user with Slack attachments.
func (b *Bot) EphemeralPostWithAttachments(userID, channelID, postID string, attachments []*model.SlackAttachment, format string, args ...interface{}) {
	post := &model.Post{
		Message:   fmt.Sprintf(format, args...),
		UserId:    b.botUserID,
		ChannelId: channelID,
		RootId:    postID,
	}

	model.ParseSlackAttachment(post, attachments)
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
		Role:    string(model.SystemAdminRoleId),
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
	case "start_trial_to_add_message_to_timeline", "start_trial_to_view_timeline":
		message = fmt.Sprintf("@%s requested access to the playbook run timeline.", author.Username)
		title = "Keep a complete record of the playbook run timeline"
		text = "The playbook run timeline automatically tracks key events and messages in chronological order so that they can be traced and reviewed afterwards. Teams use timeline to perform retrospectives and extract lessons for the next time that they run the playbook."
	case "start_trial_to_access_retrospective":
		message = fmt.Sprintf("@%s requested access to the retrospective.", author.Username)
		title = "Publish retrospective report and access the timeline"
		text = "Celebrate success and learn from mistakes with retrospective reports. Filter timeline events for process review, stakeholder engagement, and auditing purposes."
	case "start_trial_to_restrict_playbook_access":
		message = fmt.Sprintf("@%s requested permission to configure who can access specific playbooks.", author.Username)
		title = "Control who can access your team's playbooks"
		text = "Playbooks are workflows that your teams and tools should follow, including everything from checklists, actions, templates, and retrospectives. When you upgrade, you can set playbook permissions for specific users or set a global permission to control which team members can create playbooks.\n" + footer
	case "start_trial_to_restrict_playbook_creation":
		message = fmt.Sprintf("@%s requested permission to configure who can create playbooks.", author.Username)
		title = "Control who can create playbooks"
		text = "Playbooks are workflows that your teams and tools should follow, including everything from checklists, actions, templates, and retrospectives. When you upgrade, you can set playbook permissions for specific users or set a global permission to control which team members can create playbooks.\n" + footer
	case "start_trial_to_export_channel":
		message = fmt.Sprintf("@%s requested access to export the playbook run channel.", author.Username)
		title = "Save the message history of your playbook runs"
		text = "Export the channel of your playbook run and save it for later analysis. When you upgrade, you can automatically generate and download a CSV file containing all the timestamped messages sent to the channel.\n" + footer
	case "start_trial_to_access_playbook_dashboard":
		message = fmt.Sprintf("@%s requested access to view playbook statistics", author.Username)
		title = "All the statistics you need"
		text = "View trends for total runs, active runs, and participants involved in runs of this playbook."
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

	b.telemetry.NotifyAdmins(authorUserID, messageType)

	return nil
}

func (b *Bot) PromptForFeedback(userID string) error {
	surveyBot, err := b.pluginAPI.User.GetByUsername("surveybot")
	if err != nil {
		return fmt.Errorf("unable to find surveybot user: %w", err)
	}

	channel, err := b.pluginAPI.Channel.GetDirect(userID, surveyBot.Id)
	if err != nil {
		return fmt.Errorf("failed to get direct message channel between user %s and surveybot %s: %w", userID, surveyBot.Id, err)
	}

	post := &model.Post{
		ChannelId: channel.Id,
		UserId:    surveyBot.Id,
		Message:   "Have feedback about Playbooks?",
	}
	if err := b.pluginAPI.Post.CreatePost(post); err != nil {
		return fmt.Errorf("failed to create post: %w", err)
	}

	return nil
}

func (b *Bot) IsFromPoster(post *model.Post) bool {
	return post.UserId == b.botUserID
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

// DM posts a simple Direct Message to the specified user
func (b *Bot) dmAdmins(format string, args ...interface{}) error {
	for _, id := range b.configService.GetConfiguration().AllowedUserIDs {
		err := b.DM(id, &model.Post{
			Message: fmt.Sprintf(format, args...),
		})
		if err != nil {
			return err
		}
	}
	return nil
}
