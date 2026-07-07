// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/pluginapi/cluster"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// recordingScheduler is a minimal JobOnceScheduler that records Cancel calls.
// All other methods are no-ops so that handleReminderToFillRetro can run without
// a full plugin environment.
type recordingScheduler struct {
	cancelCalls []string
}

func (r *recordingScheduler) Cancel(key string) {
	r.cancelCalls = append(r.cancelCalls, key)
}
func (r *recordingScheduler) SetCallback(func(string, any)) error { return nil }
func (r *recordingScheduler) Start() error                        { return nil }
func (r *recordingScheduler) ScheduleOnce(string, time.Time, any) (*cluster.JobOnce, error) {
	return nil, nil
}
func (r *recordingScheduler) ListScheduledJobs() ([]cluster.JobOnceMetadata, error) { return nil, nil }

// stubRunStore satisfies PlaybookRunStore via interface embedding.
// Only GetPlaybookRun is implemented; any other method panics on nil deref,
// which is intentional — these tests must not trigger them.
type stubRunStore struct {
	PlaybookRunStore
	run *PlaybookRun
}

func (s *stubRunStore) GetPlaybookRun(_ string) (*PlaybookRun, error) {
	return s.run, nil
}

// stubLicenseChecker satisfies LicenseChecker, returning false for all checks so
// that GetPlaybookRun skips property-field enrichment in unit tests.
type stubLicenseChecker struct{}

func (stubLicenseChecker) PlaybookAllowed(bool) bool         { return false }
func (stubLicenseChecker) RetrospectiveAllowed() bool        { return false }
func (stubLicenseChecker) TimelineAllowed() bool             { return false }
func (stubLicenseChecker) StatsAllowed() bool                { return false }
func (stubLicenseChecker) ChecklistItemDueDateAllowed() bool { return false }
func (stubLicenseChecker) PlaybookAttributesAllowed() bool   { return false }
func (stubLicenseChecker) ConditionalPlaybooksAllowed() bool { return false }

// TestHandleReminderToFillRetro_Cancel verifies that handleReminderToFillRetro calls
// scheduler.Cancel exactly once when RetrospectiveEnabled is false, regardless of
// the run's current status.
func TestHandleReminderToFillRetro_Cancel(t *testing.T) {
	cases := []struct {
		name string
		run  PlaybookRun
	}{
		{
			name: "retro disabled when finished: cancel scheduler",
			run:  PlaybookRun{ID: "run1", RetrospectiveEnabled: false, CurrentStatus: StatusFinished},
		},
		{
			name: "retro disabled when in-progress: still cancel scheduler",
			run:  PlaybookRun{ID: "run2", RetrospectiveEnabled: false, CurrentStatus: StatusInProgress},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sched := &recordingScheduler{}
			svc := &PlaybookRunServiceImpl{
				store:          &stubRunStore{run: &tc.run},
				scheduler:      sched,
				licenseChecker: stubLicenseChecker{},
			}

			svc.handleReminderToFillRetro(tc.run.ID)

			require.Len(t, sched.cancelCalls, 1, "expected exactly one Cancel call")
			assert.Equal(t, RetrospectivePrefix+tc.run.ID, sched.cancelCalls[0])
		})
	}
}

// TestHandleReminderToFillRetro_Skip verifies that handleReminderToFillRetro returns
// early without touching the scheduler when the run is retro-enabled but either
// already published or not yet finished.
func TestHandleReminderToFillRetro_Skip(t *testing.T) {
	cases := []struct {
		name string
		run  PlaybookRun
	}{
		{
			name: "retro enabled but already published: no scheduler call",
			run:  PlaybookRun{ID: "run3", RetrospectiveEnabled: true, RetrospectivePublishedAt: 12345678, CurrentStatus: StatusFinished},
		},
		{
			name: "retro enabled, not yet finished: no scheduler call",
			run:  PlaybookRun{ID: "run4", RetrospectiveEnabled: true, RetrospectivePublishedAt: 0, CurrentStatus: StatusInProgress},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sched := &recordingScheduler{}
			svc := &PlaybookRunServiceImpl{
				store:          &stubRunStore{run: &tc.run},
				scheduler:      sched,
				licenseChecker: stubLicenseChecker{},
			}

			require.NotPanics(t, func() {
				svc.handleReminderToFillRetro(tc.run.ID)
			})

			assert.Empty(t, sched.cancelCalls, "Cancel must not be called for a skip case")
		})
	}
}
