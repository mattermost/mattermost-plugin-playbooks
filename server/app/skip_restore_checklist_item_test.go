// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// stubTaskStateStore is a minimal in-memory PlaybookRunStore: it round-trips a single run and
// records the timeline events written against it. Every other store method panics on nil deref,
// which is intentional — these tests must not reach them.
type stubTaskStateStore struct {
	PlaybookRunStore
	run     *PlaybookRun
	events  []*TimelineEvent
	updates int
}

func (s *stubTaskStateStore) GetPlaybookRun(_ string) (*PlaybookRun, error) {
	return s.run.Clone(), nil
}

func (s *stubTaskStateStore) UpdatePlaybookRun(run *PlaybookRun) (*PlaybookRun, error) {
	s.updates++
	s.run = run.Clone()
	return s.run.Clone(), nil
}

func (s *stubTaskStateStore) CreateTimelineEvent(event *TimelineEvent) (*TimelineEvent, error) {
	s.events = append(s.events, event)
	return event, nil
}

func (s *stubTaskStateStore) item() ChecklistItem {
	return s.run.Checklists[0].Items[0]
}

// stubTaskStateConfig reports incremental updates as enabled, which keeps
// sendPlaybookRunObjectUpdatedWS off the pluginAPI-backed non-member lookup.
type stubTaskStateConfig struct {
	config.Service
}

func (stubTaskStateConfig) IsIncrementalUpdatesEnabled() bool { return true }

// stubTaskStateAPI swallows audit records so the audited paths can run without a plugin environment.
type stubTaskStateAPI struct {
	plugin.API
	auditRecs []*model.AuditRecord
}

func (a *stubTaskStateAPI) LogAuditRec(rec *model.AuditRecord) {
	a.auditRecs = append(a.auditRecs, rec)
}

type stubTaskStatePoster struct {
	bot.Poster
	channelEvents []string
}

func (p *stubTaskStatePoster) PublishWebsocketEventToChannelReliable(event string, _ interface{}, _ string) {
	p.channelEvents = append(p.channelEvents, event)
}

type taskStateService struct {
	svc    *PlaybookRunServiceImpl
	store  *stubTaskStateStore
	api    *stubTaskStateAPI
	poster *stubTaskStatePoster
}

func newTaskStateService(t *testing.T, item ChecklistItem) taskStateService {
	t.Helper()

	store := &stubTaskStateStore{
		run: &PlaybookRun{
			ID:        "run1",
			ChannelID: "channel1",
			Checklists: []Checklist{{
				ID:    "checklist1",
				Title: "Checklist",
				Items: []ChecklistItem{item},
			}},
		},
	}
	api := &stubTaskStateAPI{}
	poster := &stubTaskStatePoster{}

	return taskStateService{
		svc: &PlaybookRunServiceImpl{
			store:          store,
			api:            api,
			poster:         poster,
			configService:  stubTaskStateConfig{},
			licenseChecker: stubLicenseChecker{},
		},
		store:  store,
		api:    api,
		poster: poster,
	}
}

func openItem() ChecklistItem {
	return ChecklistItem{
		ID:            "item1",
		Title:         "Deploy the **thing**",
		State:         ChecklistItemStateOpen,
		StateModified: 1000,
	}
}

// requireTaskStateEvent checks the event against the item it describes. The timestamps must match
// StateModified exactly: clients read event_at to place the task-activity chip.
func requireTaskStateEvent(t *testing.T, event *TimelineEvent, action string, item ChecklistItem) {
	t.Helper()

	assert.Equal(t, TaskStateModified, event.EventType)
	assert.Equal(t, "run1", event.PlaybookRunID)
	assert.Equal(t, "user1", event.SubjectUserID)
	assert.Equal(t, item.StateModified, event.EventAt)
	assert.Equal(t, item.StateModified, event.CreateAt)

	var details TaskStateModifiedDetails
	require.NoError(t, json.Unmarshal([]byte(event.Details), &details))
	assert.Equal(t, action, details.Action)
	assert.Equal(t, item.ID, details.ItemID)
	assert.Equal(t, "Deploy the thing", details.Task)
}

func TestSkipChecklistItem(t *testing.T) {
	t.Run("records the state change and a timeline event", func(t *testing.T) {
		h := newTaskStateService(t, openItem())
		before := model.GetMillis()

		require.NoError(t, h.svc.SkipChecklistItem("run1", "user1", 0, 0))

		item := h.store.item()
		assert.Equal(t, ChecklistItemStateSkipped, item.State)
		assert.GreaterOrEqual(t, item.StateModified, before)
		assert.Equal(t, item.StateModified, item.LastSkipped)

		require.Len(t, h.store.events, 1)
		requireTaskStateEvent(t, h.store.events[0], taskStateActionSkip, item)
		assert.Equal(t, "skipped checklist item **Deploy the thing**", h.store.events[0].Summary)

		assert.Equal(t, []string{playbookRunUpdatedIncrementalWSEvent}, h.poster.channelEvents, "without a broadcast the client never learns of the skip")

		require.Len(t, h.api.auditRecs, 1)
		assert.Equal(t, model.AuditStatusSuccess, h.api.auditRecs[0].Status)
	})

	t.Run("skipping a checked item overwrites the earlier state timestamp", func(t *testing.T) {
		checked := openItem()
		checked.State = ChecklistItemStateClosed
		h := newTaskStateService(t, checked)

		require.NoError(t, h.svc.SkipChecklistItem("run1", "user1", 0, 0))

		item := h.store.item()
		assert.Equal(t, ChecklistItemStateSkipped, item.State)
		assert.NotEqual(t, int64(1000), item.StateModified, "the check timestamp must not survive a skip")
	})

	t.Run("skipping an already skipped item is a no-op", func(t *testing.T) {
		h := newTaskStateService(t, openItem())
		require.NoError(t, h.svc.SkipChecklistItem("run1", "user1", 0, 0))
		first := h.store.item()

		require.NoError(t, h.svc.SkipChecklistItem("run1", "user1", 0, 0))

		assert.Equal(t, 1, h.store.updates, "second skip must not write the run again")
		assert.Len(t, h.store.events, 1, "second skip must not write a second timeline event")
		assert.Equal(t, first.StateModified, h.store.item().StateModified)
		assert.Equal(t, first.LastSkipped, h.store.item().LastSkipped)

		require.Len(t, h.api.auditRecs, 2)
		assert.Equal(t, model.AuditStatusSuccess, h.api.auditRecs[1].Status)
	})

	t.Run("invalid item number is rejected", func(t *testing.T) {
		h := newTaskStateService(t, openItem())

		require.Error(t, h.svc.SkipChecklistItem("run1", "user1", 0, 7))
		assert.Empty(t, h.store.events)
	})
}

