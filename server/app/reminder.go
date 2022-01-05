// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

const RetrospectivePrefix = "retro_"

// HandleReminder is the handler for all reminder events.
func (s *PlaybookRunServiceImpl) HandleReminder(key string) {
	if strings.HasPrefix(key, RetrospectivePrefix) {
		s.handleReminderToFillRetro(strings.TrimPrefix(key, RetrospectivePrefix))
	} else {
		s.handleStatusUpdateReminder(key)
	}
}

func (s *PlaybookRunServiceImpl) handleReminderToFillRetro(playbookRunID string) {
	playbookRunToRemind, err := s.GetPlaybookRun(playbookRunID)
	if err != nil {
		s.logger.Errorf(errors.Wrapf(err, "handleReminderToFillRetro failed to get playbook run id: %s", playbookRunID).Error())
		return
	}

	// In the meantime we did publish a retrospective, so no reminder.
	if playbookRunToRemind.RetrospectivePublishedAt != 0 {
		return
	}

	// If we are not in the finished state then don't remind
	if playbookRunToRemind.CurrentStatus != StatusFinished {
		return
	}

	if err = s.postRetrospectiveReminder(playbookRunToRemind, false); err != nil {
		s.logger.Errorf(errors.Wrapf(err, "couldn't post reminder").Error())
		return
	}

	// Jobs can't be rescheduled within themselves with the same key. As a temporary workaround do it in a delayed goroutine
	go func() {
		time.Sleep(time.Second * 2)
		if err = s.SetReminder(RetrospectivePrefix+playbookRunID, time.Duration(playbookRunToRemind.RetrospectiveReminderIntervalSeconds)*time.Second); err != nil {
			s.logger.Errorf(errors.Wrap(err, "failed to reocurr retrospective reminder").Error())
			return
		}
	}()
}

func (s *PlaybookRunServiceImpl) handleStatusUpdateReminder(playbookRunID string) {
	playbookRunToModify, err := s.GetPlaybookRun(playbookRunID)
	if err != nil {
		s.logger.Errorf(errors.Wrapf(err, "HandleReminder failed to get playbook run id: %s", playbookRunID).Error())
		return
	}

	owner, err := s.pluginAPI.User.Get(playbookRunToModify.OwnerUserID)
	if err != nil {
		s.logger.Errorf(errors.Wrapf(err, "HandleReminder failed to get owner for id: %s", playbookRunToModify.OwnerUserID).Error())
		return
	}

	attachments := []*model.SlackAttachment{
		{
			Actions: []*model.PostAction{
				{
					Type: "button",
					Name: "Update status",
					Integration: &model.PostActionIntegration{
						URL: fmt.Sprintf("/plugins/%s/api/v0/runs/%s/reminder/button-update",
							s.configService.GetManifest().Id,
							playbookRunToModify.ID),
					},
				},
				{
					Type: "button",
					Name: "Dismiss",
					Integration: &model.PostActionIntegration{
						URL: fmt.Sprintf("/plugins/%s/api/v0/runs/%s/reminder/button-dismiss",
							s.configService.GetManifest().Id,
							playbookRunToModify.ID),
					},
				},
			},
		},
	}

	post := &model.Post{
		Message:   fmt.Sprintf("@%s, please provide a status update.", owner.Username),
		ChannelId: playbookRunToModify.ChannelID,
		Type:      "custom_update_status",
		Props: map[string]interface{}{
			"targetUsername": owner.Username,
		},
	}
	model.ParseSlackAttachment(post, attachments)

	if err := s.poster.PostMessageToThread("", post); err != nil {
		s.logger.Errorf(errors.Wrap(err, "HandleReminder error posting reminder message").Error())
		return
	}

	// broadcast to followers
	message, err := s.buildOverdueStatusUpdateMessage(playbookRunToModify, owner.Username)
	if err != nil {
		s.pluginAPI.Log.Warn("failed to build overdue status update message", "PlaybookRunID", playbookRunToModify.ID, "error", err)
	} else {
		s.dmPostToRunFollowers(&model.Post{Message: message}, overdueStatusUpdateMessage, playbookRunToModify.ID, "")
	}

	playbookRunToModify.ReminderPostID = post.Id
	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		s.logger.Errorf(errors.Wrapf(err, "error updating with reminder post id, playbook run id: %s", playbookRunToModify.ID).Error())
	}
}

