package bot

import (
	"github.com/mattermost/mattermost-plugin-incident-management/server/config"
	"github.com/mattermost/mattermost-server/v5/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// Bot stores the information for the plugin configuration, and implements the Poster and Logger
// interfaces.
type Bot struct {
	configService config.Service
	pluginAPI     *pluginapi.Client
	botUserID     string
	logContext    LogContext
}

// Logger interface - a logging system that will tee logs to a DM channel.
type Logger interface {
	With(LogContext) Logger
	Timed() Logger
	Debugf(format string, args ...interface{})
	Errorf(format string, args ...interface{})
	Infof(format string, args ...interface{})
	Warnf(format string, args ...interface{})
}

// Poster interface - a small subset of the plugin posting API.
type Poster interface {
	// PostMessage posts a simple message to channelID. Returns the post id if posting was successful.
	PostMessage(channelID, format string, args ...interface{}) (*model.Post, error)

	// PostMessage posts a message with slack attachments to channelID. Returns the post id if
	// posting was successful. Often used to include post actions.
	PostMessageWithAttachments(channelID string, attachments []*model.SlackAttachment, format string, args ...interface{}) (*model.Post, error)

	// DM posts a simple Direct Message to the specified user.
	DM(userID, format string, args ...interface{}) error

	// DMWithAttachments posts a Direct Message that contains Slack attachments.
	// Often used to include post actions.
	DMWithAttachments(userID string, attachments ...*model.SlackAttachment) error

	// Ephemeral sends an ephemeral message to a user.
	EphemeralPost(userID, channelID string, post *model.Post)

	// PublishWebsocketEventToTeam sends a websocket event with payload to teamID.
	PublishWebsocketEventToTeam(event string, payload interface{}, teamID string)

	// PublishWebsocketEventToChannel sends a websocket event with payload to channelID.
	PublishWebsocketEventToChannel(event string, payload interface{}, channelID string)

	// PublishWebsocketEventToUser sends a websocket event with payload to userID.
	PublishWebsocketEventToUser(event string, payload interface{}, userID string)
}

// New creates a new bot poster/logger.
func New(api *pluginapi.Client, botUserID string, configService config.Service) *Bot {
	return &Bot{
		pluginAPI:     api,
		botUserID:     botUserID,
		configService: configService,
	}
}

// Clone shallow copies
func (b *Bot) clone() *Bot {
	return &Bot{
		configService: b.configService,
		pluginAPI:     b.pluginAPI,
		botUserID:     b.botUserID,
		logContext:    b.logContext.copyShallow(),
	}
}
