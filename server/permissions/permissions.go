package permissions

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/mattermost/mattermost-plugin-incident-management/server/incident"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

// ViewIncident returns nil if the userID has permissions to view incidentID
func ViewIncident(userID, incidentID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	incidentToCheck, err := incidentService.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "could not get incident id `%s`", incidentID)
	}

	if pluginAPI.User.HasPermissionToChannel(userID, incidentToCheck.ChannelID, model.PERMISSION_READ_CHANNEL) {
		return nil
	}

	channel, err := pluginAPI.Channel.Get(incidentToCheck.ChannelID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get channel to determine permissions, channel id `%s`", incidentToCheck.ChannelID)
	}

	if channel.Type == model.CHANNEL_OPEN && pluginAPI.User.HasPermissionToTeam(userID, channel.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		return nil
	}

	return ErrNoPermissions
}

// ViewIncidentFromChannelID returns nil if the userID has permissions to view the incident
// associated with channelID
func ViewIncidentFromChannelID(userID, channelID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
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
func EditIncident(userID, incidentID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	incidentToCheck, err := incidentService.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "could not get incident id `%s`", incidentID)
	}

	if pluginAPI.User.HasPermissionToChannel(userID, incidentToCheck.ChannelID, model.PERMISSION_READ_CHANNEL) {
		return nil
	}

	return ErrNoPermissions
}

// CanViewTeam returns true if the userID has permissions to view teamID
func CanViewTeam(userID, teamID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PERMISSION_LIST_TEAM_CHANNELS)
}

// IsAdmin returns true if the userID is a system admin
func IsAdmin(userID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM)
}
