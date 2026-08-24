// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

type stubConfigService struct {
	config.Service
	taskRequirementsEnabled bool
	incrementalUpdates      bool
}

func (s *stubConfigService) IsTaskRequirementsEnabled() bool {
	return s.taskRequirementsEnabled
}

func (s *stubConfigService) IsIncrementalUpdatesEnabled() bool {
	return s.incrementalUpdates
}

type stubRunStoreForCheckedState struct {
	stubRunStoreGetOnly
	updatedRun     *PlaybookRun
	updateCalls    int
	timelineEvents []*TimelineEvent
}

func (s *stubRunStoreForCheckedState) UpdatePlaybookRun(run *PlaybookRun) (*PlaybookRun, error) {
	s.updateCalls++
	s.updatedRun = run.Clone()
	return run, nil
}

func (s *stubRunStoreForCheckedState) CreateTimelineEvent(event *TimelineEvent) (*TimelineEvent, error) {
	s.timelineEvents = append(s.timelineEvents, event)
	return event, nil
}

func newModifyCheckedStateHarness(t *testing.T, run *PlaybookRun, taskRequirementsEnabled bool) (*PlaybookRunServiceImpl, *stubRunStoreForCheckedState) {
	t.Helper()

	store := &stubRunStoreForCheckedState{
		stubRunStoreGetOnly: stubRunStoreGetOnly{run: run},
	}
	mockAPI := &plugintest.API{}
	mockAPI.On("LogAuditRec", mock.Anything).Return().Maybe()
	mockAPI.On("GetChannelMembersByIds", mock.Anything, mock.Anything).Return(model.ChannelMembers{}, nil).Maybe()
	t.Cleanup(func() { mockAPI.AssertExpectations(t) })

	ctrl := gomock.NewController(t)
	poster := mock_bot.NewMockPoster(ctrl)
	poster.EXPECT().PublishWebsocketEventToChannel(gomock.Any(), gomock.Any(), gomock.Any()).AnyTimes()

	svc := &PlaybookRunServiceImpl{
		store:          store,
		api:            mockAPI,
		pluginAPI:      pluginapi.NewClient(mockAPI, nil),
		configService:  &stubConfigService{taskRequirementsEnabled: taskRequirementsEnabled},
		licenseChecker: &stubLicenseCheckerNoAttributes{},
		poster:         poster,
	}
	return svc, store
}

func baseRunWithRequirement(value string) *PlaybookRun {
	return &PlaybookRun{
		ID:        "run-1",
		ChannelID: "channel-1",
		Checklists: []Checklist{{
			ID:    "cl-1",
			Title: "Tasks",
			Items: []ChecklistItem{{
				ID:    "item-1",
				Title: "Task",
				State: ChecklistItemStateOpen,
				Requirements: []TaskRequirement{{
					ID:    "req-1",
					Label: "Ticket URL",
					Value: value,
				}},
			}},
		}},
	}
}

