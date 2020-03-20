package bot

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-server/v5/model"
)

// Bot can be used as a Poster and Logger.
type Bot interface {
	Poster
	Logger
}

type bot struct {
	configService config.Service
	pluginAPI     *pluginapi.Client
	botUserID     string
	logContext    LogContext
}

// Logger interface.
type Logger interface {
	With(LogContext) Logger
	Timed() Logger
	Debugf(format string, args ...interface{})
	Errorf(format string, args ...interface{})
	Infof(format string, args ...interface{})
	Warnf(format string, args ...interface{})
}

// Poster interface.
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

// New creates a new bot poster/logger.
func New(api *pluginapi.Client, botUserID string, configService config.Service) Bot {
	return &bot{
		pluginAPI:     api,
		botUserID:     botUserID,
		configService: configService,
	}
}

// Clone shallow copies
func (b *bot) clone() *bot {
	return &bot{
		configService: b.configService,
		pluginAPI:     b.pluginAPI,
		botUserID:     b.botUserID,
		logContext:    b.logContext.copyShallow(),
	}
}
