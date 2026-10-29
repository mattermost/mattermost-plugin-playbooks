// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"encoding/json"
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

func TestStaleRunOnlyWriteKeepsConcurrentChecklistChange(t *testing.T) {
	db := setupTestDB(t)
	runStore := setupPlaybookRunStore(t, db)
	sqlStore := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	created, err := runStore.CreatePlaybookRun(NewBuilder(t).WithChecklists([]int{2}).ToPlaybookRun())
	require.NoError(t, err)
	createPlaybookRunChannel(t, sqlStore, created)

	staleRead, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)

	checked := staleRead.Clone()
	checked.Checklists[0].Items[0].State = app.ChecklistItemStateClosed
	checked.Checklists[0].Items[0].StateModified = 5
	_, checkEvent, err := runStore.UpdatePlaybookRunWithTimelineEvent(staleRead.Clone(), checked, taskStateRevisionEvent(created.ID, checked.Checklists[0].Items[0].ID, 5, "check"), 0, 0)
	require.NoError(t, err)

	reminder := staleRead.Clone()
	reminder.ReminderPostID = "post-id"
	updated, err := runStore.UpdatePlaybookRun(reminder)
	require.NoError(t, err, "a write that leaves the checklists as it read them must not conflict with a concurrent checklist change")
	require.Equal(t, int64(1), updated.TaskActivityRevision, "a run-only write must not bump the revision")
	require.Nil(t, updated.CommittedTaskActivityUpdate)

	persisted, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Equal(t, "post-id", persisted.ReminderPostID)
	require.Equal(t, app.ChecklistItemStateClosed, persisted.Checklists[0].Items[0].State, "the stale write must not revert the concurrent task check")
	require.Equal(t, &checkEvent.ID, persisted.Checklists[0].Items[0].StateEventID)
	require.Equal(t, int64(1), persisted.TaskActivityRevision)
}

func TestRunOnlyWriteToLegacyChecklistJSONKeepsRevision(t *testing.T) {
	db := setupTestDB(t)
	runStore := setupPlaybookRunStore(t, db)
	sqlStore := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	created, err := runStore.CreatePlaybookRun(NewBuilder(t).WithChecklists([]int{2}).ToPlaybookRun())
	require.NoError(t, err)
	createPlaybookRunChannel(t, sqlStore, created)
	rewriteAsLegacyChecklistsJSON(t, sqlStore, created.ID)
	_, err = sqlStore.ActivateTaskActivityCertification(context.Background(), 0)
	require.NoError(t, err)

	run, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	retrospective := run.Clone()
	retrospective.Retrospective = "retrospective text"
	updated, err := runStore.UpdatePlaybookRun(retrospective)
	require.NoError(t, err)
	require.Zero(t, updated.TaskActivityRevision, "checklists encoded by an older plugin must not read as a checklist change")
	require.Nil(t, updated.CommittedTaskActivityUpdate, "a run-only write must not produce a certified delta")
}

// rewriteAsLegacyChecklistsJSON encodes the run's checklists as plugin versions before task
// activity sync wrote them: no state_event_id key, and items_order stored with each checklist.
func rewriteAsLegacyChecklistsJSON(t *testing.T, sqlStore *SQLStore, runID string) {
	t.Helper()

	var raw []byte
	require.NoError(t, sqlStore.db.Get(&raw, `SELECT ChecklistsJSON FROM IR_Incident WHERE ID = $1`, runID))
	var checklists []map[string]any
	require.NoError(t, json.Unmarshal(raw, &checklists))
	for _, checklist := range checklists {
		var itemsOrder []string
		for _, item := range checklist["items"].([]any) {
			delete(item.(map[string]any), "state_event_id")
			itemsOrder = append(itemsOrder, item.(map[string]any)["id"].(string))
		}
		checklist["items_order"] = itemsOrder
	}
	legacy, err := json.Marshal(checklists)
	require.NoError(t, err)
	_, err = sqlStore.db.Exec(`UPDATE IR_Incident SET ChecklistsJSON = $1 WHERE ID = $2`, string(legacy), runID)
	require.NoError(t, err)
}

func TestStateEventLinksAreServerOwned(t *testing.T) {
	db := setupTestDB(t)
	runStore := setupPlaybookRunStore(t, db)
	sqlStore := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	forged := model.NewId()
	toCreate := NewBuilder(t).WithChecklists([]int{2}).ToPlaybookRun()
	toCreate.Checklists[0].Items[1].StateEventID = &forged
	created, err := runStore.CreatePlaybookRun(toCreate)
	require.NoError(t, err)
	createPlaybookRunChannel(t, sqlStore, created)

	run, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Nil(t, run.Checklists[0].Items[1].StateEventID, "a new run must not keep links copied from its source")

	checked := run.Clone()
	checked.Checklists[0].Items[0].State = app.ChecklistItemStateClosed
	checked.Checklists[0].Items[0].StateModified = 5
	run, checkEvent, err := runStore.UpdatePlaybookRunWithTimelineEvent(run.Clone(), checked, taskStateRevisionEvent(created.ID, checked.Checklists[0].Items[0].ID, 5, "check"), 0, 0)
	require.NoError(t, err)

	edited := run.Clone()
	edited.Checklists[0].Items[1].StateEventID = &checkEvent.ID
	duplicate := edited.Checklists[0].Items[0]
	duplicate.ID = model.NewId()
	added := app.ChecklistItem{ID: model.NewId(), Title: "added", StateEventID: &forged}
	edited.Checklists[0].Items = append(edited.Checklists[0].Items, duplicate, added)
	edited.Checklists[0].Title = "edited"
	updated, err := runStore.UpdatePlaybookRun(edited)
	require.NoError(t, err)

	persisted, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	for _, run := range []*app.PlaybookRun{updated, persisted} {
		items := run.Checklists[0].Items
		require.Equal(t, &checkEvent.ID, items[0].StateEventID, "an unchanged task keeps the link its state mutation set")
		require.Nil(t, items[1].StateEventID, "a client cannot link an existing task to another task's event")
		require.Nil(t, items[2].StateEventID, "a duplicated task must not inherit the original's link")
		require.Nil(t, items[3].StateEventID, "a client cannot set the link on a task it adds")
	}
}
