// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
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

// FilterAuthorizedGroupIDs returns only the group IDs that the given user is
// authorized to view. This mirrors the Mattermost REST API permission model:
// syncable groups (LDAP/plugin) without AllowReference require the
// SysconsoleReadUserManagementGroups permission; groups with AllowReference are
// viewable by any authenticated user. Groups that don't exist are silently
// dropped.
func FilterAuthorizedGroupIDs(groupIDs []string, userID string, pluginAPI *pluginapi.Client, logger logrus.FieldLogger) []string {
	var authorized []string
	for _, groupID := range groupIDs {
		group, err := pluginAPI.Group.Get(groupID)
		if err != nil {
			logger.WithField("group_id", groupID).WithError(err).Warn("skipping group: unable to fetch")
			continue
		}

		// Syncable groups without AllowReference require admin permission.
		if group.IsSyncable() && !group.AllowReference {
			if !pluginAPI.User.HasPermissionTo(userID, model.PermissionSysconsoleReadUserManagementGroups) {
				logger.WithField("group_id", groupID).Warn("skipping group: user lacks permission to view syncable group")
				continue
			}
		}

		authorized = append(authorized, groupID)
	}
	return authorized
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

		var groupUserIDs []string
		perPage := 1000
		fetchErr := false
		for page := 0; ; page++ {
			users, err := pluginAPI.Group.GetMemberUsers(groupID, page, perPage)
			if err != nil {
				groupLogger.WithError(err).Warn("failed to get group members")
				fetchErr = true
				break
			}
			for _, user := range users {
				groupUserIDs = append(groupUserIDs, user.Id)
			}
			if len(users) < perPage {
				break
			}
		}
		if !fetchErr {
			userIDs = append(userIDs, groupUserIDs...)
		}
	}
	return userIDs
}
