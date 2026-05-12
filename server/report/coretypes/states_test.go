// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package coretypes_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
)

// TestChecklistStateConstantsMatchAppLayer pins coretypes constants to the
// canonical app-layer values. If the app layer ever renames a state code,
// this test fails loudly instead of silently rendering all tasks as open.
func TestChecklistStateConstantsMatchAppLayer(t *testing.T) {
	require.Equal(t, app.ChecklistItemStateOpen, coretypes.ChecklistItemStateOpen)
	require.Equal(t, app.ChecklistItemStateInProgress, coretypes.ChecklistItemStateInProgress)
	require.Equal(t, app.ChecklistItemStateClosed, coretypes.ChecklistItemStateClosed)
	require.Equal(t, app.ChecklistItemStateSkipped, coretypes.ChecklistItemStateSkipped)
}

// TestRunStatusConstantsMatchAppLayer does the same for run status codes.
func TestRunStatusConstantsMatchAppLayer(t *testing.T) {
	require.Equal(t, app.StatusInProgress, coretypes.RunStatusInProgress)
	require.Equal(t, app.StatusFinished, coretypes.RunStatusFinished)
}
