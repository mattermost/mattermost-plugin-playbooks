// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package incident

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

type Reminder struct {
	IncidentID string `json:"incident_id"`
}

func (s *ServiceImpl) HandleReminder(key string) {
	incidentToModify, err := s.GetIncident(key)
	if err != nil {
		s.logger.Errorf(errors.Wrapf(err, "HandleReminder failed to get incident id: %s", key).Error())
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

	post := &model.Post{
		Message: fmt.Sprintf("@%s, please provide an update on this incident's progress.", commander.Username),
	}
	model.ParseSlackAttachment(post, attachments)

	id, err := s.poster.PostMessageWithAttachments(incidentToModify.ChannelID, attachments,
		"@%s, please provide an update on this incident's progress.", commander.Username)
	if err != nil {
		s.logger.Errorf(errors.Wrap(err, "HandleReminder error posting reminder message").Error())
		return
	}

	incidentToModify.ReminderPostID = id
	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		s.logger.Errorf(errors.Wrapf(err, "error updating with reminder post id, incident id: %s", incidentToModify.ID).Error())
	}
}

func (s *ServiceImpl) SetReminder(incidentID string, fromNow time.Duration) error {
	if _, err := s.scheduler.ScheduleOnce(incidentID, time.Now().Add(fromNow)); err != nil {
		return errors.Wrap(err, "unable to schedule reminder")
	}

	return nil
}

func (s *ServiceImpl) RemoveReminder(incidentID string) {
	s.scheduler.Cancel(incidentID)
}

// RemoveReminderPost will remove the reminder post in the incident channel (if any).
func (s *ServiceImpl) RemoveReminderPost(incidentID string) error {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve incident")
	}

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
