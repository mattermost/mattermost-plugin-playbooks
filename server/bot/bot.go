package bot

import (
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-server/v6/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// Bot stores the information for the plugin configuration, and implements the Poster and Logger
// interfaces.
type Bot struct {
	configService config.Service
	pluginAPI     *pluginapi.Client
	botUserID     string
	logContext    LogContext
	telemetry     Telemetry
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
	// Post posts a custom post, which should provide the Message and ChannelId fields
	Post(post *model.Post) error

	// PostMessage posts a simple message to channelID. Returns the post id if posting was successful.
	PostMessage(channelID, format string, args ...interface{}) (*model.Post, error)

	// PostMessageToThread posts a message to a specified channel and thread identified by rootPostID.
	// If the rootPostID is blank, or the rootPost is deleted, it will create a standalone post. The
	// returned post's RootID (or ID, if there was no root post) should be used as the rootID for
	// future use (i.e., save that if you want to continue the thread).
	PostMessageToThread(rootPostID string, post *model.Post) error

	// PostMessageWithAttachments posts a message with slack attachments to channelID. Returns the post id if
	// posting was successful. Often used to include post actions.
	PostMessageWithAttachments(channelID string, attachments []*model.SlackAttachment, format string, args ...interface{}) (*model.Post, error)

	// PostCustomMessageWithAttachments posts a custom message with the specified type. Falling back to attachments for mobile.
	PostCustomMessageWithAttachments(channelID, customType string, attachments []*model.SlackAttachment, format string, args ...interface{}) (*model.Post, error)

	// DM posts a DM from the plugin bot to the specified user
	DM(userID string, post *model.Post) error

	// EphemeralPost sends an ephemeral message to a user.
	EphemeralPost(userID, channelID string, post *model.Post)

	// SystemEphemeralPost sends an ephemeral message to a user authored by the System.
	SystemEphemeralPost(userID, channelID string, post *model.Post)

	// EphemeralPostWithAttachments sends an ephemeral message to a user with Slack attachments.
	EphemeralPostWithAttachments(userID, channelID, rootPostID string, attachments []*model.SlackAttachment, format string, args ...interface{})

	// PublishWebsocketEventToTeam sends a websocket event with payload to teamID.
	PublishWebsocketEventToTeam(event string, payload interface{}, teamID string)

	// PublishWebsocketEventToChannel sends a websocket event with payload to channelID.
	PublishWebsocketEventToChannel(event string, payload interface{}, channelID string)

	// PublishWebsocketEventToUser sends a websocket event with payload to userID.
	PublishWebsocketEventToUser(event string, payload interface{}, userID string)

	// NotifyAdmins sends a DM with the message to each admins
	NotifyAdmins(message, authorUserID string, isTeamEdition bool) error

	// PromptForFeedback sends a DM as the surveybot to the given user, prompting for product feedback.
	PromptForFeedback(userID string) error

	// IsFromPoster returns whether the provided post was sent by this poster
	IsFromPoster(post *model.Post) bool
}

type Telemetry interface {
	NotifyAdmins(userID string, action string)
	StartTrial(userID string, action string)
}

// New creates a new bot poster/logger.
func New(api *pluginapi.Client, botUserID string, configService config.Service, telemetry Telemetry) *Bot {
	return &Bot{
		pluginAPI:     api,
		botUserID:     botUserID,
		configService: configService,
		telemetry:     telemetry,
	}
}

// Clone shallow copies
func (b *Bot) clone() *Bot {
	return &Bot{
		configService: b.configService,
		pluginAPI:     b.pluginAPI,
		botUserID:     b.botUserID,
		logContext:    b.logContext.copyShallow(),
		telemetry:     b.telemetry,
	}
}
