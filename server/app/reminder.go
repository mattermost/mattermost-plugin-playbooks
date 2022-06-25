// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

func (s *PlaybookRunServiceImpl) HandleReminderToFillRetro(playbookRunID string) {
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

func (s *PlaybookRunServiceImpl) HandleStatusUpdateReminder(playbookRunID string) {
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

func (s *PlaybookRunServiceImpl) HandleScheduledRun(userID, playbookID string) {
	scheduledRun, err := s.store.GetScheduledRun(userID, playbookID)
	if err != nil {
		s.logger.Errorf(errors.Wrapf(err, "failed getting the scheduled run from playbook with ID %q", playbookID).Error())
		return
	}

	s.logger.Debugf("Starting scheduled run: %#v", scheduledRun)

	playbook, err := s.playbookService.Get(playbookID)
	if err != nil {
		s.logger.Errorf(errors.Wrapf(err, "failed getting the playbook with ID %q", playbookID).Error())
		return
	}

	if err := s.permissions.RunCreate(userID, playbook); err != nil {
		s.logger.Errorf(errors.Wrapf(err, "scheduler user has no permissions to create runs").Error())
		return
	}

	run := PlaybookRun{
		OwnerUserID: userID,
		TeamID:      playbook.TeamID,
		Name:        scheduledRun.RunName,
		PlaybookID:  playbook.ID,
	}

	// The following block is copied from api/playbook_runs.go:createPlaybookRun
	{
		if playbook.DeleteAt != 0 {
			s.logger.Errorf("playbook is archived, cannot create a new run using an archived playbook")
			return
		}

		run.Checklists = playbook.Checklists

		// The following block is copied from api/playbook_runs.go:setPlaybookRunChecklist
		{
			// playbooks can only have due dates relative to when a run starts, so we should convert them to absolute timestamp
			now := model.GetMillis()
			for i := range run.Checklists {
				for j := range run.Checklists[i].Items {
					if run.Checklists[i].Items[j].DueDate > 0 {
						run.Checklists[i].Items[j].DueDate += now
					}
				}
			}
		}

		public := playbook.CreatePublicPlaybookRun

		if playbook.RunSummaryTemplateEnabled {
			run.Summary = playbook.RunSummaryTemplate
		}
		run.ReminderMessageTemplate = playbook.ReminderMessageTemplate
		run.StatusUpdateEnabled = playbook.StatusUpdateEnabled
		run.PreviousReminder = time.Duration(playbook.ReminderTimerDefaultSeconds) * time.Second
		run.ReminderTimerDefaultSeconds = playbook.ReminderTimerDefaultSeconds

		run.InvitedUserIDs = []string{}
		run.InvitedGroupIDs = []string{}
		if playbook.InviteUsersEnabled {
			run.InvitedUserIDs = playbook.InvitedUserIDs
			run.InvitedGroupIDs = playbook.InvitedGroupIDs
		}

		if playbook.DefaultOwnerEnabled {
			run.DefaultOwnerID = playbook.DefaultOwnerID
		}

		run.StatusUpdateBroadcastChannelsEnabled = playbook.BroadcastEnabled
		run.BroadcastChannelIDs = playbook.BroadcastChannelIDs

		run.WebhookOnCreationURLs = []string{}
		if playbook.WebhookOnCreationEnabled {
			run.WebhookOnCreationURLs = playbook.WebhookOnCreationURLs
		}

		run.StatusUpdateBroadcastWebhooksEnabled = playbook.WebhookOnStatusUpdateEnabled
		run.WebhookOnStatusUpdateURLs = playbook.WebhookOnStatusUpdateURLs

		run.RetrospectiveEnabled = playbook.RetrospectiveEnabled
		if playbook.RetrospectiveEnabled {
			run.RetrospectiveReminderIntervalSeconds = playbook.RetrospectiveReminderIntervalSeconds
			run.Retrospective = playbook.RetrospectiveTemplate
		}

		permission := model.PermissionCreatePrivateChannel
		permissionMessage := "You are not able to create a private channel"
		if public {
			permission = model.PermissionCreatePublicChannel
			permissionMessage = "You are not able to create a public channel"
		}
		if !s.pluginAPI.User.HasPermissionToTeam(userID, run.TeamID, permission) {
			s.logger.Errorf(errors.Wrap(ErrNoPermissions, permissionMessage).Error())
			return
		}

		s.CreatePlaybookRun(&run, &playbook, userID, public)
	}

	if scheduledRun.Frequency != "" && scheduledRun.Frequency != FreqNever {
		// TODO: Jobs can't be rescheduled within themselves with the same key.
		// As a temporary workaround do it in a delayed goroutine. We should probably fix this.
		go func() {
			time.Sleep(time.Second * 2)

			nextTime, err := getNextTime(scheduledRun.FirstRun, scheduledRun.Frequency)
			if err != nil {
				s.logger.Errorf(errors.Wrapf(err, "next time could not be computed").Error())
				return
			}

			s.logger.Debugf("Scheduling next run at %s", nextTime.Format("2006/01/02, 15:04"))

			_, err = s.scheduler.ScheduleOnce(EncodeScheduledRunKey(userID, playbookID), nextTime)
			if err != nil {
				s.logger.Errorf(errors.Wrapf(err, "next run could not be scheduled").Error())
				return
			}
		}()
	}
}

const (
	FreqNever        = "never"
	FreqDaily        = "daily"
	FreqWeekly       = "weekly"
	FreqMonthly      = "monthly"
	FreqAnnually     = "annually"
	FreqEveryWeekday = "everyweekday"
)

func getNextTime(firstRun time.Time, frequency string) (time.Time, error) {
	now := time.Now()

	var date time.Time

	switch frequency {
	case FreqDaily:
		date = now.AddDate(0, 0, 1)
	case FreqWeekly:
		date = now.AddDate(0, 0, 7)
	case FreqMonthly:
		date = now.AddDate(0, 1, 0)
	case FreqAnnually:
		date = now.AddDate(1, 0, 0)
	case FreqEveryWeekday:
		weekday := now.Weekday()
		switch {
		case weekday < time.Friday:
			date = now.AddDate(0, 0, 1)
		case weekday == time.Friday:
			date = now.AddDate(0, 0, 3)
		case weekday == time.Saturday:
			date = now.AddDate(0, 0, 2)
		case weekday == time.Sunday:
			date = now.AddDate(0, 0, 1)
		}

	default:
		return date, errors.Errorf("frequency value %q unknown", frequency)
	}

	// Get the year, month and day from the new computed date,
	// but the hour and minute from the first run, so we don't accumulate errors
	dateTime := time.Date(date.Year(), date.Month(), date.Day(), firstRun.Hour(), firstRun.Minute(), 0, 0, date.Location())

	return dateTime, nil
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

	message := fmt.Sprintf("Status update is overdue for [%s](/%s/channels/%s?telem_action=todo_overduestatus_clicked&telem_run_id=%s&forceRHSOpen) (Owner: @%s)\n",
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

// resetReminderTimer sets the previous reminder timer to 0.
func (s *PlaybookRunServiceImpl) resetReminderTimer(playbookRunID string) error {
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