func TestRestoreChecklistItem(t *testing.T) {
	skippedItem := func() ChecklistItem {
		item := openItem()
		item.State = ChecklistItemStateSkipped
		item.LastSkipped = 2000
		item.StateModified = 2000
		return item
	}

	t.Run("records the state change and a timeline event", func(t *testing.T) {
		h := newTaskStateService(t, skippedItem())
		before := model.GetMillis()

		require.NoError(t, h.svc.RestoreChecklistItem("run1", "user1", 0, 0))

		item := h.store.item()
		assert.Equal(t, ChecklistItemStateOpen, item.State)
		assert.GreaterOrEqual(t, item.StateModified, before)
		assert.Equal(t, int64(2000), item.LastSkipped, "LastSkipped records when the task was skipped, not whether it still is")

		require.Len(t, h.store.events, 1)
		requireTaskStateEvent(t, h.store.events[0], taskStateActionRestore, item)
		assert.Equal(t, "restored checklist item **Deploy the thing**", h.store.events[0].Summary)

		require.Len(t, h.api.auditRecs, 1)
		assert.Equal(t, model.AuditStatusSuccess, h.api.auditRecs[0].Status)
	})

	t.Run("restoring an already open item is a no-op", func(t *testing.T) {
		h := newTaskStateService(t, openItem())

		require.NoError(t, h.svc.RestoreChecklistItem("run1", "user1", 0, 0))

		assert.Zero(t, h.store.updates)
		assert.Empty(t, h.store.events)
		assert.Equal(t, int64(1000), h.store.item().StateModified)

		require.Len(t, h.api.auditRecs, 1)
		assert.Equal(t, model.AuditStatusSuccess, h.api.auditRecs[0].Status)
	})

	t.Run("restoring a non-skipped item is a no-op", func(t *testing.T) {
		for _, state := range []string{ChecklistItemStateClosed, ChecklistItemStateInProgress} {
			item := openItem()
			item.State = state
			h := newTaskStateService(t, item)

			require.NoError(t, h.svc.RestoreChecklistItem("run1", "user1", 0, 0))

			assert.Equal(t, state, h.store.item().State, "restore undoes a skip, not a check")
			assert.Zero(t, h.store.updates)
			assert.Empty(t, h.store.events, "%q -> open is an uncheck, and an event calling it a restore is what makes clients render the wrong verb", state)
		}
	})

	t.Run("restore after skip leaves exactly one event per transition", func(t *testing.T) {
		h := newTaskStateService(t, openItem())

		require.NoError(t, h.svc.SkipChecklistItem("run1", "user1", 0, 0))
		require.NoError(t, h.svc.RestoreChecklistItem("run1", "user1", 0, 0))

		require.Len(t, h.store.events, 2)
		assert.Contains(t, h.store.events[0].Details, `"action":"skip"`)
		assert.Contains(t, h.store.events[1].Details, `"action":"restore"`)
	})
}

// TestModifyCheckedStateSkip covers the /state endpoint being a strict superset of /skip: the webapp
// reaches skip/restore through it, so it has to set LastSkipped too.
func TestModifyCheckedStateSkip(t *testing.T) {
	t.Run("skip sets LastSkipped alongside StateModified", func(t *testing.T) {
		h := newTaskStateService(t, openItem())
		before := model.GetMillis()

		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateSkipped, 0, 0))

		item := h.store.item()
		assert.Equal(t, ChecklistItemStateSkipped, item.State)
		assert.GreaterOrEqual(t, item.LastSkipped, before)
		assert.Equal(t, item.StateModified, item.LastSkipped)

		require.Len(t, h.store.events, 1)
		requireTaskStateEvent(t, h.store.events[0], taskStateActionSkip, item)
	})

	t.Run("restore keeps LastSkipped", func(t *testing.T) {
		skipped := openItem()
		skipped.State = ChecklistItemStateSkipped
		skipped.LastSkipped = 2000
		h := newTaskStateService(t, skipped)

		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateOpen, 0, 0))

		item := h.store.item()
		assert.Equal(t, ChecklistItemStateOpen, item.State)
		assert.Equal(t, int64(2000), item.LastSkipped)

		require.Len(t, h.store.events, 1)
		requireTaskStateEvent(t, h.store.events[0], taskStateActionRestore, item)
	})

	t.Run("check does not touch LastSkipped", func(t *testing.T) {
		h := newTaskStateService(t, openItem())

		require.NoError(t, h.svc.ModifyCheckedState("run1", "user1", ChecklistItemStateClosed, 0, 0))

		assert.Equal(t, ChecklistItemStateClosed, h.store.item().State)
		assert.Zero(t, h.store.item().LastSkipped)
	})
}
