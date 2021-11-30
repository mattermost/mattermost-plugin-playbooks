package app

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

// broadcasting to channels

func (s *PlaybookRunServiceImpl) broadcastPlaybookRunCreationToChannels(channelIDs []string, message string, playbookRun *PlaybookRun, runChannelID string) error {
	for _, broadcastChannelID := range channelIDs {
		if err := s.broadcastPlaybookRunMessage(broadcastChannelID, message, "creation", playbookRun); err != nil {
			s.pluginAPI.Log.Warn("failed to broadcast the playbook run creation to channel", "ChannelID", playbookRun.BroadcastChannelIDs, "error", err)

			if _, err = s.poster.PostMessage(runChannelID, "Failed to announce the creation of this playbook run in the configured channel."); err != nil {
				return errors.Wrapf(err, "failed to post to channel")
			}
		}
	}
	return nil
}

func (s *PlaybookRunServiceImpl) broadcastPlaybookRunMessageToChannels(channelIDs []string, message string, messageType string, playbookRun *PlaybookRun) {
	for _, broadcastChannelID := range channelIDs {
		if err := s.broadcastPlaybookRunMessage(message, messageType, broadcastChannelID, playbookRun); err != nil {
			s.pluginAPI.Log.Warn(fmt.Sprintf("failed to broadcast run %s to channel", messageType))
		}
	}
}

func (s *PlaybookRunServiceImpl) broadcastStatusUpdateToChannels(channelIDs []string, post *model.Post, playbookRunID string, authorID string) {
	for _, channelID := range channelIDs {
		post.Id = "" // Reset the ID so we avoid cloning the whole object
		post.ChannelId = channelID
		if err := s.postMessageToThreadAndSaveRootID(playbookRunID, channelID, post); err != nil {
			s.pluginAPI.Log.Warn("failed to broadcast the status update to channel",
				"channel_id", channelID, "error", err.Error())
		}
	}
}

func (s *PlaybookRunServiceImpl) broadcastPlaybookRunMessage(broadcastChannelID, message, messageType string, playbookRun *PlaybookRun) error {
	post := &model.Post{Message: message, ChannelId: broadcastChannelID}

	if err := IsChannelActiveInTeam(post.ChannelId, playbookRun.TeamID, s.pluginAPI); err != nil {
		return errors.Wrap(err, "announcement channel is not active")
	}

	if err := s.postMessageToThreadAndSaveRootID(playbookRun.ID, post.ChannelId, post); err != nil {
		return errors.Wrapf(err, "error posting '%s' message, for playbook '%s', to channelID '%s'", messageType, playbookRun.ID, post.ChannelId)
	}

	return nil
}

// broadcast to users who follow

func (s *PlaybookRunServiceImpl) broadcastPostToRunFollowers(post *model.Post, messageType, playbookRunID, authorID string) {
	followers, err := s.GetFollowers(playbookRunID)
	if err != nil {
		s.pluginAPI.Log.Warn(fmt.Sprintf("failed to broadcast run %s to run followers", messageType))
		return
	}

	s.broadcastPostToUsersWithPermission(followers, post, playbookRunID, authorID)
}

func (s *PlaybookRunServiceImpl) broadcastPostToAutoFollows(post *model.Post, playbookID, playbookRunID, authorID string) {
	autoFollows, err := s.playbookService.GetAutoFollows(playbookID)
	if err != nil {
		s.pluginAPI.Log.Warn("failed to broadcast run creation to auto-follows for the playbook", "PlaybookID", playbookID, "error", err)
		return
	}

	s.broadcastPostToUsersWithPermission(autoFollows, post, playbookRunID, authorID)
}

func (s *PlaybookRunServiceImpl) broadcastPostToUsersWithPermission(users []string, post *model.Post, playbookRunID, authorID string) {
	for _, user := range users {
		// Do not send update to the author
		if user == authorID {
			continue
		}
		// Check for access permissions
		if err := UserCanViewPlaybookRun(user, playbookRunID, s.playbookService, s, s.pluginAPI); err != nil {
			continue
		}

		post.Id = "" // Reset the ID so we avoid cloning the whole object
		post.RootId = ""
		if err := s.poster.DM(user, post); err != nil {
			s.pluginAPI.Log.Warn("failed to broadcast post to the user",
				"user", user, "error", err.Error())
		}
	}
}
