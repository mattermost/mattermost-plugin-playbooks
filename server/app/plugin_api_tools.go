// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/pluginapi"
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

	// Skip team check for DM/GM runs (empty expectedTeamID) since they have no team context.
	// Also skip if the broadcast channel is a DM/GM (empty TeamId) which can receive messages
	// regardless of the run's team.
	if expectedTeamID != "" && channel.TeamId != "" && channel.TeamId != expectedTeamID {
		return errors.Wrapf(ErrChannelNotInExpectedTeam,
			"channel with ID %s is on team with ID %s; expected team ID is %s",
			channelID,
			channel.TeamId,
			expectedTeamID,
		)
	}

	return nil
}

// ResolveGroupMembers expands group IDs into user IDs by fetching members of
// each group. Only groups with AllowReference enabled are expanded. Errors are
// logged and the group is skipped rather than failing the whole operation.
func ResolveGroupMembers(groupIDs []string, pluginAPI *pluginapi.Client, logger logrus.FieldLogger) []string {
	var userIDs []string
	for _, groupID := range groupIDs {
		groupLogger := logger.WithField("group_id", groupID)

		group, err := pluginAPI.Group.Get(groupID)
		if err != nil {
			groupLogger.WithError(err).Warn("failed to resolve group")
			continue
		}
		if !group.AllowReference {
			groupLogger.Warn("skipping group that does not allow reference")
			continue
		}

		perPage := 1000
		for page := 0; ; page++ {
			users, err := pluginAPI.Group.GetMemberUsers(groupID, page, perPage)
			if err != nil {
				groupLogger.WithError(err).Warn("failed to get group members")
				break
			}
			for _, user := range users {
				userIDs = append(userIDs, user.Id)
			}
			if len(users) < perPage {
				break
			}
		}
	}
	return userIDs
}
