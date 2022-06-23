// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"

	"github.com/mattermost/mattermost-plugin-api/cluster"
)

const RetrospectivePrefix = "retro_"
const PlaybookSchedulerPrefix = "playbook-scheduler_"

type SchedulerHandler struct {
	scheduler   *cluster.JobOnceScheduler
	playbookRun PlaybookRunScheduler
}

type PlaybookRunScheduler interface {
	HandleReminderToFillRetro(playbookRunID string)
	HandleStatusUpdateReminder(playbookRunID string)
	HandleScheduledRun(playbookID string)
}

func NewSchedulerHandler(scheduler *cluster.JobOnceScheduler, playbookRunService PlaybookRunService) *SchedulerHandler {
	return &SchedulerHandler{
		scheduler:   scheduler,
		playbookRun: playbookRunService,
	}
}

// HandleReminder is the handler for all reminder events.
func (s *SchedulerHandler) HandleReminder(key string) {
	switch {
	case strings.HasPrefix(key, RetrospectivePrefix):
		s.playbookRun.HandleReminderToFillRetro(strings.TrimPrefix(key, RetrospectivePrefix))
	case strings.HasPrefix(key, PlaybookSchedulerPrefix):
		s.playbookRun.HandleScheduledRun(strings.TrimPrefix(key, PlaybookSchedulerPrefix))
	default:
		s.playbookRun.HandleStatusUpdateReminder(key)
	}
}
