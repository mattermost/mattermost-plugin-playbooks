package app

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/pkg/errors"
)

var (
	ErrChannelNotFound          = errors.Errorf("channel not found")
	ErrChannelDeleted           = errors.Errorf("channel deleted")
	ErrChannelNotInExpectedTeam = errors.Errorf("channel in different team")
)

func IsChannelActiveInTeam(channelID string, expectedTeamID string, pluginAPI *pluginapi.Client) error {
	channel, err := pluginAPI.Channel.Get(channelID)
	if err != nil {
		return errors.Wrapf(ErrChannelNotFound, "channel with ID %s does not exist", channelID)
	}

	if channel.DeleteAt != 0 {
		return errors.Wrapf(ErrChannelDeleted, "channel with ID %s is archived", channelID)
	}

	if channel.TeamId != expectedTeamID {
		return errors.Wrapf(ErrChannelNotInExpectedTeam,
			"channel with ID %s is on team with ID %s; expected team ID is %s",
			channelID,
			channel.TeamId,
			expectedTeamID,
		)
	}

	return nil
}
