// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/stretchr/testify/require"
)

func TestTaskStateMutationCapturesCommittedDeltaAfterConcurrentDisjointChange(t *testing.T) {
	db := setupTestDB(t)
	runStore := setupPlaybookRunStore(t, db)
	sqlStore := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	created, err := runStore.CreatePlaybookRun(NewBuilder(t).WithChecklists([]int{2}).ToPlaybookRun())
	require.NoError(t, err)
	createPlaybookRunChannel(t, sqlStore, created)
	certification, err := sqlStore.ActivateTaskActivityCertification(context.Background(), 0)
	require.NoError(t, err)

	baseline, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	first := baseline.Clone()
	first.Checklists[0].Items[0].State = app.ChecklistItemStateClosed
	first.Checklists[0].Items[0].StateModified = 12345
	first, firstEvent, err := runStore.UpdatePlaybookRunWithTimelineEvent(baseline, first, taskStateRevisionEvent(created.ID, first.Checklists[0].Items[0].ID, 12345, "check"), 0, 0)
	require.NoError(t, err)
	require.Equal(t, certification.Epoch, first.CommittedTaskActivityUpdate.TaskActivitySync.Epoch)
	require.Equal(t, "0", first.CommittedTaskActivityUpdate.TaskActivitySync.BaseRevision)
	require.Equal(t, "1", first.CommittedTaskActivityUpdate.TaskActivitySync.Revision)
	require.Equal(t, firstEvent.ID, first.CommittedTaskActivityUpdate.ChangedFields["timeline_events"].([]app.TimelineEvent)[0].ID)

	staleSecond := baseline.Clone()
	staleSecond.Checklists[0].Items[1].State = app.ChecklistItemStateSkipped
	staleSecond.Checklists[0].Items[1].StateModified = 12346
	second, secondEvent, err := runStore.UpdatePlaybookRunWithTimelineEvent(baseline, staleSecond, taskStateRevisionEvent(created.ID, staleSecond.Checklists[0].Items[1].ID, 12346, "skip"), 0, 1)
	require.NoError(t, err)
	require.Equal(t, "1", second.CommittedTaskActivityUpdate.TaskActivitySync.BaseRevision)
	require.Equal(t, "2", second.CommittedTaskActivityUpdate.TaskActivitySync.Revision)
	require.Equal(t, secondEvent.ID, second.CommittedTaskActivityUpdate.ChangedFields["timeline_events"].([]app.TimelineEvent)[0].ID)
	require.NotContains(t, second.CommittedTaskActivityUpdate.ChangedFields["timeline_events"].([]app.TimelineEvent), *firstEvent)
	updates := second.CommittedTaskActivityUpdate.ChangedFields["checklists"].([]app.ChecklistUpdate)
	require.Len(t, updates, 1)
	require.Len(t, updates[0].ItemUpdates, 1)
	require.Equal(t, staleSecond.Checklists[0].Items[1].ID, updates[0].ItemUpdates[0].ID)
	require.Equal(t, &secondEvent.ID, updates[0].ItemUpdates[0].Fields["state_event_id"])
}

func TestChecklistWriterCapturesDeltaAndClearsStaleSnapshotMetadata(t *testing.T) {
	db := setupTestDB(t)
	runStore := setupPlaybookRunStore(t, db)
	sqlStore := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	created, err := runStore.CreatePlaybookRun(NewBuilder(t).WithChecklists([]int{1}).ToPlaybookRun())
	require.NoError(t, err)
	createPlaybookRunChannel(t, sqlStore, created)
	certification, err := sqlStore.ActivateTaskActivityCertification(context.Background(), 0)
	require.NoError(t, err)
	previous, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.True(t, previous.TaskActivitySync.Complete)

	renamed := previous.Clone()
	renamed.Checklists[0].Title = "renamed"
	committed, err := runStore.UpdatePlaybookRun(renamed)
	require.NoError(t, err)
	require.Nil(t, committed.TaskActivitySync)
	require.NotNil(t, committed.CommittedTaskActivityUpdate)
	require.Equal(t, certification.Epoch, committed.CommittedTaskActivityUpdate.TaskActivitySync.Epoch)
	require.Equal(t, "0", committed.CommittedTaskActivityUpdate.TaskActivitySync.BaseRevision)
	require.Equal(t, "1", committed.CommittedTaskActivityUpdate.TaskActivitySync.Revision)
	require.Len(t, committed.CommittedTaskActivityUpdate.ChangedFields["checklists"].([]app.ChecklistUpdate), 1)

	noOp := committed.Clone()
	noOp.Summary = "run-only change"
	committed, err = runStore.UpdatePlaybookRun(noOp)
	require.NoError(t, err)
	require.Nil(t, committed.TaskActivitySync)
	require.Nil(t, committed.CommittedTaskActivityUpdate)
	require.Equal(t, int64(1), committed.TaskActivityRevision)
}

func TestTaskEventRemovalCapturesDeletionAndLinkClear(t *testing.T) {
	db := setupTestDB(t)
	runStore := setupPlaybookRunStore(t, db)
	sqlStore := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	created, err := runStore.CreatePlaybookRun(NewBuilder(t).WithChecklists([]int{1}).ToPlaybookRun())
	require.NoError(t, err)
	createPlaybookRunChannel(t, sqlStore, created)
	cert, err := sqlStore.ActivateTaskActivityCertification(context.Background(), 0)
	require.NoError(t, err)
	previous, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	checked := previous.Clone()
	checked.Checklists[0].Items[0].State = app.ChecklistItemStateClosed
	checked.Checklists[0].Items[0].StateModified = 12345
	_, event, err := runStore.UpdatePlaybookRunWithTimelineEvent(previous, checked, taskStateRevisionEvent(created.ID, checked.Checklists[0].Items[0].ID, 12345, "check"), 0, 0)
	require.NoError(t, err)
	event.DeleteAt = 12346
	update, err := runStore.(interface {
		RemoveTaskStateTimelineEventWithUpdate(*app.TimelineEvent) (*app.PlaybookRunUpdate, error)
	}).RemoveTaskStateTimelineEventWithUpdate(event)
	require.NoError(t, err)
	require.Equal(t, cert.Epoch, update.TaskActivitySync.Epoch)
	require.Equal(t, "1", update.TaskActivitySync.BaseRevision)
	require.Equal(t, "2", update.TaskActivitySync.Revision)
	require.Equal(t, []string{event.ID}, update.TimelineEventDeletes)
	checklistUpdates := update.ChangedFields["checklists"].([]app.ChecklistUpdate)
	require.Len(t, checklistUpdates, 1)
	require.Len(t, checklistUpdates[0].ItemUpdates, 1)
	link, present := checklistUpdates[0].ItemUpdates[0].Fields["state_event_id"]
	require.True(t, present)
	require.Nil(t, link)

	duplicate, err := runStore.(interface {
		RemoveTaskStateTimelineEventWithUpdate(*app.TimelineEvent) (*app.PlaybookRunUpdate, error)
	}).RemoveTaskStateTimelineEventWithUpdate(event)
	require.NoError(t, err)
	require.Nil(t, duplicate)
}
