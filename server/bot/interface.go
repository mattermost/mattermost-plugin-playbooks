package bot

import "github.com/mattermost/mattermost-server/v5/model"

// Service Logger service interface.
type Service interface {
	Poster
	Logger
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

// Logger interface.
type Logger interface {
	With(LogContext) Logger
	Timed() Logger
	Debugf(format string, args ...interface{})
	Errorf(format string, args ...interface{})
	Infof(format string, args ...interface{})
	Warnf(format string, args ...interface{})
}
