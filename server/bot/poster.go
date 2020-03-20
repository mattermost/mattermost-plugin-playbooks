package bot

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
)

// PostMessage posts a message to a specified channel.
func (b *bot) PostMessage(channelID, format string, args ...interface{}) error {
	post := &model.Post{
		Message:   fmt.Sprintf(format, args...),
		UserId:    b.botUserID,
		ChannelId: channelID,
	}
	if _, err := b.pluginAPI.CreatePost(post); err != nil {
		return err
	}
	return nil
}

// DM posts a simple Direct Message to the specified user
func (b *bot) DM(userID, format string, args ...interface{}) error {
	return b.dm(userID, &model.Post{
		Message: fmt.Sprintf(format, args...),
	})
}

// DMWithAttachments posts a Direct Message that contains Slack attachments.
// Often used to include post actions.
func (b *bot) DMWithAttachments(userID string, attachments ...*model.SlackAttachment) error {
	post := model.Post{}
	model.ParseSlackAttachment(&post, attachments)
	return b.dm(userID, &post)
}

// Ephemeral sends an ephemeral message to a user
func (b *bot) Ephemeral(userID, channelID, format string, args ...interface{}) {
	post := &model.Post{
		UserId:    b.botUserID,
		ChannelId: channelID,
		Message:   fmt.Sprintf(format, args...),
	}
	_ = b.pluginAPI.SendEphemeralPost(userID, post)
}

func (b *bot) dm(userID string, post *model.Post) error {
	channel, err := b.pluginAPI.GetDirectChannel(userID, b.botUserID)
	if err != nil {
		b.pluginAPI.LogInfo("Couldn't get bot's DM channel", "user_id", userID)
		return err
	}
	post.ChannelId = channel.Id
	post.UserId = b.botUserID
	if _, err := b.pluginAPI.CreatePost(post); err != nil {
		return err
	}
	return nil
}

// DM posts a simple Direct Message to the specified user
func (b *bot) dmAdmins(format string, args ...interface{}) error {
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
