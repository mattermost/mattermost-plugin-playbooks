package bot

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
)

// Bot stores the information for the plugin configuration, and implements the Poster and Logger
// interfaces.
type Bot struct {
	configService Config
	pluginAPI     *pluginapi.Client
	botUserID     string
	logContext    LogContext
}

// Config defines the methods we need from the Config.
type Config interface {
	// GetConfiguration retrieves the active configuration under lock, making it safe to use
	// concurrently.
	GetConfiguration() *config.Configuration
}

// New creates a new bot poster/logger.
func New(api *pluginapi.Client, botUserID string, configService Config) *Bot {
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