func TestModifyCheckedState_Requirements(t *testing.T) {
	t.Run("rejects empty requirement values when closing and beta enabled", func(t *testing.T) {
		run := baseRunWithRequirement("")
		svc, store := newModifyCheckedStateHarness(t, run, true)

		err := svc.ModifyCheckedState(run.ID, "user-1", ChecklistItemStateClosed, 0, 0)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrMalformedPlaybookRun))
		assert.Equal(t, 0, store.updateCalls)
	})

	t.Run("allows closing with empty values when beta disabled", func(t *testing.T) {
		run := baseRunWithRequirement("")
		svc, store := newModifyCheckedStateHarness(t, run, false)

		err := svc.ModifyCheckedState(run.ID, "user-1", ChecklistItemStateClosed, 0, 0)

		require.NoError(t, err)
		require.Equal(t, 1, store.updateCalls)
		require.NotNil(t, store.updatedRun)
		assert.Equal(t, ChecklistItemStateClosed, store.updatedRun.Checklists[0].Items[0].State)
	})

	t.Run("saves requirement values without state change", func(t *testing.T) {
		run := baseRunWithRequirement("")
		svc, store := newModifyCheckedStateHarness(t, run, true)

		err := svc.ModifyCheckedState(
			run.ID,
			"user-1",
			ChecklistItemStateOpen,
			0,
			0,
			ModifyCheckedStateOptions{RequirementValues: map[string]string{"req-1": "https://example.com"}},
		)

		require.NoError(t, err)
		require.Equal(t, 1, store.updateCalls)
		require.NotNil(t, store.updatedRun)
		item := store.updatedRun.Checklists[0].Items[0]
		assert.Equal(t, ChecklistItemStateOpen, item.State)
		assert.Equal(t, "https://example.com", item.Requirements[0].Value)
		require.Len(t, store.timelineEvents, 1)
		assert.Equal(t, TaskStateModified, store.timelineEvents[0].EventType)
		assert.Contains(t, store.timelineEvents[0].Details, "requirements_updated")
	})

	t.Run("rejects clearing requirements on already-closed item when beta enabled", func(t *testing.T) {
		run := baseRunWithRequirement("https://example.com")
		run.Checklists[0].Items[0].State = ChecklistItemStateClosed
		svc, store := newModifyCheckedStateHarness(t, run, true)

		err := svc.ModifyCheckedState(
			run.ID,
			"user-1",
			ChecklistItemStateClosed,
			0,
			0,
			ModifyCheckedStateOptions{RequirementValues: map[string]string{"req-1": ""}},
		)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrMalformedPlaybookRun))
		assert.Equal(t, 0, store.updateCalls)
	})
}

func TestCleanUpChecklists_ClearsRequirementValues(t *testing.T) {
	checklists := []Checklist{{
		Title: "Tasks",
		Items: []ChecklistItem{{
			Title: "Task",
			State: ChecklistItemStateClosed,
			Requirements: []TaskRequirement{{
				ID:    "req-1",
				Label: "Ticket URL",
				Value: "https://example.com",
			}},
		}},
	}}

	CleanUpChecklists(checklists)

	assert.Equal(t, "", checklists[0].Items[0].State)
	assert.Equal(t, "Ticket URL", checklists[0].Items[0].Requirements[0].Label)
	assert.Equal(t, "", checklists[0].Items[0].Requirements[0].Value)
}

func TestAddChecklist_RequirementsValidation(t *testing.T) {
	t.Run("rejects adding checklist item with requirements and enabled task actions", func(t *testing.T) {
		run := baseRunWithRequirement("")
		run.Checklists = nil
		svc, store := newModifyCheckedStateHarness(t, run, true)
		enabledTaskActions := []TaskAction{{
			Trigger: Trigger{Type: KeywordsByUsersTriggerType, Payload: `{"keywords":["resolved"],"user_ids":[]}`},
			Actions: []Action{{Type: MarkItemAsDoneActionType, Payload: `{"enabled":true}`}},
		}}

		err := svc.AddChecklist(run.ID, "user-1", Checklist{
			Title: "Tasks",
			Items: []ChecklistItem{{
				Title: "Task",
				Requirements: []TaskRequirement{{
					ID:    "req-1",
					Label: "Ticket URL",
				}},
				TaskActions: enabledTaskActions,
			}},
		})

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrMalformedPlaybookRun))
		assert.Equal(t, 0, store.updateCalls)
	})
}

func TestAddChecklistItem_RequirementsValidation(t *testing.T) {
	t.Run("rejects adding item with requirements and enabled task actions", func(t *testing.T) {
		run := baseRunWithRequirement("")
		svc, store := newModifyCheckedStateHarness(t, run, true)
		enabledTaskActions := []TaskAction{{
			Trigger: Trigger{Type: KeywordsByUsersTriggerType, Payload: `{"keywords":["resolved"],"user_ids":[]}`},
			Actions: []Action{{Type: MarkItemAsDoneActionType, Payload: `{"enabled":true}`}},
		}}

		err := svc.AddChecklistItem(run.ID, "user-1", 0, ChecklistItem{
			Title: "Task",
			Requirements: []TaskRequirement{{
				ID:    "req-1",
				Label: "Ticket URL",
			}},
			TaskActions: enabledTaskActions,
		})

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrMalformedPlaybookRun))
		assert.Equal(t, 0, store.updateCalls)
	})
}
