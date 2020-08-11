package permissions

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

func HasPermissionsToViewIncident(userID, incidentID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	incidentToCheck, err := incidentService.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "could not get incident id `%s`", incidentID)
	}

	if pluginAPI.User.HasPermissionToChannel(userID, incidentToCheck.PrimaryChannelID, model.PERMISSION_READ_CHANNEL) {
		return nil
	}

	channel, err := pluginAPI.Channel.Get(incidentToCheck.PrimaryChannelID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get channel to determine permissions, channel id `%s`", incidentToCheck.PrimaryChannelID)
	}

	if channel.Type == model.CHANNEL_OPEN && pluginAPI.User.HasPermissionToTeam(userID, channel.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		return nil
	}

	return ErrNoPermissions
}

func HasPermissionsToViewIncidentFromChannelID(userID, channelID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
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

func HasPermissionsToEditIncident(userID, incidentID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	incidentToCheck, err := incidentService.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "could not get incident id `%s`", incidentID)
	}

	if pluginAPI.User.HasPermissionToChannel(userID, incidentToCheck.PrimaryChannelID, model.PERMISSION_READ_CHANNEL) {
		return nil
	}

	return ErrNoPermissions
}

func HasPermissionsToViewTeam(userID, teamID string, pluginAPI *pluginapi.Client) error {
	if pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PERMISSION_LIST_TEAM_CHANNELS) {
		return nil
	}

	return ErrNoPermissions
}
