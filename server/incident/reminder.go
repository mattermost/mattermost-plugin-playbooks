// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package incident

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const (
	reminderPrefix = "reminder_"
)

type Reminder struct {
	CommanderID string `json:"commander_id"`
	ChannelID   string `json:"channel_id"`
}

func (s *ServiceImpl) SetReminder(incdnt *Incident, timeInMinutes time.Duration) error {
	key := model.NewId()
	reminder := Reminder{
		CommanderID: incdnt.CommanderUserID,
		ChannelID:   incdnt.ChannelID,
	}

	if _, err := s.pluginAPI.KV.Set(reminderPrefix+key, reminder); err != nil {
		return errors.Wrap(err, "unable to set reminder data in kv store")
	}

	s.scheduler.ScheduleOnce(key, time.Now().Add(time.Duration(timeInMinutes)*time.Minute))

	return nil
}

func (s *ServiceImpl) HandleReminder(key string) {
	var reminder Reminder
	err := s.pluginAPI.KV.Get(reminderPrefix+key, &reminder)
	if err != nil || reminder.CommanderID == "" {
		// reminder with key wasn't found
		return
	}

	s.pluginAPI.Post.CreatePost()
}
