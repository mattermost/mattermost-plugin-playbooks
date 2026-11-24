// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// TestChecklistStateConstantsMatchAppLayer pins the report's checklist states
// to the canonical app-layer values. If the app layer ever renames a state code,
// this test fails loudly instead of silently rendering all tasks as open.
func TestChecklistStateConstantsMatchAppLayer(t *testing.T) {
	require.Equal(t, app.ChecklistItemStateClosed, report.ChecklistItemStateClosed)
	require.Equal(t, app.ChecklistItemStateSkipped, report.ChecklistItemStateSkipped)
}

// TestRunStatusConstantsMatchAppLayer does the same for run status codes.
func TestRunStatusConstantsMatchAppLayer(t *testing.T) {
	require.Equal(t, app.StatusInProgress, report.RunStatusInProgress)
	require.Equal(t, app.StatusFinished, report.RunStatusFinished)
}
