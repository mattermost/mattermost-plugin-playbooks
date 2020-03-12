package bot

import (
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// ServiceImpl implements Service interface.
type ServiceImpl struct {
	configService config.Service
	pluginAPI     plugin.API
	botUserID     string
	logContext    LogContext
}

// New creates a new bot poster/logger.
func New(api plugin.API, botUserID string, configService config.Service) *ServiceImpl {
	return &ServiceImpl{
		pluginAPI:     api,
		botUserID:     botUserID,
		configService: configService,
	}
}

// Clone shallow copies
func (b *ServiceImpl) clone() *ServiceImpl {
	return &ServiceImpl{
		configService: b.configService,
		pluginAPI:     b.pluginAPI,
		botUserID:     b.botUserID,
		logContext:    b.logContext.copyShallow(),
	}
}
