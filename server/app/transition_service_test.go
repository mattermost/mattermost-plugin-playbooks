// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	mock_bot "github.com/mattermost/mattermost-plugin-playbooks/server/bot/mocks"
)

type fakeTransitionStore struct {
	stubRunStoreGetOnly
	last       LifecycleTransition
	applyCalls int
	applied    bool
	applyErr   error
	timelineID string
	followers  []string
	updated    *PlaybookRun
}

func (s *fakeTransitionStore) ApplyLifecycleTransition(transition LifecycleTransition) (LifecycleTransitionResult, error) {
	s.applyCalls++
	s.last = transition
	if s.applyErr != nil {
		return LifecycleTransitionResult{}, s.applyErr
	}
	id := s.timelineID
	if id == "" && transition.Timeline != nil {
		id = "tl_1"
	}
	return LifecycleTransitionResult{Applied: s.applied, TimelineEventID: id}, nil
}

func (s *fakeTransitionStore) GetFollowers(_ string) ([]string, error) {
	return s.followers, nil
}

func (s *fakeTransitionStore) UpdateTimelineEvent(_ *TimelineEvent) error {
	return nil
}

func (s *fakeTransitionStore) CreateTimelineEvent(event *TimelineEvent) (*TimelineEvent, error) {
	if event.ID == "" {
		event.ID = "created"
	}
	return event, nil
}

func (s *fakeTransitionStore) UpdatePlaybookRun(run *PlaybookRun) (*PlaybookRun, error) {
	s.updated = run.Clone()
	return run, nil
}

func newTransitionHarness(t *testing.T, run *PlaybookRun, applied bool) (*PlaybookRunServiceImpl, *fakeTransitionStore, *mock_bot.MockPoster) {
	t.Helper()

	store := &fakeTransitionStore{
		stubRunStoreGetOnly: stubRunStoreGetOnly{run: run},
		applied:             applied,
		timelineID:          "tl_1",
	}

	mockAPI := &plugintest.API{}
	mockAPI.On("LogAuditRec", mock.Anything).Return().Maybe()
	mockAPI.On("GetUser", mock.Anything).Return(&model.User{Id: "user1", Username: "alice"}, nil).Maybe()
	mockAPI.On("GetChannelMembersByIds", mock.Anything, mock.Anything).Return(model.ChannelMembers{}, nil).Maybe()
	t.Cleanup(func() { mockAPI.AssertExpectations(t) })

	ctrl := gomock.NewController(t)
	poster := mock_bot.NewMockPoster(ctrl)
	poster.EXPECT().PublishWebsocketEventToChannelReliable(gomock.Any(), gomock.Any(), gomock.Any()).AnyTimes()

	svc := &PlaybookRunServiceImpl{
		store:          store,
		api:            mockAPI,
		pluginAPI:      pluginapi.NewClient(mockAPI, nil),
		configService:  &stubConfigService{},
		licenseChecker: &stubLicenseCheckerNoAttributes{},
		poster:         poster,
		scheduler:      &recordingScheduler{},
	}
	svc.transition = NewTransitionService(svc)
	return svc, store, poster
}

func TestFinishPlaybookRun_AlreadyFinishedIsNoop(t *testing.T) {
	run := &PlaybookRun{ID: "run1", CurrentStatus: StatusFinished, StatusSlug: StatusSlugClosed, ChannelID: "ch1"}
	svc, store, _ := newTransitionHarness(t, run, true)

	require.NoError(t, svc.FinishPlaybookRun(run.ID, "user1"))
	require.Equal(t, 0, store.applyCalls)
}

func TestFinishPlaybookRun_LostRaceIsNoop(t *testing.T) {
	run := &PlaybookRun{ID: "run1", CurrentStatus: StatusInProgress, StatusSlug: StatusSlugInProgress, ChannelID: "ch1", Name: "Inc"}
	svc, store, _ := newTransitionHarness(t, run, false)

	require.NoError(t, svc.FinishPlaybookRun(run.ID, "user1"))
	require.Equal(t, 1, store.applyCalls)
	require.Equal(t, StatusFinished, store.last.NewStatus)
	require.Equal(t, StatusSlugClosed, store.last.NewSlug)
	require.Equal(t, RunFinished, store.last.Timeline.EventType)
}

