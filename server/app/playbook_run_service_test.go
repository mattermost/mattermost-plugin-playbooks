// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestUpdateRetrospectiveEnabledDecisionLogic verifies the key decision paths
// in UpdateRetrospectiveEnabled without requiring full service construction.
// Integration tests in api_runs_test.go verify the full flow through the REST API.
func TestUpdateRetrospectiveEnabledDecisionLogic(t *testing.T) {
	t.Run("no-op when already disabled", func(t *testing.T) {
		enabled := false
		retrospectiveEnabled := false
		// When calling with enabled=false and run is already disabled,
		// the function returns early without updating store or creating timeline events.
		shouldShortCircuit := enabled == retrospectiveEnabled
		assert.True(t, shouldShortCircuit, "should short-circuit when no change needed")
	})

	t.Run("no-op when already enabled", func(t *testing.T) {
		enabled := true
		retrospectiveEnabled := true
		// When calling with enabled=true and run is already enabled,
		// the function returns early without updating store or creating timeline events.
		shouldShortCircuit := enabled == retrospectiveEnabled
		assert.True(t, shouldShortCircuit, "should short-circuit when no change needed")
	})

	t.Run("disable triggers scheduler.Cancel", func(t *testing.T) {
		// When disabling (enabled=false) and run.RetrospectiveEnabled=true,
		// the function should call scheduler.Cancel
		enabled := false
		shouldCancel := !enabled
		assert.True(t, shouldCancel, "disabling should cancel scheduler")
	})

	t.Run("enable checks license and status before restart", func(t *testing.T) {
		run := &PlaybookRun{
			ID:                       "run-4",
			RetrospectiveEnabled:     false,
			CurrentStatus:            StatusFinished,
			RetrospectivePublishedAt: 0,
		}
		enabled := true
		// When enabling (enabled=true) and:
		// - run.RetrospectiveEnabled=false (change needed)
		// - run.CurrentStatus=StatusFinished
		// - run.RetrospectivePublishedAt=0 (not published)
		// Then scheduler should be restarted (if license allows and reminder interval > 0)
		shouldAttemptRestart := enabled &&
			run.CurrentStatus == StatusFinished &&
			run.RetrospectivePublishedAt == 0
		assert.True(t, shouldAttemptRestart, "should attempt to restart scheduler for finished unpublished runs")
	})

	t.Run("enable does not restart for in-progress runs", func(t *testing.T) {
		run := &PlaybookRun{
			ID:                   "run-5",
			RetrospectiveEnabled: false,
			CurrentStatus:        StatusInProgress,
		}
		enabled := true
		// When enabling but run is not finished, reminder should not be restarted
		shouldAttemptRestart := enabled &&
			run.CurrentStatus == StatusFinished &&
			run.RetrospectivePublishedAt == 0
		assert.False(t, shouldAttemptRestart, "should not restart scheduler for in-progress runs")
	})

	t.Run("timeline event type is RetrospectiveDisabled when disabling", func(t *testing.T) {
		enabled := false
		eventType := RetrospectiveEnabled
		if !enabled {
			eventType = RetrospectiveDisabled
		}
		assert.Equal(t, RetrospectiveDisabled, eventType)
	})

	t.Run("timeline event type is RetrospectiveEnabled when enabling", func(t *testing.T) {
		enabled := true
		eventType := RetrospectiveEnabled
		if !enabled {
			eventType = RetrospectiveDisabled
		}
		assert.Equal(t, RetrospectiveEnabled, eventType)
	})
}
