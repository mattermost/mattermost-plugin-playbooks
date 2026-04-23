// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestRunMessageBuildersUseSiteURL(t *testing.T) {
	service := &PlaybookRunServiceImpl{}
	run := &PlaybookRun{
		ID:   "run-id",
		Name: "Incident Alpha",
	}

	assert.Contains(t, service.buildRunFinishedMessage(run, "alice", "http://mattermost.com/subpath"), "http://mattermost.com/subpath/playbooks/runs/run-id")
	assert.Contains(t, service.buildStatusUpdateMessage(run, "alice", "enabled", "http://mattermost.com/subpath"), "http://mattermost.com/subpath/playbooks/runs/run-id")
}

func TestDigestBuildersUseSiteURL(t *testing.T) {
	runs := []AssignedRun{{
		RunLink: RunLink{
			PlaybookRunID: "run-id",
			Name:          "Incident Alpha",
		},
		Tasks: []AssignedTask{{
			ChecklistTitle: "Checklist",
			ChecklistItem: ChecklistItem{
				Title: "Investigate",
				DueDate: time.Now().
					Add(24 * time.Hour).
					UnixMilli(),
			},
		}},
	}}

	assignedSummary := buildAssignedTaskMessageSummary(runs, "en", time.UTC, false, "http://mattermost.com/subpath")
	inProgressSummary := buildRunsInProgressMessage([]RunLink{{PlaybookRunID: "run-id", Name: "Incident Alpha"}}, "en", "http://mattermost.com/subpath")
	overdueSummary := buildRunsOverdueMessage([]RunLink{{PlaybookRunID: "run-id", Name: "Incident Alpha"}}, "en", "http://mattermost.com/subpath")

	assert.Contains(t, assignedSummary, "http://mattermost.com/subpath/playbooks/runs/run-id?from=digest_assignedtask")
	assert.Contains(t, inProgressSummary, "http://mattermost.com/subpath/playbooks/runs/run-id?from=digest_runsinprogress")
	assert.Contains(t, overdueSummary, "http://mattermost.com/subpath/playbooks/runs/run-id?from=digest_overduestatus")
}