func (s *PlaybookRunServiceImpl) buildOverdueStatusUpdateMessage(playbookRun *PlaybookRun, ownerUserName string) (string, error) {
	channel, err := s.pluginAPI.Channel.Get(playbookRun.ChannelID)
	if err != nil {
		return "", errors.Wrapf(err, "can't get channel - %s", playbookRun.ChannelID)
	}

	team, err := s.pluginAPI.Team.Get(channel.TeamId)
	if err != nil {
		return "", errors.Wrapf(err, "can't get team - %s", channel.TeamId)
	}

	message := fmt.Sprintf("Status update is overdue for [%s](/%s/channels/%s?telem=todo_overduestatus_clicked&id=%s&forceRHSOpen) (Owner: @%s)\n",
		channel.DisplayName, team.Name, channel.Name, playbookRun.ID, ownerUserName)

	return message, nil
}

// SetReminder sets a reminder. After timeInMinutes in the future, the owner will be
// reminded to update the playbook run's status.
func (s *PlaybookRunServiceImpl) SetReminder(playbookRunID string, fromNow time.Duration) error {
	if _, err := s.scheduler.ScheduleOnce(playbookRunID, time.Now().Add(fromNow)); err != nil {
		return errors.Wrap(err, "unable to schedule reminder")
	}

	return nil
}

// RemoveReminder removes the pending reminder for the given playbook run, if any.
func (s *PlaybookRunServiceImpl) RemoveReminder(playbookRunID string) {
	s.scheduler.Cancel(playbookRunID)
}

// RemoveReminderPost removes the reminder post in the channel for the given playbook run, if any.
func (s *PlaybookRunServiceImpl) RemoveReminderPost(playbookRunID string) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve playbook run")
	}

	if playbookRunToModify.ReminderPostID == "" {
		return nil
	}

	if err = s.removePost(playbookRunToModify.ReminderPostID); err != nil {
		return err
	}

	playbookRunToModify.ReminderPostID = ""
	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run after removing reminder post id")
	}

	return nil
}

// ResetReminderTimer sets the previous reminder timer to 0.
func (s *PlaybookRunServiceImpl) ResetReminderTimer(playbookRunID string) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve playbook run")
	}

	playbookRunToModify.PreviousReminder = 0
	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run after resetting reminder timer")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)

	return nil
}

// SetNewReminder sets a new reminder for playbookRunID, removes any pending reminder, removes the
// reminder post in the playbookRun's channel, and resets the PreviousReminder and
// LastStatusUpdateAt (so the countdown timer to "update due" shows the correct time)
func (s *PlaybookRunServiceImpl) SetNewReminder(playbookRunID string, newReminder time.Duration) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve playbook run")
	}

	// Remove pending reminder (if any)
	s.RemoveReminder(playbookRunID)

	// Remove reminder post (if any)
	if playbookRunToModify.ReminderPostID != "" {
		if err = s.removePost(playbookRunToModify.ReminderPostID); err != nil {
			return err
		}
		playbookRunToModify.ReminderPostID = ""
	}

	playbookRunToModify.PreviousReminder = newReminder
	playbookRunToModify.LastStatusUpdateAt = model.GetMillis()
	if err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		return errors.Wrapf(err, "failed to update playbook run after resetting reminder timer")
	}

	if newReminder != 0 {
		if err = s.SetReminder(playbookRunID, newReminder); err != nil {
			return errors.Wrap(err, "failed to set the reminder for playbook run")
		}
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)

	return nil
}

func (s *PlaybookRunServiceImpl) removePost(postID string) error {
	post, err := s.pluginAPI.Post.GetPost(postID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve reminder post")
	}

	if post.DeleteAt != 0 {
		return nil
	}

	if err = s.pluginAPI.Post.DeletePost(postID); err != nil {
		return errors.Wrapf(err, "failed to delete reminder post")
	}

	return nil
}
