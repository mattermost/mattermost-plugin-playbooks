package bot

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-server/v5/model"
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
	// PostMessage posts a simple Direct Message to the specified user
	PostMessage(channelID, format string, args ...interface{}) error

	// DM posts a simple Direct Message to the specified user
	DM(userID, format string, args ...interface{}) error

	// DMWithAttachments posts a Direct Message that contains Slack attachments.
	// Often used to include post actions.
	DMWithAttachments(userID string, attachments ...*model.SlackAttachment) error

	// Ephemeral sends an ephemeral message to a user
	Ephemeral(userID, channelID, format string, args ...interface{})

	// PublishWebsocketEventToTeam sends a websocket event with payload to teamID
	PublishWebsocketEventToTeam(event string, payload map[string]interface{}, teamID string)

	PublishWebsocketEventToChannel(event string, payload map[string]interface{}, channelId string)
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
