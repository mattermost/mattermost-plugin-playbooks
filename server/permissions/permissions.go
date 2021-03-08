package permissions

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

// RequesterInfo holds the userID and teamID that this request is regarding, and permissions
// for the user making the request
type RequesterInfo struct {
	UserID  string
	IsAdmin bool
	IsGuest bool
}

// ViewIncident returns nil if the userID has permissions to view incidentID
func ViewIncident(userID, channelID string, pluginAPI *pluginapi.Client) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	if pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PERMISSION_READ_CHANNEL) {
		return nil
	}

	channel, err := pluginAPI.Channel.Get(channelID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get channel to determine permissions, channel id `%s`", channelID)
	}

	if channel.Type == model.CHANNEL_OPEN && pluginAPI.User.HasPermissionToTeam(userID, channel.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		return nil
	}

	return ErrNoPermissions
}

// ViewIncidentFromChannelID returns nil if the userID has permissions to view the incident
// associated with channelID
func ViewIncidentFromChannelID(userID, channelID string, pluginAPI *pluginapi.Client) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	if pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PERMISSION_READ_CHANNEL) {
		return nil
	}

	channel, err := pluginAPI.Channel.Get(channelID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get channel to determine permissions, channel id `%s`", channelID)
	}

	if channel.Type == model.CHANNEL_OPEN && pluginAPI.User.HasPermissionToTeam(userID, channel.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		return nil
	}

	return ErrNoPermissions
}

// EditIncident returns nil if the userID has permissions to edit incidentID
func EditIncident(userID, channelID string, pluginAPI *pluginapi.Client) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	if pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PERMISSION_READ_CHANNEL) {
		return nil
	}

	return ErrNoPermissions
}

// CanViewTeam returns true if the userID has permissions to view teamID
func CanViewTeam(userID, teamID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PERMISSION_VIEW_TEAM)
}

// IsAdmin returns true if the userID is a system admin
func IsAdmin(userID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM)
}

// IsGuest returns true if the userID is a system guest
func IsGuest(userID string, pluginAPI *pluginapi.Client) (bool, error) {
	user, err := pluginAPI.User.Get(userID)
	if err != nil {
		return false, errors.Wrapf(err, "Unable to get user to determine permissions, user id `%s`", userID)
	}

	return user.IsGuest(), nil
}

func MemberOfChannelID(userID, channelID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PERMISSION_READ_CHANNEL)
}

func CanPostToChannel(userID, channelID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PERMISSION_CREATE_POST)
}

func GetRequesterInfo(userID string, pluginAPI *pluginapi.Client) (RequesterInfo, error) {
	isAdmin := IsAdmin(userID, pluginAPI)

	isGuest, err := IsGuest(userID, pluginAPI)
	if err != nil {
		return RequesterInfo{}, err
	}

	return RequesterInfo{
		UserID:  userID,
		IsAdmin: isAdmin,
		IsGuest: isGuest,
	}, nil
}
