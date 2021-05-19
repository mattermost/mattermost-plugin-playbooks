// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package incident

import (
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type Reminder struct {
	IncidentID string `json:"incident_id"`
}

const RetrospectivePrefix = "retro_"

// HandleReminder is the handler for all reminder events.
func (s *ServiceImpl) HandleReminder(key string) {
	if strings.HasPrefix(key, RetrospectivePrefix) {
		s.handleReminderToFillRetro(strings.TrimPrefix(key, RetrospectivePrefix))
	} else {
		s.handleStatusUpdateReminder(key)
	}
}

func (s *ServiceImpl) handleReminderToFillRetro(incidentID string) {
	incidentToRemind, err := s.GetIncident(incidentID)
	if err != nil {
		s.logger.Errorf(errors.Wrapf(err, "handleReminderToFillRetro failed to get incident id: %s", incidentID).Error())
		return
	}

	// In the meantime we did publish a retrospective, so no reminder.
	if incidentToRemind.RetrospectivePublishedAt != 0 {
		return
	}

	if err = s.postRetrospectiveReminder(incidentToRemind); err != nil {
		s.logger.Errorf(errors.Wrapf(err, "couldn't post incident reminder").Error())
		return
	}

	// Jobs can't be rescheduled within themselves with the same key. As a temporary workaround do it in a delayed goroutine
	go func() {
		time.Sleep(time.Second * 2)
		if err = s.SetReminder(RetrospectivePrefix+incidentID, time.Duration(incidentToRemind.RetrospectiveReminderIntervalSeconds)*time.Second); err != nil {
			s.logger.Errorf(errors.Wrap(err, "failed to reocurr retrospective reminder").Error())
			return
		}
	}()
}

func (s *ServiceImpl) handleStatusUpdateReminder(incidentID string) {
	incidentToModify, err := s.GetIncident(incidentID)
	if err != nil {
		s.logger.Errorf(errors.Wrapf(err, "HandleReminder failed to get incident id: %s", incidentID).Error())
		return
	}

	commander, err := s.pluginAPI.User.Get(incidentToModify.CommanderUserID)
	if err != nil {
		s.logger.Errorf(errors.Wrapf(err, "HandleReminder failed to get commander for id: %s", incidentToModify.CommanderUserID).Error())
		return
	}

	attachments := []*model.SlackAttachment{
		{
			Actions: []*model.PostAction{
				{
					Type: "button",
					Name: "Update Status",
					Integration: &model.PostActionIntegration{
						URL: fmt.Sprintf("/plugins/%s/api/v0/incidents/%s/reminder/button-update",
							s.configService.GetManifest().Id,
							incidentToModify.ID),
					},
				},
				{
					Type: "button",
					Name: "Dismiss",
					Integration: &model.PostActionIntegration{
						URL: fmt.Sprintf("/plugins/%s/api/v0/incidents/%s/reminder/button-dismiss",
							s.configService.GetManifest().Id,
							incidentToModify.ID),
					},
				},
			},
		},
	}

	post, err := s.poster.PostMessageWithAttachments(incidentToModify.ChannelID, attachments,
		"@%s, please provide an update on this incident's progress.", commander.Username)
	if err != nil {
		s.logger.Errorf(errors.Wrap(err, "HandleReminder error posting reminder message").Error())
		return
	}

	incidentToModify.ReminderPostID = post.Id
	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		s.logger.Errorf(errors.Wrapf(err, "error updating with reminder post id, incident id: %s", incidentToModify.ID).Error())
	}
}

// SetReminder sets a reminder. After timeInMinutes in the future, the commander will be
// reminded to update the incident's status.
func (s *ServiceImpl) SetReminder(incidentID string, fromNow time.Duration) error {
	if _, err := s.scheduler.ScheduleOnce(incidentID, time.Now().Add(fromNow)); err != nil {
		return errors.Wrap(err, "unable to schedule reminder")
	}

	return nil
}

// RemoveReminder removes the pending reminder for incidentID (if any).
func (s *ServiceImpl) RemoveReminder(incidentID string) {
	s.scheduler.Cancel(incidentID)
}

// RemoveReminderPost will remove the reminder post in the incident channel (if any).
func (s *ServiceImpl) RemoveReminderPost(incidentID string) error {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve incident")
	}

	return s.removeReminderPost(incidentToModify)
}

// removeReminderPost will remove the reminder post in the incident channel (if any).
func (s *ServiceImpl) removeReminderPost(incidentToModify *Incident) error {
	if incidentToModify.ReminderPostID == "" {
		return nil
	}

	post, err := s.pluginAPI.Post.GetPost(incidentToModify.ReminderPostID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve reminder post")
	}

	if post.DeleteAt != 0 {
		return nil
	}

	if err = s.pluginAPI.Post.DeletePost(incidentToModify.ReminderPostID); err != nil {
		return errors.Wrapf(err, "failed to delete reminder post")
	}

	incidentToModify.ReminderPostID = ""
	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "error updating incident removing reminder post id")
	}

	return nil
}
