// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost/server/public/model"
)

func TestChecklistRevisionRejectsStaleWrites(t *testing.T) {
	db := setupTestDB(t)
	runStore := setupPlaybookRunStore(t, db)
	sqlStore := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	created, err := runStore.CreatePlaybookRun(NewBuilder(t).WithChecklists([]int{1}).ToPlaybookRun())
	require.NoError(t, err)
	createPlaybookRunChannel(t, sqlStore, created)

	baseline, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Zero(t, baseline.TaskActivityRevision)

	checklistChange := baseline.Clone()
	checklistChange.Checklists[0].Title = "updated checklist"
	updated, err := runStore.UpdatePlaybookRun(checklistChange)
	require.NoError(t, err)
	require.Equal(t, int64(1), updated.TaskActivityRevision)

	runOnlyChange := updated.Clone()
	runOnlyChange.Summary = "updated summary"
	updated, err = runStore.UpdatePlaybookRun(runOnlyChange)
	require.NoError(t, err)
	require.Equal(t, int64(1), updated.TaskActivityRevision)

	stale := baseline.Clone()
	stale.Checklists[0].Title = "stale checklist"
	_, err = runStore.UpdatePlaybookRun(stale)
	require.ErrorContains(t, err, "task activity revision changed during update")

	persisted, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Equal(t, int64(1), persisted.TaskActivityRevision)
	require.Equal(t, "updated checklist", persisted.Checklists[0].Title)
	require.Equal(t, "updated summary", persisted.Summary)
}

func TestTaskEventRevisionAndLinkLifecycle(t *testing.T) {
	db := setupTestDB(t)
	runStore := setupPlaybookRunStore(t, db)
	sqlStore := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	created, err := runStore.CreatePlaybookRun(NewBuilder(t).WithChecklists([]int{1}).ToPlaybookRun())
	require.NoError(t, err)
	createPlaybookRunChannel(t, sqlStore, created)

	previous, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	checked := previous.Clone()
	checked.Checklists[0].Items[0].State = app.ChecklistItemStateClosed
	checked.Checklists[0].Items[0].StateModified = 12345
	checkEvent := taskStateRevisionEvent(created.ID, checked.Checklists[0].Items[0].ID, 12345, "check")
	checked, committedCheckEvent, err := runStore.UpdatePlaybookRunWithTimelineEvent(previous, checked, checkEvent, 0, 0)
	require.NoError(t, err)
	require.Equal(t, int64(1), checked.TaskActivityRevision)
	require.Equal(t, &committedCheckEvent.ID, checked.Checklists[0].Items[0].StateEventID)

	unattributed := checked.Clone()
	unattributed.Checklists[0].Items[0].State = app.ChecklistItemStateOpen
	unattributed.Checklists[0].Items[0].StateModified = 12346
	unattributed, err = runStore.UpdatePlaybookRun(unattributed)
	require.NoError(t, err)
	require.Equal(t, int64(2), unattributed.TaskActivityRevision)
	require.Nil(t, unattributed.Checklists[0].Items[0].StateEventID)

	skipped := unattributed.Clone()
	skipped.Checklists[0].Items[0].State = app.ChecklistItemStateSkipped
	skipped.Checklists[0].Items[0].StateModified = 12347
	skipEvent := taskStateRevisionEvent(created.ID, skipped.Checklists[0].Items[0].ID, 12347, "skip")
	skipped, committedSkipEvent, err := runStore.UpdatePlaybookRunWithTimelineEvent(unattributed, skipped, skipEvent, 0, 0)
	require.NoError(t, err)
	require.Equal(t, int64(3), skipped.TaskActivityRevision)
	require.Equal(t, &committedSkipEvent.ID, skipped.Checklists[0].Items[0].StateEventID)

	committedSkipEvent.DeleteAt = model.GetMillis()
	require.NoError(t, runStore.UpdateTimelineEvent(committedSkipEvent))
	afterDeletion, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Equal(t, int64(4), afterDeletion.TaskActivityRevision)
	require.Nil(t, afterDeletion.Checklists[0].Items[0].StateEventID)

	require.NoError(t, runStore.UpdateTimelineEvent(committedSkipEvent))
	afterDuplicate, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Equal(t, afterDeletion.TaskActivityRevision, afterDuplicate.TaskActivityRevision)
}

func taskStateRevisionEvent(runID, itemID string, eventAt int64, action string) *app.TimelineEvent {
	return &app.TimelineEvent{
		PlaybookRunID: runID,
		EventType:     app.TaskStateModified,
		EventAt:       eventAt,
		CreateAt:      eventAt,
		SubjectUserID: model.NewId(),
		Details:       fmt.Sprintf(`{"action":%q,"item_id":%q}`, action, itemID),
	}
}
