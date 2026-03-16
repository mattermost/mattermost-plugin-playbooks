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

// IsChannelActiveInTeam verifies that the channel exists, is not archived, and
// belongs to the expected team.
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

		groupUserIDs := make([]string, 0)
		perPage := 1000
		for page := 0; ; page++ {
			users, err := pluginAPI.Group.GetMemberUsers(groupID, page, perPage)
			if err != nil {
				groupLogger.WithError(err).Warn("failed to get group members")
				groupUserIDs = nil
				break
			}
			for _, user := range users {
				groupUserIDs = append(groupUserIDs, user.Id)
			}
			if len(users) < perPage {
				break
			}
		}

		userIDs = append(userIDs, groupUserIDs...)
	}
	return userIDs
}
