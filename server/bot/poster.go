package bot

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
)

// Poster interface - a small subset of the plugin posting API.
type Poster interface {
	// PostMessage posts a simple Direct Message to the specified user
	PostMessage(channelID, format string, args ...interface{}) error

	// DM posts a simple Direct Message to the specified user
	DM(userID, format string, args ...interface{}) error

	// DMWithAttachments posts a Direct Message that contains Slack attachments.
	// Often used to include post actions.
	DMWithAttachments(userID string, attachments ...*model.SlackAttachment) error

	// Ephemeral sends an ephemeral message to a user
	Ephemeral(userID, channelID, format string, args ...interface{})
}

// PostMessage posts a message to a specified channel.
func (b *Bot) PostMessage(channelID, format string, args ...interface{}) error {
	post := &model.Post{
		Message:   fmt.Sprintf(format, args...),
		UserId:    b.botUserID,
		ChannelId: channelID,
	}
	if err := b.pluginAPI.Post.CreatePost(post); err != nil {
		return err
	}
	return nil
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
func (b *Bot) Ephemeral(userID, channelID, format string, args ...interface{}) {
	post := &model.Post{
		UserId:    b.botUserID,
		ChannelId: channelID,
		Message:   fmt.Sprintf(format, args...),
	}
	b.pluginAPI.Post.SendEphemeralPost(userID, post)
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
