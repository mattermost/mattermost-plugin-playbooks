// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package incident

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const (
	reminderPrefix = "reminder_"
)

type Reminder struct {
	IncidentID string `json:"incident_id"`
}

func (s *ServiceImpl) HandleReminder(key string) {
	var reminder Reminder
	err := s.pluginAPI.KV.Get(reminderPrefix+key, &reminder)
	if err != nil || reminder.IncidentID == "" {
		// reminder with key wasn't found
		return
	}

	incidentToModify, err := s.GetIncident(reminder.IncidentID)
	if err != nil {
		s.logger.Errorf("cannot get incident id: %s", reminder.IncidentID)
		return
	}

	commander, err := s.pluginAPI.User.Get(incidentToModify.CommanderUserID)
	if err != nil {
		s.logger.Errorf("cannot get commander user for id: %s", incidentToModify.CommanderUserID)
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

	id, err := s.poster.PostMessageWithAttachments(incidentToModify.ChannelID,
		fmt.Sprintf("@%s, please provide an update on this incident's progress.", commander.Username),
		attachments)
	if err != nil {
		s.logger.Errorf(errors.Wrap(err, "error posting reminder message").Error())
		return
	}

	incidentToModify.ReminderPostID = id
	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		s.logger.Errorf(errors.Wrapf(err, "error updating with reminder post id, incident id: %s", incidentToModify.ID).Error())
	}
}

func (s *ServiceImpl) SetReminder(incidentID string, timeInMinutes time.Duration) error {
	incidentToModify, err := s.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident from store")
	}

	key := model.NewId()
	reminder := Reminder{IncidentID: incidentID}

	if _, err := s.pluginAPI.KV.Set(reminderPrefix+key, reminder); err != nil {
		return errors.Wrap(err, "unable to set reminder data in kv store")
	}

	// FIXME
	//if _, err := s.scheduler.ScheduleOnce(key, time.Now().Add(timeInMinutes*time.Minute)); err != nil {
	if _, err := s.scheduler.ScheduleOnce(key, time.Now().Add(10*time.Second)); err != nil {
		return errors.Wrap(err, "unable to schedule reminder")
	}

	incidentToModify.ReminderID = key
	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "error updating incident with reminder id")
	}

	return nil
}

func (s *ServiceImpl) RemoveReminder(incidentID string) error {
	incidentToModify, err := s.GetIncident(incidentID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve incident from store")
	}

	if incidentToModify.ReminderID == "" {
		return nil
	}

	s.scheduler.Close(incidentToModify.ReminderID)
	if err := s.pluginAPI.KV.Delete(reminderPrefix + incidentToModify.ReminderID); err != nil {
		return errors.Wrap(err, "unable to delete reminder data from kv store")
	}

	incidentToModify.ReminderID = ""
	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return errors.Wrapf(err, "error updating incident removing reminder id")
	}

	return nil
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
