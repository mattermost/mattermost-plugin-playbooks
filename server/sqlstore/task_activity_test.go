// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost/server/public/model"
)

func TestTaskStateAndEventCommitTogether(t *testing.T) {
	db := setupTestDB(t)
	runStore := setupPlaybookRunStore(t, db)
	sqlStore := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	input := NewBuilder(t).WithChecklists([]int{1}).ToPlaybookRun()
	created, err := runStore.CreatePlaybookRun(input)
	require.NoError(t, err)
	createPlaybookRunChannel(t, sqlStore, created)

	previous, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	updated := previous.Clone()
	item := &updated.Checklists[0].Items[0]
	item.State = app.ChecklistItemStateClosed
	item.StateModified = 12345
	event := &app.TimelineEvent{
		PlaybookRunID: created.ID,
		EventType:     app.TaskStateModified,
		EventAt:       item.StateModified,
		CreateAt:      item.StateModified,
		SubjectUserID: model.NewId(),
		Details:       `{"action":"check","item_id":"` + item.ID + `"}`,
	}

	_, err = db.Exec(`CREATE FUNCTION reject_task_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'event insertion failed'; END $$`)
	require.NoError(t, err)
	_, err = db.Exec(`CREATE TRIGGER reject_task_event BEFORE INSERT ON IR_TimelineEvent FOR EACH ROW EXECUTE FUNCTION reject_task_event()`)
	require.NoError(t, err)

	_, _, err = runStore.UpdatePlaybookRunWithTimelineEvent(previous, updated, event, 0, 0)
	require.ErrorContains(t, err, "event insertion failed")
	afterFailure, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Equal(t, previous.Checklists, afterFailure.Checklists)
	require.Equal(t, previous.UpdateAt, afterFailure.UpdateAt)
	require.Empty(t, afterFailure.TimelineEvents)

	_, err = db.Exec(`DROP TRIGGER reject_task_event ON IR_TimelineEvent`)
	require.NoError(t, err)
	_, err = db.Exec(`DROP FUNCTION reject_task_event()`)
	require.NoError(t, err)

	committed, committedEvent, err := runStore.UpdatePlaybookRunWithTimelineEvent(previous, updated, event, 0, 0)
	require.NoError(t, err)
	require.NotEmpty(t, committedEvent.ID)
	require.Equal(t, &committedEvent.ID, committed.Checklists[0].Items[0].StateEventID)

	afterCommit, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Equal(t, app.ChecklistItemStateClosed, afterCommit.Checklists[0].Items[0].State)
	require.Equal(t, &committedEvent.ID, afterCommit.Checklists[0].Items[0].StateEventID)
	require.Len(t, afterCommit.TimelineEvents, 1)
	require.Equal(t, committedEvent.ID, afterCommit.TimelineEvents[0].ID)

	_, _, err = runStore.UpdatePlaybookRunWithTimelineEvent(previous, updated, event, 0, 0)
	require.ErrorContains(t, err, "checklists changed")
	afterConflict, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Equal(t, afterCommit.Checklists, afterConflict.Checklists)
	require.Len(t, afterConflict.TimelineEvents, 1)

	committedEvent.DeleteAt = model.GetMillis()
	require.NoError(t, runStore.UpdateTimelineEvent(committedEvent))
	afterRemoval, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Nil(t, afterRemoval.Checklists[0].Items[0].StateEventID)
	require.Empty(t, afterRemoval.TimelineEvents)
	require.Greater(t, afterRemoval.UpdateAt, afterConflict.UpdateAt)

	require.NoError(t, runStore.UpdateTimelineEvent(committedEvent))
	afterDuplicateRemoval, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Equal(t, afterRemoval.UpdateAt, afterDuplicateRemoval.UpdateAt)
}

func TestTaskStateLinkDistinguishesSameMillisecondTransitions(t *testing.T) {
	db := setupTestDB(t)
	runStore := setupPlaybookRunStore(t, db)
	sqlStore := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	created, err := runStore.CreatePlaybookRun(NewBuilder(t).WithChecklists([]int{1}).ToPlaybookRun())
	require.NoError(t, err)
	createPlaybookRunChannel(t, sqlStore, created)

	const eventAt int64 = 12345
	ids := make([]string, 0, 3)
	for _, state := range []string{app.ChecklistItemStateClosed, app.ChecklistItemStateOpen, app.ChecklistItemStateClosed} {
		previous, getErr := runStore.GetPlaybookRun(created.ID)
		require.NoError(t, getErr)
		updated := previous.Clone()
		item := &updated.Checklists[0].Items[0]
		item.State = state
		item.StateModified = eventAt
		event := &app.TimelineEvent{
			PlaybookRunID: created.ID,
			EventType:     app.TaskStateModified,
			EventAt:       eventAt,
			CreateAt:      eventAt,
			SubjectUserID: model.NewId(),
			Details:       `{"item_id":"` + item.ID + `"}`,
		}
		_, committedEvent, commitErr := runStore.UpdatePlaybookRunWithTimelineEvent(previous, updated, event, 0, 0)
		require.NoError(t, commitErr)
		ids = append(ids, committedEvent.ID)
	}
	require.NotEqual(t, ids[0], ids[1])
	require.NotEqual(t, ids[1], ids[2])
	require.NotEqual(t, ids[0], ids[2])

	finalRun, err := runStore.GetPlaybookRun(created.ID)
	require.NoError(t, err)
	require.Equal(t, app.ChecklistItemStateClosed, finalRun.Checklists[0].Items[0].State)
	require.Equal(t, &ids[2], finalRun.Checklists[0].Items[0].StateEventID)
	require.Len(t, finalRun.TimelineEvents, 3)
}