func TestFinishPlaybookRun_ApplyErrorPropagates(t *testing.T) {
	run := &PlaybookRun{ID: "run1", CurrentStatus: StatusInProgress, StatusSlug: StatusSlugInProgress, ChannelID: "ch1", Name: "Inc"}
	svc, store, _ := newTransitionHarness(t, run, true)
	store.applyErr = errors.New("db down")

	err := svc.FinishPlaybookRun(run.ID, "user1")
	require.Error(t, err)
	require.Contains(t, err.Error(), "db down")
}

func TestFinishPlaybookRun_SideEffectFailureDoesNotFailRequest(t *testing.T) {
	run := &PlaybookRun{ID: "run1", CurrentStatus: StatusInProgress, StatusSlug: StatusSlugInProgress, ChannelID: "ch1", Name: "Inc"}
	svc, store, poster := newTransitionHarness(t, run, true)
	poster.EXPECT().PostMessage(run.ChannelID, gomock.Any()).Return(nil, errors.New("post failed"))

	require.NoError(t, svc.FinishPlaybookRun(run.ID, "user1"))
	require.Equal(t, 1, store.applyCalls)
}

func TestRestorePlaybookRun_NotFinishedIsNoop(t *testing.T) {
	run := &PlaybookRun{ID: "run1", CurrentStatus: StatusInProgress, StatusSlug: StatusSlugInProgress, ChannelID: "ch1"}
	svc, store, _ := newTransitionHarness(t, run, true)

	require.NoError(t, svc.RestorePlaybookRun(run.ID, "user1"))
	require.Equal(t, 0, store.applyCalls)
}

func TestRestorePlaybookRun_AppliesOpenSlug(t *testing.T) {
	run := &PlaybookRun{ID: "run1", CurrentStatus: StatusFinished, StatusSlug: StatusSlugClosed, ChannelID: "ch1", Name: "Inc"}
	svc, store, poster := newTransitionHarness(t, run, true)
	poster.EXPECT().PostMessage(run.ChannelID, gomock.Any()).Return(&model.Post{Id: "post1"}, nil)

	require.NoError(t, svc.RestorePlaybookRun(run.ID, "user1"))
	require.Equal(t, 1, store.applyCalls)
	require.Equal(t, StatusInProgress, store.last.NewStatus)
	require.Equal(t, StatusSlugInProgress, store.last.NewSlug)
	require.Equal(t, RunRestored, store.last.Timeline.EventType)
	require.NotNil(t, store.last.EndAt)
	require.Equal(t, int64(0), *store.last.EndAt)
}

func TestSetRunStatus_UnknownSlug(t *testing.T) {
	run := &PlaybookRun{ID: "run1", CurrentStatus: StatusInProgress, StatusSlug: StatusSlugInProgress, ChannelID: "ch1"}
	svc, store, _ := newTransitionHarness(t, run, true)

	err := svc.SetRunStatus(run.ID, "user1", "not_a_slug")
	require.ErrorIs(t, err, ErrUnknownStatusSlug)
	require.Equal(t, 0, store.applyCalls)
}

func TestSetRunStatus_SameSlugIsNoop(t *testing.T) {
	run := &PlaybookRun{ID: "run1", CurrentStatus: StatusInProgress, StatusSlug: StatusSlugInProgress, ChannelID: "ch1"}
	svc, store, _ := newTransitionHarness(t, run, true)

	require.NoError(t, svc.SetRunStatus(run.ID, "user1", StatusSlugInProgress))
	require.Equal(t, 0, store.applyCalls)
}

func TestSetRunStatus_CloseUsesFinished(t *testing.T) {
	run := &PlaybookRun{ID: "run1", CurrentStatus: StatusInProgress, StatusSlug: StatusSlugInProgress, ChannelID: "ch1", Name: "Inc"}
	svc, store, poster := newTransitionHarness(t, run, true)
	poster.EXPECT().PostMessage(run.ChannelID, gomock.Any()).Return(&model.Post{Id: "post1"}, nil)

	require.NoError(t, svc.SetRunStatus(run.ID, "user1", StatusSlugClosed))
	require.Equal(t, StatusFinished, store.last.NewStatus)
	require.Equal(t, StatusSlugClosed, store.last.NewSlug)
	require.Equal(t, RunFinished, store.last.Timeline.EventType)
}
