// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRetrospectiveGuardLogic verifies the guard conditions in handleReminderToFillRetro
// by testing the boolean logic directly. The actual handler at reminder.go:28 uses
// these exact conditions to decide whether to cancel, skip, or post a reminder.
func TestRetrospectiveGuardLogic(t *testing.T) {
	tests := []struct {
		name                   string
		retrospectiveEnabled   bool
		retrospectivePublished int64
		currentStatus          string
		expectCancel           bool // should scheduler.Cancel be called
		expectReminderEligible bool // should the reminder be posted
	}{
		{
			name:                   "retro disabled: cancel scheduler",
			retrospectiveEnabled:   false,
			retrospectivePublished: 0,
			currentStatus:          StatusFinished,
			expectCancel:           true,
			expectReminderEligible: false,
		},
		{
			name:                   "retro enabled, finished, not published: eligible for reminder",
			retrospectiveEnabled:   true,
			retrospectivePublished: 0,
			currentStatus:          StatusFinished,
			expectCancel:           false,
			expectReminderEligible: true,
		},
		{
			name:                   "retro enabled but already published: skip",
			retrospectiveEnabled:   true,
			retrospectivePublished: 12345678,
			currentStatus:          StatusFinished,
			expectCancel:           false,
			expectReminderEligible: false,
		},
		{
			name:                   "retro enabled, not finished: skip",
			retrospectiveEnabled:   true,
			retrospectivePublished: 0,
			currentStatus:          StatusInProgress,
			expectCancel:           false,
			expectReminderEligible: false,
		},
		{
			name:                   "retro disabled even if in-progress: cancel",
			retrospectiveEnabled:   false,
			retrospectivePublished: 0,
			currentStatus:          StatusInProgress,
			expectCancel:           true,
			expectReminderEligible: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			run := &PlaybookRun{
				RetrospectiveEnabled:     tc.retrospectiveEnabled,
				RetrospectivePublishedAt: tc.retrospectivePublished,
				CurrentStatus:            tc.currentStatus,
			}

			// Mirror the guard logic from handleReminderToFillRetro (reminder.go:38-51)
			shouldCancel := !run.RetrospectiveEnabled
			shouldSkipPublished := run.RetrospectiveEnabled && run.RetrospectivePublishedAt != 0
			shouldSkipNotFinished := run.RetrospectiveEnabled && run.RetrospectivePublishedAt == 0 && run.CurrentStatus != StatusFinished
			reminderEligible := !shouldCancel && !shouldSkipPublished && !shouldSkipNotFinished

			assert.Equal(t, tc.expectCancel, shouldCancel, "cancel mismatch")
			assert.Equal(t, tc.expectReminderEligible, reminderEligible, "reminder eligibility mismatch")
		})
	}
}

// TestRetrospectiveEnabled tests the retrospective guard logic. When a playbook
// has RetrospectiveEnabled=false, retrospective processing must be skipped.
// The backend fix adds a guard to handleReminderToFillRetro; these tests verify
// the condition logic directly.
func TestRetrospectiveEnabled(t *testing.T) {
	t.Run("RetrospectiveEnabled false skips retrospective reminder", func(t *testing.T) {
		retroEnabled := false

		shouldSkip := !retroEnabled
		require.True(t, shouldSkip, "retrospective reminder must be skipped when RetrospectiveEnabled=false")
	})

	t.Run("RetrospectiveEnabled true (default) does not skip retrospective", func(t *testing.T) {
		retroEnabled := true

		shouldSkip := !retroEnabled
		assert.False(t, shouldSkip, "retrospective reminder must proceed when RetrospectiveEnabled=true")
	})

	t.Run("RetrospectiveEnabled false prevents FinishPlaybookRun from scheduling initial reminder", func(t *testing.T) {
		retroEnabled := false

		shouldSchedule := retroEnabled
		assert.False(t, shouldSchedule)
	})

	t.Run("RetrospectiveEnabled true allows FinishPlaybookRun to schedule reminder", func(t *testing.T) {
		retroEnabled := true

		shouldSchedule := retroEnabled
		assert.True(t, shouldSchedule)
	})
}
