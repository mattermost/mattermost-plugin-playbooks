package permissions

import (
	"errors"
	"fmt"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/incident"
	"github.com/mattermost/mattermost-server/v5/model"
)

// ErrErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("is not an admin or channel member")

// CheckHasPermissionsToIncidentChannel returns an error if the user does not have permissions to the incident channel.
func CheckHasPermissionsToIncidentChannel(userID, incidentID string, pluginAPI *pluginapi.Client, incidentService incident.Service) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	incident, err := incidentService.GetIncident(incidentID)
	if err != nil {
		return err
	}

	isChannelMember := pluginAPI.User.HasPermissionToChannel(userID, incident.ChannelIDs[0], model.PERMISSION_READ_CHANNEL)
	if !isChannelMember {
		return fmt.Errorf("userID `%s`: %w", userID, ErrNoPermissions)
	}

	return nil
}
