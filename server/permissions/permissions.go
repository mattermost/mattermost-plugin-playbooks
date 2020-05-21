package permissions

import (
	"errors"
	"fmt"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
)

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

// CheckHasPermissionsToIncidentChannel returns an error if the user does not have permissions to the incident channel.
func CheckHasPermissionsToIncidentChannel(userID, incidentID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
	incidentToCheck, err := incidentService.GetIncident(incidentID)
	if err != nil {
		return fmt.Errorf("could not get incident id `%s`: %w", incidentID, err)
	}

	isChannelMember := pluginAPI.User.HasPermissionToChannel(userID, incidentToCheck.PrimaryChannelID, model.PERMISSION_READ_CHANNEL)
	if !isChannelMember {
		return fmt.Errorf("userID `%s`: %w", userID, ErrNoPermissions)
	}

	return nil
}

// CheckHasPermissionsToIncidentTeam returns an error if the user does not have permissions to
// the team that the incident belongs to.
func CheckHasPermissionsToIncidentTeam(userID, incidentID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
	incidentToCheck, err := incidentService.GetIncident(incidentID)
	if err != nil {
		return fmt.Errorf("could not get incident id `%s`: %w", incidentID, err)
	}

	channel, err := pluginAPI.Channel.Get(incidentToCheck.PrimaryChannelID)
	if err != nil {
		return err
	}

	isTeamMember := pluginAPI.User.HasPermissionToTeam(userID, channel.TeamId, model.PERMISSION_VIEW_TEAM)
	if !isTeamMember {
		return fmt.Errorf("userID `%s`: %w", userID, ErrNoPermissions)
	}

	return nil
}
